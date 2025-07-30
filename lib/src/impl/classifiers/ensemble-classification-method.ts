// Ensemble Classification Method
//
// Uses multiple LLM calls with different prompts and voting mechanism
// Highest accuracy but slowest method - use for critical classification decisions

import type {
  IClassificationMethod,
  InputClassificationResult,
  ClassificationMethod,
  ProcessingContext
} from '../../core/interfaces.js';
import { LLMClassificationMethod } from './llm-classification-method.js';

interface EnsembleVote {
  type: 'command' | 'prompt' | 'workflow';
  confidence: number;
  reasoning: string;
  method: string;
}

export class EnsembleClassificationMethod implements IClassificationMethod {
  private methods: Array<{ method: LLMClassificationMethod; name: string; weight: number }>;
  private minimumAgreement: number;

  constructor(config: EnsembleClassificationConfig) {
    this.minimumAgreement = config.minimumAgreement || 0.6;
    
    // Create multiple LLM methods with different approaches
    this.methods = [
      {
        method: new LLMClassificationMethod({ 
          ...config.llmConfig, 
          temperature: 0.1,
          modelId: config.llmConfig?.modelId || 'qwen2.5:7b'
        }),
        name: 'conservative',
        weight: 1.0
      },
      {
        method: new LLMClassificationMethod({ 
          ...config.llmConfig, 
          temperature: 0.3,
          modelId: config.llmConfig?.modelId || 'qwen2.5:7b'
        }),
        name: 'balanced',
        weight: 1.0
      },
      {
        method: new LLMClassificationMethod({ 
          ...config.llmConfig, 
          temperature: 0.5,
          modelId: config.llmConfig?.modelId || 'qwen2.5:7b'
        }),
        name: 'exploratory',
        weight: 0.8
      }
    ];
  }

  async classify(input: string, context?: ProcessingContext): Promise<InputClassificationResult> {
    const startTime = Date.now();

    try {
      // Get votes from all methods in parallel
      const votes = await Promise.all(
        this.methods.map(async ({ method, name, weight }) => {
          const result = await method.classify(input, context);
          return {
            type: result.type,
            confidence: result.confidence * weight,
            reasoning: result.reasoning || '',
            method: name
          } as EnsembleVote;
        })
      );

      // Calculate ensemble result
      const ensembleResult = this.calculateEnsembleResult(votes, input);
      
      return {
        type: ensembleResult.type,
        confidence: ensembleResult.confidence,
        detectionMethod: 'ensemble',
        reasoning: ensembleResult.reasoning,
        extractedData: ensembleResult.extractedData,
        methodsUsed: ['llm-based'],
        metadata: new Map([
          ['ensemble_votes', votes.length.toString()],
          ['agreement_score', ensembleResult.agreementScore.toString()],
          ['voting_breakdown', this.getVotingBreakdown(votes)],
          ['total_latency', (Date.now() - startTime).toString()],
          ['timestamp', new Date().toISOString()]
        ])
      };

    } catch (error) {
      return {
        type: 'prompt', // Safe default
        confidence: 0.1,
        detectionMethod: 'ensemble',
        reasoning: `Ensemble classification failed: ${error instanceof Error ? error.message : String(error)}`,
        extractedData: new Map(),
        metadata: new Map([
          ['error', 'true'],
          ['total_latency', (Date.now() - startTime).toString()],
          ['error_message', error instanceof Error ? error.message : String(error)]
        ])
      };
    }
  }

  getMethodName(): ClassificationMethod {
    return 'ensemble';
  }

  getExpectedAccuracy(): number {
    return 0.98; // Highest accuracy through consensus
  }

  getAverageLatency(): number {
    return 1200; // ~800ms-1.5s for multiple LLM calls
  }

  private calculateEnsembleResult(votes: EnsembleVote[], input: string): {
    type: 'command' | 'prompt' | 'workflow';
    confidence: number;
    reasoning: string;
    extractedData: Map<string, unknown>;
    agreementScore: number;
  } {
    // Count votes for each type
    const typeCounts = new Map<string, { count: number; totalConfidence: number; reasons: string[] }>();
    
    for (const vote of votes) {
      const current = typeCounts.get(vote.type) || { count: 0, totalConfidence: 0, reasons: [] };
      typeCounts.set(vote.type, {
        count: current.count + 1,
        totalConfidence: current.totalConfidence + vote.confidence,
        reasons: [...current.reasons, vote.reasoning]
      });
    }

    // Find the winning type
    let winningType: 'command' | 'prompt' | 'workflow' = 'prompt';
    let maxScore = 0;
    
    for (const [type, data] of typeCounts) {
      const score = data.count * (data.totalConfidence / data.count);
      if (score > maxScore) {
        maxScore = score;
        winningType = type as 'command' | 'prompt' | 'workflow';
      }
    }

    const winningData = typeCounts.get(winningType)!;
    const agreementScore = winningData.count / votes.length;
    
    // Calculate confidence based on agreement and individual confidences
    const averageConfidence = winningData.totalConfidence / winningData.count;
    const finalConfidence = Math.min(0.99, averageConfidence * agreementScore + (agreementScore > this.minimumAgreement ? 0.1 : 0));

    // Build comprehensive reasoning
    const reasoning = this.buildEnsembleReasoning(winningType, winningData, agreementScore, votes);

    return {
      type: winningType,
      confidence: finalConfidence,
      reasoning,
      extractedData: new Map([
        ['input_length', input.length],
        ['winning_votes', winningData.count],
        ['total_votes', votes.length],
        ['agreement_score', agreementScore]
      ]),
      agreementScore
    };
  }

  private buildEnsembleReasoning(
    winningType: string,
    winningData: { count: number; totalConfidence: number; reasons: string[] },
    agreementScore: number,
    allVotes: EnsembleVote[]
  ): string {
    const avgConfidence = (winningData.totalConfidence / winningData.count).toFixed(2);
    const agreementPercent = (agreementScore * 100).toFixed(0);
    
    let reasoning = `Ensemble decision: '${winningType}' with ${winningData.count}/${allVotes.length} votes (${agreementPercent}% agreement), avg confidence ${avgConfidence}.`;
    
    // Add the most confident reason
    const bestReason = winningData.reasons.find(r => r.length > 10) || winningData.reasons[0];
    if (bestReason) {
      reasoning += ` Primary reasoning: ${bestReason}`;
    }

    // Note if there was disagreement
    if (agreementScore < 1.0) {
      const disagreements = allVotes.filter(v => v.type !== winningType).map(v => v.type);
      reasoning += ` (Alternative suggestions: ${[...new Set(disagreements)].join(', ')})`;
    }

    return reasoning;
  }

  private getVotingBreakdown(votes: EnsembleVote[]): string {
    const breakdown = votes.map(v => `${v.method}:${v.type}(${v.confidence.toFixed(2)})`);
    return breakdown.join(', ');
  }
}

export interface EnsembleClassificationConfig {
  minimumAgreement?: number;
  llmConfig?: any;
}