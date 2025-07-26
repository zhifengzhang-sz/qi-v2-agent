# Static Command Handler Component Interface

## Overview

The Static Command Handler Component executes immediate commands that provide information or perform simple operations without requiring user interaction or complex workflows. These commands typically display configuration, system status, or help information and exit immediately.

## Component Responsibilities

- **Information Display**: Show configuration, server status, help information
- **System Commands**: Execute version, status, and diagnostic commands
- **Quick Operations**: Perform simple operations that don't require interaction
- **Immediate Response**: Provide fast, synchronous command execution
- **Console Output**: Format and display results directly to terminal

## Public Interface

### IStaticCommandHandler

```typescript
interface IStaticCommandHandler extends ICommandHandler {
  /**
   * Initialize static command handler
   * @param config Handler configuration
   */
  initialize(config: StaticHandlerConfig): Promise<void>;
  
  /**
   * Execute static command immediately
   * @param command Parsed static command
   * @param context Execution context
   * @returns Immediate command result
   */
  executeStatic(command: ParsedCommand, context: ExecutionContext): Promise<StaticCommandResult>;
  
  /**
   * Get supported static commands
   * @returns List of supported static command names
   */
  getSupportedCommands(): StaticCommandInfo[];
  
  /**
   * Format output for static command
   * @param result Command execution result
   * @param format Desired output format
   * @returns Formatted output string
   */
  formatOutput(result: any, format: StaticOutputFormat): string;
  
  /**
   * Get command help information
   * @param commandName Specific command name
   * @returns Help documentation
   */
  getCommandHelp(commandName: string): StaticCommandHelp;
}
```

## Data Contracts

### Static Command Types

```typescript
enum StaticCommandName {
  CONFIG = 'config',
  SERVERS = 'servers', 
  HELP = 'help',
  VERSION = 'version',
  STATUS = 'status',
  DIAGNOSTIC = 'diagnostic'
}

interface StaticCommandInfo {
  /**
   * Command name
   */
  name: StaticCommandName;
  
  /**
   * Command description
   */
  description: string;
  
  /**
   * Available options
   */
  options: StaticCommandOption[];
  
  /**
   * Usage examples
   */
  examples: string[];
  
  /**
   * Aliases for command
   */
  aliases: string[];
}

interface StaticCommandOption {
  /**
   * Option name
   */
  name: string;
  
  /**
   * Option description
   */
  description: string;
  
  /**
   * Option type
   */
  type: 'boolean' | 'string' | 'number';
  
  /**
   * Whether option is required
   */
  required: boolean;
  
  /**
   * Default value
   */
  default?: any;
}

interface StaticCommandHelp {
  /**
   * Command name
   */
  command: string;
  
  /**
   * Command description
   */
  description: string;
  
  /**
   * Usage syntax
   */
  usage: string;
  
  /**
   * Available options
   */
  options: StaticCommandOption[];
  
  /**
   * Usage examples
   */
  examples: StaticCommandExample[];
  
  /**
   * Related commands
   */
  relatedCommands: string[];
}

interface StaticCommandExample {
  /**
   * Example command line
   */
  command: string;
  
  /**
   * Example description
   */
  description: string;
  
  /**
   * Expected output description
   */
  expectedOutput: string;
}
```

### Static Command Results

```typescript
interface StaticCommandResult extends CommandResult {
  /**
   * Static command specific data
   */
  staticData: StaticCommandData;
  
  /**
   * Output format used
   */
  outputFormat: StaticOutputFormat;
  
  /**
   * Whether output was truncated
   */
  truncated: boolean;
}

interface StaticCommandData {
  /**
   * Command that was executed
   */
  command: StaticCommandName;
  
  /**
   * Structured result data
   */
  data: any;
  
  /**
   * Data source information
   */
  source: DataSource;
  
  /**
   * Data generation timestamp
   */
  generatedAt: Date;
  
  /**
   * Data validity period
   */
  validUntil?: Date;
}

interface DataSource {
  /**
   * Source type
   */
  type: DataSourceType;
  
  /**
   * Source location/path
   */
  location: string;
  
  /**
   * Last modified time
   */
  lastModified: Date;
  
  /**
   * Source version
   */
  version: string;
}

enum DataSourceType {
  CONFIG_FILE = 'config_file',
  SYSTEM_API = 'system_api',
  RUNTIME_STATE = 'runtime_state',
  STATIC_DATA = 'static_data'
}

enum StaticOutputFormat {
  TEXT = 'text',
  JSON = 'json',
  YAML = 'yaml',
  TABLE = 'table',
  LIST = 'list'
}
```

### Specific Command Data Structures

```typescript
// CONFIG command data
interface ConfigCommandData {
  /**
   * Current configuration
   */
  config: QiConfig;
  
  /**
   * Configuration file path
   */
  configPath: string;
  
  /**
   * Environment overrides
   */
  environmentOverrides: Record<string, any>;
  
  /**
   * Configuration validation status
   */
  validation: ConfigValidationResult;
}

interface QiConfig {
  /**
   * LLM configuration
   */
  llm: LLMConfig;
  
  /**
   * MCP server configurations
   */
  mcpServers: MCPServerConfig[];
  
  /**
   * Application settings
   */
  app: AppConfig;
  
  /**
   * UI preferences
   */
  ui: UIConfig;
}

interface ConfigValidationResult {
  /**
   * Whether configuration is valid
   */
  valid: boolean;
  
  /**
   * Validation errors
   */
  errors: ConfigValidationError[];
  
  /**
   * Validation warnings
   */
  warnings: ConfigValidationWarning[];
}

// SERVERS command data
interface ServersCommandData {
  /**
   * Configured MCP servers
   */
  servers: MCPServerStatus[];
  
  /**
   * Server connection summary
   */
  summary: ServerSummary;
  
  /**
   * Last check timestamp
   */
  lastChecked: Date;
}

interface MCPServerStatus {
  /**
   * Server name
   */
  name: string;
  
  /**
   * Server URL/endpoint
   */
  endpoint: string;
  
  /**
   * Connection status
   */
  status: ServerConnectionStatus;
  
  /**
   * Available tools
   */
  tools: ServerTool[];
  
  /**
   * Server metadata
   */
  metadata: ServerMetadata;
  
  /**
   * Last response time
   */
  lastResponseTime?: number;
  
  /**
   * Error information if disconnected
   */
  error?: ServerError;
}

enum ServerConnectionStatus {
  CONNECTED = 'connected',
  DISCONNECTED = 'disconnected',
  CONNECTING = 'connecting',
  ERROR = 'error',
  UNKNOWN = 'unknown'
}

interface ServerTool {
  /**
   * Tool name
   */
  name: string;
  
  /**
   * Tool description
   */
  description: string;
  
  /**
   * Tool parameters schema
   */
  parameters: any;
}

interface ServerSummary {
  /**
   * Total configured servers
   */
  total: number;
  
  /**
   * Connected servers count
   */
  connected: number;
  
  /**
   * Disconnected servers count
   */
  disconnected: number;
  
  /**
   * Total available tools
   */
  totalTools: number;
}

// VERSION command data
interface VersionCommandData {
  /**
   * Application version
   */
  version: string;
  
  /**
   * Build information
   */
  build: BuildInfo;
  
  /**
   * Runtime information
   */
  runtime: RuntimeInfo;
  
  /**
   * Dependencies
   */
  dependencies: DependencyInfo[];
}

interface BuildInfo {
  /**
   * Build timestamp
   */
  timestamp: Date;
  
  /**
   * Git commit hash
   */
  commit: string;
  
  /**
   * Git branch
   */
  branch: string;
  
  /**
   * Build environment
   */
  environment: string;
}

interface RuntimeInfo {
  /**
   * Node.js version
   */
  nodeVersion: string;
  
  /**
   * Platform information
   */
  platform: PlatformInfo;
  
  /**
   * Memory usage
   */
  memoryUsage: ProcessMemoryUsage;
  
  /**
   * Uptime in seconds
   */
  uptime: number;
}

interface PlatformInfo {
  /**
   * Operating system
   */
  os: string;
  
  /**
   * CPU architecture
   */
  arch: string;
  
  /**
   * CPU information
   */
  cpus: CPUInfo[];
  
  /**
   * Total system memory
   */
  totalMemory: number;
}

interface ProcessMemoryUsage {
  /**
   * Resident set size
   */
  rss: number;
  
  /**
   * Heap total
   */
  heapTotal: number;
  
  /**
   * Heap used
   */
  heapUsed: number;
  
  /**
   * External memory
   */
  external: number;
}

interface DependencyInfo {
  /**
   * Dependency name
   */
  name: string;
  
  /**
   * Installed version
   */
  version: string;
  
  /**
   * Required version
   */
  required: string;
  
  /**
   * Whether version is compatible
   */
  compatible: boolean;
}

// STATUS command data
interface StatusCommandData {
  /**
   * Application status
   */
  application: ApplicationStatus;
  
  /**
   * System health
   */
  health: HealthStatus;
  
  /**
   * Active sessions
   */
  sessions: SessionStatus[];
  
  /**
   * Resource usage
   */
  resources: ResourceUsage;
}

interface ApplicationStatus {
  /**
   * Application state
   */
  state: ApplicationState;
  
  /**
   * Initialization time
   */
  initTime: Date;
  
  /**
   * Last activity time
   */
  lastActivity: Date;
  
  /**
   * Configuration status
   */
  configStatus: ConfigurationStatus;
}

enum ApplicationState {
  INITIALIZING = 'initializing',
  READY = 'ready',
  BUSY = 'busy',
  ERROR = 'error',
  SHUTTING_DOWN = 'shutting_down'
}

interface HealthStatus {
  /**
   * Overall health
   */
  overall: HealthLevel;
  
  /**
   * Component health checks
   */
  components: ComponentHealth[];
  
  /**
   * Health check timestamp
   */
  checkedAt: Date;
}

enum HealthLevel {
  HEALTHY = 'healthy',
  WARNING = 'warning',
  CRITICAL = 'critical',
  UNKNOWN = 'unknown'
}

interface ComponentHealth {
  /**
   * Component name
   */
  name: string;
  
  /**
   * Health level
   */
  level: HealthLevel;
  
  /**
   * Health message
   */
  message: string;
  
  /**
   * Response time
   */
  responseTime: number;
}
```

## Configuration Contract

### StaticHandlerConfig

```typescript
interface StaticHandlerConfig {
  /**
   * Output formatting preferences
   */
  output: OutputConfig;
  
  /**
   * Command-specific settings
   */
  commands: CommandSpecificConfig;
  
  /**
   * Performance settings
   */
  performance: StaticPerformanceConfig;
  
  /**
   * Data refresh settings
   */
  dataRefresh: DataRefreshConfig;
}

interface OutputConfig {
  /**
   * Default output format
   */
  defaultFormat: StaticOutputFormat;
  
  /**
   * Maximum output lines before truncation
   */
  maxLines: number;
  
  /**
   * Color output preferences
   */
  colorization: ColorizationConfig;
  
  /**
   * Table formatting options
   */
  tableFormat: TableFormatConfig;
}

interface ColorizationConfig {
  /**
   * Whether to use colors
   */
  enabled: boolean;
  
  /**
   * Color scheme
   */
  scheme: ColorScheme;
  
  /**
   * Force color output even if not TTY
   */
  force: boolean;
}

interface ColorScheme {
  /**
   * Success message color
   */
  success: string;
  
  /**
   * Error message color
   */
  error: string;
  
  /**
   * Warning message color
   */
  warning: string;
  
  /**
   * Information color
   */
  info: string;
  
  /**
   * Header color
   */
  header: string;
  
  /**
   * Value color
   */
  value: string;
}

interface TableFormatConfig {
  /**
   * Table border style
   */
  borderStyle: BorderStyle;
  
  /**
   * Column padding
   */
  padding: number;
  
  /**
   * Maximum column width
   */
  maxColumnWidth: number;
  
  /**
   * Whether to show headers
   */
  showHeaders: boolean;
}

enum BorderStyle {
  NONE = 'none',
  SIMPLE = 'simple',
  DOUBLE = 'double',
  ROUNDED = 'rounded'
}

interface CommandSpecificConfig {
  /**
   * Config command settings
   */
  config: ConfigCommandConfig;
  
  /**
   * Servers command settings
   */
  servers: ServersCommandConfig;
  
  /**
   * Version command settings
   */
  version: VersionCommandConfig;
  
  /**
   * Status command settings
   */
  status: StatusCommandConfig;
}

interface ConfigCommandConfig {
  /**
   * Whether to show sensitive values
   */
  showSensitive: boolean;
  
  /**
   * Whether to show default values
   */
  showDefaults: boolean;
  
  /**
   * Whether to validate configuration
   */
  validateConfig: boolean;
  
  /**
   * Sections to include in output
   */
  includeSections: string[];
}

interface ServersCommandConfig {
  /**
   * Whether to test server connections
   */
  testConnections: boolean;
  
  /**
   * Connection timeout (ms)
   */
  connectionTimeout: number;
  
  /**
   * Whether to show server tools
   */
  showTools: boolean;
  
  /**
   * Whether to show detailed status
   */
  showDetailedStatus: boolean;
}

interface VersionCommandConfig {
  /**
   * Whether to show build information
   */
  showBuildInfo: boolean;
  
  /**
   * Whether to show dependencies
   */
  showDependencies: boolean;
  
  /**
   * Whether to show runtime information
   */
  showRuntime: boolean;
}

interface StatusCommandConfig {
  /**
   * Whether to include health checks
   */
  includeHealthChecks: boolean;
  
  /**
   * Whether to show resource usage
   */
  showResourceUsage: boolean;
  
  /**
   * Whether to show active sessions
   */
  showSessions: boolean;
}

interface StaticPerformanceConfig {
  /**
   * Maximum execution time (ms)
   */
  maxExecutionTime: number;
  
  /**
   * Data collection timeout (ms)
   */
  dataTimeout: number;
  
  /**
   * Whether to enable caching
   */
  enableCaching: boolean;
  
  /**
   * Cache TTL (ms)
   */
  cacheTTL: number;
}

interface DataRefreshConfig {
  /**
   * Automatic refresh interval (ms)
   */
  refreshInterval: number;
  
  /**
   * Whether to refresh on demand
   */
  refreshOnDemand: boolean;
  
  /**
   * Stale data threshold (ms)
   */
  staleThreshold: number;
}
```

## Implementation Strategies

### Command Registry Pattern

```typescript
class StaticCommandHandler implements IStaticCommandHandler {
  private commands: Map<StaticCommandName, IStaticCommand>;
  private config: StaticHandlerConfig;
  private outputFormatter: IOutputFormatter;
  private dataCache: IDataCache;
  
  constructor(config: StaticHandlerConfig) {
    this.config = config;
    this.commands = new Map();
    this.outputFormatter = new OutputFormatter(config.output);
    this.dataCache = new DataCache(config.performance.cacheTTL);
    this.registerCommands();
  }
  
  async executeStatic(command: ParsedCommand, context: ExecutionContext): Promise<StaticCommandResult> {
    const staticCommand = this.commands.get(command.command as StaticCommandName);
    
    if (!staticCommand) {
      throw new StaticCommandError(`Unknown static command: ${command.command}`);
    }
    
    const startTime = Date.now();
    
    try {
      // Get data (with caching)
      const data = await this.getCommandData(staticCommand, command, context);
      
      // Format output
      const format = this.determineOutputFormat(command);
      const output = this.outputFormatter.format(data, format);
      
      const duration = Date.now() - startTime;
      
      return {
        success: true,
        exitCode: 0,
        output: {
          stdout: output,
          stderr: '',
          format: format === StaticOutputFormat.JSON ? OutputFormat.JSON : OutputFormat.TEXT,
          metadata: {
            size: output.length,
            generatedAt: new Date(),
            encoding: 'utf-8'
          }
        },
        staticData: {
          command: command.command as StaticCommandName,
          data,
          source: staticCommand.getDataSource(),
          generatedAt: new Date()
        },
        outputFormat: format,
        truncated: false,
        metrics: {
          duration,
          routingTime: 0,
          executionTime: duration,
          memoryUsage: process.memoryUsage(),
          cpuUsage: process.cpuUsage()
        },
        errors: [],
        context,
        followUpActions: []
      };
    } catch (error) {
      throw new StaticCommandError(`Failed to execute ${command.command}: ${error.message}`, error);
    }
  }
  
  private registerCommands(): void {
    this.commands.set(StaticCommandName.CONFIG, new ConfigCommand(this.config.commands.config));
    this.commands.set(StaticCommandName.SERVERS, new ServersCommand(this.config.commands.servers));
    this.commands.set(StaticCommandName.VERSION, new VersionCommand(this.config.commands.version));
    this.commands.set(StaticCommandName.STATUS, new StatusCommand(this.config.commands.status));
    this.commands.set(StaticCommandName.HELP, new HelpCommand());
  }
  
  private async getCommandData(staticCommand: IStaticCommand, command: ParsedCommand, context: ExecutionContext): Promise<any> {
    const cacheKey = this.generateCacheKey(command);
    
    if (this.config.performance.enableCaching) {
      const cached = this.dataCache.get(cacheKey);
      if (cached && !this.isStale(cached)) {
        return cached.data;
      }
    }
    
    const data = await staticCommand.execute(command, context);
    
    if (this.config.performance.enableCaching) {
      this.dataCache.set(cacheKey, { data, timestamp: new Date() });
    }
    
    return data;
  }
}
```

### Individual Command Implementations

```typescript
interface IStaticCommand {
  execute(command: ParsedCommand, context: ExecutionContext): Promise<any>;
  getDataSource(): DataSource;
  getHelp(): StaticCommandHelp;
}

class ConfigCommand implements IStaticCommand {
  constructor(private config: ConfigCommandConfig) {}
  
  async execute(command: ParsedCommand, context: ExecutionContext): Promise<ConfigCommandData> {
    const configLoader = new ConfigLoader();
    const config = await configLoader.loadConfig();
    
    const validation = this.config.validateConfig 
      ? await this.validateConfig(config)
      : { valid: true, errors: [], warnings: [] };
    
    return {
      config,
      configPath: configLoader.getConfigPath(),
      environmentOverrides: configLoader.getEnvironmentOverrides(),
      validation
    };
  }
  
  getDataSource(): DataSource {
    return {
      type: DataSourceType.CONFIG_FILE,
      location: process.env.QI_CONFIG_PATH || './config/qi-config.yaml',
      lastModified: new Date(),
      version: '1.0'
    };
  }
  
  private async validateConfig(config: QiConfig): Promise<ConfigValidationResult> {
    // Implementation for config validation
    return { valid: true, errors: [], warnings: [] };
  }
}

class ServersCommand implements IStaticCommand {
  constructor(private config: ServersCommandConfig) {}
  
  async execute(command: ParsedCommand, context: ExecutionContext): Promise<ServersCommandData> {
    const mcpManager = new MCPManager();
    const servers = await mcpManager.getAllServers();
    
    const serverStatuses: MCPServerStatus[] = [];
    
    for (const server of servers) {
      const status = this.config.testConnections
        ? await this.testServerConnection(server)
        : await this.getServerStatus(server);
      
      serverStatuses.push(status);
    }
    
    const summary = this.generateSummary(serverStatuses);
    
    return {
      servers: serverStatuses,
      summary,
      lastChecked: new Date()
    };
  }
  
  private async testServerConnection(server: MCPServerConfig): Promise<MCPServerStatus> {
    // Implementation for server connection testing
    return {
      name: server.name,
      endpoint: server.endpoint,
      status: ServerConnectionStatus.CONNECTED,
      tools: [],
      metadata: {},
      lastResponseTime: 100
    };
  }
}

class VersionCommand implements IStaticCommand {
  async execute(command: ParsedCommand, context: ExecutionContext): Promise<VersionCommandData> {
    const packageJson = require('../../../package.json');
    
    return {
      version: packageJson.version,
      build: await this.getBuildInfo(),
      runtime: this.getRuntimeInfo(),
      dependencies: this.getDependencyInfo()
    };
  }
  
  private async getBuildInfo(): Promise<BuildInfo> {
    // Implementation for build information
    return {
      timestamp: new Date(),
      commit: process.env.GIT_COMMIT || 'unknown',
      branch: process.env.GIT_BRANCH || 'unknown',
      environment: process.env.NODE_ENV || 'development'
    };
  }
}
```

### Output Formatting

```typescript
interface IOutputFormatter {
  format(data: any, format: StaticOutputFormat): string;
}

class OutputFormatter implements IOutputFormatter {
  constructor(private config: OutputConfig) {}
  
  format(data: any, format: StaticOutputFormat): string {
    switch (format) {
      case StaticOutputFormat.JSON:
        return JSON.stringify(data, null, 2);
      case StaticOutputFormat.YAML:
        return this.formatYAML(data);
      case StaticOutputFormat.TABLE:
        return this.formatTable(data);
      case StaticOutputFormat.LIST:
        return this.formatList(data);
      case StaticOutputFormat.TEXT:
      default:
        return this.formatText(data);
    }
  }
  
  private formatTable(data: any): string {
    if (Array.isArray(data)) {
      return this.createTable(data);
    } else if (typeof data === 'object') {
      return this.createKeyValueTable(data);
    }
    return String(data);
  }
  
  private createTable(rows: any[]): string {
    if (rows.length === 0) return '';
    
    const headers = Object.keys(rows[0]);
    const table = new TableBuilder(this.config.tableFormat);
    
    table.setHeaders(headers);
    rows.forEach(row => table.addRow(headers.map(h => row[h])));
    
    return table.build();
  }
}
```

## Error Handling

```typescript
enum StaticCommandErrorCode {
  COMMAND_NOT_FOUND = 'COMMAND_NOT_FOUND',
  DATA_COLLECTION_FAILED = 'DATA_COLLECTION_FAILED',
  FORMATTING_FAILED = 'FORMATTING_FAILED',
  CONFIGURATION_ERROR = 'CONFIGURATION_ERROR',
  TIMEOUT_EXCEEDED = 'TIMEOUT_EXCEEDED'
}

class StaticCommandError extends Error {
  constructor(
    message: string,
    public code: StaticCommandErrorCode = StaticCommandErrorCode.DATA_COLLECTION_FAILED,
    public cause?: Error
  ) {
    super(message);
    this.name = 'StaticCommandError';
  }
}
```

## Performance Considerations

### Performance Requirements

- **Execution Time**: <100ms for simple commands, <500ms for complex data collection
- **Memory Usage**: <10MB for data collection and formatting
- **Cache Efficiency**: 90%+ cache hit rate for frequently accessed data
- **Output Size**: Handle up to 1MB of formatted output

### Optimization Strategies

```typescript
interface PerformanceOptimizer {
  /**
   * Optimize data collection
   */
  optimizeDataCollection(command: StaticCommandName): Promise<void>;
  
  /**
   * Implement intelligent caching
   */
  enableSmartCaching(): void;
  
  /**
   * Stream large outputs
   */
  enableOutputStreaming(): void;
}
```

## Testing Contract

### Testable Behaviors

```typescript
interface StaticCommandHandlerTestSuite {
  /**
   * Test individual static commands
   */
  testStaticCommands(testCases: StaticCommandTestCase[]): TestResults;
  
  /**
   * Test output formatting
   */
  testOutputFormatting(testCases: FormatTestCase[]): TestResults;
  
  /**
   * Test data caching
   */
  testDataCaching(testCases: CacheTestCase[]): TestResults;
  
  /**
   * Test error scenarios
   */
  testErrorHandling(testCases: ErrorTestCase[]): TestResults;
}

interface StaticCommandTestCase {
  name: string;
  command: ParsedCommand;
  expectedOutput: Partial<StaticCommandResult>;
  mockData?: any;
  description: string;
}
```

This Static Command Handler provides fast, reliable execution of information and diagnostic commands, with comprehensive output formatting, intelligent caching, and robust error handling to ensure users get immediate feedback from the CLI system.