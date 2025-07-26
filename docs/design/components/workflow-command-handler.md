# Workflow Command Handler Component Interface

## Overview

The Workflow Command Handler Component executes predefined workflows with pre-loaded messages and automatic tool triggering. It handles complex development tasks like file editing, code analysis, and project automation through structured workflow templates and intelligent tool orchestration.

## Component Responsibilities

- **Workflow Execution**: Load and execute predefined workflow templates
- **Message Pre-processing**: Process workflow parameters and generate contextual messages
- **Automatic Tool Triggering**: Intelligently invoke tools based on workflow requirements
- **Template Management**: Load, validate, and manage workflow templates
- **Progress Tracking**: Monitor workflow execution progress and provide status updates

## Public Interface

### IWorkflowCommandHandler

```typescript
interface IWorkflowCommandHandler extends ICommandHandler {
  /**
   * Initialize workflow command handler
   * @param config Handler configuration
   */
  initialize(config: WorkflowHandlerConfig): Promise<void>;
  
  /**
   * Execute workflow command
   * @param command Parsed workflow command
   * @param context Execution context
   * @returns Workflow execution result
   */
  executeWorkflow(command: ParsedCommand, context: ExecutionContext): Promise<WorkflowResult>;
  
  /**
   * Load workflow template
   * @param templateName Template identifier
   * @returns Loaded workflow template
   */
  loadTemplate(templateName: string): Promise<WorkflowTemplate>;
  
  /**
   * Get available workflow templates
   * @returns List of available templates
   */
  getAvailableTemplates(): WorkflowTemplateInfo[];
  
  /**
   * Validate workflow template
   * @param template Template to validate
   * @returns Validation result
   */
  validateTemplate(template: WorkflowTemplate): TemplateValidationResult;
  
  /**
   * Register custom workflow template
   * @param template Template to register
   */
  registerTemplate(template: WorkflowTemplate): Promise<void>;
  
  /**
   * Get workflow execution status
   * @param executionId Execution identifier
   * @returns Current execution status
   */
  getExecutionStatus(executionId: string): WorkflowExecutionStatus;
  
  /**
   * Cancel running workflow
   * @param executionId Execution to cancel
   */
  cancelExecution(executionId: string): Promise<void>;
}
```

## Data Contracts

### Workflow Templates

```typescript
interface WorkflowTemplate {
  /**
   * Template metadata
   */
  metadata: WorkflowTemplateMetadata;
  
  /**
   * Workflow definition
   */
  definition: WorkflowDefinition;
  
  /**
   * Template parameters
   */
  parameters: ParameterDefinition[];
  
  /**
   * Template validation rules
   */
  validation: TemplateValidationRules;
  
  /**
   * Template examples
   */
  examples: WorkflowExample[];
}

interface WorkflowTemplateMetadata {
  /**
   * Template name
   */
  name: string;
  
  /**
   * Template version
   */
  version: string;
  
  /**
   * Template description
   */
  description: string;
  
  /**
   * Template author
   */
  author: string;
  
  /**
   * Creation date
   */
  createdAt: Date;
  
  /**
   * Last modified date
   */
  modifiedAt: Date;
  
  /**
   * Template tags
   */
  tags: string[];
  
  /**
   * Template category
   */
  category: WorkflowCategory;
  
  /**
   * Complexity level
   */
  complexity: ComplexityLevel;
}

enum WorkflowCategory {
  FILE_OPERATIONS = 'file_operations',
  CODE_ANALYSIS = 'code_analysis',
  PROJECT_SETUP = 'project_setup',
  DOCUMENTATION = 'documentation',
  TESTING = 'testing',
  DEBUGGING = 'debugging',
  REFACTORING = 'refactoring',
  DEPLOYMENT = 'deployment'
}

enum ComplexityLevel {
  SIMPLE = 'simple',
  MODERATE = 'moderate',
  COMPLEX = 'complex',
  ADVANCED = 'advanced'
}

interface WorkflowDefinition {
  /**
   * Workflow steps
   */
  steps: WorkflowStep[];
  
  /**
   * Step dependencies
   */
  dependencies: StepDependency[];
  
  /**
   * Error handling strategy
   */
  errorHandling: ErrorHandlingStrategy;
  
  /**
   * Workflow timeout (ms)
   */
  timeout: number;
  
  /**
   * Rollback configuration
   */
  rollback: RollbackConfig;
}

interface WorkflowStep {
  /**
   * Step identifier
   */
  id: string;
  
  /**
   * Step name
   */
  name: string;
  
  /**
   * Step description
   */
  description: string;
  
  /**
   * Step type
   */
  type: StepType;
  
  /**
   * Step configuration
   */
  config: StepConfig;
  
  /**
   * Success criteria
   */
  successCriteria: SuccessCriteria;
  
  /**
   * Retry configuration
   */
  retry: RetryConfig;
  
  /**
   * Step timeout (ms)
   */
  timeout: number;
}

enum StepType {
  MESSAGE_GENERATION = 'message_generation',
  TOOL_EXECUTION = 'tool_execution',
  FILE_OPERATION = 'file_operation',
  VALIDATION = 'validation',
  CONDITIONAL = 'conditional',
  PARALLEL = 'parallel',
  LOOP = 'loop'
}

interface StepConfig {
  /**
   * Step-specific configuration
   */
  [key: string]: any;
}

interface MessageGenerationConfig extends StepConfig {
  /**
   * Message template
   */
  template: string;
  
  /**
   * Template variables
   */
  variables: Record<string, any>;
  
  /**
   * Context requirements
   */
  contextRequirements: ContextRequirement[];
}

interface ToolExecutionConfig extends StepConfig {
  /**
   * Tool name
   */
  toolName: string;
  
  /**
   * Tool parameters
   */
  parameters: Record<string, any>;
  
  /**
   * Parameter mappings from previous steps
   */
  parameterMappings: ParameterMapping[];
  
  /**
   * Expected output schema
   */
  outputSchema: any;
}

interface FileOperationConfig extends StepConfig {
  /**
   * Operation type
   */
  operation: FileOperationType;
  
  /**
   * File paths (supports patterns)
   */
  paths: string[];
  
  /**
   * Operation parameters
   */
  parameters: Record<string, any>;
}

enum FileOperationType {
  READ = 'read',
  WRITE = 'write',
  CREATE = 'create',
  DELETE = 'delete',
  COPY = 'copy',
  MOVE = 'move',
  BACKUP = 'backup'
}

interface SuccessCriteria {
  /**
   * Success conditions
   */
  conditions: SuccessCondition[];
  
  /**
   * Whether all conditions must be met
   */
  requireAll: boolean;
}

interface SuccessCondition {
  /**
   * Condition type
   */
  type: ConditionType;
  
  /**
   * Condition expression
   */
  expression: string;
  
  /**
   * Expected value
   */
  expectedValue: any;
  
  /**
   * Comparison operator
   */
  operator: ComparisonOperator;
}

enum ConditionType {
  OUTPUT_CONTAINS = 'output_contains',
  OUTPUT_MATCHES = 'output_matches',
  FILE_EXISTS = 'file_exists',
  FILE_CONTAINS = 'file_contains',
  VARIABLE_EQUALS = 'variable_equals',
  EXECUTION_TIME = 'execution_time'
}

enum ComparisonOperator {
  EQUALS = 'equals',
  NOT_EQUALS = 'not_equals',
  CONTAINS = 'contains',
  NOT_CONTAINS = 'not_contains',
  MATCHES = 'matches',
  GREATER_THAN = 'greater_than',
  LESS_THAN = 'less_than'
}

interface StepDependency {
  /**
   * Dependent step ID
   */
  stepId: string;
  
  /**
   * Required step IDs
   */
  dependsOn: string[];
  
  /**
   * Dependency type
   */
  type: DependencyType;
}

enum DependencyType {
  SEQUENTIAL = 'sequential',
  DATA = 'data',
  CONDITIONAL = 'conditional'
}

interface ParameterDefinition {
  /**
   * Parameter name
   */
  name: string;
  
  /**
   * Parameter description
   */
  description: string;
  
  /**
   * Parameter type
   */
  type: ParameterType;
  
  /**
   * Whether parameter is required
   */
  required: boolean;
  
  /**
   * Default value
   */
  defaultValue?: any;
  
  /**
   * Parameter validation
   */
  validation: ParameterValidation;
  
  /**
   * Parameter examples
   */
  examples: string[];
}

enum ParameterType {
  STRING = 'string',
  NUMBER = 'number',
  BOOLEAN = 'boolean',
  FILE_PATH = 'file_path',
  DIRECTORY_PATH = 'directory_path',
  ARRAY = 'array',
  OBJECT = 'object'
}

interface ParameterValidation {
  /**
   * Validation rules
   */
  rules: ValidationRule[];
  
  /**
   * Custom validation function
   */
  customValidator?: string;
}

interface ValidationRule {
  /**
   * Rule type
   */
  type: ValidationRuleType;
  
  /**
   * Rule configuration
   */
  config: Record<string, any>;
  
  /**
   * Error message
   */
  errorMessage: string;
}

enum ValidationRuleType {
  MIN_LENGTH = 'min_length',
  MAX_LENGTH = 'max_length',
  PATTERN = 'pattern',
  MIN_VALUE = 'min_value',
  MAX_VALUE = 'max_value',
  ENUM = 'enum',
  FILE_EXISTS = 'file_exists',
  DIRECTORY_EXISTS = 'directory_exists'
}
```

### Workflow Execution

```typescript
interface WorkflowResult extends CommandResult {
  /**
   * Workflow execution data
   */
  workflowData: WorkflowExecutionData;
  
  /**
   * Step results
   */
  stepResults: StepResult[];
  
  /**
   * Workflow artifacts
   */
  artifacts: WorkflowArtifact[];
}

interface WorkflowExecutionData {
  /**
   * Execution identifier
   */
  executionId: string;
  
  /**
   * Template used
   */
  template: WorkflowTemplateMetadata;
  
  /**
   * Execution parameters
   */
  parameters: Record<string, any>;
  
  /**
   * Execution status
   */
  status: WorkflowExecutionStatus;
  
  /**
   * Execution timeline
   */
  timeline: WorkflowTimeline;
  
  /**
   * Resource usage
   */
  resourceUsage: WorkflowResourceUsage;
}

enum WorkflowExecutionStatus {
  INITIALIZING = 'initializing',
  RUNNING = 'running',
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
  ROLLED_BACK = 'rolled_back'
}

interface WorkflowTimeline {
  /**
   * Workflow start time
   */
  startTime: Date;
  
  /**
   * Workflow end time
   */
  endTime?: Date;
  
  /**
   * Step execution timeline
   */
  stepTimeline: StepTimelineEntry[];
  
  /**
   * Total execution duration (ms)
   */
  totalDuration?: number;
}

interface StepTimelineEntry {
  /**
   * Step ID
   */
  stepId: string;
  
  /**
   * Step start time
   */
  startTime: Date;
  
  /**
   * Step end time
   */
  endTime?: Date;
  
  /**
   * Step duration (ms)
   */
  duration?: number;
  
  /**
   * Step status
   */
  status: StepExecutionStatus;
}

enum StepExecutionStatus {
  PENDING = 'pending',
  RUNNING = 'running',
  COMPLETED = 'completed',
  FAILED = 'failed',
  SKIPPED = 'skipped',
  RETRYING = 'retrying'
}

interface StepResult {
  /**
   * Step identifier
   */
  stepId: string;
  
  /**
   * Execution status
   */
  status: StepExecutionStatus;
  
  /**
   * Step output
   */
  output: any;
  
  /**
   * Step errors
   */
  errors: StepError[];
  
  /**
   * Step metrics
   */
  metrics: StepMetrics;
  
  /**
   * Generated artifacts
   */
  artifacts: string[];
}

interface StepError {
  /**
   * Error code
   */
  code: string;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error details
   */
  details: any;
  
  /**
   * Error timestamp
   */
  timestamp: Date;
  
  /**
   * Whether error is recoverable
   */
  recoverable: boolean;
}

interface StepMetrics {
  /**
   * Execution time (ms)
   */
  executionTime: number;
  
  /**
   * Memory usage during step
   */
  memoryUsage: number;
  
  /**
   * CPU usage during step
   */
  cpuUsage: number;
  
  /**
   * Network requests made
   */
  networkRequests: number;
  
  /**
   * Files accessed
   */
  filesAccessed: number;
}

interface WorkflowArtifact {
  /**
   * Artifact identifier
   */
  id: string;
  
  /**
   * Artifact name
   */
  name: string;
  
  /**
   * Artifact type
   */
  type: ArtifactType;
  
  /**
   * Artifact location
   */
  location: string;
  
  /**
   * Artifact size (bytes)
   */
  size: number;
  
  /**
   * Creation time
   */
  createdAt: Date;
  
  /**
   * Step that created artifact
   */
  createdBy: string;
  
  /**
   * Artifact metadata
   */
  metadata: Record<string, any>;
}

enum ArtifactType {
  FILE = 'file',
  DIRECTORY = 'directory',
  LOG = 'log',
  REPORT = 'report',
  BACKUP = 'backup',
  CONFIGURATION = 'configuration'
}

interface WorkflowResourceUsage {
  /**
   * Peak memory usage (bytes)
   */
  peakMemoryUsage: number;
  
  /**
   * Total CPU time (ms)
   */
  totalCpuTime: number;
  
  /**
   * Network data transferred (bytes)
   */
  networkTransfer: number;
  
  /**
   * Disk operations count
   */
  diskOperations: number;
  
  /**
   * Files created/modified
   */
  filesModified: number;
}
```

### Workflow Management

```typescript
interface WorkflowTemplateInfo {
  /**
   * Template metadata
   */
  metadata: WorkflowTemplateMetadata;
  
  /**
   * Template availability
   */
  available: boolean;
  
  /**
   * Template location
   */
  location: string;
  
  /**
   * Template validation status
   */
  validationStatus: TemplateValidationStatus;
}

enum TemplateValidationStatus {
  VALID = 'valid',
  INVALID = 'invalid',
  WARNING = 'warning',
  UNKNOWN = 'unknown'
}

interface TemplateValidationResult {
  /**
   * Whether template is valid
   */
  valid: boolean;
  
  /**
   * Validation errors
   */
  errors: TemplateValidationError[];
  
  /**
   * Validation warnings
   */
  warnings: TemplateValidationWarning[];
  
  /**
   * Validation suggestions
   */
  suggestions: string[];
}

interface TemplateValidationError {
  /**
   * Error code
   */
  code: TemplateErrorCode;
  
  /**
   * Error message
   */
  message: string;
  
  /**
   * Error location in template
   */
  location: ErrorLocation;
  
  /**
   * Suggested fix
   */
  suggestedFix?: string;
}

enum TemplateErrorCode {
  MISSING_REQUIRED_FIELD = 'MISSING_REQUIRED_FIELD',
  INVALID_FIELD_TYPE = 'INVALID_FIELD_TYPE',
  CIRCULAR_DEPENDENCY = 'CIRCULAR_DEPENDENCY',
  INVALID_STEP_REFERENCE = 'INVALID_STEP_REFERENCE',
  MISSING_PARAMETER = 'MISSING_PARAMETER',
  INVALID_TOOL_REFERENCE = 'INVALID_TOOL_REFERENCE'
}

interface ErrorLocation {
  /**
   * Section in template
   */
  section: string;
  
  /**
   * Field path
   */
  field: string;
  
  /**
   * Line number (for file-based templates)
   */
  line?: number;
  
  /**
   * Column number (for file-based templates)
   */
  column?: number;
}
```

## Configuration Contract

### WorkflowHandlerConfig

```typescript
interface WorkflowHandlerConfig {
  /**
   * Template management settings
   */
  templates: TemplateManagementConfig;
  
  /**
   * Execution settings
   */
  execution: WorkflowExecutionConfig;
  
  /**
   * Tool integration configuration
   */
  tools: ToolIntegrationConfig;
  
  /**
   * Artifact management
   */
  artifacts: ArtifactManagementConfig;
  
  /**
   * Performance settings
   */
  performance: WorkflowPerformanceConfig;
}

interface TemplateManagementConfig {
  /**
   * Template directories
   */
  templateDirectories: string[];
  
  /**
   * Whether to auto-reload templates
   */
  autoReload: boolean;
  
  /**
   * Template file patterns
   */
  filePatterns: string[];
  
  /**
   * Template validation settings
   */
  validation: TemplateValidationConfig;
  
  /**
   * Template caching configuration
   */
  caching: TemplateCachingConfig;
}

interface TemplateValidationConfig {
  /**
   * Whether to validate templates on load
   */
  validateOnLoad: boolean;
  
  /**
   * Whether to validate parameters
   */
  validateParameters: boolean;
  
  /**
   * Whether to validate tool references
   */
  validateToolReferences: boolean;
  
  /**
   * Custom validation rules
   */
  customRules: CustomValidationRule[];
}

interface CustomValidationRule {
  /**
   * Rule name
   */
  name: string;
  
  /**
   * Rule description
   */
  description: string;
  
  /**
   * Rule implementation
   */
  implementation: string;
  
  /**
   * Rule severity
   */
  severity: ValidationSeverity;
}

enum ValidationSeverity {
  ERROR = 'error',
  WARNING = 'warning',
  INFO = 'info'
}

interface TemplateCachingConfig {
  /**
   * Whether to enable template caching
   */
  enabled: boolean;
  
  /**
   * Cache TTL (ms)
   */
  ttl: number;
  
  /**
   * Maximum cache size
   */
  maxSize: number;
  
  /**
   * Cache storage type
   */
  storageType: CacheStorageType;
}

enum CacheStorageType {
  MEMORY = 'memory',
  FILE_SYSTEM = 'file_system',
  DATABASE = 'database'
}

interface WorkflowExecutionConfig {
  /**
   * Maximum concurrent workflow executions
   */
  maxConcurrentExecutions: number;
  
  /**
   * Default workflow timeout (ms)
   */
  defaultTimeout: number;
  
  /**
   * Step execution settings
   */
  stepExecution: StepExecutionConfig;
  
  /**
   * Error handling configuration
   */
  errorHandling: WorkflowErrorHandlingConfig;
  
  /**
   * Rollback configuration
   */
  rollback: GlobalRollbackConfig;
}

interface StepExecutionConfig {
  /**
   * Default step timeout (ms)
   */
  defaultStepTimeout: number;
  
  /**
   * Maximum retry attempts
   */
  maxRetryAttempts: number;
  
  /**
   * Retry delay (ms)
   */
  retryDelay: number;
  
  /**
   * Whether to enable parallel execution
   */
  enableParallelExecution: boolean;
  
  /**
   * Maximum parallel steps
   */
  maxParallelSteps: number;
}

interface WorkflowErrorHandlingConfig {
  /**
   * Default error handling strategy
   */
  defaultStrategy: ErrorHandlingStrategy;
  
  /**
   * Whether to continue on non-critical errors
   */
  continueOnError: boolean;
  
  /**
   * Error reporting configuration
   */
  reporting: ErrorReportingConfig;
  
  /**
   * Recovery strategies
   */
  recoveryStrategies: RecoveryStrategy[];
}

enum ErrorHandlingStrategy {
  STOP_ON_ERROR = 'stop_on_error',
  CONTINUE_ON_ERROR = 'continue_on_error',
  RETRY_ON_ERROR = 'retry_on_error',
  ROLLBACK_ON_ERROR = 'rollback_on_error'
}

interface RecoveryStrategy {
  /**
   * Error types this strategy handles
   */
  errorTypes: string[];
  
  /**
   * Recovery actions
   */
  actions: RecoveryAction[];
  
  /**
   * Strategy priority
   */
  priority: number;
}

interface RecoveryAction {
  /**
   * Action type
   */
  type: RecoveryActionType;
  
  /**
   * Action configuration
   */
  config: Record<string, any>;
}

enum RecoveryActionType {
  RETRY_STEP = 'retry_step',
  SKIP_STEP = 'skip_step',
  RUN_ALTERNATIVE_STEP = 'run_alternative_step',
  ROLLBACK_TO_CHECKPOINT = 'rollback_to_checkpoint',
  NOTIFY_USER = 'notify_user'
}

interface ToolIntegrationConfig {
  /**
   * Tool discovery settings
   */
  discovery: ToolDiscoveryConfig;
  
  /**
   * Tool execution settings
   */
  execution: ToolExecutionConfig;
  
  /**
   * Tool output processing
   */
  outputProcessing: ToolOutputProcessingConfig;
}

interface ToolDiscoveryConfig {
  /**
   * Whether to auto-discover tools
   */
  autoDiscover: boolean;
  
  /**
   * Tool sources
   */
  sources: ToolSource[];
  
  /**
   * Discovery interval (ms)
   */
  discoveryInterval: number;
}

interface ToolSource {
  /**
   * Source type
   */
  type: ToolSourceType;
  
  /**
   * Source location
   */
  location: string;
  
  /**
   * Source configuration
   */
  config: Record<string, any>;
}

enum ToolSourceType {
  MCP_SERVER = 'mcp_server',
  LOCAL_DIRECTORY = 'local_directory',
  PLUGIN_REGISTRY = 'plugin_registry',
  REMOTE_API = 'remote_api'
}

interface ArtifactManagementConfig {
  /**
   * Artifact storage settings
   */
  storage: ArtifactStorageConfig;
  
  /**
   * Artifact retention policy
   */
  retention: ArtifactRetentionPolicy;
  
  /**
   * Artifact indexing
   */
  indexing: ArtifactIndexingConfig;
}

interface ArtifactStorageConfig {
  /**
   * Storage location
   */
  location: string;
  
  /**
   * Storage type
   */
  type: ArtifactStorageType;
  
  /**
   * Compression settings
   */
  compression: CompressionConfig;
  
  /**
   * Encryption settings
   */
  encryption: ArtifactEncryptionConfig;
}

enum ArtifactStorageType {
  LOCAL_FILE_SYSTEM = 'local_file_system',
  CLOUD_STORAGE = 'cloud_storage',
  DATABASE = 'database'
}

interface WorkflowPerformanceConfig {
  /**
   * Resource monitoring
   */
  monitoring: ResourceMonitoringConfig;
  
  /**
   * Performance limits
   */
  limits: PerformanceLimits;
  
  /**
   * Optimization settings
   */
  optimization: OptimizationConfig;
}

interface PerformanceLimits {
  /**
   * Maximum memory usage per workflow (bytes)
   */
  maxMemoryPerWorkflow: number;
  
  /**
   * Maximum CPU time per workflow (ms)
   */
  maxCpuTimePerWorkflow: number;
  
  /**
   * Maximum disk usage per workflow (bytes)
   */
  maxDiskUsagePerWorkflow: number;
  
  /**
   * Maximum network transfer per workflow (bytes)
   */
  maxNetworkTransferPerWorkflow: number;
}
```

## Implementation Strategies

### Template-Based Execution Engine

```typescript
class WorkflowCommandHandler implements IWorkflowCommandHandler {
  private templates: Map<string, WorkflowTemplate>;
  private executions: Map<string, WorkflowExecution>;
  private templateManager: TemplateManager;
  private executionEngine: WorkflowExecutionEngine;
  private smartRouterClient: ISmartRouterClient;
  private config: WorkflowHandlerConfig;
  
  constructor(
    config: WorkflowHandlerConfig,
    smartRouterClient: ISmartRouterClient
  ) {
    this.config = config;
    this.templates = new Map();
    this.executions = new Map();
    this.smartRouterClient = smartRouterClient;
    this.templateManager = new TemplateManager(config.templates);
    this.executionEngine = new WorkflowExecutionEngine(config.execution);
  }
  
  async executeWorkflow(command: ParsedCommand, context: ExecutionContext): Promise<WorkflowResult> {
    // Determine template from command
    const templateName = this.extractTemplateName(command);
    const template = await this.loadTemplate(templateName);
    
    // Extract and validate parameters
    const parameters = this.extractParameters(command, template);
    const validationResult = this.validateParameters(parameters, template);
    
    if (!validationResult.valid) {
      throw new WorkflowError(`Parameter validation failed: ${validationResult.errors[0].message}`);
    }
    
    // Create workflow execution
    const execution = this.createExecution(template, parameters, context);
    this.executions.set(execution.id, execution);
    
    try {
      // Execute workflow
      const result = await this.executionEngine.execute(execution, this.smartRouterClient);
      
      // Update execution status
      execution.status = WorkflowExecutionStatus.COMPLETED;
      execution.endTime = new Date();
      
      return result;
      
    } catch (error) {
      execution.status = WorkflowExecutionStatus.FAILED;
      execution.endTime = new Date();
      
      // Attempt rollback if configured
      if (template.definition.rollback.enabled) {
        await this.performRollback(execution);
      }
      
      throw error;
    }
  }
  
  private extractTemplateName(command: ParsedCommand): string {
    // Extract template name from command
    // E.g., "qi edit file.js fix bug" -> "edit_file"
    const templateMappings: Record<string, string> = {
      'edit': 'edit_file',
      'analyze': 'analyze_code',
      'fix': 'fix_issue',
      'test': 'run_tests',
      'deploy': 'deploy_project'
    };
    
    return templateMappings[command.command] || command.command;
  }
  
  private extractParameters(command: ParsedCommand, template: WorkflowTemplate): Record<string, any> {
    const parameters: Record<string, any> = {};
    
    // Map command arguments to template parameters
    template.parameters.forEach((param, index) => {
      if (index < command.args.length) {
        parameters[param.name] = command.args[index];
      } else if (param.defaultValue !== undefined) {
        parameters[param.name] = param.defaultValue;
      }
    });
    
    // Map command options to parameters
    Object.entries(command.options).forEach(([key, value]) => {
      const param = template.parameters.find(p => p.name === key);
      if (param) {
        parameters[key] = value;
      }
    });
    
    return parameters;
  }
}
```

### Workflow Execution Engine

```typescript
class WorkflowExecutionEngine {
  private config: WorkflowExecutionConfig;
  private stepExecutor: StepExecutor;
  
  constructor(config: WorkflowExecutionConfig) {
    this.config = config;
    this.stepExecutor = new StepExecutor(config.stepExecution);
  }
  
  async execute(execution: WorkflowExecution, smartRouterClient: ISmartRouterClient): Promise<WorkflowResult> {
    const template = execution.template;
    const stepResults: StepResult[] = [];
    const artifacts: WorkflowArtifact[] = [];
    
    try {
      // Execute steps according to dependencies
      const executionOrder = this.calculateExecutionOrder(template.definition.steps, template.definition.dependencies);
      
      for (const stepId of executionOrder) {
        const step = template.definition.steps.find(s => s.id === stepId);
        if (!step) continue;
        
        // Check if step should be executed
        if (!this.shouldExecuteStep(step, stepResults)) {
          continue;
        }
        
        // Execute step
        const stepResult = await this.stepExecutor.execute(step, execution, smartRouterClient);
        stepResults.push(stepResult);
        
        // Collect artifacts
        if (stepResult.artifacts.length > 0) {
          const stepArtifacts = await this.collectStepArtifacts(stepResult, execution);
          artifacts.push(...stepArtifacts);
        }
        
        // Check for step failure
        if (stepResult.status === StepExecutionStatus.FAILED) {
          await this.handleStepFailure(step, stepResult, execution);
        }
      }
      
      return {
        success: true,
        exitCode: 0,
        output: this.generateWorkflowOutput(stepResults),
        workflowData: {
          executionId: execution.id,
          template: execution.template.metadata,
          parameters: execution.parameters,
          status: WorkflowExecutionStatus.COMPLETED,
          timeline: execution.timeline,
          resourceUsage: execution.resourceUsage
        },
        stepResults,
        artifacts,
        metrics: this.calculateWorkflowMetrics(execution),
        errors: [],
        context: execution.context,
        followUpActions: []
      };
      
    } catch (error) {
      throw new WorkflowExecutionError(`Workflow execution failed: ${error.message}`, execution.id);
    }
  }
  
  private calculateExecutionOrder(steps: WorkflowStep[], dependencies: StepDependency[]): string[] {
    // Topological sort to determine execution order
    const graph = new Map<string, string[]>();
    const inDegree = new Map<string, number>();
    
    // Initialize graph
    steps.forEach(step => {
      graph.set(step.id, []);
      inDegree.set(step.id, 0);
    });
    
    // Build dependency graph
    dependencies.forEach(dep => {
      dep.dependsOn.forEach(prerequisite => {
        graph.get(prerequisite)?.push(dep.stepId);
        inDegree.set(dep.stepId, (inDegree.get(dep.stepId) || 0) + 1);
      });
    });
    
    // Topological sort
    const queue: string[] = [];
    const result: string[] = [];
    
    inDegree.forEach((degree, stepId) => {
      if (degree === 0) {
        queue.push(stepId);
      }
    });
    
    while (queue.length > 0) {
      const current = queue.shift()!;
      result.push(current);
      
      graph.get(current)?.forEach(neighbor => {
        const newDegree = (inDegree.get(neighbor) || 0) - 1;
        inDegree.set(neighbor, newDegree);
        
        if (newDegree === 0) {
          queue.push(neighbor);
        }
      });
    }
    
    return result;
  }
}
```

### Step Executor

```typescript
class StepExecutor {
  private config: StepExecutionConfig;
  
  async execute(step: WorkflowStep, execution: WorkflowExecution, smartRouterClient: ISmartRouterClient): Promise<StepResult> {
    const startTime = Date.now();
    
    try {
      let result: any;
      
      switch (step.type) {
        case StepType.MESSAGE_GENERATION:
          result = await this.executeMessageGeneration(step, execution, smartRouterClient);
          break;
        case StepType.TOOL_EXECUTION:
          result = await this.executeToolOperation(step, execution, smartRouterClient);
          break;
        case StepType.FILE_OPERATION:
          result = await this.executeFileOperation(step, execution);
          break;
        case StepType.VALIDATION:
          result = await this.executeValidation(step, execution);
          break;
        default:
          throw new Error(`Unsupported step type: ${step.type}`);
      }
      
      // Check success criteria
      const success = this.checkSuccessCriteria(result, step.successCriteria);
      
      return {
        stepId: step.id,
        status: success ? StepExecutionStatus.COMPLETED : StepExecutionStatus.FAILED,
        output: result,
        errors: [],
        metrics: {
          executionTime: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed,
          cpuUsage: 0, // Would need CPU monitoring
          networkRequests: 0,
          filesAccessed: 0
        },
        artifacts: []
      };
      
    } catch (error) {
      return {
        stepId: step.id,
        status: StepExecutionStatus.FAILED,
        output: null,
        errors: [{
          code: 'STEP_EXECUTION_ERROR',
          message: error.message,
          details: error,
          timestamp: new Date(),
          recoverable: false
        }],
        metrics: {
          executionTime: Date.now() - startTime,
          memoryUsage: process.memoryUsage().heapUsed,
          cpuUsage: 0,
          networkRequests: 0,
          filesAccessed: 0
        },
        artifacts: []
      };
    }
  }
  
  private async executeMessageGeneration(step: WorkflowStep, execution: WorkflowExecution, smartRouterClient: ISmartRouterClient): Promise<any> {
    const config = step.config as MessageGenerationConfig;
    
    // Process template variables
    const processedMessage = this.processTemplate(config.template, {
      ...execution.parameters,
      ...execution.context
    });
    
    // Send to Smart Router
    const responseStream = smartRouterClient.processMessage({
      message: processedMessage,
      context: execution.context,
      sessionId: execution.id
    });
    
    // Collect response
    let fullResponse = '';
    for await (const chunk of responseStream) {
      if (chunk.type === ChunkType.TEXT) {
        fullResponse += chunk.content;
      }
    }
    
    return fullResponse;
  }
  
  private processTemplate(template: string, variables: Record<string, any>): string {
    let processed = template;
    
    Object.entries(variables).forEach(([key, value]) => {
      const placeholder = `{{${key}}}`;
      processed = processed.replace(new RegExp(placeholder, 'g'), String(value));
    });
    
    return processed;
  }
}
```

## Error Handling

```typescript
enum WorkflowErrorCode {
  TEMPLATE_NOT_FOUND = 'TEMPLATE_NOT_FOUND',
  PARAMETER_VALIDATION_FAILED = 'PARAMETER_VALIDATION_FAILED',
  STEP_EXECUTION_FAILED = 'STEP_EXECUTION_FAILED',
  DEPENDENCY_CYCLE = 'DEPENDENCY_CYCLE',
  RESOURCE_LIMIT_EXCEEDED = 'RESOURCE_LIMIT_EXCEEDED',
  TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED'
}

class WorkflowError extends Error {
  constructor(
    message: string,
    public code: WorkflowErrorCode = WorkflowErrorCode.STEP_EXECUTION_FAILED,
    public executionId?: string,
    public stepId?: string
  ) {
    super(message);
    this.name = 'WorkflowError';
  }
}
```

## Performance Requirements

- **Template Loading**: <100ms for template parsing and validation
- **Workflow Startup**: <500ms for workflow initialization
- **Step Execution**: Variable based on step complexity
- **Memory Usage**: <100MB per workflow execution
- **Concurrent Workflows**: Support 5+ concurrent workflow executions

## Testing Contract

```typescript
interface WorkflowCommandHandlerTestSuite {
  /**
   * Test template management
   */
  testTemplateManagement(testCases: TemplateTestCase[]): TestResults;
  
  /**
   * Test workflow execution
   */
  testWorkflowExecution(testCases: WorkflowExecutionTestCase[]): TestResults;
  
  /**
   * Test step execution
   */
  testStepExecution(testCases: StepExecutionTestCase[]): TestResults;
  
  /**
   * Test error handling and rollback
   */
  testErrorHandling(testCases: ErrorHandlingTestCase[]): TestResults;
}
```

This Workflow Command Handler provides comprehensive workflow automation capabilities, enabling complex development tasks to be executed through predefined templates with intelligent tool orchestration and robust error handling.