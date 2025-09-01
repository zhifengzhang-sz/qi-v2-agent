/**
 * Context Optimizer Implementation
 *
 * Handles context optimization, token management, and content scoring
 * to prevent hitting token limits while preserving important information.
 */

import { create, fromAsyncTryCatch, type QiError, type Result } from '@qi/base';

/**
 * Context optimization error factory functions
 */
const optimizerError = {
  invalidContext: (reason: string): QiError =>
    create('INVALID_CONTEXT', `Invalid context provided for optimization`, 'VALIDATION', {
      reason,
    }),

  optimizationFailed: (reason: string): QiError =>
    create('OPTIMIZATION_FAILED', `Context optimization failed`, 'BUSINESS', { reason }),

  tokenCalculationFailed: (reason: string): QiError =>
    create('TOKEN_CALCULATION_FAILED', `Token calculation failed`, 'BUSINESS', { reason }),

  scoringFailed: (reason: string): QiError =>
    create('SCORING_FAILED', `Context scoring failed`, 'BUSINESS', { reason }),
};

/**
 * Represents a scored section of context
 */
interface ContextSection {
  content: string;
  score: number;
  tokens: number;
  timestamp?: Date;
  type: 'text' | 'code' | 'qa' | 'error' | 'structured';
}

/**
 * Context optimization configuration
 */
interface OptimizationConfig {
  maxTokensDefault: number;
  tokenRatio: number; // characters per token approximation
  minSectionLength: number;
  recencyWeight: number;
  codeWeight: number;
  qaWeight: number;
  errorWeight: number;
  structuredWeight: number;
}

/**
 * Context optimizer for managing large contexts and token limits
 */
export class ContextOptimizer {
  private readonly config: OptimizationConfig;

  constructor(config: Partial<OptimizationConfig> = {}) {
    this.config = {
      maxTokensDefault: 16000,
      tokenRatio: 4, // 1 token ≈ 4 characters
      minSectionLength: 50,
      recencyWeight: 0.3,
      codeWeight: 0.4,
      qaWeight: 0.3,
      errorWeight: 0.2,
      structuredWeight: 0.25,
      ...config,
    };
  }

  /**
   * Optimize context to fit within token limits while preserving important content
   */
  async optimizeContext(
    context: string,
    maxTokens: number = this.config.maxTokensDefault
  ): Promise<Result<string>> {
    return fromAsyncTryCatch(
      async () => {
        // Input validation
        if (!context || typeof context !== 'string') {
          throw new Error('Context must be a non-empty string');
        }

        if (maxTokens <= 0) {
          throw new Error('maxTokens must be positive');
        }

        const currentTokens = this.calculateTokenCount(context);

        // Return original if already within limits
        if (currentTokens <= maxTokens) {
          return context;
        }

        // Split context into sections
        const sections = this.splitIntoSections(context);

        // Score each section
        const scoredSections: ContextSection[] = sections.map((section) => ({
          content: section,
          score: this.scoreSection(section),
          tokens: this.calculateTokenCount(section),
          type: this.classifySection(section),
        }));

        // Sort by score (highest first)
        scoredSections.sort((a, b) => b.score - a.score);

        // Build optimized context within token limit
        return this.buildOptimizedContext(scoredSections, maxTokens);
      },
      (error: unknown) => optimizerError.optimizationFailed(String(error))
    );
  }

  /**
   * Calculate token count using character approximation
   */
  calculateTokenCount(text: string): number {
    if (!text || typeof text !== 'string') {
      return 0;
    }

    // Simple approximation: 1 token ≈ 4 characters
    // Add slight buffer for safety
    return Math.ceil((text.length / this.config.tokenRatio) * 1.1);
  }

  /**
   * Score relevance of text based on query (simple keyword matching for now)
   */
  scoreRelevance(text: string, query: string): number {
    if (!text || !query) {
      return 0;
    }

    const textLower = text.toLowerCase();
    const queryWords = query.toLowerCase().split(/\s+/);

    let relevanceScore = 0;

    for (const word of queryWords) {
      if (word.length < 3) continue; // Skip short words

      const occurrences = (textLower.match(new RegExp(word, 'g')) || []).length;
      relevanceScore += occurrences * (word.length / 10); // Longer words weighted more
    }

    // Normalize score to 0-1 range
    return Math.min(relevanceScore / queryWords.length, 1);
  }

  /**
   * Prune old context content based on timestamp
   */
  async pruneOldContext(context: string, maxAge: number): Promise<Result<string>> {
    return fromAsyncTryCatch(
      async () => {
        if (!context || typeof context !== 'string') {
          throw new Error('Context must be a non-empty string');
        }

        if (maxAge <= 0) {
          throw new Error('maxAge must be positive (in milliseconds)');
        }

        const cutoffTime = new Date(Date.now() - maxAge);
        const sections = this.splitIntoSections(context);

        const recentSections = sections.filter((section) => {
          const timestamp = this.extractTimestamp(section);
          return !timestamp || timestamp > cutoffTime;
        });

        return recentSections.join('\n\n');
      },
      (error: unknown) => optimizerError.optimizationFailed(String(error))
    );
  }

  /**
   * Split context into logical sections for scoring
   */
  private splitIntoSections(context: string): string[] {
    // First try to split on timestamp patterns for log-like content
    // Match full ISO timestamps including milliseconds and timezone
    const timestampPattern = /(?=\[[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}:[0-9]{2}[^\]]*\])/;
    let sections = context.split(timestampPattern).filter((s) => s.trim());

    // If no timestamp splitting occurred, fall back to paragraph splitting
    if (sections.length === 1) {
      sections = context.split(/\n\s*\n/);
    }

    // Further split very long sections
    const maxSectionLength = 1000;
    const refinedSections: string[] = [];

    for (const section of sections) {
      if (section.length <= maxSectionLength) {
        if (section.trim().length >= this.config.minSectionLength) {
          refinedSections.push(section.trim());
        }
      } else {
        // Split long sections on sentence boundaries
        const sentences = section.split(/[.!?]\s+/);
        let currentSection = '';

        for (const sentence of sentences) {
          if ((currentSection + sentence).length > maxSectionLength && currentSection) {
            if (currentSection.trim().length >= this.config.minSectionLength) {
              refinedSections.push(currentSection.trim());
            }
            currentSection = sentence;
          } else {
            currentSection += (currentSection ? '. ' : '') + sentence;
          }
        }

        if (currentSection.trim().length >= this.config.minSectionLength) {
          refinedSections.push(currentSection.trim());
        }
      }
    }

    return refinedSections.filter((section) => section.length > 0);
  }

  /**
   * Score a section based on various criteria
   */
  private scoreSection(section: string): number {
    let score = 0.1; // Base score

    // Recency bonus (assuming later sections are more recent)
    score += this.config.recencyWeight;

    // Length penalty for very short sections
    if (section.length < this.config.minSectionLength) {
      score -= 0.2;
    }

    // Content type bonuses
    if (this.hasCodeOrStructure(section)) {
      score += this.config.codeWeight;
    }

    if (this.hasQAPattern(section)) {
      score += this.config.qaWeight;
    }

    if (this.hasErrorContent(section)) {
      score += this.config.errorWeight;
    }

    if (this.hasStructuredContent(section)) {
      score += this.config.structuredWeight;
    }

    // Penalize repetitive content
    if (this.isRepetitive(section)) {
      score -= 0.3;
    }

    return Math.max(0, score);
  }

  /**
   * Classify section type for better optimization
   */
  private classifySection(section: string): ContextSection['type'] {
    if (this.hasCodeOrStructure(section)) return 'code';
    if (this.hasQAPattern(section)) return 'qa';
    if (this.hasErrorContent(section)) return 'error';
    if (this.hasStructuredContent(section)) return 'structured';
    return 'text';
  }

  /**
   * Check if section contains code or structured content
   */
  private hasCodeOrStructure(text: string): boolean {
    return /```|`[^`]+`|function|class|import|export|const|let|var|\{|\[|<\/|->|=>/.test(text);
  }

  /**
   * Check if section contains Q&A patterns
   */
  private hasQAPattern(text: string): boolean {
    return /\?|Q:|A:|Question:|Answer:|How to|What is|Why|When|Where/.test(text);
  }

  /**
   * Check if section contains error or warning content
   */
  private hasErrorContent(text: string): boolean {
    return /error|warning|exception|failed|issue|problem|bug|fix/.test(text.toLowerCase());
  }

  /**
   * Check if section contains structured data
   */
  private hasStructuredContent(text: string): boolean {
    return /^\s*[-*+]\s|^\s*\d+\.\s|^\s*#{1,6}\s|^\|.*\||^\s*\w+:\s/m.test(text);
  }

  /**
   * Check if section is repetitive content
   */
  private isRepetitive(text: string): boolean {
    const words = text.toLowerCase().split(/\s+/);
    if (words.length < 10) return false;

    const wordCounts = new Map<string, number>();
    for (const word of words) {
      if (word.length > 3) {
        wordCounts.set(word, (wordCounts.get(word) || 0) + 1);
      }
    }

    // Check for high repetition ratio
    const totalWords = words.filter((w) => w.length > 3).length;
    const repeatedWords = Array.from(wordCounts.values()).reduce(
      (sum, count) => sum + (count > 2 ? count : 0),
      0
    );

    return repeatedWords / totalWords > 0.6;
  }

  /**
   * Build optimized context from scored sections within token limit
   */
  private buildOptimizedContext(sections: ContextSection[], maxTokens: number): string {
    const selectedSections: ContextSection[] = [];
    let tokenCount = 0;

    // Leave a small buffer to ensure we don't exceed the limit due to approximation errors
    const effectiveMaxTokens = Math.floor(maxTokens * 0.95);

    // Always prioritize the most important sections
    for (const section of sections) {
      if (tokenCount + section.tokens <= effectiveMaxTokens) {
        selectedSections.push(section);
        tokenCount += section.tokens;
      } else {
        // Try to fit partial content if remaining space is significant
        const remainingTokens = effectiveMaxTokens - tokenCount;
        if (remainingTokens > 100) {
          // Only if we have meaningful space left
          const partialContent = this.truncateToTokens(section.content, remainingTokens);
          if (partialContent.length > this.config.minSectionLength) {
            const partialTokens = this.calculateTokenCount(partialContent);
            selectedSections.push({
              ...section,
              content: `${partialContent}...`,
              tokens: partialTokens,
            });
            tokenCount += partialTokens;
            break;
          }
        }
      }
    }

    // Sort selected sections back to original order for coherence
    // Note: This is a simplified approach; could be improved with better ordering
    return selectedSections.map((section) => section.content).join('\n\n');
  }

  /**
   * Truncate content to approximately fit within token count
   */
  private truncateToTokens(content: string, maxTokens: number): string {
    const maxChars = maxTokens * this.config.tokenRatio;
    if (content.length <= maxChars) {
      return content;
    }

    // Try to break at sentence boundary
    const truncated = content.substring(0, maxChars);
    const lastSentence = truncated.lastIndexOf('.');
    const lastNewline = truncated.lastIndexOf('\n');

    const breakPoint = Math.max(lastSentence, lastNewline);
    if (breakPoint > maxChars * 0.7) {
      // If we can keep at least 70% content
      return content.substring(0, breakPoint + 1);
    }

    return truncated;
  }

  /**
   * Extract timestamp from section content (simple heuristic)
   */
  private extractTimestamp(section: string): Date | null {
    // Look for bracketed full ISO timestamp patterns [2025-08-17T15:23:12.300Z]
    const bracketedFullIsoMatch = section.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}[^\]]*)\]/);
    if (bracketedFullIsoMatch) {
      return new Date(bracketedFullIsoMatch[1]);
    }

    // Look for bracketed basic ISO timestamp patterns [2024-08-22T15:30:00]
    const bracketedIsoMatch = section.match(/\[(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\]/);
    if (bracketedIsoMatch) {
      return new Date(bracketedIsoMatch[1]);
    }

    // Look for ISO timestamp patterns
    const isoMatch = section.match(/\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    if (isoMatch) {
      return new Date(isoMatch[0]);
    }

    // Look for other common timestamp patterns
    const dateMatch = section.match(/\d{4}-\d{2}-\d{2}/);
    if (dateMatch) {
      return new Date(dateMatch[0]);
    }

    return null;
  }
}
