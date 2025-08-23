/**
 * Unit tests for Enhanced Workflow Configuration
 * 
 * Tests configuration objects and validation logic without over-mocking
 */

import { describe, test, expect } from 'vitest';
import {
  ENHANCED_WORKFLOW_CONFIG,
  DEVELOPMENT_WORKFLOW_CONFIG,
  HIGH_PERFORMANCE_WORKFLOW_CONFIG,
  WorkflowConfigValidator,
  WorkflowConfigBuilder,
} from '../../src/workflow/config/enhanced-workflow-config.js';

describe('Enhanced Workflow Configuration', () => {
  test('should have valid default configurations', () => {
    expect(ENHANCED_WORKFLOW_CONFIG.patternSelection.enableIntelligentSelection).toBe(true);
    expect(ENHANCED_WORKFLOW_CONFIG.monitoring.performanceCheckpointInterval).toBe(5000);
    expect(ENHANCED_WORKFLOW_CONFIG.learning.enableContinuousLearning).toBe(true);

    expect(DEVELOPMENT_WORKFLOW_CONFIG.patternSelection.minimumConfidenceThreshold).toBe(0.5);
    expect(HIGH_PERFORMANCE_WORKFLOW_CONFIG.patternSelection.minimumConfidenceThreshold).toBe(0.8);
  });

  test('should validate configurations correctly', () => {
    const validConfig = ENHANCED_WORKFLOW_CONFIG;
    const validation = WorkflowConfigValidator.validateConfig(validConfig);
    
    expect(validation.valid).toBe(true);
    expect(validation.errors).toHaveLength(0);
  });

  test('should detect invalid configurations', () => {
    const invalidConfig = {
      ...ENHANCED_WORKFLOW_CONFIG,
      patternSelection: {
        ...ENHANCED_WORKFLOW_CONFIG.patternSelection,
        learningWeightDecay: 1.5, // Invalid: > 1.0
      },
    };

    const validation = WorkflowConfigValidator.validateConfig(invalidConfig);
    
    expect(validation.valid).toBe(false);
    expect(validation.errors.length).toBeGreaterThan(0);
  });

  test('should build configurations with builder pattern', () => {
    const config = WorkflowConfigBuilder.create()
      .patternSelection({ minimumConfidenceThreshold: 0.75 })
      .monitoring({ performanceCheckpointInterval: 4000 })
      .build();

    expect(config.patternSelection.minimumConfidenceThreshold).toBe(0.75);
    expect(config.monitoring.performanceCheckpointInterval).toBe(4000);
  });

  test('should merge configurations correctly', () => {
    const base = ENHANCED_WORKFLOW_CONFIG;
    const override = {
      patternSelection: { minimumConfidenceThreshold: 0.7 }
    };

    const { config, validation } = WorkflowConfigValidator.mergeConfigs(base, override);

    expect(validation.valid).toBe(true);
    expect(config.patternSelection.minimumConfidenceThreshold).toBe(0.7);
    expect(config.monitoring.performanceCheckpointInterval).toBe(5000); // Unchanged
  });
});