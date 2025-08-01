/**
 * Agent Module - Public Abstractions
 *
 * Public interface contracts for the agent module.
 * Other modules should only import from this file.
 */

export type {
  AgentConfig,
  AgentContext,
  AgentRequest,
  AgentResponse,
  AgentStatus,
  AgentStreamChunk,
  IAgent,
} from './IAgent.js';
