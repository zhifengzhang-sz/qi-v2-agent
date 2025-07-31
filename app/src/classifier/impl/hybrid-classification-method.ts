// Hybrid Classification Method
//
// Combines rule-based and LLM-based classification for optimal speed and accuracy
// - High-confidence rule matches bypass LLM (fast)
// - Uncertain cases go to LLM (accurate)

import type {
  IClassificationMethod,
  ClassificationResult,
  ClassificationMethod,
  ProcessingContext
} from '../abstractions/index.js';
import { RuleBasedClassificationMethod } from './rule-based-classification-method.js';
import { LLMClassificationMethod } from './llm-classification-method.js';

export class HybridClassificationMethod implements IClassificationMethod {
  private ruleBasedMethod: RuleBasedClassificationMethod;
  private llmMethod: LLMClassificationMethod;
  private confidenceThreshold: number;

  constructor(config: HybridClassificationConfig) {
    this.ruleBasedMethod = new RuleBasedClassificationMethod(config.ruleBasedConfig);
    this.llmMethod = new LLMClassificationMethod(config.llmConfig);
    this.confidenceThreshold = config.confidenceThreshold || 0.8;
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();

    try {
      // Stage 1: Fast rule-based classification
      const ruleResult = await this.ruleBasedMethod.classify(input, context);
      
      // If rule-based has high confidence, use it directly
      if (ruleResult.confidence >= this.confidenceThreshold) {
        return {
          ...ruleResult,
          method: 'hybrid',
          reasoning: `High-confidence rule match: ${ruleResult.reasoning || 'rule-based classification'}`,
          metadata: new Map([
            ...ruleResult.metadata,
            ['hybrid_stage', 'rule-based-only'],
            ['rule_confidence', ruleResult.confidence],
            ['total_latency', Date.now() - startTime]
          ])
        };
      }

      // Stage 2: Low confidence - use LLM for accuracy
      const llmResult = await this.llmMethod.classify(input, context);
      
      // Combine insights from both methods
      const combinedExtractedData = new Map([
        ...ruleResult.extractedData,
        ...llmResult.extractedData
      ]);

      return {
        type: llmResult.type, // Trust LLM for final decision
        confidence: this.calculateHybridConfidence(ruleResult, llmResult),
        method: 'hybrid',
        reasoning: this.buildHybridReasoning(ruleResult, llmResult),
        extractedData: combinedExtractedData,
        metadata: new Map([
          ...llmResult.metadata,
          ['hybrid_stage', 'rule-then-llm'],
          ['rule_confidence', ruleResult.confidence],
          ['llm_confidence', llmResult.confidence],
          ['rule_type', ruleResult.type],
          ['llm_type', llmResult.type],
          ['agreement', ruleResult.type === llmResult.type],
          ['total_latency', Date.now() - startTime]
        ])
      };

    } catch (error) {
      // Fallback to rule-based on error
      const fallbackResult = await this.ruleBasedMethod.classify(input, context);
      return {
        ...fallbackResult,
        method: 'hybrid',
        reasoning: `Hybrid classification failed, using rule-based fallback: ${error instanceof Error ? error.message : String(error)}`,
        metadata: new Map([
          ...fallbackResult.metadata,
          ['hybrid_stage', 'error-fallback'],
          ['error', true],
          ['total_latency', Date.now() - startTime]
        ])
      };
    }
  }

  getMethodName(): ClassificationMethod {
    return 'hybrid';
  }

  getExpectedAccuracy(): number {
    // Best of both worlds: high-confidence rules + LLM accuracy
    return 0.95;
  }

  getAverageLatency(): number {
    // Weighted average: 70% fast rule-based, 30% slower LLM cases
    const ruleLatency = this.ruleBasedMethod.getAverageLatency();
    const llmLatency = this.llmMethod.getAverageLatency();
    return Math.round(ruleLatency * 0.7 + llmLatency * 0.3);
  }

  async isAvailable(): Promise<boolean> {
    const [ruleAvailable, llmAvailable] = await Promise.all([
      this.ruleBasedMethod.isAvailable(),
      this.llmMethod.isAvailable()
    ]);
    return ruleAvailable && llmAvailable;
  }

  private calculateHybridConfidence(
    ruleResult: ClassificationResult,
    llmResult: ClassificationResult
  ): number {
    // If both methods agree, boost confidence
    if (ruleResult.type === llmResult.type) {
      return Math.min(0.98, (ruleResult.confidence + llmResult.confidence) / 2 + 0.1);
    }

    // If they disagree, trust LLM but with slightly reduced confidence
    return Math.max(0.6, llmResult.confidence - 0.1);
  }

  private buildHybridReasoning(
    ruleResult: ClassificationResult,
    llmResult: ClassificationResult
  ): string {
    const agreement = ruleResult.type === llmResult.type;
    
    if (agreement) {
      return `Both rule-based (${ruleResult.confidence.toFixed(2)}) and LLM (${llmResult.confidence.toFixed(2)}) agree on '${llmResult.type}'. ${llmResult.reasoning}`;
    } else {
      return `Rule-based suggested '${ruleResult.type}' (${ruleResult.confidence.toFixed(2)}), but LLM determined '${llmResult.type}' (${llmResult.confidence.toFixed(2)}). Using LLM result: ${llmResult.reasoning}`;
    }
  }
}

export interface HybridClassificationConfig {
  confidenceThreshold?: number;
  // TODO: Replace 'any' types with proper configuration interfaces
  // Design problem: Need to define specific configuration schemas:
  // 1. ruleBasedConfig should reference RuleBasedConfig from rule-based-classification-method.ts
  // 2. llmConfig should reference proper LLM configuration interface (same as ensemble TODO)
  // 3. Both configs need proper validation and type safety
  ruleBasedConfig: any; // Config for rule-based method
  llmConfig: any; // Config for LLM method
}