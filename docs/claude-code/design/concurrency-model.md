# Concurrency Model and Parallel Execution

Claude Code implements a sophisticated concurrency model that enables parallel tool execution while maintaining safety, resource management, and system stability.

## System Overview

The concurrency model is built around the UH1 scheduler and intelligent safety analysis, allowing up to 10 concurrent tool executions with dynamic load balancing:

```
┌─────────────────────────────────────────────────────────────────┐
│                 Concurrency Control Architecture               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Tool Safety │  │ UH1 Scheduler│  │ Resource Manager    │      │
│  │ Analyzer    │  │             │  │                     │      │
│  │ (mW5)       │  │             │  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                   Execution Strategies                         │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Parallel    │  │ Sequential  │  │ Hybrid Execution    │      │
│  │ Execution   │  │ Execution   │  │ Strategy            │      │
│  │ (uW5)       │  │ (dW5)       │  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                     Safety Mechanisms                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Conflict    │  │ Resource    │  │ Error Isolation     │      │
│  │ Detection   │  │ Contention  │  │                     │      │
│  │             │  │ Prevention  │  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. UH1 Scheduler - Concurrent Execution Controller

The `UH1` function serves as the primary concurrency scheduler, managing parallel execution of multiple async generators:

```javascript
async function* UH1(generators, maxConcurrency = Infinity) {
  // Initialize execution state
  const activePromises = new Map();
  const pendingGenerators = [...generators];
  const completedGenerators = new Set();
  
  // Start initial batch of generators
  while (activePromises.size < maxConcurrency && pendingGenerators.length > 0) {
    const generator = pendingGenerators.shift();
    const promise = startGenerator(generator);
    activePromises.set(generator, promise);
  }
  
  // Process results as they complete
  while (activePromises.size > 0) {
    // Race condition - yield results as they arrive
    const { value, generator } = await Promise.race([...activePromises.values()]);
    
    if (value.done) {
      // Generator completed
      activePromises.delete(generator);
      completedGenerators.add(generator);
      
      // Start next pending generator if available
      if (pendingGenerators.length > 0) {
        const nextGenerator = pendingGenerators.shift();
        const nextPromise = startGenerator(nextGenerator);
        activePromises.set(nextGenerator, nextPromise);
      }
    } else {
      // Yield intermediate result
      yield value.result;
      
      // Continue generator execution
      const nextPromise = continueGenerator(generator);
      activePromises.set(generator, nextPromise);
    }
  }
}
```

**Key Features:**
- **Dynamic Concurrency**: Adjustable maximum concurrent executions (default: 10)
- **Promise Racing**: Uses `Promise.race()` to yield results as they become available
- **Queue Management**: Automatically starts new generators as slots become available
- **Error Isolation**: Individual generator failures don't affect others

### 2. Concurrency Safety Analysis (mW5)

The safety analyzer intelligently groups tools based on their concurrency characteristics:

```javascript
function analyzeConcurrencySafety(toolCalls, sessionState) {
  const executionBlocks = [];
  let currentBlock = [];
  
  for (const toolCall of toolCalls) {
    const tool = sessionState.tools.find(t => t.name === toolCall.name);
    
    if (!tool) {
      // Invalid tool - force sequential execution
      if (currentBlock.length > 0) {
        executionBlocks.push({ type: 'parallel', tools: currentBlock });
        currentBlock = [];
      }
      executionBlocks.push({ type: 'sequential', tools: [toolCall] });
      continue;
    }
    
    // Check concurrency safety
    const isSafe = tool.isConcurrencySafe();
    
    if (isSafe && currentBlock.length === 0) {
      // Start new parallel block
      currentBlock.push(toolCall);
    } else if (isSafe && isCompatibleWithCurrentBlock(toolCall, currentBlock)) {
      // Add to existing parallel block
      currentBlock.push(toolCall);
    } else {
      // Not safe or incompatible - finalize current block and start sequential
      if (currentBlock.length > 0) {
        executionBlocks.push({ 
          type: currentBlock.length > 1 ? 'parallel' : 'sequential', 
          tools: currentBlock 
        });
        currentBlock = [];
      }
      executionBlocks.push({ type: 'sequential', tools: [toolCall] });
    }
  }
  
  // Finalize remaining block
  if (currentBlock.length > 0) {
    executionBlocks.push({ 
      type: currentBlock.length > 1 ? 'parallel' : 'sequential', 
      tools: currentBlock 
    });
  }
  
  return executionBlocks;
}

function isCompatibleWithCurrentBlock(newTool, currentTools) {
  // Check for resource conflicts
  const newResources = getToolResources(newTool);
  const currentResources = currentTools.flatMap(getToolResources);
  
  // File system conflicts
  if (hasFileSystemConflicts(newResources, currentResources)) {
    return false;
  }
  
  // Network resource conflicts
  if (hasNetworkConflicts(newResources, currentResources)) {
    return false;
  }
  
  // Memory intensive operations
  if (isMemoryIntensive(newTool) && currentTools.some(isMemoryIntensive)) {
    return false;
  }
  
  return true;
}
```

### 3. Tool Safety Classification

Tools are classified into concurrency safety categories:

```typescript
enum ConcurrencySafetyLevel {
  SAFE = 'safe',           // Can run concurrently with any tool
  CONDITIONAL = 'conditional', // Safe with specific conditions
  UNSAFE = 'unsafe'        // Must run sequentially
}

interface ToolConcurrencyProfile {
  safetyLevel: ConcurrencySafetyLevel;
  resourceRequirements: ResourceRequirement[];
  conflictsWith: string[];         // Tools that conflict
  maxConcurrentInstances: number;  // Limit for this tool type
}

// Tool Classification Examples
const toolProfiles: Record<string, ToolConcurrencyProfile> = {
  'read': {
    safetyLevel: ConcurrencySafetyLevel.SAFE,
    resourceRequirements: [{ type: 'file', mode: 'read' }],
    conflictsWith: [],
    maxConcurrentInstances: 10
  },
  
  'write': {
    safetyLevel: ConcurrencySafetyLevel.UNSAFE,
    resourceRequirements: [{ type: 'file', mode: 'write' }],
    conflictsWith: ['edit', 'multiedit'],
    maxConcurrentInstances: 1
  },
  
  'edit': {
    safetyLevel: ConcurrencySafetyLevel.CONDITIONAL,
    resourceRequirements: [{ type: 'file', mode: 'write' }],
    conflictsWith: ['write', 'multiedit'],
    maxConcurrentInstances: 1
  },
  
  'bash': {
    safetyLevel: ConcurrencySafetyLevel.CONDITIONAL,
    resourceRequirements: [{ type: 'process', mode: 'execute' }],
    conflictsWith: [],
    maxConcurrentInstances: 3
  },
  
  'webfetch': {
    safetyLevel: ConcurrencySafetyLevel.SAFE,
    resourceRequirements: [{ type: 'network', mode: 'http' }],
    conflictsWith: [],
    maxConcurrentInstances: 5
  }
};
```

## Execution Strategies

### 1. Parallel Execution Strategy (uW5)

For concurrency-safe tools that can run simultaneously:

```javascript
async function* executeParallel(toolGroup, context) {
  const generators = toolGroup.tools.map(toolCall => 
    executeSingleTool(toolCall, context)
  );
  
  // Use UH1 scheduler for parallel execution
  yield* UH1(generators, Math.min(toolGroup.tools.length, MAX_CONCURRENCY));
}
```

### 2. Sequential Execution Strategy (dW5)

For tools that require sequential execution:

```javascript
async function* executeSequential(toolGroup, context) {
  for (const toolCall of toolGroup.tools) {
    // Execute one at a time
    yield* executeSingleTool(toolCall, context);
    
    // Check for abort signals between tools
    if (context.abortSignal?.aborted) {
      break;
    }
  }
}
```

### 3. Hybrid Execution Strategy

Combines parallel and sequential execution based on dynamic analysis:

```javascript
async function* executeHybrid(executionPlan, context) {
  for (const block of executionPlan.blocks) {
    if (block.type === 'parallel') {
      yield* executeParallel(block, context);
    } else {
      yield* executeSequential(block, context);
    }
    
    // Resource cleanup between blocks
    await cleanupResources(block);
  }
}
```

## Resource Management

### 1. Resource Pool Management

```javascript
class ResourcePool {
  constructor() {
    this.fileHandles = new Set();
    this.networkConnections = new Map();
    this.processHandles = new Set();
    this.memoryUsage = new Map();
  }
  
  async acquireResource(type, identifier, tool) {
    switch (type) {
      case 'file':
        return this.acquireFileResource(identifier, tool);
      case 'network':
        return this.acquireNetworkResource(identifier, tool);
      case 'process':
        return this.acquireProcessResource(identifier, tool);
      case 'memory':
        return this.acquireMemoryResource(identifier, tool);
    }
  }
  
  async acquireFileResource(filePath, tool) {
    // Check for write conflicts
    if (tool.requiresWrite && this.fileHandles.has(filePath)) {
      throw new ResourceConflictError(
        `File ${filePath} is already in use`
      );
    }
    
    // Track resource usage
    this.fileHandles.add(filePath);
    
    return {
      release: () => this.fileHandles.delete(filePath)
    };
  }
  
  getResourceUsage() {
    return {
      files: this.fileHandles.size,
      networks: this.networkConnections.size,
      processes: this.processHandles.size,
      memoryMB: Array.from(this.memoryUsage.values())
        .reduce((sum, usage) => sum + usage, 0)
    };
  }
}
```

### 2. Backpressure Management

```javascript
class BackpressureManager {
  constructor(maxConcurrency = 10) {
    this.maxConcurrency = maxConcurrency;
    this.activeCount = 0;
    this.pendingQueue = [];
    this.resourceThresholds = {
      memoryMB: 1000,
      fileHandles: 100,
      networkConnections: 50
    };
  }
  
  async requestExecution(toolCall, priority = 0) {
    // Check resource availability
    const resourceUsage = this.getResourceUsage();
    if (this.isResourceExhausted(resourceUsage)) {
      await this.waitForResources();
    }
    
    // Check concurrency limits
    if (this.activeCount >= this.maxConcurrency) {
      await this.waitForSlot(priority);
    }
    
    this.activeCount++;
    return {
      release: () => {
        this.activeCount--;
        this.processQueue();
      }
    };
  }
  
  isResourceExhausted(usage) {
    return usage.memoryMB > this.resourceThresholds.memoryMB ||
           usage.fileHandles > this.resourceThresholds.fileHandles ||
           usage.networkConnections > this.resourceThresholds.networkConnections;
  }
}
```

## Conflict Detection and Resolution

### 1. Conflict Detection Matrix

```javascript
class ConflictDetector {
  constructor() {
    this.conflictMatrix = {
      'file_write': ['file_write', 'file_edit'],
      'file_edit': ['file_write', 'file_edit'],
      'process_spawn': ['process_spawn'],
      'network_bind': ['network_bind']
    };
  }
  
  detectConflicts(toolA, toolB) {
    const conflictsA = this.getToolConflicts(toolA);
    const conflictsB = this.getToolConflicts(toolB);
    
    // Resource conflicts
    const resourceConflicts = this.detectResourceConflicts(conflictsA, conflictsB);
    
    // State conflicts
    const stateConflicts = this.detectStateConflicts(toolA, toolB);
    
    return {
      hasConflicts: resourceConflicts.length > 0 || stateConflicts.length > 0,
      resourceConflicts,
      stateConflicts
    };
  }
  
  detectResourceConflicts(resourcesA, resourcesB) {
    const conflicts = [];
    
    for (const resourceA of resourcesA) {
      for (const resourceB of resourcesB) {
        if (this.isResourceConflict(resourceA, resourceB)) {
          conflicts.push({
            type: 'resource',
            resourceA,
            resourceB,
            reason: 'Concurrent access not allowed'
          });
        }
      }
    }
    
    return conflicts;
  }
}
```

### 2. Conflict Resolution Strategies

```javascript
class ConflictResolver {
  async resolveConflicts(conflictingTools) {
    const strategies = [
      this.tryResourceSharing,
      this.trySequentialExecution,
      this.tryResourceAlternatives,
      this.tryToolAlternatives
    ];
    
    for (const strategy of strategies) {
      const resolution = await strategy(conflictingTools);
      if (resolution.success) {
        return resolution;
      }
    }
    
    // Fallback to sequential execution
    return {
      success: true,
      strategy: 'sequential',
      plan: this.createSequentialPlan(conflictingTools)
    };
  }
  
  async tryResourceSharing(tools) {
    // Attempt to share resources where possible
    const shareableResources = tools.filter(tool => 
      tool.allowsResourceSharing
    );
    
    if (shareableResources.length === tools.length) {
      return {
        success: true,
        strategy: 'shared_parallel',
        plan: this.createSharedPlan(tools)
      };
    }
    
    return { success: false };
  }
}
```

## Performance Optimization

### 1. Execution Monitoring and Metrics

```javascript
class ExecutionMonitor {
  constructor() {
    this.metrics = {
      totalExecutions: 0,
      concurrentExecutions: 0,
      averageExecutionTime: 0,
      resourceUtilization: {},
      errorRates: {}
    };
  }
  
  trackExecution(toolName, executionTime, resources) {
    this.metrics.totalExecutions++;
    this.updateAverageExecutionTime(executionTime);
    this.trackResourceUtilization(toolName, resources);
  }
  
  getOptimalConcurrency(toolName) {
    const history = this.metrics.toolHistory[toolName] || [];
    const avgTime = history.reduce((sum, h) => sum + h.time, 0) / history.length;
    const errorRate = history.filter(h => h.error).length / history.length;
    
    // Adjust concurrency based on performance
    if (errorRate > 0.1) {
      return Math.max(1, Math.floor(this.currentConcurrency * 0.8));
    } else if (avgTime < this.targetExecutionTime) {
      return Math.min(this.maxConcurrency, this.currentConcurrency + 1);
    }
    
    return this.currentConcurrency;
  }
}
```

### 2. Dynamic Load Balancing

```javascript
class LoadBalancer {
  constructor() {
    this.loadMetrics = new Map();
    this.rebalanceThreshold = 0.8;
  }
  
  async balanceLoad(toolQueue) {
    const currentLoad = this.calculateCurrentLoad();
    
    if (currentLoad > this.rebalanceThreshold) {
      return this.rebalanceExecution(toolQueue);
    }
    
    return toolQueue;
  }
  
  rebalanceExecution(toolQueue) {
    // Sort tools by execution time and resource requirements
    const sortedTools = toolQueue.sort((a, b) => {
      const scoreA = this.calculateToolScore(a);
      const scoreB = this.calculateToolScore(b);
      return scoreA - scoreB;
    });
    
    // Group tools to balance load
    return this.createBalancedGroups(sortedTools);
  }
  
  calculateToolScore(tool) {
    const timeWeight = 0.4;
    const resourceWeight = 0.3;
    const priorityWeight = 0.3;
    
    const timeScore = this.getAverageExecutionTime(tool.name);
    const resourceScore = this.getResourceRequirementScore(tool);
    const priorityScore = tool.priority || 0;
    
    return (timeScore * timeWeight) + 
           (resourceScore * resourceWeight) + 
           (priorityScore * priorityWeight);
  }
}
```

## Error Handling and Recovery

### 1. Concurrent Error Isolation

```javascript
class ConcurrentErrorHandler {
  async handleConcurrentErrors(errors, activeTools) {
    const criticalErrors = errors.filter(e => e.severity === 'critical');
    const recoverableErrors = errors.filter(e => e.severity === 'recoverable');
    
    // Handle critical errors - may require stopping all tools
    if (criticalErrors.length > 0) {
      await this.handleCriticalErrors(criticalErrors, activeTools);
    }
    
    // Handle recoverable errors - retry or continue
    for (const error of recoverableErrors) {
      await this.handleRecoverableError(error);
    }
  }
  
  async handleCriticalErrors(errors, activeTools) {
    // Cancel all active tools if system integrity at risk
    if (this.threatensSystemIntegrity(errors)) {
      await this.cancelAllActiveTools(activeTools);
      throw new SystemError('Critical system error - all operations cancelled');
    }
    
    // Cancel only conflicting tools
    const conflictingTools = this.findConflictingTools(errors, activeTools);
    await this.cancelTools(conflictingTools);
  }
}
```

This sophisticated concurrency model enables Claude Code to execute multiple tools efficiently while maintaining safety and system stability, providing optimal performance for complex development workflows.