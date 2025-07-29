# Three-Type Input Classification Implementation Guide

## Overview

This document provides the **implementation guide** for the new three-type input classification system that replaces the cognitive pattern approach. The system classifies user inputs into three distinct types: **command**, **prompt**, and **workflow**.

**Design Foundation**: Based on the updated agent.md specification that eliminates cognitive pattern complexity in favor of practical input classification.

**Research Challenge**: Text-to-workflow extraction is identified as the core AI research problem requiring dedicated investigation.

---

## Architecture Overview

### Implementation Strategy

```
Input → PatternRecognizer → Three-Type Classification
                           ├── Command → CommandHandler (Abstract) → ConcreteImpl
                           ├── Prompt → PromptHandler → PromptManager → LLM  
                           └── Workflow → WorkflowExtractor → WorkflowSpec → WorkflowEngine
```

**Architectural Principles**:
- **Simple Command Detection**: Regex-based `/` prefix matching
- **Prompt vs Workflow Analysis**: Complexity indicators without node extraction
- **Workflow Research Separation**: Acknowledge node extraction as separate research problem
- **High Confidence for Simple Cases**: "Hi" should get high confidence as prompt

### Logical Flow Architecture

```
Input → Command Check → Prompt/Workflow Analysis → Classification
         ↓               ↓                           ↓
       /prefix?       Complexity Analysis        Result + Confidence
       └─ Command         ↓                          ↓
                    Length, Task Indicators      Command/Prompt/Workflow
                    Tool Requirements               ↓
                         ↓                    Route to Handler
                   Prompt vs Workflow
```

**Simplified Flow**:
1. **Command Detection**: Fast regex check for `/` prefix
2. **Complexity Analysis**: Analyze input characteristics without extracting workflow nodes
3. **Classification**: High confidence assignment to one of three types
4. **Routing**: Send to appropriate handler based on classification

---

## Component Architecture

### 1. InputClassifier - Main Classification Engine

**Purpose**: Replace IPatternMatcher with clean three-type classification
**Core Responsibility**: Classify any input with high confidence

```typescript
class InputClassifier implements IInputClassifier {
  async classifyInput(input: string, context?: ProcessingContext): Promise<InputClassificationResult> {
    // 1. Command detection (highest priority)
    if (this.isCommand(input)) {
      return {
        type: 'command',
        confidence: 1.0,
        metadata: new Map([['commandName', this.extractCommandName(input)]])
      };
    }
    
    // 2. Prompt vs Workflow analysis
    const complexityAnalysis = this.analyzeComplexity(input, context);
    
    if (complexityAnalysis.isSimplePrompt) {
      return {
        type: 'prompt',
        confidence: complexityAnalysis.confidence,
        metadata: new Map([['promptType', complexityAnalysis.promptType]])
      };
    }
    
    return {
      type: 'workflow',
      confidence: complexityAnalysis.confidence,
      metadata: new Map([
        ['workflowIndicators', complexityAnalysis.workflowIndicators],
        ['estimatedComplexity', complexityAnalysis.complexity]
      ])
    };
  }
}
```

### 2. Command Detection - Simple and Reliable

**Implementation**: Straightforward pattern matching

```typescript
class CommandDetector {
  isCommand(input: string): boolean {
    return input.trim().startsWith('/');
  }
  
  extractCommandName(input: string): string {
    const match = input.trim().match(/^\/(\w+)/);
    return match ? match[1] : 'unknown';
  }
  
  // Examples:
  // "/help" → command: "help", confidence: 1.0
  // "/status --verbose" → command: "status", confidence: 1.0
  // "/ invalid" → command: "unknown", confidence: 0.8
}
```

### 3. Complexity Analyzer - Prompt vs Workflow

**Purpose**: Distinguish simple conversation from complex tasks
**Key Insight**: Don't try to extract workflow nodes, just detect workflow need

```typescript
class ComplexityAnalyzer {
  analyzeComplexity(input: string, context?: ProcessingContext): ComplexityAnalysis {
    const indicators = this.extractComplexityIndicators(input);
    
    // Simple prompt indicators
    if (this.isSimplePrompt(input, indicators)) {
      return {
        isSimplePrompt: true,
        confidence: this.calculatePromptConfidence(input, indicators),
        promptType: this.classifyPromptType(input),
        complexity: 'low'
      };
    }
    
    // Workflow indicators
    return {
      isSimplePrompt: false,
      confidence: this.calculateWorkflowConfidence(input, indicators),
      workflowIndicators: indicators.workflowSignals,
      complexity: this.estimateComplexity(indicators)
    };
  }
  
  private isSimplePrompt(input: string, indicators: ComplexityIndicators): boolean {
    // High confidence prompt patterns
    if (indicators.greetingWords.length > 0) return true;
    if (indicators.questionWords.length > 0 && input.length < 50) return true;
    if (indicators.conversationalMarkers.length > 0) return true;
    
    // Low task complexity
    if (indicators.actionVerbs.length === 0) return true;
    if (indicators.fileReferences.length === 0 && indicators.technicalTerms.length === 0) return true;
    
    return false;
  }
}
```

### 4. Complexity Indicators - Signal Detection

**Purpose**: Extract signals that indicate input type without workflow extraction

```typescript
interface ComplexityIndicators {
  // Prompt indicators
  greetingWords: string[];        // ["hi", "hello", "thanks"]
  questionWords: string[];        // ["what", "how", "why", "when"]
  conversationalMarkers: string[]; // ["please", "can you", "could you"]
  
  // Workflow indicators  
  actionVerbs: string[];          // ["fix", "create", "refactor", "implement"]
  fileReferences: string[];       // [".js", ".py", "auth.js", "src/"]
  technicalTerms: string[];       // ["function", "class", "API", "database"]
  taskComplexity: string[];       // ["architecture", "design", "debug", "test"]
  
  // Context indicators
  toolRequirements: string[];     // Estimated tools needed
  stepIndicators: string[];       // Words suggesting multi-step process
}

class IndicatorExtractor {
  extractComplexityIndicators(input: string): ComplexityIndicators {
    const lowerInput = input.toLowerCase();
    
    return {
      greetingWords: this.findGreetings(lowerInput),
      questionWords: this.findQuestionWords(lowerInput),
      conversationalMarkers: this.findConversationalMarkers(lowerInput),
      actionVerbs: this.findActionVerbs(lowerInput),
      fileReferences: this.findFileReferences(input), // Case sensitive
      technicalTerms: this.findTechnicalTerms(lowerInput),
      taskComplexity: this.findComplexityMarkers(lowerInput),
      toolRequirements: this.estimateToolNeeds(lowerInput),
      stepIndicators: this.findStepIndicators(lowerInput)
    };
  }
}
```

### 5. Confidence Calculation - Reliable Scoring

**Purpose**: Provide high confidence for clear cases, handle ambiguity gracefully

```typescript
class ConfidenceCalculator {
  calculatePromptConfidence(input: string, indicators: ComplexityIndicators): number {
    let confidence = 0.5; // Base confidence
    
    // Strong prompt signals
    if (indicators.greetingWords.length > 0) confidence += 0.4;
    if (indicators.questionWords.length > 0 && input.length < 30) confidence += 0.3;
    if (indicators.conversationalMarkers.length > 0) confidence += 0.2;
    
    // Workflow signals reduce prompt confidence
    if (indicators.fileReferences.length > 0) confidence -= 0.3;
    if (indicators.actionVerbs.length > 2) confidence -= 0.2;
    if (indicators.technicalTerms.length > 3) confidence -= 0.2;
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }
  
  calculateWorkflowConfidence(input: string, indicators: ComplexityIndicators): number {
    let confidence = 0.5; // Base confidence
    
    // Strong workflow signals
    if (indicators.actionVerbs.length > 0) confidence += 0.2;
    if (indicators.fileReferences.length > 0) confidence += 0.3;
    if (indicators.technicalTerms.length > 2) confidence += 0.2;
    if (indicators.stepIndicators.length > 1) confidence += 0.2;
    
    // Simple prompt signals reduce workflow confidence
    if (indicators.greetingWords.length > 0) confidence -= 0.4;
    if (input.length < 20 && indicators.questionWords.length > 0) confidence -= 0.3;
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }
}
```

---

## Classification Examples

### High Confidence Cases

```typescript
// Commands - Always 1.0 confidence
"/help" → { type: 'command', confidence: 1.0 }
"/status --verbose" → { type: 'command', confidence: 1.0 }

// Simple Prompts - High confidence
"hi" → { type: 'prompt', confidence: 0.9, promptType: 'greeting' }
"what is recursion?" → { type: 'prompt', confidence: 0.85, promptType: 'question' }
"thanks for the help" → { type: 'prompt', confidence: 0.9, promptType: 'acknowledgment' }

// Clear Workflows - High confidence  
"fix the bug in auth.js" → { type: 'workflow', confidence: 0.9, indicators: ['actionVerb:fix', 'file:auth.js', 'technical:bug'] }
"refactor this code to use async/await" → { type: 'workflow', confidence: 0.85, indicators: ['actionVerb:refactor', 'technical:async'] }
```

### Medium Confidence Cases

```typescript
// Ambiguous cases - Still classified but lower confidence
"how do I fix this error?" → { type: 'workflow', confidence: 0.6, indicators: ['questionWord:how', 'actionVerb:fix', 'technical:error'] }
"create a simple function" → { type: 'workflow', confidence: 0.7, indicators: ['actionVerb:create', 'technical:function'] }
"explain how authentication works" → { type: 'prompt', confidence: 0.65, indicators: ['actionVerb:explain', 'questionWord:how'] }
```

---

## Workflow Extraction Challenge

### Research Problem Definition

**Core Challenge**: Convert workflow-type inputs into executable workflow specifications

**Input**: "Fix the TypeError in auth.js line 42"  
**Required Output**:
```typescript
{
  mode: 'debugging',           // Workflow type
  workflowSpec: {
    nodes: [
      { id: 'read_file', params: { file: 'auth.js', line: 42 } },
      { id: 'analyze_error', params: { errorType: 'TypeError' } },
      { id: 'identify_cause', params: {} },
      { id: 'implement_fix', params: {} },
      { id: 'test_fix', params: {} }
    ],
    edges: [
      { from: 'read_file', to: 'analyze_error' },
      { from: 'analyze_error', to: 'identify_cause' },
      // ... execution flow
    ]
  }
}
```

### Research Areas

1. **Workflow Mode Classification**
   - How to identify workflow types (editing, debugging, planning, testing)
   - Domain-specific mode recognition
   - Context-aware mode selection

2. **Node Sequence Generation**
   - LLM-based step decomposition
   - Template-based workflow expansion  
   - Dynamic node parameter extraction

3. **Execution Flow Design**
   - Dependency analysis between nodes
   - Conditional execution paths
   - Error handling and recovery flows

4. **Tool Requirement Analysis**
   - Which tools are needed for each workflow type
   - Tool availability validation
   - Alternative tool selection

### Implementation Approach (Future Research)

```typescript
// Phase 1: Simple workflow mode detection
class WorkflowModeDetector {
  detectMode(input: string, indicators: ComplexityIndicators): string {
    // Rule-based mode detection
    if (indicators.actionVerbs.includes('fix') || indicators.technicalTerms.includes('error')) {
      return 'debugging';
    }
    if (indicators.actionVerbs.includes('create') || indicators.actionVerbs.includes('implement')) {
      return 'creation';
    }
    // ... other modes
    return 'generic';
  }
}

// Phase 2: Node extraction (requires AI research)
class WorkflowNodeExtractor {
  async extractNodes(input: string, mode: string): Promise<WorkflowNode[]> {
    // This is the core research problem
    // Approaches to investigate:
    // 1. LLM-based decomposition
    // 2. Template matching + parameter extraction
    // 3. Hybrid rule-based + AI approach
    // 4. Learning from execution traces
  }
}
```

---

## Interface Contracts

### Abstract Interface References

All interface contracts are defined in **[agent.abstractions.md](./agent.abstractions.md)**:

**Core Classification Interfaces**:
- `IInputClassifier` - Three-type input classification
- `ICommandHandler` - System command execution  
- `IWorkflowExtractor` - Workflow mode and node extraction

**Supporting Interfaces**:
- `InputClassificationResult` - Classification output structure
- `CommandDefinition` & `CommandResult` - Command system contracts
- `WorkflowExtractionResult` & `WorkflowSpec` - Workflow extraction contracts

**Updated Agent Interfaces**:
- `AgentConfiguration` - Now includes inputClassifier, commandHandler, workflowExtractor
- `AgentResponse` - Now includes inputType and workflowMode instead of cognitive patterns
- `IAgent` - Updated methods reflect new classification system

### Updated Agent Flow

```typescript
class Agent {
  async process(request: AgentRequest): Promise<AgentResponse> {
    // 1. Classify input type
    const classification = await this.inputClassifier.classifyInput(request.input, request.context);
    
    switch (classification.type) {
      case 'command':
        return this.commandHandler.execute(request.input, classification.metadata);
        
      case 'prompt':
        return this.llmProvider.process(request.input, request.context);
        
      case 'workflow':
        // Future: Extract workflow specification
        const workflowSpec = await this.workflowExtractor.extractWorkflow(request.input, request.context);
        return this.workflowEngine.execute(workflowSpec.workflowSpec, request.context);
        
      default:
        throw new Error(`Unknown input type: ${classification.type}`);
    }
  }
}
```

---

## Benefits of This Architecture

### 1. **Solves Confidence Problems**
- **"Hi"** gets high confidence (0.9) as prompt instead of low scores from cognitive patterns
- **Commands** get perfect confidence (1.0) with simple regex matching
- **Clear workflows** get high confidence without complex pattern analysis

### 2. **Separates Concerns**
- **Simple classification** handles the solvable problem (command/prompt/workflow distinction)
- **Workflow extraction** isolates the hard AI research problem
- **Clean interfaces** allow independent development of each component

### 3. **Research Focus**
- Clearly identifies **text-to-workflow extraction** as the core research challenge
- Provides framework for workflow research without blocking basic functionality
- Enables iterative improvement of workflow extraction capabilities

### 4. **Practical Implementation**
- Command detection works immediately with simple regex
- Prompt classification handles conversational inputs properly
- Workflow detection identifies complex tasks without requiring full solution

---

## Implementation Priority

### Phase 1: Basic Classification (Immediate)
1. **CommandDetector**: Simple `/` prefix matching
2. **ComplexityAnalyzer**: Basic prompt vs workflow distinction
3. **ConfidenceCalculator**: Reliable scoring system
4. **InputClassifier**: Main coordination component

### Phase 2: Enhanced Classification (Short-term)
1. **Indicator refinement**: Better signal detection
2. **Context integration**: Use conversation history
3. **Domain adaptation**: Customize for specific domains
4. **Performance optimization**: Caching and speed improvements

### Phase 3: Workflow Research (Medium-term)
1. **Mode detection**: Research workflow type classification
2. **Node extraction**: Core AI research problem
3. **Template systems**: Rule-based workflow expansion
4. **Learning systems**: Improve from execution feedback

### Phase 4: Advanced Features (Long-term)
1. **Multi-language support**: Handle different input languages
2. **Domain specialization**: Custom classification for different domains
3. **Learning integration**: Improve classification from user feedback
4. **Advanced workflow**: Complex multi-step workflow generation

---

## Success Metrics

### Classification Accuracy
- **Commands**: 100% accuracy (trivial with regex)
- **Simple prompts**: >95% accuracy for greetings, questions, acknowledgments
- **Workflows**: >80% accuracy for clear task-oriented inputs
- **Ambiguous cases**: Consistent classification with reasonable confidence

### Performance Metrics
- **Classification time**: <10ms for command detection
- **Prompt classification**: <50ms for simple cases  
- **Workflow detection**: <200ms without node extraction
- **Memory usage**: Minimal overhead vs current pattern matching

### User Experience
- **No more low confidence** for simple inputs like "hi"
- **Clear command handling** for system functions
- **Appropriate workflow routing** for complex tasks
- **Graceful ambiguity handling** with confidence scores

---

**Next Steps**: This implementation guide provides the architecture for solving the classification problem. The workflow extraction research requires separate investigation of text-to-workflow conversion approaches.

**Key Research Question**: How do we reliably convert "fix the bug in auth.js" into a specific sequence of executable workflow nodes?