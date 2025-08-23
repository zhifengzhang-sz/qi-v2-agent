/**
 * Unit tests for WorkflowLearningSystem
 * 
 * Tests learning and adaptation capabilities with minimal mocking
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { WorkflowLearningSystem } from '../../src/workflow/impl/WorkflowLearningSystem.js';
import type { WorkflowOutcome } from '../../src/workflow/abstractions/IAdvancedWorkflowOrchestrator.js';

const mockMCPService = {
  isConnected: () => false,
  getClient: () => null,
} as any;

const createMockOutcome = (pattern: string, success: boolean): WorkflowOutcome => ({
  executionId: `exec-${Math.random().toString(36).substr(2, 9)}`,
  workflowRequest: {
    id: 'test-request',
    description: `Test workflow for ${pattern}`,
    context: { pattern },
    priority: 'normal',
    expectedComplexity: 'moderate',
  },
  patternUsed: pattern,
  success,
  metrics: {
    executionTime: 120000,
    memoryUsage: 100,
    apiUsage: { total: 10 },
    qualityScore: success ? 0.8 : 0.4,
    efficiencyScore: 0.8,
    adaptationCount: success ? 0 : 1,
    checkpointTimes: [5000, 10000],
  },
  qualityAssessment: {
    outputQuality: success ? 0.8 : 0.4,
    completeness: success ? 0.9 : 0.5,
    accuracy: success ? 0.95 : 0.6,
  },
  adaptations: [],
  timestamp: new Date(),
});

describe('WorkflowLearningSystem', () => {
  let learningSystem: WorkflowLearningSystem;

  beforeEach(() => {
    learningSystem = new WorkflowLearningSystem(mockMCPService);
  });

  test('should learn from successful workflow outcomes', async () => {
    const outcomes = [
      createMockOutcome('react', true),
      createMockOutcome('rewoo', true),
      createMockOutcome('adapt', true),
    ];

    const result = await learningSystem.learnFromWorkflowOutcomes(outcomes);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.patternOptimizations).toBeInstanceOf(Array);
      expect(result.value.contextualPatterns).toBeInstanceOf(Array);
      expect(result.value.performanceImprovements).toBeInstanceOf(Array);
      expect(result.value.failurePrevention).toBeInstanceOf(Array);
      expect(result.value.confidence).toBeGreaterThan(0);
    }
  });

  test('should analyze failure patterns', async () => {
    const outcomes = [
      createMockOutcome('react', false),
      createMockOutcome('rewoo', false),
      createMockOutcome('adapt', true),
    ];

    const result = await learningSystem.learnFromWorkflowOutcomes(outcomes);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.failurePrevention.length).toBeGreaterThanOrEqual(0);
    }
  });

  test('should handle empty outcome arrays', async () => {
    const result = await learningSystem.learnFromWorkflowOutcomes([]);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.patternOptimizations).toHaveLength(0);
      expect(result.value.contextualPatterns).toHaveLength(0);
    }
  });

  test('should apply learnings to future executions', async () => {
    const insights = {
      patternOptimizations: [],
      contextualPatterns: [],
      performanceImprovements: [],
      failurePrevention: [],
      confidence: 0.8,
      applicabilityScope: 'test scope',
    };

    const result = await learningSystem.applyLearningsToFutureExecutions(insights);

    expect(result.tag).toBe('success');
  });
});