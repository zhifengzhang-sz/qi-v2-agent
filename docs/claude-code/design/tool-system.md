# Tool System Design and Architecture

Claude Code features a comprehensive tool ecosystem with 15+ native tools and extensible MCP integration, enabling sophisticated AI-powered development workflows.

## System Overview

The tool system is built on a unified architecture that provides consistent interfaces, security controls, and execution patterns:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Tool System Architecture                   │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Tool Router │  │ MH1 Engine  │  │ Permission Gateway  │      │
│  │             │  │ (Executor)  │  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                    Core Tool Categories                        │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ File System │  │ Search &    │  │ System & Network    │      │
│  │ Operations  │  │ Discovery   │  │ Operations          │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Code Editing│  │ Task Mgmt   │  │ Specialized         │      │
│  │ Tools       │  │ & Planning  │  │ Formats             │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                     MCP Extensions                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ External    │  │ Third-party │  │ Custom Tools        │      │
│  │ Services    │  │ Integrations│  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Core Architecture

### 1. Unified Tool Interface

All Claude Code tools implement a standardized interface contract:

```typescript
interface ClaudeCodeTool {
  name: string;                                    // Tool unique identifier
  description: () => Promise<string>;              // Dynamic tool description
  inputSchema: ZodSchema;                          // Zod parameter validation
  call: (params, context) => AsyncGenerator;      // Core execution logic
  prompt: () => Promise<string>;                   // LLM usage guidance
  mapToolResultToToolResultBlockParam: Function;   // Result formatter
  isReadOnly: () => boolean;                       // Data modification safety
  isConcurrencySafe: () => boolean;                // Concurrent execution safety
  checkPermissions: (context) => Promise<PermissionResult>; // Security gate
}
```

### 2. Tool Execution Engine (MH1)

The `MH1` function serves as the core tool execution engine implementing a 6-phase execution pipeline:

```javascript
async function* MH1(toolCall, context, session, options) {
  const toolName = toolCall.name;
  const tool = options.tools.find(t => t.name === toolName);
  
  // Phase 1: Tool Discovery & Validation
  if (!tool) {
    yield createError(`Tool not found: ${toolName}`);
    return;
  }
  
  // Phase 2: Input Validation (Zod Schema)
  const validation = tool.inputSchema.safeParse(toolCall.input);
  if (!validation.success) {
    const errorMessage = formatValidationError(tool.name, validation.error);
    yield createError(errorMessage);
    return;
  }
  
  // Phase 3: Permission Checks (Multi-layer Security)
  const permissionResult = await tool.checkPermissions(validation.data, context);
  if (permissionResult?.behavior === "deny") {
    yield createError(permissionResult.denialReason);
    return;
  }
  
  // Phase 4: Tool Execution
  try {
    const results = tool.call(validation.data, context);
    
    // Phase 5: Streaming Result Processing
    for await (const result of results) {
      const formattedResult = tool.mapToolResultToToolResultBlockParam(
        result, 
        toolCall.tool_use_id
      );
      yield formattedResult;
    }
  } catch (error) {
    // Phase 6: Error Handling & Recovery
    yield {
      type: "tool_result",
      content: `Tool execution failed: ${error.message}`,
      is_error: true,
      tool_use_id: toolCall.tool_use_id
    };
  }
}
```

## Tool Categories

### 1. File System Operations

**Core Tools:**
- **Read (TD)**: Safe file system reading with multimodal support
- **Write (rE2)**: File creation with "edit-over-create" philosophy  
- **Edit (oU)**: Precise string replacement editing
- **MultiEdit (OE2)**: Transactional multi-point batch editing
- **LS (VJ1)**: Secure directory content browsing

**Design Principles:**
```javascript
// Read Tool Security Pattern
async function* readTool(params, context) {
  // Absolute path requirement
  if (!path.isAbsolute(params.file_path)) {
    throw new Error("Absolute path required");
  }
  
  // Permission validation
  await checkFilePermissions(params.file_path, context);
  
  // Malicious file detection
  if (await detectMaliciousFile(params.file_path)) {
    yield createSecurityWarning();
  }
  
  // Support for various formats
  const content = await readFileWithFormat(params.file_path);
  yield formatResult(content);
}

// Edit Tool Forced Read Pattern
async function* editTool(params, context) {
  // Must read file before editing
  if (!context.hasReadFile(params.file_path)) {
    throw new Error("File must be read before editing");
  }
  
  // Exact string matching requirement
  const content = await readFile(params.file_path);
  if (!content.includes(params.old_string)) {
    throw new Error("String not found for replacement");
  }
  
  // Perform atomic edit
  await performAtomicEdit(params);
}
```

### 2. Search and Discovery Tools

**Core Tools:**
- **Glob (FJ1)**: High-performance file pattern matching
- **Grep (XJ1)**: Content search with full regex support
- **Task (cX)**: Intelligent agent-powered search orchestration

**Advanced Features:**
```javascript
// Glob Tool Performance Optimization
class GlobTool {
  async execute(pattern, options) {
    // Large codebase support
    if (await isLargeCodebase()) {
      return this.executeBatchSearch(pattern);
    }
    
    // Standard glob execution
    return this.executeStandardGlob(pattern);
  }
  
  async executeBatchSearch(pattern) {
    // Recommend multiple concurrent searches
    const suggestions = this.generateSearchSuggestions(pattern);
    return {
      results: await this.performGlob(pattern),
      suggestions: suggestions
    };
  }
}

// Task Tool Intelligent Orchestration
class TaskTool {
  async execute(description, context) {
    // Multi-tool coordination
    const strategy = await this.planSearchStrategy(description);
    
    // Context usage optimization
    const optimizedContext = this.optimizeContextUsage(context);
    
    // Adaptive execution
    return this.executeAdaptiveSearch(strategy, optimizedContext);
  }
}
```

### 3. System and Network Operations

**Core Tools:**
- **Bash (ZK)**: Secure shell command execution
- **WebFetch**: Intelligent web content retrieval
- **WebSearch**: Network search capabilities

**Security Architecture:**
```javascript
// Bash Tool Security System
class BashTool {
  async execute(command, context) {
    // Command prefix detection
    const safetyCheck = this.analyzeCmandSafety(command);
    if (safetyCheck.risk === 'high') {
      throw new SecurityError('Dangerous command detected');
    }
    
    // Injection prevention
    const sanitized = this.sanitizeCommand(command);
    
    // Execution with monitoring
    return this.executeWithMonitoring(sanitized, context);
  }
  
  analyzeCmandSafety(command) {
    const dangerousPatterns = [
      /rm\s+-rf\s+\//, // Dangerous deletion
      /sudo\s+/, // Privilege escalation
      /curl.*\|\s*sh/, // Download and execute
    ];
    
    return {
      risk: dangerousPatterns.some(p => p.test(command)) ? 'high' : 'low'
    };
  }
}
```

### 4. Specialized Format Handlers

**Core Tools:**
- **NotebookRead (NS)**: Jupyter notebook parsing and analysis
- **NotebookEdit (Ku)**: Jupyter notebook cell editing

**Format-Specific Features:**
```javascript
// Notebook Tools - Structured Understanding
class NotebookTool {
  async parseNotebook(filePath) {
    const content = await readFile(filePath);
    const notebook = JSON.parse(content);
    
    return {
      metadata: notebook.metadata,
      cells: notebook.cells.map(cell => ({
        type: cell.cell_type,
        source: cell.source,
        outputs: cell.outputs || [],
        execution_count: cell.execution_count
      }))
    };
  }
  
  async editCell(filePath, cellNumber, newContent, cellType = 'code') {
    // Atomic notebook modification
    const notebook = await this.parseNotebook(filePath);
    
    if (cellNumber >= 0 && cellNumber < notebook.cells.length) {
      notebook.cells[cellNumber] = {
        ...notebook.cells[cellNumber],
        source: newContent,
        cell_type: cellType
      };
    }
    
    await this.writeNotebook(filePath, notebook);
  }
}
```

### 5. Task Management and Planning

**Core Tools:**
- **TodoRead**: Task state visualization
- **TodoWrite**: Sophisticated task management with state tracking

**Task Management Features:**
```javascript
// TodoWrite Tool - Advanced Task Management
class TodoWriteTool {
  async execute(todos, context) {
    // Validate task structure
    const validation = this.validateTodoStructure(todos);
    if (!validation.valid) {
      throw new ValidationError(validation.errors);
    }
    
    // State transition validation
    todos.forEach(todo => {
      if (!this.isValidStateTransition(todo.status)) {
        throw new StateError(`Invalid status: ${todo.status}`);
      }
    });
    
    // Update task management state
    await this.updateTaskState(todos, context);
    
    return {
      status: 'success',
      taskCount: todos.length,
      completedCount: todos.filter(t => t.status === 'completed').length
    };
  }
  
  isValidStateTransition(status) {
    const validStates = ['pending', 'in_progress', 'completed'];
    return validStates.includes(status);
  }
}
```

## Execution Pipeline

### 1. Tool Discovery and Resolution

```javascript
class ToolResolver {
  constructor() {
    this.nativeTools = new Map();
    this.mcpTools = new Map();
  }
  
  async resolveTools(toolName) {
    // Native tool lookup
    if (this.nativeTools.has(toolName)) {
      return this.nativeTools.get(toolName);
    }
    
    // MCP tool resolution (mcp__server__tool pattern)
    if (toolName.startsWith('mcp__')) {
      return this.resolveMCPTool(toolName);
    }
    
    throw new Error(`Tool not found: ${toolName}`);
  }
  
  resolveMCPTool(toolName) {
    const [, serverName, actualToolName] = toolName.split('__');
    const server = this.getMCPServer(serverName);
    return new MCPToolProxy(server, actualToolName);
  }
}
```

### 2. Concurrent Execution (UH1 Scheduler)

```javascript
class ConcurrentToolScheduler {
  constructor(maxConcurrency = 10) {
    this.maxConcurrency = maxConcurrency;
    this.activeTools = new Set();
    this.queue = [];
  }
  
  async scheduleExecution(tool, params, context) {
    // Check concurrency safety
    if (!tool.isConcurrencySafe() && this.hasConflictingTool(tool)) {
      await this.waitForConflictResolution(tool);
    }
    
    // Enforce concurrency limits
    if (this.activeTools.size >= this.maxConcurrency) {
      await this.waitForSlot();
    }
    
    // Execute tool
    return this.executeWithTracking(tool, params, context);
  }
  
  async executeWithTracking(tool, params, context) {
    this.activeTools.add(tool);
    
    try {
      const result = await tool.execute(params, context);
      return result;
    } finally {
      this.activeTools.delete(tool);
      this.processQueue();
    }
  }
}
```

### 3. Result Processing and Formatting

```javascript
class ResultProcessor {
  async processToolResult(result, toolCall) {
    // Format according to tool specifications
    const formatted = await this.formatResult(result, toolCall);
    
    // Apply security filtering
    const filtered = this.filterSensitiveData(formatted);
    
    // Add metadata
    return {
      ...filtered,
      tool_use_id: toolCall.tool_use_id,
      timestamp: Date.now(),
      execution_time: this.calculateExecutionTime(toolCall)
    };
  }
  
  filterSensitiveData(result) {
    // Remove or mask sensitive information
    const sensitivePatterns = [
      /password['\"]?\s*[:=]\s*['\"]?([^'\"]+)['\"]?/gi,
      /api[_\-]?key['\"]?\s*[:=]\s*['\"]?([^'\"]+)['\"]?/gi,
      /token['\"]?\s*[:=]\s*['\"]?([^'\"]+)['\"]?/gi
    ];
    
    let filtered = result;
    sensitivePatterns.forEach(pattern => {
      filtered = filtered.replace(pattern, (match, secret) => 
        match.replace(secret, '*'.repeat(secret.length))
      );
    });
    
    return filtered;
  }
}
```

## Performance Optimization

### 1. Tool Caching Strategy

```javascript
class ToolCache {
  constructor() {
    this.resultCache = new LRUCache(1000);
    this.metadataCache = new Map();
  }
  
  async getCachedResult(toolName, params, context) {
    const cacheKey = this.generateCacheKey(toolName, params, context);
    
    // Check if tool supports caching
    const tool = await this.resolveTool(toolName);
    if (!tool.isCacheable()) {
      return null;
    }
    
    // Return cached result if available
    return this.resultCache.get(cacheKey);
  }
  
  cacheResult(toolName, params, context, result) {
    const cacheKey = this.generateCacheKey(toolName, params, context);
    this.resultCache.set(cacheKey, {
      result,
      timestamp: Date.now(),
      ttl: this.calculateTTL(toolName)
    });
  }
}
```

### 2. Resource Management

```javascript
class ResourceManager {
  constructor() {
    this.memoryUsage = new Map();
    this.fileHandles = new Set();
    this.networkConnections = new Set();
  }
  
  async trackToolExecution(tool, execution) {
    const resourceUsage = {
      startTime: Date.now(),
      memoryBefore: process.memoryUsage(),
      tool: tool.name
    };
    
    try {
      const result = await execution();
      resourceUsage.success = true;
      return result;
    } catch (error) {
      resourceUsage.error = error;
      throw error;
    } finally {
      resourceUsage.endTime = Date.now();
      resourceUsage.memoryAfter = process.memoryUsage();
      this.recordUsage(resourceUsage);
    }
  }
  
  recordUsage(usage) {
    const memoryDelta = usage.memoryAfter.heapUsed - usage.memoryBefore.heapUsed;
    const executionTime = usage.endTime - usage.startTime;
    
    // Store metrics for analysis
    this.memoryUsage.set(usage.tool, {
      averageMemory: this.calculateAverage(usage.tool, memoryDelta),
      averageTime: this.calculateAverage(usage.tool, executionTime),
      successRate: this.calculateSuccessRate(usage.tool, usage.success)
    });
  }
}
```

## Security Framework

### 1. Permission System

```javascript
class PermissionManager {
  async checkToolPermissions(toolName, params, context) {
    const tool = await this.resolveTool(toolName);
    
    // Built-in permission checks
    const builtInCheck = await tool.checkPermissions(params, context);
    if (builtInCheck?.behavior === 'deny') {
      return builtInCheck;
    }
    
    // System-level security checks
    const systemCheck = await this.performSystemSecurityCheck(toolName, params);
    if (systemCheck?.risk === 'high') {
      return {
        behavior: 'deny',
        denialReason: 'Security policy violation'
      };
    }
    
    return { behavior: 'allow' };
  }
  
  async performSystemSecurityCheck(toolName, params) {
    // File path validation
    if (this.hasFilePathParams(params)) {
      const pathCheck = await this.validateFilePaths(params);
      if (!pathCheck.valid) {
        return { risk: 'high', reason: pathCheck.reason };
      }
    }
    
    // Command validation for Bash tool
    if (toolName === 'bash') {
      return this.validateCommand(params.command);
    }
    
    return { risk: 'low' };
  }
}
```

### 2. Audit and Logging

```javascript
class ToolAuditLogger {
  async logToolExecution(toolName, params, result, context) {
    const auditEntry = {
      timestamp: Date.now(),
      sessionId: context.sessionId,
      toolName,
      parameters: this.sanitizeParams(params),
      success: !result.is_error,
      executionTime: result.executionTime,
      resourceUsage: result.resourceUsage
    };
    
    // Store audit log
    await this.storeAuditEntry(auditEntry);
    
    // Check for suspicious patterns
    await this.analyzeSuspiciousActivity(auditEntry);
  }
  
  sanitizeParams(params) {
    // Remove sensitive information from logs
    const sanitized = { ...params };
    
    // Remove file contents
    if (sanitized.content && sanitized.content.length > 1000) {
      sanitized.content = `[Content truncated - ${sanitized.content.length} characters]`;
    }
    
    // Remove large data structures
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 10000) {
        sanitized[key] = `[Large data truncated]`;
      }
    });
    
    return sanitized;
  }
}
```

This comprehensive tool system enables Claude Code to perform sophisticated development tasks while maintaining security, performance, and extensibility. The unified architecture ensures consistent behavior across all tools while allowing for specialized functionality where needed.