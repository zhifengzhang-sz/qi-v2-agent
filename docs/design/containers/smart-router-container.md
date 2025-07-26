# Smart Router Container Interface Contract

## Overview

The Smart Router Container is responsible for natural language processing, intent analysis, and workflow orchestration. It serves as the intelligent core that transforms user messages into appropriate responses or tool executions.

## Container Responsibilities

- **Intent Analysis**: Determine whether user input requires direct response or tool usage
- **Natural Language Processing**: Process and understand user messages in context
- **Tool Orchestration**: Execute appropriate tools and manage multi-step workflows  
- **Response Generation**: Generate contextually appropriate responses
- **State Management**: Maintain conversation context and tool execution state

## Public API Interface

### ISmartRouter

```typescript
interface ISmartRouter {
  /**
   * Initialize the smart router with configuration
   * @param config Router configuration
   */
  initialize(config: SmartRouterConfig): Promise<void>;
  
  /**
   * Process a message and return streaming response
   * @param request Message processing request
   * @returns Streaming response iterator
   */
  processMessage(request: MessageRequest): AsyncIterableIterator<ResponseChunk>;
  
  /**
   * Get available tools and capabilities
   * @returns Available tools and descriptions
   */
  getAvailableTools(): Promise<ToolDefinition[]>;
  
  /**
   * Get conversation context
   * @param threadId Thread identifier
   * @returns Conversation context
   */
  getContext(threadId: string): Promise<ConversationContext>;
  
  /**
   * Health check
   * @returns Health status
   */
  healthCheck(): Promise<RouterHealthStatus>;
  
  /**
   * Cleanup resources
   */
  cleanup(): Promise<void>;
}
```

### Message Processing Contract

```typescript
interface MessageRequest {
  messages: Message[];
  options: ProcessingOptions;
  context?: RequestContext;
}

interface Message {
  role: 'user' | 'assistant' | 'system' | 'tool';
  content: string;
  metadata?: MessageMetadata;
}

interface MessageMetadata {
  timestamp: Date;
  source?: string;
  toolCalls?: ToolCall[];
}

interface ProcessingOptions {
  threadId?: string;
  timeout?: number;
  stream?: boolean;
  temperature?: number;
  maxTokens?: number;
}

interface RequestContext {
  userId?: string;
  sessionId?: string;
  workingDirectory?: string;
  environmentVars?: Record<string, string>;
}
```

### Response Contract

```typescript
interface ResponseChunk {
  type: ResponseType;
  content: string;
  metadata?: ResponseMetadata;
}

enum ResponseType {
  TOKEN = 'token',                    // Text token from LLM
  TOOL_CALL = 'tool_call',           // Tool execution started
  TOOL_RESULT = 'tool_result',       // Tool execution completed
  STATUS = 'status',                 // Status update
  ERROR = 'error',                   // Error occurred
  COMPLETE = 'complete'              // Response complete
}

interface ResponseMetadata {
  timestamp: Date;
  tokenCount?: number;
  toolInfo?: ToolExecutionInfo;
  routingDecision?: RoutingDecision;
}

interface ToolExecutionInfo {
  toolName: string;
  parameters: Record<string, any>;
  executionTime: number;
  success: boolean;
}

interface RoutingDecision {
  intent: IntentType;
  confidence: number;
  reasoning: string;
  toolsRequired: string[];
}

enum IntentType {
  CONVERSATION = 'conversation',      // Simple conversation
  CODE_GENERATION = 'code_generation', // Code creation
  FILE_OPERATION = 'file_operation',  // File manipulation
  CODE_ANALYSIS = 'code_analysis',    // Code review/analysis
  EXPLANATION = 'explanation',        // Educational content
  WORKFLOW = 'workflow'               // Multi-step process
}
```

## Configuration Contract

### SmartRouterConfig

```typescript
interface SmartRouterConfig {
  /**
   * Language model configuration
   */
  llm: LLMConfig;
  
  /**
   * Tool configuration
   */
  tools: ToolsConfig;
  
  /**
   * Routing behavior
   */
  routing: RoutingConfig;
  
  /**
   * Memory and persistence
   */
  memory: MemoryConfig;
  
  /**
   * Performance settings
   */
  performance: PerformanceConfig;
}

interface LLMConfig {
  provider: 'ollama' | 'openai' | 'anthropic' | 'custom';
  model: string;
  baseUrl?: string;
  apiKey?: string;
  temperature: number;
  maxTokens: number;
  timeout: number;
  retryAttempts: number;
}

interface ToolsConfig {
  mcp: MCPConfig;
  workflow: WorkflowToolsConfig;
  custom: CustomToolConfig[];
}

interface MCPConfig {
  servers: Record<string, MCPServerConfig>;
  timeout: number;
  retryAttempts: number;
}

interface MCPServerConfig {
  transport: 'stdio' | 'sse' | 'websocket';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
}

interface WorkflowToolsConfig {
  enabled: boolean;
  tools: {
    editFiles: boolean;
    analyzeCode: boolean;
    explainConcept: boolean;
  };
}

interface RoutingConfig {
  systemPrompt: string;
  intentThreshold: number;
  fallbackStrategy: 'direct_llm' | 'error' | 'ask_clarification';
  toolSelectionStrategy: 'confidence' | 'first_match' | 'multi_tool';
}

interface MemoryConfig {
  enabled: boolean;
  provider: 'memory' | 'redis' | 'file';
  maxConversationLength: number;
  contextWindowSize: number;
}

interface PerformanceConfig {
  streamingBufferSize: number;
  maxConcurrentTools: number;
  timeouts: {
    llmResponse: number;
    toolExecution: number;
    totalRequest: number;
  };
}
```

## Tool Integration Contract

### IToolManager

```typescript
interface IToolManager {
  /**
   * Get available tools
   * @returns List of available tools
   */
  getAvailableTools(): Promise<ToolDefinition[]>;
  
  /**
   * Execute a tool
   * @param toolName Name of tool to execute
   * @param parameters Tool parameters
   * @param context Execution context
   * @returns Tool execution result
   */
  executeTool(
    toolName: string, 
    parameters: Record<string, any>,
    context: ToolContext
  ): Promise<ToolResult>;
  
  /**
   * Check if tool is available
   * @param toolName Name of tool
   * @returns Whether tool is available
   */
  isToolAvailable(toolName: string): Promise<boolean>;
  
  /**
   * Register custom tool
   * @param tool Tool definition
   */
  registerTool(tool: ToolDefinition): void;
}

interface ToolDefinition {
  name: string;
  description: string;
  parameters: ToolParameter[];
  category: ToolCategory;
  version: string;
}

interface ToolParameter {
  name: string;
  type: 'string' | 'number' | 'boolean' | 'array' | 'object';
  description: string;
  required: boolean;
  default?: any;
  validation?: ValidationRule[];
}

enum ToolCategory {
  FILE_SYSTEM = 'file_system',
  CODE_ANALYSIS = 'code_analysis', 
  WORKFLOW = 'workflow',
  UTILITY = 'utility',
  CUSTOM = 'custom'
}

interface ToolContext {
  workingDirectory: string;
  userId?: string;
  sessionId?: string;
  environment: Record<string, string>;
}

interface ToolResult {
  success: boolean;
  result: any;
  error?: ToolError;
  metadata: ToolResultMetadata;
}

interface ToolError {
  code: string;
  message: string;
  details?: Record<string, any>;
}

interface ToolResultMetadata {
  executionTime: number;
  resourceUsage?: ResourceUsage;
  warnings?: string[];
}
```

## Routing Logic Contract

### IIntentAnalyzer

```typescript
interface IIntentAnalyzer {
  /**
   * Analyze user intent
   * @param messages Conversation messages
   * @param context Analysis context
   * @returns Intent analysis result
   */
  analyzeIntent(
    messages: Message[], 
    context: AnalysisContext
  ): Promise<IntentAnalysis>;
  
  /**
   * Get routing confidence threshold
   * @returns Confidence threshold (0-1)
   */
  getConfidenceThreshold(): number;
  
  /**
   * Update routing rules
   * @param rules New routing rules
   */
  updateRoutingRules(rules: RoutingRule[]): void;
}

interface AnalysisContext {
  conversationHistory: Message[];
  availableTools: string[];
  userPreferences?: UserPreferences;
}

interface IntentAnalysis {
  intent: IntentType;
  confidence: number;
  reasoning: string;
  suggestedTools: string[];
  parameters: Record<string, any>;
  fallbackOptions: FallbackOption[];
}

interface RoutingRule {
  pattern: string | RegExp;
  intent: IntentType;
  requiredTools: string[];
  priority: number;
}

interface FallbackOption {
  strategy: 'direct_response' | 'ask_clarification' | 'suggest_alternatives';
  message: string;
}
```

## State Management Contract

### IConversationManager

```typescript
interface IConversationManager {
  /**
   * Create new conversation
   * @param threadId Thread identifier
   * @param context Initial context
   * @returns Conversation instance
   */
  createConversation(
    threadId: string, 
    context?: ConversationContext
  ): Promise<Conversation>;
  
  /**
   * Get existing conversation
   * @param threadId Thread identifier
   * @returns Conversation instance or null
   */
  getConversation(threadId: string): Promise<Conversation | null>;
  
  /**
   * Update conversation state
   * @param threadId Thread identifier
   * @param update State update
   */
  updateConversation(
    threadId: string, 
    update: ConversationUpdate
  ): Promise<void>;
  
  /**
   * Delete conversation
   * @param threadId Thread identifier
   */
  deleteConversation(threadId: string): Promise<void>;
}

interface Conversation {
  threadId: string;
  messages: Message[];
  context: ConversationContext;
  metadata: ConversationMetadata;
}

interface ConversationContext {
  workingDirectory: string;
  activeTools: string[];
  userPreferences: UserPreferences;
  sessionVariables: Record<string, any>;
}

interface ConversationMetadata {
  createdAt: Date;
  lastActive: Date;
  messageCount: number;
  totalTokens: number;
}

interface ConversationUpdate {
  messages?: Message[];
  context?: Partial<ConversationContext>;
  metadata?: Partial<ConversationMetadata>;
}
```

## Error Handling Contract

### SmartRouterError

```typescript
interface SmartRouterError {
  code: SmartRouterErrorCode;
  message: string;
  details?: Record<string, any>;
  recoverable: boolean;
  retryAfter?: number;
}

enum SmartRouterErrorCode {
  LLM_TIMEOUT = 'LLM_TIMEOUT',
  LLM_ERROR = 'LLM_ERROR',
  TOOL_NOT_FOUND = 'TOOL_NOT_FOUND',
  TOOL_EXECUTION_ERROR = 'TOOL_EXECUTION_ERROR', 
  INTENT_ANALYSIS_FAILED = 'INTENT_ANALYSIS_FAILED',
  CONTEXT_LIMIT_EXCEEDED = 'CONTEXT_LIMIT_EXCEEDED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  MEMORY_ERROR = 'MEMORY_ERROR'
}
```

## Performance Contract

### RouterMetrics

```typescript
interface RouterMetrics {
  /**
   * Get performance metrics
   * @param timeWindow Time window for metrics (in milliseconds)
   * @returns Performance metrics
   */
  getMetrics(timeWindow?: number): Promise<PerformanceMetrics>;
  
  /**
   * Reset metrics
   */
  resetMetrics(): void;
}

interface PerformanceMetrics {
  requestCount: number;
  averageResponseTime: number;
  p95ResponseTime: number;
  errorRate: number;
  
  llmMetrics: {
    averageLatency: number;
    tokenThroughput: number;
    errorRate: number;
  };
  
  toolMetrics: {
    executionCount: number;
    averageExecutionTime: number;
    successRate: number;
  };
  
  memoryUsage: {
    heapUsed: number;
    heapTotal: number;
    external: number;
  };
}
```

## Implementation Requirements

### Non-Functional Requirements

- **Performance**: 
  - First response token within 2 seconds
  - Tool execution completion within 30 seconds
  - Support 10 concurrent conversations
- **Reliability**: 
  - 99.9% uptime for intent analysis
  - Graceful degradation when tools fail
  - Automatic recovery from LLM failures
- **Scalability**: 
  - Support for multiple LLM providers
  - Pluggable tool architecture
  - Configurable memory backends

### Integration Requirements

- **LLM Agnostic**: Support multiple LLM providers through unified interface
- **Tool Extensible**: Easy registration of new tools and capabilities
- **Context Aware**: Maintain conversation context across interactions
- **Error Resilient**: Handle and recover from various failure modes

## Current Implementation Gaps

### Missing Abstractions

The current implementation lacks these interface abstractions:

1. **ISmartRouter** - Currently using AgentFactory directly
2. **IIntentAnalyzer** - Currently embedded in system prompt
3. **IToolManager** - Currently mixed with MCP and workflow tools
4. **IConversationManager** - Currently using LangGraph's memory
5. **Standardized error handling** - Currently inconsistent error responses

### Proposed Refactoring

```typescript
// Current: Monolithic AgentFactory
const agentFactory = new AgentFactory(config);
await agentFactory.chat(messages, options);

// Proposed: Interface-based composition
const smartRouter = new SmartRouter({
  llmProvider: new OllamaProvider(config.llm),
  toolManager: new CompositeTool([
    new MCPToolManager(config.mcp),
    new WorkflowToolManager(config.workflow)
  ]),
  intentAnalyzer: new SystemPromptAnalyzer(config.routing),
  conversationManager: new MemoryConversationManager(config.memory)
});

await smartRouter.processMessage(request);
```

This refactoring would enable:
- **Provider substitution**: Switch LLM providers without code changes
- **Tool composition**: Mix and match different tool providers
- **Intent customization**: Replace or enhance intent analysis logic
- **Testing**: Mock individual components for testing
- **Monitoring**: Standardized metrics and error reporting