// Pure Abstract Interfaces - Technology Agnostic
//
// Based on docs/agents/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

// ============================================================================
// Cognitive Framework Abstractions
// ============================================================================

/**
 * Abstract cognitive pattern (technology-agnostic)
 */
export interface CognitivePattern {
  readonly name: string;
  readonly description: string;
  readonly purpose: string;
  readonly characteristics: readonly string[];
  readonly abstractKeywords: readonly string[];
  readonly contextWeight: number;
}

/**
 * Domain specialization mode
 */
export interface DomainMode {
  readonly abstractPattern: string;
  readonly domainName: string;
  readonly domainKeywords: readonly string[];
  readonly domainTools: readonly string[];
  readonly domainPrompts: readonly string[];
}

/**
 * Domain configuration
 */
export interface DomainConfiguration {
  readonly domain: string;
  readonly version: string;
  readonly description: string;
  readonly patterns: ReadonlyMap<string, DomainMode>;
}

/**
 * Processing context for pattern detection
 */
export interface ProcessingContext {
  readonly threadId?: string;
  readonly currentPattern?: string;
  readonly userHistory?: readonly ProcessingEvent[];
  readonly environmentContext?: ReadonlyMap<string, unknown>;
}

/**
 * Pattern detection result
 */
export interface PatternDetectionResult {
  readonly pattern: CognitivePattern;
  readonly confidence: number;
  readonly detectionMethod: 'rule-based' | 'llm-based' | 'hybrid';
  readonly metadata: Map<string, unknown>;
}

/**
 * Abstract pattern matcher interface
 */
export interface IPatternMatcher {
  detectPattern(input: string, context?: ProcessingContext): Promise<PatternDetectionResult>;
  getAvailablePatterns(): readonly CognitivePattern[];
  updatePatternConfiguration(patterns: readonly CognitivePattern[]): void;
}

// ============================================================================
// Workflow Engine Abstractions
// ============================================================================

/**
 * Workflow state (technology-agnostic)
 */
export interface WorkflowState {
  readonly input: string;
  readonly pattern: CognitivePattern;
  readonly domain: string;
  readonly context: Map<string, unknown>;
  readonly toolResults: readonly ToolResult[];
  readonly reasoning: string;
  readonly output: string;
  readonly metadata: WorkflowMetadata;
}

/**
 * Workflow metadata
 */
export interface WorkflowMetadata {
  readonly startTime: number;
  readonly currentStage?: string;
  readonly processingSteps: readonly string[];
  readonly performance: ReadonlyMap<string, number>;
}

/**
 * Executable workflow definition
 */
export interface ExecutableWorkflow {
  readonly id: string;
  readonly pattern: CognitivePattern;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
}

/**
 * Workflow node definition
 */
export interface WorkflowNode {
  readonly id: string;
  readonly name: string;
  readonly type: 'input' | 'processing' | 'tool' | 'reasoning' | 'output';
  readonly handler: WorkflowNodeHandler;
}

/**
 * Workflow edge definition
 */
export interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  readonly condition?: WorkflowCondition;
}

/**
 * Workflow node handler function type
 */
export type WorkflowNodeHandler = (state: WorkflowState) => Promise<WorkflowState>;

/**
 * Workflow condition function type
 */
export type WorkflowCondition = (state: WorkflowState) => boolean;

/**
 * Workflow execution result
 */
export interface WorkflowResult {
  readonly finalState: WorkflowState;
  readonly executionPath: readonly string[];
  readonly performance: WorkflowPerformance;
}

/**
 * Workflow performance metrics
 */
export interface WorkflowPerformance {
  readonly totalTime: number;
  readonly nodeExecutionTimes: ReadonlyMap<string, number>;
  readonly toolExecutionTime: number;
  readonly reasoningTime: number;
}

/**
 * Workflow customization
 */
export interface WorkflowCustomization {
  readonly type: 'add-node' | 'add-edge' | 'conditional-edge' | 'modify-node';
  readonly nodeId?: string;
  readonly edgeDefinition?: WorkflowEdge;
  readonly nodeDefinition?: WorkflowNode;
  readonly condition?: WorkflowCondition;
}

/**
 * Workflow stream chunk
 */
export interface WorkflowStreamChunk {
  readonly nodeId: string;
  readonly state: WorkflowState;
  readonly isComplete: boolean;
  readonly error?: WorkflowError;
}

/**
 * Workflow error
 */
export interface WorkflowError {
  readonly nodeId: string;
  readonly error: Error;
  readonly retryable: boolean;
}

/**
 * Abstract workflow engine interface
 */
export interface IWorkflowEngine {
  createWorkflow(pattern: CognitivePattern, customizations?: WorkflowCustomization[]): ExecutableWorkflow;
  execute(workflow: ExecutableWorkflow, initialState: WorkflowState): Promise<WorkflowResult>;
  stream(workflow: ExecutableWorkflow, initialState: WorkflowState): AsyncIterableIterator<WorkflowStreamChunk>;
  precompileWorkflows(patterns: readonly CognitivePattern[]): Promise<void>;
  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null;
}

// ============================================================================
// Model Provider Abstractions
// ============================================================================

/**
 * Model configuration
 */
export interface ModelConfiguration {
  readonly providerId: string;
  readonly modelId: string;
  readonly parameters: ModelParameters;
  readonly capabilities: ModelCapabilities;
}

/**
 * Model parameters
 */
export interface ModelParameters {
  readonly temperature: number;
  readonly maxTokens: number;
  readonly topP?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly stopSequences?: readonly string[];
}

/**
 * Model capabilities
 */
export interface ModelCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsToolCalling: boolean;
  readonly supportsSystemMessages: boolean;
  readonly maxContextLength: number;
  readonly supportedMessageTypes: readonly string[];
}

/**
 * Model message
 */
export interface ModelMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly metadata?: Map<string, unknown>;
}

/**
 * Model request
 */
export interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly configuration: ModelConfiguration;
  readonly context: Map<string, unknown>;
}

/**
 * Model response
 */
export interface ModelResponse {
  readonly content: string;
  readonly finishReason: 'completed' | 'length' | 'stop' | 'tool_call';
  readonly usage: TokenUsage;
  readonly metadata: Map<string, unknown>;
}

/**
 * Token usage tracking
 */
export interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

/**
 * Model stream chunk
 */
export interface ModelStreamChunk {
  readonly content: string;
  readonly isComplete: boolean;
  readonly usage?: TokenUsage;
  readonly metadata?: Map<string, unknown>;
}

/**
 * Abstract model provider interface
 */
export interface IModelProvider {
  getAvailableModels(): Promise<readonly ModelConfiguration[]>;
  invoke(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterableIterator<ModelStreamChunk>;
  validateConfiguration(config: ModelConfiguration): Promise<boolean>;
  estimateTokens(messages: readonly ModelMessage[]): Promise<number>;
}

// ============================================================================
// Tool Provider Abstractions
// ============================================================================

/**
 * Tool definition
 */
export interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolSchema;
  readonly outputSchema: ToolSchema;
  readonly category: string;
  readonly capabilities: ToolCapabilities;
}

/**
 * Tool schema
 */
export interface ToolSchema {
  readonly type: string;
  readonly properties: ReadonlyMap<string, ToolSchemaProperty>;
  readonly required: readonly string[];
}

/**
 * Tool schema property
 */
export interface ToolSchemaProperty {
  readonly type: string;
  readonly description: string;
  readonly enum?: readonly string[];
  readonly format?: string;
}

/**
 * Tool capabilities
 */
export interface ToolCapabilities {
  readonly isAsync: boolean;
  readonly supportsStreaming: boolean;
  readonly requiresConfirmation: boolean;
  readonly maxExecutionTime: number;
  readonly resourceRequirements: readonly string[];
}

/**
 * Tool request
 */
export interface ToolRequest {
  readonly toolName: string;
  readonly parameters: ReadonlyMap<string, unknown>;
  readonly context: Map<string, unknown>;
  readonly executionOptions: ToolExecutionOptions;
}

/**
 * Tool execution options
 */
export interface ToolExecutionOptions {
  readonly timeout?: number;
  readonly retryCount?: number;
  readonly confirmationRequired?: boolean;
  readonly streaming?: boolean;
}

/**
 * Tool result
 */
export interface ToolResult {
  readonly toolName: string;
  readonly status: 'success' | 'error' | 'timeout' | 'cancelled';
  readonly data?: unknown;
  readonly error?: string;
  readonly executionTime: number;
  readonly metadata: Map<string, unknown>;
}

/**
 * Tool stream chunk
 */
export interface ToolStreamChunk {
  readonly toolName: string;
  readonly data: unknown;
  readonly isComplete: boolean;
  readonly error?: string;
}

/**
 * Abstract tool provider interface
 */
export interface IToolProvider {
  getAvailableTools(pattern?: CognitivePattern): Promise<readonly ToolDefinition[]>;
  executeTool(request: ToolRequest): Promise<ToolResult>;
  streamTool(request: ToolRequest): AsyncIterableIterator<ToolStreamChunk>;
  validateTool(toolName: string, parameters: ReadonlyMap<string, unknown>): Promise<boolean>;
  getToolsForDomain(domain: string): Promise<readonly ToolDefinition[]>;
}

// ============================================================================
// Memory Provider Abstractions
// ============================================================================

/**
 * Session context
 */
export interface SessionContext {
  readonly sessionId: string;
  readonly userId?: string;
  readonly domain: string;
  readonly createdAt: Date;
  readonly lastAccessedAt: Date;
  readonly metadata: Map<string, unknown>;
}

/**
 * Processing event
 */
export interface ProcessingEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly type: 'input' | 'pattern_detection' | 'workflow_execution' | 'tool_execution' | 'output';
  readonly data: ReadonlyMap<string, unknown>;
}

/**
 * Conversation state
 */
export interface ConversationState {
  readonly sessionId: string;
  readonly messages: readonly ModelMessage[];
  readonly currentPattern?: CognitivePattern;
  readonly context: Map<string, unknown>;
  readonly lastUpdated: Date;
}

/**
 * Abstract memory provider interface
 */
export interface IMemoryProvider {
  createSession(domain: string, metadata?: ReadonlyMap<string, unknown>): Promise<SessionContext>;
  getSession(sessionId: string): Promise<SessionContext | null>;
  updateSession(sessionId: string, metadata: ReadonlyMap<string, unknown>): Promise<void>;
  deleteSession(sessionId: string): Promise<void>;
  
  saveConversationState(state: ConversationState): Promise<void>;
  getConversationState(sessionId: string): Promise<ConversationState | null>;
  
  addProcessingEvent(event: ProcessingEvent): Promise<void>;
  getProcessingHistory(sessionId: string, limit?: number): Promise<readonly ProcessingEvent[]>;
  
  cleanup(): Promise<void>;
}

// ============================================================================
// Agent Abstractions
// ============================================================================

/**
 * Agent configuration
 */
export interface AgentConfiguration {
  readonly domain: DomainConfiguration;
  readonly patternMatcher: IPatternMatcher;
  readonly workflowEngine: IWorkflowEngine;
  readonly modelProvider: IModelProvider;
  readonly toolProvider: IToolProvider;
  readonly memoryProvider?: IMemoryProvider;
}

/**
 * Agent request
 */
export interface AgentRequest {
  readonly input: string;
  readonly context?: ProcessingContext;
  readonly options?: AgentOptions;
}

/**
 * Agent options
 */
export interface AgentOptions {
  readonly forcePattern?: string;
  readonly streaming?: boolean;
  readonly sessionId?: string;
  readonly timeout?: number;
  readonly retryPolicy?: RetryPolicy;
}

/**
 * Retry policy
 */
export interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffStrategy: 'linear' | 'exponential';
  readonly retryableErrors: readonly string[];
}

/**
 * Agent response
 */
export interface AgentResponse {
  readonly content: string;
  readonly pattern: CognitivePattern;
  readonly toolsUsed: readonly string[];
  readonly performance: WorkflowPerformance;
  readonly metadata: Map<string, unknown>;
}

/**
 * Agent stream chunk
 */
export interface AgentStreamChunk {
  readonly content: string;
  readonly pattern?: CognitivePattern;
  readonly currentStage?: string;
  readonly isComplete: boolean;
  readonly error?: Error;
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly components: ReadonlyMap<string, ComponentHealth>;
  readonly timestamp: Date;
}

/**
 * Component health
 */
export interface ComponentHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latency?: number;
  readonly errorRate?: number;
  readonly details?: string;
}

/**
 * Main agent interface (technology-agnostic)
 */
export interface IAgent {
  initialize(): Promise<void>;
  process(request: AgentRequest): Promise<AgentResponse>;
  stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk>;
  
  getDomainConfiguration(): DomainConfiguration;
  getAvailablePatterns(): readonly CognitivePattern[];
  getAvailableTools(): Promise<readonly ToolDefinition[]>;
  
  healthCheck(): Promise<HealthCheckResult>;
  cleanup(): Promise<void>;
}

// ============================================================================
// Abstract Cognitive Patterns
// ============================================================================

/**
 * Abstract cognitive patterns (technology-agnostic)
 */
export const ABSTRACT_COGNITIVE_PATTERNS: readonly CognitivePattern[] = [
  {
    name: 'analytical',
    description: 'Deep analysis and structured reasoning',
    purpose: 'Break down complex problems systematically',
    characteristics: ['methodical', 'thorough', 'structured', 'evidence-based'],
    abstractKeywords: ['analyze', 'review', 'examine', 'assess', 'evaluate'],
    contextWeight: 0.8
  },
  {
    name: 'creative',
    description: 'Generation and synthesis of new content',
    purpose: 'Create, build, and synthesize new artifacts',
    characteristics: ['innovative', 'constructive', 'synthesis', 'ideation'],
    abstractKeywords: ['create', 'build', 'generate', 'design', 'develop'],
    contextWeight: 0.9
  },
  {
    name: 'informational',
    description: 'Knowledge sharing and explanation',
    purpose: 'Educate, clarify, and transfer understanding',
    characteristics: ['educational', 'clarifying', 'comprehensive', 'accessible'],
    abstractKeywords: ['explain', 'help', 'what', 'how', 'why', 'understand'],
    contextWeight: 0.6
  },
  {
    name: 'problem-solving',
    description: 'Issue identification and resolution',
    purpose: 'Diagnose problems and provide solutions',
    characteristics: ['diagnostic', 'solution-oriented', 'systematic', 'practical'],
    abstractKeywords: ['fix', 'solve', 'resolve', 'debug', 'troubleshoot'],
    contextWeight: 0.7
  },
  {
    name: 'conversational',
    description: 'General dialog and interaction',
    purpose: 'Maintain natural conversation flow',
    characteristics: ['responsive', 'contextual', 'adaptive', 'personable'],
    abstractKeywords: ['chat', 'discuss', 'talk', 'general'],
    contextWeight: 0.5
  }
] as const;

// ============================================================================
// Utility Types
// ============================================================================

/**
 * Generic result type for operations that can succeed or fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };