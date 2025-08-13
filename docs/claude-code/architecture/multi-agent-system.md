# Claude Code Multi-Agent System Architecture

## Overview

Claude Code implements a sophisticated multi-agent architecture that enables complex task decomposition through SubAgent isolation and coordination. This system allows the main agent to delegate specialized tasks to independent SubAgents while maintaining security, resource isolation, and result aggregation. This document details the complete implementation based on reverse engineering analysis.

## Multi-Agent Architecture Overview

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                        Main Agent (nO)                         │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Primary conversation loop                                   ││
│  │ Context management                                          ││
│  │ Tool coordination                                           ││
│  │ SubAgent orchestration                                      ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────────────┘
                      │ Task Tool Invocation
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Task Tool (p_2)                            │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Input validation (CN5 schema)                              ││
│  │ SubAgent instantiation management                           ││
│  │ Resource allocation and limits                              ││
│  │ Permission inheritance control                              ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────┬───────────────────────────────────────────┘
                      │ SubAgent Creation
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                  SubAgent Layer (I2A)                          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐            │
│  │ SubAgent-1  │  │ SubAgent-2  │  │ SubAgent-N  │            │
│  │             │  │             │  │             │            │
│  │ Isolated    │  │ Isolated    │  │ Isolated    │            │
│  │ Context     │  │ Context     │  │ Context     │            │
│  │             │  │             │  │             │            │
│  │ Tool Subset │  │ Tool Subset │  │ Tool Subset │            │
│  │             │  │             │  │             │            │
│  │ Independent │  │ Independent │  │ Independent │            │
│  │ Execution   │  │ Execution   │  │ Execution   │            │
│  └─────────────┘  └─────────────┘  └─────────────┘            │
└─────────────────────┬───────────────────────────────────────────┘
                      │ Result Aggregation
                      ▼
┌─────────────────────────────────────────────────────────────────┐
│                Result Synthesis (KN5)                          │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │ Multi-agent result consolidation                            ││
│  │ Conflict resolution                                         ││
│  │ Response formatting                                         ││
│  │ Performance metrics aggregation                             ││
│  └─────────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────────┘
```

## Task Tool Implementation

### Core Task Tool Definition (p_2)

The Task tool serves as the entry point for multi-agent orchestration:

```javascript
// Source: improved-claude-code-5.mjs:62435-62569
const taskTool = {
  name: "Task", // cX constant
  
  // Dynamic description generation
  async prompt({ tools: availableTools }) {
    const toolNames = availableTools
      .filter(tool => tool.name !== "Task") // Prevent recursion
      .map(tool => tool.name)
      .join(", ");
      
    return `Launch a new agent that has access to the following tools: ${toolNames}.
    
When you are searching for a keyword or file and are not confident that you will find the right match in the first few tries, use the Agent tool to perform the search for you.

When to use the Agent tool:
- If you are searching for a keyword like "config" or "logger", or for questions like "which file does X?", the Agent tool is strongly recommended

When NOT to use the Agent tool:
- If you want to read a specific file path, use the Read or Glob tool instead of the Agent tool, to find the match more quickly
- If you are searching for a specific class definition like "class Foo", use the Glob tool instead, to find the match more quickly
- If you are searching for code within a specific file or set of 2-3 files, use the Read tool instead of the Agent tool, to find the match more quickly
- Writing code and running bash commands (use other tools for that)
- Other tasks that are not related to searching for a keyword or file

Usage notes:
1. Launch multiple agents concurrently whenever possible, to maximize performance; to do that, use a single message with multiple tool uses
2. When the agent is done, it will return a single message back to you. The result returned by the agent is not visible to the user. To show the user the result, you should send a text message back to the user with a concise summary of the result.
3. Each agent invocation is stateless. You will not be able to send additional messages to the agent, nor will the agent be able to communicate with you outside of its final report. Therefore, your prompt should contain a highly detailed task description for the agent to perform autonomously and you should specify exactly what information the agent should return back to you in its final and only message to you.
4. The agent's outputs should generally be trusted
5. Clearly tell the agent whether you expect it to write code or just to do research (search, file reads, web fetches, etc.), since it is not aware of the user's intent`;
  },
  
  async description() {
    return "Launch a new task";
  },
  
  // Input validation schema
  inputSchema: {
    type: "object",
    properties: {
      description: {
        type: "string",
        description: "A short (3-5 word) description of the task"
      },
      prompt: {
        type: "string", 
        description: "The task for the agent to perform"
      }
    },
    required: ["description", "prompt"]
  },
  
  // Core execution function
  async* call({ prompt: taskPrompt }, context, permissionContext, options) {
    // Delegate to SubAgent creation function
    yield* createSubAgent(taskPrompt, context, permissionContext, options);
  },
  
  // Tool characteristics
  isReadOnly() { return true; },
  isConcurrencySafe() { return true; },
  isEnabled() { return true; },
  userFacingName() { return "Task"; },
  
  // Permission handling
  async checkPermissions(input) {
    return { behavior: "allow", updatedInput: input };
  }
};
```

### Input Schema Validation (CN5)

```javascript
// Source: improved-claude-code-5.mjs:62321-62324
const taskInputSchema = {
  type: "object",
  properties: {
    description: {
      type: "string",
      description: "A short (3-5 word) description of the task",
      minLength: 1,
      maxLength: 100
    },
    prompt: {
      type: "string",
      description: "The task for the agent to perform",
      minLength: 10,
      maxLength: 10000
    }
  },
  required: ["description", "prompt"],
  additionalProperties: false
};

// Validation example
function validateTaskInput(input) {
  const result = taskInputSchema.safeParse(input);
  
  if (!result.success) {
    throw new ValidationError(
      `Invalid task input: ${result.error.message}`
    );
  }
  
  return result.data;
}
```

## SubAgent Creation and Management (I2A)

### SubAgent Instantiation Function

```javascript
// Source: improved-claude-code-5.mjs:62353-62433
async function* createSubAgent(
  taskPrompt,           // Task description and instructions
  parentContext,        // Parent agent context
  permissionContext,    // Permission inheritance
  options = {}          // Additional configuration
) {
  // Extract parent context components
  const {
    abortController,
    options: {
      debug,
      verbose,
      isNonInteractiveSession
    },
    getToolPermissionContext,
    readFileState,
    setInProgressToolUseIDs,
    tools
  } = parentContext;
  
  // Extract SubAgent-specific options
  const {
    isSynthesis = false,
    systemPrompt,
    model
  } = options;
  
  // Generate unique SubAgent identifier
  const subAgentId = generateUniqueId();
  
  try {
    // Phase 1: Create isolated execution context
    const isolatedContext = createIsolatedContext(parentContext, {
      subAgentId,
      inheritedPermissions: permissionContext,
      toolSubset: filterToolsForSubAgent(tools),
      resourceLimits: calculateResourceLimits(parentContext),
      securityConstraints: applySecurityConstraints(parentContext)
    });
    
    // Phase 2: Prepare SubAgent configuration
    const subAgentConfig = {
      model: model || parentContext.options.model,
      maxTokens: 4096,
      temperature: 0.1,
      tools: isolatedContext.tools,
      systemPrompt: systemPrompt || generateSubAgentSystemPrompt(),
      abortController: createSubAgentAbortController(abortController)
    };
    
    // Phase 3: Initialize SubAgent state
    const subAgentState = {
      messages: [
        {
          role: "user",
          content: formatTaskPrompt(taskPrompt)
        }
      ],
      startTime: Date.now(),
      parentId: parentContext.sessionId,
      agentId: subAgentId,
      status: "initializing"
    };
    
    // Phase 4: Execute SubAgent main loop
    yield { 
      type: "subagent_start", 
      agentId: subAgentId,
      task: taskPrompt
    };
    
    const subAgentResults = [];
    
    // Run isolated agent loop
    for await (const result of agentMainLoop(
      subAgentState.messages,
      subAgentConfig.systemPrompt,
      subAgentConfig.maxTokens,
      subAgentConfig.tools,
      isolatedContext.getToolPermissionContext,
      subAgentConfig.abortController,
      null, // No turn state for SubAgent
      null, // No fallback model
      { isSubAgent: true, parentId: parentContext.sessionId }
    )) {
      // Filter and forward appropriate results
      if (shouldForwardToParent(result)) {
        yield formatSubAgentResult(result, subAgentId);
      }
      
      // Collect results for final synthesis
      if (isExecutionResult(result)) {
        subAgentResults.push(result);
      }
    }
    
    // Phase 5: Generate synthesis response
    if (isSynthesis && subAgentResults.length > 1) {
      const synthesisResult = await synthesizeResults(
        subAgentResults, 
        taskPrompt,
        isolatedContext
      );
      
      yield {
        type: "subagent_synthesis",
        agentId: subAgentId,
        originalResults: subAgentResults.length,
        synthesizedResult: synthesisResult
      };
    }
    
    // Phase 6: Finalize SubAgent execution
    yield {
      type: "subagent_complete",
      agentId: subAgentId,
      executionTime: Date.now() - subAgentState.startTime,
      resultCount: subAgentResults.length,
      success: true
    };
    
  } catch (error) {
    // SubAgent error handling
    yield {
      type: "subagent_error",
      agentId: subAgentId,
      error: error.message,
      stack: error.stack
    };
    
    // Log error for debugging
    console.error(`SubAgent ${subAgentId} failed:`, error);
    
  } finally {
    // Cleanup SubAgent resources
    await cleanupSubAgentResources(subAgentId);
  }
}
```

### Isolation Context Creation

```javascript
// Create isolated execution environment for SubAgent
function createIsolatedContext(parentContext, isolationConfig) {
  const {
    subAgentId,
    inheritedPermissions,
    toolSubset,
    resourceLimits,
    securityConstraints
  } = isolationConfig;
  
  return {
    // Isolated session identifier
    sessionId: `subagent_${subAgentId}`,
    
    // Inherited but scoped permissions
    getToolPermissionContext: createScopedPermissionContext(
      parentContext.getToolPermissionContext,
      inheritedPermissions,
      securityConstraints
    ),
    
    // Filtered tool subset
    tools: toolSubset,
    
    // Resource-limited abort controller
    abortController: createResourceLimitedAbortController(
      parentContext.abortController,
      resourceLimits
    ),
    
    // Isolated file state
    readFileState: createIsolatedFileState(
      parentContext.readFileState,
      securityConstraints.allowedPaths
    ),
    
    // Scoped progress tracking
    setInProgressToolUseIDs: createScopedProgressTracker(subAgentId),
    
    // Configuration inheritance
    options: {
      ...parentContext.options,
      // Override specific options for SubAgent
      maxThinkingTokens: Math.min(
        parentContext.options.maxThinkingTokens,
        resourceLimits.maxThinkingTokens || 1000
      ),
      model: resourceLimits.model || parentContext.options.model,
      isNonInteractiveSession: true, // SubAgents are always non-interactive
      debug: parentContext.options.debug,
      verbose: false // Reduce verbosity for SubAgents
    }
  };
}
```

### Tool Filtering for SubAgents

```javascript
// Filter and configure tools for SubAgent execution
function filterToolsForSubAgent(parentTools) {
  // Tools prohibited for SubAgents
  const prohibitedTools = ['Task']; // Prevent recursive SubAgent creation
  
  // Tools with modified behavior for SubAgents
  const modifiedTools = {
    'Bash': createRestrictedBashTool(),
    'Write': createSandboxedWriteTool(),
    'Edit': createSandboxedEditTool()
  };
  
  return parentTools
    .filter(tool => !prohibitedTools.includes(tool.name))
    .map(tool => {
      if (modifiedTools[tool.name]) {
        return modifiedTools[tool.name];
      }
      
      // Apply SubAgent-specific configurations
      return {
        ...tool,
        // Reduce timeout for SubAgent tools
        timeout: Math.min(tool.timeout || 30000, 15000),
        
        // Add SubAgent context to all tools
        call: async function*(input, context, ...args) {
          const subAgentContext = {
            ...context,
            isSubAgent: true,
            parentSession: context.sessionId
          };
          
          yield* tool.call(input, subAgentContext, ...args);
        }
      };
    });
}
```

## Resource Management and Limits

### Resource Allocation Strategy

```javascript
// Calculate resource limits for SubAgent
function calculateResourceLimits(parentContext) {
  const parentLimits = parentContext.resourceLimits || getDefaultLimits();
  
  return {
    // Memory limits (percentage of parent)
    maxMemory: Math.floor(parentLimits.maxMemory * 0.3),
    
    // Token limits
    maxThinkingTokens: Math.min(parentLimits.maxThinkingTokens, 1000),
    maxResponseTokens: Math.min(parentLimits.maxResponseTokens, 2048),
    
    // Execution time limits
    maxExecutionTime: Math.min(parentLimits.maxExecutionTime, 60000), // 1 minute
    
    // Tool execution limits
    maxToolCalls: Math.min(parentLimits.maxToolCalls, 20),
    maxConcurrentTools: Math.min(parentLimits.maxConcurrentTools, 3),
    
    // File system limits
    maxFileReads: 10,
    maxFileWrites: 5,
    maxFileSize: 1024 * 1024, // 1MB
    
    // Network limits
    maxNetworkRequests: 5,
    networkTimeout: 10000 // 10 seconds
  };
}

// Resource monitoring for SubAgent
class SubAgentResourceMonitor {
  constructor(subAgentId, limits) {
    this.subAgentId = subAgentId;
    this.limits = limits;
    this.usage = {
      memory: 0,
      tokensUsed: 0,
      executionTime: 0,
      toolCalls: 0,
      fileReads: 0,
      fileWrites: 0,
      networkRequests: 0
    };
    this.startTime = Date.now();
  }
  
  checkResourceUsage(operation, amount) {
    const currentUsage = this.usage[operation] + amount;
    const limit = this.limits[`max${operation.charAt(0).toUpperCase() + operation.slice(1)}`];
    
    if (currentUsage > limit) {
      throw new ResourceLimitExceededError(
        `SubAgent ${this.subAgentId} exceeded ${operation} limit: ${currentUsage} > ${limit}`
      );
    }
    
    this.usage[operation] = currentUsage;
  }
  
  checkExecutionTime() {
    const executionTime = Date.now() - this.startTime;
    if (executionTime > this.limits.maxExecutionTime) {
      throw new TimeoutError(
        `SubAgent ${this.subAgentId} exceeded execution time limit: ${executionTime}ms`
      );
    }
  }
  
  getResourceReport() {
    return {
      subAgentId: this.subAgentId,
      usage: this.usage,
      limits: this.limits,
      utilization: Object.keys(this.usage).reduce((acc, key) => {
        const limitKey = `max${key.charAt(0).toUpperCase() + key.slice(1)}`;
        acc[key] = this.limits[limitKey] ? 
          (this.usage[key] / this.limits[limitKey]) * 100 : 0;
        return acc;
      }, {})
    };
  }
}
```

### Security Constraints

```javascript
// Apply security constraints for SubAgent execution
function applySecurityConstraints(parentContext) {
  const parentConstraints = parentContext.securityConstraints || {};
  
  return {
    // File system access restrictions
    allowedPaths: filterAllowedPaths(parentConstraints.allowedPaths),
    
    // Network access restrictions
    allowedDomains: parentConstraints.allowedDomains || [],
    networkAccessLevel: 'restricted', // vs 'full' for main agent
    
    // Command execution restrictions
    allowedCommands: [
      'ls', 'cat', 'head', 'tail', 'grep', 'find', 'wc',
      'echo', 'pwd', 'which', 'type'
    ],
    prohibitedCommands: [
      'rm', 'mv', 'cp', 'chmod', 'chown', 'sudo', 'su',
      'kill', 'killall', 'pkill', 'ps', 'top', 'htop'
    ],
    
    // Permission restrictions
    canModifyFiles: false,
    canExecuteCommands: true,
    canAccessNetwork: true,
    canCreateSubAgents: false, // Prevent nested SubAgents
    
    // Resource access restrictions
    maxMemoryUsage: '256MB',
    maxDiskUsage: '100MB',
    maxNetworkBandwidth: '10MB',
    
    // Time-based restrictions
    maxIdleTime: 30000, // 30 seconds
    maxTotalTime: 300000 // 5 minutes
  };
}
```

## Concurrent SubAgent Execution

### Parallel SubAgent Orchestration

```javascript
// Execute multiple SubAgents concurrently
async function* executeMultipleSubAgents(tasks, parentContext, options = {}) {
  const {
    maxConcurrency = 3,
    timeoutMs = 120000,
    collectResults = true
  } = options;
  
  // Create SubAgent executors
  const subAgentExecutors = tasks.map((task, index) => ({
    id: `subagent_${index}`,
    task,
    executor: createSubAgent(task.prompt, parentContext, task.options)
  }));
  
  // Concurrent execution with UH1-style scheduler
  const activeExecutors = new Map();
  const completedResults = [];
  const pendingTasks = [...subAgentExecutors];
  
  // Start initial batch
  while (activeExecutors.size < maxConcurrency && pendingTasks.length > 0) {
    const executor = pendingTasks.shift();
    activeExecutors.set(executor.id, {
      ...executor,
      promise: executeSubAgentWithTimeout(executor.executor, timeoutMs)
    });
  }
  
  // Process completions and start new tasks
  while (activeExecutors.size > 0) {
    // Wait for any SubAgent to complete
    const completedPromises = Array.from(activeExecutors.values()).map(
      executor => executor.promise.then(result => ({ ...result, id: executor.id }))
    );
    
    const completedExecutor = await Promise.race(completedPromises);
    
    // Remove completed executor
    activeExecutors.delete(completedExecutor.id);
    
    // Yield results
    yield {
      type: 'subagent_result',
      agentId: completedExecutor.id,
      result: completedExecutor.result,
      success: completedExecutor.success
    };
    
    if (collectResults) {
      completedResults.push(completedExecutor);
    }
    
    // Start next pending task if available
    if (pendingTasks.length > 0) {
      const nextExecutor = pendingTasks.shift();
      activeExecutors.set(nextExecutor.id, {
        ...nextExecutor,
        promise: executeSubAgentWithTimeout(nextExecutor.executor, timeoutMs)
      });
    }
  }
  
  // Final results synthesis if requested
  if (collectResults && completedResults.length > 1) {
    const synthesisResult = await synthesizeMultipleResults(
      completedResults,
      parentContext
    );
    
    yield {
      type: 'multi_subagent_synthesis',
      originalResultCount: completedResults.length,
      synthesizedResult: synthesisResult
    };
  }
}

// Execute SubAgent with timeout wrapper
async function executeSubAgentWithTimeout(subAgentExecutor, timeoutMs) {
  const timeoutPromise = new Promise((_, reject) => {
    setTimeout(() => reject(new TimeoutError('SubAgent execution timeout')), timeoutMs);
  });
  
  try {
    const results = [];
    
    const executionPromise = (async () => {
      for await (const result of subAgentExecutor) {
        results.push(result);
      }
      return results;
    })();
    
    const finalResults = await Promise.race([executionPromise, timeoutPromise]);
    
    return {
      success: true,
      result: finalResults,
      executionTime: Date.now()
    };
  } catch (error) {
    return {
      success: false,
      error: error.message,
      executionTime: Date.now()
    };
  }
}
```

## Result Synthesis and Aggregation

### Multi-Agent Result Synthesis (KN5)

```javascript
// Synthesize results from multiple SubAgents
async function synthesizeMultipleResults(subAgentResults, parentContext) {
  // Group results by type and importance
  const resultGroups = {
    findings: [],
    errors: [],
    recommendations: [],
    data: [],
    metadata: []
  };
  
  // Categorize results
  for (const agentResult of subAgentResults) {
    if (!agentResult.success) {
      resultGroups.errors.push({
        agentId: agentResult.id,
        error: agentResult.error,
        context: agentResult.context
      });
      continue;
    }
    
    for (const result of agentResult.result) {
      categorizeResult(result, resultGroups);
    }
  }
  
  // Detect conflicts and duplicates
  const conflicts = detectConflicts(resultGroups);
  const duplicates = detectDuplicates(resultGroups);
  
  // Resolve conflicts using priority rules
  const resolvedResults = resolveConflicts(resultGroups, conflicts);
  
  // Remove duplicates
  const deduplicatedResults = removeDuplicates(resolvedResults, duplicates);
  
  // Generate synthesis summary
  const synthesisPrompt = `Based on the following results from multiple specialized agents, provide a comprehensive summary:

Findings: ${JSON.stringify(deduplicatedResults.findings, null, 2)}
Data: ${JSON.stringify(deduplicatedResults.data, null, 2)}
Recommendations: ${JSON.stringify(deduplicatedResults.recommendations, null, 2)}

${conflicts.length > 0 ? `Conflicts resolved: ${conflicts.length}` : ''}
${duplicates.length > 0 ? `Duplicates removed: ${duplicates.length}` : ''}

Please provide:
1. A concise summary of the key findings
2. Any important patterns or insights
3. Consolidated recommendations
4. Areas where agents disagreed (if any)`;
  
  // Generate synthesis using LLM
  const synthesisResponse = await generateSynthesis(
    synthesisPrompt,
    parentContext
  );
  
  return {
    type: 'multi_agent_synthesis',
    summary: synthesisResponse,
    originalResults: subAgentResults.length,
    categorizedResults: deduplicatedResults,
    conflictsResolved: conflicts.length,
    duplicatesRemoved: duplicates.length,
    synthesisMetadata: {
      processingTime: Date.now(),
      confidenceScore: calculateConfidenceScore(deduplicatedResults),
      completeness: calculateCompleteness(deduplicatedResults)
    }
  };
}

// Conflict detection between SubAgent results
function detectConflicts(resultGroups) {
  const conflicts = [];
  
  // Check for contradictory findings
  for (let i = 0; i < resultGroups.findings.length; i++) {
    for (let j = i + 1; j < resultGroups.findings.length; j++) {
      const finding1 = resultGroups.findings[i];
      const finding2 = resultGroups.findings[j];
      
      if (areContradictory(finding1, finding2)) {
        conflicts.push({
          type: 'contradictory_findings',
          result1: finding1,
          result2: finding2,
          severity: calculateConflictSeverity(finding1, finding2)
        });
      }
    }
  }
  
  // Check for conflicting recommendations
  for (let i = 0; i < resultGroups.recommendations.length; i++) {
    for (let j = i + 1; j < resultGroups.recommendations.length; j++) {
      const rec1 = resultGroups.recommendations[i];
      const rec2 = resultGroups.recommendations[j];
      
      if (areConflictingRecommendations(rec1, rec2)) {
        conflicts.push({
          type: 'conflicting_recommendations',
          result1: rec1,
          result2: rec2,
          severity: calculateConflictSeverity(rec1, rec2)
        });
      }
    }
  }
  
  return conflicts;
}
```

### Performance Metrics and Monitoring

```javascript
// SubAgent performance tracking
class MultiAgentPerformanceTracker {
  constructor() {
    this.metrics = {
      totalSubAgents: 0,
      successfulSubAgents: 0,
      failedSubAgents: 0,
      averageExecutionTime: 0,
      totalExecutionTime: 0,
      resourceUtilization: {},
      concurrencyMetrics: {
        maxConcurrent: 0,
        averageConcurrent: 0,
        concurrencyHistory: []
      }
    };
  }
  
  trackSubAgentStart(subAgentId, startTime) {
    this.metrics.totalSubAgents++;
    this.updateConcurrencyMetrics(1);
    
    return {
      subAgentId,
      startTime,
      status: 'running'
    };
  }
  
  trackSubAgentComplete(subAgentId, endTime, success, resourceUsage) {
    if (success) {
      this.metrics.successfulSubAgents++;
    } else {
      this.metrics.failedSubAgents++;
    }
    
    const executionTime = endTime - startTime;
    this.metrics.totalExecutionTime += executionTime;
    this.metrics.averageExecutionTime = 
      this.metrics.totalExecutionTime / this.metrics.totalSubAgents;
    
    this.updateResourceUtilization(resourceUsage);
    this.updateConcurrencyMetrics(-1);
  }
  
  updateConcurrencyMetrics(delta) {
    const currentConcurrent = this.getCurrentConcurrency() + delta;
    
    this.metrics.concurrencyMetrics.maxConcurrent = Math.max(
      this.metrics.concurrencyMetrics.maxConcurrent,
      currentConcurrent
    );
    
    this.metrics.concurrencyMetrics.concurrencyHistory.push({
      timestamp: Date.now(),
      concurrent: currentConcurrent
    });
    
    // Calculate average concurrency over last 100 measurements
    const recentHistory = this.metrics.concurrencyMetrics.concurrencyHistory.slice(-100);
    this.metrics.concurrencyMetrics.averageConcurrent = 
      recentHistory.reduce((sum, item) => sum + item.concurrent, 0) / recentHistory.length;
  }
  
  getPerformanceReport() {
    const successRate = this.metrics.totalSubAgents > 0 ?
      (this.metrics.successfulSubAgents / this.metrics.totalSubAgents) * 100 : 0;
    
    return {
      summary: {
        totalSubAgents: this.metrics.totalSubAgents,
        successRate: `${successRate.toFixed(1)}%`,
        averageExecutionTime: `${this.metrics.averageExecutionTime.toFixed(0)}ms`,
        maxConcurrency: this.metrics.concurrencyMetrics.maxConcurrent
      },
      details: this.metrics,
      recommendations: this.generateOptimizationRecommendations()
    };
  }
  
  generateOptimizationRecommendations() {
    const recommendations = [];
    
    const successRate = this.metrics.successfulSubAgents / this.metrics.totalSubAgents;
    if (successRate < 0.9) {
      recommendations.push({
        type: 'reliability',
        message: 'Consider reducing SubAgent resource limits or improving error handling',
        priority: 'high'
      });
    }
    
    if (this.metrics.averageExecutionTime > 30000) {
      recommendations.push({
        type: 'performance',
        message: 'SubAgent execution time is high. Consider optimizing task complexity',
        priority: 'medium'
      });
    }
    
    if (this.metrics.concurrencyMetrics.averageConcurrent < 2) {
      recommendations.push({
        type: 'concurrency',
        message: 'Low concurrency detected. Consider parallelizing more tasks',
        priority: 'low'
      });
    }
    
    return recommendations;
  }
}
```

## Error Handling and Recovery

### SubAgent Error Management

```javascript
// Comprehensive error handling for SubAgents
class SubAgentErrorHandler {
  constructor(parentContext) {
    this.parentContext = parentContext;
    this.errorRecoveryStrategies = new Map();
    this.setupRecoveryStrategies();
  }
  
  setupRecoveryStrategies() {
    this.errorRecoveryStrategies.set('TimeoutError', this.handleTimeout);
    this.errorRecoveryStrategies.set('ResourceLimitExceededError', this.handleResourceLimit);
    this.errorRecoveryStrategies.set('PermissionDeniedError', this.handlePermissionDenied);
    this.errorRecoveryStrategies.set('ToolExecutionError', this.handleToolError);
    this.errorRecoveryStrategies.set('ModelCommunicationError', this.handleModelError);
  }
  
  async handleSubAgentError(error, subAgentId, context) {
    const errorType = error.constructor.name;
    const recoveryStrategy = this.errorRecoveryStrategies.get(errorType);
    
    if (recoveryStrategy) {
      try {
        const recoveryResult = await recoveryStrategy.call(
          this, 
          error, 
          subAgentId, 
          context
        );
        
        if (recoveryResult.success) {
          return {
            type: 'error_recovered',
            subAgentId,
            originalError: error.message,
            recoveryAction: recoveryResult.action,
            newContext: recoveryResult.context
          };
        }
      } catch (recoveryError) {
        // Recovery failed, escalate to parent
        return this.escalateToParent(error, subAgentId, recoveryError);
      }
    }
    
    // No recovery strategy available
    return {
      type: 'error_unrecoverable',
      subAgentId,
      error: error.message,
      requiresManualIntervention: true
    };
  }
  
  async handleTimeout(error, subAgentId, context) {
    // Strategy: Reduce task complexity and retry
    const simplifiedTask = await simplifyTask(context.originalTask);
    
    return {
      success: true,
      action: 'simplified_retry',
      context: {
        ...context,
        task: simplifiedTask,
        timeout: context.timeout * 1.5, // Increase timeout
        maxComplexity: 'low'
      }
    };
  }
  
  async handleResourceLimit(error, subAgentId, context) {
    // Strategy: Request additional resources or break down task
    if (context.resourceRequestCount < 2) {
      return {
        success: true,
        action: 'resource_increase',
        context: {
          ...context,
          resourceLimits: increaseResourceLimits(context.resourceLimits),
          resourceRequestCount: (context.resourceRequestCount || 0) + 1
        }
      };
    } else {
      // Too many resource requests, break down task
      const subtasks = await breakDownTask(context.originalTask);
      return {
        success: true,
        action: 'task_decomposition',
        context: {
          ...context,
          subtasks,
          executionMode: 'sequential'
        }
      };
    }
  }
  
  async handlePermissionDenied(error, subAgentId, context) {
    // Strategy: Request user permission or use alternative approach
    return {
      success: false,
      action: 'request_user_permission',
      requiresUserInput: true,
      permissionRequest: {
        subAgentId,
        requestedPermission: error.permission,
        justification: error.justification
      }
    };
  }
  
  async escalateToParent(originalError, subAgentId, recoveryError) {
    return {
      type: 'error_escalated',
      subAgentId,
      originalError: originalError.message,
      recoveryError: recoveryError.message,
      escalationLevel: 'parent_agent',
      requiresParentIntervention: true
    };
  }
}
```

## Integration with Main Agent

### Communication Patterns

```javascript
// SubAgent to Main Agent communication
class SubAgentCommunicator {
  constructor(mainAgentContext, subAgentId) {
    this.mainAgentContext = mainAgentContext;
    this.subAgentId = subAgentId;
    this.messageQueue = new Map();
  }
  
  // Send progress update to main agent
  async sendProgressUpdate(progressData) {
    const message = {
      type: 'subagent_progress',
      subAgentId: this.subAgentId,
      timestamp: Date.now(),
      data: progressData
    };
    
    await this.mainAgentContext.receiveSubAgentMessage(message);
  }
  
  // Request additional resources
  async requestResources(resourceRequest) {
    const message = {
      type: 'resource_request',
      subAgentId: this.subAgentId,
      timestamp: Date.now(),
      request: resourceRequest
    };
    
    const response = await this.mainAgentContext.handleResourceRequest(message);
    return response;
  }
  
  // Report completion
  async reportCompletion(results) {
    const message = {
      type: 'subagent_completion',
      subAgentId: this.subAgentId,
      timestamp: Date.now(),
      results: results,
      metrics: this.getExecutionMetrics()
    };
    
    await this.mainAgentContext.receiveSubAgentMessage(message);
  }
  
  getExecutionMetrics() {
    return {
      executionTime: Date.now() - this.startTime,
      toolsUsed: this.toolsUsed,
      resourcesConsumed: this.resourcesConsumed,
      errorsEncountered: this.errorsEncountered
    };
  }
}
```

## Testing and Validation

### SubAgent Integration Testing

```javascript
// Test suite for multi-agent system
describe('Multi-Agent System', () => {
  describe('Task Tool', () => {
    it('should create SubAgent with proper isolation', async () => {
      const mockContext = createMockContext();
      const taskInput = {
        description: "Test task",
        prompt: "Analyze this code file"
      };
      
      const results = [];
      for await (const result of taskTool.call(taskInput, mockContext)) {
        results.push(result);
      }
      
      expect(results).toContainEqual(
        expect.objectContaining({ type: 'subagent_start' })
      );
      expect(results).toContainEqual(
        expect.objectContaining({ type: 'subagent_complete' })
      );
    });
  });
  
  describe('SubAgent Execution', () => {
    it('should enforce resource limits', async () => {
      const limitedContext = createContextWithLimits({
        maxExecutionTime: 5000,
        maxToolCalls: 3
      });
      
      const heavyTask = "Perform an exhaustive analysis of all files";
      
      expect(async () => {
        for await (const result of createSubAgent(heavyTask, limitedContext)) {
          // Should throw ResourceLimitExceededError
        }
      }).toThrow(ResourceLimitExceededError);
    });
  });
  
  describe('Concurrent SubAgents', () => {
    it('should execute multiple SubAgents concurrently', async () => {
      const tasks = [
        { prompt: "Analyze component A" },
        { prompt: "Analyze component B" },
        { prompt: "Analyze component C" }
      ];
      
      const startTime = Date.now();
      const results = [];
      
      for await (const result of executeMultipleSubAgents(tasks, mockContext)) {
        results.push(result);
      }
      
      const executionTime = Date.now() - startTime;
      
      // Should execute faster than sequential execution
      expect(executionTime).toBeLessThan(30000); // 30 seconds
      expect(results.length).toBe(tasks.length);
    });
  });
});
```

## Conclusion

Claude Code's multi-agent system represents a sophisticated approach to task decomposition and parallel execution. Key architectural strengths include:

1. **Complete Isolation**: SubAgents run in isolated contexts with restricted resources
2. **Intelligent Resource Management**: Dynamic allocation and monitoring of compute resources
3. **Robust Error Handling**: Multi-level error recovery and escalation strategies
4. **Concurrent Execution**: Efficient parallel processing of independent tasks
5. **Result Synthesis**: Intelligent aggregation and conflict resolution of multi-agent outputs
6. **Security-First Design**: Comprehensive security constraints and sandboxing

This architecture enables Claude Code to handle complex, multi-faceted development tasks by breaking them down into specialized sub-tasks while maintaining security, reliability, and performance.

## References

- [System Overview](./system-overview.md)
- [Agent Loop Implementation](./agent-loop.md)
- [Layered Architecture](./layered-architecture.md)
- [Security Framework](../design/security-framework.md)
- [Concurrency Model](../design/concurrency-model.md)