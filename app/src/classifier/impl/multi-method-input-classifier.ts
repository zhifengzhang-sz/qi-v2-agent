// Multi-Method Input Classifier
//
// Implements multiple classification methods with configurable selection
// Provides optimal balance of speed, accuracy, and reliability

import type {
  IClassifier,
  IClassificationMethod,
  ClassificationResult,
  ClassificationMethod,
  ClassificationConfig,
  ProcessingContext,
  ClassificationType
} from '../abstractions/index.js';

import { RuleBasedClassificationMethod } from './rule-based-classification-method.js';
import { LLMClassificationMethod } from './llm-classification-method.js';
import { HybridClassificationMethod } from './hybrid-classification-method.js';
import { EnsembleClassificationMethod } from './ensemble-classification-method.js';

export class MultiMethodInputClassifier implements IClassifier {
  private methods: Map<ClassificationMethod, IClassificationMethod> = new Map();
  private config: ClassificationConfig;
  
  // Real statistics tracking (replacing fake code)
  private stats = {
    totalClassifications: 0,
    totalProcessingTime: 0,
    totalConfidence: 0,
    typeDistribution: new Map<ClassificationType, number>([
      ['command', 0],
      ['prompt', 0], 
      ['workflow', 0]
    ]),
    methodUsage: new Map<ClassificationMethod, number>()
  };

  constructor(config: Partial<ClassificationConfig> = {}) {
    this.config = {
      defaultMethod: config.defaultMethod || 'hybrid',
      fallbackMethod: config.fallbackMethod || 'rule-based',
      confidenceThreshold: config.confidenceThreshold || 0.8,
      commandPrefix: config.commandPrefix || '/',
      promptIndicators: config.promptIndicators || [
        'hi', 'hello', 'thanks', 'what', 'how', 'why', 'when', 
        'can you', 'could you', 'please', 'explain'
      ],
      workflowIndicators: config.workflowIndicators || [
        'fix', 'create', 'refactor', 'implement', 'debug', 'analyze', 
        'build', 'design', 'test', 'deploy'
      ],
      complexityThresholds: config.complexityThresholds || new Map([
        ['command', 1.0],
        ['prompt', 0.8],
        ['workflow', 0.7]
      ])
    };

    this.initializeMethods();
  }

  async classify(
    input: string,
    options?: { method?: ClassificationMethod; context?: ProcessingContext }
  ): Promise<ClassificationResult> {
    const startTime = Date.now();
    const selectedMethod = options?.method || this.config.defaultMethod;

    try {
      // Get the selected classification method
      const classifier = this.methods.get(selectedMethod);
      if (!classifier) {
        throw new Error(`Classification method '${selectedMethod}' not available`);
      }

      // Perform classification
      const result = await classifier.classify(input, options?.context);

      // Check if we should escalate to ensemble for uncertain results
      if (this.shouldUseEnsemble(result, selectedMethod)) {
        const ensembleClassifier = this.methods.get('ensemble');
        if (ensembleClassifier) {
          const ensembleResult = await ensembleClassifier.classify(input, options?.context);
          
          // Track statistics for ensemble result
          this.updateStats(ensembleResult, Date.now() - startTime, 'ensemble');
          
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

      // Track statistics for normal result
      this.updateStats(result, Date.now() - startTime, selectedMethod);

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
      return await this.handleClassificationError(input, options?.context, selectedMethod, error, startTime);
    }
  }

  getSupportedTypes(): readonly ClassificationType[] {
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

  configure(config: Partial<ClassificationConfig>): void {
    this.config = { ...this.config, ...config };
    this.initializeMethods();
  }

  getStats(): any {
    return {
      totalClassifications: this.stats.totalClassifications,
      averageConfidence: this.stats.totalClassifications > 0 
        ? this.stats.totalConfidence / this.stats.totalClassifications 
        : 0,
      averageProcessingTime: this.stats.totalClassifications > 0 
        ? this.stats.totalProcessingTime / this.stats.totalClassifications 
        : 0,
      typeDistribution: new Map(this.stats.typeDistribution),
      methodUsage: new Map(this.stats.methodUsage)
    };
  }

  resetStats(): void {
    this.stats.totalClassifications = 0;
    this.stats.totalProcessingTime = 0;
    this.stats.totalConfidence = 0;
    this.stats.typeDistribution.clear();
    this.stats.typeDistribution.set('command', 0);
    this.stats.typeDistribution.set('prompt', 0);
    this.stats.typeDistribution.set('workflow', 0);
    this.stats.methodUsage.clear();
  }

  // Real statistics tracking method (replacing fake code)
  private updateStats(result: ClassificationResult, processingTime: number, method: ClassificationMethod): void {
    this.stats.totalClassifications++;
    this.stats.totalProcessingTime += processingTime;
    this.stats.totalConfidence += result.confidence;
    
    // Update type distribution
    const currentTypeCount = this.stats.typeDistribution.get(result.type) || 0;
    this.stats.typeDistribution.set(result.type, currentTypeCount + 1);
    
    // Update method usage
    const currentMethodCount = this.stats.methodUsage.get(method) || 0;
    this.stats.methodUsage.set(method, currentMethodCount + 1);
  }

  validateConfig(config: ClassificationConfig): boolean {
    return config.confidenceThreshold >= 0 && 
           config.confidenceThreshold <= 1 &&
           config.commandPrefix.length > 0 &&
           config.promptIndicators.length > 0 &&
           config.workflowIndicators.length > 0;
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
      workflowIndicators: this.config.workflowIndicators
      // Note: complexityThresholds not part of RuleBasedConfig interface
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
        // Note: complexityThresholds not part of RuleBasedConfig interface
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

  private shouldUseEnsemble(result: ClassificationResult, currentMethod: ClassificationMethod): boolean {
    return (
      false && // ensembleForUncertain not part of ClassificationConfig
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
  ): Promise<ClassificationResult> {
    const fallbackClassifier = this.methods.get(this.config.fallbackMethod!);
    
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
  ): ClassificationResult {
    // Safe classification when all methods fail
    const type: 'command' | 'prompt' | 'workflow' = input.trim().startsWith('/') ? 'command' : 'prompt';
    
    return {
      type,
      confidence: 0.1,
      method: 'rule-based', // Fallback to basic rule
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