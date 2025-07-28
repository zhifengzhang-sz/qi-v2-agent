// Agent Setup and Factory
//
// Factory function to create Agent instances with concrete implementations
// Demonstrates complete integration of all abstract interfaces

import { PatternMatcher } from './pattern-matcher.js';
import { LangGraphWorkflowEngine } from './langgraph-workflow-engine.js';
import { LangChainModelProvider } from './langchain-model-provider.js';
import { MCPToolProvider } from './mcp-tool-provider.js';
import { Agent } from './agent.js';
import { ABSTRACT_COGNITIVE_PATTERNS } from '../core/interfaces.js';
import type {
  ModelConfiguration,
  DomainConfiguration
} from '../core/interfaces.js';
import type { MCPServerConfig } from './mcp-tool-provider.js';

export async function createAgent(config: SetupConfig): Promise<Agent> {
  console.log('🚀 Setting up Agent with concrete implementations...');

  // Initialize Pattern Matcher
  const patternMatcher = new PatternMatcher({
    patterns: ABSTRACT_COGNITIVE_PATTERNS,
    confidenceThreshold: config.patternMatcher.confidenceThreshold,
    enableLLMFallback: config.patternMatcher.enableLLMFallback,
    llmEndpoint: config.patternMatcher.llmEndpoint,
    fallbackModel: config.patternMatcher.fallbackModel
  });

  // Initialize Workflow Engine
  const workflowEngine = new LangGraphWorkflowEngine({
    enableCheckpointing: config.workflowEngine.enableCheckpointing,
    maxExecutionTime: config.workflowEngine.maxExecutionTime,
    enableStreaming: config.workflowEngine.enableStreaming
  });

  // Initialize Model Provider
  const modelProvider = new LangChainModelProvider({
    models: config.modelProvider.models,
    defaultProvider: config.modelProvider.defaultProvider,
    defaultModel: config.modelProvider.defaultModel
  });

  // Initialize Tool Provider
  const toolProvider = new MCPToolProvider({
    servers: config.toolProvider.servers,
    patternToolMapping: config.toolProvider.patternToolMapping
  });

  // Create Agent with operational configuration
  const agent = new Agent({
    domain: config.domain,
    patternMatcher,
    workflowEngine,
    modelProvider,
    toolProvider,
    // memoryProvider optional
    operational: {
      rateLimiting: {
        maxTokens: 100,
        refillRate: 10
      },
      circuitBreaker: {
        failureThreshold: 5,
        recoveryTimeout: 60000,
        successThreshold: 3
      }
    }
  });

  // Initialize the agent
  await agent.initialize();

  console.log('✅ Agent setup complete');
  return agent;
}

export interface SetupConfig {
  domain: DomainConfiguration;
  patternMatcher: {
    confidenceThreshold: number;
    enableLLMFallback: boolean;
    llmEndpoint?: string;
    fallbackModel?: string;
  };
  workflowEngine: {
    enableCheckpointing: boolean;
    maxExecutionTime: number;
    enableStreaming: boolean;
  };
  modelProvider: {
    models: readonly ModelConfiguration[];
    defaultProvider: string;
    defaultModel: string;
  };
  toolProvider: {
    servers: readonly MCPServerConfig[];
    patternToolMapping: readonly [string, string[]][];
  };
}

// Example configuration for coding domain
export const CODING_DOMAIN_CONFIG: DomainConfiguration = {
  domain: 'coding',
  version: '1.0.0',
  description: 'Software development domain specialization',
  patterns: new Map([
    ['analytical', {
      abstractPattern: 'analytical',
      domainName: 'planning',
      domainKeywords: ['architecture', 'design', 'plan', 'structure'],
      domainTools: ['sequential-thinking', 'web-search'],
      domainPrompts: ['Plan the software architecture', 'Design the system structure']
    }],
    ['creative', {
      abstractPattern: 'creative',
      domainName: 'coding',
      domainKeywords: ['implement', 'code', 'write', 'build'],
      domainTools: ['filesystem', 'git'],
      domainPrompts: ['Implement the feature', 'Write the code']
    }],
    ['problem-solving', {
      abstractPattern: 'problem-solving',
      domainName: 'debugging',
      domainKeywords: ['fix', 'debug', 'error', 'bug'],
      domainTools: ['filesystem', 'git', 'sequential-thinking'],
      domainPrompts: ['Debug the issue', 'Fix the error']
    }],
    ['informational', {
      abstractPattern: 'informational',
      domainName: 'documentation',
      domainKeywords: ['explain', 'document', 'help'],
      domainTools: ['web-search'],
      domainPrompts: ['Explain the concept', 'Document the code']
    }]
  ])
};

// Example setup for coding domain
export async function createCodingAgent(): Promise<Agent> {
  const config: SetupConfig = {
    domain: CODING_DOMAIN_CONFIG,
    patternMatcher: {
      confidenceThreshold: 0.7,
      enableLLMFallback: true,
      llmEndpoint: 'http://localhost:11434',
      fallbackModel: 'qwen2.5:7b'
    },
    workflowEngine: {
      enableCheckpointing: true,
      maxExecutionTime: 120000,
      enableStreaming: true
    },
    modelProvider: {
      models: [
        {
          providerId: 'ollama',
          modelId: 'qwen2.5:7b',
          parameters: {
            temperature: 0.7,
            maxTokens: 4096,
            topP: 0.9
          },
          capabilities: {
            supportsStreaming: true,
            supportsToolCalling: false,
            supportsSystemMessages: true,
            maxContextLength: 8192,
            supportedMessageTypes: ['system', 'user', 'assistant']
          }
        }
      ],
      defaultProvider: 'ollama',
      defaultModel: 'qwen2.5:7b'
    },
    toolProvider: {
      servers: [
        {
          name: 'filesystem',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-filesystem', '/tmp'],
          patterns: ['creative', 'problem-solving']
        },
        {
          name: 'sequential-thinking',
          command: 'npx',
          args: ['-y', '@modelcontextprotocol/server-sequential-thinking'],
          patterns: ['analytical', 'problem-solving']
        }
      ],
      patternToolMapping: [
        ['analytical', ['sequential-thinking']],
        ['creative', ['filesystem']],
        ['problem-solving', ['filesystem', 'sequential-thinking']],
        ['informational', []]
      ]
    }
  };

  return createAgent(config);
}