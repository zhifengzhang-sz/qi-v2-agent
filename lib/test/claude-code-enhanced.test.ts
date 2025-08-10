// Test for Claude Code-Enhanced Classification Method

import { describe, it, expect } from 'vitest';
import { createClaudeCodeClassifier } from '../src/classifier/index.js';

describe('Claude Code-Enhanced Classifier', () => {
  const classifier = createClaudeCodeClassifier();

  it('should detect slash commands', async () => {
    const result = await classifier.classify('/help');
    expect(result.type).toBe('command');
    expect(result.confidence).toBe(1.0);
    expect(result.extractedData.get('commandType')).toBe('slash');
  });

  it('should detect conversation control flags', async () => {
    const result = await classifier.classify('--continue');
    expect(result.type).toBe('command');
    expect(result.confidence).toBe(1.0);
    expect(result.extractedData.get('commandType')).toBe('conversation-control');
  });

  it('should detect file references as workflows', async () => {
    const result = await classifier.classify('@src/main.ts fix the issue');
    expect(result.type).toBe('workflow');
    expect(result.confidence).toBeGreaterThan(0.6);
    expect(result.reasoning).toContain('file references');
  });

  it('should classify simple prompts correctly', async () => {
    const result = await classifier.classify('hi there');
    expect(result.type).toBe('prompt');
    expect(result.confidence).toBeGreaterThan(0.5);
  });

  it('should classify workflows with codebase actions', async () => {
    const result = await classifier.classify('refactor the authentication system');
    expect(result.type).toBe('workflow');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.reasoning).toContain('codebase actions');
  });

  it('should classify workflows with extended thinking triggers', async () => {
    const result = await classifier.classify('think harder about this optimization problem');
    expect(result.type).toBe('workflow');
    expect(result.confidence).toBeGreaterThanOrEqual(0.5);
    expect(result.reasoning).toContain('extended thinking');
  });

  it('should classify workflows with multi-step indicators', async () => {
    const result = await classifier.classify('first create the component, then add tests');
    expect(result.type).toBe('workflow');
    expect(result.confidence).toBeGreaterThan(0.5);
    expect(result.reasoning).toContain('multi-step');
  });

  it('should maintain high performance', async () => {
    const start = Date.now();
    await classifier.classify('test input');
    const latency = Date.now() - start;
    expect(latency).toBeLessThan(100); // Should be very fast (rule-based)
  });

  it('should provide detailed metadata', async () => {
    const result = await classifier.classify('analyze @lib/classifier.ts');
    expect(result.method).toBe('claude-code-enhanced');
    expect(result.metadata.get('enhancedDetection')).toBe('true');
    expect(result.extractedData.get('enhancedFeatures')).toBeDefined();
  });

  it('should handle complex mixed patterns', async () => {
    const result = await classifier.classify('think more about @src/utils.ts and refactor it step by step');
    expect(result.type).toBe('workflow'); // Complex patterns suggest workflow
    expect(result.confidence).toBeGreaterThan(0.6); // Should have high confidence due to multiple indicators
    expect(result.reasoning).toMatch(/(extended thinking|file references|codebase actions|multi-step)/);
  });
});