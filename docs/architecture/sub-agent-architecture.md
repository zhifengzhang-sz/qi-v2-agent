# Sub-Agent Architecture Guide

## Table of Contents
- [Overview](#overview)
- [Architecture Principles](#architecture-principles)
- [Two-Route System Design](#two-route-system-design)
- [Workflow Integration](#workflow-integration)
- [Extension Patterns](#extension-patterns)
- [Performance Considerations](#performance-considerations)
- [Security Model](#security-model)

## Overview

The qi-v2-agent Sub-Agent Architecture implements a **hierarchical agent system** where specialized sub-agents handle specific domains of work, coordinated through an enhanced workflow engine. This design bridges the gap between raw tool execution and intelligent workflow orchestration.

### Design Philosophy

```
Intelligent Orchestration ↔ Specialized Execution ↔ Tool Integration
       ↑                           ↑                      ↑
   Agent Layer              Sub-Agent Layer          Tool Layer
(v-0.10.1+)                  (v-0.10.0)            (Existing)
```

**Key Principles:**
1. **Specialization**: Each sub-agent excels in a specific domain
2. **Composability**: Sub-agents can be combined for complex workflows  
3. **Extensibility**: New sub-agents can be added without system changes
4. **Integration**: Seamless integration with existing v-0.9.x workflows
5. **Observability**: Full visibility into sub-agent execution and performance

## Architecture Principles

### 1. Separation of Concerns

```typescript
interface SubAgentResponsibilities {
  // What sub-agents DO handle
  domainExpertise: 'file_operations' | 'code_analysis' | 'bug_fixing';
  toolCoordination: 'orchestrate multiple tools for domain tasks';
  progressReporting: 'stream execution progress with meaningful updates';
  errorRecovery: 'handle domain-specific error scenarios';
  
  // What sub-agents DON'T handle  
  workflowOrchestration: 'handled by workflow engine';
  globalState: 'handled by agent orchestrator';
  userInteraction: 'handled by agent layer';
  crossDomainDecisions: 'handled by decision engine';
}
```

### 2. Interface-Driven Design

All sub-agents implement the `ISubAgent` interface, ensuring:
- **Consistent API**: Same interface across all sub-agent types
- **Predictable Behavior**: Standard lifecycle and execution patterns
- **Easy Testing**: Mockable interfaces for comprehensive testing
- **Hot Swapping**: Runtime replacement of sub-agent implementations

### 3. Async Generator Streaming

Following Claude Code patterns, all sub-agents use async generators:

```typescript
// Enables real-time progress updates and cancellation
async function* subAgentExecution(): AsyncGenerator<SubAgentProgress, SubAgentResult> {
  yield { stage: 'initializing', progress: 0.1 };
  const analysis = await analyzeInput();
  
  yield { stage: 'planning', progress: 0.3 };
  const plan = await createExecutionPlan();
  
  yield { stage: 'executing', progress: 0.7 };
  const result = await executeTask();
  
  return { success: true, output: result };
}
```

### 4. Error Containment

Sub-agents handle errors at their level without propagating system failures:

```typescript
class SubAgentErrorHandling {
  // Errors that can be recovered at sub-agent level
  recoverableErrors = [
    'tool_execution_timeout',
    'temporary_resource_unavailable', 
    'retryable_api_failure'
  ];
  
  // Errors that must be escalated
  escalatingErrors = [
    'permission_denied',
    'system_resource_exhausted',
    'configuration_invalid'
  ];
  
  async handleError(error: QiError): Promise<ErrorAction> {
    if (this.recoverableErrors.includes(error.code)) {
      return this.attemptRecovery(error);
    } else {
      return this.escalateError(error);
    }
  }
}
```

## Two-Route System Design

### Route 1: Tool-Specialized Sub-Agents

**Purpose**: Optimize tool usage for specific categories of operations.

```typescript
interface ToolSpecializedSubAgent extends ISubAgent {
  // Specialized in coordinating specific tools
  toolRequirements: string[];
  toolOptimizations: ToolOptimization[];
  
  // Examples:
  // - FileToolSubAgent: Read, Write, Edit, Glob
  // - WebToolSubAgent: WebFetch, API calls, webhooks  
  // - GitToolSubAgent: git commands, version control
  // - TestToolSubAgent: test runners, result analysis
}

class FileToolSubAgent implements ToolSpecializedSubAgent {
  capabilities = [{
    type: 'file_operations',
    toolRequirements: ['Read', 'Write', 'Edit', 'Glob'],
    optimizations: [
      'batch_file_operations',      // Group multiple file ops
      'intelligent_caching',        // Cache frequently read files
      'change_detection',          // Track file modifications
      'permission_checking'        // Validate access before operations
    ]
  }];
}
```

**Benefits:**
- **Tool Expertise**: Deep knowledge of tool capabilities and limitations
- **Performance Optimization**: Tool-specific caching, batching, and efficiency
- **Error Handling**: Tool-specific error recovery and retry strategies
- **Resource Management**: Optimal resource allocation for tool operations

### Route 2: Workflow-Specialized Sub-Agents

**Purpose**: Implement domain-specific workflows that span multiple tools.

```typescript
interface WorkflowSpecializedSubAgent extends ISubAgent {
  // Specialized in domain-specific processes
  workflowPatterns: WorkflowPattern[];
  domainKnowledge: DomainKnowledge;
  
  // Examples:
  // - BugFixSubAgent: analyze → locate → fix → test
  // - CodeReviewSubAgent: fetch → analyze → critique → suggest
  // - FeatureImplSubAgent: plan → implement → test → document
}

class BugFixSubAgent implements WorkflowSpecializedSubAgent {
  workflowStages = [
    'error_analysis',     // Analyze error messages and stack traces
    'location_discovery', // Find bug location in codebase
    'root_cause_analysis',// Understand underlying cause
    'fix_generation',     // Generate appropriate fix
    'fix_application',    // Apply fix to code
    'verification'        // Test that fix resolves issue
  ];
  
  domainKnowledge = {
    errorPatterns: ErrorPatternDatabase,
    commonFixes: CommonFixDatabase,
    testStrategies: TestStrategyDatabase
  };
}
```

**Benefits:**  
- **Domain Expertise**: Deep understanding of domain-specific processes
- **Intelligent Workflow**: Adaptive execution based on intermediate results
- **Knowledge Application**: Leverage domain knowledge for better outcomes
- **End-to-End Responsibility**: Own complete domain workflows

## Workflow Integration

### Enhanced Workflow Engine

The existing v-0.9.x workflow engine is enhanced to support sub-agents:

```typescript
class EnhancedWorkflowEngine extends QiWorkflowEngine {
  constructor(
    private subAgentRegistry: SubAgentRegistry,
    config: IWorkflowEngineConfig
  ) {
    super(config);
  }
  
  // Override node creation to support sub-agent nodes
  protected createWorkflowNode(nodeSpec: WorkflowNodeSpec): WorkflowNode {
    if (nodeSpec.type === 'sub-agent') {
      return this.createSubAgentNode(nodeSpec);
    } else {
      return super.createWorkflowNode(nodeSpec);
    }
  }
  
  private createSubAgentNode(nodeSpec: SubAgentNodeSpec): SubAgentWorkflowNode {
    return {
      id: nodeSpec.id,
      name: nodeSpec.name,
      type: 'sub-agent',
      handler: this.createSubAgentHandler(nodeSpec.subAgentId, nodeSpec.task)
    };
  }
  
  private createSubAgentHandler(
    subAgentId: string, 
    taskDef: SubAgentTaskDefinition
  ): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      // Get sub-agent instance
      const subAgent = await this.subAgentRegistry.getInstance(subAgentId);
      
      // Create task from workflow state
      const task = this.createTaskFromWorkflowState(taskDef, state);
      
      // Execute sub-agent with streaming support
      const results = [];
      for await (const progress of subAgent.execute(task)) {
        // Can emit progress events for workflow monitoring
        this.emit('subAgentProgress', { nodeId: nodeSpec.id, progress });
      }
      
      // Update workflow state with sub-agent results
      return this.updateWorkflowStateWithResults(state, results);
    };
  }
}
```

### Workflow Definition Patterns

Sub-agents can be integrated into workflows in multiple ways:

```yaml
# 1. Direct Sub-Agent Node
workflow_pattern: "code_review"
nodes:
  - id: "fetch_code"
    type: "sub-agent"
    sub_agent: "file-tool-agent"
    task:
      type: "read_files"
      input:
        file_paths: ["${workflow.input.files}"]
  
  - id: "analyze_code" 
    type: "sub-agent"
    sub_agent: "code-analysis-agent"
    task:
      type: "analyze_quality"
      input:
        code: "${nodes.fetch_code.output.content}"

# 2. Conditional Sub-Agent Selection
  - id: "handle_error"
    type: "conditional"
    condition: "${workflow.input.error_type}"
    branches:
      syntax_error:
        type: "sub-agent"
        sub_agent: "syntax-fix-agent"
      logic_error:
        type: "sub-agent" 
        sub_agent: "bug-fix-agent"
      performance_issue:
        type: "sub-agent"
        sub_agent: "performance-optimizer-agent"

# 3. Parallel Sub-Agent Execution
  - id: "comprehensive_analysis"
    type: "parallel"
    branches:
      - type: "sub-agent"
        sub_agent: "code-analysis-agent"
        task: { type: "quality_check" }
      - type: "sub-agent"
        sub_agent: "security-scanner-agent" 
        task: { type: "vulnerability_scan" }
      - type: "sub-agent"
        sub_agent: "performance-profiler-agent"
        task: { type: "performance_analysis" }
```

### State Management

Workflow state is enhanced to support sub-agent execution:

```typescript
interface EnhancedWorkflowState extends WorkflowState {
  subAgentResults: Map<string, SubAgentResult>;
  subAgentProgress: Map<string, SubAgentProgress>;
  subAgentErrors: Map<string, QiError[]>;
  
  // Helper methods for sub-agent integration
  getSubAgentResult(nodeId: string): SubAgentResult | undefined;
  getSubAgentOutput<T>(nodeId: string): T | undefined;
  getAllSubAgentArtifacts(): SubAgentArtifact[];
}
```

## Extension Patterns

### 1. Sub-Agent Registry Pattern

```typescript
class SubAgentRegistry {
  private registrations = new Map<string, SubAgentRegistration>();
  private instances = new Map<string, ISubAgent>();
  
  // Registration methods
  registerSubAgent(registration: SubAgentRegistration): Result<void, QiError>;
  unregisterSubAgent(id: string): Result<void, QiError>;
  
  // Discovery methods  
  findByCapability(capability: string): ISubAgent[];
  findByToolRequirement(tool: string): ISubAgent[];
  findByWorkflowPattern(pattern: string): ISubAgent[];
  
  // Instance management
  getInstance(id: string): Promise<ISubAgent>;
  createInstance(id: string, config: SubAgentConfig): Promise<ISubAgent>;
  healthCheck(): Promise<Map<string, SubAgentHealth>>;
}

interface SubAgentRegistration {
  id: string;
  name: string;
  version: string;
  constructor: SubAgentConstructor;
  capabilities: SubAgentCapability[];
  defaultConfig: SubAgentConfig;
  metadata: {
    author: string;
    description: string;
    documentation: string;
    tags: string[];
  };
}
```

### 2. Plugin-Based Extension

```typescript
// External sub-agent plugins
interface SubAgentPlugin {
  manifest: {
    id: string;
    name: string;
    version: string;
    requires: {
      qiAgent: string;    // Minimum qi-agent version
      tools: string[];    // Required tools
      apis: string[];     // Required API access
    };
  };
  
  // Plugin lifecycle
  load(): Promise<SubAgentRegistration[]>;
  unload(): Promise<void>;
  configure(config: PluginConfig): Promise<void>;
}

class SubAgentPluginManager {
  async loadPlugin(pluginPath: string): Promise<Result<void, QiError>>;
  async loadFromNpm(packageName: string): Promise<Result<void, QiError>>;
  async loadFromGitHub(repoUrl: string): Promise<Result<void, QiError>>;
  
  // Plugin sandbox for security
  createSecureSandbox(plugin: SubAgentPlugin): PluginSandbox;
}
```

### 3. Dynamic Capability Matching

```typescript
class CapabilityMatcher {
  // Intelligent sub-agent selection based on task requirements
  async findBestSubAgent(
    task: SubAgentTask,
    availableSubAgents: ISubAgent[]
  ): Promise<Result<ISubAgent, QiError>> {
    
    const candidates = [];
    
    for (const subAgent of availableSubAgents) {
      const canHandleResult = await subAgent.canHandle(task);
      if (canHandleResult.success && canHandleResult.value) {
        const score = this.calculateCompatibilityScore(task, subAgent);
        candidates.push({ subAgent, score });
      }
    }
    
    if (candidates.length === 0) {
      return createError(
        createAgentError(
          AgentErrorCategory.VALIDATION,
          'No suitable sub-agent found for task',
          { taskType: task.type, taskDescription: task.description }
        )
      );
    }
    
    // Return highest scoring sub-agent
    const best = candidates.sort((a, b) => b.score - a.score)[0];
    return createResult(best.subAgent);
  }
  
  private calculateCompatibilityScore(
    task: SubAgentTask, 
    subAgent: ISubAgent
  ): number {
    let score = 0;
    
    // Capability match scoring
    for (const capability of subAgent.capabilities) {
      if (capability.type === task.type) {
        score += capability.confidence * 40; // Direct match bonus
      }
      
      if (capability.domains.some(domain => task.description.includes(domain))) {
        score += 20; // Domain match bonus
      }
      
      if (capability.workflowPatterns?.includes(task.context.workflowId)) {
        score += 15; // Workflow pattern match bonus
      }
    }
    
    // Tool availability scoring
    const availableTools = task.context.availableTools;
    const requiredTools = subAgent.capabilities.flatMap(c => c.toolRequirements);
    const toolMatch = requiredTools.filter(tool => availableTools.includes(tool)).length;
    const toolScore = (toolMatch / requiredTools.length) * 25;
    score += toolScore;
    
    return score;
  }
}
```

## Performance Considerations

### 1. Lazy Loading and Instance Pooling

```typescript
class PerformantSubAgentRegistry extends SubAgentRegistry {
  private instancePools = new Map<string, SubAgentPool>();
  private loadingCache = new Map<string, Promise<ISubAgent>>();
  
  // Lazy load sub-agents only when needed
  async getInstance(id: string): Promise<ISubAgent> {
    // Check if already loading
    if (this.loadingCache.has(id)) {
      return await this.loadingCache.get(id)!;
    }
    
    // Check instance pool first
    const pool = this.instancePools.get(id);
    if (pool && pool.hasAvailable()) {
      return pool.acquire();
    }
    
    // Create loading promise
    const loadingPromise = this.createInstance(id);
    this.loadingCache.set(id, loadingPromise);
    
    try {
      const instance = await loadingPromise;
      this.loadingCache.delete(id);
      return instance;
    } catch (error) {
      this.loadingCache.delete(id);
      throw error;
    }
  }
  
  // Pool management for expensive-to-create sub-agents
  configurePooling(id: string, poolConfig: {
    minSize: number;
    maxSize: number;
    idleTimeoutMs: number;
  }): void {
    this.instancePools.set(id, new SubAgentPool(poolConfig));
  }
}
```

### 2. Resource Monitoring and Limits

```typescript
class ResourceMonitor {
  private resourceUsage = new Map<string, ResourceUsage>();
  private limits: ResourceLimits;
  
  async trackSubAgentExecution(
    subAgentId: string,
    execution: AsyncGenerator<SubAgentProgress, SubAgentResult>
  ): Promise<SubAgentResult> {
    
    const startTime = Date.now();
    const startMemory = process.memoryUsage().heapUsed;
    
    try {
      let result: SubAgentResult;
      
      for await (const progress of execution) {
        // Check resource limits during execution
        await this.checkResourceLimits(subAgentId);
        
        // Track resource usage
        this.updateResourceUsage(subAgentId, progress);
        
        if (progress.progress >= 1.0) {
          result = progress.intermediateResults as SubAgentResult;
        }
      }
      
      return result!;
      
    } finally {
      // Record final resource usage
      const finalUsage = {
        executionTime: Date.now() - startTime,
        memoryUsed: process.memoryUsage().heapUsed - startMemory,
        cpuTime: process.cpuUsage().user
      };
      
      this.resourceUsage.set(subAgentId, finalUsage);
    }
  }
  
  async checkResourceLimits(subAgentId: string): Promise<void> {
    const usage = this.resourceUsage.get(subAgentId);
    if (!usage) return;
    
    if (usage.memoryUsed > this.limits.maxMemoryMB * 1024 * 1024) {
      throw createAgentError(
        AgentErrorCategory.RESOURCE,
        'Sub-agent exceeded memory limit',
        { subAgentId, memoryUsed: usage.memoryUsed, limit: this.limits.maxMemoryMB }
      );
    }
    
    if (usage.executionTime > this.limits.maxExecutionTimeMs) {
      throw createAgentError(
        AgentErrorCategory.RESOURCE,
        'Sub-agent exceeded execution time limit', 
        { subAgentId, executionTime: usage.executionTime, limit: this.limits.maxExecutionTimeMs }
      );
    }
  }
}
```

### 3. Caching and Memoization

```typescript
class SubAgentCache {
  private resultCache = new LRUCache<string, SubAgentResult>(1000);
  private progressCache = new Map<string, SubAgentProgress[]>();
  
  // Cache results for identical tasks
  async getCachedResult(task: SubAgentTask): Promise<SubAgentResult | undefined> {
    const cacheKey = this.generateCacheKey(task);
    return this.resultCache.get(cacheKey);
  }
  
  async setCachedResult(task: SubAgentTask, result: SubAgentResult): Promise<void> {
    const cacheKey = this.generateCacheKey(task);
    this.resultCache.set(cacheKey, result);
  }
  
  // Cache intermediate results for resume capability
  async cacheProgress(taskId: string, progress: SubAgentProgress): Promise<void> {
    if (!this.progressCache.has(taskId)) {
      this.progressCache.set(taskId, []);
    }
    this.progressCache.get(taskId)!.push(progress);
  }
  
  async resumeFromProgress(taskId: string): Promise<SubAgentProgress | undefined> {
    const progressHistory = this.progressCache.get(taskId);
    return progressHistory ? progressHistory[progressHistory.length - 1] : undefined;
  }
  
  private generateCacheKey(task: SubAgentTask): string {
    // Create deterministic key based on task content
    const keyData = {
      type: task.type,
      input: task.input,
      constraints: task.constraints
    };
    return hashObject(keyData);
  }
}
```

## Security Model

### 1. Sub-Agent Sandboxing

```typescript
class SubAgentSandbox {
  private permissions: SubAgentPermissions;
  private resourceLimits: ResourceLimits;
  private toolWhitelist: string[];
  
  constructor(config: SandboxConfig) {
    this.permissions = config.permissions;
    this.resourceLimits = config.resourceLimits;
    this.toolWhitelist = config.allowedTools;
  }
  
  // Wrap sub-agent execution in security constraints
  async executeSecurely(
    subAgent: ISubAgent,
    task: SubAgentTask
  ): Promise<SubAgentResult> {
    
    // Validate permissions
    await this.validatePermissions(subAgent, task);
    
    // Create restricted tool executor
    const restrictedToolExecutor = this.createRestrictedToolExecutor(
      task.context.toolExecutor,
      this.toolWhitelist
    );
    
    // Create sandboxed context
    const sandboxedContext = {
      ...task.context,
      toolExecutor: restrictedToolExecutor
    };
    
    // Execute with resource monitoring
    const sandboxedTask = { ...task, context: sandboxedContext };
    
    return await this.monitorExecution(
      subAgent.execute(sandboxedTask)
    );
  }
  
  private async validatePermissions(
    subAgent: ISubAgent, 
    task: SubAgentTask
  ): Promise<void> {
    // Check file access permissions
    if (task.type.includes('file') || task.type.includes('read') || task.type.includes('write')) {
      if (!this.permissions.fileAccess.allowed) {
        throw createAgentError(
          AgentErrorCategory.SECURITY,
          'Sub-agent does not have file access permission',
          { subAgentId: subAgent.id, taskType: task.type }
        );
      }
      
      // Check specific path permissions
      if (this.permissions.fileAccess.restrictedPaths) {
        const taskPath = this.extractPathFromTask(task);
        if (taskPath && this.isPathRestricted(taskPath)) {
          throw createAgentError(
            AgentErrorCategory.SECURITY,
            'Sub-agent access denied to restricted path',
            { subAgentId: subAgent.id, path: taskPath }
          );
        }
      }
    }
    
    // Check network access permissions
    if (task.type.includes('web') || task.type.includes('api')) {
      if (!this.permissions.networkAccess.allowed) {
        throw createAgentError(
          AgentErrorCategory.SECURITY,
          'Sub-agent does not have network access permission',
          { subAgentId: subAgent.id, taskType: task.type }
        );
      }
    }
  }
}

interface SubAgentPermissions {
  fileAccess: {
    allowed: boolean;
    restrictedPaths?: string[];
    allowedExtensions?: string[];
  };
  networkAccess: {
    allowed: boolean;
    allowedHosts?: string[];
    blockedHosts?: string[];
  };
  shellAccess: {
    allowed: boolean;
    allowedCommands?: string[];
    blockedCommands?: string[];
  };
}
```

### 2. Audit Logging

```typescript
class SubAgentAuditLogger {
  async logSubAgentExecution(
    subAgentId: string,
    task: SubAgentTask,
    result: SubAgentResult
  ): Promise<void> {
    
    const auditEntry = {
      timestamp: new Date().toISOString(),
      subAgentId,
      taskId: task.id,
      taskType: task.type,
      sessionId: task.context.sessionId,
      success: result.success,
      executionTime: result.metadata.executionTime,
      toolsUsed: result.metadata.toolsUsed,
      resourcesConsumed: result.metadata.resourcesConsumed,
      // Security relevant fields
      fileAccessPaths: this.extractFileAccessPaths(task, result),
      networkRequests: this.extractNetworkRequests(task, result),
      shellCommands: this.extractShellCommands(task, result)
    };
    
    await this.writeAuditLog(auditEntry);
  }
  
  async auditPermissionDenial(
    subAgentId: string,
    task: SubAgentTask,
    deniedPermission: string,
    reason: string
  ): Promise<void> {
    
    const auditEntry = {
      timestamp: new Date().toISOString(),
      type: 'PERMISSION_DENIED',
      subAgentId,
      taskId: task.id,
      deniedPermission,
      reason,
      sessionId: task.context.sessionId,
      severity: 'HIGH'
    };
    
    await this.writeAuditLog(auditEntry);
  }
}
```

This comprehensive architecture documentation provides the foundation for understanding how sub-agents work within the qi-v2-agent system. The design balances specialization with integration, performance with security, and flexibility with consistency.

The next step would be creating specific development guides for building custom sub-agents and integrating them into workflows.