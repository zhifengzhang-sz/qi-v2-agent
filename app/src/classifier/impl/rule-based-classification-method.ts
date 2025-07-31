// Rule-Based Classification Method
//
// Fast pattern-matching classification using regex and keyword analysis
// Low accuracy (~8-9%) but very fast (~8-180ms) - good for fallback

import type {
  IClassificationMethod,
  ClassificationResult,
  ClassificationMethod,
  ProcessingContext
} from '../abstractions/index.js';

export class RuleBasedClassificationMethod implements IClassificationMethod {
  private config: RuleBasedConfig;

  constructor(config: Partial<RuleBasedConfig> = {}) {
    this.config = {
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
  }

  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();
    const trimmedInput = input.trim();
    
    // Stage 1: Command Detection (highest priority)
    if (this.isCommand(trimmedInput)) {
      return {
        type: 'command',
        confidence: 1.0,
        method: 'rule-based',
        reasoning: `Input starts with command prefix '${this.config.commandPrefix}'`,
        extractedData: new Map([
          ['command', this.extractCommandName(trimmedInput)],
          ['args', JSON.stringify(this.extractCommandArgs(trimmedInput))]
        ]),
        metadata: new Map([
          ['method', 'command-prefix-match'],
          ['latency', (Date.now() - startTime).toString()]
        ])
      };
    }

    // Stage 2: Prompt vs Workflow Analysis
    const complexityAnalysis = this.analyzeComplexity(trimmedInput, context);
    
    if (complexityAnalysis.isSimplePrompt) {
      return {
        type: 'prompt',
        confidence: complexityAnalysis.confidence,
        method: 'rule-based',
        reasoning: `Simple prompt detected: ${complexityAnalysis.reasoning}`,
        extractedData: new Map([
          ['promptType', complexityAnalysis.promptType],
          ['indicators', JSON.stringify(complexityAnalysis.promptIndicators)]
        ]),
        metadata: new Map([
          ['method', 'complexity-analysis'],
          ['analysis', JSON.stringify(complexityAnalysis)],
          ['latency', (Date.now() - startTime).toString()]
        ])
      };
    }

    return {
      type: 'workflow',
      confidence: complexityAnalysis.confidence,
      method: 'rule-based',
      reasoning: `Complex workflow detected: ${complexityAnalysis.reasoning}`,
      extractedData: new Map([
        ['workflowIndicators', JSON.stringify(complexityAnalysis.workflowIndicators)],
        ['complexity', complexityAnalysis.estimatedComplexity]
      ]),
      metadata: new Map([
        ['method', 'complexity-analysis'],
        ['analysis', JSON.stringify(complexityAnalysis)],
        ['latency', (Date.now() - startTime).toString()]
      ])
    };
  }

  getMethodName(): ClassificationMethod {
    return 'rule-based';
  }

  getExpectedAccuracy(): number {
    return 0.09; // 8-9% as user reported
  }

  getAverageLatency(): number {
    return 50; // ~8-180ms average
  }

  async isAvailable(): Promise<boolean> {
    return true; // Rule-based method is always available
  }

  private isCommand(input: string): boolean {
    return input.startsWith(this.config.commandPrefix);
  }

  private extractCommandName(input: string): string {
    const match = input.match(new RegExp(`^\\${this.config.commandPrefix}(\\w+)`));
    return match ? match[1] : 'unknown';
  }

  private extractCommandArgs(input: string): string[] {
    const commandMatch = input.match(new RegExp(`^\\${this.config.commandPrefix}\\w+\\s+(.+)`));
    if (!commandMatch) return [];
    return commandMatch[1].split(/\s+/).filter(arg => arg.length > 0);
  }

  private analyzeComplexity(input: string, context?: ProcessingContext): ComplexityAnalysis {
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
        estimatedComplexity: 'low'
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
      estimatedComplexity: this.estimateComplexity(indicators)
    };
  }

  private isSimplePrompt(input: string, indicators: ComplexityIndicators): boolean {
    // High confidence prompt patterns
    if (indicators.promptSignals.length > 0) return true;
    if (indicators.questionWords.length > 0 && input.length < 50) return true;
    
    // Low task complexity
    if (indicators.workflowSignals.length === 0) return true;
    if (indicators.fileReferences.length === 0 && indicators.technicalTerms.length === 0) return true;
    
    return false;
  }

  private extractComplexityIndicators(input: string): ComplexityIndicators {
    const lowerInput = input.toLowerCase();
    
    return {
      promptSignals: this.findMatches(lowerInput, this.config.promptIndicators),
      workflowSignals: this.findMatches(lowerInput, this.config.workflowIndicators),
      questionWords: this.findMatches(lowerInput, ['what', 'how', 'why', 'when', 'where', 'who']),
      fileReferences: this.findFileReferences(input),
      technicalTerms: this.findMatches(lowerInput, ['function', 'class', 'api', 'database', 'server', 'test']),
      multiStepIndicators: this.findMatches(lowerInput, ['then', 'after', 'and', 'also', 'next'])
    };
  }

  private findMatches(text: string, patterns: readonly string[]): string[] {
    return patterns.filter(pattern => text.includes(pattern));
  }

  private findFileReferences(input: string): string[] {
    const matches = input.match(/\b\w+\.\w+\b/g) || [];
    return matches.filter(match => 
      /\.(js|ts|py|java|cpp|html|css|json|yaml|md)$/i.test(match)
    );
  }

  private calculatePromptConfidence(input: string, indicators: ComplexityIndicators): number {
    let confidence = 0.5;
    
    // Boost for prompt signals
    confidence += indicators.promptSignals.length * 0.2;
    confidence += indicators.questionWords.length * 0.15;
    
    // Reduce for workflow signals
    confidence -= indicators.workflowSignals.length * 0.15;
    confidence -= indicators.fileReferences.length * 0.2;
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private calculateWorkflowConfidence(input: string, indicators: ComplexityIndicators): number {
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
    if (this.config.promptIndicators.some(indicator => 
      ['hi', 'hello', 'thanks'].includes(indicator) && input.includes(indicator)
    )) {
      return 'greeting';
    }
    if (input.includes('what') || input.includes('how') || input.includes('why')) {
      return 'question';
    }
    return 'general';
  }

  private estimateComplexity(indicators: ComplexityIndicators): string {
    const signals = indicators.workflowSignals.length + indicators.fileReferences.length + indicators.multiStepIndicators.length;
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