# Command Router Component Interface

## Overview

The Command Router Component is responsible for analyzing parsed commands and routing them to appropriate handlers based on command type and complexity. It serves as the central dispatcher in the CLI Container's command processing pipeline.

## Component Responsibilities

- **Command Classification**: Determine command type (static, interactive, workflow)
- **Handler Selection**: Route commands to appropriate specialized handlers
- **Lifecycle Management**: Manage command execution lifecycle and state
- **Error Routing**: Direct errors to appropriate error handlers
- **Performance Monitoring**: Track routing decisions and execution metrics

## Public Interface

### ICommandRouter

```typescript
interface ICommandRouter {
  /**
   * Initialize the router with handler registrations
   * @param config Router configuration
   */
  initialize(config: CommandRouterConfig): Promise<void>;
  
  /**
   * Route parsed command to appropriate handler
   * @param command Parsed command to route
   * @param context Execution context
   * @returns Command execution result
   */
  route(command: ParsedCommand, context: ExecutionContext): Promise<CommandResult>;
  
  /**
   * Register command handler for specific command types
   * @param type Command type to handle
   * @param handler Handler implementation
   */
  registerHandler(type: CommandType, handler: ICommandHandler): void;
  
  /**
   * Get available command types
   * @returns List of supported command types
   */
  getSupportedTypes(): CommandType[];
  
  /**
   * Get routing statistics and metrics
   * @returns Routing performance metrics
   */
  getRoutingMetrics(): RoutingMetrics;
  
  /**
   * Shutdown router and cleanup resources
   */
  shutdown(): Promise<void>;
}
```

## Data Contracts

### Command Types

```typescript
enum CommandType {
  STATIC = 'static',
  INTERACTIVE = 'interactive', 
  WORKFLOW = 'workflow',
  UNKNOWN = 'unknown'
}

interface CommandClassification {
  /**
   * Determined command type
   */
  type: CommandType;
  
  /**
   * Classification confidence (0-1)
   */
  confidence: number;
  
  /**
   * Reasoning for classification
   */
  reasoning: string;
  
  /**
   * Alternative classifications considered
   */
  alternatives: ClassificationAlternative[];
}

interface ClassificationAlternative {
  /**
   * Alternative command type
   */
  type: CommandType;
  
  /**
   * Confidence score for alternative
   */
  confidence: number;
  
  /**
   * Reason why this wasn't chosen
   */
  reason: string;
}
```

### Execution Context

```typescript
interface ExecutionContext {
  /**
   * Unique execution ID
   */
  executionId: string;
  
  /**
   * User session information
   */
  session: SessionInfo;
  
  /**
   * Environment variables
   */
  environment: Record<string, string>;
  
  /**
   * Current working directory
   */
  cwd: string;
  
  /**
   * Execution start time
   */
  startTime: Date;
  
  /**
   * Parent command (for nested commands)
   */
  parentCommand?: ParsedCommand;
  
  /**
   * Execution flags and options
   */
  flags: ExecutionFlags;
}

interface SessionInfo {
  /**
   * Session ID
   */
  sessionId: string;
  
  /**
   * User identification
   */
  userId?: string;
  
  /**
   * Session start time
   */
  startTime: Date;
  
  /**
   * Session metadata
   */
  metadata: Record<string, any>;
}

interface ExecutionFlags {
  /**
   * Whether to run in dry-run mode
   */
  dryRun: boolean;
  
  /**
   * Whether to force execution
   */
  force: boolean;
  
  /**
   * Verbosity level
   */
  verbose: number;
  
  /**
   * Whether to run in interactive mode
   */
  interactive: boolean;
  
  /**
   * Timeout for execution (ms)
   */
  timeout?: number;
}
```

### Command Result

```typescript
interface CommandResult {
  /**
   * Execution success status
   */
  success: boolean;
  
  /**
   * Exit code
   */
  exitCode: number;
  
  /**
   * Command output data
   */
  output: CommandOutput;
  
  /**
   * Execution metrics
   */
  metrics: ExecutionMetrics;
  
  /**
   * Any errors that occurred
   */
  errors: CommandError[];
  
  /**
   * Execution context
   */
  context: ExecutionContext;
  
  /**
   * Follow-up actions needed
   */
  followUpActions: FollowUpAction[];
}

interface CommandOutput {
  /**
   * Standard output content
   */
  stdout: string;
  
  /**
   * Standard error content
   */
  stderr: string;
  
  /**
   * Structured data output
   */
  data?: any;
  
  /**
   * Output format
   */
  format: OutputFormat;
  
  /**
   * Output metadata
   */
  metadata: OutputMetadata;
}

enum OutputFormat {
  TEXT = 'text',
  JSON = 'json',
  TABLE = 'table',
  STREAM = 'stream'
}

interface OutputMetadata {
  /**
   * Output size in bytes
   */
  size: number;
  
  /**
   * Output generation time
   */
  generatedAt: Date;
  
  /**
   * Content encoding
   */
  encoding: string;
  
  /**
   * Additional metadata
   */
  [key: string]: any;
}

interface ExecutionMetrics {
  /**
   * Total execution time (ms)
   */
  duration: number;
  
  /**
   * Time spent in routing (ms)
   */
  routingTime: number;
  
  /**
   * Time spent in handler execution (ms)
   */
  executionTime: number;
  
  /**
   * Memory usage during execution
   */
  memoryUsage: MemoryUsage;
  
  /**
   * CPU usage statistics
   */
  cpuUsage: CPUUsage;
}

interface MemoryUsage {
  /**
   * Peak memory usage (bytes)
   */
  peak: number;
  
  /**
   * Average memory usage (bytes)
   */
  average: number;
  
  /**
   * Final memory usage (bytes)
   */
  final: number;
}

interface CPUUsage {
  /**
   * User CPU time (ms)
   */
  user: number;
  
  /**
   * System CPU time (ms)
   */
  system: number;
  
  /**
   * Total CPU time (ms)
   */
  total: number;
}

interface FollowUpAction {
  /**
   * Action type
   */
  type: ActionType;
  
  /**
   * Action description
   */
  description: string;
  
  /**
   * Action parameters
   */
  parameters: Record<string, any>;
  
  /**
   * Whether action is required
   */
  required: boolean;
}

enum ActionType {
  RESTART_SESSION = 'restart_session',
  RELOAD_CONFIG = 'reload_config',
  CLEANUP_RESOURCES = 'cleanup_resources',
  SHOW_HELP = 'show_help',
  RETRY_COMMAND = 'retry_command'
}
```

### Command Handler Interface

```typescript
interface ICommandHandler {
  /**
   * Handle command execution
   * @param command Parsed command to execute
   * @param context Execution context
   * @returns Command execution result
   */
  handle(command: ParsedCommand, context: ExecutionContext): Promise<CommandResult>;
  
  /**
   * Check if handler can process this command
   * @param command Command to check
   * @returns Whether handler supports this command
   */
  canHandle(command: ParsedCommand): boolean;
  
  /**
   * Get handler priority for command type conflicts
   * @returns Handler priority (higher = preferred)
   */
  getPriority(): number;
  
  /**
   * Get handler metadata
   * @returns Handler information
   */
  getMetadata(): HandlerMetadata;
}

interface HandlerMetadata {
  /**
   * Handler name
   */
  name: string;
  
  /**
   * Handler version
   */
  version: string;
  
  /**
   * Supported command types
   */
  supportedTypes: CommandType[];
  
  /**
   * Handler description
   */
  description: string;
  
  /**
   * Handler capabilities
   */
  capabilities: HandlerCapability[];
}

enum HandlerCapability {
  STREAMING_OUTPUT = 'streaming_output',
  BACKGROUND_EXECUTION = 'background_execution',
  INTERACTIVE_INPUT = 'interactive_input',
  FILE_OPERATIONS = 'file_operations',
  NETWORK_ACCESS = 'network_access'
}
```

## Configuration Contract

### CommandRouterConfig

```typescript
interface CommandRouterConfig {
  /**
   * Routing behavior settings
   */
  routing: RoutingBehavior;
  
  /**
   * Handler configuration
   */
  handlers: HandlerConfig;
  
  /**
   * Performance settings
   */
  performance: PerformanceConfig;
  
  /**
   * Error handling configuration
   */
  errorHandling: ErrorHandlingConfig;
  
  /**
   * Monitoring and metrics
   */
  monitoring: MonitoringConfig;
}

interface RoutingBehavior {
  /**
   * Default command type for unknown commands
   */
  defaultType: CommandType;
  
  /**
   * Classification confidence threshold
   */
  confidenceThreshold: number;
  
  /**
   * Whether to allow fallback to alternative handlers
   */
  allowFallback: boolean;
  
  /**
   * Maximum routing time before timeout (ms)
   */
  routingTimeout: number;
  
  /**
   * Whether to cache routing decisions
   */
  enableCaching: boolean;
}

interface HandlerConfig {
  /**
   * Static command handler configuration
   */
  static: StaticHandlerConfig;
  
  /**
   * Interactive command handler configuration
   */
  interactive: InteractiveHandlerConfig;
  
  /**
   * Workflow command handler configuration
   */
  workflow: WorkflowHandlerConfig;
  
  /**
   * Custom handler registrations
   */
  custom: CustomHandlerConfig[];
}

interface StaticHandlerConfig {
  /**
   * Whether static handler is enabled
   */
  enabled: boolean;
  
  /**
   * Static command patterns
   */
  patterns: string[];
  
  /**
   * Maximum execution time (ms)
   */
  maxExecutionTime: number;
}

interface InteractiveHandlerConfig {
  /**
   * Whether interactive handler is enabled
   */
  enabled: boolean;
  
  /**
   * Session timeout (ms)
   */
  sessionTimeout: number;
  
  /**
   * Maximum concurrent sessions
   */
  maxSessions: number;
}

interface WorkflowHandlerConfig {
  /**
   * Whether workflow handler is enabled
   */
  enabled: boolean;
  
  /**
   * Workflow directory path
   */
  workflowDirectory: string;
  
  /**
   * Maximum workflow execution time (ms)
   */
  maxExecutionTime: number;
}

interface CustomHandlerConfig {
  /**
   * Handler name
   */
  name: string;
  
  /**
   * Handler module path
   */
  modulePath: string;
  
  /**
   * Handler configuration
   */
  config: Record<string, any>;
  
  /**
   * Handler priority
   */
  priority: number;
}

interface PerformanceConfig {
  /**
   * Maximum concurrent command executions
   */
  maxConcurrentCommands: number;
  
  /**
   * Command execution queue size
   */
  queueSize: number;
  
  /**
   * Resource monitoring interval (ms)
   */
  monitoringInterval: number;
  
  /**
   * Memory limit per command (bytes)
   */
  memoryLimit: number;
}

interface ErrorHandlingConfig {
  /**
   * Error retry attempts
   */
  retryAttempts: number;
  
  /**
   * Retry delay (ms)
   */
  retryDelay: number;
  
  /**
   * Whether to show detailed error information
   */
  showDetailedErrors: boolean;
  
  /**
   * Error reporting configuration
   */
  reporting: ErrorReportingConfig;
}

interface ErrorReportingConfig {
  /**
   * Whether to enable error reporting
   */
  enabled: boolean;
  
  /**
   * Error log file path
   */
  logFile: string;
  
  /**
   * Log level
   */
  logLevel: LogLevel;
}

enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error'
}

interface MonitoringConfig {
  /**
   * Whether to enable metrics collection
   */
  enabled: boolean;
  
  /**
   * Metrics collection interval (ms)
   */
  interval: number;
  
  /**
   * Metrics retention period (ms)
   */
  retentionPeriod: number;
  
  /**
   * Performance threshold alerts
   */
  thresholds: PerformanceThresholds;
}

interface PerformanceThresholds {
  /**
   * Maximum routing time before alert (ms)
   */
  maxRoutingTime: number;
  
  /**
   * Maximum execution time before alert (ms)
   */
  maxExecutionTime: number;
  
  /**
   * Maximum memory usage before alert (bytes)
   */
  maxMemoryUsage: number;
  
  /**
   * Maximum queue size before alert
   */
  maxQueueSize: number;
}
```

## Implementation Strategies

### Strategy Pattern Implementation

```typescript
class CommandRouter implements ICommandRouter {
  private handlers: Map<CommandType, ICommandHandler>;
  private classifier: ICommandClassifier;
  private config: CommandRouterConfig;
  private metrics: RoutingMetrics;
  
  constructor(config: CommandRouterConfig) {
    this.config = config;
    this.handlers = new Map();
    this.metrics = new RoutingMetrics();
    this.classifier = new CommandClassifier(config.routing);
  }
  
  async route(command: ParsedCommand, context: ExecutionContext): Promise<CommandResult> {
    const startTime = Date.now();
    
    try {
      // Classify command type
      const classification = await this.classifier.classify(command);
      
      // Update metrics
      this.metrics.recordClassification(classification);
      
      // Get appropriate handler
      const handler = this.getHandler(classification.type);
      
      if (!handler) {
        throw new RoutingError(`No handler found for command type: ${classification.type}`);
      }
      
      // Execute command
      const result = await handler.handle(command, context);
      
      // Record execution metrics
      const duration = Date.now() - startTime;
      this.metrics.recordExecution(classification.type, duration, result.success);
      
      return result;
    } catch (error) {
      this.metrics.recordError(error);
      throw error;
    }
  }
  
  private getHandler(type: CommandType): ICommandHandler | null {
    return this.handlers.get(type) || null;
  }
  
  registerHandler(type: CommandType, handler: ICommandHandler): void {
    if (!handler.canHandle({ command: '', options: {}, args: [], raw: [], metadata: {} as any })) {
      throw new Error(`Handler cannot handle command type: ${type}`);
    }
    
    this.handlers.set(type, handler);
  }
}
```

### Command Classification

```typescript
interface ICommandClassifier {
  /**
   * Classify command to determine routing
   */
  classify(command: ParsedCommand): Promise<CommandClassification>;
}

class CommandClassifier implements ICommandClassifier {
  private rules: ClassificationRule[];
  
  async classify(command: ParsedCommand): Promise<CommandClassification> {
    const scores = new Map<CommandType, number>();
    
    for (const rule of this.rules) {
      const score = rule.evaluate(command);
      const currentScore = scores.get(rule.targetType) || 0;
      scores.set(rule.targetType, Math.max(currentScore, score));
    }
    
    // Find highest scoring type
    let bestType = CommandType.UNKNOWN;
    let bestScore = 0;
    
    for (const [type, score] of scores) {
      if (score > bestScore) {
        bestType = type;
        bestScore = score;
      }
    }
    
    return {
      type: bestType,
      confidence: bestScore,
      reasoning: `Matched ${bestType} pattern with ${bestScore} confidence`,
      alternatives: this.getAlternatives(scores, bestType)
    };
  }
  
  private getAlternatives(scores: Map<CommandType, number>, chosen: CommandType): ClassificationAlternative[] {
    return Array.from(scores.entries())
      .filter(([type, _]) => type !== chosen)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 2)
      .map(([type, score]) => ({
        type,
        confidence: score,
        reason: `Lower confidence score: ${score}`
      }));
  }
}

interface ClassificationRule {
  targetType: CommandType;
  evaluate(command: ParsedCommand): number;
}

class StaticCommandRule implements ClassificationRule {
  targetType = CommandType.STATIC;
  
  evaluate(command: ParsedCommand): number {
    const staticCommands = ['config', 'servers', 'help', 'version'];
    return staticCommands.includes(command.command) ? 0.9 : 0.0;
  }
}

class InteractiveCommandRule implements ClassificationRule {
  targetType = CommandType.INTERACTIVE;
  
  evaluate(command: ParsedCommand): number {
    const interactiveCommands = ['chat', 'unified'];
    return interactiveCommands.includes(command.command) ? 0.9 : 0.0;
  }
}

class WorkflowCommandRule implements ClassificationRule {
  targetType = CommandType.WORKFLOW;
  
  evaluate(command: ParsedCommand): number {
    const workflowCommands = ['edit', 'analyze', 'fix'];
    const hasWorkflowArgs = command.args.length > 0;
    
    if (workflowCommands.includes(command.command) && hasWorkflowArgs) {
      return 0.85;
    }
    
    return 0.0;
  }
}
```

## Error Handling

### Routing Errors

```typescript
enum RoutingErrorCode {
  NO_HANDLER_FOUND = 'NO_HANDLER_FOUND',
  CLASSIFICATION_FAILED = 'CLASSIFICATION_FAILED',
  HANDLER_EXECUTION_FAILED = 'HANDLER_EXECUTION_FAILED',
  TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED',
  RESOURCE_EXHAUSTED = 'RESOURCE_EXHAUSTED'
}

class RoutingError extends Error {
  constructor(
    message: string,
    public code: RoutingErrorCode,
    public command?: ParsedCommand,
    public cause?: Error
  ) {
    super(message);
    this.name = 'RoutingError';
  }
}

interface IRoutingErrorHandler {
  /**
   * Handle routing errors
   */
  handleError(error: RoutingError, context: ExecutionContext): Promise<CommandResult>;
  
  /**
   * Determine if error is recoverable
   */
  isRecoverable(error: RoutingError): boolean;
}

class RoutingErrorHandler implements IRoutingErrorHandler {
  async handleError(error: RoutingError, context: ExecutionContext): Promise<CommandResult> {
    switch (error.code) {
      case RoutingErrorCode.NO_HANDLER_FOUND:
        return this.handleNoHandlerFound(error, context);
      case RoutingErrorCode.TIMEOUT_EXCEEDED:
        return this.handleTimeoutExceeded(error, context);
      default:
        return this.handleGenericError(error, context);
    }
  }
  
  private async handleNoHandlerFound(error: RoutingError, context: ExecutionContext): Promise<CommandResult> {
    return {
      success: false,
      exitCode: 1,
      output: {
        stdout: '',
        stderr: `Unknown command: ${error.command?.command}`,
        format: OutputFormat.TEXT,
        metadata: { size: 0, generatedAt: new Date(), encoding: 'utf-8' }
      },
      metrics: { duration: 0, routingTime: 0, executionTime: 0, memoryUsage: { peak: 0, average: 0, final: 0 }, cpuUsage: { user: 0, system: 0, total: 0 } },
      errors: [{ code: RoutingErrorCode.NO_HANDLER_FOUND, message: error.message, severity: ErrorSeverity.ERROR }],
      context,
      followUpActions: [
        {
          type: ActionType.SHOW_HELP,
          description: 'Show available commands',
          parameters: {},
          required: true
        }
      ]
    };
  }
}
```

### Performance Requirements

- **Routing Time**: <10ms for command classification
- **Handler Resolution**: <5ms for handler lookup
- **Memory Usage**: <2MB for routing state
- **Concurrent Commands**: Support 10+ concurrent executions

## Testing Contract

### Testable Behaviors

```typescript
interface CommandRouterTestSuite {
  /**
   * Test command classification
   */
  testClassification(testCases: ClassificationTestCase[]): TestResults;
  
  /**
   * Test handler routing
   */
  testHandlerRouting(testCases: RoutingTestCase[]): TestResults;
  
  /**
   * Test error handling
   */
  testErrorHandling(testCases: ErrorTestCase[]): TestResults;
  
  /**
   * Test performance metrics
   */
  testPerformanceMetrics(testCases: PerformanceTestCase[]): TestResults;
}

interface ClassificationTestCase {
  name: string;
  command: ParsedCommand;
  expectedType: CommandType;
  expectedConfidence: number;
  description: string;
}

interface RoutingTestCase {
  name: string;
  command: ParsedCommand;
  context: ExecutionContext;
  expectedHandler: string;
  expectedResult: Partial<CommandResult>;
}
```

This Command Router component serves as the intelligent dispatcher that ensures commands reach the right handlers based on their type and complexity, providing comprehensive error handling, performance monitoring, and extensibility for future command types.