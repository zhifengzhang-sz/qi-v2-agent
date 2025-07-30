// Agent Factory - Create production-ready agents with all components
//
// Provides simplified agent creation with sensible defaults and configuration

import type { 
  AgentConfiguration, 
  DomainConfiguration,
  DomainMode,
  IAgent 
} from '../core/interfaces/index.js';

import { ProductionAgent } from './production-agent.js';

// Import all production implementations from organized structure
import { InputClassifier } from '../impl/classifiers/input-classifier.js';
import { MultiSignalPatternMatcher } from '../impl/classifiers/pattern-matcher.js';
import { BasicCommandHandler } from '../impl/commands/command-handler.js';
import { OllamaModelProvider } from '../impl/models/ollama-model-provider.js';
import { ModelRoutingEngine } from '../impl/models/model-routing-engine.js';
import { BasicPromptHandler } from '../impl/prompts/prompt-handler.js';
import { BasicPromptManager } from '../impl/prompts/prompt-manager.js';
import { HybridWorkflowExtractor } from '../impl/workflows/workflow-extractor.js';
import { LangGraphWorkflowEngine } from '../impl/workflows/langgraph-workflow-engine.js';
import { MCPToolProvider } from '../impl/tools/mcp-tool-provider.js';
import { MultiModalMemoryProvider } from '../impl/memory/memory-provider.js';

/**
 * Agent factory configuration options
 */
export interface AgentFactoryConfig {
  domain?: string;
  modelProvider?: 'ollama';
  toolProvider?: 'mcp';
  memoryEnabled?: boolean;
  configPath?: string;
}

/**
 * Agent factory for creating production-ready agents
 */
export class AgentFactory {
  
  /**
   * Create a production agent with all components configured
   */
  static async createAgent(config: AgentFactoryConfig = {}): Promise<IAgent> {
    const {
      domain = 'coding',
      modelProvider = 'ollama',
      toolProvider = 'mcp',
      memoryEnabled = false,
      configPath = 'config/qi-config.yaml'
    } = config;

    // Create domain configuration
    const domainConfig = AgentFactory.createDomainConfiguration(domain);

    // Create and configure all components
    const agentConfig: AgentConfiguration = {
      domain: domainConfig,
      inputClassifier: new InputClassifier(),
      commandHandler: new BasicCommandHandler(),
      workflowExtractor: new HybridWorkflowExtractor({
        supportedModes: [
          {
            name: 'creative',
            description: 'Code generation and implementation',
            category: 'development',
            keywords: ['create', 'build', 'implement', 'generate'],
            commonNodes: ['analyze-requirements', 'implement-solution'],
            requiredTools: ['filesystem']
          },
          {
            name: 'problem-solving',
            description: 'Debugging and issue resolution',
            category: 'maintenance',
            keywords: ['fix', 'debug', 'solve', 'resolve'],
            commonNodes: ['reproduce-issue', 'analyze-error', 'implement-fix'],
            requiredTools: ['filesystem']
          }
        ],
        patternMapping: Array.from(domainConfig.patterns.entries()).map(([key, mode]) => [
          key,
          {
            name: mode.abstractPattern,
            description: `${mode.abstractPattern} pattern`,
            purpose: `Handle ${mode.abstractPattern} tasks`,
            characteristics: mode.domainKeywords,
            abstractKeywords: mode.domainKeywords,
            contextWeight: 0.7
          }
        ])
      }),
      patternMatcher: new MultiSignalPatternMatcher({
        patterns: Array.from(domainConfig.patterns.values()).map(mode => ({
          name: mode.abstractPattern,
          description: `${mode.abstractPattern} pattern`,
          purpose: `Handle ${mode.abstractPattern} tasks`,
          characteristics: mode.domainKeywords,
          abstractKeywords: mode.domainKeywords,
          contextWeight: 0.7
        })),
        confidenceThreshold: 0.6,
        enableLLMFallback: false
      }),
      workflowEngine: new LangGraphWorkflowEngine(),
      modelProvider: AgentFactory.createModelProvider(modelProvider, configPath),
      promptManager: new BasicPromptManager([]), // TODO: Load model configurations
      promptHandler: new BasicPromptHandler(
        new BasicPromptManager([]), // TODO: Load model configurations  
        AgentFactory.createModelProvider(modelProvider, configPath),
        new ModelRoutingEngine(ModelRoutingEngine.createDefaultRoutingRules())
      ),
      toolProvider: AgentFactory.createToolProvider(toolProvider, configPath),
      memoryProvider: memoryEnabled ? new MultiModalMemoryProvider({
        type: 'memory',
        maxSessions: 100,
        sessionTTL: 86400000 // 24 hours
      }) : undefined
    };

    return new ProductionAgent(agentConfig);
  }

  /**
   * Create a minimal agent for testing
   */
  static async createTestAgent(): Promise<IAgent> {
    return AgentFactory.createAgent({
      domain: 'test',
      memoryEnabled: false
    });
  }

  /**
   * Create domain configuration
   */
  private static createDomainConfiguration(domain: string): DomainConfiguration {
    const patterns = new Map<string, DomainMode>();

    // Add default patterns for the domain
    patterns.set('analytical', {
      abstractPattern: 'analytical',
      domainName: `${domain}-analytical`,
      domainKeywords: ['analyze', 'review', 'examine', 'assess'],
      domainTools: ['filesystem', 'git'],
      domainPrompts: ['analyze the code structure', 'review the implementation']
    });

    patterns.set('creative', {
      abstractPattern: 'creative',
      domainName: `${domain}-creative`,
      domainKeywords: ['create', 'build', 'generate', 'implement'],
      domainTools: ['filesystem', 'git'],
      domainPrompts: ['create a new component', 'implement the feature']
    });

    patterns.set('problem-solving', {
      abstractPattern: 'problem-solving',
      domainName: `${domain}-problem-solving`,
      domainKeywords: ['fix', 'debug', 'solve', 'resolve'],
      domainTools: ['filesystem', 'git'],
      domainPrompts: ['fix the bug', 'debug the issue']
    });

    patterns.set('informational', {
      abstractPattern: 'informational',
      domainName: `${domain}-informational`,
      domainKeywords: ['explain', 'help', 'what', 'how'],
      domainTools: ['filesystem'],
      domainPrompts: ['explain how this works', 'help me understand']
    });

    patterns.set('conversational', {
      abstractPattern: 'conversational',
      domainName: `${domain}-conversational`,
      domainKeywords: ['chat', 'discuss', 'talk'],
      domainTools: [],
      domainPrompts: ['hi', 'hello', 'thanks']
    });

    return {
      domain,
      version: '1.0.0',
      description: `${domain} domain configuration with three-type classification`,
      patterns
    };
  }

  /**
   * Create model provider based on configuration
   */
  private static createModelProvider(provider: string, configPath: string): OllamaModelProvider {
    switch (provider) {
      case 'ollama':
        return new OllamaModelProvider({
          baseUrl: 'http://localhost:11434',
          defaultModel: 'qwen2.5-coder:7b',
          connectionTimeout: 30000,
          requestTimeout: 120000
        });
      
      default:
        throw new Error(`Unsupported model provider: ${provider}`);
    }
  }

  /**
   * Create tool provider based on configuration
   */
  private static createToolProvider(provider: string, configPath: string): MCPToolProvider {
    switch (provider) {
      case 'mcp':
        return new MCPToolProvider({
          servers: [],
          patternToolMapping: []
        });
      
      default:
        throw new Error(`Unsupported tool provider: ${provider}`);
    }
  }
}

/**
 * Convenience function for creating a default production agent
 */
export async function createAgent(config?: AgentFactoryConfig): Promise<IAgent> {
  return AgentFactory.createAgent(config);
}

/**
 * Convenience function for creating a test agent
 */
export async function createTestAgent(): Promise<IAgent> {
  return AgentFactory.createTestAgent();
}