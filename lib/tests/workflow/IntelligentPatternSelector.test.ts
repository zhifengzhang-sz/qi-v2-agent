/**
 * Unit tests for IntelligentPatternSelector
 * 
 * Tests the actual pattern selection logic and algorithms without excessive mocking
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { IntelligentPatternSelector } from '../../src/workflow/impl/IntelligentPatternSelector.js';
import type { WorkflowRequest } from '../../src/workflow/abstractions/IAdvancedWorkflowOrchestrator.js';

const mockMCPService = {
  isConnected: () => false,
  getClient: () => null,
} as any;

describe('IntelligentPatternSelector', () => {
  let patternSelector: IntelligentPatternSelector;

  beforeEach(() => {
    patternSelector = new IntelligentPatternSelector(mockMCPService);
  });

  test('should select valid patterns', async () => {
    const request: WorkflowRequest = {
      id: 'test-1',
      description: 'Test pattern selection',
      context: {},
      priority: 'normal',
      expectedComplexity: 'moderate',
    };

    const result = await patternSelector.selectOptimalPattern(request);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(['react', 'rewoo', 'adapt']).toContain(result.value.selectedPattern);
      expect(result.value.confidence).toBeGreaterThan(0);
      expect(result.value.confidence).toBeLessThanOrEqual(1);
      expect(result.value.reasoning).toBeTruthy();
    }
  });

  test('should handle different complexity levels', async () => {
    const simpleRequest: WorkflowRequest = {
      id: 'simple',
      description: 'Simple task',
      context: {},
      priority: 'low',
      expectedComplexity: 'simple',
    };

    const complexRequest: WorkflowRequest = {
      id: 'complex',
      description: 'Complex task with multiple requirements',
      context: {},
      priority: 'high',
      expectedComplexity: 'complex',
    };

    const [simpleResult, complexResult] = await Promise.all([
      patternSelector.selectOptimalPattern(simpleRequest),
      patternSelector.selectOptimalPattern(complexRequest),
    ]);

    expect(simpleResult.tag).toBe('success');
    expect(complexResult.tag).toBe('success');
  });

  test('should provide performance estimates', async () => {
    const request: WorkflowRequest = {
      id: 'perf-test',
      description: 'Performance test',
      context: {},
      priority: 'normal',
      expectedComplexity: 'moderate',
    };

    const result = await patternSelector.selectOptimalPattern(request);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.expectedPerformance.estimatedDuration).toBeGreaterThan(0);
      expect(result.value.expectedPerformance.expectedQuality).toBeGreaterThan(0);
      expect(result.value.expectedPerformance.expectedQuality).toBeLessThanOrEqual(1);
      expect(result.value.expectedPerformance.resourceUtilization).toBeGreaterThan(0);
      expect(result.value.expectedPerformance.resourceUtilization).toBeLessThanOrEqual(1);
    }
  });
});