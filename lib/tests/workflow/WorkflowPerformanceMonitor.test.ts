/**
 * Unit tests for WorkflowPerformanceMonitor
 * 
 * Tests performance monitoring functionality with minimal mocking
 */

import { describe, test, expect, beforeEach } from 'vitest';
import { WorkflowPerformanceMonitor } from '../../src/workflow/impl/WorkflowPerformanceMonitor.js';
import type { PatternSelection } from '../../src/workflow/abstractions/IAdvancedWorkflowOrchestrator.js';

const mockMCPService = {
  isConnected: () => false,
  getClient: () => null,
} as any;

const mockMetricsCollector = {
  collectSystemMetrics: () => Promise.resolve({ memory: 100, cpu: 20, network: 10 }),
} as any;

describe('WorkflowPerformanceMonitor', () => {
  let performanceMonitor: WorkflowPerformanceMonitor;

  beforeEach(() => {
    performanceMonitor = new WorkflowPerformanceMonitor(mockMCPService, mockMetricsCollector);
  });

  test('should start monitoring for workflow execution', async () => {
    const patternSelection: PatternSelection = {
      selectedPattern: 'react',
      confidence: 0.8,
      reasoning: 'Good for exploration',
      alternativePatterns: [],
      expectedPerformance: { estimatedDuration: 120000, expectedQuality: 0.85, resourceUtilization: 0.6 },
    };

    const monitor = await performanceMonitor.startMonitoring('test-execution', patternSelection);

    expect(monitor).toBeDefined();
    expect(monitor.captureCheckpoint).toBeDefined();
    expect(monitor.getMetrics).toBeDefined();
    expect(monitor.getDetailedMetrics).toBeDefined();
  });

  test('should analyze performance trends', async () => {
    const analysis = await performanceMonitor.analyzeWorkflowPerformanceTrends();

    expect(analysis.tag).toBe('success');
    if (analysis.tag === 'success') {
      expect(analysis.value.patternEffectiveness).toBeDefined();
      expect(analysis.value.performanceDegradation).toBeDefined();
      expect(analysis.value.optimizationOpportunities).toBeDefined();
      expect(analysis.value.recommendedActions).toBeDefined();
    }
  });

  test('should capture checkpoint metrics', async () => {
    const patternSelection: PatternSelection = {
      selectedPattern: 'adapt',
      confidence: 0.85,
      reasoning: 'Good for complex tasks',
      alternativePatterns: [],
      expectedPerformance: { estimatedDuration: 150000, expectedQuality: 0.9, resourceUtilization: 0.8 },
    };

    const monitor = await performanceMonitor.startMonitoring('checkpoint-test', patternSelection);

    const checkpoint = {
      stepId: 'test-step',
      progress: 0.5,
      state: { phase: 'execution' },
      timestamp: new Date(),
    };

    const checkpointMetric = monitor.captureCheckpoint(checkpoint);

    expect(checkpointMetric.timestamp).toEqual(checkpoint.timestamp);
    expect(checkpointMetric.progress).toBe(0.5);
    expect(checkpointMetric.stepId).toBe('test-step');
    expect(checkpointMetric.metrics).toBeDefined();
    expect(checkpointMetric.issues).toBeInstanceOf(Array);
  });
});