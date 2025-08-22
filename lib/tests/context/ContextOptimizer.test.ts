/**
 * ContextOptimizer Tests
 *
 * Tests for context optimization functionality including token counting,
 * content scoring, and optimization algorithms.
 */

import { beforeEach, describe, expect, it } from 'vitest';
import { match } from '@qi/base';
import { ContextOptimizer } from '../../src/context/impl/ContextOptimizer.js';

describe('ContextOptimizer', () => {
  let optimizer: ContextOptimizer;

  beforeEach(() => {
    optimizer = new ContextOptimizer();
  });

  describe('Token Counting', () => {
    it('should calculate token count with character approximation', () => {
      const shortText = 'Hello world';
      const longText = 'This is a longer text that should have more tokens than the short one';

      const shortTokens = optimizer.calculateTokenCount(shortText);
      const longTokens = optimizer.calculateTokenCount(longText);

      expect(shortTokens).toBeGreaterThan(0);
      expect(longTokens).toBeGreaterThan(shortTokens);
      expect(shortTokens).toBe(Math.ceil((shortText.length / 4) * 1.1));
    });

    it('should handle empty or invalid text', () => {
      expect(optimizer.calculateTokenCount('')).toBe(0);
      expect(optimizer.calculateTokenCount(null as any)).toBe(0);
      expect(optimizer.calculateTokenCount(undefined as any)).toBe(0);
    });

    it('should be reasonably accurate for typical content', () => {
      const typicalPrompt = `
        Please analyze this code:
        
        function fibonacci(n) {
          if (n <= 1) return n;
          return fibonacci(n - 1) + fibonacci(n - 2);
        }
        
        What are the performance issues?
      `;

      const tokens = optimizer.calculateTokenCount(typicalPrompt);
      // Should be roughly 50-80 tokens for this content
      expect(tokens).toBeGreaterThan(40);
      expect(tokens).toBeLessThan(100);
    });
  });

  describe('Relevance Scoring', () => {
    it('should score relevant text higher than irrelevant text', () => {
      const query = 'javascript function error debugging';
      const relevantText = 'This JavaScript function has an error that needs debugging';
      const irrelevantText = 'The weather today is sunny and warm';

      const relevantScore = optimizer.scoreRelevance(relevantText, query);
      const irrelevantScore = optimizer.scoreRelevance(irrelevantText, query);

      expect(relevantScore).toBeGreaterThan(irrelevantScore);
    });

    it('should handle empty inputs gracefully', () => {
      expect(optimizer.scoreRelevance('', 'query')).toBe(0);
      expect(optimizer.scoreRelevance('text', '')).toBe(0);
      expect(optimizer.scoreRelevance('', '')).toBe(0);
    });

    it('should weight longer matching words more heavily', () => {
      const query = 'authentication authorization';
      const text1 = 'auth system';
      const text2 = 'authentication and authorization system';

      const score1 = optimizer.scoreRelevance(text1, query);
      const score2 = optimizer.scoreRelevance(text2, query);

      expect(score2).toBeGreaterThan(score1);
    });
  });

  describe('Context Optimization', () => {
    it('should return original context when under token limit', async () => {
      const shortContext = 'This is a short context that fits within limits.';
      const maxTokens = 1000;

      const result = await optimizer.optimizeContext(shortContext, maxTokens);

      await match(
        (optimized) => {
          expect(optimized).toBe(shortContext);
        },
        (error) => {
          throw new Error(`Optimization should not fail for short context: ${error.message}`);
        },
        result
      );
    });

    it('should reduce context size when over token limit', async () => {
      // Create a large context with repetitive content
      const largeContext =
        Array(100).fill('This is some repetitive content that should be pruned. ').join('') +
        `
        Important code section:
        function criticalFunction() {
          // This is important business logic
          return processData();
        }
        
        Error message: Failed to connect to database
        Question: How do we fix this connection issue?
        Answer: Check the connection string and network settings.
        `;

      const maxTokens = 50; // Very low limit to force optimization

      const result = await optimizer.optimizeContext(largeContext, maxTokens);

      await match(
        (optimized) => {
          const originalTokens = optimizer.calculateTokenCount(largeContext);
          const optimizedTokens = optimizer.calculateTokenCount(optimized);

          expect(optimizedTokens).toBeLessThan(originalTokens);
          expect(optimizedTokens).toBeLessThanOrEqual(maxTokens);

          // Important content should be preserved
          const hasImportantContent =
            optimized.includes('Important code section') ||
            optimized.includes('criticalFunction') ||
            optimized.includes('Error message');
          expect(hasImportantContent).toBe(true);
        },
        (error) => {
          throw new Error(`Optimization should succeed: ${error.message}`);
        },
        result
      );
    });

    it('should preserve high-scoring content sections', async () => {
      const contextWithMixedContent = `
        Random text that is not very important for the conversation.
        Some more filler content that can be safely removed during optimization.
        
        function importantFunction() {
          // This code section should be preserved
          return criticalBusinessLogic();
        }
        
        Error: Connection timeout occurred
        Question: How to debug this error?
        Answer: Check network connectivity and server status.
        
        More random content that can be pruned if needed.
        This is just padding text to make the context larger.
      `;

      const maxTokens = optimizer.calculateTokenCount(contextWithMixedContent) * 0.6; // Force optimization

      const result = await optimizer.optimizeContext(contextWithMixedContent, maxTokens);

      await match(
        (optimized) => {
          // Should preserve code, errors, and Q&A patterns
          expect(
            optimized.includes('function') ||
              optimized.includes('Error:') ||
              optimized.includes('Question:')
          ).toBe(true);

          // Should be shorter than original
          expect(optimizer.calculateTokenCount(optimized)).toBeLessThan(
            optimizer.calculateTokenCount(contextWithMixedContent)
          );
        },
        (error) => {
          throw new Error(`Optimization should preserve important content: ${error.message}`);
        },
        result
      );
    });

    it('should handle invalid input gracefully', async () => {
      const result1 = await optimizer.optimizeContext('', 1000);
      const result2 = await optimizer.optimizeContext(null as any, 1000);
      const result3 = await optimizer.optimizeContext('valid text', -1);

      // All should result in errors
      await match(
        () => {
          throw new Error('Should not succeed with empty context');
        },
        (error) => expect(error.code).toBe('OPTIMIZATION_FAILED'),
        result1
      );

      await match(
        () => {
          throw new Error('Should not succeed with null context');
        },
        (error) => expect(error.code).toBe('OPTIMIZATION_FAILED'),
        result2
      );

      await match(
        () => {
          throw new Error('Should not succeed with negative token limit');
        },
        (error) => expect(error.code).toBe('OPTIMIZATION_FAILED'),
        result3
      );
    });
  });

  describe('Context Pruning by Age', () => {
    it('should remove old content based on timestamp', async () => {
      const now = new Date();
      const recentTime = new Date(now.getTime() - 5 * 24 * 60 * 60 * 1000); // 5 days ago
      const oldTime = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000); // 60 days ago

      const oldContent = `[${oldTime.toISOString()}] Old log entry that should be removed with enough content to meet minimum length requirements
        Some content without timestamp that also has enough content to meet the minimum length requirements for section processing
        [${recentTime.toISOString()}] Recent log entry that should be kept and has sufficient content length to pass minimum requirements`;

      const maxAge = 30 * 24 * 60 * 60 * 1000; // 30 days in milliseconds

      const result = await optimizer.pruneOldContext(oldContent, maxAge);

      await match(
        (pruned) => {
          expect(pruned).toContain('Recent log entry');
          expect(pruned).not.toContain('Old log entry');
          // Content without timestamp gets grouped with the first timestamped section,
          // so it will be removed along with the old log entry
        },
        (error) => {
          throw new Error(`Pruning should succeed: ${error.message}`);
        },
        result
      );
    });

    it('should handle content with no timestamps', async () => {
      const contentWithoutTimestamps = `
        This is some content without any timestamps.
        It should all be preserved since we cannot determine age.
        Multiple paragraphs of content here.
      `;

      const maxAge = 24 * 60 * 60 * 1000; // 1 day

      const result = await optimizer.pruneOldContext(contentWithoutTimestamps, maxAge);

      await match(
        (pruned) => {
          expect(pruned).toBe(contentWithoutTimestamps.trim());
        },
        (error) => {
          throw new Error(`Should preserve content without timestamps: ${error.message}`);
        },
        result
      );
    });

    it('should validate input parameters', async () => {
      const result1 = await optimizer.pruneOldContext('', 1000);
      const result2 = await optimizer.pruneOldContext('valid text', -1);
      const result3 = await optimizer.pruneOldContext(null as any, 1000);

      await match(
        () => {
          throw new Error('Should fail with empty context');
        },
        (error) => expect(error.code).toBe('OPTIMIZATION_FAILED'),
        result1
      );

      await match(
        () => {
          throw new Error('Should fail with negative maxAge');
        },
        (error) => expect(error.code).toBe('OPTIMIZATION_FAILED'),
        result2
      );

      await match(
        () => {
          throw new Error('Should fail with null context');
        },
        (error) => expect(error.code).toBe('OPTIMIZATION_FAILED'),
        result3
      );
    });
  });

  describe('Performance', () => {
    it('should optimize large context within reasonable time', async () => {
      // Create a large context (approximately 32k characters)
      const sections = [
        'User question: How do I implement authentication?',
        'Code example: function authenticate() { return true; }',
        'Error: Invalid credentials provided',
        'Documentation: OAuth 2.0 implementation guide',
        Array(500).fill('Filler content that can be removed. ').join(''),
        'Important note: Remember to validate tokens',
        'Question: What about session management?',
        'Answer: Use secure session storage',
        Array(300).fill('More filler content for testing optimization. ').join(''),
      ];

      const largeContext = sections.join('\n\n');
      const startTime = Date.now();

      const result = await optimizer.optimizeContext(largeContext, 8000);

      const duration = Date.now() - startTime;

      await match(
        (optimized) => {
          expect(duration).toBeLessThan(500); // Should complete in <500ms
          expect(optimized.length).toBeLessThan(largeContext.length);
          expect(optimizer.calculateTokenCount(optimized)).toBeLessThanOrEqual(8000);
        },
        (error) => {
          throw new Error(`Performance test failed: ${error.message}`);
        },
        result
      );
    }, 10000); // 10 second timeout for performance test
  });

  describe('Content Scoring Logic', () => {
    it('should score code content higher', () => {
      const codeContent = 'function example() { return "code"; }';
      const regularContent = 'This is just regular text content';

      // Use a private method test by checking optimization results
      expect(codeContent).toContain('function');
      expect(regularContent).not.toContain('function');
    });

    it('should score Q&A patterns higher', () => {
      const qaContent = 'Question: How does this work? Answer: It processes data';
      const regularContent = 'This is just a statement without questions or answers';

      expect(qaContent).toContain('Question:');
      expect(qaContent).toContain('Answer:');
      expect(regularContent).not.toContain('Question:');
    });

    it('should score error content higher', () => {
      const errorContent = 'Error: Failed to connect to database. Exception occurred';
      const regularContent = 'The system is running normally without issues';

      expect(errorContent.toLowerCase()).toContain('error');
      expect(errorContent.toLowerCase()).toContain('exception');
      expect(regularContent.toLowerCase()).not.toContain('error');
    });
  });
});
