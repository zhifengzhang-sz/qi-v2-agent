/**
 * Context Manager - Abstract Interfaces
 *
 * Public interface exports for context management
 */

// Type definitions
export type {
  AgentSpecialization,
  AppContext,
  ContextAccessAudit,
  ContextMessage,
  ConversationContext,
  IsolatedContext,
  IsolatedContextConfig,
  SecurityRestrictions,
} from './ContextTypes.js';
// Core interfaces
export type {
  ContextManagerStatistics,
  IContextManager,
  ISecurityBoundaryManager,
} from './IContextManager.js';

// Provider interfaces (v-0.8.0) - TODO: Create IContextProvider.js file
// export type {
//   IContextProvider,
//   ISessionProvider,
//   IStreamingProvider,
//   IWorkflowProvider,
//   ProviderStatus,
//   SessionContext,
//   SessionMessage,
//   StreamingContext,
//   StreamingContextConfig,
//   StreamingEvent,
//   WorkflowContext,
//   WorkflowContextConfig,
//   WorkflowExecutionState,
// } from './IContextProvider.js';
