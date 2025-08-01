// Input Classifier Implementation
//
// Implements three-type input classification: command, prompt, workflow
// Follows the architecture defined in docs/agents/agent.impl.three-type-classification.md

import type {
  ClassificationConfig,
  ClassificationMethod,
  ClassificationResult,
  ClassificationType,
  IClassifier,
  IClassificationMethod,
  ProcessingContext,
} from '../abstractions/index.js';
import { RuleBasedClassificationMethod } from './rule-based-classification-method.js';
import { LLMClassificationMethod } from './llm-classification-method.js';

export class InputClassifier implements IClassifier {
  private config: ClassificationConfig;
  private methods: Map<ClassificationMethod, IClassificationMethod> = new Map();

  constructor(config: Partial<ClassificationConfig> = {}) {
    this.config = {
      defaultMethod: config.defaultMethod || 'rule-based',
      fallbackMethod: config.fallbackMethod || 'rule-based',
      confidenceThreshold: config.confidenceThreshold || 0.8,
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
      ],
      complexityThresholds:
        config.complexityThresholds ||
        new Map([
          ['command', 1.0],
          ['prompt', 0.8],
          ['workflow', 0.7],
        ]),
    };
    
    // Initialize available classification methods
    this.initializeMethods();
  }
  
  private initializeMethods(): void {
    // Always initialize rule-based method
    this.methods.set('rule-based', new RuleBasedClassificationMethod({
      commandPrefix: this.config.commandPrefix,
      promptIndicators: this.config.promptIndicators,
      workflowIndicators: this.config.workflowIndicators,
      confidenceThresholds: this.config.complexityThresholds,
    }));
    
    // LLM method can be added when needed
    // this.methods.set('llm-based', new LLMClassificationMethod(...));
  }

  async classify(
    input: string,
    options?: { method?: ClassificationMethod; context?: ProcessingContext }
  ): Promise<ClassificationResult> {
    // Determine which method to use
    const methodName = options?.method || this.config.defaultMethod;
    const method = this.methods.get(methodName);
    
    if (!method) {
      throw new Error(`Classification method '${methodName}' not available. Available methods: ${Array.from(this.methods.keys()).join(', ')}`);
    }
    
    // Delegate to the appropriate classification method
    // The method will handle command detection using the shared utility function
    return await method.classify(input, options?.context);
  }

  getSupportedTypes(): readonly ClassificationType[] {
    return ['command', 'prompt', 'workflow'];
  }

  getSupportedMethods(): readonly ClassificationMethod[] {
    return Array.from(this.methods.keys()) as readonly ClassificationMethod[];
  }

  updateClassificationRules(config: ClassificationConfig): void {
    this.config = config;
    // Re-initialize methods with new config
    this.initializeMethods();
  }
  
  /**
   * Add LLM classification method if needed
   */
  addLLMMethod(config: { baseUrl?: string; modelId?: string; temperature?: number; maxTokens?: number }): void {
    this.methods.set('llm-based', new LLMClassificationMethod(config));
  }

  configure(config: Partial<ClassificationConfig>): void {
    this.config = { ...this.config, ...config };
    // Re-initialize methods with new config
    this.initializeMethods();
  }

  getStats(): any {
    // Placeholder - would aggregate stats from all methods
    return {
      totalClassifications: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      typeDistribution: new Map(),
      methodUsage: new Map(),
    };
  }

  resetStats(): void {
    // Placeholder for stats reset
  }

  validateConfig(config: ClassificationConfig): boolean {
    return (
      config.confidenceThreshold >= 0 &&
      config.confidenceThreshold <= 1 &&
      config.commandPrefix.length > 0 &&
      config.promptIndicators.length > 0 &&
      config.workflowIndicators.length > 0
    );
  }
}

export interface InputClassifierConfig {
  commandPrefix?: string;
  promptIndicators?: string[];
  workflowIndicators?: string[];
  confidenceThresholds?: Map<string, number>;
}
