/**
 * Agent Module - Public API
 *
 * External modules should only import from this file.
 * Implementation details are hidden.
 */

// Export public abstractions
export type {
  AgentConfig,
  AgentContext,
  AgentRequest,
  AgentResponse,
  AgentStatus,
  AgentStreamChunk,
  IAgent,
} from './abstractions/index.js';

import type { IClassifier } from '../classifier/index.js';
import type { ICommandHandler } from '../command/index.js';
import type { IContextManager } from '../context/index.js';
import type { IPromptHandler } from '../prompt/index.js';
import type { IStateManager } from '../state/index.js';
import type { IWorkflowEngine, IWorkflowExtractor } from '../workflow/index.js';
import type { AgentConfig } from './abstractions/index.js';
// Export factory functions (not implementation classes)
import { QiCodeAgent } from './impl/QiCodeAgent.js';
import { PromptAppOrchestrator } from './PromptAppOrchestrator.js';

/**
 * Agent factory configuration following prompt module pattern
 */
export interface AgentFactoryConfig extends AgentConfig {
  readonly classifier?: IClassifier;
  readonly commandHandler?: ICommandHandler;
  readonly promptHandler?: IPromptHandler;
  readonly workflowEngine?: IWorkflowEngine;
  readonly workflowExtractor?: IWorkflowExtractor;
}

/**
 * Create a QiCode agent with dependencies
 */
export function createAgent(
  stateManager: IStateManager,
  contextManager: IContextManager,
  config: AgentFactoryConfig
): QiCodeAgent {
  const agentConfig: AgentConfig = {
    domain: config.domain,
    enableCommands: config.enableCommands ?? true,
    enablePrompts: config.enablePrompts ?? true,
    enableWorkflows: config.enableWorkflows ?? true,
    sessionPersistence: config.sessionPersistence ?? false,
  };

  const dependencies = {
    classifier: config.classifier,
    commandHandler: config.commandHandler,
    promptHandler: config.promptHandler,
    workflowEngine: config.workflowEngine,
    workflowExtractor: config.workflowExtractor,
  };

  return new QiCodeAgent(stateManager, contextManager, agentConfig, dependencies);
}

/**
 * Create a simplified PromptApp orchestrator (no classifier, no workflows)
 */
export function createPromptApp(
  stateManager: IStateManager,
  contextManager: IContextManager,
  config: Partial<AgentConfig> & {
    commandHandler?: ICommandHandler;
    promptHandler?: IPromptHandler;
  }
): PromptAppOrchestrator {
  const agentConfig: AgentConfig = {
    domain: config.domain || 'prompt-app',
    enableCommands: config.enableCommands ?? true,
    enablePrompts: config.enablePrompts ?? true,
    enableWorkflows: false, // PromptApp doesn't use workflows
    sessionPersistence: config.sessionPersistence ?? false,
  };

  const dependencies = {
    commandHandler: config.commandHandler,
    promptHandler: config.promptHandler,
  };

  return new PromptAppOrchestrator(stateManager, contextManager, agentConfig, dependencies);
}

// Export parsing utilities
export { parseInput } from './PromptAppOrchestrator.js';
