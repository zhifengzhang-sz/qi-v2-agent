# Workflow Executor Container Interface Contract

## Container Overview

The Workflow Executor Container implements the **WE (Workflow Executor) + LLM** components of the **Agent = Tool Box + WE + LLM** model. It orchestrates workflow execution, integrates LLM capabilities, and manages state, while delegating all tool execution to the dedicated Tool Container.

## Interface Definition

### Core Interface
```typescript
interface WorkflowExecutorContainer extends Agent<WorkflowExecutionRequest, WorkflowResult> {
  // Core processing
  process(request: WorkflowExecutionRequest): Promise<WorkflowResult>;
  
  // Workflow execution
  executeWorkflow(spec: WorkflowSpecification, params: ExecutionParameters): Promise<WorkflowResult>;
  
  // Tool Container integration
  requestToolExecution(toolRequest: ToolExecutionRequest): Promise<ToolExecutionResult>;
  integrateToolResults(toolResults: ToolExecutionResult[], context: WorkflowContext): ProcessedResults;
  
  // LLM integration
  generateLLMResponse(request: LLMRequest, context: WorkflowContext): Promise<LLMResponse>;
  generateStreamingResponse(request: LLMRequest, context: WorkflowContext): AsyncIterator<LLMStreamChunk>;
  
  // Workflow management
  getWorkflowStatus(executionId: string): WorkflowStatus;
  cancelWorkflow(executionId: string): boolean;
  pauseWorkflow(executionId: string): boolean;
  resumeWorkflow(executionId: string): boolean;
  
  // Resource management
  getResourceUsage(): ResourceUsage;
  cleanupResources(executionId: string): void;
  
  // Capabilities
  getCapabilities(): WorkflowExecutorCapabilities;
}
```

### Input Types
```typescript
interface WorkflowExecutionRequest {
  specification: WorkflowSpecification;
  parameters: ExecutionParameters;
  context: ExecutionContext;
  options: ExecutionOptions;
}

interface ExecutionParameters {
  userRequest: string;
  mode: CognitiveMode;
  requiredParams: Record<string, any>;
  optionalParams: Record<string, any>;
  contextData: Record<string, any>;
  toolResults?: ToolExecutionResult[]; // Pre-executed tool results from Tool Container
}

interface ExecutionContext {
  sessionId: string;
  userId?: string;
  conversationHistory: ConversationEntry[];
  projectContext: ProjectContext;
  environmentContext: EnvironmentContext;
}

interface ExecutionOptions {
  timeout?: number;
  retryPolicy?: RetryPolicy;
  priority?: 'low' | 'normal' | 'high';
  streaming?: boolean;
  debug?: boolean;
  dryRun?: boolean;
}
```

### Output Types
```typescript
interface WorkflowResult {
  executionId: string;
  status: WorkflowStatus;
  output: WorkflowOutput;
  metadata: ExecutionMetadata;
  errors?: WorkflowError[];
  warnings?: WorkflowWarning[];
  metrics: ExecutionMetrics;
}

interface WorkflowOutput {
  primaryResult: any;
  artifacts: Artifact[];
  intermediateResults: Record<string, any>;
  formattedOutput: string;
  outputType: 'text' | 'code' | 'data' | 'mixed';
}

interface ExecutionMetadata {
  startTime: Date;
  endTime: Date;
  duration: number;
  steps: StepExecutionResult[];
  resourcesUsed: ResourceUsage;
  version: string;
}

type WorkflowStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'paused';
```

## Workflow Orchestration

### Workflow Engine
```typescript
interface WorkflowEngine {
  // Workflow execution
  execute(spec: WorkflowSpecification, params: ExecutionParameters): Promise<WorkflowResult>;
  
  // Step execution
  executeStep(step: WorkflowStep, context: StepExecutionContext): Promise<StepResult>;
  
  // Tool Container delegation
  delegateToolExecution(toolStep: ToolWorkflowStep, context: StepExecutionContext): Promise<ToolStepResult>;
  
  // Flow control
  evaluateCondition(condition: string, context: ExecutionContext): boolean;
  handleParallelExecution(steps: WorkflowStep[], joinStrategy: JoinStrategy): Promise<StepResult[]>;
  
  // State management
  saveCheckpoint(executionId: string, state: WorkflowState): void;
  restoreFromCheckpoint(executionId: string): WorkflowState;
  
  // Error handling
  handleStepError(error: StepError, retryPolicy: RetryPolicy): Promise<StepResult>;
}

interface StepExecutionContext {
  executionId: string;
  stepId: string;
  previousResults: Record<string, any>;
  globalContext: ExecutionContext;
  stepConfiguration: StepConfiguration;
}

interface StepResult {
  stepId: string;
  status: 'success' | 'failure' | 'skipped';
  output: any;
  duration: number;
  resourcesUsed: ResourceUsage;
  error?: Error;
}
```

### LangGraph Orchestrator
```typescript
interface LangGraphOrchestrator {
  // Graph-based workflow execution
  executeGraph(graphDefinition: GraphDefinition, initialState: GraphState): Promise<GraphResult>;
  
  // Node execution
  executeNode(node: GraphNode, state: GraphState): Promise<NodeResult>;
  
  // State transitions
  transitionState(currentState: GraphState, nodeResult: NodeResult): GraphState;
  
  // Flow control
  determineNextNodes(currentNode: string, state: GraphState): string[];
  checkTerminationCondition(state: GraphState): boolean;
  
  // Parallel execution
  executeParallelNodes(nodes: GraphNode[], state: GraphState): Promise<NodeResult[]>;
  
  // Error recovery
  handleNodeError(error: NodeError, state: GraphState): GraphState;
}

interface GraphDefinition {
  nodes: Record<string, GraphNode>;
  edges: GraphEdge[];
  entryPoint: string;
  exitPoints: string[];
  stateSchema: any;
}

interface GraphNode {
  id: string;
  type: 'llm' | 'tool' | 'condition' | 'transform' | 'human';
  configuration: NodeConfiguration;
  inputSchema: any;
  outputSchema: any;
}

interface GraphState {
  currentNodes: string[];
  data: Record<string, any>;
  metadata: Record<string, any>;
  executionPath: string[];
}
```

## LLM Integration

### LLM Provider Interface
```typescript
interface LLMProvider {
  // Model interaction
  generateResponse(request: LLMRequest): Promise<LLMResponse>;
  generateStreamingResponse(request: LLMRequest): AsyncIterator<LLMStreamChunk>;
  
  // Model management
  loadModel(modelName: string, configuration: ModelConfiguration): Promise<void>;
  unloadModel(modelName: string): Promise<void>;
  getLoadedModels(): string[];
  
  // Configuration
  configureModel(modelName: string, configuration: ModelConfiguration): void;
  getModelCapabilities(modelName: string): ModelCapabilities;
  
  // Resource management
  getModelResourceUsage(modelName: string): ResourceUsage;
  optimizeModelPerformance(modelName: string): void;
}

interface LLMRequest {
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  maxTokens?: number;
  stopSequences?: string[];
  tools?: ToolDefinition[];
  responseFormat?: 'text' | 'json' | 'structured';
}

interface LLMResponse {
  content: string;
  finishReason: 'stop' | 'length' | 'tool_call' | 'error';
  usage: TokenUsage;
  toolCalls?: ToolCall[];
  metadata: ResponseMetadata;
}

interface ChatMessage {
  role: 'system' | 'user' | 'assistant' | 'tool';
  content: string;
  toolCallId?: string;
  name?: string;
}
```

### Prompt Management
```typescript
interface PromptManager {
  // Template management
  loadPromptTemplate(templateId: string, mode: CognitiveMode): PromptTemplate;
  renderPrompt(template: PromptTemplate, variables: Record<string, any>): string;
  
  // Context formatting
  formatSystemPrompt(mode: CognitiveMode, context: ExecutionContext): string;
  formatUserPrompt(userInput: string, context: ExecutionContext): string;
  formatConversationHistory(history: ConversationEntry[]): ChatMessage[];
  
  // Optimization
  optimizePromptLength(prompt: string, maxTokens: number): string;
  validatePromptTokens(prompt: string, model: string): TokenValidation;
  
  // Dynamic prompts
  generateDynamicPrompt(mode: CognitiveMode, context: ExecutionContext): string;
  adaptPromptToContext(basePrompt: string, context: ExecutionContext): string;
}

interface PromptTemplate {
  id: string;
  name: string;
  mode: CognitiveMode;
  template: string;
  variables: PromptVariable[];
  version: string;
  tokenEstimate: number;
}

interface PromptVariable {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  required: boolean;
  defaultValue?: any;
  description: string;
}
```

## Tool Container Integration

### Tool Request Interface
```typescript
interface ToolContainerClient {
  // Tool execution requests
  requestToolExecution(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
  requestToolChain(chain: ToolChainRequest): Promise<ToolChainResult>;
  
  // Tool discovery
  discoverAvailableTools(): Promise<ToolDefinition[]>;
  getToolDefinition(toolName: string): Promise<ToolDefinition>;
  
  // Result integration
  integrateToolResults(results: ToolExecutionResult[], context: WorkflowContext): ProcessedResults;
  validateToolResults(results: ToolExecutionResult[]): ValidationResult;
}

interface ToolExecutionRequest {
  toolName: string;
  parameters: Record<string, any>;
  context: ToolRequestContext;
  executionOptions?: ToolExecutionOptions;
}

interface ToolChainRequest {
  chain: ToolCall[];
  orchestration: 'sequential' | 'parallel' | 'conditional';
  context: ToolRequestContext;
}

interface ToolRequestContext {
  workflowExecutionId: string;
  stepId: string;
  sessionContext: ExecutionContext;
  previousStepResults: Record<string, any>;
}

interface ProcessedResults {
  aggregatedOutput: any;
  metadata: ProcessingMetadata;
  successfulTools: string[];
  failedTools: ToolFailure[];
  integrationStatus: 'complete' | 'partial' | 'failed';
}
```

## State Management

### Conversation Manager
```typescript
interface ConversationManager {
  // Conversation tracking
  startConversation(sessionId: string, context: SessionContext): ConversationId;
  endConversation(conversationId: ConversationId): void;
  
  // Message management
  addMessage(conversationId: ConversationId, message: ConversationMessage): void;
  getMessages(conversationId: ConversationId, limit?: number): ConversationMessage[];
  
  // Context management
  updateContext(conversationId: ConversationId, context: Partial<SessionContext>): void;
  getContext(conversationId: ConversationId): SessionContext;
  
  // Thread management
  createThread(conversationId: ConversationId, topic: string): ThreadId;
  switchThread(conversationId: ConversationId, threadId: ThreadId): void;
  getActiveThread(conversationId: ConversationId): ThreadId;
  
  // Memory management
  getShortTermMemory(conversationId: ConversationId): MemoryEntry[];
  getLongTermMemory(conversationId: ConversationId): MemoryEntry[];
  addMemory(conversationId: ConversationId, entry: MemoryEntry): void;
}

interface ConversationMessage {
  id: string;
  conversationId: ConversationId;
  threadId?: ThreadId;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: Date;
  metadata: MessageMetadata;
}

interface MemoryEntry {
  id: string;
  type: 'factual' | 'procedural' | 'episodic' | 'preference';
  content: string;
  relevanceScore: number;
  timestamp: Date;
  tags: string[];
}
```

### Session Manager
```typescript
interface SessionManager {
  // Session lifecycle
  createSession(userId?: string, options?: SessionOptions): SessionId;
  getSession(sessionId: SessionId): Session;
  updateSession(sessionId: SessionId, updates: Partial<Session>): void;
  terminateSession(sessionId: SessionId): void;
  
  // Session state
  saveSessionState(sessionId: SessionId, state: SessionState): void;
  loadSessionState(sessionId: SessionId): SessionState;
  
  // Session persistence
  persistSession(sessionId: SessionId): void;
  restoreSession(sessionId: SessionId): Session;
  
  // Session cleanup
  cleanupExpiredSessions(): void;
  cleanupSessionResources(sessionId: SessionId): void;
  
  // Session monitoring
  getActiveSessions(): SessionId[];
  getSessionMetrics(sessionId: SessionId): SessionMetrics;
}

interface Session {
  id: SessionId;
  userId?: string;
  status: 'active' | 'inactive' | 'terminated';
  createdAt: Date;
  lastActivity: Date;
  preferences: UserPreferences;
  context: SessionContext;
  metrics: SessionMetrics;
}

interface SessionState {
  currentMode: CognitiveMode;
  workflowState: WorkflowState;
  conversationState: ConversationState;
  toolState: ToolState;
  customState: Record<string, any>;
}
```

## Response Generation

### Response Formatter
```typescript
interface ResponseFormatter {
  // Format workflow results
  formatWorkflowResult(result: WorkflowResult, format: OutputFormat): FormattedResponse;
  
  // Format different output types
  formatTextResponse(content: string, metadata: ResponseMetadata): FormattedResponse;
  formatCodeResponse(code: string, language: string, metadata: ResponseMetadata): FormattedResponse;
  formatDataResponse(data: any, schema: any, metadata: ResponseMetadata): FormattedResponse;
  
  // Error formatting
  formatError(error: WorkflowError, includeStackTrace: boolean): FormattedError;
  formatWarning(warning: WorkflowWarning): FormattedWarning;
  
  // Streaming support
  formatStreamingChunk(chunk: any, chunkType: 'text' | 'data' | 'status'): StreamChunk;
  
  // Multi-format support
  convertFormat(response: FormattedResponse, targetFormat: OutputFormat): FormattedResponse;
}

interface FormattedResponse {
  content: string;
  format: OutputFormat;
  metadata: ResponseMetadata;
  artifacts: Artifact[];
  actions: SuggestedAction[];
}

interface Artifact {
  id: string;
  name: string;
  type: 'file' | 'code' | 'data' | 'image' | 'document';
  content: any;
  mimeType: string;
  size: number;
}

interface SuggestedAction {
  id: string;
  label: string;
  description: string;
  action: 'execute_code' | 'save_file' | 'copy_text' | 'open_link' | 'continue_conversation';
  parameters: Record<string, any>;
}

type OutputFormat = 'text' | 'markdown' | 'html' | 'json' | 'xml' | 'yaml';
```

## Error Handling

### Workflow Errors
```typescript
interface WorkflowError extends Error {
  type: 'workflow';
  workflowId: string;
  stepId?: string;
  stage: 'initialization' | 'execution' | 'completion' | 'cleanup';
  severity: 'low' | 'medium' | 'high' | 'critical';
  recoverable: boolean;
  retryCount: number;
  context: ErrorContext;
}

interface StepError extends Error {
  type: 'step';
  stepId: string;
  stepType: StepType;
  inputData: any;
  configuration: StepConfiguration;
  retryable: boolean;
}

interface LLMError extends Error {
  type: 'llm';
  model: string;
  request: LLMRequest;
  errorCode: string;
  rateLimited: boolean;
  retryAfter?: number;
}

interface ToolError extends Error {
  type: 'tool';
  toolName: string;
  parameters: Record<string, any>;
  toolType: 'builtin' | 'mcp' | 'external';
  serverName?: string;
}
```

### Recovery Strategies
```typescript
interface RecoveryStrategy {
  // Workflow recovery
  recoverWorkflow(error: WorkflowError, context: ExecutionContext): Promise<RecoveryResult>;
  
  // Step recovery
  recoverStep(error: StepError, retryPolicy: RetryPolicy): Promise<StepResult>;
  
  // LLM recovery
  recoverLLMError(error: LLMError, fallbackModels: string[]): Promise<LLMResponse>;
  
  // Tool recovery
  recoverToolError(error: ToolError, fallbackTools: string[]): Promise<ToolResult>;
  
  // Circuit breaker
  handleCircuitBreaker(service: string, errorRate: number): void;
}

interface RecoveryResult {
  recovered: boolean;
  strategy: string;
  fallbackUsed?: string;
  partialResult?: any;
  additionalActions: RecoveryAction[];
}

interface RecoveryAction {
  type: 'retry' | 'fallback' | 'skip' | 'abort' | 'manual_intervention';
  description: string;
  parameters: Record<string, any>;
}
```

## Performance Requirements

### Response Time Targets
- **Workflow Initialization**: < 500ms
- **Simple Workflow Execution**: < 5 seconds
- **Complex Workflow Execution**: < 30 seconds
- **LLM Response Time**: < 10 seconds
- **Tool Execution**: < 2 seconds per tool

### Throughput Targets
- **Concurrent Workflows**: 50+ simultaneous executions
- **LLM Requests per Second**: 100+ requests
- **Tool Executions per Second**: 200+ executions
- **MCP Tool Calls per Second**: 150+ calls

### Resource Limits
- **Memory per Workflow**: < 500MB
- **CPU per Workflow**: < 50% of single core
- **Total Container Memory**: < 8GB
- **Disk Usage**: < 2GB for temporary files

### Reliability Targets
- **Workflow Success Rate**: > 95%
- **Error Recovery Rate**: > 80%
- **System Uptime**: > 99.5%
- **Data Consistency**: 100%

## Configuration

### Container Configuration
```typescript
interface WorkflowExecutorConfig {
  // Execution settings
  maxConcurrentWorkflows: number;
  defaultWorkflowTimeout: number;
  enableWorkflowCheckpoints: boolean;
  
  // LLM settings
  defaultLLMModel: string;
  llmTimeout: number;
  enableLLMCaching: boolean;
  maxLLMRetries: number;
  
  // Tool Container integration settings
  toolContainerEndpoint: string;
  toolContainerTimeout: number;
  enableToolContainerCaching: boolean;
  maxToolContainerRetries: number;
  
  // State management
  sessionTimeout: number;
  conversationHistoryLimit: number;
  enableStatePersistence: boolean;
  
  // Performance settings
  enableParallelExecution: boolean;
  maxParallelSteps: number;
  resourceMonitoringEnabled: boolean;
  
  // Error handling
  enableDetailedErrorLogging: boolean;
  errorRetentionDays: number;
  circuitBreakerThreshold: number;
}
```

### Model Configuration
```typescript
interface ModelConfiguration {
  // Model selection
  models: Record<CognitiveMode, ModelConfig>;
  fallbackModels: string[];
  
  // Performance tuning
  batchSize: number;
  cacheSize: number;
  preloadModels: string[];
  
  // Quality settings
  temperature: number;
  maxTokens: number;
  topP: number;
  frequencyPenalty: number;
}

interface ModelConfig {
  name: string;
  endpoint: string;
  apiKey?: string;
  maxContextLength: number;
  capabilities: ModelCapabilities;
  costPerToken: number;
}
```

## Testing Contract

### Unit Tests
```typescript
describe('WorkflowExecutorContainer', () => {
  describe('workflow execution', () => {
    it('should execute planning workflows correctly');
    it('should execute coding workflows correctly');
    it('should execute information workflows correctly');
    it('should execute debugging workflows correctly');
    it('should execute generic workflows correctly');
  });
  
  describe('tool container integration', () => {
    it('should delegate tool requests to Tool Container correctly');
    it('should integrate tool results into workflow correctly');
    it('should handle Tool Container errors gracefully');
    it('should support tool orchestration via Tool Container');
  });
  
  describe('state management', () => {
    it('should maintain conversation context');
    it('should persist session state');
    it('should handle session timeouts');
    it('should clean up resources properly');
  });
  
  describe('error handling', () => {
    it('should recover from workflow errors');
    it('should handle LLM failures');
    it('should recover from Tool Container communication failures');
    it('should implement circuit breaker patterns');
  });
});
```

### Integration Tests
```typescript
describe('WorkflowExecutorContainer Integration', () => {
  it('should receive workflow specifications from Smart Router');
  it('should execute LangGraph workflows correctly');
  it('should delegate tool execution to Tool Container');
  it('should integrate tool results from Tool Container');
  it('should connect to LLM providers');
  it('should send formatted results to Input Container');
  it('should maintain performance under load');
});
```

### Performance Tests
```typescript
describe('WorkflowExecutorContainer Performance', () => {
  it('should handle 50+ concurrent workflows');
  it('should complete simple workflows within 5 seconds');
  it('should use less than 500MB memory per workflow');
  it('should maintain 95%+ success rate');
  it('should recover from 80%+ of errors');
});
```

The Workflow Executor Container serves as the execution engine of the system, bringing together LLM capabilities, tool orchestration, and state management to deliver intelligent workflow execution across all cognitive modes.