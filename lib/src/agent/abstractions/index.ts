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
  ClassificationData,
  CompletionData,
  DelegationCriteria,
  IAgent,
  IAgentOrchestrator,
  ISubagentRegistry,
  SubagentDefinition,
} from './IAgent.js';
