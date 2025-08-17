# Tools Framework Documentation

**Purpose**: Comprehensive tool execution framework for agent capabilities  
**Status**: Production-ready with 14 operational tools  
**Architecture**: 6-phase execution pipeline with security framework

## Overview

The qi-v2-agent tools framework provides a robust, extensible system for agent tool execution with comprehensive security, monitoring, and integration capabilities. The framework supports both internal tools and external service integration via MCP (Model Context Protocol).

## Framework Architecture

### **Core Tool Framework Components**

#### **Tool Execution Pipeline** - `lib/src/tools/core/`
```
lib/src/tools/core/
├── ToolExecutor.ts          # 6-phase execution pipeline
├── ToolRegistry.ts          # Tool discovery and management
├── ToolValidation.ts        # Input validation and verification
├── ToolPermissions.ts       # Permission management
└── interfaces/              # Tool interface contracts
    ├── ITool.ts            # Core tool interface
    ├── IToolExecutor.ts    # Executor interface
    └── IToolRegistry.ts    # Registry interface
```

#### **Security Framework** - `lib/src/tools/security/`
```
lib/src/tools/security/
├── SecurityGateway.ts       # Security boundary enforcement
├── PermissionManager.ts     # Permission validation
├── SecurityBoundary.ts      # Execution isolation
└── AuditLogger.ts          # Security event logging
```

### **6-Phase Execution Pipeline**

The tool execution framework follows a rigorous 6-phase pipeline ensuring security, validation, and monitoring:

```typescript
enum ExecutionPhase {
  VALIDATION = 'validation',        // Input validation and sanitization
  PERMISSION = 'permission',        // Permission and security checks
  PREPARATION = 'preparation',      // Environment and context setup
  EXECUTION = 'execution',          // Tool execution with monitoring
  POSTPROCESSING = 'postprocessing', // Result processing and formatting
  CLEANUP = 'cleanup'               // Resource cleanup and state reset
}
```

## Tool Categories

### **1. File System Tools** - `lib/src/tools/impl/file/`

#### **Read Tool** - `ReadTool.ts`
```typescript
interface ReadToolConfig {
  maxFileSize: number;      // Maximum file size limit
  allowedExtensions: string[]; // Permitted file extensions
  encoding: string;         // File encoding (default: utf-8)
}

interface ReadToolResult {
  content: string;          // File content
  metadata: FileMetadata;   // File information
  lineCount: number;        // Total lines
  size: number;            // File size in bytes
}
```

#### **Write Tool** - `WriteTool.ts`
```typescript
interface WriteToolConfig {
  backupOriginal: boolean;  // Create backup before write
  validateContent: boolean; // Content validation
  atomicWrite: boolean;     // Atomic write operations
}
```

#### **Edit Tool** - `EditTool.ts`
```typescript
interface EditToolConfig {
  maxReplacements: number;  // Maximum replacements per operation
  validateChanges: boolean; // Validate changes before applying
  preserveFormatting: boolean; // Maintain file formatting
}
```

#### **MultiEdit Tool** - `MultiEditTool.ts`
```typescript
interface MultiEditOperation {
  startLine: number;
  endLine: number;
  newContent: string;
  operationType: 'replace' | 'insert' | 'delete';
}
```

#### **LS Tool** - `LSTool.ts`
```typescript
interface LSToolConfig {
  maxDepth: number;         // Maximum directory depth
  includeHidden: boolean;   // Include hidden files
  sortBy: 'name' | 'size' | 'modified';
}
```

#### **BaseTool** - `BaseTool.ts`
Core base class providing common functionality for file tools.

### **2. Search Tools** - `lib/src/tools/impl/search/`

#### **Glob Tool** - `GlobTool.ts`
```typescript
interface GlobToolConfig {
  maxResults: number;       // Maximum search results
  followSymlinks: boolean;  // Follow symbolic links
  ignorePatterns: string[]; // Patterns to ignore
}

interface GlobResult {
  files: string[];          // Matching file paths
  totalCount: number;       // Total matches found
  searchTime: number;       // Search duration
}
```

#### **Grep Tool** - `GrepTool.ts`
```typescript
interface GrepToolConfig {
  caseSensitive: boolean;   // Case-sensitive search
  maxLines: number;         // Maximum lines to search
  contextLines: number;     // Context lines around matches
  regexEnabled: boolean;    // Enable regex patterns
}

interface GrepResult {
  matches: GrepMatch[];     // Search matches
  totalMatches: number;     // Total match count
  filesSearched: number;    // Files searched count
}
```

### **3. System Tools** - `lib/src/tools/impl/system/`

#### **Bash Tool** - `BashTool.ts`
```typescript
interface BashToolConfig {
  timeout: number;          // Execution timeout
  workingDirectory: string; // Working directory
  environment: Record<string, string>; // Environment variables
  allowedCommands: string[]; // Permitted command patterns
}

interface BashResult {
  stdout: string;           // Standard output
  stderr: string;           // Standard error
  exitCode: number;         // Exit code
  executionTime: number;    // Execution duration
}
```

#### **ProcessManager Tool** - `ProcessManagerTool.ts`
```typescript
interface ProcessManagerConfig {
  maxConcurrentProcesses: number; // Concurrent process limit
  processTimeout: number;         // Default process timeout
  monitoringInterval: number;     // Process monitoring interval
}
```

## Security Framework

### **Permission System**

The tools framework implements a comprehensive permission system:

```typescript
interface ToolPermissions {
  canRead: boolean;           // File read permissions
  canWrite: boolean;          // File write permissions
  canExecute: boolean;        // Command execution permissions
  allowedPaths: string[];     // Permitted file paths
  deniedPaths: string[];      // Forbidden file paths
  maxFileSize: number;        // File size limits
  timeout: number;            // Operation timeout
}
```

### **Security Boundaries**

Each tool execution occurs within security boundaries:

```typescript
interface SecurityBoundary {
  isolationLevel: 'none' | 'process' | 'container';
  resourceLimits: ResourceLimits;
  networkAccess: boolean;
  fileSystemAccess: FileSystemAccess;
  environmentVariables: Record<string, string>;
}
```

### **Audit Logging**

All tool operations are logged for security and debugging:

```typescript
interface ToolAuditEvent {
  toolName: string;           // Tool identifier
  executionPhase: ExecutionPhase;
  timestamp: Date;            // Event timestamp
  userId?: string;            // User identifier
  input: ToolInput;           // Tool input (sanitized)
  result: ToolResult;         // Tool result (sanitized)
  securityChecks: SecurityCheck[];
  performanceMetrics: PerformanceMetrics;
}
```

## MCP Integration Framework

### **External Service Integration**

The framework supports MCP server integration for external capabilities:

- **[MCP Ecosystem Analysis](./mcp/ecosystem-analysis.md)** - Professional assessment of available MCP servers
- **[MCP Integration Guide](./mcp/integration.md)** - Framework patterns for MCP integration
- **[Supported MCP Servers](./mcp/servers.md)** - Production-ready MCP server catalog

### **MCP Client Framework** - `lib/src/mcp/`

```typescript
interface MCPClientConfig {
  serverEndpoint: string;     // MCP server endpoint
  authenticationMethod: string; // Authentication method
  timeout: number;            // Request timeout
  retryPolicy: RetryPolicy;   // Retry configuration
  rateLimiting: RateLimitConfig; // Rate limiting
}

interface MCPToolWrapper {
  mcpServerName: string;      // MCP server identifier
  mcpToolName: string;        // Tool name on MCP server
  localToolName: string;      // Local tool alias
  inputMapping: InputMapping; // Input parameter mapping
  outputMapping: OutputMapping; // Output transformation
}
```

## Tool Development Framework

### **Creating Custom Tools**

The framework provides patterns for creating specialized tools:

```typescript
abstract class BaseTool implements ITool {
  protected config: ToolConfig;
  protected permissions: ToolPermissions;
  protected logger: Logger;

  abstract async execute(input: ToolInput): Promise<ToolResult>;
  
  protected async validateInput(input: ToolInput): Promise<ValidationResult> {
    // Input validation logic
  }
  
  protected async checkPermissions(input: ToolInput): Promise<PermissionResult> {
    // Permission validation logic
  }
}
```

### **Tool Registration Pattern**

```typescript
// Tool registration in ToolRegistry
const toolRegistry = new ToolRegistry();

// Register internal tools
toolRegistry.registerTool('read', new ReadTool(readConfig));
toolRegistry.registerTool('write', new WriteTool(writeConfig));
toolRegistry.registerTool('bash', new BashTool(bashConfig));

// Register MCP tools
toolRegistry.registerMCPTool('chroma-search', {
  mcpServerName: 'chroma-mcp',
  mcpToolName: 'search',
  localToolName: 'vector-search',
  inputMapping: vectorSearchMapping,
  outputMapping: vectorResultMapping
});
```

## Performance and Monitoring

### **Performance Metrics**

The framework collects comprehensive performance data:

```typescript
interface PerformanceMetrics {
  executionTime: number;      // Total execution time
  phaseTimings: Record<ExecutionPhase, number>;
  memoryUsage: MemoryUsage;   // Memory consumption
  cpuUsage: number;           // CPU utilization
  networkRequests?: number;   // Network requests (MCP tools)
  cacheHits?: number;         // Cache utilization
}
```

### **Monitoring Integration**

```typescript
interface ToolMonitoringConfig {
  metricsCollection: boolean;   // Enable metrics collection
  performanceLogging: boolean;  // Log performance data
  alerting: AlertingConfig;     // Performance alerting
  dashboards: DashboardConfig;  // Monitoring dashboards
}
```

## Configuration Framework

### **Tool Configuration**

Each tool type has specific configuration options:

```typescript
interface ToolFrameworkConfig {
  defaultTimeout: number;       // Default operation timeout
  maxConcurrentTools: number;   // Concurrent tool limit
  securityLevel: SecurityLevel; // Security enforcement level
  auditLogging: boolean;        // Enable audit logging
  performanceMonitoring: boolean; // Performance tracking
  mcpIntegration: MCPConfig;    // MCP integration settings
}
```

### **Environment-Specific Configuration**

```yaml
# config/tools.yaml
tools:
  file:
    maxFileSize: 10MB
    allowedExtensions: ['.ts', '.js', '.md', '.json', '.yaml']
    backupEnabled: true
  
  system:
    bashTimeout: 30s
    allowedCommands: ['npm', 'bun', 'git', 'ls', 'cat']
    restrictedPaths: ['/etc', '/usr', '/sys']
  
  search:
    maxResults: 1000
    searchTimeout: 10s
    regexEnabled: true
  
  mcp:
    enabledServers: ['chroma-mcp', 'fetch-server']
    timeout: 15s
    retryAttempts: 3
```

## Error Handling and Recovery

### **Error Classification**

```typescript
enum ToolErrorType {
  VALIDATION_ERROR = 'validation_error',
  PERMISSION_DENIED = 'permission_denied',
  EXECUTION_TIMEOUT = 'execution_timeout',
  RESOURCE_EXHAUSTED = 'resource_exhausted',
  MCP_CONNECTION_ERROR = 'mcp_connection_error',
  UNKNOWN_ERROR = 'unknown_error'
}

interface ToolError {
  type: ToolErrorType;
  message: string;
  details: ErrorDetails;
  recoverable: boolean;
  retryStrategy?: RetryStrategy;
}
```

### **Recovery Strategies**

```typescript
interface RecoveryStrategy {
  maxRetries: number;
  backoffStrategy: 'linear' | 'exponential';
  fallbackTool?: string;
  gracefulDegradation: boolean;
}
```

## Testing Framework

### **Tool Testing Patterns**

```typescript
describe('Tool Framework Tests', () => {
  describe('ReadTool', () => {
    test('should read file successfully', async () => {
      const readTool = new ReadTool(testConfig);
      const result = await readTool.execute({
        filePath: 'test-file.txt'
      });
      
      expect(result.success).toBe(true);
      expect(result.content).toBeDefined();
    });
    
    test('should enforce security boundaries', async () => {
      const restrictedTool = new ReadTool(restrictedConfig);
      const result = await restrictedTool.execute({
        filePath: '/etc/passwd'
      });
      
      expect(result.success).toBe(false);
      expect(result.error.type).toBe(ToolErrorType.PERMISSION_DENIED);
    });
  });
});
```

## Extension Points

### **Framework Extensibility**

The tools framework provides clear extension points:

1. **Custom Tool Development**: Implement `ITool` interface
2. **Security Policy Extensions**: Extend `SecurityBoundary` 
3. **MCP Server Integration**: Add new MCP server configurations
4. **Monitoring Extensions**: Custom performance metrics
5. **Configuration Extensions**: Tool-specific configuration schemas

## Documentation Structure

### **Detailed Documentation**

- **[Tool Implementation Guide](./implementation.md)** - Creating and deploying tools
- **[Security Framework](./security.md)** - Security patterns and enforcement
- **[MCP Integration](./mcp/)** - External service integration
- **[Performance Guide](./performance.md)** - Optimization and monitoring
- **[Configuration Reference](./configuration.md)** - Complete configuration options
- **[API Reference](./api-reference.md)** - Complete tool interfaces

---

**Status**: Production-ready framework with 14 operational tools  
**Architecture**: Proven design patterns with security and extensibility  
**Integration**: Framework foundation for unlimited tool types  
**Last Updated**: 2025-01-17