/**
 * Workflow-Driven Sub-Agent Architecture
 *
 * Implementation of the v-0.10.0 Sub-Agent System as specified in
 * docs/roadmap/impl.v-0.10.0-revised.md
 */

// Core sub-agent components (fully implemented)
export * from './core/index.js';
// Re-export commonly used types for convenience
export type {
  ISubAgent,
  ISubAgentFactory,
  ISubAgentRegistry,
  SubAgentCapability,
  SubAgentConfig,
  SubAgentHealth,
  SubAgentProgress,
  SubAgentResult,
  SubAgentTask,
} from './core/types.js';
// Tool-specialized sub-agents (types only for now)
export * from './tool-specialized/index.js';
