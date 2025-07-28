# Agent Framework Abstractions

## Overview

This document defines the pure abstract interfaces for the agent framework. These interfaces are **technology-agnostic** and contain no dependencies on specific packages, frameworks, or implementations.

The abstractions serve as contracts that can be implemented using any technology stack while maintaining consistent behavior across different domains and use cases.

---

## Core Abstractions

### 1. Cognitive Framework Abstractions

#### 1.1 Cognitive Pattern

```typescript
interface CognitivePattern {
  readonly name: string;
  readonly description: string;
  readonly purpose: string;
  readonly characteristics: readonly string[];
  readonly abstractKeywords: readonly string[];
  readonly contextWeight: number;
}
```

#### 1.2 Domain Specialization

```typescript
interface DomainMode {
  readonly abstractPattern: string;
  readonly domainName: string;
  readonly domainKeywords: readonly string[];
  readonly domainTools: readonly string[];
  readonly domainPrompts: readonly string[];
}

interface DomainConfiguration {
  readonly domain: string;
  readonly version: string;
  readonly description: string;
  readonly patterns: ReadonlyMap<string, DomainMode>;
}
```

#### 1.3 Pattern Detection

```typescript
interface ProcessingContext {
  readonly threadId?: string;
  readonly currentPattern?: string;
  readonly userHistory?: readonly ProcessingEvent[];
  readonly environmentContext?: ReadonlyMap<string, unknown>;
}

interface PatternDetectionResult {
  readonly pattern: CognitivePattern;
  readonly confidence: number;
  readonly detectionMethod: 'rule-based' | 'llm-based' | 'hybrid';
  readonly metadata: ReadonlyMap<string, unknown>;
}

interface IPatternMatcher {
  detectPattern(input: string, context?: ProcessingContext): Promise<PatternDetectionResult>;
  getAvailablePatterns(): readonly CognitivePattern[];
  updatePatternConfiguration(patterns: readonly CognitivePattern[]): void;
}
```

---

### 2. Workflow Engine Abstractions

#### 2.1 Workflow Execution

```typescript
interface WorkflowState {
  readonly input: string;
  readonly pattern: CognitivePattern;
  readonly domain: string;
  readonly context: ReadonlyMap<string, unknown>;
  readonly toolResults: readonly ToolResult[];
  readonly reasoning: string;
  readonly output: string;
  readonly metadata: WorkflowMetadata;
}

interface WorkflowMetadata {
  readonly startTime: number;
  readonly currentStage?: string;
  readonly processingSteps: readonly string[];
  readonly performance: ReadonlyMap<string, number>;
}

interface ExecutableWorkflow {
  readonly id: string;
  readonly pattern: CognitivePattern;
  readonly nodes: readonly WorkflowNode[];
  readonly edges: readonly WorkflowEdge[];
}

interface WorkflowNode {
  readonly id: string;
  readonly name: string;
  readonly type: 'input' | 'processing' | 'tool' | 'reasoning' | 'output';
  readonly handler: WorkflowNodeHandler;
}

interface WorkflowEdge {
  readonly from: string;
  readonly to: string;
  readonly condition?: WorkflowCondition;
}

type WorkflowNodeHandler = (state: WorkflowState) => Promise<WorkflowState>;
type WorkflowCondition = (state: WorkflowState) => boolean;
```

#### 2.2 Workflow Engine Interface

```typescript
interface WorkflowResult {
  readonly finalState: WorkflowState;
  readonly executionPath: readonly string[];
  readonly performance: WorkflowPerformance;
}

interface WorkflowPerformance {
  readonly totalTime: number;
  readonly nodeExecutionTimes: ReadonlyMap<string, number>;
  readonly toolExecutionTime: number;
  readonly reasoningTime: number;
}

interface IWorkflowEngine {
  createWorkflow(pattern: CognitivePattern, customizations?: WorkflowCustomization[]): ExecutableWorkflow;
  execute(workflow: ExecutableWorkflow, initialState: WorkflowState): Promise<WorkflowResult>;
  stream(workflow: ExecutableWorkflow, initialState: WorkflowState): AsyncIterableIterator<WorkflowStreamChunk>;
  precompileWorkflows(patterns: readonly CognitivePattern[]): Promise<void>;
  getCompiledWorkflow(patternName: string): ExecutableWorkflow | null;
}

interface WorkflowStreamChunk {
  readonly nodeId: string;
  readonly state: WorkflowState;
  readonly isComplete: boolean;
  readonly error?: WorkflowError;
}

interface WorkflowCustomization {
  readonly type: 'add-node' | 'add-edge' | 'conditional-edge' | 'modify-node';
  readonly nodeId?: string;
  readonly edgeDefinition?: WorkflowEdge;
  readonly nodeDefinition?: WorkflowNode;
  readonly condition?: WorkflowCondition;
}

interface WorkflowError {
  readonly nodeId: string;
  readonly error: Error;
  readonly retryable: boolean;
}
```

---

### 3. Model Provider Abstractions

#### 3.1 Model Configuration

```typescript
interface ModelConfiguration {
  readonly providerId: string;
  readonly modelId: string;
  readonly parameters: ModelParameters;
  readonly capabilities: ModelCapabilities;
}

interface ModelParameters {
  readonly temperature: number;
  readonly maxTokens: number;
  readonly topP?: number;
  readonly frequencyPenalty?: number;
  readonly presencePenalty?: number;
  readonly stopSequences?: readonly string[];
}

interface ModelCapabilities {
  readonly supportsStreaming: boolean;
  readonly supportsToolCalling: boolean;
  readonly supportsSystemMessages: boolean;
  readonly maxContextLength: number;
  readonly supportedMessageTypes: readonly string[];
}
```

#### 3.2 Model Interaction

```typescript
interface ModelMessage {
  readonly role: 'system' | 'user' | 'assistant' | 'tool';
  readonly content: string;
  readonly metadata?: ReadonlyMap<string, unknown>;
}

interface ModelRequest {
  readonly messages: readonly ModelMessage[];
  readonly configuration: ModelConfiguration;
  readonly context: ReadonlyMap<string, unknown>;
}

interface ModelResponse {
  readonly content: string;
  readonly finishReason: 'completed' | 'length' | 'stop' | 'tool_call';
  readonly usage: TokenUsage;
  readonly metadata: ReadonlyMap<string, unknown>;
}

interface TokenUsage {
  readonly promptTokens: number;
  readonly completionTokens: number;
  readonly totalTokens: number;
}

interface IModelProvider {
  getAvailableModels(): Promise<readonly ModelConfiguration[]>;
  invoke(request: ModelRequest): Promise<ModelResponse>;
  stream(request: ModelRequest): AsyncIterableIterator<ModelStreamChunk>;
  validateConfiguration(config: ModelConfiguration): Promise<boolean>;
  estimateTokens(messages: readonly ModelMessage[]): Promise<number>;
}

interface ModelStreamChunk {
  readonly content: string;
  readonly isComplete: boolean;
  readonly usage?: TokenUsage;
  readonly metadata?: ReadonlyMap<string, unknown>;
}
```

---

### 4. Tool Provider Abstractions

#### 4.1 Tool Definition

```typescript
interface ToolDefinition {
  readonly name: string;
  readonly description: string;
  readonly inputSchema: ToolSchema;
  readonly outputSchema: ToolSchema;
  readonly category: string;
  readonly capabilities: ToolCapabilities;
}

interface ToolSchema {
  readonly type: string;
  readonly properties: ReadonlyMap<string, ToolSchemaProperty>;
  readonly required: readonly string[];
}

interface ToolSchemaProperty {
  readonly type: string;
  readonly description: string;
  readonly enum?: readonly string[];
  readonly format?: string;
}

interface ToolCapabilities {
  readonly isAsync: boolean;
  readonly supportsStreaming: boolean;
  readonly requiresConfirmation: boolean;
  readonly maxExecutionTime: number;
  readonly resourceRequirements: readonly string[];
}
```

#### 4.2 Tool Execution

```typescript
interface ToolRequest {
  readonly toolName: string;
  readonly parameters: ReadonlyMap<string, unknown>;
  readonly context: ReadonlyMap<string, unknown>;
  readonly executionOptions: ToolExecutionOptions;
}

interface ToolExecutionOptions {
  readonly timeout?: number;
  readonly retryCount?: number;
  readonly confirmationRequired?: boolean;
  readonly streaming?: boolean;
}

interface ToolResult {
  readonly toolName: string;
  readonly status: 'success' | 'error' | 'timeout' | 'cancelled';
  readonly data?: unknown;
  readonly error?: string;
  readonly executionTime: number;
  readonly metadata: ReadonlyMap<string, unknown>;
}

interface IToolProvider {
  getAvailableTools(pattern?: CognitivePattern): Promise<readonly ToolDefinition[]>;
  executeTool(request: ToolRequest): Promise<ToolResult>;
  streamTool(request: ToolRequest): AsyncIterableIterator<ToolStreamChunk>;
  validateTool(toolName: string, parameters: ReadonlyMap<string, unknown>): Promise<boolean>;
  getToolsForDomain(domain: string): Promise<readonly ToolDefinition[]>;
}

interface ToolStreamChunk {
  readonly toolName: string;
  readonly data: unknown;
  readonly isComplete: boolean;
  readonly error?: string;
}
```

---

### 5. Memory Provider Abstractions

#### 5.1 Session Management

```typescript
interface SessionContext {
  readonly sessionId: string;
  readonly userId?: string;
  readonly domain: string;
  readonly createdAt: Date;
  readonly lastAccessedAt: Date;
  readonly metadata: ReadonlyMap<string, unknown>;
}

interface ProcessingEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly type: 'input' | 'pattern_detection' | 'workflow_execution' | 'tool_execution' | 'output';
  readonly data: ReadonlyMap<string, unknown>;
}

interface ConversationState {
  readonly sessionId: string;
  readonly messages: readonly ModelMessage[];
  readonly currentPattern?: CognitivePattern;
  readonly context: ReadonlyMap<string, unknown>;
  readonly lastUpdated: Date;
}
```

#### 5.2 Memory Operations

```typescript
interface IMemoryProvider {
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
```

---

### 6. Agent Abstractions

#### 6.1 Agent Factory Interface

```typescript
interface AgentConfiguration {
  readonly domain: DomainConfiguration;
  readonly patternMatcher: IPatternMatcher;
  readonly workflowEngine: IWorkflowEngine;
  readonly modelProvider: IModelProvider;
  readonly toolProvider: IToolProvider;
  readonly memoryProvider?: IMemoryProvider;
}

interface AgentRequest {
  readonly input: string;
  readonly context?: ProcessingContext;
  readonly options?: AgentOptions;
}

interface AgentOptions {
  readonly forcePattern?: string;
  readonly streaming?: boolean;
  readonly sessionId?: string;
  readonly timeout?: number;
  readonly retryPolicy?: RetryPolicy;
}

interface RetryPolicy {
  readonly maxRetries: number;
  readonly backoffStrategy: 'linear' | 'exponential';
  readonly retryableErrors: readonly string[];
}

interface AgentResponse {
  readonly content: string;
  readonly pattern: CognitivePattern;
  readonly toolsUsed: readonly string[];
  readonly performance: WorkflowPerformance;
  readonly metadata: ReadonlyMap<string, unknown>;
}

interface IAgent {
  initialize(): Promise<void>;
  process(request: AgentRequest): Promise<AgentResponse>;
  stream(request: AgentRequest): AsyncIterableIterator<AgentStreamChunk>;
  
  getDomainConfiguration(): DomainConfiguration;
  getAvailablePatterns(): readonly CognitivePattern[];
  getAvailableTools(): Promise<readonly ToolDefinition[]>;
  
  healthCheck(): Promise<HealthCheckResult>;
  cleanup(): Promise<void>;
}

interface AgentStreamChunk {
  readonly content: string;
  readonly pattern?: CognitivePattern;
  readonly currentStage?: string;
  readonly isComplete: boolean;
  readonly error?: Error;
}

interface HealthCheckResult {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly components: ReadonlyMap<string, ComponentHealth>;
  readonly timestamp: Date;
}

interface ComponentHealth {
  readonly status: 'healthy' | 'degraded' | 'unhealthy';
  readonly latency?: number;
  readonly errorRate?: number;
  readonly details?: string;
}
```

---

## Abstract Cognitive Patterns

### Abstract Pattern Definitions

```typescript
const ABSTRACT_COGNITIVE_PATTERNS: readonly CognitivePattern[] = [
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
```

---

## Design Principles

### 1. Technology Independence
- **Zero Dependencies**: No imports or references to specific packages
- **Pure Interfaces**: Only abstract contracts, no implementation details
- **Pluggable Architecture**: Any technology can implement these abstractions

### 2. Domain Agnostic
- **Abstract Patterns**: Cognitive patterns work across all domains
- **Flexible Specialization**: Domains map abstract patterns to specific needs
- **Consistent Behavior**: Same interfaces across different domains

### 3. Extensibility
- **Open for Extension**: New patterns, tools, and capabilities can be added
- **Closed for Modification**: Core abstractions remain stable
- **Backward Compatibility**: Changes don't break existing implementations

### 4. Performance Considerations
- **Readonly Interfaces**: Immutable data structures for thread safety
- **Async Operations**: All I/O operations are asynchronous
- **Streaming Support**: Real-time processing capabilities
- **Resource Management**: Proper cleanup and resource disposal

---

## Usage Guidelines

### For Framework Implementers
1. Implement these interfaces using your chosen technology stack
2. Ensure implementations are thread-safe and handle errors gracefully
3. Provide comprehensive logging and monitoring capabilities
4. Follow the performance characteristics defined in interfaces

### For Domain Specialists  
1. Define domain-specific patterns that map to abstract cognitive patterns
2. Specify domain-appropriate tools and capabilities
3. Create domain-specific prompts and configuration
4. Maintain separation between domain logic and framework implementation

### For Application Developers
1. Depend only on these abstractions, not concrete implementations
2. Use dependency injection to provide implementations
3. Write tests against interfaces to ensure implementation compatibility
4. Design for substitutability of different implementations

---

This abstraction layer provides the foundation for building powerful, flexible, and maintainable AI agent systems while remaining completely independent of specific technology choices.