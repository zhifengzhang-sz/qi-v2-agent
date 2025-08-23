/**
 * Unit tests for HybridPatternOrchestrator
 * 
 * Tests multi-pattern coordination logic without excessive mocking
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { HybridPatternOrchestrator } from '../../src/workflow/impl/HybridPatternOrchestrator.js';
import type { WorkflowRequest } from '../../src/workflow/abstractions/IAdvancedWorkflowOrchestrator.js';

describe('HybridPatternOrchestrator', () => {
  let hybridOrchestrator: HybridPatternOrchestrator;

  beforeEach(() => {
    hybridOrchestrator = new HybridPatternOrchestrator();
  });

  test('should coordinate hybrid execution', async () => {
    const request: WorkflowRequest = {
      id: 'test-hybrid',
      description: 'Test hybrid execution',
      context: {},
      priority: 'normal',
      expectedComplexity: 'moderate',
    };

    const result = await hybridOrchestrator.coordinateHybridExecution(request);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.executionId).toBeTruthy();
      expect(result.value.phases.length).toBeGreaterThan(0);
      expect(result.value.success).toBe(true);
      expect(result.value.overallQuality).toBeGreaterThan(0);
    }
  });

  test('should handle complex requests with multiple phases', async () => {
    const complexRequest: WorkflowRequest = {
      id: 'complex-hybrid',
      description: 'Complex multi-phase workflow requiring exploration, analysis, and execution',
      context: { complexity: 'high' },
      priority: 'high',
      expectedComplexity: 'complex',
    };

    const result = await hybridOrchestrator.coordinateHybridExecution(complexRequest);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.phases.length).toBeGreaterThanOrEqual(1);
      expect(result.value.overallMetrics).toBeDefined();
    }
  });

  test('should use single pattern for simple tasks', async () => {
    const simpleRequest: WorkflowRequest = {
      id: 'simple-task',
      description: 'Simple task',
      context: {},
      priority: 'low',
      expectedComplexity: 'simple',
    };

    const result = await hybridOrchestrator.coordinateHybridExecution(simpleRequest);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      // Simple tasks should use single pattern (1 phase)
      expect(result.value.phases.length).toBe(1);
      expect(result.value.transitions.length).toBe(0);
    }
  });
});