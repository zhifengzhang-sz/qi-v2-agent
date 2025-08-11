/**
 * @qi/workflows - Simple workflow handling with two-layer architecture
 *
 * Provides a user-friendly API that hides qicore complexity
 */

export { FileReferenceWorkflow } from './FileReferenceWorkflow.js';
// User-facing layer (simple interface, no qicore knowledge required)
export { DefaultWorkflowHandler } from './impl/DefaultWorkflowHandler.js';

// Internal qicore layer (for advanced usage)
export { QiCoreWorkflowManager } from './impl/QiCoreWorkflowManager.js';
export type {
  IWorkflowHandler,
  ToolInfo,
  WorkflowInfo,
  WorkflowOptions,
  WorkflowResponse,
} from './interfaces/IWorkflowHandler.js';
export type {
  IWorkflowManager,
  ToolInitializationConfig,
  WorkflowInput,
  WorkflowManagerStats,
} from './interfaces/IWorkflowManager.js';
export type { WorkflowResult } from './SimpleWorkflow.js';
// Legacy exports (for backwards compatibility during migration)
export { SimpleWorkflow, SimpleWorkflowClass } from './SimpleWorkflow.js';
export type { WorkflowStats } from './WorkflowManager.js';
export { WorkflowManager } from './WorkflowManager.js';

// Factory function for easy setup
import { DefaultWorkflowHandler } from './impl/DefaultWorkflowHandler.js';
import { QiCoreWorkflowManager } from './impl/QiCoreWorkflowManager.js';

/**
 * Create a workflow handler with default QiCore-based manager
 *
 * Usage:
 * ```typescript
 * const handler = createWorkflowHandler()
 * const initResult = await handler.initialize()
 * if (initResult.success) {
 *   const response = await handler.executeWorkflow('@file.txt', { type: 'FILE_REFERENCE' })
 * }
 * ```
 */
export function createWorkflowHandler(): DefaultWorkflowHandler {
  const manager = new QiCoreWorkflowManager();
  return new DefaultWorkflowHandler(manager);
}
