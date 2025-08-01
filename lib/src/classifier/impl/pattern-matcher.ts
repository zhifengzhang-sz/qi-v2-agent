// Pattern Matcher Implementation
//
// Implements IPatternMatcher with multi-signal detection and LLM fallback
// Replaces keyword-based matching with sophisticated weighted analysis

import { PromptTemplate } from '@langchain/core/prompts';
import { ChatOllama } from '@langchain/ollama';
import type { ProcessingContext } from '../abstractions/index.js';

// Pattern matcher interfaces (lib layer compatible)
export interface IPatternMatcher {
  detectPattern(input: string, context?: ProcessingContext): Promise<PatternDetectionResult>;
  getAvailablePatterns(): readonly CognitivePattern[];
  updatePatternConfiguration(patterns: readonly CognitivePattern[]): void;
}

export interface CognitivePattern {
  name: string;
  description: string;
  abstractKeywords: string[];
  contextWeight: number;
}

export interface PatternDetectionResult {
  pattern: CognitivePattern;
  confidence: number;
  detectionMethod: string;
  metadata: Map<string, unknown>;
}

export class MultiSignalPatternMatcher implements IPatternMatcher {
  private patterns: readonly CognitivePattern[];
  private fallbackLLM?: ChatOllama;
  private fallbackPrompt?: PromptTemplate;
  private confidenceThreshold: number;
  private cache = new Map<string, PatternDetectionResult>();
  private signalMappings: SignalMappingConfig;

  constructor(config: MultiSignalPatternMatcherConfig) {
    this.patterns = config.patterns;
    this.confidenceThreshold = config.confidenceThreshold;
    this.signalMappings = config.signalMappings || this.getDefaultSignalMappings();

    if (config.enableLLMFallback) {
      this.initializeFallbackLLM(config);
    }
  }

  async detectPattern(input: string, context?: ProcessingContext): Promise<PatternDetectionResult> {
    const startTime = Date.now();

    // Check cache first
    const cacheKey = this.createCacheKey(input, context);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return cached;
    }

    // Multi-signal detection (primary method)
    const multiSignalResult = await this.multiSignalDetection(input, context);

    // High confidence - use multi-signal result
    if (multiSignalResult.confidence > this.confidenceThreshold) {
      const result = {
        ...multiSignalResult,
        metadata: new Map<string, unknown>([
          ['detectionTime', Date.now() - startTime],
          ['cacheHit', false],
        ]),
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // Low confidence - try LLM fallback
    if (this.fallbackLLM && multiSignalResult.confidence < 0.5) {
      const llmResult = await this.llmBasedDetection(input, context);
      const result = {
        ...llmResult,
        metadata: new Map<string, unknown>([
          ['detectionTime', Date.now() - startTime],
          ['multiSignalConfidence', multiSignalResult.confidence],
          ['cacheHit', false],
        ]),
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // Medium confidence - use multi-signal with lower confidence
    const result = {
      ...multiSignalResult,
      metadata: new Map<string, unknown>([
        ['detectionTime', Date.now() - startTime],
        ['lowConfidence', true],
        ['cacheHit', false],
      ]),
    };
    this.cache.set(cacheKey, result);
    return result;
  }

  getAvailablePatterns(): readonly CognitivePattern[] {
    return this.patterns;
  }

  updatePatternConfiguration(patterns: readonly CognitivePattern[]): void {
    this.patterns = patterns;
    this.cache.clear(); // Clear cache when patterns change
  }

  private async multiSignalDetection(
    input: string,
    context?: ProcessingContext
  ): Promise<PatternDetectionResult> {
    const scores = this.patterns.map((pattern) => ({
      pattern,
      score: this.calculateMultiSignalScore(input, pattern, context),
      signals: this.extractSignals(input, pattern, context),
    }));

    const bestMatch = scores.reduce((best, current) =>
      current.score > best.score ? current : best
    );

    return {
      pattern: bestMatch.pattern,
      confidence: bestMatch.score,
      detectionMethod: 'rule-based',
      metadata: new Map<string, unknown>([
        ['allScores', scores.map((s) => [s.pattern.name, s.score])],
        ['signals', bestMatch.signals],
        ['method', 'multi-signal-analysis'],
      ]),
    };
  }

  private calculateMultiSignalScore(
    input: string,
    pattern: CognitivePattern,
    context?: ProcessingContext
  ): number {
    let score = 0;
    const lowerInput = input.toLowerCase();

    // Signal 1: Tool mention signals (Weight: 0.9)
    const toolSignalScore = this.calculateToolSignalScore(lowerInput, pattern);
    score += toolSignalScore * 0.9;

    // Signal 2: Action verb signals (Weight: 0.8)
    const actionVerbScore = this.calculateActionVerbScore(lowerInput, pattern);
    score += actionVerbScore * 0.8;

    // Signal 3: Error indicators (Weight: 0.9)
    const errorIndicatorScore = this.calculateErrorIndicatorScore(lowerInput, pattern);
    score += errorIndicatorScore * 0.9;

    // Signal 4: Context continuation (Weight: 0.4)
    const contextScore = this.calculateContextScore(context, pattern);
    score += contextScore * 0.4;

    // Signal 5: Abstract keyword matching (Weight: 0.6)
    const keywordScore = this.calculateKeywordScore(lowerInput, pattern);
    score += keywordScore * 0.6;

    // Normalize to 0-1 range
    return Math.min(score / 4.0, 1.0);
  }

  private calculateToolSignalScore(input: string, pattern: CognitivePattern): number {
    const signals = this.signalMappings.toolSignals.get(pattern.name) || [];
    const matches = signals.filter((signal) => input.includes(signal)).length;
    return signals.length > 0 ? matches / signals.length : 0;
  }

  private calculateActionVerbScore(input: string, pattern: CognitivePattern): number {
    const verbs = this.signalMappings.actionVerbs.get(pattern.name) || [];
    const matches = verbs.filter((verb) => input.includes(verb)).length;
    return verbs.length > 0 ? matches / verbs.length : 0;
  }

  private calculateErrorIndicatorScore(input: string, pattern: CognitivePattern): number {
    if (pattern.name !== 'problem-solving') return 0;

    const errorIndicators = this.signalMappings.errorIndicators || [];
    const matches = errorIndicators.filter((indicator) => input.includes(indicator)).length;
    return matches > 0 ? Math.min(matches / 3, 1.0) : 0; // Cap at 1.0, boost for multiple error terms
  }

  private calculateContextScore(
    context: ProcessingContext | undefined,
    pattern: CognitivePattern
  ): number {
    if (!context || !context.previousInputs || context.previousInputs.length === 0) return 0;

    // Use first previous input as context indicator
    const lastInput = context.previousInputs[context.previousInputs.length - 1];
    if (!lastInput) return 0;

    // Simple context scoring based on input similarity
    return lastInput.includes(pattern.name.toLowerCase()) ? pattern.contextWeight : 0.1;
  }

  private calculateKeywordScore(input: string, pattern: CognitivePattern): number {
    const matches = pattern.abstractKeywords.filter((keyword: string) =>
      input.includes(keyword)
    ).length;
    return pattern.abstractKeywords.length > 0 ? matches / pattern.abstractKeywords.length : 0;
  }

  private extractSignals(
    input: string,
    pattern: CognitivePattern,
    context?: ProcessingContext
  ): string[] {
    const signals: string[] = [];

    // Extract tool signals
    const toolSignals = this.extractToolSignals(input, pattern);
    signals.push(...toolSignals);

    // Extract action verb signals
    const actionSignals = this.extractActionSignals(input, pattern);
    signals.push(...actionSignals);

    // Extract error signals for problem-solving
    if (pattern.name === 'problem-solving') {
      const errorSignals = this.extractErrorSignals(input);
      signals.push(...errorSignals);
    }

    // Extract context signals
    if (context?.previousInputs && context.previousInputs.length > 0) {
      signals.push(`context:${context.previousInputs[context.previousInputs.length - 1]}`);
    }

    return signals;
  }

  private extractToolSignals(input: string, pattern: CognitivePattern): string[] {
    const signals: string[] = [];

    // File extensions suggest coding/debugging
    if (pattern.name === 'creative' || pattern.name === 'problem-solving') {
      const fileExtensions = ['.js', '.ts', '.py', '.java', '.cpp', '.html', '.css'];
      for (const ext of fileExtensions) {
        if (input.includes(ext)) {
          signals.push(`file-extension:${ext}`);
        }
      }
    }

    return signals;
  }

  private extractActionSignals(input: string, pattern: CognitivePattern): string[] {
    const signals: string[] = [];

    for (const keyword of pattern.abstractKeywords) {
      if (input.toLowerCase().includes(keyword)) {
        signals.push(`action:${keyword}`);
      }
    }

    return signals;
  }

  private extractErrorSignals(input: string): string[] {
    const errorTerms = ['error', 'exception', 'bug', 'crash', 'undefined', 'null'];
    return errorTerms
      .filter((term) => input.toLowerCase().includes(term))
      .map((term) => `error:${term}`);
  }

  private async llmBasedDetection(
    input: string,
    context?: ProcessingContext
  ): Promise<PatternDetectionResult> {
    if (!this.fallbackLLM || !this.fallbackPrompt) {
      // Fallback to best multi-signal match
      return this.multiSignalDetection(input, context);
    }

    try {
      const prompt = await this.fallbackPrompt.format({
        input,
        patterns: this.patterns.map((p) => `${p.name}: ${p.description}`).join('\n'),
        context: context
          ? JSON.stringify(Object.fromEntries(context.environmentContext || []))
          : 'none',
      });

      const response = await this.fallbackLLM.invoke(prompt);
      const content = response.content.toString().toLowerCase();

      // Parse LLM response to extract pattern and confidence
      const detectedPattern = this.patterns.find((p) => content.includes(p.name.toLowerCase()));

      if (detectedPattern) {
        // Extract confidence from response if available
        const confidenceMatch = content.match(/confidence[:\s]*(\d+(?:\.\d+)?)/i);
        const confidence = confidenceMatch ? Math.min(parseFloat(confidenceMatch[1]), 1.0) : 0.7;

        return {
          pattern: detectedPattern,
          confidence,
          detectionMethod: 'llm-based',
          metadata: new Map([
            ['llmResponse', content],
            ['model', this.fallbackLLM.model],
          ]),
        };
      }

      // Fallback to conversational pattern if LLM can't decide
      const conversationalPattern = this.patterns.find((p) => p.name === 'conversational');
      if (conversationalPattern) {
        return {
          pattern: conversationalPattern,
          confidence: 0.5,
          detectionMethod: 'llm-based',
          metadata: new Map([['fallbackReason', 'no-clear-pattern-detected']]),
        };
      }
    } catch (error) {
      console.warn('LLM-based detection failed:', error);
    }

    // Final fallback to multi-signal
    return this.multiSignalDetection(input, context);
  }

  private initializeFallbackLLM(config: MultiSignalPatternMatcherConfig): void {
    this.fallbackLLM = new ChatOllama({
      baseUrl: config.llmEndpoint || 'http://localhost:11434',
      model: config.fallbackModel || 'qwen2.5:7b',
      temperature: 0.1, // Low temperature for consistent classification
      numCtx: 2048,
    });

    this.fallbackPrompt = PromptTemplate.fromTemplate(`
You are an intent classifier for an AI assistant. Analyze the user's input and classify it into one of these cognitive patterns:

Available Patterns:
{patterns}

User Input: {input}
Context: {context}

Respond with the pattern name and confidence level (0-1).
Format: "Pattern: [pattern_name], Confidence: [0.0-1.0]"

If uncertain, choose the most likely pattern and provide your confidence level.
    `);
  }

  private createCacheKey(input: string, context?: ProcessingContext): string {
    const contextKey = context?.sessionId || 'none';
    return `${input.slice(0, 100)}:${contextKey}`;
  }

  private getDefaultSignalMappings(): SignalMappingConfig {
    return {
      toolSignals: new Map([
        ['analytical', ['plan', 'architecture', 'approach', 'strategy', 'design']],
        ['creative', ['create', 'build', 'generate', 'implement', 'develop']],
        ['problem-solving', ['fix', 'debug', 'error', 'bug', 'solve', 'troubleshoot']],
        ['informational', ['explain', 'what', 'how', 'why', 'help', 'documentation']],
        ['conversational', []],
      ]),
      actionVerbs: new Map([
        ['analytical', ['analyze', 'review', 'examine', 'assess', 'evaluate', 'plan']],
        ['creative', ['create', 'build', 'generate', 'design', 'develop', 'implement']],
        ['problem-solving', ['fix', 'solve', 'resolve', 'debug', 'troubleshoot', 'repair']],
        ['informational', ['explain', 'describe', 'teach', 'show', 'help', 'clarify']],
        ['conversational', ['chat', 'discuss', 'talk', 'converse']],
      ]),
      errorIndicators: [
        'error',
        'exception',
        'bug',
        'crash',
        'fail',
        'broken',
        'undefined',
        'null',
        'stack trace',
        'timeout',
        '404',
        '500',
      ],
    };
  }
}

export interface MultiSignalPatternMatcherConfig {
  patterns: readonly CognitivePattern[];
  confidenceThreshold: number;
  enableLLMFallback: boolean;
  llmEndpoint?: string;
  fallbackModel?: string;
  signalMappings?: SignalMappingConfig;
}

export interface SignalMappingConfig {
  toolSignals: Map<string, string[]>;
  actionVerbs: Map<string, string[]>;
  errorIndicators: string[];
}
