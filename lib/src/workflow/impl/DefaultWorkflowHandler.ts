/**
 * @qi/workflow - Default Workflow Handler Implementation
 *
 * Interface layer implementation that hides QiCore complexity from end users.
 * Converts QiCore Result<T> patterns to simple Promise-based APIs.
 */

import { match } from '@qi/base';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type {
  IWorkflowHandler,
  IWorkflowManager,
  PatternConfig,
  PatternExecutionResult,
  WorkflowConfig,
  WorkflowExecutionContext,
  WorkflowExecutionResult,
  WorkflowToolResult,
} from '../interfaces/index.js';

/**
 * Default implementation of the workflow handler interface layer
 *
 * This class provides a clean, simple API that hides QiCore Result<T> complexity.
 * It delegates all work to the internal QiCoreWorkflowManager.
 */
export class DefaultWorkflowHandler implements IWorkflowHandler {
  private manager: IWorkflowManager;
  private logger: SimpleLogger;

  constructor(manager: IWorkflowManager) {
    this.manager = manager;
    this.logger = createQiLogger({
      name: 'DefaultWorkflowHandler',
      level: 'info',
    });
  }

  /**
   * Convert ToolResult array to WorkflowToolResult array (private helper)
   */
  private convertToolResults(toolResults: readonly any[]): WorkflowToolResult[] {
    return toolResults.map((tool) => ({
      toolName: tool.toolName || 'unknown',
      input: {},
      output: tool.data || tool.output || '',
      success: tool.status === 'success' || tool.success === true,
      executionTime: tool.executionTime || 0,
      metadata: tool.metadata || new Map(),
      callId: tool.callId || `converted-${Date.now()}`,
      error: tool.status === 'error' ? 'Tool execution failed' : undefined,
    }));
  }

  /**
   * Execute a workflow pattern with simple configuration
   */
  async executeWorkflow(
    pattern: string,
    input: string,
    config?: WorkflowConfig
  ): Promise<WorkflowExecutionResult> {
    this.logger.info('🚀 Executing workflow via interface layer', undefined, {
      component: 'DefaultWorkflowHandler',
      method: 'executeWorkflow',
      pattern,
      input: input.substring(0, 100),
    });

    const context: WorkflowExecutionContext = {
      sessionId: `workflow-${Date.now()}`,
      domain: 'general',
      timeout: config?.timeout,
      enableStreaming: config?.enableStreaming,
      enableMetrics: config?.enableMetrics,
    };

    const result = await this.manager.executeWorkflow(pattern, input, context);

    return match(
      (workflowResult) => {
        this.logger.info('✅ Workflow completed successfully', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'executeWorkflow',
          pattern,
          executionTime: workflowResult.performance.totalTime,
        });

        return {
          output: workflowResult.finalState.output,
          executionTime: workflowResult.performance.totalTime,
          toolResults: this.convertToolResults(workflowResult.finalState.toolResults),
          success: true,
        };
      },
      (error) => {
        this.logger.error('❌ Workflow execution failed', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'executeWorkflow',
          pattern,
          errorMessage: error.message,
        });

        // Convert QiCore error to simple Promise rejection
        throw new Error(`Workflow execution failed: ${error.message}`);
      },
      result
    );
  }

  /**
   * Execute ReAct pattern with simple configuration
   */
  async executeReAct(input: string, config?: PatternConfig): Promise<PatternExecutionResult> {
    this.logger.info('🔄 Executing ReAct pattern via interface layer', undefined, {
      component: 'DefaultWorkflowHandler',
      method: 'executeReAct',
      input: input.substring(0, 100),
    });

    const context: WorkflowExecutionContext = {
      sessionId: `react-${Date.now()}`,
      domain: 'reasoning',
      timeout: config?.timeout,
      enableStreaming: config?.enableStreaming,
      enableMetrics: true,
    };

    const result = await this.manager.executeReActPattern(input, context, config?.maxSteps);

    return match(
      (patternResult) => {
        this.logger.info('✅ ReAct pattern completed successfully', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'executeReAct',
          executionTime: patternResult.executionTime,
        });

        return {
          output: patternResult.output,
          executionTime: patternResult.executionTime,
          toolResults: patternResult.toolResults,
          metadata: Object.fromEntries(patternResult.metadata.entries()),
          success: true,
        };
      },
      (error) => {
        this.logger.error('❌ ReAct pattern execution failed', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'executeReAct',
          errorMessage: error.message,
        });

        throw new Error(`ReAct pattern execution failed: ${error.message}`);
      },
      result
    );
  }

  /**
   * Execute ReWOO pattern with simple configuration
   */
  async executeReWOO(input: string, config?: PatternConfig): Promise<PatternExecutionResult> {
    this.logger.info('⚡ Executing ReWOO pattern via interface layer', undefined, {
      component: 'DefaultWorkflowHandler',
      method: 'executeReWOO',
      input: input.substring(0, 100),
    });

    const context: WorkflowExecutionContext = {
      sessionId: `rewoo-${Date.now()}`,
      domain: 'planning',
      timeout: config?.timeout,
      enableStreaming: config?.enableStreaming,
      enableMetrics: true,
    };

    const result = await this.manager.executeReWOOPattern(input, context);

    return match(
      (patternResult) => {
        this.logger.info('✅ ReWOO pattern completed successfully', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'executeReWOO',
          executionTime: patternResult.executionTime,
        });

        return {
          output: patternResult.output,
          executionTime: patternResult.executionTime,
          toolResults: patternResult.toolResults,
          metadata: Object.fromEntries(patternResult.metadata.entries()),
          success: true,
        };
      },
      (error) => {
        this.logger.error('❌ ReWOO pattern execution failed', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'executeReWOO',
          errorMessage: error.message,
        });

        throw new Error(`ReWOO pattern execution failed: ${error.message}`);
      },
      result
    );
  }

  /**
   * Execute ADaPT pattern with simple configuration
   */
  async executeADaPT(input: string, config?: PatternConfig): Promise<PatternExecutionResult> {
    this.logger.info('🔧 Executing ADaPT pattern via interface layer', undefined, {
      component: 'DefaultWorkflowHandler',
      method: 'executeADaPT',
      input: input.substring(0, 100),
    });

    const context: WorkflowExecutionContext = {
      sessionId: `adapt-${Date.now()}`,
      domain: 'decomposition',
      timeout: config?.timeout,
      enableStreaming: config?.enableStreaming,
      enableMetrics: true,
    };

    const result = await this.manager.executeADaPTPattern(input, context);

    return match(
      (patternResult) => {
        this.logger.info('✅ ADaPT pattern completed successfully', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'executeADaPT',
          executionTime: patternResult.executionTime,
        });

        return {
          output: patternResult.output,
          executionTime: patternResult.executionTime,
          toolResults: patternResult.toolResults,
          metadata: Object.fromEntries(patternResult.metadata.entries()),
          success: true,
        };
      },
      (error) => {
        this.logger.error('❌ ADaPT pattern execution failed', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'executeADaPT',
          errorMessage: error.message,
        });

        throw new Error(`ADaPT pattern execution failed: ${error.message}`);
      },
      result
    );
  }

  /**
   * Stream workflow execution with simple callback interface
   */
  async streamWorkflow(
    pattern: string,
    input: string,
    onProgress: (progress: { stage: string; progress: number; output?: string }) => void,
    config?: WorkflowConfig
  ): Promise<WorkflowExecutionResult> {
    this.logger.info('📡 Streaming workflow via interface layer', undefined, {
      component: 'DefaultWorkflowHandler',
      method: 'streamWorkflow',
      pattern,
      input: input.substring(0, 100),
    });

    const context: WorkflowExecutionContext = {
      sessionId: `stream-${Date.now()}`,
      domain: 'streaming',
      timeout: config?.timeout,
      enableStreaming: true,
      enableMetrics: config?.enableMetrics,
    };

    let finalResult: WorkflowExecutionResult | null = null;

    try {
      for await (const chunkResult of this.manager.streamWorkflow(pattern, input, context)) {
        if (chunkResult.tag === 'success') {
          const chunk = chunkResult.value;
          onProgress({
            stage: chunk.state.metadata.currentStage || 'processing',
            progress: chunk.isComplete ? 100 : 50, // Simple progress calculation
            output: chunk.state.output,
          });

          if (chunk.isComplete) {
            finalResult = {
              output: chunk.state.output,
              executionTime: Date.now() - chunk.state.metadata.startTime,
              toolResults: this.convertToolResults(chunk.state.toolResults),
              success: true,
            };
          }
        } else {
          const error = chunkResult.error;
          this.logger.error('❌ Stream chunk error', undefined, {
            component: 'DefaultWorkflowHandler',
            method: 'streamWorkflow',
            errorMessage: error.message,
          });
          throw new Error(`Stream error: ${error.message}`);
        }
      }

      if (!finalResult) {
        throw new Error('Streaming workflow completed without final result');
      }

      const result = finalResult; // TypeScript assertion helper

      this.logger.info('✅ Streaming workflow completed successfully', undefined, {
        component: 'DefaultWorkflowHandler',
        method: 'streamWorkflow',
        pattern,
        executionTime: result.executionTime,
      });

      return finalResult;
    } catch (error) {
      this.logger.error('❌ Streaming workflow failed', undefined, {
        component: 'DefaultWorkflowHandler',
        method: 'streamWorkflow',
        pattern,
        errorMessage: error instanceof Error ? error.message : String(error),
      });

      throw error instanceof Error ? error : new Error(String(error));
    }
  }

  /**
   * Get available workflow patterns
   */
  async getAvailablePatterns(): Promise<string[]> {
    const result = this.manager.getAvailablePatterns();

    return match(
      (patterns) => Array.from(patterns),
      (error) => {
        this.logger.error('❌ Failed to get available patterns', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'getAvailablePatterns',
          errorMessage: error.message,
        });
        throw new Error(`Failed to get patterns: ${error.message}`);
      },
      result
    );
  }

  /**
   * Check if a pattern is available
   */
  async isPatternAvailable(pattern: string): Promise<boolean> {
    const result = this.manager.isPatternAvailable(pattern);

    return match(
      (available) => available,
      (error) => {
        this.logger.warn('⚠️ Failed to check pattern availability', undefined, {
          component: 'DefaultWorkflowHandler',
          method: 'isPatternAvailable',
          pattern,
          errorMessage: error.message,
        });
        return false; // Graceful degradation
      },
      result
    );
  }
}
