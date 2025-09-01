/**
 * Enhanced Workflow Configuration for v-0.9.x Enhanced Workflow System
 *
 * Provides comprehensive configuration for advanced workflow features including:
 * - Intelligent pattern selection parameters
 * - Real-time monitoring and adaptation settings
 * - Learning system configuration
 * - Hybrid execution parameters
 * - MCP service integration settings
 */

import type { AdvancedWorkflowConfig } from '../abstractions/IAdvancedWorkflowOrchestrator.js';

/**
 * Default Enhanced Workflow Configuration
 *
 * Optimized for production use with v-0.9.x performance targets:
 * - >90% optimal pattern selection accuracy
 * - <2s adaptation response time
 * - <5% monitoring overhead
 * - 15% performance improvement over v-0.8.x
 */
export const ENHANCED_WORKFLOW_CONFIG: AdvancedWorkflowConfig = {
  patternSelection: {
    enableIntelligentSelection: true,
    selectionAlgorithm: 'weighted-scoring',
    learningWeightDecay: 0.95,
    minimumConfidenceThreshold: 0.6,
  },

  monitoring: {
    enableRealTimeMonitoring: true,
    performanceCheckpointInterval: 5000, // 5 seconds as specified
    adaptationThresholds: {
      performanceDegradation: 0.3,
      executionTimeExcess: 2.0,
      qualityDegradation: 0.25,
    },
  },

  learning: {
    enableContinuousLearning: true,
    learningBatchSize: 50,
    learningFrequency: 'daily',
    retentionPeriod: 90, // days
  },

  hybridExecution: {
    enableHybridPatterns: true,
    maxPhasesPerExecution: 3,
    transitionOptimization: true,
  },

  mcpIntegration: {
    enableMemoryIntegration: true,
    enableRAGIntegration: true,
    enableDatabaseIntegration: true,
  },
};

/**
 * Development Configuration
 *
 * More permissive settings for development and testing
 */
export const DEVELOPMENT_WORKFLOW_CONFIG: AdvancedWorkflowConfig = {
  patternSelection: {
    enableIntelligentSelection: true,
    selectionAlgorithm: 'weighted-scoring',
    learningWeightDecay: 0.9,
    minimumConfidenceThreshold: 0.5, // Lower threshold for development
  },

  monitoring: {
    enableRealTimeMonitoring: true,
    performanceCheckpointInterval: 2000, // More frequent checkpoints for dev
    adaptationThresholds: {
      performanceDegradation: 0.4, // More tolerant in development
      executionTimeExcess: 3.0,
      qualityDegradation: 0.35,
    },
  },

  learning: {
    enableContinuousLearning: true,
    learningBatchSize: 20, // Smaller batches for faster iteration
    learningFrequency: 'hourly', // More frequent learning in development
    retentionPeriod: 30, // Shorter retention
  },

  hybridExecution: {
    enableHybridPatterns: true,
    maxPhasesPerExecution: 5, // Allow more phases for experimentation
    transitionOptimization: false, // Disable optimization for simpler debugging
  },

  mcpIntegration: {
    enableMemoryIntegration: false, // Can be disabled if MCP services not available
    enableRAGIntegration: false,
    enableDatabaseIntegration: false,
  },
};

/**
 * High Performance Configuration
 *
 * Optimized for maximum performance in production environments
 */
export const HIGH_PERFORMANCE_WORKFLOW_CONFIG: AdvancedWorkflowConfig = {
  patternSelection: {
    enableIntelligentSelection: true,
    selectionAlgorithm: 'weighted-scoring',
    learningWeightDecay: 0.98, // Higher retention of historical performance
    minimumConfidenceThreshold: 0.8, // Higher confidence required
  },

  monitoring: {
    enableRealTimeMonitoring: true,
    performanceCheckpointInterval: 10000, // Less frequent for better performance
    adaptationThresholds: {
      performanceDegradation: 0.2, // More aggressive adaptation
      executionTimeExcess: 1.5,
      qualityDegradation: 0.15,
    },
  },

  learning: {
    enableContinuousLearning: true,
    learningBatchSize: 100, // Larger batches for efficiency
    learningFrequency: 'weekly', // Less frequent learning for stability
    retentionPeriod: 180, // Longer retention for better insights
  },

  hybridExecution: {
    enableHybridPatterns: true,
    maxPhasesPerExecution: 2, // Limit phases for performance
    transitionOptimization: true,
  },

  mcpIntegration: {
    enableMemoryIntegration: true,
    enableRAGIntegration: true,
    enableDatabaseIntegration: true,
  },
};

/**
 * Configuration Validation and Utilities
 */
export class WorkflowConfigValidator {
  /**
   * Validate workflow configuration for consistency and performance
   */
  static validateConfig(config: AdvancedWorkflowConfig): {
    valid: boolean;
    errors: string[];
    warnings: string[];
  } {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Pattern selection validation
    if (config.patternSelection.minimumConfidenceThreshold < 0.3) {
      warnings.push('Very low confidence threshold may lead to poor pattern selection');
    }
    if (config.patternSelection.minimumConfidenceThreshold > 0.95) {
      warnings.push('Very high confidence threshold may prevent pattern selection');
    }
    if (
      config.patternSelection.learningWeightDecay < 0.5 ||
      config.patternSelection.learningWeightDecay > 1.0
    ) {
      errors.push('Learning weight decay must be between 0.5 and 1.0');
    }

    // Monitoring validation
    if (config.monitoring.performanceCheckpointInterval < 1000) {
      warnings.push('Very frequent checkpoints may impact performance');
    }
    if (config.monitoring.performanceCheckpointInterval > 30000) {
      warnings.push('Infrequent checkpoints may miss important adaptation opportunities');
    }

    // Adaptation thresholds validation
    const thresholds = config.monitoring.adaptationThresholds;
    if (thresholds.performanceDegradation < 0.1 || thresholds.performanceDegradation > 0.8) {
      errors.push('Performance degradation threshold should be between 0.1 and 0.8');
    }
    if (thresholds.executionTimeExcess < 1.1 || thresholds.executionTimeExcess > 5.0) {
      errors.push('Execution time excess threshold should be between 1.1 and 5.0');
    }

    // Learning configuration validation
    if (config.learning.learningBatchSize < 5) {
      warnings.push('Very small learning batch size may lead to unstable learning');
    }
    if (config.learning.learningBatchSize > 200) {
      warnings.push('Very large learning batch size may slow down learning application');
    }
    if (config.learning.retentionPeriod < 7) {
      warnings.push('Very short retention period may not provide sufficient learning data');
    }

    // Hybrid execution validation
    if (config.hybridExecution.maxPhasesPerExecution > 5) {
      warnings.push('Many phases may lead to complex coordination overhead');
    }
    if (config.hybridExecution.maxPhasesPerExecution < 2) {
      warnings.push('Minimum 2 phases required for meaningful hybrid execution');
    }

    // Cross-feature validation
    if (config.learning.enableContinuousLearning && !config.monitoring.enableRealTimeMonitoring) {
      warnings.push('Learning system benefits from real-time monitoring data');
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Get recommended configuration based on deployment environment
   */
  static getRecommendedConfig(
    environment: 'development' | 'production' | 'high-performance'
  ): AdvancedWorkflowConfig {
    switch (environment) {
      case 'development':
        return DEVELOPMENT_WORKFLOW_CONFIG;
      case 'high-performance':
        return HIGH_PERFORMANCE_WORKFLOW_CONFIG;
      default:
        return ENHANCED_WORKFLOW_CONFIG;
    }
  }

  /**
   * Merge configurations with validation
   */
  static mergeConfigs(
    base: AdvancedWorkflowConfig,
    override: Partial<AdvancedWorkflowConfig>
  ): {
    config: AdvancedWorkflowConfig;
    validation: ReturnType<typeof WorkflowConfigValidator.validateConfig>;
  } {
    const merged: AdvancedWorkflowConfig = {
      patternSelection: {
        ...base.patternSelection,
        ...(override.patternSelection || {}),
      },
      monitoring: {
        ...base.monitoring,
        ...(override.monitoring || {}),
      },
      learning: {
        ...base.learning,
        ...(override.learning || {}),
      },
      hybridExecution: {
        ...base.hybridExecution,
        ...(override.hybridExecution || {}),
      },
      mcpIntegration: {
        ...base.mcpIntegration,
        ...(override.mcpIntegration || {}),
      },
    };

    const validation = WorkflowConfigValidator.validateConfig(merged);

    return { config: merged, validation };
  }
}

/**
 * Configuration Builder for Dynamic Configuration Creation
 */
export class WorkflowConfigBuilder {
  private configOverrides: {
    patternSelection?: Partial<AdvancedWorkflowConfig['patternSelection']>;
    monitoring?: Partial<AdvancedWorkflowConfig['monitoring']>;
    learning?: Partial<AdvancedWorkflowConfig['learning']>;
    hybridExecution?: Partial<AdvancedWorkflowConfig['hybridExecution']>;
    mcpIntegration?: Partial<AdvancedWorkflowConfig['mcpIntegration']>;
  } = {};

  static create(): WorkflowConfigBuilder {
    return new WorkflowConfigBuilder();
  }

  patternSelection(config: Partial<AdvancedWorkflowConfig['patternSelection']>): this {
    this.configOverrides.patternSelection = config;
    return this;
  }

  monitoring(config: Partial<AdvancedWorkflowConfig['monitoring']>): this {
    this.configOverrides.monitoring = config;
    return this;
  }

  learning(config: Partial<AdvancedWorkflowConfig['learning']>): this {
    this.configOverrides.learning = config;
    return this;
  }

  hybridExecution(config: Partial<AdvancedWorkflowConfig['hybridExecution']>): this {
    this.configOverrides.hybridExecution = config;
    return this;
  }

  mcpIntegration(config: Partial<AdvancedWorkflowConfig['mcpIntegration']>): this {
    this.configOverrides.mcpIntegration = config;
    return this;
  }

  build(base: AdvancedWorkflowConfig = ENHANCED_WORKFLOW_CONFIG): AdvancedWorkflowConfig {
    // Simple object merge approach
    const config: AdvancedWorkflowConfig = {
      patternSelection: {
        ...base.patternSelection,
        ...(this.configOverrides.patternSelection || {}),
      },
      monitoring: {
        ...base.monitoring,
        ...(this.configOverrides.monitoring || {}),
      },
      learning: {
        ...base.learning,
        ...(this.configOverrides.learning || {}),
      },
      hybridExecution: {
        ...base.hybridExecution,
        ...(this.configOverrides.hybridExecution || {}),
      },
      mcpIntegration: {
        ...base.mcpIntegration,
        ...(this.configOverrides.mcpIntegration || {}),
      },
    };

    const validation = WorkflowConfigValidator.validateConfig(config);

    if (!validation.valid) {
      throw new Error(`Invalid workflow configuration: ${validation.errors.join(', ')}`);
    }

    if (validation.warnings.length > 0) {
      console.warn('Workflow configuration warnings:', validation.warnings.join(', '));
    }

    return config;
  }
}

/**
 * Environment-specific configuration detection and loading
 */
export class WorkflowConfigLoader {
  /**
   * Load configuration based on environment variables
   */
  static loadFromEnvironment(): AdvancedWorkflowConfig {
    const env = process.env.NODE_ENV || 'development';
    const performanceMode = process.env.WORKFLOW_PERFORMANCE_MODE;

    let baseConfig: AdvancedWorkflowConfig;

    if (performanceMode === 'high') {
      baseConfig = HIGH_PERFORMANCE_WORKFLOW_CONFIG;
    } else if (env === 'production') {
      baseConfig = ENHANCED_WORKFLOW_CONFIG;
    } else {
      baseConfig = DEVELOPMENT_WORKFLOW_CONFIG;
    }

    // Apply environment variable overrides
    const overrides: Partial<AdvancedWorkflowConfig> = {};

    if (process.env.WORKFLOW_CHECKPOINT_INTERVAL) {
      overrides.monitoring = {
        ...baseConfig.monitoring,
        performanceCheckpointInterval: parseInt(process.env.WORKFLOW_CHECKPOINT_INTERVAL, 10),
      };
    }

    if (process.env.WORKFLOW_LEARNING_FREQUENCY) {
      overrides.learning = {
        ...baseConfig.learning,
        learningFrequency: process.env.WORKFLOW_LEARNING_FREQUENCY as 'hourly' | 'daily' | 'weekly',
      };
    }

    if (process.env.WORKFLOW_MAX_PHASES) {
      overrides.hybridExecution = {
        ...baseConfig.hybridExecution,
        maxPhasesPerExecution: parseInt(process.env.WORKFLOW_MAX_PHASES, 10),
      };
    }

    // Enable/disable MCP services based on environment
    const mcpIntegration = {
      enableMemoryIntegration: process.env.MCP_MEMORY_ENABLED === 'true',
      enableRAGIntegration: process.env.MCP_RAG_ENABLED === 'true',
      enableDatabaseIntegration: process.env.MCP_DATABASE_ENABLED === 'true',
    };

    overrides.mcpIntegration = mcpIntegration;

    const result = WorkflowConfigValidator.mergeConfigs(baseConfig, overrides);

    if (!result.validation.valid) {
      throw new Error(`Invalid environment configuration: ${result.validation.errors.join(', ')}`);
    }

    return result.config;
  }
}
