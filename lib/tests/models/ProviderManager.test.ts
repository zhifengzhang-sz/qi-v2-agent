/**
 * Tests for Provider Manager integration
 */

import { describe, it, expect, beforeEach } from 'vitest';
import { ProviderManager } from '@qi/agent/models/ProviderManager';

describe('Provider Manager Integration', () => {
  let providerManager: ProviderManager;

  beforeEach(() => {
    providerManager = new ProviderManager();
  });

  it('should create provider manager successfully', () => {
    expect(providerManager).toBeDefined();
  });

  it('should provide system prompt', () => {
    const systemPrompt = providerManager.getSystemPrompt();
    expect(systemPrompt).toBeTruthy();
    expect(typeof systemPrompt).toBe('string');
  });

  it('should handle provider availability check', async () => {
    const providerResult = await providerManager.getAvailableProvider();
    
    // Should return either success or failure with proper QiCore Result pattern
    expect(providerResult).toHaveProperty('tag');
    expect(['success', 'failure']).toContain(providerResult.tag);
  });

  it('should handle model invocation request', async () => {
    const request = {
      prompt: 'Hello, world!',
      temperature: 0.7,
      maxTokens: 100
    };

    const result = await providerManager.invoke(request);
    
    // Should return QiCore Result pattern
    expect(result).toHaveProperty('tag');
    expect(['success', 'failure']).toContain(result.tag);
    
    // If successful, should have proper response structure
    if (result.tag === 'success') {
      expect(result.value).toHaveProperty('content');
      expect(result.value).toHaveProperty('provider');
      expect(result.value).toHaveProperty('model');
    }
    
    // If failed, should have proper error structure
    if (result.tag === 'failure') {
      expect(result.error).toHaveProperty('message');
    }
  });

  it('should follow QiCore patterns', async () => {
    // Test that all async operations return Result<T, QiError>
    const providerResult = await providerManager.getAvailableProvider();
    
    expect(providerResult).toMatchObject({
      tag: expect.stringMatching(/^(success|failure)$/)
    });
    
    if (providerResult.tag === 'failure') {
      expect(providerResult.error).toHaveProperty('message');
      expect(typeof providerResult.error.message).toBe('string');
    }
  });
});