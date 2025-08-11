// Rule-Based Classification Method
//
// Fast pattern-matching classification using regex and keyword analysis
// Low accuracy (~8-9%) but very fast (~8-180ms) - good for fallback
// Internal layer implementation - uses proper QiCore Result<T> patterns

import {
  type ErrorCategory,
  failure,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '@qi/base';
import type {
  ClassificationMethod,
  ClassificationResult,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';
import {
  createRuleBasedError,
  type RuleBasedClassificationErrorContext,
} from '../shared/error-types.js';

/**
 * Custom error factory for rule-based classification errors using standardized error types
 */
const createRuleBasedClassificationError = (
  code: string,
  message: string,
  category: ErrorCategory,
  context: Partial<RuleBasedClassificationErrorContext> = {}
): QiError => createRuleBasedError(code, message, category, context);

export class RuleBasedClassificationMethod implements IClassificationMethod {
  private config: RuleBasedConfig;

  // Performance tracking
  private totalClassifications = 0;
  private totalLatencyMs = 0;
  private successfulClassifications = 0;
  private performanceHistory: { latency: number; success: boolean; timestamp: number }[] = [];

  constructor(config: Partial<RuleBasedConfig> = {}) {
    this.config = {
      commandPrefix: config.commandPrefix || '/',
      promptIndicators: config.promptIndicators || [
        'hi',
        'hello',
        'thanks',
        'what',
        'how',
        'why',
        'when',
        'can you',
        'could you',
        'please',
        'explain',
      ],
      workflowIndicators: config.workflowIndicators || [
        'fix',
        'create',
        'refactor',
        'implement',
        'debug',
        'analyze',
        'build',
        'design',
        'test',
        'deploy',
        'find',
        'search',
        'book',
        'reserve',
        'schedule',
        'add',
        'remove',
        'delete',
        'update',
        'change',
        'set',
        'configure',
        'install',
        'setup',
      ],
      confidenceThresholds:
        config.confidenceThresholds ||
        new Map([
          ['command', 1.0],
          ['prompt', 0.8],
          ['workflow', 0.7],
        ]),
    };
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    // Use proper fromAsyncTryCatch for exception boundary like LangChain classifier
    const classificationResult = await fromAsyncTryCatch(
      async () => {
        return await this.classifyInternal(input, context);
      },
      (error: unknown) =>
        createRuleBasedClassificationError(
          'RULE_CLASSIFICATION_FAILED',
          `Rule-based classification failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          { error: String(error), method: 'rule-based' }
        )
    );

    // Convert Result<T> to ClassificationResult for interface layer
    return match(
      (result: ClassificationResult) => result,
      (error) => {
        throw new Error(`RuleBased classification failed: ${error.message}`);
      },
      classificationResult
    );
  }

  private async classifyInternal(
    input: string,
    context?: ProcessingContext
  ): Promise<ClassificationResult> {
    const startTime = Date.now();

    // Use flatMap chains for proper error propagation
    const validationResult = this.validateInputInternal(input);

    return match(
      (validatedInput: string) => {
        const trimmedInput = validatedInput.trim();

        // Stage 1: Command Detection with QiCore patterns
        const commandResult = this.detectCommandInternal(trimmedInput, startTime);
        if (commandResult) {
          return commandResult;
        }

        // Stage 2: Prompt vs Workflow Analysis
        const complexityAnalysis = this.analyzeComplexity(trimmedInput, context);

        if (complexityAnalysis.isSimplePrompt) {
          return this.createPromptResult(complexityAnalysis, startTime);
        }

        return this.createWorkflowResult(complexityAnalysis, startTime);
      },
      (error) => {
        throw new Error(error.message);
      },
      validationResult
    );
  }

  private validateInputInternal(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return failure(
        createRuleBasedClassificationError(
          'INVALID_INPUT',
          'Input must be a non-empty string',
          'VALIDATION',
          { input: String(input), operation: 'validation' }
        )
      );
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return failure(
        createRuleBasedClassificationError(
          'EMPTY_INPUT',
          'Input cannot be empty or only whitespace',
          'VALIDATION',
          { input, operation: 'validation' }
        )
      );
    }

    // TODO: Refactor to use ValidatedConfig API instead of hardcoded limit
    // For now, use same limit as config default (100,000)
    if (trimmed.length > 100000) {
      return failure(
        createRuleBasedClassificationError(
          'INPUT_TOO_LONG',
          'Input exceeds maximum length of 100,000 characters',
          'VALIDATION',
          { length: trimmed.length, operation: 'validation' }
        )
      );
    }

    return success(trimmed);
  }

  private detectCommandInternal(
    trimmedInput: string,
    startTime: number
  ): ClassificationResult | null {
    // TRUE 3-WAY CLASSIFICATION: Check commands as part of classification, not shortcut
    if (trimmedInput.startsWith(this.config.commandPrefix)) {
      return {
        type: 'command',
        confidence: 1.0,
        method: 'rule-based',
        reasoning: `Command detected with prefix "${this.config.commandPrefix}"`,
        extractedData: new Map([
          ['commandPrefix', this.config.commandPrefix],
          ['command', trimmedInput],
        ]),
        metadata: new Map([
          ['method', 'rule-based-command-detection'],
          ['latency', (Date.now() - startTime).toString()],
        ]),
      };
    }
    return null;
  }

  private createPromptResult(
    complexityAnalysis: ComplexityAnalysis,
    startTime: number
  ): ClassificationResult {
    const latency = this.trackPerformance(startTime, true);

    return {
      type: 'prompt',
      confidence: complexityAnalysis.confidence,
      method: 'rule-based',
      reasoning: `Simple prompt detected: ${complexityAnalysis.reasoning}`,
      extractedData: new Map([
        ['promptType', complexityAnalysis.promptType],
        ['indicators', JSON.stringify(complexityAnalysis.promptIndicators)],
      ]),
      metadata: new Map([
        ['method', 'complexity-analysis'],
        ['analysis', JSON.stringify(complexityAnalysis)],
        ['latency', latency.toString()],
        ['performance_tracked', 'true'],
      ]),
    };
  }

  private createWorkflowResult(
    complexityAnalysis: ComplexityAnalysis,
    startTime: number
  ): ClassificationResult {
    const latency = this.trackPerformance(startTime, true);

    return {
      type: 'workflow',
      confidence: complexityAnalysis.confidence,
      method: 'rule-based',
      reasoning: `Complex workflow detected: ${complexityAnalysis.reasoning}`,
      extractedData: new Map([
        ['workflowIndicators', JSON.stringify(complexityAnalysis.workflowIndicators)],
        ['complexity', complexityAnalysis.estimatedComplexity],
      ]),
      metadata: new Map([
        ['method', 'complexity-analysis'],
        ['analysis', JSON.stringify(complexityAnalysis)],
        ['latency', latency.toString()],
        ['performance_tracked', 'true'],
      ]),
    };
  }

  /**
   * Track performance metrics for classification
   */
  private trackPerformance(startTime: number, success: boolean): number {
    const latency = Date.now() - startTime;

    this.totalClassifications++;
    this.totalLatencyMs += latency;

    if (success) {
      this.successfulClassifications++;
    }

    // Keep recent history (last 100 classifications)
    this.performanceHistory.push({
      latency,
      success,
      timestamp: Date.now(),
    });

    if (this.performanceHistory.length > 100) {
      this.performanceHistory.shift();
    }

    return latency;
  }

  getMethodName(): ClassificationMethod {
    return 'rule-based';
  }

  getExpectedAccuracy(): number {
    if (this.totalClassifications === 0) {
      return 0.85; // Default estimate for rule-based methods
    }
    return this.successfulClassifications / this.totalClassifications;
  }

  getAverageLatency(): number {
    if (this.totalClassifications === 0) {
      return 50; // Default estimate
    }
    return Math.round(this.totalLatencyMs / this.totalClassifications);
  }

  async isAvailable(): Promise<boolean> {
    return true; // Rule-based method is always available
  }

  private analyzeComplexity(input: string, _context?: ProcessingContext): ComplexityAnalysis {
    const lowerInput = input.toLowerCase();
    const indicators = this.extractComplexityIndicators(input);

    // Simple prompt detection
    if (this.isSimplePrompt(lowerInput, indicators)) {
      return {
        isSimplePrompt: true,
        confidence: this.calculatePromptConfidence(input, indicators),
        promptType: this.classifyPromptType(lowerInput),
        reasoning: 'Detected greeting, question, or conversational marker',
        promptIndicators: indicators.promptSignals,
        workflowIndicators: [],
        estimatedComplexity: 'low',
      };
    }

    // Workflow detection
    return {
      isSimplePrompt: false,
      confidence: this.calculateWorkflowConfidence(input, indicators),
      promptType: 'none',
      reasoning: 'Detected action verbs, file references, or multi-step indicators',
      promptIndicators: [],
      workflowIndicators: indicators.workflowSignals,
      estimatedComplexity: this.estimateComplexity(indicators),
    };
  }

  private isSimplePrompt(input: string, indicators: ComplexityIndicators): boolean {
    // Strong prompt indicators (high confidence)
    const hasStrongPromptSignals = indicators.promptSignals.length >= 2;
    const isShortQuestion = indicators.questionWords.length > 0 && input.length < 30;
    const isConversational = /^(hi|hello|hey|thanks|thank you|ok|yes|no|sure)\b/i.test(
      input.trim()
    );

    if (hasStrongPromptSignals || isShortQuestion || isConversational) {
      return true;
    }

    // Check for workflow characteristics
    const hasWorkflowSignals = indicators.workflowSignals.length > 0;
    const hasFileReferences = indicators.fileReferences.length > 0;
    const hasTechnicalTerms = indicators.technicalTerms.length > 0;
    const hasMultiStep = indicators.multiStepIndicators.length > 0;
    const isTaskOriented =
      /\b(find|search|book|reserve|get|show|list|add|remove|delete|update|change|set)\b/i.test(
        input
      );
    const isRequest = /\b(please|can you|could you|would you|i want|i need|help me)\b/i.test(input);

    // If it has workflow characteristics, it's likely a workflow
    if (
      hasWorkflowSignals ||
      hasFileReferences ||
      hasTechnicalTerms ||
      hasMultiStep ||
      (isTaskOriented && isRequest)
    ) {
      return false; // Not a simple prompt, likely a workflow
    }

    // Default to prompt for short, simple inputs
    if (input.length < 20) {
      return true;
    }

    return false;
  }

  private extractComplexityIndicators(input: string): ComplexityIndicators {
    const lowerInput = input.toLowerCase();

    return {
      promptSignals: this.findMatches(lowerInput, this.config.promptIndicators),
      workflowSignals: this.findMatches(lowerInput, this.config.workflowIndicators),
      questionWords: this.findMatches(lowerInput, ['what', 'how', 'why', 'when', 'where', 'who']),
      fileReferences: this.findFileReferences(input),
      technicalTerms: this.findMatches(lowerInput, [
        'function',
        'class',
        'api',
        'database',
        'server',
        'test',
      ]),
      multiStepIndicators: this.findMatches(lowerInput, ['then', 'after', 'and', 'also', 'next']),
    };
  }

  private findMatches(text: string, patterns: readonly string[]): string[] {
    return patterns.filter((pattern) => text.includes(pattern));
  }

  private findFileReferences(input: string): string[] {
    const matches = input.match(/\b\w+\.\w+\b/g) || [];
    return matches.filter((match) => /\.(js|ts|py|java|cpp|html|css|json|yaml|md)$/i.test(match));
  }

  private calculatePromptConfidence(_input: string, indicators: ComplexityIndicators): number {
    let confidence = 0.5;

    // Boost for prompt signals
    confidence += indicators.promptSignals.length * 0.2;
    confidence += indicators.questionWords.length * 0.15;

    // Reduce for workflow signals
    confidence -= indicators.workflowSignals.length * 0.15;
    confidence -= indicators.fileReferences.length * 0.2;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private calculateWorkflowConfidence(_input: string, indicators: ComplexityIndicators): number {
    let confidence = 0.5;

    // Boost for workflow signals
    confidence += indicators.workflowSignals.length * 0.2;
    confidence += indicators.fileReferences.length * 0.25;
    confidence += indicators.multiStepIndicators.length * 0.1;

    // Reduce for prompt signals
    confidence -= indicators.promptSignals.length * 0.2;

    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private classifyPromptType(input: string): string {
    if (
      this.config.promptIndicators.some(
        (indicator) => ['hi', 'hello', 'thanks'].includes(indicator) && input.includes(indicator)
      )
    ) {
      return 'greeting';
    }
    if (input.includes('what') || input.includes('how') || input.includes('why')) {
      return 'question';
    }
    return 'general';
  }

  private estimateComplexity(indicators: ComplexityIndicators): string {
    const signals =
      indicators.workflowSignals.length +
      indicators.fileReferences.length +
      indicators.multiStepIndicators.length;
    if (signals > 3) return 'high';
    if (signals > 1) return 'medium';
    return 'low';
  }
}

interface ComplexityIndicators {
  promptSignals: string[];
  workflowSignals: string[];
  questionWords: string[];
  fileReferences: string[];
  technicalTerms: string[];
  multiStepIndicators: string[];
}

interface ComplexityAnalysis {
  isSimplePrompt: boolean;
  confidence: number;
  promptType: string;
  reasoning: string;
  promptIndicators: string[];
  workflowIndicators: string[];
  estimatedComplexity: string;
}

export interface RuleBasedConfig {
  commandPrefix: string;
  promptIndicators: readonly string[];
  workflowIndicators: readonly string[];
  confidenceThresholds: ReadonlyMap<string, number>;
}
