/**
 * @qi/workflow - QiCore Workflow Manager Implementation
 *
 * Internal QiCore layer that uses Result<T> patterns throughout.
 * This encapsulates all workflow patterns and tools as private members.
 */

import { create, failure, fromAsyncTryCatch, type QiError, type Result, success } from '@qi/base';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type {
  InternalPatternResult,
  IWorkflowManager,
  WorkflowExecutionContext,
  WorkflowResult,
  WorkflowState,
  WorkflowStreamChunk,
} from '../interfaces/index.js';
import { ADaPTPattern } from '../patterns/ADaPTPattern.js';
import { ReActPattern } from '../patterns/ReActPattern.js';
import { ReWOOPattern } from '../patterns/ReWOOPattern.js';
import type { WorkflowToolExecutor } from '../services/WorkflowToolExecutor.js';

/**
 * Internal QiCore workflow manager implementation
 *
 * This class encapsulates all QiCore complexity and provides Result<T>-based APIs.
 * All tool imports and pattern implementations are private to prevent leakage.
 */
export class QiCoreWorkflowManager implements IWorkflowManager {
  private logger: SimpleLogger;
  private toolExecutor?: WorkflowToolExecutor;

  // Private pattern instances to prevent leakage
  private reactPattern?: ReActPattern;
  private rewooPattern?: ReWOOPattern;
  private adaptPattern?: ADaPTPattern;

  // Configuration
  private initialized = false;
  private availablePatterns: readonly string[] = ['react', 'rewoo', 'adapt', 'simple'];

  constructor(toolExecutor?: WorkflowToolExecutor) {
    this.toolExecutor = toolExecutor;
    this.logger = createQiLogger({
      name: 'QiCoreWorkflowManager',
      level: 'info',
    });
  }

  /**
   * Initialize the manager with QiCore patterns
   */
  async initialize(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async (): Promise<void> => {
        this.logger.info('🔧 Initializing QiCore workflow manager', undefined, {
          component: 'QiCoreWorkflowManager',
          method: 'initialize',
        });

        // Initialize research patterns with tool executor
        this.reactPattern = new ReActPattern(this.toolExecutor);
        this.rewooPattern = new ReWOOPattern(this.toolExecutor);
        this.adaptPattern = new ADaPTPattern(this.toolExecutor);

        this.initialized = true;

        this.logger.info('✅ QiCore workflow manager initialized', undefined, {
          component: 'QiCoreWorkflowManager',
          method: 'initialize',
          availablePatterns: this.availablePatterns.length,
        });
      },
      (error: unknown): QiError =>
        create(
          'WORKFLOW_MANAGER_INIT_FAILED',
          `Failed to initialize workflow manager: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { component: 'QiCoreWorkflowManager' }
        )
    );
  }

  /**
   * Execute workflow with full QiCore error handling
   */
  async executeWorkflow(
    pattern: string,
    input: string,
    context: WorkflowExecutionContext
  ): Promise<Result<WorkflowResult, QiError>> {
    if (!this.initialized) {
      return failure(
        create('MANAGER_NOT_INITIALIZED', 'Workflow manager not initialized', 'SYSTEM', { pattern })
      );
    }

    this.logger.info('🚀 Executing workflow with QiCore patterns', undefined, {
      component: 'QiCoreWorkflowManager',
      method: 'executeWorkflow',
      pattern,
      sessionId: context.sessionId,
    });

    return fromAsyncTryCatch(
      async (): Promise<WorkflowResult> => {
        const startTime = Date.now();

        // Create initial workflow state
        const initialState: WorkflowState = {
          input,
          pattern,
          domain: context.domain,
          context: context.metadata || new Map(),
          toolResults: [],
          reasoningOutput: '',
          output: '',
          metadata: {
            startTime,
            currentStage: 'starting',
            processingSteps: [],
            performance: new Map(),
          },
        };

        let finalState: WorkflowState;

        // Execute based on pattern type
        switch (pattern.toLowerCase()) {
          case 'react': {
            const reactResult = await this.executeReActPattern(input, context);
            if (reactResult.tag === 'failure') {
              throw new Error(`ReAct execution failed: ${reactResult.error.message}`);
            }
            finalState = this.convertPatternResultToState(reactResult.value, initialState);
            break;
          }

          case 'rewoo': {
            const rewooResult = await this.executeReWOOPattern(input, context);
            if (rewooResult.tag === 'failure') {
              throw new Error(`ReWOO execution failed: ${rewooResult.error.message}`);
            }
            finalState = this.convertPatternResultToState(rewooResult.value, initialState);
            break;
          }

          case 'adapt': {
            const adaptResult = await this.executeADaPTPattern(input, context);
            if (adaptResult.tag === 'failure') {
              throw new Error(`ADaPT execution failed: ${adaptResult.error.message}`);
            }
            finalState = this.convertPatternResultToState(adaptResult.value, initialState);
            break;
          }
          default:
            // Simple workflow execution
            finalState = {
              ...initialState,
              output: `Simple workflow result for: ${input}`,
              reasoningOutput: 'Basic processing completed',
              metadata: {
                ...initialState.metadata,
                currentStage: 'completed',
                processingSteps: ['input', 'processing', 'output'],
              },
            };
            break;
        }

        const executionTime = Date.now() - startTime;

        return {
          finalState,
          executionPath: finalState.metadata.processingSteps,
          performance: {
            totalTime: executionTime,
            nodeExecutionTimes: finalState.metadata.performance,
            toolExecutionTime: finalState.toolResults.reduce(
              (total, result) => total + result.executionTime,
              0
            ),
            reasoningTime:
              executionTime -
              finalState.toolResults.reduce((total, result) => total + result.executionTime, 0),
          },
        };
      },
      (error: unknown): QiError =>
        create(
          'WORKFLOW_EXECUTION_FAILED',
          `Workflow execution failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { pattern, sessionId: context.sessionId }
        )
    );
  }

  /**
   * Execute ReAct pattern with QiCore patterns
   */
  async executeReActPattern(
    input: string,
    context: WorkflowExecutionContext,
    maxSteps?: number
  ): Promise<Result<InternalPatternResult, QiError>> {
    if (!this.reactPattern) {
      return failure(
        create('PATTERN_NOT_AVAILABLE', 'ReAct pattern not initialized', 'SYSTEM', {
          pattern: 'react',
        })
      );
    }

    return fromAsyncTryCatch(
      async (): Promise<InternalPatternResult> => {
        if (!this.reactPattern) {
          throw new Error('ReAct pattern not initialized');
        }
        const result = await this.reactPattern.execute(input, context.sessionId, maxSteps);

        return {
          output: result.output,
          executionTime: Date.now() - (Date.now() - 1000), // Approximate
          toolResults: result.toolResults,
          metadata: new Map([
            ['pattern', 'react'],
            ['totalSteps', result.totalSteps.toString()],
            ['thoughtCount', result.thoughtHistory.length.toString()],
            ['actionCount', result.actionHistory.length.toString()],
          ]),
          performance: new Map([
            ['executionTime', Date.now() - (Date.now() - 1000)],
            ['toolTime', result.toolResults.reduce((total, tool) => total + tool.executionTime, 0)],
          ]),
        };
      },
      (error: unknown): QiError => ({
        code: 'REACT_PATTERN_FAILED',
        message: `ReAct pattern execution failed: ${error instanceof Error ? error.message : String(error)}`,
        category: 'SYSTEM',
        context: { sessionId: context.sessionId },
      })
    );
  }

  /**
   * Execute ReWOO pattern with QiCore patterns
   */
  async executeReWOOPattern(
    input: string,
    context: WorkflowExecutionContext
  ): Promise<Result<InternalPatternResult, QiError>> {
    if (!this.rewooPattern) {
      return failure({
        code: 'PATTERN_NOT_AVAILABLE',
        message: 'ReWOO pattern not initialized',
        category: 'SYSTEM',
        context: { pattern: 'rewoo' },
      });
    }

    return fromAsyncTryCatch(
      async (): Promise<InternalPatternResult> => {
        if (!this.rewooPattern) {
          throw new Error('ReWOO pattern not initialized');
        }
        const result = await this.rewooPattern.execute(input, context.sessionId);

        return {
          output: result.output,
          executionTime: result.performance.totalTime,
          toolResults: result.toolResults,
          metadata: new Map([
            ['pattern', 'rewoo'],
            ['planSteps', result.plan.length.toString()],
            ['evidenceCount', result.evidence.length.toString()],
            ['planningTime', result.performance.planningTime.toString()],
            ['workingTime', result.performance.workingTime.toString()],
            ['solvingTime', result.performance.solvingTime.toString()],
          ]),
          performance: new Map([
            ['executionTime', result.performance.totalTime],
            ['planningTime', result.performance.planningTime],
            ['workingTime', result.performance.workingTime],
            ['solvingTime', result.performance.solvingTime],
          ]),
        };
      },
      (error: unknown): QiError => ({
        code: 'REWOO_PATTERN_FAILED',
        message: `ReWOO pattern execution failed: ${error instanceof Error ? error.message : String(error)}`,
        category: 'SYSTEM',
        context: { sessionId: context.sessionId },
      })
    );
  }

  /**
   * Execute ADaPT pattern with QiCore patterns
   */
  async executeADaPTPattern(
    input: string,
    context: WorkflowExecutionContext
  ): Promise<Result<InternalPatternResult, QiError>> {
    if (!this.adaptPattern) {
      return failure({
        code: 'PATTERN_NOT_AVAILABLE',
        message: 'ADaPT pattern not initialized',
        category: 'SYSTEM',
        context: { pattern: 'adapt' },
      });
    }

    return fromAsyncTryCatch(
      async (): Promise<InternalPatternResult> => {
        if (!this.adaptPattern) {
          throw new Error('ADaPT pattern not initialized');
        }
        const result = await this.adaptPattern.execute(input, context.sessionId);

        return {
          output: result.output,
          executionTime: result.performance.totalTime,
          toolResults: result.toolResults,
          metadata: new Map([
            ['pattern', 'adapt'],
            ['totalTasks', result.tasks.length.toString()],
            ['completedTasks', result.completedTasks.length.toString()],
            ['failedTasks', result.failedTasks.length.toString()],
            ['decompositionCount', result.performance.decompositionCount.toString()],
            ['totalExecutions', result.performance.totalExecutions.toString()],
          ]),
          performance: new Map([
            ['executionTime', result.performance.totalTime],
            ['decompositionCount', result.performance.decompositionCount],
            ['totalExecutions', result.performance.totalExecutions],
          ]),
        };
      },
      (error: unknown): QiError => ({
        code: 'ADAPT_PATTERN_FAILED',
        message: `ADaPT pattern execution failed: ${error instanceof Error ? error.message : String(error)}`,
        category: 'SYSTEM',
        context: { sessionId: context.sessionId },
      })
    );
  }

  /**
   * Stream workflow execution with QiCore error handling
   */
  async *streamWorkflow(
    pattern: string,
    input: string,
    context: WorkflowExecutionContext
  ): AsyncIterable<Result<WorkflowStreamChunk, QiError>> {
    if (!this.initialized) {
      yield failure({
        code: 'MANAGER_NOT_INITIALIZED',
        message: 'Workflow manager not initialized',
        category: 'SYSTEM',
        context: { pattern },
      });
      return;
    }

    // For now, simulate streaming by executing and yielding progress
    // In a full implementation, this would integrate with LangGraph streaming
    const startTime = Date.now();

    yield success({
      nodeId: 'start',
      state: {
        input,
        pattern,
        domain: context.domain,
        context: context.metadata || new Map(),
        toolResults: [],
        reasoningOutput: '',
        output: '',
        metadata: {
          startTime,
          currentStage: 'starting',
          processingSteps: ['start'],
          performance: new Map(),
        },
      },
      isComplete: false,
    });

    // Execute the actual workflow
    const result = await this.executeWorkflow(pattern, input, context);

    if (result.tag === 'success') {
      yield success({
        nodeId: 'complete',
        state: result.value.finalState,
        isComplete: true,
      });
    } else {
      yield failure(result.error);
    }
  }

  /**
   * Get available patterns with QiCore error handling
   */
  getAvailablePatterns(): Result<readonly string[], QiError> {
    return success(this.availablePatterns);
  }

  /**
   * Check pattern availability with QiCore error handling
   */
  isPatternAvailable(pattern: string): Result<boolean, QiError> {
    return success(this.availablePatterns.includes(pattern.toLowerCase()));
  }

  /**
   * Cleanup resources with QiCore patterns
   */
  async cleanup(): Promise<Result<void, QiError>> {
    return fromAsyncTryCatch(
      async (): Promise<void> => {
        this.logger.info('🧹 Cleaning up QiCore workflow manager', undefined, {
          component: 'QiCoreWorkflowManager',
          method: 'cleanup',
        });

        // Reset patterns
        this.reactPattern = undefined;
        this.rewooPattern = undefined;
        this.adaptPattern = undefined;
        this.initialized = false;

        this.logger.info('✅ QiCore workflow manager cleaned up', undefined, {
          component: 'QiCoreWorkflowManager',
          method: 'cleanup',
        });
      },
      (error: unknown): QiError => ({
        code: 'CLEANUP_FAILED',
        message: `Cleanup failed: ${error instanceof Error ? error.message : String(error)}`,
        category: 'SYSTEM',
        context: { component: 'QiCoreWorkflowManager' },
      })
    );
  }

  /**
   * Convert pattern result to workflow state (private helper)
   */
  private convertPatternResultToState(
    patternResult: InternalPatternResult,
    initialState: WorkflowState
  ): WorkflowState {
    // Convert WorkflowToolResult to ToolResult for state compatibility
    const convertedToolResults = patternResult.toolResults.map((workflowTool) => ({
      toolName: workflowTool.toolName,
      status: workflowTool.success ? ('success' as const) : ('error' as const),
      data: workflowTool.output,
      executionTime: workflowTool.executionTime,
      metadata: workflowTool.metadata,
    }));

    return {
      ...initialState,
      output: patternResult.output,
      toolResults: convertedToolResults,
      reasoningOutput: 'Pattern execution completed',
      metadata: {
        ...initialState.metadata,
        currentStage: 'completed',
        processingSteps: ['input', 'pattern-execution', 'output'],
        performance: patternResult.performance,
      },
    };
  }
}
