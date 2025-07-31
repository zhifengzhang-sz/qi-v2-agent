// Input Classifier Implementation
//
// Implements three-type input classification: command, prompt, workflow
// Follows the architecture defined in docs/agents/agent.impl.three-type-classification.md

import type { 
  IClassifier, 
  ProcessingContext, 
  ClassificationResult,
  ClassificationConfig,
  ClassificationMethod,
  ClassificationType
} from '../abstractions/index.js';

export class InputClassifier implements IClassifier {
  private config: ClassificationConfig;

  constructor(config: Partial<ClassificationConfig> = {}) {
    this.config = {
      defaultMethod: config.defaultMethod || 'rule-based',
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
  }

  async classify(
    input: string,
    options?: { method?: ClassificationMethod; context?: ProcessingContext }
  ): Promise<ClassificationResult> {
    const trimmedInput = input.trim();
    
    // Stage 1: Command Detection (highest priority)
    if (this.isCommand(trimmedInput)) {
      return {
        type: 'command',
        confidence: 1.0,
        method: 'rule-based',
        extractedData: new Map<string, unknown>([
          ['command', this.extractCommandName(trimmedInput)],
          ['args', this.extractCommandArgs(trimmedInput)]
        ]),
        metadata: new Map<string, unknown>([
          ['commandName', this.extractCommandName(trimmedInput)],
          ['detectionStage', 'command-detection']
        ])
      };
    }

    // Stage 2: Prompt vs Workflow Analysis
    const complexityAnalysis = this.analyzeComplexity(trimmedInput, options?.context);
    
    if (complexityAnalysis.isSimplePrompt) {
      return {
        type: 'prompt',
        confidence: complexityAnalysis.confidence,
        method: 'rule-based',
        extractedData: new Map<string, unknown>([
          ['promptType', complexityAnalysis.promptType],
          ['content', trimmedInput]
        ]),
        metadata: new Map<string, unknown>([
          ['promptType', complexityAnalysis.promptType],
          ['indicators', complexityAnalysis.indicators],
          ['detectionStage', 'prompt-analysis']
        ])
      };
    }

    return {
      type: 'workflow',
      confidence: complexityAnalysis.confidence,
      method: 'rule-based',
      extractedData: new Map<string, unknown>([
        ['workflowType', 'general'],
        ['content', trimmedInput],
        ['complexity', complexityAnalysis.complexity]
      ]),
      metadata: new Map<string, unknown>([
        ['workflowIndicators', complexityAnalysis.workflowIndicators],
        ['estimatedComplexity', complexityAnalysis.complexity],
        ['detectionStage', 'workflow-analysis']
      ])
    };
  }

  getSupportedTypes(): readonly ClassificationType[] {
    return ['command', 'prompt', 'workflow'];
  }

  getSupportedMethods(): readonly ClassificationMethod[] {
    return ['rule-based'] as const;
  }

  updateClassificationRules(config: ClassificationConfig): void {
    this.config = config;
  }

  configure(config: Partial<ClassificationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getStats(): any {
    // Placeholder - would track classification statistics
    return {
      totalClassifications: 0,
      averageConfidence: 0,
      averageProcessingTime: 0,
      typeDistribution: new Map(),
      methodUsage: new Map([['rule-based', 1]])
    };
  }

  resetStats(): void {
    // Placeholder for stats reset
  }

  validateConfig(config: ClassificationConfig): boolean {
    return config.confidenceThreshold >= 0 && 
           config.confidenceThreshold <= 1 &&
           config.commandPrefix.length > 0 &&
           config.promptIndicators.length > 0 &&
           config.workflowIndicators.length > 0;
  }

  // ============================================================================
  // Command Detection - Simple and Reliable
  // ============================================================================

  private isCommand(input: string): boolean {
    return input.startsWith(this.config.commandPrefix);
  }

  private extractCommandName(input: string): string {
    const prefix = this.config.commandPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${prefix}([a-zA-Z0-9_-]+)`);
    const match = input.match(regex);
    return match ? match[1] : 'unknown';
  }

  private extractCommandArgs(input: string): string[] {
    const prefix = this.config.commandPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(`^${prefix}[a-zA-Z0-9_-]+\\s+(.*)$`);
    const match = input.match(regex);
    return match ? match[1].split(/\s+/).filter(arg => arg.length > 0) : [];
  }

  // ============================================================================
  // Complexity Analysis - Prompt vs Workflow
  // ============================================================================

  private analyzeComplexity(
    input: string, 
    context?: ProcessingContext
  ): ComplexityAnalysis {
    const indicators = this.extractComplexityIndicators(input);
    
    // Simple prompt indicators
    if (this.isSimplePrompt(input, indicators)) {
      return {
        isSimplePrompt: true,
        confidence: this.calculatePromptConfidence(input, indicators),
        promptType: this.classifyPromptType(input, indicators),
        complexity: 'low',
        indicators: indicators.promptSignals,
        workflowIndicators: []
      };
    }
    
    // Workflow indicators
    return {
      isSimplePrompt: false,
      confidence: this.calculateWorkflowConfidence(input, indicators),
      promptType: undefined,
      complexity: this.estimateComplexity(indicators),
      indicators: [],
      workflowIndicators: indicators.workflowSignals
    };
  }

  private isSimplePrompt(input: string, indicators: ComplexityIndicators): boolean {
    // Strong prompt signals that override workflow detection
    if (indicators.greetingWords.length > 0 && indicators.actionVerbs.length === 0) return true;
    if (indicators.questionWords.length > 0 && input.length < 50 && indicators.actionVerbs.length === 0) return true;
    if (indicators.conversationalMarkers.length > 0 && indicators.fileReferences.length === 0) return true;
    
    // Very short inputs with no technical content
    if (input.length < 10 && indicators.technicalTerms.length === 0 && indicators.actionVerbs.length === 0) return true;
    
    // Check if it's clearly more prompt-like than workflow-like
    const promptScore = indicators.greetingWords.length + indicators.questionWords.length + indicators.conversationalMarkers.length;
    const workflowScore = indicators.actionVerbs.length + indicators.fileReferences.length + indicators.technicalTerms.length + indicators.taskComplexity.length;
    
    // Only classify as simple prompt if prompt signals clearly dominate AND there are weak workflow signals
    if (promptScore > 0 && workflowScore <= 1 && input.length < 30) return true;
    
    return false;
  }

  private extractComplexityIndicators(input: string): ComplexityIndicators {
    const lowerInput = input.toLowerCase();
    
    const greetingWords = this.findGreetings(lowerInput);
    const questionWords = this.findQuestionWords(lowerInput);
    const conversationalMarkers = this.findConversationalMarkers(lowerInput);
    const actionVerbs = this.findActionVerbs(lowerInput);
    const fileReferences = this.findFileReferences(input); // Case sensitive
    const technicalTerms = this.findTechnicalTerms(lowerInput);
    const taskComplexity = this.findComplexityMarkers(lowerInput);
    const toolRequirements = this.estimateToolNeeds(lowerInput);
    const stepIndicators = this.findStepIndicators(lowerInput);
    
    // Populate prompt signals
    const promptSignals = [
      ...greetingWords,
      ...questionWords,
      ...conversationalMarkers
    ];
    
    // Populate workflow signals
    const workflowSignals = [
      ...actionVerbs,
      ...fileReferences,
      ...technicalTerms,
      ...taskComplexity,
      ...toolRequirements,
      ...stepIndicators
    ];
    
    return {
      greetingWords,
      questionWords,
      conversationalMarkers,
      actionVerbs,
      fileReferences,
      technicalTerms,
      taskComplexity,
      toolRequirements,
      stepIndicators,
      promptSignals,
      workflowSignals
    };
  }

  // ============================================================================
  // Signal Detection Methods
  // ============================================================================

  private findGreetings(input: string): string[] {
    const greetings = ['hi', 'hello', 'hey', 'thanks', 'thank you', 'goodbye', 'bye'];
    return greetings.filter(greeting => {
      // Use word boundaries for better matching
      const regex = new RegExp(`\\b${greeting.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(input);
    });
  }

  private findQuestionWords(input: string): string[] {
    const questionWords = ['what', 'how', 'why', 'when', 'where', 'who', 'which'];
    return questionWords.filter(word => {
      const regex = new RegExp(`\\b${word}\\b`, 'i');
      return regex.test(input);
    });
  }

  private findConversationalMarkers(input: string): string[] {
    const markers = ['please', 'can you', 'could you', 'would you', 'help me'];
    return markers.filter(marker => {
      const regex = new RegExp(`\\b${marker.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
      return regex.test(input);
    });
  }

  private findActionVerbs(input: string): string[] {
    const actionVerbs = this.config.workflowIndicators;
    return actionVerbs.filter(verb => {
      const regex = new RegExp(`\\b${verb}\\b`, 'i');
      return regex.test(input);
    });
  }

  private findFileReferences(input: string): string[] {
    const fileExtensions = ['.js', '.ts', '.py', '.java', '.cpp', '.html', '.css', '.json', '.yaml', '.md'];
    const filePatterns = [/\w+\.\w+/, /src\/\w+/, /lib\/\w+/, /app\/\w+/];
    
    const extensions = fileExtensions.filter(ext => input.includes(ext));
    const patterns = filePatterns.filter(pattern => pattern.test(input)).map(p => p.toString());
    
    return [...extensions, ...patterns];
  }

  private findTechnicalTerms(input: string): string[] {
    const technicalTerms = [
      'function', 'class', 'method', 'variable', 'api', 'database', 'server',
      'bug', 'error', 'exception', 'test', 'deployment', 'authentication',
      'authorization', 'endpoint', 'request', 'response', 'json', 'xml'
    ];
    return technicalTerms.filter(term => input.includes(term));
  }

  private findComplexityMarkers(input: string): string[] {
    const complexityMarkers = [
      'architecture', 'design', 'pattern', 'framework', 'system', 'integration',
      'optimization', 'performance', 'scalability', 'security', 'configuration'
    ];
    return complexityMarkers.filter(marker => input.includes(marker));
  }

  private estimateToolNeeds(input: string): string[] {
    const toolMappings = new Map([
      ['file', ['filesystem']],
      ['git', ['git']],
      ['test', ['testing']],
      ['search', ['search']],
      ['web', ['web-search']],
      ['plan', ['sequential-thinking']],
      ['debug', ['debugging-tools']]
    ]);

    const estimatedTools: string[] = [];
    for (const [keyword, tools] of toolMappings) {
      if (input.includes(keyword)) {
        estimatedTools.push(...tools);
      }
    }
    
    return [...new Set(estimatedTools)]; // Remove duplicates
  }

  private findStepIndicators(input: string): string[] {
    const stepIndicators = [
      'first', 'then', 'next', 'after', 'finally', 'step', 'phase',
      'and then', 'followed by', 'subsequently'
    ];
    return stepIndicators.filter(indicator => input.includes(indicator));
  }

  // ============================================================================
  // Confidence Calculation
  // ============================================================================

  private calculatePromptConfidence(input: string, indicators: ComplexityIndicators): number {
    let confidence = 0.5; // Base confidence
    
    // Strong prompt signals
    if (indicators.greetingWords.length > 0) confidence += 0.4;
    if (indicators.questionWords.length > 0 && input.length < 30) confidence += 0.3;
    if (indicators.conversationalMarkers.length > 0) confidence += 0.2;
    
    // Workflow signals reduce prompt confidence
    if (indicators.fileReferences.length > 0) confidence -= 0.3;
    if (indicators.actionVerbs.length > 2) confidence -= 0.2;
    if (indicators.technicalTerms.length > 3) confidence -= 0.2;
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  private calculateWorkflowConfidence(input: string, indicators: ComplexityIndicators): number {
    let confidence = 0.5; // Base confidence
    
    // Strong workflow signals
    if (indicators.actionVerbs.length > 0) confidence += 0.2;
    if (indicators.fileReferences.length > 0) confidence += 0.3;
    if (indicators.technicalTerms.length > 2) confidence += 0.2;
    if (indicators.stepIndicators.length > 1) confidence += 0.2;
    
    // Simple prompt signals reduce workflow confidence
    if (indicators.greetingWords.length > 0) confidence -= 0.4;
    if (input.length < 20 && indicators.questionWords.length > 0) confidence -= 0.3;
    
    return Math.max(0.1, Math.min(0.95, confidence));
  }

  // ============================================================================
  // Classification Helpers
  // ============================================================================

  private classifyPromptType(input: string, indicators: ComplexityIndicators): string {
    if (indicators.greetingWords.length > 0) return 'greeting';
    if (indicators.questionWords.length > 0) return 'question';
    if (indicators.conversationalMarkers.length > 0) return 'request';
    if (input.toLowerCase().includes('thank')) return 'acknowledgment';
    return 'general';
  }

  private estimateComplexity(indicators: ComplexityIndicators): 'low' | 'medium' | 'high' {
    const complexityScore = 
      indicators.actionVerbs.length * 2 +
      indicators.fileReferences.length * 3 +
      indicators.technicalTerms.length +
      indicators.taskComplexity.length * 4 +
      indicators.stepIndicators.length * 2;

    if (complexityScore > 15) return 'high';
    if (complexityScore > 8) return 'medium';
    return 'low';
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface ComplexityIndicators {
  greetingWords: string[];
  questionWords: string[];
  conversationalMarkers: string[];
  actionVerbs: string[];
  fileReferences: string[];
  technicalTerms: string[];
  taskComplexity: string[];
  toolRequirements: string[];
  stepIndicators: string[];
  promptSignals: string[];
  workflowSignals: string[];
}

interface ComplexityAnalysis {
  isSimplePrompt: boolean;
  confidence: number;
  promptType?: string;
  complexity: 'low' | 'medium' | 'high';
  indicators: string[];
  workflowIndicators: string[];
}

export interface InputClassifierConfig {
  commandPrefix?: string;
  promptIndicators?: string[];
  workflowIndicators?: string[];
  confidenceThresholds?: Map<string, number>;
}