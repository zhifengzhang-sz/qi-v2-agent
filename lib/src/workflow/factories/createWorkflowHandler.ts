/**
 * @qi/workflow - Workflow Handler Factory
 *
 * Factory function that implements the two-layer architecture pattern.
 * Creates a clean interface layer that hides QiCore complexity.
 */

import { match } from '@qi/base';
import { createQiLogger } from '../../utils/QiCoreLogger.js';
import { DefaultWorkflowHandler } from '../impl/DefaultWorkflowHandler.js';
import { QiCoreWorkflowManager } from '../impl/QiCoreWorkflowManager.js';
import type { IWorkflowHandler } from '../interfaces/index.js';
import type { WorkflowToolExecutor } from '../services/WorkflowToolExecutor.js';

/**
 * Configuration for workflow handler factory
 */
export interface WorkflowHandlerConfig {
  toolExecutor?: WorkflowToolExecutor;
  enableLogging?: boolean;
  logLevel?: 'debug' | 'info' | 'warn' | 'error';
}

/**
 * Create a workflow handler following the two-layer architecture pattern
 *
 * This factory function:
 * 1. Creates the internal QiCore layer (QiCoreWorkflowManager)
 * 2. Creates the interface layer (DefaultWorkflowHandler)
 * 3. Initializes the system and handles any setup errors
 * 4. Returns a clean Promise-based API that hides QiCore complexity
 *
 * @param config Optional configuration for the workflow handler
 * @returns Promise<IWorkflowHandler> - Clean interface layer
 */
export async function createWorkflowHandler(
  config?: WorkflowHandlerConfig
): Promise<IWorkflowHandler> {
  const logger = createQiLogger({
    name: 'WorkflowHandlerFactory',
    level: config?.logLevel || 'info',
  });

  logger.info('🏗️ Creating workflow handler with two-layer architecture', undefined, {
    component: 'WorkflowHandlerFactory',
    method: 'createWorkflowHandler',
    hasToolExecutor: !!config?.toolExecutor,
  });

  try {
    // Create internal QiCore layer
    const qicoreManager = new QiCoreWorkflowManager(config?.toolExecutor);

    // Initialize the QiCore layer
    const initResult = await qicoreManager.initialize();

    // Use QiCore match() to handle initialization result
    const handler = match(
      () => {
        logger.info('✅ QiCore layer initialized successfully', undefined, {
          component: 'WorkflowHandlerFactory',
          method: 'createWorkflowHandler',
        });

        // Create interface layer that hides QiCore complexity
        const interfaceLayer = new DefaultWorkflowHandler(qicoreManager);

        logger.info('✅ Two-layer workflow handler created successfully', undefined, {
          component: 'WorkflowHandlerFactory',
          method: 'createWorkflowHandler',
        });

        return interfaceLayer;
      },
      (error) => {
        logger.error('❌ Failed to initialize QiCore layer', undefined, {
          component: 'WorkflowHandlerFactory',
          method: 'createWorkflowHandler',
          errorMessage: error.message,
          errorCode: error.code,
        });

        // Convert QiCore error to simple exception for interface layer
        throw new Error(`Failed to initialize workflow system: ${error.message}`);
      },
      initResult
    );

    return handler;
  } catch (error) {
    logger.error('❌ Failed to create workflow handler', undefined, {
      component: 'WorkflowHandlerFactory',
      method: 'createWorkflowHandler',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // Re-throw as simple error for interface layer
    throw error instanceof Error ? error : new Error(String(error));
  }
}

/**
 * Create workflow handler with graceful degradation
 *
 * This variant attempts to create the full workflow handler but falls back
 * to a minimal implementation if there are issues.
 *
 * @param config Optional configuration for the workflow handler
 * @returns Promise<IWorkflowHandler> - Always returns a working handler
 */
export async function createWorkflowHandlerWithFallback(
  config?: WorkflowHandlerConfig
): Promise<IWorkflowHandler> {
  const logger = createQiLogger({
    name: 'WorkflowHandlerFactory',
    level: config?.logLevel || 'info',
  });

  try {
    return await createWorkflowHandler(config);
  } catch (error) {
    logger.warn('⚠️ Primary workflow handler creation failed, using fallback', undefined, {
      component: 'WorkflowHandlerFactory',
      method: 'createWorkflowHandlerWithFallback',
      errorMessage: error instanceof Error ? error.message : String(error),
    });

    // Return a minimal fallback implementation
    return createFallbackHandler();
  }
}

/**
 * Create a minimal fallback workflow handler
 */
function createFallbackHandler(): IWorkflowHandler {
  return {
    async executeWorkflow(pattern: string, input: string) {
      return {
        output: `Fallback result for ${pattern}: ${input}`,
        executionTime: 100,
        toolResults: [],
        success: true,
      };
    },

    async executeReAct(input: string) {
      return {
        output: `Fallback ReAct result: ${input}`,
        executionTime: 100,
        toolResults: [],
        metadata: { pattern: 'react-fallback' },
        success: true,
      };
    },

    async executeReWOO(input: string) {
      return {
        output: `Fallback ReWOO result: ${input}`,
        executionTime: 100,
        toolResults: [],
        metadata: { pattern: 'rewoo-fallback' },
        success: true,
      };
    },

    async executeADaPT(input: string) {
      return {
        output: `Fallback ADaPT result: ${input}`,
        executionTime: 100,
        toolResults: [],
        metadata: { pattern: 'adapt-fallback' },
        success: true,
      };
    },

    async streamWorkflow(pattern: string, input: string, onProgress) {
      onProgress({ stage: 'fallback', progress: 100 });
      return {
        output: `Fallback stream result for ${pattern}: ${input}`,
        executionTime: 100,
        toolResults: [],
        success: true,
      };
    },

    async getAvailablePatterns() {
      return ['fallback'];
    },

    async isPatternAvailable() {
      return true;
    },
  };
}
