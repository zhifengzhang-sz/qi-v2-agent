/**
 * Performance Tracking Utilities for Classification Methods
 *
 * Shared utilities for tracking real performance metrics across all classification methods.
 * Replaces hardcoded fake metrics with actual measurement and schema registry integration.
 */

import { match } from '@qi/base';
import { globalSchemaRegistry, type SchemaEntry } from '../schema-registry.js';

/**
 * Track performance metrics for a classification method using schema registry
 */
export function trackClassificationPerformance(
  selectedSchema: SchemaEntry | null,
  startTime: number,
  classificationSuccess: boolean,
  parsingSuccess: boolean
): void {
  if (!selectedSchema) {
    return; // Can't track without schema
  }

  const latencyMs = Date.now() - startTime;
  const trackingResult = globalSchemaRegistry.trackSchemaUsage(
    selectedSchema.metadata.name,
    latencyMs,
    classificationSuccess,
    parsingSuccess
  );

  // Log tracking errors for debugging but don't fail the classification
  match(
    () => {}, // Success - do nothing
    (error) => console.warn(`Failed to track schema performance: ${error.message}`),
    trackingResult
  );
}

/**
 * Get expected accuracy from schema using measured performance if available, baseline otherwise
 */
export function getEffectiveAccuracy(
  selectedSchema: SchemaEntry | null,
  defaultAccuracy: number = 0.85
): number {
  if (selectedSchema) {
    return (
      selectedSchema.metadata.performance_profile.measured_accuracy ??
      selectedSchema.metadata.performance_profile.baseline_accuracy_estimate
    );
  }
  return defaultAccuracy;
}

/**
 * Get average latency from schema using measured performance if available, baseline otherwise
 */
export function getEffectiveLatency(
  selectedSchema: SchemaEntry | null,
  defaultLatency: number = 300
): number {
  if (selectedSchema) {
    return (
      selectedSchema.metadata.performance_profile.measured_latency_ms ??
      selectedSchema.metadata.performance_profile.baseline_latency_estimate_ms
    );
  }
  return defaultLatency;
}

/**
 * Create a higher-order function that adds performance tracking to classification methods
 */
export function withPerformanceTracking<T extends (...args: unknown[]) => Promise<unknown>>(
  originalMethod: T,
  selectedSchema: SchemaEntry | null
): T {
  return (async (...args: Parameters<T>) => {
    const startTime = Date.now();

    try {
      const result = await originalMethod(...args);
      // Track successful classification
      trackClassificationPerformance(selectedSchema, startTime, true, true);
      return result;
    } catch (error) {
      // Track failed classification
      trackClassificationPerformance(selectedSchema, startTime, false, false);
      throw error;
    }
  }) as T;
}
