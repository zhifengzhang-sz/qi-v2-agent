// Utility Types - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

import type { ModelConfiguration, IModelProvider } from './models.js';

/**
 * Generic result type for operations that can succeed or fail
 */
export type Result<T, E = Error> = 
  | { success: true; data: T; error?: never }
  | { success: false; data?: never; error: E };

/**
 * Configuration section interface
 */
export interface ConfigurationSection {
  readonly [key: string]: unknown;
}

/**
 * Agent configuration structure
 */
export interface AgentConfigurationStructure {
  readonly agent: {
    readonly name: string;
    readonly version: string;
    readonly environment: string;
  };
  readonly models: ConfigurationSection;
  readonly tools: ConfigurationSection;
  readonly memory: ConfigurationSection;
  readonly ui: ConfigurationSection;
}

/**
 * Configuration manager interface
 */
export interface IConfigurationManager {
  loadConfiguration(configPath: string): Promise<AgentConfigurationStructure>;
  getSection<T extends ConfigurationSection>(sectionName: string): T;
  getModelConfigurations(): ModelConfiguration[];
  createModelProvider(): IModelProvider;
  resolveEnvironmentVariables(config: ConfigurationSection): ConfigurationSection;
  validateConfiguration(config: AgentConfigurationStructure): boolean;
  watchConfiguration(callback: (config: AgentConfigurationStructure) => void): void;
}