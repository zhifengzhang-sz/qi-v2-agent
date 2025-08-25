# Workflow Integration Guide

## Table of Contents
- [Overview](#overview)
- [Understanding Workflow Enhancement](#understanding-workflow-enhancement)
- [Sub-Agent Workflow Nodes](#sub-agent-workflow-nodes)
- [Workflow Patterns with Sub-Agents](#workflow-patterns-with-sub-agents)
- [State Management](#state-management)
- [Error Handling and Recovery](#error-handling-and-recovery)
- [Performance Optimization](#performance-optimization)
- [Debugging Workflows](#debugging-workflows)

## Overview

This guide explains how to integrate sub-agents into the existing v-0.9.x workflow system. The integration is designed to be **backward compatible** while adding powerful sub-agent capabilities.

### Architecture Review

```
Traditional v-0.9.x Workflow:
User Input → Workflow Engine → Tool Nodes → Tool Execution → Result

Enhanced v-0.10.0 Workflow:
User Input → Enhanced Workflow Engine → Sub-Agent Nodes → Sub-Agent Execution → Result
                                    ↘ Tool Nodes → Tool Execution ↗
```

**Key Benefits:**
- **Existing workflows continue to work unchanged**
- **New workflows can leverage sub-agent intelligence** 
- **Gradual migration path** from tool-based to sub-agent-based workflows
- **Mixed workflows** can combine both approaches

## Understanding Workflow Enhancement

### Enhanced Workflow Engine

The `EnhancedWorkflowEngine` extends the existing `QiWorkflowEngine` without breaking changes:

```typescript
// lib/src/agent/integration/EnhancedWorkflowEngine.ts

import { QiWorkflowEngine } from '../../workflow/impl/QiWorkflowEngine.js';
import { SubAgentRegistry } from '../core/SubAgentRegistry.js';
import { 
  WorkflowNodeSpec, 
  WorkflowNode, 
  WorkflowState,
  SubAgentWorkflowNode 
} from './types.js';

export class EnhancedWorkflowEngine extends QiWorkflowEngine {
  private subAgentRegistry: SubAgentRegistry;
  private subAgentExecutions = new Map<string, AsyncGenerator<SubAgentProgress, SubAgentResult>>();

  constructor(
    subAgentRegistry: SubAgentRegistry,
    config: IWorkflowEngineConfig
  ) {
    super(config);
    this.subAgentRegistry = subAgentRegistry;
  }

  // Override node creation to support sub-agent nodes
  protected createWorkflowNode(nodeSpec: WorkflowNodeSpec): WorkflowNode {
    if (nodeSpec.type === 'sub-agent') {
      return this.createSubAgentNode(nodeSpec as SubAgentWorkflowNodeSpec);
    } else {
      // Delegate to parent for regular nodes (backward compatibility)
      return super.createWorkflowNode(nodeSpec);
    }
  }

  private createSubAgentNode(nodeSpec: SubAgentWorkflowNodeSpec): SubAgentWorkflowNode {
    return {
      id: nodeSpec.id,
      name: nodeSpec.name,
      type: 'sub-agent',
      subAgentId: nodeSpec.subAgentId,
      taskDefinition: nodeSpec.taskDefinition,
      errorHandling: nodeSpec.errorHandling || 'fail',
      retryConfig: nodeSpec.retryConfig,
      handler: this.createSubAgentHandler(nodeSpec)
    };
  }

  private createSubAgentHandler(nodeSpec: SubAgentWorkflowNodeSpec): WorkflowNodeHandler {
    return async (state: WorkflowState): Promise<WorkflowState> => {
      try {
        // Get sub-agent instance
        const subAgent = await this.subAgentRegistry.getInstance(nodeSpec.subAgentId);
        
        // Create task from workflow state and node specification
        const task = this.createSubAgentTask(nodeSpec, state);
        
        // Execute sub-agent with progress tracking
        const executionGenerator = subAgent.execute(task);
        this.subAgentExecutions.set(nodeSpec.id, executionGenerator);

        let finalResult: SubAgentResult | undefined;
        const progressUpdates: SubAgentProgress[] = [];

        try {
          for await (const progress of executionGenerator) {
            progressUpdates.push(progress);
            
            // Emit progress for workflow monitoring
            this.emit('subAgentProgress', { 
              nodeId: nodeSpec.id, 
              subAgentId: nodeSpec.subAgentId,
              progress 
            });

            // Check for completion
            if (progress.progress >= 1.0) {
              finalResult = progress.intermediateResults as SubAgentResult;
            }
          }

          if (!finalResult) {
            throw createAgentError(
              AgentErrorCategory.SYSTEM,
              'Sub-agent execution completed without result',
              { nodeId: nodeSpec.id, subAgentId: nodeSpec.subAgentId }
            );
          }

          // Update workflow state with sub-agent results
          const updatedState: WorkflowState = {
            ...state,
            subAgentResults: new Map(state.subAgentResults || []).set(nodeSpec.id, finalResult),
            subAgentProgress: new Map(state.subAgentProgress || []).set(nodeSpec.id, progressUpdates),
            // Update regular node results for backward compatibility
            nodeResults: {
              ...state.nodeResults,
              [nodeSpec.id]: {
                success: finalResult.success,
                output: finalResult.output,
                metadata: finalResult.metadata
              }
            }
          };

          return updatedState;

        } finally {
          this.subAgentExecutions.delete(nodeSpec.id);
        }

      } catch (error) {
        // Handle sub-agent execution errors based on error handling strategy
        return this.handleSubAgentError(nodeSpec, state, error);
      }
    };
  }

  private createSubAgentTask(
    nodeSpec: SubAgentWorkflowNodeSpec, 
    state: WorkflowState
  ): SubAgentTask {
    // Resolve input from workflow state
    const resolvedInput = this.resolveWorkflowVariables(
      nodeSpec.taskDefinition.input, 
      state
    );

    return {
      id: `${state.workflowId}_${nodeSpec.id}_${Date.now()}`,
      type: nodeSpec.taskDefinition.type,
      description: nodeSpec.taskDefinition.description || `Execute ${nodeSpec.subAgentId} task`,
      input: resolvedInput,
      context: {
        sessionId: state.sessionId || 'workflow-session',
        workflowId: state.workflowId || 'unknown-workflow',
        parentTaskId: state.currentNodeId,
        availableTools: this.getAvailableToolsForWorkflow(state),
        workingDirectory: state.workingDirectory || process.cwd(),
        environment: state.environment || {},
        timeoutMs: nodeSpec.taskDefinition.timeoutMs,
        maxRetries: nodeSpec.retryConfig?.maxAttempts
      },
      constraints: nodeSpec.taskDefinition.constraints,
      priority: nodeSpec.taskDefinition.priority || 'normal'
    };
  }

  private resolveWorkflowVariables(input: unknown, state: WorkflowState): unknown {
    if (typeof input === 'string') {
      // Replace variable references like ${workflow.input} or ${nodes.read_file.output}
      return input.replace(/\$\{([^}]+)\}/g, (match, path) => {
        const value = this.getValueFromPath(path, state);
        return value !== undefined ? String(value) : match;
      });
    } else if (Array.isArray(input)) {
      return input.map(item => this.resolveWorkflowVariables(item, state));
    } else if (input && typeof input === 'object') {
      const resolved: any = {};
      for (const [key, value] of Object.entries(input)) {
        resolved[key] = this.resolveWorkflowVariables(value, state);
      }
      return resolved;
    } else {
      return input;
    }
  }

  private getValueFromPath(path: string, state: WorkflowState): unknown {
    const parts = path.split('.');
    let current: any = {
      workflow: {
        input: state.input,
        output: state.output,
        sessionId: state.sessionId,
        workflowId: state.workflowId
      },
      nodes: state.nodeResults || {},
      subAgents: Object.fromEntries(state.subAgentResults || [])
    };

    for (const part of parts) {
      if (current && typeof current === 'object' && part in current) {
        current = current[part];
      } else {
        return undefined;
      }
    }

    return current;
  }

  private async handleSubAgentError(
    nodeSpec: SubAgentWorkflowNodeSpec,
    state: WorkflowState,
    error: unknown
  ): Promise<WorkflowState> {
    const qiError = error instanceof Error ? 
      createAgentError(AgentErrorCategory.SYSTEM, error.message, { nodeId: nodeSpec.id }) :
      error as QiError;

    switch (nodeSpec.errorHandling) {
      case 'continue':
        // Continue workflow with error marked but don't fail
        this.logger.warn('Sub-agent node failed but continuing workflow', {
          nodeId: nodeSpec.id,
          subAgentId: nodeSpec.subAgentId,
          error: qiError
        });
        
        return {
          ...state,
          subAgentErrors: new Map(state.subAgentErrors || [])
            .set(nodeSpec.id, [qiError]),
          nodeResults: {
            ...state.nodeResults,
            [nodeSpec.id]: {
              success: false,
              output: null,
              error: qiError
            }
          }
        };

      case 'retry':
        // Implement retry logic if retry config is present
        if (nodeSpec.retryConfig) {
          return this.retrySubAgentExecution(nodeSpec, state, qiError);
        }
        // Fall through to fail if no retry config

      case 'fail':
      default:
        // Fail the entire workflow
        throw qiError;
    }
  }

  private async retrySubAgentExecution(
    nodeSpec: SubAgentWorkflowNodeSpec,
    state: WorkflowState,
    lastError: QiError
  ): Promise<WorkflowState> {
    const retryConfig = nodeSpec.retryConfig!;
    const currentAttempt = (state.nodeRetryAttempts?.[nodeSpec.id] || 0) + 1;

    if (currentAttempt > retryConfig.maxAttempts) {
      // Max retries exceeded, fail or continue based on fallback
      if (nodeSpec.errorHandling === 'continue') {
        return this.handleSubAgentError({ ...nodeSpec, errorHandling: 'continue' }, state, lastError);
      } else {
        throw lastError;
      }
    }

    // Wait before retry
    if (retryConfig.backoffMs) {
      const delay = retryConfig.backoffMs * Math.pow(2, currentAttempt - 1); // Exponential backoff
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Update retry state
    const updatedState = {
      ...state,
      nodeRetryAttempts: {
        ...state.nodeRetryAttempts,
        [nodeSpec.id]: currentAttempt
      }
    };

    this.logger.info('Retrying sub-agent execution', {
      nodeId: nodeSpec.id,
      attempt: currentAttempt,
      maxAttempts: retryConfig.maxAttempts
    });

    // Retry the execution
    return this.createSubAgentHandler(nodeSpec)(updatedState);
  }
}
```

### Workflow State Extensions

The workflow state is extended to support sub-agent results:

```typescript
// Enhanced workflow state interface
export interface EnhancedWorkflowState extends WorkflowState {
  // Sub-agent specific state
  subAgentResults?: Map<string, SubAgentResult>;
  subAgentProgress?: Map<string, SubAgentProgress[]>;
  subAgentErrors?: Map<string, QiError[]>;
  nodeRetryAttempts?: Record<string, number>;
  
  // Helper methods
  getSubAgentResult(nodeId: string): SubAgentResult | undefined;
  getSubAgentOutput<T>(nodeId: string): T | undefined;
  getSubAgentProgress(nodeId: string): SubAgentProgress[] | undefined;
  getAllSubAgentArtifacts(): SubAgentArtifact[];
  hasSubAgentErrors(): boolean;
}

// Implementation of helper methods
export function enhanceWorkflowState(baseState: WorkflowState): EnhancedWorkflowState {
  const enhancedState = baseState as EnhancedWorkflowState;
  
  enhancedState.getSubAgentResult = function(nodeId: string): SubAgentResult | undefined {
    return this.subAgentResults?.get(nodeId);
  };
  
  enhancedState.getSubAgentOutput = function<T>(nodeId: string): T | undefined {
    const result = this.subAgentResults?.get(nodeId);
    return result?.output as T;
  };
  
  enhancedState.getSubAgentProgress = function(nodeId: string): SubAgentProgress[] | undefined {
    return this.subAgentProgress?.get(nodeId);
  };
  
  enhancedState.getAllSubAgentArtifacts = function(): SubAgentArtifact[] {
    const artifacts: SubAgentArtifact[] = [];
    if (this.subAgentResults) {
      for (const result of this.subAgentResults.values()) {
        if (result.artifacts) {
          artifacts.push(...result.artifacts);
        }
      }
    }
    return artifacts;
  };
  
  enhancedState.hasSubAgentErrors = function(): boolean {
    return this.subAgentErrors ? this.subAgentErrors.size > 0 : false;
  };
  
  return enhancedState;
}
```

## Sub-Agent Workflow Nodes

### Node Definition Format

Sub-agent nodes are defined in workflow specifications using this format:

```yaml
# YAML format for workflow definitions
workflow_pattern: "data_processing_pipeline"
nodes:
  - id: "fetch_data"
    type: "sub-agent"
    name: "Fetch Source Data"
    sub_agent_id: "file-tool-agent"
    task:
      type: "read_files" 
      description: "Read all CSV files from data directory"
      input:
        file_paths: ["${workflow.input.data_directory}/*.csv"]
      priority: "high"
      timeout_ms: 30000
      constraints:
        - type: "file_access"
          parameters:
            allowed_extensions: [".csv", ".json"]
            max_file_size: 10485760  # 10MB
    error_handling: "fail"
    
  - id: "process_data"
    type: "sub-agent"
    name: "Process Data"
    sub_agent_id: "data-processing-agent"
    task:
      type: "transform_data"
      description: "Clean and transform the CSV data"
      input:
        data: "${nodes.fetch_data.output.content}"
        transformations:
          - "remove_duplicates"
          - "normalize_columns"
          - "validate_data"
    error_handling: "retry"
    retry_config:
      max_attempts: 3
      backoff_ms: 1000
      
  - id: "save_results"
    type: "sub-agent" 
    name: "Save Processed Data"
    sub_agent_id: "file-tool-agent"
    task:
      type: "write_file"
      description: "Save processed data to output file"
      input:
        file_path: "${workflow.input.output_path}"
        content: "${nodes.process_data.output.processed_data}"
        format: "json"
    error_handling: "continue"  # Don't fail workflow if save fails

edges:
  - from: "fetch_data"
    to: "process_data"
  - from: "process_data"
    to: "save_results"
```

### TypeScript Node Definition

```typescript
// TypeScript interface for sub-agent workflow nodes
export interface SubAgentWorkflowNodeSpec {
  id: string;
  type: 'sub-agent';
  name: string;
  subAgentId: string;
  taskDefinition: {
    type: string;
    description?: string;
    input: unknown;
    priority?: 'low' | 'normal' | 'high' | 'critical';
    timeoutMs?: number;
    constraints?: SubAgentConstraint[];
  };
  errorHandling?: 'fail' | 'continue' | 'retry';
  retryConfig?: {
    maxAttempts: number;
    backoffMs?: number;
  };
}

// Usage in workflow creation
const workflowSpec = {
  pattern: 'text_analysis_workflow',
  nodes: [
    {
      id: 'read_file',
      type: 'sub-agent',
      name: 'Read Input File',
      subAgentId: 'file-tool-agent',
      taskDefinition: {
        type: 'read_file',
        description: 'Read the text file for analysis',
        input: {
          filePath: '${workflow.input.file_path}',
          encoding: 'utf8'
        },
        priority: 'normal'
      },
      errorHandling: 'fail'
    } as SubAgentWorkflowNodeSpec,
    
    {
      id: 'analyze_text',
      type: 'sub-agent',
      name: 'Analyze Text Content',
      subAgentId: 'text-processing-agent',
      taskDefinition: {
        type: 'analyze_text',
        description: 'Perform comprehensive text analysis',
        input: {
          text: '${nodes.read_file.output.content}'
        },
        priority: 'high'
      },
      errorHandling: 'retry',
      retryConfig: {
        maxAttempts: 2,
        backoffMs: 1000
      }
    } as SubAgentWorkflowNodeSpec
  ],
  edges: [
    { from: 'read_file', to: 'analyze_text' }
  ]
};
```

## Workflow Patterns with Sub-Agents

### 1. Sequential Processing Pattern

```typescript
// Sequential workflow where each sub-agent depends on the previous one
export const createSequentialWorkflow = (steps: Array<{
  id: string;
  subAgentId: string; 
  taskType: string;
  inputTransform?: (previousOutput: unknown) => unknown;
}>): WorkflowSpec => {
  const nodes = steps.map((step, index) => ({
    id: step.id,
    type: 'sub-agent',
    name: `Step ${index + 1}: ${step.id}`,
    subAgentId: step.subAgentId,
    taskDefinition: {
      type: step.taskType,
      input: index === 0 
        ? '${workflow.input}' 
        : step.inputTransform 
          ? step.inputTransform('${nodes.' + steps[index-1].id + '.output}')
          : '${nodes.' + steps[index-1].id + '.output}',
      priority: 'normal'
    },
    errorHandling: 'fail'
  }));

  const edges = steps.slice(1).map((step, index) => ({
    from: steps[index].id,
    to: step.id
  }));

  return {
    pattern: 'sequential_processing',
    nodes,
    edges
  };
};

// Usage
const documentProcessingWorkflow = createSequentialWorkflow([
  {
    id: 'extract_text',
    subAgentId: 'document-extractor-agent',
    taskType: 'extract_text_from_pdf'
  },
  {
    id: 'clean_text', 
    subAgentId: 'text-processing-agent',
    taskType: 'clean_text',
    inputTransform: (pdfOutput) => ({ text: pdfOutput })
  },
  {
    id: 'analyze_sentiment',
    subAgentId: 'sentiment-analysis-agent', 
    taskType: 'analyze_sentiment',
    inputTransform: (cleanText) => ({ text: cleanText })
  },
  {
    id: 'generate_summary',
    subAgentId: 'summarization-agent',
    taskType: 'generate_summary',
    inputTransform: (sentimentData) => ({ 
      text: sentimentData.original_text,
      sentiment: sentimentData.sentiment 
    })
  }
]);
```

### 2. Parallel Processing Pattern

```typescript
// Parallel workflow where multiple sub-agents process the same input independently
export const createParallelWorkflow = (
  inputNodeId: string,
  parallelSteps: Array<{
    id: string;
    subAgentId: string;
    taskType: string;
    inputSelector?: string;
  }>,
  aggregatorStep?: {
    id: string;
    subAgentId: string;
    taskType: string;
  }
): WorkflowSpec => {
  const nodes = [
    // Input preparation node
    {
      id: inputNodeId,
      type: 'sub-agent',
      name: 'Prepare Input',
      subAgentId: 'data-preparation-agent',
      taskDefinition: {
        type: 'prepare_for_parallel_processing',
        input: '${workflow.input}',
        priority: 'high'
      },
      errorHandling: 'fail'
    },
    
    // Parallel processing nodes
    ...parallelSteps.map(step => ({
      id: step.id,
      type: 'sub-agent',
      name: `Parallel: ${step.id}`,
      subAgentId: step.subAgentId,
      taskDefinition: {
        type: step.taskType,
        input: step.inputSelector 
          ? `\${nodes.${inputNodeId}.output.${step.inputSelector}}`
          : `\${nodes.${inputNodeId}.output}`,
        priority: 'normal'
      },
      errorHandling: 'continue'  // Don't fail entire workflow if one branch fails
    }))
  ];

  let edges = parallelSteps.map(step => ({
    from: inputNodeId,
    to: step.id
  }));

  // Add aggregator if specified
  if (aggregatorStep) {
    nodes.push({
      id: aggregatorStep.id,
      type: 'sub-agent',
      name: 'Aggregate Results',
      subAgentId: aggregatorStep.subAgentId,
      taskDefinition: {
        type: aggregatorStep.taskType,
        input: {
          results: parallelSteps.map(step => `\${nodes.${step.id}.output}`)
        },
        priority: 'high'
      },
      errorHandling: 'fail'
    });

    // Add edges from all parallel steps to aggregator
    edges.push(...parallelSteps.map(step => ({
      from: step.id,
      to: aggregatorStep.id
    })));
  }

  return {
    pattern: 'parallel_processing',
    nodes,
    edges
  };
};

// Usage
const comprehensiveAnalysisWorkflow = createParallelWorkflow(
  'prepare_content',
  [
    {
      id: 'quality_analysis',
      subAgentId: 'code-quality-agent',
      taskType: 'analyze_code_quality',
      inputSelector: 'source_code'
    },
    {
      id: 'security_scan',
      subAgentId: 'security-scanner-agent', 
      taskType: 'scan_for_vulnerabilities',
      inputSelector: 'source_code'
    },
    {
      id: 'performance_analysis',
      subAgentId: 'performance-profiler-agent',
      taskType: 'analyze_performance_patterns',
      inputSelector: 'source_code'
    },
    {
      id: 'documentation_check',
      subAgentId: 'documentation-analyzer-agent',
      taskType: 'check_documentation_coverage', 
      inputSelector: 'all_files'
    }
  ],
  {
    id: 'generate_report',
    subAgentId: 'report-generator-agent',
    taskType: 'create_comprehensive_report'
  }
);
```

### 3. Conditional Branching Pattern

```typescript
// Conditional workflow that routes to different sub-agents based on conditions
export const createConditionalWorkflow = (
  decisionNodeId: string,
  branches: Record<string, {
    condition: string;
    subAgentId: string;
    taskType: string;
  }>,
  fallbackBranch?: {
    subAgentId: string;
    taskType: string;
  }
): WorkflowSpec => {
  const nodes = [
    // Decision node that determines which branch to take
    {
      id: decisionNodeId,
      type: 'sub-agent',
      name: 'Make Routing Decision',
      subAgentId: 'decision-router-agent',
      taskDefinition: {
        type: 'evaluate_conditions',
        input: {
          data: '${workflow.input}',
          conditions: Object.entries(branches).map(([key, branch]) => ({
            name: key,
            condition: branch.condition
          }))
        },
        priority: 'high'
      },
      errorHandling: 'fail'
    },
    
    // Branch nodes
    ...Object.entries(branches).map(([branchName, branch]) => ({
      id: branchName,
      type: 'sub-agent',
      name: `Branch: ${branchName}`,
      subAgentId: branch.subAgentId,
      taskDefinition: {
        type: branch.taskType,
        input: '${workflow.input}',
        priority: 'normal'
      },
      errorHandling: 'fail'
    }))
  ];

  // Add fallback branch if specified
  if (fallbackBranch) {
    nodes.push({
      id: 'fallback',
      type: 'sub-agent',
      name: 'Fallback Branch',
      subAgentId: fallbackBranch.subAgentId,
      taskDefinition: {
        type: fallbackBranch.taskType,
        input: '${workflow.input}',
        priority: 'low'
      },
      errorHandling: 'continue'
    });
  }

  // Conditional edges based on decision node output
  const edges = Object.keys(branches).map(branchName => ({
    from: decisionNodeId,
    to: branchName,
    condition: `\${nodes.${decisionNodeId}.output.selected_branch} === "${branchName}"`
  }));

  if (fallbackBranch) {
    edges.push({
      from: decisionNodeId,
      to: 'fallback',
      condition: `!\${nodes.${decisionNodeId}.output.selected_branch}`
    });
  }

  return {
    pattern: 'conditional_branching',
    nodes,
    edges
  };
};

// Usage
const errorHandlingWorkflow = createConditionalWorkflow(
  'classify_error',
  {
    syntax_error: {
      condition: 'error_type === "SyntaxError"',
      subAgentId: 'syntax-fixer-agent',
      taskType: 'fix_syntax_error'
    },
    type_error: {
      condition: 'error_type === "TypeError"', 
      subAgentId: 'type-fixer-agent',
      taskType: 'fix_type_error'
    },
    logic_error: {
      condition: 'error_category === "logic"',
      subAgentId: 'logic-analyzer-agent',
      taskType: 'analyze_logic_error'
    },
    performance_issue: {
      condition: 'error_category === "performance"',
      subAgentId: 'performance-optimizer-agent', 
      taskType: 'optimize_performance'
    }
  },
  {
    subAgentId: 'general-debugger-agent',
    taskType: 'general_debug_analysis'
  }
);
```

### 4. Feedback Loop Pattern

```typescript
// Workflow with feedback loops for iterative processing
export const createFeedbackLoopWorkflow = (
  processingSteps: Array<{
    id: string;
    subAgentId: string;
    taskType: string;
  }>,
  evaluatorStep: {
    id: string;
    subAgentId: string;
    taskType: string;
  },
  maxIterations: number = 5
): WorkflowSpec => {
  const nodes = [
    // Initialize iteration counter
    {
      id: 'initialize',
      type: 'sub-agent',
      name: 'Initialize Iteration',
      subAgentId: 'iteration-manager-agent',
      taskDefinition: {
        type: 'initialize_iteration',
        input: {
          data: '${workflow.input}',
          max_iterations: maxIterations,
          current_iteration: 1
        },
        priority: 'high'
      },
      errorHandling: 'fail'
    },

    // Processing steps
    ...processingSteps.map((step, index) => ({
      id: step.id,
      type: 'sub-agent',
      name: `Process: ${step.id}`,
      subAgentId: step.subAgentId,
      taskDefinition: {
        type: step.taskType,
        input: index === 0 
          ? '${nodes.initialize.output.data}'
          : `\${nodes.${processingSteps[index-1].id}.output}`,
        priority: 'normal'
      },
      errorHandling: 'fail'
    })),

    // Evaluation step
    {
      id: evaluatorStep.id,
      type: 'sub-agent',
      name: 'Evaluate Result',
      subAgentId: evaluatorStep.subAgentId,
      taskDefinition: {
        type: evaluatorStep.taskType,
        input: {
          result: `\${nodes.${processingSteps[processingSteps.length - 1].id}.output}`,
          iteration: '${nodes.initialize.output.current_iteration}',
          max_iterations: maxIterations
        },
        priority: 'high'
      },
      errorHandling: 'fail'
    },

    // Iteration decision
    {
      id: 'iteration_decision',
      type: 'sub-agent',
      name: 'Decide Next Iteration',
      subAgentId: 'iteration-manager-agent',
      taskDefinition: {
        type: 'decide_iteration',
        input: {
          evaluation: `\${nodes.${evaluatorStep.id}.output}`,
          current_iteration: '${nodes.initialize.output.current_iteration}',
          max_iterations: maxIterations
        },
        priority: 'high'
      },
      errorHandling: 'fail'
    }
  ];

  const edges = [
    // Linear flow through processing steps
    { from: 'initialize', to: processingSteps[0].id },
    ...processingSteps.slice(1).map((step, index) => ({
      from: processingSteps[index].id,
      to: step.id
    })),
    
    // Flow to evaluation
    { 
      from: processingSteps[processingSteps.length - 1].id, 
      to: evaluatorStep.id 
    },
    { from: evaluatorStep.id, to: 'iteration_decision' },
    
    // Conditional feedback loop
    {
      from: 'iteration_decision',
      to: processingSteps[0].id,
      condition: `\${nodes.iteration_decision.output.continue_iteration} === true`
    }
  ];

  return {
    pattern: 'feedback_loop',
    nodes,
    edges,
    metadata: {
      max_iterations: maxIterations,
      loop_detection: true
    }
  };
};

// Usage
const iterativeOptimizationWorkflow = createFeedbackLoopWorkflow(
  [
    {
      id: 'analyze_code',
      subAgentId: 'code-analyzer-agent',
      taskType: 'analyze_performance_bottlenecks'
    },
    {
      id: 'apply_optimizations',
      subAgentId: 'code-optimizer-agent', 
      taskType: 'apply_performance_optimizations'
    },
    {
      id: 'run_benchmarks',
      subAgentId: 'benchmark-runner-agent',
      taskType: 'run_performance_benchmarks'
    }
  ],
  {
    id: 'evaluate_improvement',
    subAgentId: 'performance-evaluator-agent',
    taskType: 'evaluate_performance_improvement'
  },
  3  // Maximum 3 iterations
);
```

## State Management

### Workflow State Persistence

```typescript
// Enhanced workflow state that persists sub-agent results
export class WorkflowStateManager {
  private stateStorage: Map<string, EnhancedWorkflowState> = new Map();
  private stateHistory: Map<string, EnhancedWorkflowState[]> = new Map();

  async saveWorkflowState(
    workflowId: string, 
    state: EnhancedWorkflowState
  ): Promise<Result<void, QiError>> {
    try {
      // Create a serializable copy of the state
      const serializableState = this.makeStateSerializable(state);
      
      // Save current state
      this.stateStorage.set(workflowId, serializableState);
      
      // Add to history
      if (!this.stateHistory.has(workflowId)) {
        this.stateHistory.set(workflowId, []);
      }
      this.stateHistory.get(workflowId)!.push(serializableState);
      
      // Limit history size
      const history = this.stateHistory.get(workflowId)!;
      if (history.length > 50) {
        this.stateHistory.set(workflowId, history.slice(-50));
      }

      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to save workflow state',
          { workflowId, error }
        )
      );
    }
  }

  async loadWorkflowState(workflowId: string): Promise<Result<EnhancedWorkflowState, QiError>> {
    try {
      const state = this.stateStorage.get(workflowId);
      if (!state) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Workflow state not found',
            { workflowId }
          )
        );
      }

      // Restore non-serializable properties
      const restoredState = this.restoreStateFromSerialized(state);
      return createResult(restoredState);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to load workflow state',
          { workflowId, error }
        )
      );
    }
  }

  private makeStateSerializable(state: EnhancedWorkflowState): any {
    return {
      ...state,
      // Convert Maps to objects for JSON serialization
      subAgentResults: state.subAgentResults ? 
        Object.fromEntries(state.subAgentResults) : undefined,
      subAgentProgress: state.subAgentProgress ?
        Object.fromEntries(state.subAgentProgress) : undefined,
      subAgentErrors: state.subAgentErrors ?
        Object.fromEntries(state.subAgentErrors) : undefined,
      timestamp: new Date().toISOString()
    };
  }

  private restoreStateFromSerialized(serialized: any): EnhancedWorkflowState {
    const state = enhanceWorkflowState({
      ...serialized,
      // Convert objects back to Maps
      subAgentResults: serialized.subAgentResults ?
        new Map(Object.entries(serialized.subAgentResults)) : new Map(),
      subAgentProgress: serialized.subAgentProgress ?
        new Map(Object.entries(serialized.subAgentProgress)) : new Map(),
      subAgentErrors: serialized.subAgentErrors ?
        new Map(Object.entries(serialized.subAgentErrors)) : new Map()
    });

    return state;
  }

  async getWorkflowHistory(workflowId: string): Promise<EnhancedWorkflowState[]> {
    return this.stateHistory.get(workflowId) || [];
  }

  async clearWorkflowState(workflowId: string): Promise<void> {
    this.stateStorage.delete(workflowId);
    this.stateHistory.delete(workflowId);
  }
}
```

### Cross-Sub-Agent Data Flow

```typescript
// Utility for managing data flow between sub-agents
export class SubAgentDataFlowManager {
  
  static validateDataFlow(
    fromNode: SubAgentWorkflowNode,
    toNode: SubAgentWorkflowNode,
    state: EnhancedWorkflowState
  ): Result<void, QiError> {
    const fromResult = state.getSubAgentResult(fromNode.id);
    
    if (!fromResult) {
      return createError(
        createAgentError(
          AgentErrorCategory.VALIDATION,
          'Source sub-agent has not produced results',
          { fromNodeId: fromNode.id, toNodeId: toNode.id }
        )
      );
    }

    if (!fromResult.success) {
      return createError(
        createAgentError(
          AgentErrorCategory.VALIDATION,
          'Source sub-agent failed, cannot proceed',
          { fromNodeId: fromNode.id, toNodeId: toNode.id, error: fromResult.output }
        )
      );
    }

    // Validate data compatibility
    const outputType = this.inferOutputType(fromResult.output);
    const requiredInputType = this.inferRequiredInputType(toNode.taskDefinition);
    
    if (!this.isTypeCompatible(outputType, requiredInputType)) {
      return createError(
        createAgentError(
          AgentErrorCategory.VALIDATION,
          'Data type mismatch between sub-agents',
          { 
            fromNodeId: fromNode.id,
            toNodeId: toNode.id,
            outputType,
            requiredInputType
          }
        )
      );
    }

    return createResult(undefined);
  }

  static transformDataForSubAgent(
    sourceData: unknown,
    targetTaskType: string,
    transformationRules?: DataTransformationRule[]
  ): unknown {
    if (!transformationRules) {
      return sourceData;
    }

    let transformedData = sourceData;
    
    for (const rule of transformationRules) {
      if (rule.condition(transformedData, targetTaskType)) {
        transformedData = rule.transform(transformedData);
      }
    }

    return transformedData;
  }

  private static inferOutputType(output: unknown): string {
    if (Array.isArray(output)) return 'array';
    if (typeof output === 'string') return 'string';
    if (typeof output === 'object' && output !== null) {
      if ('content' in output) return 'file_content';
      if ('analysis' in output) return 'analysis_result';
      if ('results' in output) return 'results_collection';
      return 'object';
    }
    return typeof output;
  }

  private static inferRequiredInputType(taskDefinition: any): string {
    const taskType = taskDefinition.type;
    
    // Task type to expected input type mapping
    const typeMapping: Record<string, string> = {
      'read_file': 'file_path',
      'write_file': 'file_content',
      'analyze_text': 'string',
      'transform_data': 'object',
      'process_results': 'results_collection'
    };

    return typeMapping[taskType] || 'unknown';
  }

  private static isTypeCompatible(outputType: string, inputType: string): boolean {
    // Define compatibility rules
    const compatibilityMatrix: Record<string, string[]> = {
      'string': ['string', 'file_content'],
      'file_content': ['string', 'file_content'],
      'array': ['array', 'results_collection'],
      'object': ['object', 'analysis_result'],
      'analysis_result': ['object', 'analysis_result'],
      'results_collection': ['array', 'results_collection']
    };

    const compatibleTypes = compatibilityMatrix[outputType] || [];
    return compatibleTypes.includes(inputType) || inputType === 'unknown';
  }
}

interface DataTransformationRule {
  condition: (data: unknown, targetTaskType: string) => boolean;
  transform: (data: unknown) => unknown;
}

// Example transformation rules
export const commonDataTransformations: DataTransformationRule[] = [
  {
    // Extract content from file read results
    condition: (data, targetTaskType) => 
      typeof data === 'object' && 
      data !== null && 
      'content' in data && 
      targetTaskType.includes('text'),
    transform: (data: any) => data.content
  },
  {
    // Wrap single results in array for batch processing
    condition: (data, targetTaskType) => 
      !Array.isArray(data) && 
      targetTaskType.includes('batch'),
    transform: (data) => [data]
  },
  {
    // Extract results array from batch processing output
    condition: (data, targetTaskType) => 
      typeof data === 'object' && 
      data !== null && 
      'results' in data &&
      !targetTaskType.includes('batch'),
    transform: (data: any) => data.results
  }
];
```

This comprehensive workflow integration guide provides all the tools and patterns needed to effectively integrate sub-agents into the existing workflow system while maintaining backward compatibility and adding powerful new capabilities.