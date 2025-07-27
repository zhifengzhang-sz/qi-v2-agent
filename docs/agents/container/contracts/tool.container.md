# Tool Container Interface Contract

## Container Overview

The Tool Container implements the **Tool Box** component of the **Agent = Tool Box + WE + LLM** model. It provides pure tool execution and orchestration capabilities, operating independently of workflow logic to maximize reusability and performance.

## Interface Definition

### Core Interface
```typescript
interface ToolContainer extends Agent<ToolExecutionRequest, ToolExecutionResult> {
  // Core processing
  process(request: ToolExecutionRequest): Promise<ToolExecutionResult>;
  
  // Tool execution
  executeTool(toolSpec: ToolSpecification, params: ToolParameters): Promise<ToolResult>;
  executeToolChain(toolChain: ToolCall[]): Promise<ToolChainResult>;
  
  // Tool discovery and management
  discoverTools(): Promise<ToolDefinition[]>;
  registerTool(tool: ToolDefinition): void;
  unregisterTool(toolName: string): void;
  getToolDefinition(toolName: string): ToolDefinition;
  
  // Tool orchestration
  orchestrateTools(orchestrationSpec: ToolOrchestrationSpec): Promise<OrchestrationResult>;
  validateToolChain(toolChain: ToolCall[]): ValidationResult;
  optimizeToolExecution(toolChain: ToolCall[]): OptimizedToolChain;
  
  // Resource management
  getToolStatus(executionId: string): ToolExecutionStatus;
  cancelToolExecution(executionId: string): boolean;
  cleanupToolResources(executionId: string): void;
  
  // Capabilities
  getCapabilities(): ToolContainerCapabilities;
}
```

### Input Types
```typescript
interface ToolExecutionRequest {
  operation: ToolOperation;
  specifications: ToolSpecification[];
  parameters: ToolParameters;
  orchestration?: ToolOrchestrationSpec;
  context: ToolExecutionContext;
  options: ToolExecutionOptions;
}

type ToolOperation = 'execute_single' | 'execute_chain' | 'orchestrate' | 'discover' | 'validate';

interface ToolSpecification {
  name: string;
  version?: string;
  type: ToolType;
  configuration: ToolConfiguration;
  inputSchema: any;
  outputSchema?: any;
  dependencies?: string[];
  metadata: ToolMetadata;
}

type ToolType = 'builtin' | 'mcp' | 'external' | 'composed' | 'pipeline';

interface ToolParameters {
  toolName: string;
  arguments: Record<string, any>;
  contextData?: Record<string, any>;
  executionHints?: ExecutionHints;
}

interface ToolExecutionContext {
  executionId: string;
  sessionId: string;
  userId?: string;
  projectContext?: ProjectContext;
  securityContext: SecurityContext;
  resourceLimits: ResourceLimits;
}
```

### Output Types
```typescript
interface ToolExecutionResult {
  operation: ToolOperation;
  status: ToolExecutionStatus;
  results: ToolResult[];
  orchestrationResult?: OrchestrationResult;
  metadata: ExecutionMetadata;
  errors?: ToolError[];
  warnings?: ToolWarning[];
}

interface ToolResult {
  toolName: string;
  executionId: string;
  status: 'success' | 'failure' | 'timeout' | 'cancelled';
  output: any;
  outputSchema?: any;
  metadata: ToolResultMetadata;
  duration: number;
  resourcesUsed: ResourceUsage;
  error?: ToolError;
}

interface ToolChainResult {
  chainId: string;
  overallStatus: 'success' | 'partial' | 'failure';
  results: ToolResult[];
  flow: ExecutionFlow;
  totalDuration: number;
  totalResourcesUsed: ResourceUsage;
}

type ToolExecutionStatus = 'pending' | 'running' | 'completed' | 'failed' | 'cancelled' | 'timeout';
```

## Tool Types and Categories

### Builtin Tools
```typescript
interface BuiltinToolDefinition extends ToolDefinition {
  type: 'builtin';
  implementation: BuiltinImplementation;
  category: BuiltinCategory;
  performance: PerformanceCharacteristics;
}

type BuiltinCategory = 'file_operations' | 'code_analysis' | 'text_processing' | 'data_manipulation' | 'system_utilities';

interface BuiltinImplementation {
  executor: string; // TypeScript function or class name
  runtime: 'nodejs' | 'wasm' | 'native';
  dependencies: string[];
  resourceRequirements: ResourceRequirements;
}

// Example builtin tools
const BUILTIN_TOOLS: BuiltinToolDefinition[] = [
  {
    name: 'edit_files',
    type: 'builtin',
    category: 'file_operations',
    implementation: {
      executor: 'FileEditTool',
      runtime: 'nodejs',
      dependencies: ['fs', 'path'],
      resourceRequirements: { memory: '50MB', disk: '100MB' }
    },
    inputSchema: {
      type: 'object',
      properties: {
        files: { type: 'array', items: { $ref: '#/FileEdit' } },
        validateChanges: { type: 'boolean', default: true }
      }
    }
  },
  {
    name: 'analyze_code',
    type: 'builtin', 
    category: 'code_analysis',
    implementation: {
      executor: 'CodeAnalysisTool',
      runtime: 'nodejs',
      dependencies: ['typescript', 'eslint', 'ast-parser'],
      resourceRequirements: { memory: '200MB', cpu: '50%' }
    }
  }
];
```

### MCP Tools
```typescript
interface MCPToolDefinition extends ToolDefinition {
  type: 'mcp';
  serverConfig: MCPServerConfig;
  protocolVersion: string;
  capabilities: MCPCapabilities;
}

interface MCPServerConfig {
  serverName: string;
  endpoint: string;
  connectionType: 'stdio' | 'http' | 'websocket';
  authentication?: AuthenticationConfig;
  timeout: number;
  retryPolicy: RetryPolicy;
}

interface MCPCapabilities {
  tools: MCPToolCapability[];
  resources: MCPResourceCapability[];
  prompts: MCPPromptCapability[];
}

interface MCPToolManager {
  // Server connection management
  connectToServer(config: MCPServerConfig): Promise<MCPConnection>;
  disconnectFromServer(serverName: string): Promise<void>;
  
  // Tool discovery and execution
  discoverServerTools(serverName: string): Promise<MCPToolDefinition[]>;
  executeServerTool(serverName: string, toolName: string, params: any): Promise<MCPToolResult>;
  
  // Resource management
  listServerResources(serverName: string): Promise<MCPResource[]>;
  readServerResource(serverName: string, resourceUri: string): Promise<MCPResourceContent>;
  
  // Protocol handling
  sendServerRequest(serverName: string, request: MCPRequest): Promise<MCPResponse>;
  handleServerNotification(serverName: string, notification: MCPNotification): void;
}
```

### External Tools
```typescript
interface ExternalToolDefinition extends ToolDefinition {
  type: 'external';
  endpointConfig: ExternalEndpointConfig;
  apiSpecification: APISpecification;
  securityConfig: SecurityConfiguration;
}

interface ExternalEndpointConfig {
  baseUrl: string;
  apiVersion: string;
  protocol: 'rest' | 'graphql' | 'grpc' | 'websocket';
  authentication: ExternalAuthConfig;
  rateLimit: RateLimitConfig;
  timeout: number;
}

interface APISpecification {
  openApiSpec?: string; // URL or inline OpenAPI spec
  graphqlSchema?: string;
  grpcProtoFile?: string;
  customSpec?: any;
}

interface ExternalToolManager {
  // API integration
  registerExternalAPI(config: ExternalEndpointConfig): Promise<void>;
  executeAPICall(toolName: string, endpoint: string, params: any): Promise<APIResponse>;
  
  // Schema validation
  validateAPIRequest(toolName: string, request: any): ValidationResult;
  validateAPIResponse(toolName: string, response: any): ValidationResult;
  
  // Error handling
  handleAPIError(error: APIError): ToolError;
  implementRetryLogic(request: APIRequest, retryPolicy: RetryPolicy): Promise<APIResponse>;
}
```

### Composed Tools
```typescript
interface ComposedToolDefinition extends ToolDefinition {
  type: 'composed';
  composition: ToolComposition;
  dependencies: string[];
  aggregationStrategy: AggregationStrategy;
}

interface ToolComposition {
  steps: CompositionStep[];
  flow: CompositionFlow;
  errorHandling: CompositionErrorHandling;
}

interface CompositionStep {
  id: string;
  toolName: string;
  parameters: ParameterMapping;
  condition?: ConditionExpression;
  parallel?: boolean;
  timeout?: number;
}

interface ParameterMapping {
  static: Record<string, any>;
  dynamic: Record<string, string>; // Maps to previous step outputs
  computed: Record<string, ComputationExpression>;
}

type AggregationStrategy = 'merge' | 'append' | 'override' | 'custom';

interface ComposedToolManager {
  // Composition management
  createComposition(definition: ComposedToolDefinition): Promise<void>;
  executeComposition(compositionName: string, params: any): Promise<CompositionResult>;
  
  // Flow control
  evaluateCondition(condition: ConditionExpression, context: any): boolean;
  executeParallelSteps(steps: CompositionStep[], context: any): Promise<StepResult[]>;
  
  // Result aggregation
  aggregateResults(results: StepResult[], strategy: AggregationStrategy): any;
  applyCustomAggregation(results: StepResult[], aggregator: CustomAggregator): any;
}
```

## Tool Orchestration

### Orchestration Engine
```typescript
interface ToolOrchestrationEngine {
  // Orchestration planning
  planExecution(spec: ToolOrchestrationSpec): ExecutionPlan;
  optimizeExecutionPlan(plan: ExecutionPlan): OptimizedExecutionPlan;
  
  // Execution management
  executeOrchestration(plan: ExecutionPlan): Promise<OrchestrationResult>;
  monitorExecution(executionId: string): ExecutionMonitor;
  
  // Resource optimization
  scheduleToolExecution(tools: ToolCall[], resources: AvailableResources): ExecutionSchedule;
  balanceResourceUsage(executions: ToolExecution[]): ResourceAllocation;
  
  // Failure handling
  handleToolFailure(failure: ToolFailure, plan: ExecutionPlan): RecoveryAction;
  implementCircuitBreaker(toolName: string, errorRate: number): void;
}

interface ToolOrchestrationSpec {
  name: string;
  tools: ToolCall[];
  flow: OrchestrationFlow;
  constraints: OrchestrationConstraints;
  errorHandling: ErrorHandlingStrategy;
  optimization: OptimizationPreferences;
}

interface OrchestrationFlow {
  type: 'sequential' | 'parallel' | 'conditional' | 'dag' | 'pipeline';
  dependencies: Record<string, string[]>;
  conditions: Record<string, ConditionExpression>;
  joinStrategy: 'all_success' | 'any_success' | 'majority' | 'custom';
}

interface OrchestrationConstraints {
  maxConcurrency: number;
  timeoutTotal: number;
  resourceLimits: ResourceLimits;
  securityConstraints: SecurityConstraints;
}
```

### Execution Strategies
```typescript
interface ExecutionStrategy {
  // Sequential execution
  executeSequential(tools: ToolCall[]): Promise<ToolResult[]>;
  
  // Parallel execution
  executeParallel(tools: ToolCall[], maxConcurrency: number): Promise<ToolResult[]>;
  
  // Conditional execution
  executeConditional(tools: ConditionalToolCall[]): Promise<ToolResult[]>;
  
  // Pipeline execution
  executePipeline(tools: PipelineToolCall[]): Promise<ToolResult[]>;
  
  // DAG execution
  executeDAG(dag: ToolDAG): Promise<ToolResult[]>;
}

interface ConditionalToolCall extends ToolCall {
  condition: ConditionExpression;
  elseAction?: ToolCall | 'skip' | 'fail';
}

interface PipelineToolCall extends ToolCall {
  outputTransform?: TransformFunction;
  inputMapping?: InputMapping;
}

interface ToolDAG {
  nodes: Record<string, ToolCall>;
  edges: DAGEdge[];
  entryPoints: string[];
  exitPoints: string[];
}
```

## Tool Security and Sandboxing

### Security Manager
```typescript
interface ToolSecurityManager {
  // Permission management
  validatePermissions(toolName: string, operation: string, context: SecurityContext): boolean;
  grantPermission(toolName: string, permission: Permission): void;
  revokePermission(toolName: string, permission: Permission): void;
  
  // Sandboxing
  createSandbox(toolName: string, config: SandboxConfig): Sandbox;
  executeTool(tool: ToolCall, sandbox: Sandbox): Promise<ToolResult>;
  destroySandbox(sandboxId: string): void;
  
  // Input validation
  validateInput(toolName: string, input: any): ValidationResult;
  sanitizeInput(toolName: string, input: any): any;
  
  // Output filtering
  filterOutput(toolName: string, output: any): any;
  validateOutput(toolName: string, output: any): ValidationResult;
}

interface SecurityContext {
  userId?: string;
  permissions: Permission[];
  restrictions: SecurityRestriction[];
  auditEnabled: boolean;
  isolationLevel: 'none' | 'basic' | 'strict' | 'paranoid';
}

interface Permission {
  resource: string;
  actions: string[];
  conditions?: PermissionCondition[];
  expiresAt?: Date;
}

interface SandboxConfig {
  type: 'process' | 'container' | 'vm' | 'wasm';
  resourceLimits: ResourceLimits;
  networkAccess: NetworkAccess;
  fileSystemAccess: FileSystemAccess;
  environmentVariables: Record<string, string>;
  timeLimit: number;
}
```

### Input/Output Validation
```typescript
interface ToolValidator {
  // Schema validation
  validateInputSchema(toolName: string, input: any): SchemaValidationResult;
  validateOutputSchema(toolName: string, output: any): SchemaValidationResult;
  
  // Content validation
  validateInputContent(toolName: string, input: any): ContentValidationResult;
  sanitizeInputContent(toolName: string, input: any): any;
  
  // Security validation
  checkSecurityViolations(toolName: string, input: any): SecurityViolation[];
  enforceSecurityPolicies(toolName: string, operation: string): void;
  
  // Business rule validation
  validateBusinessRules(toolName: string, input: any, context: BusinessContext): BusinessValidationResult;
  
  // Custom validation
  registerCustomValidator(toolName: string, validator: CustomValidator): void;
  executeCustomValidation(toolName: string, input: any): ValidationResult;
}

interface SecurityViolation {
  type: 'injection' | 'path_traversal' | 'privilege_escalation' | 'data_exfiltration';
  severity: 'low' | 'medium' | 'high' | 'critical';
  description: string;
  remediation: string;
}
```

## Tool Lifecycle Management

### Tool Registry
```typescript
interface ToolRegistry {
  // Registration
  registerTool(definition: ToolDefinition): Promise<void>;
  unregisterTool(toolName: string): Promise<void>;
  updateTool(toolName: string, definition: ToolDefinition): Promise<void>;
  
  // Discovery
  listTools(filter?: ToolFilter): ToolDefinition[];
  searchTools(query: ToolSearchQuery): ToolDefinition[];
  getToolDefinition(toolName: string): ToolDefinition;
  
  // Versioning
  getToolVersions(toolName: string): ToolVersion[];
  setActiveVersion(toolName: string, version: string): void;
  deprecateVersion(toolName: string, version: string): void;
  
  // Metadata management
  getToolMetadata(toolName: string): ToolMetadata;
  updateToolMetadata(toolName: string, metadata: Partial<ToolMetadata>): void;
  
  // Dependencies
  resolveDependencies(toolName: string): DependencyGraph;
  validateDependencies(toolName: string): DependencyValidationResult;
}

interface ToolFilter {
  type?: ToolType[];
  category?: string[];
  tags?: string[];
  capabilities?: string[];
  minVersion?: string;
  maxVersion?: string;
}

interface ToolSearchQuery {
  keywords: string[];
  fuzzyMatch: boolean;
  includeDescription: boolean;
  includeMetadata: boolean;
  rankBy: 'relevance' | 'popularity' | 'recent' | 'performance';
}

interface ToolMetadata {
  name: string;
  version: string;
  description: string;
  author: string;
  license: string;
  tags: string[];
  category: string;
  documentation: string;
  examples: ToolExample[];
  performance: PerformanceMetrics;
  usage: UsageStatistics;
  created: Date;
  lastModified: Date;
}
```

### Tool Installation and Updates
```typescript
interface ToolInstaller {
  // Installation
  installTool(source: ToolSource): Promise<InstallationResult>;
  uninstallTool(toolName: string): Promise<void>;
  
  // Updates
  checkForUpdates(toolName?: string): Promise<UpdateInfo[]>;
  updateTool(toolName: string, version?: string): Promise<UpdateResult>;
  
  // Package management
  installFromPackage(packagePath: string): Promise<InstallationResult>;
  createPackage(toolName: string, outputPath: string): Promise<void>;
  
  // Dependency management
  installDependencies(toolName: string): Promise<DependencyInstallationResult>;
  resolveDependencyConflicts(conflicts: DependencyConflict[]): Resolution[];
}

interface ToolSource {
  type: 'registry' | 'git' | 'local' | 'url';
  location: string;
  version?: string;
  authentication?: AuthConfig;
}

interface InstallationResult {
  success: boolean;
  toolName: string;
  version: string;
  dependencies: string[];
  warnings: string[];
  errors: InstallationError[];
}
```

## Performance and Monitoring

### Performance Optimization
```typescript
interface ToolPerformanceOptimizer {
  // Execution optimization
  optimizeToolExecution(toolName: string, params: any): OptimizationResult;
  cacheToolResults(toolName: string, params: any, result: ToolResult): void;
  
  // Resource optimization
  optimizeResourceUsage(tools: ToolCall[]): ResourceOptimization;
  balanceLoad(executions: ToolExecution[]): LoadBalancingResult;
  
  // Parallelization
  identifyParallelizableTools(tools: ToolCall[]): ParallelizationPlan;
  optimizeParallelExecution(plan: ParallelizationPlan): OptimizedParallelPlan;
  
  // Caching strategies
  implementResultCaching(toolName: string, strategy: CachingStrategy): void;
  invalidateCache(toolName: string, condition: CacheInvalidationCondition): void;
}

interface PerformanceMetrics {
  averageExecutionTime: number;
  medianExecutionTime: number;
  p95ExecutionTime: number;
  successRate: number;
  errorRate: number;
  resourceUtilization: ResourceUtilization;
  throughput: number;
  concurrency: number;
}

interface ToolMonitor {
  // Real-time monitoring
  startMonitoring(toolName: string): MonitoringSession;
  stopMonitoring(sessionId: string): void;
  
  // Metrics collection
  collectMetrics(toolName: string, duration?: string): PerformanceMetrics;
  getHistoricalMetrics(toolName: string, timeRange: TimeRange): HistoricalMetrics;
  
  // Alerting
  setAlert(toolName: string, condition: AlertCondition, action: AlertAction): void;
  removeAlert(alertId: string): void;
  
  // Health checks
  performHealthCheck(toolName: string): HealthCheckResult;
  scheduleHealthChecks(toolName: string, schedule: CronSchedule): void;
}
```

## Error Handling and Recovery

### Tool Error Management
```typescript
interface ToolErrorHandler {
  // Error classification
  classifyError(error: Error, context: ToolExecutionContext): ToolErrorClassification;
  
  // Recovery strategies
  recoverFromError(error: ToolError, strategy: RecoveryStrategy): Promise<RecoveryResult>;
  implementFallback(toolName: string, error: ToolError): Promise<ToolResult>;
  
  // Circuit breaker
  implementCircuitBreaker(toolName: string, config: CircuitBreakerConfig): void;
  getCircuitBreakerStatus(toolName: string): CircuitBreakerStatus;
  
  // Retry logic
  retryToolExecution(toolCall: ToolCall, retryPolicy: RetryPolicy): Promise<ToolResult>;
  calculateBackoffDelay(attempt: number, policy: BackoffPolicy): number;
}

interface ToolError extends Error {
  toolName: string;
  executionId: string;
  errorType: ToolErrorType;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
  context: ToolExecutionContext;
  originalError?: Error;
}

type ToolErrorType = 'execution' | 'validation' | 'timeout' | 'resource' | 'security' | 'network' | 'dependency';
type ErrorSeverity = 'low' | 'medium' | 'high' | 'critical';

interface RecoveryStrategy {
  type: 'retry' | 'fallback' | 'skip' | 'abort' | 'manual';
  maxAttempts?: number;
  fallbackTool?: string;
  escalationPolicy?: EscalationPolicy;
}
```

## Configuration

### Container Configuration
```typescript
interface ToolContainerConfig {
  // Execution settings
  maxConcurrentTools: number;
  defaultToolTimeout: number;
  enableToolCaching: boolean;
  
  // Security settings
  defaultSandboxType: SandboxType;
  enableInputValidation: boolean;
  enableOutputFiltering: boolean;
  
  // Performance settings
  enablePerformanceOptimization: boolean;
  cacheSize: number;
  resourceMonitoringEnabled: boolean;
  
  // Registry settings
  toolRegistryPath: string;
  enableAutoDiscovery: boolean;
  autoUpdateChecks: boolean;
  
  // Error handling
  defaultRetryPolicy: RetryPolicy;
  circuitBreakerEnabled: boolean;
  errorReportingEnabled: boolean;
  
  // Monitoring
  metricsCollectionEnabled: boolean;
  healthCheckInterval: number;
  performanceAlertsEnabled: boolean;
}
```

## Testing Contract

### Unit Tests
```typescript
describe('ToolContainer', () => {
  describe('tool execution', () => {
    it('should execute builtin tools correctly');
    it('should execute MCP tools correctly');
    it('should execute external tools correctly');
    it('should execute composed tools correctly');
    it('should handle tool chaining correctly');
  });
  
  describe('tool orchestration', () => {
    it('should orchestrate sequential tool execution');
    it('should orchestrate parallel tool execution');
    it('should handle conditional tool execution');
    it('should execute DAG-based tool flows');
  });
  
  describe('security and sandboxing', () => {
    it('should enforce security permissions');
    it('should sandbox tool execution');
    it('should validate input and sanitize output');
    it('should detect and prevent security violations');
  });
  
  describe('performance and monitoring', () => {
    it('should optimize tool execution performance');
    it('should implement result caching');
    it('should monitor tool performance metrics');
    it('should handle resource optimization');
  });
});
```

### Integration Tests
```typescript
describe('ToolContainer Integration', () => {
  it('should integrate with MCP servers');
  it('should connect to external APIs');
  it('should receive requests from Smart Router');
  it('should send results to Workflow Executor');
  it('should maintain performance under load');
  it('should handle concurrent tool executions');
});
```

The Tool Container serves as the **Tool Box** in the **Agent = Tool Box + WE + LLM** model, providing comprehensive tool execution capabilities independent of workflow logic, enabling maximum reusability and optimal performance across the entire agent system.