/**
 * Unit tests for ProductionWorkflowExecutor
 * 
 * Tests workflow execution coordination with minimal mocking
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { ProductionWorkflowExecutor } from '../../src/workflow/impl/ProductionWorkflowExecutor.js';
import { IntelligentPatternSelector } from '../../src/workflow/impl/IntelligentPatternSelector.js';
import type { WorkflowRequest } from '../../src/workflow/abstractions/IAdvancedWorkflowOrchestrator.js';
import { success } from '@qi/base';

const mockMCPService = {
  isConnected: () => false,
  getClient: () => null,
} as any;

const mockPerformanceMonitor = {
  startMonitoring: () => Promise.resolve({
    captureCheckpoint: () => ({
      timestamp: new Date(),
      progress: 0.5,
      stepId: 'test',
      metrics: { duration: 1000, memoryUsage: 100, apiCalls: { total: 5 }, qualityScore: 0.8 },
      issues: [],
    }),
    getMetrics: () => ({
      executionTime: 120000,
      memoryUsage: 100,
      apiUsage: { total: 10 },
      qualityScore: 0.85,
      efficiencyScore: 0.8,
      adaptationCount: 0,
      checkpointTimes: [5000, 10000],
    }),
    getDetailedMetrics: () => ({
      checkpointMetrics: [],
      adaptationMetrics: [],
      resourceUtilization: { memoryUsage: [], cpuUsage: [], apiCallRate: [], networkUsage: [] },
      performanceTrend: { efficiency: [], quality: [], speed: [] },
    }),
  }),
} as any;

const mockAdaptationEngine = {
  assessAdaptationNeed: () => Promise.resolve({ shouldAdapt: false, reason: 'OK', urgency: 'low' }),
  generateAdaptation: () => Promise.resolve({ success: true }),
} as any;

describe('ProductionWorkflowExecutor', () => {
  let executor: ProductionWorkflowExecutor;

  beforeEach(() => {
    const patternSelector = new IntelligentPatternSelector(mockMCPService);
    executor = new ProductionWorkflowExecutor(
      patternSelector,
      mockPerformanceMonitor,
      mockAdaptationEngine,
      mockMCPService
    );
  });

  test('should execute workflow with monitoring', async () => {
    const request: WorkflowRequest = {
      id: 'test-workflow',
      description: 'Test workflow execution',
      context: {},
      priority: 'normal',
      expectedComplexity: 'moderate',
    };

    const result = await executor.executeWorkflowWithMonitoring(request);

    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.executionId).toBeTruthy();
      expect(result.value.status).toBe('completed');
      expect(result.value.progress).toBe(100);
      expect(result.value.performanceMetrics).toBeDefined();
    }
  });

  test('should provide workflow health status', async () => {
    const health = await executor.getWorkflowHealth();

    expect(health.tag).toBe('success');
    if (health.tag === 'success') {
      expect(health.value.activeExecutions).toBeGreaterThanOrEqual(0);
      expect(health.value.averagePerformance).toBeGreaterThanOrEqual(0);
      expect(health.value.systemLoad).toBeGreaterThanOrEqual(0);
      expect(health.value.learningEffectiveness).toBeGreaterThanOrEqual(0);
    }
  });
});