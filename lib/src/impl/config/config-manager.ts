// Configuration Manager Implementation
//
// Implements YAML configuration loading with environment variable resolution
// Provides configuration validation and hot-reload capabilities

import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import * as yaml from 'js-yaml';
import type { 
  IConfigurationManager, 
  AgentConfigurationStructure, 
  ConfigurationSection 
} from '../../core/interfaces/utils.js';

export class YamlConfigurationManager implements IConfigurationManager {
  private currentConfig: AgentConfigurationStructure | null = null;
  private watchers: Array<(config: AgentConfigurationStructure) => void> = [];

  async loadConfiguration(configPath: string): Promise<AgentConfigurationStructure> {
    try {
      if (!existsSync(configPath)) {
        throw new Error(`Configuration file not found: ${configPath}`);
      }

      const configContent = await readFile(configPath, 'utf-8');
      const rawConfig = yaml.load(configContent) as any;

      // Transform the qi-config.yaml format to expected structure
      const structuredConfig: AgentConfigurationStructure = {
        agent: {
          name: rawConfig.agent?.name || 'qi-agent',
          version: rawConfig.agent?.version || '0.2.6',
          environment: rawConfig.agent?.environment || 'development'
        },
        models: {
          ollama: {
            name: rawConfig.model?.name || 'qwen2.5-coder:7b',
            temperature: rawConfig.model?.temperature || 0.1,
            baseUrl: rawConfig.model?.baseUrl || 'http://localhost:11434',
            thinkingEnabled: rawConfig.model?.thinkingEnabled || false
          }
        },
        tools: {
          mcp: {
            servers: rawConfig.mcp?.servers || {}
          }
        },
        memory: {
          enabled: rawConfig.memory?.enabled || false,
          type: rawConfig.memory?.type || 'memory'
        },
        ui: {
          theme: rawConfig.ui?.theme || 'dark',
          showTimestamps: rawConfig.ui?.showTimestamps || true,
          progressIndicators: rawConfig.ui?.progressIndicators || true
        }
      };

      // Resolve environment variables
      const resolvedConfig = this.resolveEnvironmentVariables(structuredConfig as unknown as ConfigurationSection) as unknown as AgentConfigurationStructure;

      // Validate the configuration
      if (!this.validateConfiguration(resolvedConfig)) {
        throw new Error('Configuration validation failed');
      }

      this.currentConfig = resolvedConfig;
      return resolvedConfig;

    } catch (error) {
      throw new Error(`Failed to load configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  getSection<T extends ConfigurationSection>(sectionName: string): T {
    if (!this.currentConfig) {
      throw new Error('Configuration not loaded. Call loadConfiguration() first.');
    }

    const section = (this.currentConfig as any)[sectionName];
    if (!section) {
      throw new Error(`Configuration section '${sectionName}' not found`);
    }

    return section as T;
  }

  getModelConfigurations(): import('../../core/interfaces').ModelConfiguration[] {
    const modelsSection = this.getSection('models') as any;
    const configs: import('../../core/interfaces').ModelConfiguration[] = [];

    for (const [providerId, config] of Object.entries(modelsSection)) {
      const modelConfig: import('../../core/interfaces').ModelConfiguration = {
        id: `${providerId}-${(config as any).name}`,
        name: (config as any).name,
        modelId: (config as any).name,
        providerId: providerId,
        parameters: { 
          temperature: (config as any).temperature || 0.1, 
          maxTokens: 2048 
        },
        capabilities: {
          supportsStreaming: true,
          supportsToolCalling: false,
          supportsSystemMessages: true,
          maxContextLength: 4096,
          supportedMessageTypes: ['text']
        }
      };
      
      configs.push(modelConfig);
    }

    return configs;
  }

  createModelProvider(): import('../../core/interfaces').IModelProvider {
    const modelsSection = this.getSection('models') as any;
    const firstProvider = Object.keys(modelsSection)[0];
    
    if (!firstProvider) {
      throw new Error('No model providers configured');
    }

    const config = modelsSection[firstProvider];

    if (firstProvider === 'ollama') {
      const { OllamaModelProvider } = require('../models/ollama-model-provider');
      return new OllamaModelProvider({
        baseUrl: config.baseUrl,
        defaultModel: config.name
      });
    } else {
      throw new Error(`Unsupported provider: ${firstProvider}`);
    }
  }

  resolveEnvironmentVariables(config: ConfigurationSection): ConfigurationSection {
    const resolved: any = {};

    for (const [key, value] of Object.entries(config)) {
      if (typeof value === 'string' && value.startsWith('${') && value.endsWith('}')) {
        // Extract environment variable name
        const envVar = value.slice(2, -1);
        const [varName, defaultValue] = envVar.split('||').map(s => s.trim());
        resolved[key] = process.env[varName] || defaultValue || value;
      } else if (typeof value === 'object' && value !== null) {
        resolved[key] = this.resolveEnvironmentVariables(value as ConfigurationSection);
      } else {
        resolved[key] = value;
      }
    }

    return resolved;
  }

  validateConfiguration(config: AgentConfigurationStructure): boolean {
    try {
      // Validate required agent section
      if (!config.agent || !config.agent.name || !config.agent.version) {
        console.warn('Configuration validation: Missing required agent section');
        return false;
      }

      // Validate models section
      if (!config.models) {
        console.warn('Configuration validation: Missing models section');
        return false;
      }

      // Validate tools section
      if (!config.tools) {
        console.warn('Configuration validation: Missing tools section');
        return false;
      }

      // Validate memory section
      if (!config.memory) {
        console.warn('Configuration validation: Missing memory section');
        return false;
      }

      // Validate UI section
      if (!config.ui) {
        console.warn('Configuration validation: Missing UI section');
        return false;
      }

      return true;
    } catch (error) {
      console.error('Configuration validation error:', error);
      return false;
    }
  }

  watchConfiguration(callback: (config: AgentConfigurationStructure) => void): void {
    this.watchers.push(callback);
  }

  // Additional utility methods

  /**
   * Get model configuration for a specific provider
   */
  getModelConfig(provider: string = 'ollama'): any {
    const models = this.getSection('models');
    return models[provider] || null;
  }

  /**
   * Get MCP server configurations
   */
  getMCPServers(): Record<string, any> {
    const tools = this.getSection('tools');
    return (tools as any).mcp?.servers || {};
  }

  /**
   * Check if memory is enabled
   */
  isMemoryEnabled(): boolean {
    const memory = this.getSection('memory');
    return (memory as any).enabled === true;
  }

  /**
   * Get UI theme
   */
  getTheme(): string {
    const ui = this.getSection('ui');
    return (ui as any).theme || 'dark';
  }

  /**
   * Export current configuration as JSON
   */
  exportConfig(): string {
    if (!this.currentConfig) {
      throw new Error('No configuration loaded');
    }
    return JSON.stringify(this.currentConfig, null, 2);
  }

  /**
   * Get configuration summary for debugging
   */
  getConfigSummary(): string {
    if (!this.currentConfig) {
      return 'No configuration loaded';
    }

    const summary = [
      `Agent: ${this.currentConfig.agent.name} v${this.currentConfig.agent.version}`,
      `Environment: ${this.currentConfig.agent.environment}`,
      `Models: ${Object.keys(this.currentConfig.models).join(', ')}`,
      `Memory: ${(this.currentConfig.memory as any).enabled ? 'enabled' : 'disabled'}`,
      `UI Theme: ${(this.currentConfig.ui as any).theme}`
    ];

    return summary.join('\n');
  }
}

/**
 * Create a default configuration manager instance
 */
export function createConfigManager(): IConfigurationManager {
  return new YamlConfigurationManager();
}