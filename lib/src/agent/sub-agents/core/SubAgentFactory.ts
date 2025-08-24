/**
 * Sub-Agent Factory Implementation
 *
 * Handles dynamic instantiation and configuration of sub-agents.
 * Uses QiCore Result<T, QiError> patterns for consistent error handling.
 */

import type { Result } from '@qi/base';
import { failure, match, success } from '@qi/base';
import type { QiError } from '@qi/core';
import { createQiLogger, type SimpleLogger } from '../../../utils/QiCoreLogger.js';
import type { ISubAgent, ISubAgentFactory, SubAgentConfig } from './types.js';

/**
 * Creates QiCore-compatible error for factory operations
 */
function createFactoryError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): QiError {
  return {
    code,
    message,
    category: 'SYSTEM',
    context: context || {},
  } as QiError;
}

/**
 * Sub-agent constructor type
 */
type SubAgentConstructor = new () => ISubAgent;

/**
 * Sub-agent factory registry entry
 */
interface FactoryEntry {
  constructor: SubAgentConstructor;
  description: string;
  version: string;
  requiredTools: string[];
}

export class SubAgentFactory implements ISubAgentFactory {
  private constructors: Map<string, FactoryEntry> = new Map();
  private logger: SimpleLogger;

  constructor() {
    this.logger = createQiLogger({ name: 'SubAgentFactory' });
    this.logger.info('Sub-agent factory initialized');

    // Register built-in sub-agent types
    this.registerBuiltInTypes();
  }

  /**
   * Create a sub-agent instance by type
   */
  async create(type: string, config: SubAgentConfig): Promise<Result<ISubAgent, QiError>> {
    try {
      const entry = this.constructors.get(type);
      if (!entry) {
        return failure(
          createFactoryError('SUB_AGENT_TYPE_NOT_SUPPORTED', 'Sub-agent type is not supported', {
            type,
            supportedTypes: this.getAvailableTypes(),
          })
        );
      }

      this.logger.info('Creating sub-agent instance', {
        type,
        version: entry.version,
        requiredTools: entry.requiredTools.length,
      });

      // Validate configuration
      const validationResult = this.validateConfig(config, entry);
      match(
        () => undefined,
        (error) => {
          throw error;
        },
        validationResult
      );

      // Instantiate the sub-agent
      const subAgent = new entry.constructor();

      // Initialize the sub-agent
      const initResult = await subAgent.initialize(config);
      match(
        () => undefined,
        (error) => {
          throw createFactoryError(
            'SUB_AGENT_INITIALIZATION_FAILED',
            'Failed to initialize sub-agent after creation',
            { type, error: error.message }
          );
        },
        initResult
      );

      this.logger.info('Sub-agent created and initialized successfully', {
        type,
        subAgentId: subAgent.id,
        name: subAgent.name,
        version: subAgent.version,
        capabilities: subAgent.capabilities.length,
      });

      return success(subAgent);
    } catch (error) {
      return failure(
        createFactoryError('SUB_AGENT_CREATION_FAILED', 'Failed to create sub-agent instance', {
          type,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get available sub-agent types
   */
  getAvailableTypes(): string[] {
    return Array.from(this.constructors.keys()).sort();
  }

  /**
   * Check if a sub-agent type is supported
   */
  supports(type: string): boolean {
    return this.constructors.has(type);
  }

  /**
   * Register a new sub-agent type
   */
  register(
    type: string,
    subAgentConstructor: SubAgentConstructor,
    description: string,
    version: string = '1.0.0',
    requiredTools: string[] = []
  ): Result<void, QiError> {
    try {
      if (this.constructors.has(type)) {
        return failure(
          createFactoryError(
            'SUB_AGENT_TYPE_ALREADY_REGISTERED',
            'Sub-agent type is already registered',
            { type, existingVersion: this.constructors.get(type)?.version }
          )
        );
      }

      this.constructors.set(type, {
        constructor: subAgentConstructor,
        description,
        version,
        requiredTools,
      });

      this.logger.info('Sub-agent type registered', {
        type,
        description,
        version,
        requiredTools: requiredTools.length,
        totalTypes: this.constructors.size,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        createFactoryError(
          'SUB_AGENT_TYPE_REGISTRATION_FAILED',
          'Failed to register sub-agent type',
          {
            type,
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  /**
   * Unregister a sub-agent type
   */
  unregister(type: string): Result<void, QiError> {
    try {
      if (!this.constructors.has(type)) {
        return failure(
          createFactoryError(
            'SUB_AGENT_TYPE_NOT_FOUND',
            'Sub-agent type not found for unregistration',
            { type }
          )
        );
      }

      const entry = this.constructors.get(type)!;
      this.constructors.delete(type);

      this.logger.info('Sub-agent type unregistered', {
        type,
        version: entry.version,
        totalTypes: this.constructors.size,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        createFactoryError(
          'SUB_AGENT_TYPE_UNREGISTRATION_FAILED',
          'Failed to unregister sub-agent type',
          {
            type,
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  /**
   * Get information about a specific sub-agent type
   */
  getTypeInfo(type: string): Result<FactoryEntry | null, QiError> {
    try {
      const entry = this.constructors.get(type) || null;

      this.logger.debug('Retrieved sub-agent type info', {
        type,
        found: !!entry,
      });

      return success(entry);
    } catch (error) {
      return failure(
        createFactoryError(
          'SUB_AGENT_TYPE_INFO_FAILED',
          'Failed to get sub-agent type information',
          {
            type,
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  /**
   * Get factory statistics
   */
  getStats() {
    const typeStats = new Map<string, { version: string; requiredTools: number }>();

    for (const [type, entry] of this.constructors) {
      typeStats.set(type, {
        version: entry.version,
        requiredTools: entry.requiredTools.length,
      });
    }

    return {
      totalTypes: this.constructors.size,
      types: Object.fromEntries(typeStats),
      availableTypes: this.getAvailableTypes(),
    };
  }

  // Private helper methods

  private validateConfig(config: SubAgentConfig, entry: FactoryEntry): Result<void, QiError> {
    try {
      // Validate required configuration fields
      if (!config.toolProvider) {
        return failure(
          createFactoryError(
            'SUB_AGENT_CONFIG_INVALID',
            'Tool provider is required in configuration',
            { requiredTools: entry.requiredTools }
          )
        );
      }

      // Validate required tools are available
      const availableTools = config.toolProvider.getAvailableTools();
      const missingTools = entry.requiredTools.filter((tool) => !availableTools.includes(tool));

      if (missingTools.length > 0) {
        return failure(
          createFactoryError(
            'SUB_AGENT_REQUIRED_TOOLS_MISSING',
            'Required tools are not available in tool provider',
            {
              missingTools,
              requiredTools: entry.requiredTools,
              availableTools: availableTools.slice(0, 10), // Limit for logging
            }
          )
        );
      }

      // Validate timeouts and retries
      if (config.defaultTimeout && config.defaultTimeout <= 0) {
        return failure(
          createFactoryError('SUB_AGENT_CONFIG_INVALID', 'Default timeout must be positive', {
            defaultTimeout: config.defaultTimeout,
          })
        );
      }

      if (config.maxRetries && config.maxRetries < 0) {
        return failure(
          createFactoryError('SUB_AGENT_CONFIG_INVALID', 'Max retries cannot be negative', {
            maxRetries: config.maxRetries,
          })
        );
      }

      return success(undefined);
    } catch (error) {
      return failure(
        createFactoryError(
          'SUB_AGENT_CONFIG_VALIDATION_FAILED',
          'Configuration validation failed',
          { error: error instanceof Error ? error.message : String(error) }
        )
      );
    }
  }

  private registerBuiltInTypes(): void {
    // Note: Built-in types will be registered when their implementations are available
    // This is a placeholder for future built-in sub-agent types

    this.logger.debug('Built-in sub-agent types registration placeholder', {
      note: 'Will be populated when concrete sub-agent implementations are available',
    });

    // Example of how built-in types would be registered:
    // this.register('file-operations', FileToolSubAgent, 'File operations sub-agent', '1.0.0', ['Read', 'Write', 'Edit']);
    // this.register('search-operations', SearchToolSubAgent, 'Search operations sub-agent', '1.0.0', ['Grep', 'Glob']);
    // etc.
  }

  /**
   * Create a sub-agent with default configuration
   */
  async createWithDefaults(type: string): Promise<Result<ISubAgent, QiError>> {
    // This would need a default tool provider implementation
    // For now, return an error indicating that explicit configuration is required

    return failure(
      createFactoryError(
        'SUB_AGENT_DEFAULTS_NOT_AVAILABLE',
        'Default configuration not available - explicit config required',
        {
          type,
          hint: 'Use create(type, config) with explicit SubAgentConfig',
        }
      )
    );
  }

  /**
   * Batch create multiple sub-agents
   */
  async createBatch(
    requests: Array<{ type: string; config: SubAgentConfig }>
  ): Promise<Result<ISubAgent[], QiError>> {
    try {
      const results: ISubAgent[] = [];
      const errors: string[] = [];

      for (const request of requests) {
        const createResult = await this.create(request.type, request.config);

        match(
          (subAgent) => results.push(subAgent),
          (error) => errors.push(`${request.type}: ${error.message}`),
          createResult
        );
      }

      if (errors.length > 0) {
        return failure(
          createFactoryError(
            'SUB_AGENT_BATCH_CREATE_PARTIAL_FAILURE',
            'Some sub-agents failed to create',
            {
              successful: results.length,
              failed: errors.length,
              errors: errors.slice(0, 5), // Limit error details for logging
              totalRequested: requests.length,
            }
          )
        );
      }

      this.logger.info('Batch sub-agent creation successful', {
        totalCreated: results.length,
        types: requests.map((r) => r.type),
      });

      return success(results);
    } catch (error) {
      return failure(
        createFactoryError('SUB_AGENT_BATCH_CREATE_FAILED', 'Batch sub-agent creation failed', {
          requestCount: requests.length,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
}
