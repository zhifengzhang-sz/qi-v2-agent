// Multi-Method Input Classifier
//
// Implements multiple classification methods with configurable selection
// Provides optimal balance of speed, accuracy, and reliability

import type {
  IInputClassifier,
  IClassificationMethod,
  InputClassificationResult,
  ClassificationMethod,
  ClassificationConfig,
  ProcessingContext
} from '../../core/interfaces.js';

import { RuleBasedClassificationMethod } from './rule-based-classification-method.js';
import { LLMClassificationMethod } from './llm-classification-method.js';
import { HybridClassificationMethod } from './hybrid-classification-method.js';
import { EnsembleClassificationMethod } from './ensemble-classification-method.js';

export class MultiMethodInputClassifier implements IInputClassifier {
  private methods: Map<ClassificationMethod, IClassificationMethod> = new Map();
  private config: ClassificationConfig;

  constructor(config: Partial<ClassificationConfig> = {}) {
    this.config = {
      defaultMethod: config.defaultMethod || 'hybrid',
      fallbackMethod: config.fallbackMethod || 'rule-based',
      confidenceThreshold: config.confidenceThreshold || 0.8,
      ensembleForUncertain: config.ensembleForUncertain || false,
      commandPrefix: config.commandPrefix || '/',
      promptIndicators: config.promptIndicators || [
        'hi', 'hello', 'thanks', 'what', 'how', 'why', 'when', 
        'can you', 'could you', 'please', 'explain'
      ],
      workflowIndicators: config.workflowIndicators || [
        'fix', 'create', 'refactor', 'implement', 'debug', 'analyze', 
        'build', 'design', 'test', 'deploy'
      ],
      confidenceThresholds: config.confidenceThresholds || new Map([
        ['command', 1.0],
        ['prompt', 0.8],
        ['workflow', 0.7]
      ])
    };

    this.initializeMethods();
  }

  async classifyInput(
    input: string,
    method?: ClassificationMethod,
    context?: ProcessingContext
  ): Promise<InputClassificationResult> {
    const startTime = Date.now();
    const selectedMethod = method || this.config.defaultMethod;

    try {
      // Get the selected classification method
      const classifier = this.methods.get(selectedMethod);
      if (!classifier) {
        throw new Error(`Classification method '${selectedMethod}' not available`);
      }

      // Perform classification
      const result = await classifier.classify(input, context);

      // Check if we should escalate to ensemble for uncertain results
      if (this.shouldUseEnsemble(result, selectedMethod)) {
        const ensembleClassifier = this.methods.get('ensemble');
        if (ensembleClassifier) {
          const ensembleResult = await ensembleClassifier.classify(input, context);
          return {
            ...ensembleResult,
            metadata: new Map([
              ...ensembleResult.metadata,
              ['escalated_from', selectedMethod],
              ['original_confidence', result.confidence],
              ['total_latency', (Date.now() - startTime).toString()]
            ])
          };
        }
      }

      // Add timing metadata
      return {
        ...result,
        metadata: new Map([
          ...result.metadata,
          ['requested_method', selectedMethod],
          ['total_latency', (Date.now() - startTime).toString()]
        ])
      };

    } catch (error) {
      // Fallback to fallback method
      return await this.handleClassificationError(input, context, selectedMethod, error, startTime);
    }
  }

  getSupportedTypes(): readonly string[] {
    return ['command', 'prompt', 'workflow'];
  }

  getSupportedMethods(): readonly ClassificationMethod[] {
    return Array.from(this.methods.keys());
  }

  updateClassificationRules(config: ClassificationConfig): void {
    this.config = { ...this.config, ...config };
    // Reinitialize methods with new config
    this.initializeMethods();
  }

  // Method performance analytics
  async getMethodPerformance(): Promise<Map<ClassificationMethod, MethodPerformance>> {
    const performance = new Map<ClassificationMethod, MethodPerformance>();
    
    for (const [methodName, method] of this.methods) {
      performance.set(methodName, {
        expectedAccuracy: method.getExpectedAccuracy(),
        averageLatency: method.getAverageLatency(),
        methodName: method.getMethodName()
      });
    }
    
    return performance;
  }

  private initializeMethods(): void {
    this.methods = new Map();

    // Rule-based method (fast, low accuracy)
    this.methods.set('rule-based', new RuleBasedClassificationMethod({
      commandPrefix: this.config.commandPrefix,
      promptIndicators: this.config.promptIndicators,
      workflowIndicators: this.config.workflowIndicators,
      confidenceThresholds: this.config.confidenceThresholds
    }));

    // LLM-based method (accurate, slower)
    this.methods.set('llm-based', new LLMClassificationMethod({
      baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
      modelId: process.env.CLASSIFICATION_MODEL || 'qwen2.5:7b'
    }));

    // Hybrid method (best balance)
    this.methods.set('hybrid', new HybridClassificationMethod({
      confidenceThreshold: this.config.confidenceThreshold,
      ruleBasedConfig: {
        commandPrefix: this.config.commandPrefix,
        promptIndicators: this.config.promptIndicators,
        workflowIndicators: this.config.workflowIndicators,
        confidenceThresholds: this.config.confidenceThresholds
      },
      llmConfig: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        modelId: process.env.CLASSIFICATION_MODEL || 'qwen2.5:7b'
      }
    }));

    // Ensemble method (highest accuracy, slowest)
    this.methods.set('ensemble', new EnsembleClassificationMethod({
      minimumAgreement: 0.6,
      llmConfig: {
        baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434',
        modelId: process.env.CLASSIFICATION_MODEL || 'qwen2.5:7b'
      }
    }));
  }

  private shouldUseEnsemble(result: InputClassificationResult, currentMethod: ClassificationMethod): boolean {
    return (
      this.config.ensembleForUncertain &&
      currentMethod !== 'ensemble' &&
      result.confidence < this.config.confidenceThreshold &&
      this.methods.has('ensemble')
    );
  }

  private async handleClassificationError(
    input: string,
    context: ProcessingContext | undefined,
    failedMethod: ClassificationMethod,
    error: unknown,
    startTime: number
  ): Promise<InputClassificationResult> {
    const fallbackClassifier = this.methods.get(this.config.fallbackMethod);
    
    if (fallbackClassifier && failedMethod !== this.config.fallbackMethod) {
      try {
        const fallbackResult = await fallbackClassifier.classify(input, context);
        return {
          ...fallbackResult,
          confidence: Math.max(0.1, fallbackResult.confidence - 0.2), // Reduce confidence for fallback
          reasoning: `Primary method '${failedMethod}' failed, using fallback '${this.config.fallbackMethod}'. ${fallbackResult.reasoning}`,
          metadata: new Map([
            ...fallbackResult.metadata,
            ['primary_method_failed', failedMethod],
            ['fallback_used', this.config.fallbackMethod],
            ['error_message', error instanceof Error ? error.message : String(error)],
            ['total_latency', (Date.now() - startTime).toString()]
          ])
        };
      } catch (fallbackError) {
        // Both methods failed - return safe default
        return this.getSafeDefault(input, failedMethod, error, fallbackError, startTime);
      }
    }

    return this.getSafeDefault(input, failedMethod, error, null, startTime);
  }

  private getSafeDefault(
    input: string,
    failedMethod: ClassificationMethod,
    primaryError: unknown,
    fallbackError: unknown | null,
    startTime: number
  ): InputClassificationResult {
    // Safe classification when all methods fail
    const type: 'command' | 'prompt' | 'workflow' = input.trim().startsWith('/') ? 'command' : 'prompt';
    
    return {
      type,
      confidence: 0.1,
      detectionMethod: 'rule-based', // Fallback to basic rule
      reasoning: `All classification methods failed. Using safe default based on input prefix.`,
      extractedData: new Map([
        ['safe_default', 'true'],
        ['input_length', input.length.toString()]
      ]),
      metadata: new Map([
        ['classification_failed', 'true'],
        ['failed_method', failedMethod],
        ['primary_error', primaryError instanceof Error ? primaryError.message : String(primaryError)],
        ['fallback_error', fallbackError instanceof Error ? fallbackError.message : String(fallbackError)],
        ['total_latency', (Date.now() - startTime).toString()]
      ])
    };
  }
}

interface MethodPerformance {
  expectedAccuracy: number;
  averageLatency: number;
  methodName: ClassificationMethod;
}