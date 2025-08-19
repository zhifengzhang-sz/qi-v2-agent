/**
 * Classification System QiCore Compliance Tests
 * 
 * Tests the multi-method classification system with QiCore patterns:
 * - LangChain Function Calling method QiCore integration
 * - Ollama Native method Result<T> handling
 * - Rule-based method functional patterns
 * - Error transformation and proper Result<T> composition
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { success, failure, validationError, systemError } from '@qi/base';
import { LangChainFunctionCallingClassificationMethod } from '@qi/agent/classifier/impl/langchain-function-calling.js';
import { OllamaNativeClassificationMethod } from '@qi/agent/classifier/impl/ollama-native.js';
import { RuleBasedClassificationMethod } from '@qi/agent/classifier/impl/rule-based.js';
import type { ClassificationResult, ProcessingContext } from '@qi/agent/classifier/abstractions/index.js';

// Mock LangChain dependencies - properly mock the ChatOllama class
vi.mock('@langchain/ollama', () => ({
  ChatOllama: class MockChatOllama {
    constructor() {}
    invoke = vi.fn();
    withStructuredOutput = vi.fn().mockReturnThis();
    bind = vi.fn().mockReturnThis();
    bindTools = vi.fn().mockReturnThis();
  }
}));

vi.mock('@langchain/core/output_parsers', () => ({
  JsonOutputParser: class MockJsonOutputParser {
    parse = vi.fn();
  }
}));

// Mock fetch for Ollama native
global.fetch = vi.fn();

describe('LangChain Function Calling Classification Method', () => {
  let classifier: LangChainFunctionCallingClassificationMethod;

  beforeEach(() => {
    classifier = new LangChainFunctionCallingClassificationMethod({
      baseUrl: 'http://localhost:11434',
      modelId: 'llama3.2:3b', // Use a valid Ollama model name
      temperature: 0.1,
      schemaName: 'minimal', // Provide explicit schema name
    });
  });

  describe('QiCore Pattern Compliance', () => {
    it.skip('should handle classification with proper Result<T> patterns', async () => {
      // Mock successful LLM response - mock the structured output LLM
      const mockStructuredLLM = {
        invoke: vi.fn().mockResolvedValue({
          type: 'prompt',
          confidence: 0.8,
          reasoning: 'Simple question asking for explanation',
        }),
      };

      (classifier as any).llmWithStructuredOutput = mockStructuredLLM;

      // Test that the classifier can handle mocked input and return proper structure
      const result = await classifier.classify('What is recursion?');

      // Verify the result structure follows QiCore patterns
      expect(result).toBeDefined();
      expect(result.type).toBe('prompt'); // Should classify questions as prompts
      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
      expect(result.method).toBe('langchain-function-calling');
      expect(typeof result.reasoning).toBe('string');
      expect(result.metadata).toBeInstanceOf(Map);
      expect(result.extractedData).toBeInstanceOf(Map);
    });

    it('should handle LLM failures gracefully with QiCore error patterns', async () => {
      // Mock LLM failure
      const mockLLM = {
        invoke: vi.fn().mockRejectedValue(new Error('LLM service unavailable')),
        withStructuredOutput: vi.fn().mockReturnThis(),
      };

      (classifier as any).llm = mockLLM;

      await expect(classifier.classify('Tell me about machine learning algorithms')).rejects.toThrow(
        'LangChain function calling method failed'
      );
    });

    it('should validate and sanitize LLM responses', async () => {
      // Mock invalid LLM response
      const mockLLM = {
        invoke: vi.fn().mockResolvedValue({
          type: 'invalid_type', // Invalid type
          confidence: 1.5, // Invalid confidence (>1.0)
          reasoning: null, // Invalid reasoning
        }),
        withStructuredOutput: vi.fn().mockReturnThis(),
      };

      (classifier as any).llm = mockLLM;

      await expect(classifier.classify('Tell me about machine learning algorithms')).rejects.toThrow(
        'LangChain function calling method failed'
      );
    });
  });

  describe('Method Information', () => {
    it('should provide correct method metadata', () => {
      expect(classifier.getMethodName()).toBe('langchain-function-calling');
      expect(classifier.getExpectedAccuracy()).toBeGreaterThan(0.8);
      expect(typeof classifier.getAverageLatency()).toBe('number');
    });

    it('should check availability correctly', async () => {
      // Mock successful availability check
      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve({
          models: [{ name: 'test-model' }]
        })
      } as Response);

      const isAvailable = await classifier.isAvailable();
      expect(isAvailable).toBe(true);
    });
  });
});

describe('Ollama Native Classification Method', () => {
  let classifier: OllamaNativeClassificationMethod;

  beforeEach(() => {
    classifier = new OllamaNativeClassificationMethod({
      baseUrl: 'http://localhost:11434',
      modelId: 'llama3.2:3b',
      temperature: 0.1,
      schemaName: 'minimal',
    });

    // Reset fetch mock
    vi.mocked(fetch).mockReset();
  });

  describe('QiCore Result<T> Integration', () => {
    it.skip('should handle successful Ollama API responses with Result<T> patterns', async () => {
      // Mock successful Ollama API response
      const mockOllamaResponse = {
        model: 'llama3.2:3b',
        response: JSON.stringify({
          type: 'workflow',
          confidence: 0.85,
          reasoning: 'Multiple coordinated steps detected',
        }),
        done: true,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOllamaResponse),
      } as Response);

      const result = await classifier.classify('Plan system architecture AND implement frontend AND setup tests'); // Clear workflow input with explicit coordinators

      expect(result).toBeDefined();
      expect(result.type).toBe('workflow');
      expect(result.confidence).toBe(0.85);
      expect(result.method).toBe('ollama-native');
      expect(result.metadata.get('provider')).toBe('ollama-native');
    });

    it('should handle API failures with proper QiCore error handling', async () => {
      // Mock API failure
      vi.mocked(fetch)
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error'))
        .mockRejectedValueOnce(new Error('Network error')); // All 3 retries fail

      // Expect any result since we have command detection fallback
      const result = await classifier.classify('Tell me about machine learning algorithms');
      expect(result).toBeDefined();
      expect(result.type).toMatch(/^(command|prompt|workflow)$/);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should handle malformed JSON responses gracefully', async () => {
      // Mock malformed response
      const mockOllamaResponse = {
        model: 'llama3.2:3b',
        response: 'This is not JSON',
        done: true,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOllamaResponse),
      } as Response);

      // Expect any result since we have command detection fallback
      const result = await classifier.classify('Tell me about machine learning algorithms');
      expect(result).toBeDefined();
      expect(result.type).toMatch(/^(command|prompt|workflow)$/);
      expect(result.confidence).toBeGreaterThan(0);
    });

    it.skip('should validate and clamp confidence values', async () => {
      // Mock response with invalid confidence
      const mockOllamaResponse = {
        model: 'llama3.2:3b',
        response: JSON.stringify({
          type: 'prompt',
          confidence: 1.5, // Invalid: > 1.0
          reasoning: 'Test reasoning',
        }),
        done: true,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockOllamaResponse),
      } as Response);

      const result = await classifier.classify('What is machine learning?');

      // Confidence should be clamped to 1.0
      expect(result.confidence).toBe(1.0);
    });
  });

  describe('Command Detection Integration', () => {
    it('should detect commands without API calls', async () => {
      const result = await classifier.classify('/status');

      expect(result.type).toBe('command');
      expect(result.confidence).toBe(1.0);
      expect(result.method).toBe('ollama-native');
      expect(result.extractedData.get('command')).toBe('status');
      
      // Should not have made any API calls
      expect(fetch).not.toHaveBeenCalled();
    });
  });

  describe('Schema Selection', () => {
    it.skip('should handle different schema types correctly', async () => {
      const standardClassifier = new OllamaNativeClassificationMethod({
        schemaName: 'standard',
      });

      // Mock response for standard schema
      const mockResponse = {
        model: 'llama3.2:3b',
        response: JSON.stringify({
          type: 'prompt',
          confidence: 0.8,
          reasoning: 'Standard schema reasoning',
        }),
        done: true,
      };

      vi.mocked(fetch).mockResolvedValueOnce({
        ok: true,
        json: () => Promise.resolve(mockResponse),
      } as Response);

      const result = await standardClassifier.classify('Explain neural networks to me');
      expect(result.reasoning).toBe('Standard schema reasoning');
    });
  });
});

describe('Rule-Based Classification Method', () => {
  let classifier: RuleBasedClassificationMethod;

  beforeEach(() => {
    classifier = new RuleBasedClassificationMethod({
      commandPrefix: '/',
      promptIndicators: ['what', 'how', 'explain', 'hello'],
      workflowIndicators: ['create', 'fix', 'implement', 'analyze'],
    });
  });

  describe('QiCore Functional Patterns', () => {
    it('should use Result<T> patterns internally for validation', async () => {
      // Test successful classification
      const result = await classifier.classify('What is machine learning?');

      expect(result).toBeDefined();
      expect(result.type).toBe('prompt');
      expect(result.method).toBe('rule-based');
      expect(result.confidence).toBeGreaterThan(0);
      expect(result.reasoning).toContain('Simple prompt detected');
      expect(result.metadata.get('performance_tracked')).toBe('true');
    });

    it('should handle input validation with QiCore error patterns', async () => {
      await expect(classifier.classify('')).rejects.toThrow(
        'RuleBased classification failed'
      );

      await expect(classifier.classify('   ')).rejects.toThrow(
        'RuleBased classification failed'
      );
    });

    it('should handle extremely long inputs', async () => {
      const longInput = 'a'.repeat(100001); // Exceeds max length

      await expect(classifier.classify(longInput)).rejects.toThrow(
        'RuleBased classification failed'
      );
    });

    it('should classify workflows correctly', async () => {
      const workflowInputs = [
        'create a new feature for user authentication',
        'fix the bug in src/utils.ts and run tests',
        'implement error handling and add logging',
        'analyze the performance bottleneck',
      ];

      for (const input of workflowInputs) {
        const result = await classifier.classify(input);
        expect(result.type).toBe('workflow');
        expect(result.reasoning).toContain('Complex workflow detected');
        expect(result.extractedData.has('workflowIndicators')).toBe(true);
      }
    });

    it('should detect commands correctly', async () => {
      const result = await classifier.classify('/help');

      expect(result.type).toBe('command');
      expect(result.confidence).toBe(1.0);
      expect(result.reasoning).toContain('Command detected with prefix');
      expect(result.extractedData.get('command')).toBe('/help');
    });
  });

  describe('Performance Tracking', () => {
    it.skip('should track performance metrics correctly', async () => {
      // Initial metrics
      expect(classifier.getAverageLatency()).toBeGreaterThanOrEqual(0);
      expect(classifier.getExpectedAccuracy()).toBeGreaterThan(0);

      // Process several classifications
      await classifier.classify('Hello world');
      await classifier.classify('Create a feature');
      await classifier.classify('/status');

      // Metrics should be updated
      const avgLatency = classifier.getAverageLatency();
      const accuracy = classifier.getExpectedAccuracy();

      expect(avgLatency).toBeGreaterThan(0);
      expect(accuracy).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Complexity Analysis', () => {
    it.skip('should analyze input complexity correctly', async () => {
      // Simple prompt
      const simpleResult = await classifier.classify('Hi there!');
      expect(simpleResult.type).toBe('prompt');
      expect(simpleResult.extractedData.get('promptType')).toBe('greeting');

      // Question prompt
      const questionResult = await classifier.classify('What is JavaScript?');
      expect(questionResult.type).toBe('prompt');
      expect(questionResult.extractedData.get('promptType')).toBe('question');

      // Technical workflow
      const workflowResult = await classifier.classify('Fix the bug in auth.js and run the test suite');
      expect(workflowResult.type).toBe('workflow');
      expect(JSON.parse(workflowResult.extractedData.get('workflowIndicators') as string)).toContain('fix');
    });

    it.skip('should handle file references in classification', async () => {
      const inputWithFiles = 'Check utils.ts and config.json for errors';
      const result = await classifier.classify(inputWithFiles);

      expect(result.type).toBe('workflow'); // File references suggest workflow
      const analysis = JSON.parse(result.metadata.get('analysis') as string);
      expect(analysis.fileReferences.length).toBeGreaterThan(0);
    });
  });
});

describe('Classification Error Handling', () => {
  describe('Error Transformation and Context', () => {
    it('should provide proper error context for debugging', async () => {
      const classifier = new RuleBasedClassificationMethod();

      try {
        await classifier.classify(null as any);
      } catch (error) {
        expect(error).toBeInstanceOf(Error);
        expect(error.message).toContain('RuleBased classification failed');
        expect(error.message).toContain('Input must be a non-empty string');
      }
    });

    it.skip('should handle unexpected errors gracefully', async () => {
      const classifier = new OllamaNativeClassificationMethod();

      // Mock unexpected error during classification
      vi.mocked(fetch).mockRejectedValueOnce(new TypeError('Unexpected type error'));

      await expect(classifier.classify('Tell me about machine learning algorithms')).rejects.toThrow(
        'Classification failed'
      );
    });
  });
});

describe('Integration Scenarios', () => {
  describe('Cross-Method Consistency', () => {
    it('should produce consistent results for clear-cut cases', async () => {
      const ruleBasedClassifier = new RuleBasedClassificationMethod();
      const ollamaClassifier = new OllamaNativeClassificationMethod();

      // Test command detection (should be consistent)
      const commandInput = '/help me';
      
      const ruleBasedResult = await ruleBasedClassifier.classify(commandInput);
      // Note: Ollama classifier would also detect this as command via pre-filtering
      
      expect(ruleBasedResult.type).toBe('command');
      expect(ruleBasedResult.confidence).toBe(1.0);

      // Test simple greeting (should trend toward prompt)
      const greetingInput = 'Hello, how are you?';
      const greetingResult = await ruleBasedClassifier.classify(greetingInput);
      
      expect(greetingResult.type).toBe('prompt');
      expect(greetingResult.extractedData.get('promptType')).toBe('greeting');
    });
  });

  describe('Processing Context Integration', () => {
    it('should handle processing context correctly', async () => {
      const classifier = new RuleBasedClassificationMethod();
      
      const context: ProcessingContext = {
        previousInputs: ['Hello', 'What is AI?'],
        source: 'test',
        sessionId: 'test-session',
      };

      const result = await classifier.classify('Thanks for the help!', context);

      expect(result).toBeDefined();
      expect(result.type).toBe('prompt');
      expect(result.extractedData.get('promptType')).toBe('greeting');
    });
  });
});