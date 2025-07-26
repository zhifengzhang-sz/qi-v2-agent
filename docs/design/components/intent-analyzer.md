# Intent Analyzer Component Interface

## Overview

The Intent Analyzer Component is responsible for analyzing user messages to determine their intent and route them to appropriate handling strategies. It serves as the core intelligence component within the Smart Router Container.

## Component Responsibilities

- **Intent Classification**: Determine the primary intent of user messages
- **Confidence Assessment**: Provide confidence scores for routing decisions
- **Tool Selection**: Identify which tools are needed to fulfill the intent
- **Context Analysis**: Consider conversation history and context in decisions
- **Fallback Strategy**: Handle ambiguous or unclear intents

## Public Interface

### IIntentAnalyzer

```typescript
interface IIntentAnalyzer {
  /**
   * Analyze user intent from messages
   * @param request Intent analysis request
   * @returns Intent analysis result
   */
  analyzeIntent(request: IntentAnalysisRequest): Promise<IntentAnalysisResult>;
  
  /**
   * Update routing rules dynamically
   * @param rules New or updated routing rules
   */
  updateRoutingRules(rules: RoutingRule[]): Promise<void>;
  
  /**
   * Get current routing rules
   * @returns Active routing rules
   */
  getRoutingRules(): RoutingRule[];
  
  /**
   * Set confidence threshold for routing decisions
   * @param threshold Confidence threshold (0.0-1.0)
   */
  setConfidenceThreshold(threshold: number): void;
  
  /**
   * Get supported intent types
   * @returns List of supported intent types
   */
  getSupportedIntents(): IntentType[];
}
```

## Data Contracts

### Intent Analysis Request

```typescript
interface IntentAnalysisRequest {
  /**
   * Current message to analyze
   */
  message: string;
  
  /**
   * Conversation context
   */
  context: AnalysisContext;
  
  /**
   * Analysis options
   */
  options?: AnalysisOptions;
}

interface AnalysisContext {
  /**
   * Previous messages in conversation
   */
  conversationHistory: Message[];
  
  /**
   * Available tools for this session
   */
  availableTools: string[];
  
  /**
   * Current working directory
   */
  workingDirectory?: string;
  
  /**
   * User preferences
   */
  userPreferences?: UserPreferences;
  
  /**
   * Session metadata
   */
  sessionMetadata?: Record<string, any>;
}

interface AnalysisOptions {
  /**
   * Force specific intent type
   */
  forceIntent?: IntentType;
  
  /**
   * Include reasoning in response
   */
  includeReasoning?: boolean;
  
  /**
   * Maximum analysis time
   */
  maxAnalysisTime?: number;
}
```

### Intent Analysis Result

```typescript
interface IntentAnalysisResult {
  /**
   * Detected intent type
   */
  intent: IntentType;
  
  /**
   * Confidence score (0.0-1.0)
   */
  confidence: number;
  
  /**
   * Human-readable reasoning
   */
  reasoning: string;
  
  /**
   * Recommended routing strategy
   */
  routingStrategy: RoutingStrategy;
  
  /**
   * Tools required for this intent
   */
  requiredTools: string[];
  
  /**
   * Extracted parameters
   */
  parameters: Record<string, any>;
  
  /**
   * Alternative intents considered
   */
  alternatives: AlternativeIntent[];
  
  /**
   * Fallback options if confidence is low
   */
  fallbackOptions: FallbackOption[];
}

enum IntentType {
  // Conversational intents
  GREETING = 'greeting',
  QUESTION = 'question',
  CONVERSATION = 'conversation',
  
  // Code-related intents
  CODE_GENERATION = 'code_generation',
  CODE_EXPLANATION = 'code_explanation',
  CODE_REVIEW = 'code_review',
  
  // File operation intents
  FILE_CREATE = 'file_create',
  FILE_EDIT = 'file_edit',
  FILE_READ = 'file_read',
  FILE_DELETE = 'file_delete',
  
  // Analysis intents
  PROJECT_ANALYSIS = 'project_analysis',
  COMPLEXITY_ANALYSIS = 'complexity_analysis',
  DEPENDENCY_ANALYSIS = 'dependency_analysis',
  
  // Workflow intents
  MULTI_STEP_WORKFLOW = 'multi_step_workflow',
  BATCH_OPERATION = 'batch_operation',
  
  // Meta intents
  HELP_REQUEST = 'help_request',
  CLARIFICATION_NEEDED = 'clarification_needed',
  UNKNOWN = 'unknown'
}

enum RoutingStrategy {
  DIRECT_LLM = 'direct_llm',           // Simple LLM response
  SINGLE_TOOL = 'single_tool',         // Use one specific tool
  MULTI_TOOL = 'multi_tool',           // Orchestrate multiple tools
  WORKFLOW = 'workflow',               // Execute predefined workflow
  INTERACTIVE = 'interactive',         // Require user interaction
  FALLBACK = 'fallback'               // Use fallback strategy
}

interface AlternativeIntent {
  intent: IntentType;
  confidence: number;
  reasoning: string;
}

interface FallbackOption {
  strategy: FallbackStrategy;
  message: string;
  suggestedActions: string[];
}

enum FallbackStrategy {
  ASK_CLARIFICATION = 'ask_clarification',
  SUGGEST_ALTERNATIVES = 'suggest_alternatives',
  DEFAULT_TO_CONVERSATION = 'default_to_conversation',
  ESCALATE_TO_HUMAN = 'escalate_to_human'
}
```

## Configuration

### IntentAnalyzerConfig

```typescript
interface IntentAnalyzerConfig {
  /**
   * Analysis strategy
   */
  strategy: AnalysisStrategy;
  
  /**
   * Confidence thresholds
   */
  thresholds: ConfidenceThresholds;
  
  /**
   * Routing rules
   */
  routingRules: RoutingRule[];
  
  /**
   * Fallback configuration
   */
  fallback: FallbackConfig;
  
  /**
   * Performance settings
   */
  performance: PerformanceConfig;
}

enum AnalysisStrategy {
  RULE_BASED = 'rule_based',           // Use predefined rules
  LLM_BASED = 'llm_based',             // Use LLM for classification
  HYBRID = 'hybrid',                   // Combine rules and LLM
  ML_MODEL = 'ml_model'                // Use trained ML model
}

interface ConfidenceThresholds {
  /**
   * Minimum confidence for tool routing
   */
  toolRouting: number;
  
  /**
   * Minimum confidence for workflow execution
   */
  workflowExecution: number;
  
  /**
   * Threshold for asking clarification
   */
  clarificationRequired: number;
  
  /**
   * Threshold for fallback strategy
   */
  fallbackRequired: number;
}

interface RoutingRule {
  /**
   * Rule identifier
   */
  id: string;
  
  /**
   * Rule description
   */
  description: string;
  
  /**
   * Pattern to match (regex or string)
   */
  pattern: string | RegExp;
  
  /**
   * Target intent
   */
  intent: IntentType;
  
  /**
   * Required tools
   */
  requiredTools: string[];
  
  /**
   * Rule priority (higher = more important)
   */
  priority: number;
  
  /**
   * Context requirements
   */
  contextRequirements?: ContextRequirement[];
}

interface ContextRequirement {
  type: 'working_directory' | 'file_exists' | 'tool_available' | 'custom';
  condition: string;
  required: boolean;
}

interface FallbackConfig {
  /**
   * Default fallback strategy
   */
  defaultStrategy: FallbackStrategy;
  
  /**
   * Maximum clarification attempts
   */
  maxClarificationAttempts: number;
  
  /**
   * Custom fallback messages
   */
  customMessages: Record<FallbackStrategy, string>;
}

interface PerformanceConfig {
  /**
   * Maximum analysis time (ms)
   */
  maxAnalysisTime: number;
  
  /**
   * Cache analysis results
   */
  enableCaching: boolean;
  
  /**
   * Cache TTL (ms)
   */
  cacheTTL: number;
  
  /**
   * Batch analysis support
   */
  enableBatchAnalysis: boolean;
}
```

## Implementation Strategies

### Rule-Based Analysis

```typescript
class RuleBasedIntentAnalyzer implements IIntentAnalyzer {
  private rules: RoutingRule[];
  private confidenceThreshold: number;
  
  async analyzeIntent(request: IntentAnalysisRequest): Promise<IntentAnalysisResult> {
    // 1. Apply routing rules in priority order
    const matchingRules = this.findMatchingRules(request.message);
    
    // 2. Calculate confidence based on pattern strength
    const confidence = this.calculateRuleConfidence(matchingRules, request);
    
    // 3. Extract parameters from message
    const parameters = this.extractParameters(request.message, matchingRules);
    
    // 4. Determine routing strategy
    const routingStrategy = this.determineRoutingStrategy(matchingRules, confidence);
    
    return {
      intent: matchingRules[0]?.intent || IntentType.UNKNOWN,
      confidence,
      reasoning: this.generateReasoning(matchingRules),
      routingStrategy,
      requiredTools: matchingRules[0]?.requiredTools || [],
      parameters,
      alternatives: this.findAlternatives(matchingRules),
      fallbackOptions: this.generateFallbackOptions(confidence)
    };
  }
  
  private findMatchingRules(message: string): RoutingRule[] {
    return this.rules
      .filter(rule => this.matchesPattern(message, rule.pattern))
      .sort((a, b) => b.priority - a.priority);
  }
  
  private matchesPattern(message: string, pattern: string | RegExp): boolean {
    if (typeof pattern === 'string') {
      return message.toLowerCase().includes(pattern.toLowerCase());
    }
    return pattern.test(message);
  }
}
```

### LLM-Based Analysis

```typescript
class LLMBasedIntentAnalyzer implements IIntentAnalyzer {
  private llmProvider: ILLMProvider;
  private systemPrompt: string;
  
  async analyzeIntent(request: IntentAnalysisRequest): Promise<IntentAnalysisResult> {
    // 1. Construct analysis prompt
    const prompt = this.buildAnalysisPrompt(request);
    
    // 2. Get LLM analysis
    const llmResponse = await this.llmProvider.generateResponse(prompt);
    
    // 3. Parse structured response
    const analysis = this.parseAnalysisResponse(llmResponse);
    
    // 4. Validate and enhance result
    return this.validateAndEnhance(analysis, request);
  }
  
  private buildAnalysisPrompt(request: IntentAnalysisRequest): string {
    return `
${this.systemPrompt}

Available Tools: ${request.context.availableTools.join(', ')}

User Message: "${request.message}"

Context: ${this.formatContext(request.context)}

Analyze the user's intent and respond with a JSON object containing:
- intent: The detected intent type
- confidence: Confidence score (0.0-1.0)  
- reasoning: Explanation of the analysis
- requiredTools: List of tools needed
- parameters: Extracted parameters

Response:`;
  }
}
```

### Hybrid Analysis

```typescript
class HybridIntentAnalyzer implements IIntentAnalyzer {
  private ruleAnalyzer: RuleBasedIntentAnalyzer;
  private llmAnalyzer: LLMBasedIntentAnalyzer;
  
  async analyzeIntent(request: IntentAnalysisRequest): Promise<IntentAnalysisResult> {
    // 1. Try rule-based analysis first (fast)
    const ruleResult = await this.ruleAnalyzer.analyzeIntent(request);
    
    // 2. If confidence is high, use rule result
    if (ruleResult.confidence >= this.confidenceThreshold) {
      return ruleResult;
    }
    
    // 3. Fall back to LLM analysis (slower but more accurate)
    const llmResult = await this.llmAnalyzer.analyzeIntent(request);
    
    // 4. Combine results for final decision
    return this.combineResults(ruleResult, llmResult, request);
  }
  
  private combineResults(
    ruleResult: IntentAnalysisResult,
    llmResult: IntentAnalysisResult,
    request: IntentAnalysisRequest
  ): IntentAnalysisResult {
    // Weighted combination based on strategy
    const combinedConfidence = (ruleResult.confidence * 0.3) + (llmResult.confidence * 0.7);
    
    return {
      intent: combinedConfidence > 0.7 ? llmResult.intent : ruleResult.intent,
      confidence: combinedConfidence,
      reasoning: `Rule-based: ${ruleResult.reasoning}. LLM: ${llmResult.reasoning}`,
      routingStrategy: this.selectBestStrategy(ruleResult, llmResult),
      requiredTools: [...new Set([...ruleResult.requiredTools, ...llmResult.requiredTools])],
      parameters: { ...ruleResult.parameters, ...llmResult.parameters },
      alternatives: this.mergeAlternatives(ruleResult.alternatives, llmResult.alternatives),
      fallbackOptions: ruleResult.fallbackOptions
    };
  }
}
```

## Error Handling

### Intent Analysis Errors

```typescript
enum IntentAnalysisError {
  ANALYSIS_TIMEOUT = 'ANALYSIS_TIMEOUT',
  INVALID_MESSAGE = 'INVALID_MESSAGE',
  CONTEXT_MISSING = 'CONTEXT_MISSING',
  RULE_PARSING_ERROR = 'RULE_PARSING_ERROR',
  LLM_UNAVAILABLE = 'LLM_UNAVAILABLE',
  UNKNOWN_INTENT = 'UNKNOWN_INTENT'
}

interface IntentAnalysisException extends Error {
  code: IntentAnalysisError;
  details: Record<string, any>;
  recoverable: boolean;
  fallbackIntent?: IntentType;
}
```

## Performance Considerations

### Caching Strategy

```typescript
interface AnalysisCache {
  /**
   * Cache analysis result
   */
  cache(key: string, result: IntentAnalysisResult, ttl: number): Promise<void>;
  
  /**
   * Get cached result
   */
  get(key: string): Promise<IntentAnalysisResult | null>;
  
  /**
   * Invalidate cache entries
   */
  invalidate(pattern: string): Promise<void>;
}

// Cache key generation
function generateCacheKey(request: IntentAnalysisRequest): string {
  const contextHash = hashContext(request.context);
  const messageHash = hashMessage(request.message);
  return `intent:${messageHash}:${contextHash}`;
}
```

### Batch Analysis

```typescript
interface IBatchIntentAnalyzer extends IIntentAnalyzer {
  /**
   * Analyze multiple intents in batch
   */
  analyzeBatch(requests: IntentAnalysisRequest[]): Promise<IntentAnalysisResult[]>;
}
```

## Testing Contract

### Testable Behaviors

```typescript
interface IntentAnalyzerTestSuite {
  /**
   * Test intent classification accuracy
   */
  testIntentClassification(testCases: IntentTestCase[]): TestResults;
  
  /**
   * Test confidence calibration
   */
  testConfidenceCalibration(testCases: ConfidenceTestCase[]): TestResults;
  
  /**
   * Test routing rule precedence
   */
  testRulePrecedence(rules: RoutingRule[], testCases: RuleTestCase[]): TestResults;
  
  /**
   * Test fallback behavior
   */
  testFallbackBehavior(ambiguousInputs: string[]): TestResults;
}

interface IntentTestCase {
  input: string;
  context: AnalysisContext;
  expectedIntent: IntentType;
  expectedTools: string[];
  description: string;
}
```

This Intent Analyzer component provides the core intelligence for transforming user messages into actionable routing decisions, supporting multiple analysis strategies and providing comprehensive error handling and performance optimizations.