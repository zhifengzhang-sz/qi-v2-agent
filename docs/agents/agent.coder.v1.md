# Agent.Coder Implementation Guide

This document provides implementation guidance for building a coding assistant agent that implements the [5-container architecture](./agent.md) defined in the general agent model.

## Implementation Overview

The Agent.Coder implements the **Agent = Tool Box + WE + LLM** model with specific optimizations for coding workflows. Each container implements the interface contracts defined in [agent.md](./agent.md) with coding-specific configurations.

### LLM Model Configuration

The Workflow Executor Container supports configurable LLM models for different modes. The system is designed to work with various LLM providers and models:

**Mode-Specific LLM Configuration:**
- **Planning Mode**: Uses general reasoning models for structured analysis (e.g., `qwen3`, `llama3`, `mixtral`)
- **Coding Mode**: Uses code-specialized models for optimal code generation (e.g., `qwen3-coder`, `codellama`, `deepseek-coder`)
- **Information Mode**: Uses general models for explanations and documentation (e.g., `qwen3`, `llama3`)
- **Debugging Mode**: Uses reasoning models for systematic problem solving (e.g., `qwen3`, `llama3`)
- **Generic Mode**: Uses general conversation models (configurable based on preference)

**LLM Provider Support:**
- **Local Models**: Ollama server integration for local deployment
- **Cloud Models**: Extensible to support OpenAI, Anthropic, Google, etc.
- **Model Selection**: Configurable via `qi-config.yaml` per mode and use case

**Example Configuration:**
```yaml
workflow_executor:
  llm:
    providers:
      ollama:
        endpoint: "localhost:11434"
        models:
          planning: "qwen3"           # Example: could be llama3, mixtral, etc.
          coding: "qwen3-coder"       # Example: could be codellama, deepseek-coder, etc.
          information: "qwen3"        # Example: configurable based on needs
          debugging: "qwen3"          # Example: could be any reasoning model
          generic: "qwen3"            # Example: default conversation model
```

This design allows the system to work with any compatible LLM models while providing examples of effective model choices for each mode.

## Workflow Architecture for Coding

The Agent.Coder implements the [Abstract Workflow Architecture](./agent.md#abstract-workflow-architecture) defined in the general agent model, specialized for coding workflows.

### Coding-Specific Workflow Specializations

Each cognitive mode specializes the universal workflow pattern from [agent.md](./agent.md#abstract-workflow-architecture):

```mermaid
graph TB
    subgraph "Universal Workflow Pattern (from agent.md)"
        UWP[Input → Context → Tools → LLM → Synthesis → Output]
    end
    
    subgraph "Planning Mode for Coding"
        PM1[Code Analysis Input] --> PM2[Project Context]
        PM2 --> PM3[Sequential Thinking Tools]
        PM3 --> PM4[Planning LLM + LangGraph]
        PM4 --> PM5[Architecture Synthesis]
        PM5 --> PM6[Structured Report]
    end
    
    subgraph "Coding Mode Implementation"
        CM1[Implementation Request] --> CM2[File Context]
        CM2 --> CM3[File Edit Tools]
        CM3 --> CM4[Coding LLM]
        CM4 --> CM5[Code Integration]
        CM5 --> CM6[Generated Code]
    end
    
    subgraph "Information Mode for Code"
        IM1[Knowledge Query] --> IM2[Learning Context]
        IM2 --> IM3[Knowledge Retrieval Tools]
        IM3 --> IM4[General LLM]
        IM4 --> IM5[Educational Synthesis]
        IM5 --> IM6[Formatted Explanation]
    end
    
    subgraph "Debugging Mode"
        DM1[Error Description] --> DM2[Error Context]
        DM2 --> DM3[Diagnostic Tools]
        DM3 --> DM4[Analysis LLM]
        DM4 --> DM5[Solution Synthesis]
        DM5 --> DM6[Debug Solution]
    end
    
    UWP -.-> PM1
    UWP -.-> CM1
    UWP -.-> IM1
    UWP -.-> DM1
    
    style UWP fill:#ffee58,stroke:#fff176,stroke-width:3px,color:#000
    style PM4 fill:#ce93d8,stroke:#e1bee7,stroke-width:2px,color:#000
    style CM4 fill:#81c784,stroke:#a5d6a7,stroke-width:2px,color:#000
    style IM4 fill:#64b5f6,stroke:#90caf9,stroke-width:2px,color:#000
    style DM4 fill:#ffb74d,stroke:#ffcc02,stroke-width:2px,color:#000
```

### LangGraph Implementation for Coding

The coding agent implements the abstract workflow patterns using LangGraph with coding-specific optimizations:

```typescript
// Coding-specific implementation of abstract workflow
const createCodingWorkflowGraph = (mode: CognitiveMode) => {
  const workflow = new StateGraph(WorkflowState);
  
  // Implement the universal pattern: Input → Context → Tools → LLM → Synthesis → Output
  workflow.addNode("input", processCodingInput);
  workflow.addNode("context", enrichCodingContext);
  workflow.addNode("tools", executeCodingTools);
  workflow.addNode("llm", processCodingLLM);
  workflow.addNode("synthesis", synthesizeCodingResults);
  workflow.addNode("output", formatCodingOutput);
  
  // Apply coding-specific orchestration
  if (mode === 'planning') {
    // Use iterative pattern for complex planning
    return createIterativeCodingWorkflow(workflow);
  } else if (mode === 'coding') {
    // Use parallel tool pattern for file operations
    return createParallelCodingWorkflow(workflow);
  } else {
    // Use sequential pattern for simple modes
    return createSequentialCodingWorkflow(workflow);
  }
};
```

This coding implementation follows the universal patterns defined in [agent.md](./agent.md#abstract-workflow-architecture) while optimizing for coding-specific requirements.

### LLM Integration Architecture

The LLM integration is indeed a **prompt module system** that integrates with LangChain/LangGraph for structured prompting and response handling.

**Important Clarification:**
- **LangGraph**: Provides workflow orchestration and state management
- **LangChain**: Provides the prompt abstraction layer, LLM integrations, and structured output parsing
- **Integration**: LangGraph orchestrates workflows that use LangChain prompt modules

#### LLM Package Stack

```typescript
// Package dependencies for LLM integration
import { ChatOllama } from '@langchain/community/chat_models/ollama';
import { PromptTemplate, ChatPromptTemplate } from '@langchain/core/prompts';
import { LLMChain } from 'langchain/chains';
import { StructuredOutputParser } from 'langchain/output_parsers';
import { BaseMessage, HumanMessage, SystemMessage } from '@langchain/core/messages';
```

**Core LLM Packages:**
- **`@langchain/core`**: Core LangChain functionality for **prompt abstractions**, messages, and schemas
- **`@langchain/community`**: Community LLM providers (Ollama, OpenAI, etc.)
- **`langchain/chains`**: Chain composition for complex LLM workflows  
- **`langchain/output_parsers`**: Structured output parsing and validation

#### Prompt Abstraction Layer (LangChain)

LangChain provides the prompt abstraction contracts that ensure consistency across all modes:

```typescript
// Abstract prompt contract that all modes implement
interface PromptContract {
  // Standard prompt structure
  systemPrompt: PromptTemplate;
  userPromptTemplate: PromptTemplate;
  outputSchema: StructuredOutputParser;
  
  // Required methods
  formatContext(toolResults: ToolResult[]): string;
  validateInput(input: any): boolean;
  parseOutput(response: string): ParsedResponse;
}

// Base prompt template following the contract
abstract class BasePromptModule implements PromptContract {
  protected abstract getSystemPromptTemplate(): string;
  protected abstract getOutputSchema(): Record<string, string>;
  
  constructor() {
    this.systemPrompt = PromptTemplate.fromTemplate(this.getSystemPromptTemplate());
    this.outputSchema = StructuredOutputParser.fromNamesAndDescriptions(this.getOutputSchema());
  }
  
  // Standard context formatting that all modes use
  formatContext(toolResults: ToolResult[]): string {
    return toolResults.map(result => 
      `Tool: ${result.toolName}\nStatus: ${result.status}\nData: ${JSON.stringify(result.data, null, 2)}`
    ).join('\n\n');
  }
}
```

#### LLM Node Implementation Pattern

The LLM processing in workflows is implemented as prompt modules:

```typescript
interface LLMPromptModule {
  // Core prompt components
  systemPrompt: PromptTemplate;
  userPromptTemplate: PromptTemplate;
  outputParser: StructuredOutputParser;
  
  // LLM configuration
  modelConfig: LLMModelConfig;
  
  // Execution methods
  execute(context: LLMContext): Promise<ParsedLLMResponse>;
  formatPrompt(toolResults: ToolResult[], userInput: string): Promise<string>;
  parseResponse(rawResponse: string): ParsedLLMResponse;
}

class CodingLLMPromptModule implements LLMPromptModule {
  private llm: ChatOllama;
  private chain: LLMChain;
  
  constructor(modelConfig: LLMModelConfig) {
    // Initialize Ollama LLM
    this.llm = new ChatOllama({
      baseUrl: modelConfig.endpoint,
      model: modelConfig.model, // e.g., "qwen3-coder"
      temperature: modelConfig.temperature
    });
    
    // Create structured prompt template
    this.systemPrompt = PromptTemplate.fromTemplate(`
You are a coding assistant in CODING MODE.

Context from Tool Container:
{toolResults}

User Requirements:
{userInput}

Instructions:
- Generate production-ready code based on tool analysis
- Include error handling and proper typing
- Follow coding best practices
- Provide complete, working implementations

Output format:
- Code: [Generated code]
- Explanation: [Brief explanation]
- Tests: [Test cases if applicable]
    `);
    
    // Create LLM chain
    this.chain = new LLMChain({
      llm: this.llm,
      prompt: this.systemPrompt,
      outputParser: new StructuredOutputParser.fromNamesAndDescriptions({
        code: "Generated code implementation",
        explanation: "Brief explanation of the solution",
        tests: "Test cases or validation code"
      })
    });
  }
  
  async execute(context: LLMContext): Promise<ParsedLLMResponse> {
    const formattedToolResults = this.formatToolResults(context.toolResults);
    
    const response = await this.chain.call({
      toolResults: formattedToolResults,
      userInput: context.userInput
    });
    
    return {
      code: response.code,
      explanation: response.explanation,
      tests: response.tests,
      metadata: {
        model: this.llm.model,
        tokenCount: response.tokenCount,
        processingTime: response.processingTime
      }
    };
  }
}
```

#### Mode-Specific Prompt Modules

Each cognitive mode has its own prompt module optimized for that specific task:

```mermaid
graph TB
    subgraph "LLM Prompt Module Architecture"
        A[LLM Context Input] --> B[Prompt Template Engine]
        B --> C[LangChain LLM Provider]
        C --> D[Structured Output Parser]
        D --> E[Parsed LLM Response]
    end
    
    subgraph "Planning Mode Prompt Module"
        PM1[Planning System Prompt] --> PM2[Tool Results Formatter]
        PM2 --> PM3[LangChain Chain] 
        PM3 --> PM4[Architecture Analysis Parser]
    end
    
    subgraph "Coding Mode Prompt Module"
        CM1[Coding System Prompt] --> CM2[Code Context Formatter]
        CM2 --> CM3[LangChain Chain]
        CM3 --> CM4[Code Output Parser]
    end
    
    subgraph "Information Mode Prompt Module"
        IM1[Educational System Prompt] --> IM2[Knowledge Formatter]
        IM2 --> IM3[LangChain Chain]
        IM3 --> IM4[Explanation Parser]
    end
    
    subgraph "Debugging Mode Prompt Module"
        DM1[Debugging System Prompt] --> DM2[Error Context Formatter]
        DM2 --> DM3[LangChain Chain]
        DM3 --> DM4[Solution Parser]
    end
    
    B --> PM1
    B --> CM1
    B --> IM1
    B --> DM1
    
    style A fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style B fill:#ffee58,stroke:#fff176,stroke-width:3px,color:#000
    style C fill:#ffb74d,stroke:#ffcc02,stroke-width:2px,color:#000
    style D fill:#f48fb1,stroke:#f8bbd9,stroke-width:2px,color:#000
    style E fill:#64b5f6,stroke:#90caf9,stroke-width:2px,color:#000
```

#### LangGraph Integration with LLM Prompt Modules

LangGraph nodes integrate with LLM prompt modules:

```typescript
// LangGraph node that uses LLM prompt module
const createLLMNode = (promptModule: LLMPromptModule) => {
  return async (state: WorkflowState): Promise<WorkflowState> => {
    try {
      // Prepare LLM context from workflow state
      const llmContext: LLMContext = {
        toolResults: state.toolResults,
        userInput: state.userInput,
        sessionContext: state.context,
        mode: state.mode
      };
      
      // Execute LLM prompt module
      const llmResponse = await promptModule.execute(llmContext);
      
      // Update workflow state
      return {
        ...state,
        llmResponse,
        metadata: {
          ...state.metadata,
          llmProcessingTime: llmResponse.metadata.processingTime,
          llmTokenCount: llmResponse.metadata.tokenCount
        }
      };
    } catch (error) {
      return {
        ...state,
        error: `LLM processing failed: ${error.message}`
      };
    }
  };
};

// Usage in LangGraph workflow
const workflow = new StateGraph(WorkflowState);
workflow.addNode("llm_processing", createLLMNode(codingPromptModule));
```

#### Prompt Template System (LangChain Abstraction Contracts)

The system uses LangChain's prompt abstraction layer to ensure all modes follow consistent contracts:

```typescript
// Abstract prompt contract implemented by all modes
interface PromptContractImplementation {
  mode: CognitiveMode;
  promptModule: BasePromptModule;
  outputSchema: StructuredOutputParser;
  validationRules: ValidationRule[];
}

// Prompt abstraction registry following LangChain patterns
class PromptAbstractionRegistry {
  private implementations: Map<CognitiveMode, PromptContractImplementation> = new Map();
  
  register(mode: CognitiveMode, implementation: BasePromptModule): void {
    this.implementations.set(mode, {
      mode,
      promptModule: implementation,
      outputSchema: implementation.outputSchema,
      validationRules: implementation.getValidationRules()
    });
  }
  
  getPromptModule(mode: CognitiveMode): BasePromptModule {
    const impl = this.implementations.get(mode);
    if (!impl) {
      throw new Error(`No prompt implementation found for mode: ${mode}`);
    }
    return impl.promptModule;
  }
  
  validatePromptContract(mode: CognitiveMode): boolean {
    const impl = this.implementations.get(mode);
    return impl ? impl.promptModule.validateContract() : false;
  }
}

// Mode-specific implementations following the abstract contract
const PROMPT_IMPLEMENTATIONS = {
  planning: new PlanningLLMPromptModule(),
  coding: new CodingLLMPromptModule(),
  information: new InformationLLMPromptModule(),
  debugging: new DebuggingLLMPromptModule()
};

// All implementations share common abstractions from LangChain
const SHARED_PROMPT_FEATURES = {
  // Common template variables that all modes support
  templateVariables: ['toolResults', 'userInput', 'format_instructions'],
  
  // Common output structure that all modes provide  
  baseOutputSchema: {
    reasoning: "Step-by-step reasoning process",
    confidence: "Confidence score for the response",
    metadata: "Additional context and metadata"
  },
  
  // Common validation rules from LangChain
  validationRules: [
    'required_fields_present',
    'output_schema_compliance', 
    'token_limit_respected',
    'safety_guidelines_followed'
  ]
};
```

#### LLM Provider Configuration

The system supports multiple LLM providers through LangChain:

```typescript
interface LLMProviderConfig {
  type: 'ollama' | 'openai' | 'anthropic' | 'google';
  endpoint?: string;
  apiKey?: string;
  models: Record<CognitiveMode, string>;
  defaultParams: LLMParameters;
}

class LLMProviderFactory {
  static createProvider(config: LLMProviderConfig): BaseLLM {
    switch (config.type) {
      case 'ollama':
        return new ChatOllama({
          baseUrl: config.endpoint,
          model: config.models.coding, // Model selection handled elsewhere
          temperature: config.defaultParams.temperature
        });
      
      case 'openai':
        return new ChatOpenAI({
          openAIApiKey: config.apiKey,
          modelName: config.models.coding,
          temperature: config.defaultParams.temperature
        });
      
      // Add other providers as needed
      default:
        throw new Error(`Unsupported LLM provider: ${config.type}`);
    }
  }
}
```

#### Architecture Summary: LangChain + LangGraph Integration

This LLM integration architecture provides clear separation of concerns:

**LangChain Responsibilities (Prompt Abstraction Layer):**
- **Prompt Templates**: `PromptTemplate.fromTemplate()` for consistent prompt structure
- **Output Parsing**: `StructuredOutputParser` for type-safe response handling  
- **LLM Providers**: `ChatOllama`, `ChatOpenAI`, etc. for model abstraction
- **Chain Composition**: `LLMChain` for combining prompts + models + parsers
- **Prompt Contracts**: Abstract base classes ensuring all modes follow same patterns

**LangGraph Responsibilities (Workflow Orchestration):**
- **Workflow Definition**: `StateGraph` for defining node and edge relationships
- **State Management**: `WorkflowState` for managing data flow between nodes
- **Execution Engine**: Orchestrating the sequence of tool execution and LLM processing
- **Conditional Logic**: Supporting complex workflows with branching and loops

**Integration Pattern:**
```typescript
// LangGraph orchestrates workflows that use LangChain prompt modules
const llmNode = async (state: WorkflowState) => {
  // LangChain handles the prompting and LLM interaction
  const promptModule = registry.getPromptModule(state.mode);
  const llmResponse = await promptModule.execute({
    toolResults: state.toolResults,
    userInput: state.userInput
  });
  
  // LangGraph manages the state transition
  return { ...state, llmResponse };
};
```

This architecture provides:
- **Abstract Contracts**: LangChain prompt abstractions ensure consistency across modes
- **Workflow Orchestration**: LangGraph manages complex multi-step processes
- **Type Safety**: Structured output parsing with validation
- **Provider Flexibility**: Support for multiple LLM providers through LangChain
- **Mode Optimization**: Specialized prompt modules per cognitive mode
- **Scalable Integration**: Clear separation allows independent scaling of prompting vs orchestration

## Container Implementation Strategy

```mermaid
graph TB
    subgraph "Input Container"
        A[User Input] --> B[Command Parser]
        B --> C{Command Type}
        
        C -->|Pure Command| STATIC[Static Handler]
        C -->|Interactive| PATTERN[Pattern Recognition Container]
        C -->|Workflow| PATTERN
    end

    subgraph "Pattern Recognition Container"
        PATTERN --> D[Text Analysis]
        D --> E{Mode Detection}
        
        E -->|review request| F[Planning Mode]
        E -->|code request| G[Coding Mode]
        E -->|explain request| H[Information Mode]
        E -->|debug request| I[Debugging Mode]
        E -->|general chat| J[Generic Mode]
    end

    subgraph "Smart Router Container"
        F --> F1[Planning Workflow Spec]
        G --> G1[Coding Workflow Spec]
        H --> H1[Information Workflow Spec]
        I --> I1[Debugging Workflow Spec]
        J --> J1[Generic Workflow Spec]
    end

    subgraph "Tool Container (Tool Box)"
        F1 --> T1[MCP Sequential Thinking Tools]
        G1 --> T2[Code Editing & Analysis Tools]
        H1 --> T3[Knowledge Retrieval Tools]
        I1 --> T4[Debugging & Error Analysis Tools]
        J1 --> T5[Basic Conversation Tools]
    end

    subgraph "Workflow Executor Container (WE + LLM)"
        T1 --> F2[LangGraph Orchestration + Planning LLM]
        T2 --> G2[Coding LLM + Tool Results Integration]
        T3 --> H2[General LLM Knowledge Processing + Tool Data]
        T4 --> I2[Step-by-step Analysis + Tool Results]
        T5 --> J2[Generic LLM Conversation]
    end

    style A fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style B fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style C fill:#29b6f6,stroke:#4fc3f7,stroke-width:3px,color:#000
    
    style D fill:#ce93d8,stroke:#e1bee7,stroke-width:2px,color:#000
    style E fill:#81c784,stroke:#a5d6a7,stroke-width:2px,color:#000
    style F fill:#64b5f6,stroke:#90caf9,stroke-width:2px,color:#000
    style G fill:#ffb74d,stroke:#ffcc02,stroke-width:2px,color:#000
    style H fill:#f48fb1,stroke:#f8bbd9,stroke-width:2px,color:#000
    
    style D1 fill:#ba68c8,stroke:#ce93d8,stroke-width:2px,color:#000
    style D2 fill:#ab47bc,stroke:#ba68c8,stroke-width:2px,color:#000
    style E1 fill:#66bb6a,stroke:#81c784,stroke-width:2px,color:#000
    style E2 fill:#4caf50,stroke:#66bb6a,stroke-width:2px,color:#000
    style F1 fill:#42a5f5,stroke:#64b5f6,stroke-width:2px,color:#000
    style F2 fill:#2196f3,stroke:#42a5f5,stroke-width:2px,color:#000
    style G1 fill:#ffa726,stroke:#ffb74d,stroke-width:2px,color:#000
    style G2 fill:#ff9800,stroke:#ffa726,stroke-width:2px,color:#000
    style H1 fill:#ec407a,stroke:#f48fb1,stroke-width:2px,color:#000
    style H2 fill:#e91e63,stroke:#ec407a,stroke-width:2px,color:#000
```

### Pattern Recognition Implementation

For coding workflows, the Pattern Recognition Container uses LangChain-based intent classification with coding-specific patterns:

```mermaid
flowchart TD
    A[User Text Input + Current Mode Context] --> B[Input Validator]
    B --> C[Text Normalizer] 
    C --> D[Intent Classifier]
    D --> E[Mode Detector]
    
    E --> F{Action Patterns + Context}
    F -->|review, analyze| G[Planning Mode]
    F -->|code, implement| H[Coding Mode]
    F -->|explain, help| I[Information Mode]
    F -->|fix, debug| J[Debugging Mode]
    F -->|general chat| K[Generic Mode]
    
    G --> L[Planning Context]
    H --> M[Coding Context]
    I --> N[Information Context]
    J --> O[Debugging Context]
    K --> P[Generic Context]
    
    L --> Q[Smart Router Container]
    M --> Q
    N --> Q
    O --> Q
    P --> Q

    style A fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style B fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style C fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style D fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style E fill:#29b6f6,stroke:#4fc3f7,stroke-width:3px,color:#000
    
    style F fill:#ce93d8,stroke:#e1bee7,stroke-width:2px,color:#000
    style G fill:#81c784,stroke:#a5d6a7,stroke-width:2px,color:#000
    style H fill:#64b5f6,stroke:#90caf9,stroke-width:2px,color:#000
    style I fill:#ffb74d,stroke:#ffcc02,stroke-width:2px,color:#000
    
    style J fill:#ba68c8,stroke:#ce93d8,stroke-width:2px,color:#000
    style K fill:#66bb6a,stroke:#81c784,stroke-width:2px,color:#000
    style L fill:#42a5f5,stroke:#64b5f6,stroke-width:2px,color:#000
    style M fill:#ffa726,stroke:#ffb74d,stroke-width:2px,color:#000
    
    style N fill:#ab47bc,stroke:#ba68c8,stroke-width:2px,color:#000
    style O fill:#4caf50,stroke:#66bb6a,stroke-width:2px,color:#000
    style P fill:#2196f3,stroke:#42a5f5,stroke-width:2px,color:#000
    style Q fill:#ff9800,stroke:#ffa726,stroke-width:2px,color:#000
```

### Container Integration Flow

The state flow shows how containers coordinate for coding workflows, implementing the contracts from [agent.md](./agent.md):

```mermaid
stateDiagram-v2
    [*] --> InputContainer
    InputContainer --> PatternRecognitionContainer
    PatternRecognitionContainer --> SmartRouterContainer
    SmartRouterContainer --> ToolContainer
    SmartRouterContainer --> WorkflowExecutorContainer
    
    state ToolContainer {
        [*] --> ToolSelection
        
        ToolSelection --> PlanningTools
        ToolSelection --> CodingTools
        ToolSelection --> InformationTools
        ToolSelection --> DebuggingTools
        ToolSelection --> GenericTools
        
        PlanningTools --> [*]
        CodingTools --> [*]
        InformationTools --> [*]
        DebuggingTools --> [*]
        GenericTools --> [*]
    }
    
    ToolContainer --> WorkflowExecutorContainer
    
    state WorkflowExecutorContainer {
        [*] --> WorkflowOrchestration
        
        WorkflowOrchestration --> PlanningWorkflow
        WorkflowOrchestration --> CodingWorkflow
        WorkflowOrchestration --> InformationWorkflow
        WorkflowOrchestration --> DebuggingWorkflow
        WorkflowOrchestration --> GenericWorkflow
        
        state PlanningWorkflow {
            [*] --> ReceiveToolResults
            ReceiveToolResults --> LangGraphOrchestration
            LangGraphOrchestration --> PlanningLLMAnalysis
            PlanningLLMAnalysis --> DetailedReport
            DetailedReport --> [*]
        }
        
        state CodingWorkflow {
            [*] --> ReceiveToolResults
            ReceiveToolResults --> CodingLLMProcessing
            CodingLLMProcessing --> CodeGeneration
            CodeGeneration --> [*]
        }
        
        state InformationWorkflow {
            [*] --> ReceiveToolResults
            ReceiveToolResults --> GeneralLLMExplanation
            GeneralLLMExplanation --> FormattedResponse
            FormattedResponse --> [*]
        }
        
        state DebuggingWorkflow {
            [*] --> ReceiveToolResults
            ReceiveToolResults --> ProblemDiagnosis
            ProblemDiagnosis --> SolutionGeneration
            SolutionGeneration --> [*]
        }
        
        state GenericWorkflow {
            [*] --> ReceiveToolResults
            ReceiveToolResults --> GenericLLM
            GenericLLM --> ConversationResponse
            ConversationResponse --> [*]
        }
        
        PlanningWorkflow --> [*]
        CodingWorkflow --> [*]
        InformationWorkflow --> [*]
        DebuggingWorkflow --> [*]
        GenericWorkflow --> [*]
    }
    
    WorkflowExecutorContainer --> [*]
```

### Tool Container Configuration

The Tool Container implements the Tool Box with coding-specific tool configurations:

**MCP Server Mappings:**
- **Planning Mode**: `sequential-thinking` MCP server for structured analysis
- **Coding Mode**: `filesystem` MCP server for file operations
- **Information Mode**: `knowledge-base` MCP server for documentation lookup
- **Debugging Mode**: `error-analysis` MCP server for diagnostic tools

**Tool Chain Configuration:**

```mermaid
graph LR
    subgraph "Smart Router Container"
        SR1[Mode Validator]
        SR2[Workflow Mapper]
        SR3[Workflow Spec Builder]
        SR4[Parameter Request Builder]
        SR1 --> SR2
        SR2 --> SR3
        SR3 --> SR4
    end

    subgraph "Tool Container (Tool Box)"
        TC1[Tool Orchestrator]
        TC2[MCP Integration]
        TC3[Builtin Tools]
        TC4[External Tools]
        TC1 --> TC2
        TC1 --> TC3
        TC1 --> TC4
    end

    subgraph "Planning Tool Stack"
        PM1[Sequential Thinking MCP]
        PM2[Thought Processing]
        PM3[Analysis Tools]
        PM1 --> PM2
        PM2 --> PM3
    end

    subgraph "Coding Tool Stack"
        CM1[File Edit Tools]
        CM2[Code Analysis]
        CM3[Syntax Validation]
        CM1 --> CM2
        CM2 --> CM3
    end

    subgraph "Workflow Executor Container (WE + LLM)"
        WE1[LangGraph Orchestration]
        WE2[Configurable LLM Integration]
        WE3[Response Formatting]
        WE1 --> WE2
        WE2 --> WE3
    end

    SR4 --> TC1
    TC2 --> PM1
    TC3 --> CM1
    PM3 --> WE1
    CM3 --> WE1

    style MD fill:#29b6f6,stroke:#4fc3f7,stroke-width:3px,color:#000
    
    style PM1 fill:#ce93d8,stroke:#e1bee7,stroke-width:2px,color:#000
    style PM2 fill:#ba68c8,stroke:#ce93d8,stroke-width:2px,color:#000
    style PM3 fill:#ab47bc,stroke:#ba68c8,stroke-width:2px,color:#000
    style PM4 fill:#9c27b0,stroke:#ab47bc,stroke-width:2px,color:#000
    
    style CM1 fill:#81c784,stroke:#a5d6a7,stroke-width:2px,color:#000
    style CM2 fill:#66bb6a,stroke:#81c784,stroke-width:2px,color:#000
    style CM3 fill:#4caf50,stroke:#66bb6a,stroke-width:2px,color:#000
    style CM4 fill:#388e3c,stroke:#4caf50,stroke-width:2px,color:#000
    
    style IM1 fill:#64b5f6,stroke:#90caf9,stroke-width:2px,color:#000
    style IM2 fill:#42a5f5,stroke:#64b5f6,stroke-width:2px,color:#000
    style IM3 fill:#2196f3,stroke:#42a5f5,stroke-width:2px,color:#000
    style IM4 fill:#1976d2,stroke:#2196f3,stroke-width:2px,color:#000
```

### Complete Container Integration

This diagram shows how the 5 containers integrate specifically for coding workflows:

```mermaid
graph TB
    subgraph "Input Container"
        A[User Input Text]
        A --> B[Command Parser]
        B --> C{Command Classification}
    end
    
    subgraph "Pattern Recognition Container"
        C --> D[Text Normalizer]
        D --> E[LangChain Intent Classifier]
        E --> F[Mode Detector]
        F --> G{Mode Selection}
    end
    
    subgraph "Smart Router Container"
        G --> H[Mode Validator]
        H --> I[Workflow Mapper]
        I --> J[Workflow Spec Builder]
        J --> K[Parameter Request Builder]
    end
    
    subgraph "Tool Container (Tool Box)"
        K --> TC{Tool Execution}
        
        TC --> M[Planning Tools]
        TC --> N[Coding Tools]
        TC --> O[Information Tools]
        TC --> P[Debugging Tools]
        TC --> Q[Generic Tools]
        
        M --> M1[MCP Sequential Thinking]
        M1 --> M1R[Tool Results]
        
        N --> N1[File Edit & Analysis]
        N1 --> N1R[Tool Results]
        
        O --> O1[Knowledge Retrieval]
        O1 --> O1R[Tool Results]
        
        P --> P1[Error Analysis]
        P1 --> P1R[Tool Results]
        
        Q --> Q1[Basic Operations]
        Q1 --> Q1R[Tool Results]
    end
    
    subgraph "Workflow Executor Container (WE + LLM)"
        M1R --> WM[Planning Workflow + LangGraph + Planning LLM]
        N1R --> WN[Coding Workflow + Coding LLM]
        O1R --> WO[Information Workflow + General LLM]
        P1R --> WP[Debugging Workflow + Analysis LLM]
        Q1R --> WQ[Generic Workflow + LLM]
        
        WM --> WM1[LangGraph Orchestration]
        WM1 --> WM2[Planning LLM Analysis]
        
        WN --> WN1[Coding LLM Integration]
        
        WO --> WO1[General LLM Knowledge Processing]
        
        WP --> WP1[Sequential Problem Resolution]
        
        WQ --> WQ1[Generic LLM Response]
    end
    
    subgraph "Output Layer"
        WM2 --> R[Structured Report]
        WN1 --> S[Generated Code]
        WO1 --> T[Formatted Explanation]
        WP1 --> U[Debug Solution]
        WQ1 --> V[Chat Response]
    end
    
    style A fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style B fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style C fill:#ffee58,stroke:#fff176,stroke-width:3px,color:#000
    style D fill:#29b6f6,stroke:#4fc3f7,stroke-width:3px,color:#000
    
    style E fill:#ce93d8,stroke:#e1bee7,stroke-width:2px,color:#000
    style F fill:#81c784,stroke:#a5d6a7,stroke-width:2px,color:#000
    style G fill:#64b5f6,stroke:#90caf9,stroke-width:2px,color:#000
    
    style E1 fill:#ba68c8,stroke:#ce93d8,stroke-width:2px,color:#000
    style E2 fill:#ab47bc,stroke:#ba68c8,stroke-width:2px,color:#000
    style E3 fill:#9c27b0,stroke:#ab47bc,stroke-width:2px,color:#000
    
    style F1 fill:#66bb6a,stroke:#81c784,stroke-width:2px,color:#000
    style F2 fill:#4caf50,stroke:#66bb6a,stroke-width:2px,color:#000
    
    style G1 fill:#42a5f5,stroke:#64b5f6,stroke-width:2px,color:#000
    style G2 fill:#2196f3,stroke:#42a5f5,stroke-width:2px,color:#000
    
    style H fill:#9c27b0,stroke:#ab47bc,stroke-width:2px,color:#fff
    style I fill:#388e3c,stroke:#4caf50,stroke-width:2px,color:#fff
    style J fill:#1976d2,stroke:#2196f3,stroke-width:2px,color:#fff
```

### Planning Mode Implementation Detail

The planning mode uses the Sequential Thinking MCP server for structured code planning:

```mermaid
stateDiagram-v2
    [*] --> ProblemDefinition
    
    state ProblemDefinition {
        [*] --> DefineScope
        DefineScope --> IdentifyStakeholders
        IdentifyStakeholders --> SetObjectives
        SetObjectives --> [*]
    }
    
    ProblemDefinition --> Research
    
    state Research {
        [*] --> GatherContext
        GatherContext --> IdentifyMethods
        IdentifyMethods --> CollectData
        CollectData --> [*]
    }
    
    Research --> Analysis
    
    state Analysis {
        [*] --> BreakdownComponents
        BreakdownComponents --> EvaluateOptions
        EvaluateOptions --> AssessRisks
        AssessRisks --> [*]
    }
    
    Analysis --> Synthesis
    
    state Synthesis {
        [*] --> CombineFindings
        CombineFindings --> GenerateInsights
        GenerateInsights --> CreateRecommendations
        CreateRecommendations --> [*]
    }
    
    Synthesis --> [*]
```

### Data Flow Implementation

Data flows between containers following the interface contracts with coding-specific data types:

```mermaid
flowchart TD
    subgraph "Input Processing"
        A[User Text] --> B[LangChain Parser]
        B --> C[Structured Intent]
    end
    
    subgraph "Tool Container Data"
        C --> D[MCP Tool Execution]
        D --> E[Tool Results]
        E --> F[Aggregated Tool Data]
    end
    
    subgraph "Workflow Execution Data"
        F --> G[LangGraph State]
        G --> H[Workflow Context]
        H --> I[Processing Results]
        I --> J[Synthesis Data]
    end
    
    subgraph "LLM Processing"
        H --> K[LLM Context Preparation]
        K --> L[Generated Insights]
        L --> M[Structured Output]
    end
    
    subgraph "Output Assembly"
        J --> N[Report Template]
        M --> N
        F --> N
        N --> O[Final Report]
    end

    style A fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style B fill:#4fc3f7,stroke:#81d4fa,stroke-width:2px,color:#000
    style C fill:#64b5f6,stroke:#90caf9,stroke-width:2px,color:#000
    
    style D fill:#ce93d8,stroke:#e1bee7,stroke-width:2px,color:#000
    style E fill:#ba68c8,stroke:#ce93d8,stroke-width:2px,color:#000
    style F fill:#ab47bc,stroke:#ba68c8,stroke-width:2px,color:#000
    
    style G fill:#81c784,stroke:#a5d6a7,stroke-width:2px,color:#000
    style H fill:#66bb6a,stroke:#81c784,stroke-width:2px,color:#000
    style I fill:#4caf50,stroke:#66bb6a,stroke-width:2px,color:#000
    style J fill:#388e3c,stroke:#4caf50,stroke-width:2px,color:#000
    
    style K fill:#ffb74d,stroke:#ffcc02,stroke-width:2px,color:#000
    style L fill:#ffa726,stroke:#ffb74d,stroke-width:2px,color:#000
    style M fill:#ff9800,stroke:#ffa726,stroke-width:2px,color:#000
    
    style N fill:#f48fb1,stroke:#f8bbd9,stroke-width:2px,color:#000
    style O fill:#81c784,stroke:#a5d6a7,stroke-width:2px,color:#fff
```

---

## Implementation Insights

### 🏗️ **Container Implementation Patterns**
Each container implements the [interface contracts](./agent.md) with coding-specific optimizations:

- **Input Container**: Implemented using CLI abstraction (Ink/neo-blessed)
- **Pattern Recognition Container**: LangChain intent classification with coding patterns
- **Smart Router Container**: Workflow mapping optimized for code generation workflows
- **Tool Container**: MCP server integration with coding tools (**Tool Box**)
- **Workflow Executor Container**: LangGraph + LLM integration (**WE + LLM**)

### 🧠 **Context-Aware Mode Detection Implementation**
The Pattern Recognition Container implementation for coding workflows:
- Uses coding-specific pattern matching for intent classification
- Maintains conversation context for mode transitions (planning → coding → debugging)
- Implements fallback to generic mode for non-coding conversations

### 🎯 **Mode-Specific Tool and Workflow Optimization**
Each mode uses optimal tool stacks across Tool Container and Workflow Executor Container:

| Mode | Tool Container (Tool Box) | Workflow Executor (WE + LLM) | Purpose |
| 🧠 Planning | MCP Sequential Thinking tools | LangGraph + Planning LLM | Deep reasoning & analysis |
| ⚡ Coding | File edit & code analysis tools | Coding LLM + tool integration | Fast code generation |
| 📚 Information | Knowledge retrieval tools | General LLM + context processing | Clear explanations |
| 🔧 Debugging | Error analysis & diagnostic tools | Sequential analysis + LLM | Systematic problem solving |
| 💬 Generic | Basic operation tools | Simple LLM conversation | General conversation |

### 🔄 **Implementation Design Principles**
Following the [interface contracts](./agent.md), each container implements pure functional patterns:
- **Smart Router**: Implements mode-to-workflow transformation for coding workflows
- **Pattern Recognition**: Implements coding-specific context analysis with LangChain
- **Tool Container**: Implements coding tool execution via MCP server integration
- **Workflow Executor**: Implements LangGraph orchestration with coding-optimized LLM prompts
- **State Management**: Session state managed through container boundaries

### 📈 **Implementation Benefits**
- **Container Independence**: Each container can be implemented and scaled independently
- **Technology Flexibility**: Can switch CLI frameworks (Ink → neo-blessed) without changing contracts
- **Tool Modularity**: MCP servers can be added/removed without affecting workflow logic

## Implementation Guides

For detailed implementation guidance, see:

- **[Container Implementation Guides](./coder/containers/)** - Detailed guides for implementing each container
- **[Component Implementation Guides](./coder/components/)** - Component-level implementation details  
- **[Architecture Implementation](./coder/architecture/)** - Architecture-specific implementation patterns

This implementation guide shows how to build an intelligent coding assistant that follows the [general agent model](./agent.md) with coding-specific optimizations for **Tool Box + WE + LLM** architecture.