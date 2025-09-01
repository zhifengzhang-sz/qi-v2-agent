/**
 * @qi/agent - Agent Capabilities Package
 * 
 * Advanced agent capabilities with AutoGen/AgentChat abstractions,
 * professional context engineering, and comprehensive tool management.
 */

// Context Engineering Module
export * from './context-engineering/index.js';

// Workflow Engine Module (AutoGen Abstraction)
export * from './workflow-engine/index.js';

// Sub-Agent Module (AgentChat Abstraction) 
export * from './sub-agent/index.js';

// Tools Module
export * from './tools/index.js';

// Core Types and Interfaces
export interface AgentCapabilities {
  contextEngineering: boolean;
  workflowEngine: boolean;
  subAgent: boolean;
  toolManagement: boolean;
}

export interface AgentConfig {
  enableContextEngineering?: boolean;
  enableWorkflowEngine?: boolean;
  enableSubAgent?: boolean;
  enableTools?: boolean;
  contextOptimization?: {
    maxTokens?: number;
    relevanceThreshold?: number;
    enableRAG?: boolean;
  };
  workflowConfig?: {
    maxAgents?: number;
    planningStrategy?: 'react' | 'rewoo' | 'adapt';
  };
  toolConfig?: {
    enableMCP?: boolean;
    maxConcurrentTools?: number;
  };
}

/**
 * Main agent coordinator that integrates all four modules
 */
export class AgentCoordinator {
  constructor(config: AgentConfig) {
    // Implementation will be added in subsequent phases
    throw new Error('AgentCoordinator implementation pending');
  }
}
