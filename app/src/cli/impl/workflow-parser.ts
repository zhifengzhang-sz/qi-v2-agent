/**
 * CLI Workflow Parser Implementation
 * 
 * Enhanced parser with workflow detection capabilities
 */

import type { 
  InputClassificationResult,
  IInputClassifier, 
  ProcessingContext,
  ClassificationMethod
} from '@qi/lib';
import { createWorkflowExtractor, type IWorkflowExtractor } from '../../workflow/index.js';

// ============================================================================
// Enhanced Parser with Workflow Support
// ============================================================================

interface WorkflowParserConfig {
  readonly confidenceThreshold: number;
  readonly workflowThreshold: number;
  readonly enableWorkflowExtraction: boolean;
  readonly customPatterns: readonly string[];
}

const DEFAULT_WORKFLOW_CONFIG: WorkflowParserConfig = {
  confidenceThreshold: 0.8,
  workflowThreshold: 0.7,
  enableWorkflowExtraction: true,
  customPatterns: []
};

export class WorkflowCLIParser implements IInputClassifier {
  private config: WorkflowParserConfig;
  private workflowExtractor?: IWorkflowExtractor;
  
  constructor(config: Partial<WorkflowParserConfig> = {}) {
    this.config = { ...DEFAULT_WORKFLOW_CONFIG, ...config };
    
    if (this.config.enableWorkflowExtraction) {
      this.workflowExtractor = createWorkflowExtractor();
    }
  }
  
  async classifyInput(
    input: string, 
    method?: string,
    context?: ProcessingContext
  ): Promise<InputClassificationResult> {
    const trimmed = input.trim();
    
    if (!trimmed) {
      return {
        type: 'prompt',
        confidence: 0.0,
        detectionMethod: 'rule-based',
        metadata: new Map([['reason', 'empty_input']]),
        extractedData: new Map([['content', '']])
      };
    }
    
    // Fast path: command detection
    if (this.isCommand(trimmed)) {
      const commandInfo = this.extractCommand(trimmed);
      return {
        type: 'command',
        confidence: 1.0,
        detectionMethod: 'rule-based',
        metadata: new Map([
          ['commandName', commandInfo.name],
          ['argCount', commandInfo.args.length.toString()]
        ]),
        extractedData: new Map([
          ['command', commandInfo.name],
          ['args', JSON.stringify(commandInfo.args)],
          ['rawInput', trimmed]
        ])
      };
    }
    
    // Workflow detection
    const workflowResult = await this.detectWorkflow(trimmed, context);
    if (workflowResult.isWorkflow) {
      return {
        type: 'workflow',
        confidence: workflowResult.confidence,
        detectionMethod: workflowResult.method,
        metadata: new Map([
          ['workflowMode', workflowResult.mode],
          ['complexity', workflowResult.complexity],
          ['indicators', workflowResult.indicators.join(', ')],
          ['extractionAvailable', this.config.enableWorkflowExtraction.toString()]
        ]),
        extractedData: new Map([
          ['content', trimmed],
          ['workflowSpec', workflowResult.workflowSpec]
        ])
      };
    }
    
    // Default to prompt
    return {
      type: 'prompt',
      confidence: 0.9,
      detectionMethod: 'rule-based',
      metadata: new Map([
        ['wordCount', trimmed.split(/\s+/).length.toString()],
        ['length', trimmed.length.toString()],
        ['conversational', 'true']
      ]),
      extractedData: new Map([['content', trimmed]])
    };
  }
  
  getSupportedTypes(): readonly string[] {
    return ['command', 'prompt', 'workflow'];
  }
  
  getSupportedMethods(): readonly ClassificationMethod[] {
    return ['rule-based', 'hybrid'];
  }
  
  updateClassificationRules(config: any): void {
    try {
      // Update confidence thresholds
      if (config.confidenceThreshold !== undefined) {
        if (typeof config.confidenceThreshold === 'number' && 
            config.confidenceThreshold >= 0 && 
            config.confidenceThreshold <= 1) {
          this.config = {
            ...this.config,
            confidenceThreshold: config.confidenceThreshold
          };
        }
      }
      
      // Update workflow threshold specifically
      if (config.workflowThreshold !== undefined) {
        if (typeof config.workflowThreshold === 'number' && 
            config.workflowThreshold >= 0 && 
            config.workflowThreshold <= 1) {
          this.config = {
            ...this.config,
            workflowThreshold: config.workflowThreshold
          };
        }
      }
      
      // Update custom patterns
      if (config.customPatterns && Array.isArray(config.customPatterns)) {
        this.config = {
          ...this.config,
          customPatterns: config.customPatterns.filter((p: any) => typeof p === 'string')
        };
      }
      
      // Enable/disable workflow extraction
      if (config.enableWorkflowExtraction !== undefined) {
        if (typeof config.enableWorkflowExtraction === 'boolean') {
          this.config = {
            ...this.config,
            enableWorkflowExtraction: config.enableWorkflowExtraction
          };
          
          // Reinitialize workflow extractor if needed
          if (config.enableWorkflowExtraction && !this.workflowExtractor) {
            this.workflowExtractor = createWorkflowExtractor();
          } else if (!config.enableWorkflowExtraction) {
            this.workflowExtractor = undefined;
          }
        }
      }
      
      console.debug('Workflow parser configuration updated:', {
        confidenceThreshold: this.config.confidenceThreshold,
        workflowThreshold: this.config.workflowThreshold,
        enableWorkflowExtraction: this.config.enableWorkflowExtraction,
        customPatterns: this.config.customPatterns.length
      });
      
    } catch (error) {
      console.error('Failed to update workflow parser configuration:', error);
      throw new Error(`Invalid configuration: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  
  // ==========================================================================
  // Workflow Detection Logic
  // ==========================================================================
  
  private async detectWorkflow(
    input: string, 
    context?: ProcessingContext
  ): Promise<WorkflowDetectionResult> {
    const analysis = this.analyzeForWorkflow(input);
    
    if (analysis.confidence < this.config.workflowThreshold) {
      return {
        isWorkflow: false,
        confidence: analysis.confidence,
        method: 'rule-based',
        mode: 'none',
        complexity: 'simple',
        indicators: analysis.indicators,
        workflowSpec: null
      };
    }
    
    // If workflow extractor is available, get detailed workflow spec
    let workflowSpec = null;
    if (this.workflowExtractor) {
      try {
        // Convert lib ProcessingContext to app ProcessingContext
        const appContext = context ? {
          sessionId: context.sessionId || 'default',
          currentInputType: context.currentInputType,
          environmentContext: context.environmentContext
        } : undefined;
        const extractionResult = await this.workflowExtractor.extractWorkflow(input, appContext);
        if (extractionResult.success && extractionResult.workflowSpec) {
          workflowSpec = extractionResult.workflowSpec;
        }
      } catch (error) {
        console.warn('Workflow extraction failed:', error);
      }
    }
    
    return {
      isWorkflow: true,
      confidence: analysis.confidence,
      method: workflowSpec ? 'hybrid' : 'rule-based',
      mode: analysis.mode,
      complexity: analysis.complexity,
      indicators: analysis.indicators,
      workflowSpec
    };
  }
  
  private analyzeForWorkflow(input: string): WorkflowAnalysis {
    const lowerInput = input.toLowerCase();
    const wordCount = input.split(/\s+/).length;
    
    // Workflow indicators
    const multiStepIndicators = [
      'then', 'after', 'next', 'followed by', 'and then', 'subsequently',
      'first', 'second', 'finally', 'step', 'steps'
    ];
    
    const toolIndicators = [
      'create', 'build', 'generate', 'implement', 'deploy', 'test', 'debug',
      'file', 'write', 'run', 'execute', 'compile', 'install'
    ];
    
    const fileOperationIndicators = [
      '.js', '.ts', '.py', '.java', '.html', '.css', '.md', '.txt',
      'save to', 'write to', 'create file', 'update file'
    ];
    
    const complexityKeywords = [
      'architecture', 'system', 'integration', 'workflow', 'pipeline',
      'process', 'automate', 'setup', 'configure'
    ];
    
    const conjunctions = ['and', 'then', 'also', 'plus', 'additionally'];
    
    // Count indicators
    const multiStep = multiStepIndicators.filter(indicator => lowerInput.includes(indicator)).length;
    const tools = toolIndicators.filter(indicator => lowerInput.includes(indicator)).length;
    const fileOps = fileOperationIndicators.filter(indicator => lowerInput.includes(indicator)).length;
    const complexity = complexityKeywords.filter(keyword => lowerInput.includes(keyword)).length;
    const connects = conjunctions.filter(conj => lowerInput.includes(conj)).length;
    
    const indicators: string[] = [];
    let confidence = 0.0;
    let mode = 'general';
    let complexityLevel: 'simple' | 'moderate' | 'complex' = 'simple';
    
    // Calculate confidence based on indicators
    if (multiStep > 0) {
      confidence += 0.3;
      indicators.push('multi-step');
    }
    
    if (tools > 1) {
      confidence += 0.25;
      indicators.push('multiple-tools');
    }
    
    if (fileOps > 0) {
      confidence += 0.2;
      indicators.push('file-operations');
    }
    
    if (complexity > 0) {
      confidence += 0.15;
      indicators.push('complex-task');
    }
    
    if (connects > 1) {
      confidence += 0.1;
      indicators.push('connected-actions');
    }
    
    if (wordCount > 20) {
      confidence += 0.1;
      indicators.push('detailed-request');
    }
    
    // Determine mode
    if (lowerInput.includes('analyze') || lowerInput.includes('study') || lowerInput.includes('examine')) {
      mode = 'analytical';
    } else if (lowerInput.includes('create') || lowerInput.includes('build') || lowerInput.includes('generate')) {
      mode = 'creative';
    } else if (lowerInput.includes('fix') || lowerInput.includes('debug') || lowerInput.includes('solve')) {
      mode = 'problem-solving';
    } else if (lowerInput.includes('explain') || lowerInput.includes('show') || lowerInput.includes('tell')) {
      mode = 'informational';
    }
    
    // Determine complexity
    if (wordCount > 30 || multiStep > 2 || complexity > 1) {
      complexityLevel = 'complex';
    } else if (wordCount > 15 || multiStep > 0 || tools > 1) {
      complexityLevel = 'moderate';
    }
    
    return {
      confidence: Math.min(confidence, 1.0),
      mode,
      complexity: complexityLevel,
      indicators
    };
  }
  
  // ==========================================================================
  // Command Detection (inherited from basic parser)
  // ==========================================================================
  
  private isCommand(input: string): boolean {
    const trimmed = input.trim();
    return trimmed.startsWith('/') && trimmed.length > 1;
  }
  
  private extractCommand(input: string): CommandInfo {
    const trimmed = input.trim();
    
    if (!this.isCommand(trimmed)) {
      return {
        name: '',
        args: [],
        rawInput: trimmed
      };
    }
    
    const withoutSlash = trimmed.slice(1);
    const parts = this.splitCommandLine(withoutSlash);
    
    return {
      name: parts[0] || '',
      args: parts.slice(1),
      rawInput: trimmed
    };
  }
  
  private splitCommandLine(input: string): string[] {
    const args: string[] = [];
    let current = '';
    let inQuotes = false;
    let quoteChar = '';
    let escaped = false;
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i];
      
      if (escaped) {
        current += char;
        escaped = false;
        continue;
      }
      
      if (char === '\\') {
        escaped = true;
        continue;
      }
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true;
        quoteChar = char;
        continue;
      }
      
      if (inQuotes && char === quoteChar) {
        inQuotes = false;
        quoteChar = '';
        continue;
      }
      
      if (!inQuotes && /\s/.test(char)) {
        if (current) {
          args.push(current);
          current = '';
        }
        continue;
      }
      
      current += char;
    }
    
    if (current) {
      args.push(current);
    }
    
    return args;
  }
}

// ============================================================================
// Supporting Types
// ============================================================================

interface CommandInfo {
  readonly name: string;
  readonly args: readonly string[];
  readonly rawInput: string;
}

interface WorkflowDetectionResult {
  readonly isWorkflow: boolean;
  readonly confidence: number;
  readonly method: ClassificationMethod;
  readonly mode: string;
  readonly complexity: 'simple' | 'moderate' | 'complex';
  readonly indicators: readonly string[];
  readonly workflowSpec: any; // WorkflowSpec or null
}

interface WorkflowAnalysis {
  readonly confidence: number;
  readonly mode: string;
  readonly complexity: 'simple' | 'moderate' | 'complex';
  readonly indicators: readonly string[];
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create workflow-enabled CLI parser
 */
export function createWorkflowParser(config?: Partial<WorkflowParserConfig>): WorkflowCLIParser {
  return new WorkflowCLIParser(config);
}

/**
 * Create workflow parser with enhanced detection
 */
export function createEnhancedWorkflowParser(): WorkflowCLIParser {
  return new WorkflowCLIParser({
    confidenceThreshold: 0.8,
    workflowThreshold: 0.6,
    enableWorkflowExtraction: true
  });
}