/**
 * CLI Input Parser Implementation
 * 
 * Simple but effective parser that classifies input as command, prompt, or workflow.
 * Updated to support three-type classification system.
 */

import type { 
  InputClassificationResult,
  IInputClassifier, 
  ProcessingContext,
  ClassificationMethod
} from '@qi/lib'

// ============================================================================
// Helper Interfaces
// ============================================================================

interface CommandInfo {
  readonly name: string
  readonly args: readonly string[]
  readonly rawInput: string
}

// ============================================================================
// Parser Configuration
// ============================================================================

interface BasicParserConfig {
  readonly confidenceThreshold: number
  readonly customPatterns: readonly string[]
}

const DEFAULT_CONFIG: BasicParserConfig = {
  confidenceThreshold: 0.8,
  customPatterns: []
}

// ============================================================================
// Parser Implementation
// ============================================================================

export class CLIParser implements IInputClassifier {
  private config: BasicParserConfig
  
  constructor(config: Partial<BasicParserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }
  
  // ==========================================================================
  // IInputClassifier Implementation
  // ==========================================================================
  
  async classifyInput(
    input: string, 
    method?: string,
    context?: ProcessingContext
  ): Promise<InputClassificationResult> {
    const trimmed = input.trim()
    
    if (!trimmed) {
      return {
        type: 'prompt',
        confidence: 0.0,
        detectionMethod: 'rule-based',
        metadata: new Map([['reason', 'empty_input']]),
        extractedData: new Map([['content', '']])
      }
    }
    
    // Fast path: command detection
    if (this.isCommand(trimmed)) {
      const commandInfo = this.extractCommand(trimmed)
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
      }
    }
    
    // Simple classification: default to prompt
    // In a real implementation, this would include workflow detection
    return {
      type: 'prompt',
      confidence: 0.9,
      detectionMethod: 'rule-based',
      metadata: new Map([
        ['wordCount', trimmed.split(/\s+/).length.toString()],
        ['length', trimmed.length.toString()]
      ]),
      extractedData: new Map([['content', trimmed]])
    }
  }
  
  getSupportedTypes(): readonly string[] {
    return ['command', 'prompt', 'workflow']
  }
  
  getSupportedMethods(): readonly ClassificationMethod[] {
    return ['rule-based']
  }
  
  updateClassificationRules(config: any): void {
    // Basic parser doesn't support dynamic rule updates
    console.debug('Basic parser does not support dynamic rule updates')
  }

  // ==========================================================================
  // CLI Framework Compatibility Methods
  // ==========================================================================

  configure(config: any): void {
    if (config.confidenceThreshold) {
      this.config = { ...this.config, confidenceThreshold: config.confidenceThreshold }
    }
  }

  async parse(input: string): Promise<InputClassificationResult> {
    return this.classifyInput(input)
  }

  extractCommandInfo(input: string): CommandInfo {
    return this.extractCommand(input)
  }
  
  // ==========================================================================
  // Helper Methods
  // ==========================================================================
  
  private isCommand(input: string): boolean {
    const trimmed = input.trim()
    return trimmed.startsWith('/') && trimmed.length > 1
  }
  
  private extractCommand(input: string): CommandInfo {
    const trimmed = input.trim()
    
    if (!this.isCommand(trimmed)) {
      return {
        name: '',
        args: [],
        rawInput: trimmed
      }
    }
    
    // Remove leading slash and split by whitespace
    const withoutSlash = trimmed.slice(1)
    const parts = this.splitCommandLine(withoutSlash)
    
    return {
      name: parts[0] || '',
      args: parts.slice(1),
      rawInput: trimmed
    }
  }
  
  // ==========================================================================
  // Private Helper Methods
  // ==========================================================================
  
  /**
   * Split command line respecting quotes and escapes
   */
  private splitCommandLine(input: string): string[] {
    const args: string[] = []
    let current = ''
    let inQuotes = false
    let quoteChar = ''
    let escaped = false
    
    for (let i = 0; i < input.length; i++) {
      const char = input[i]
      
      if (escaped) {
        current += char
        escaped = false
        continue
      }
      
      if (char === '\\') {
        escaped = true
        continue
      }
      
      if (!inQuotes && (char === '"' || char === "'")) {
        inQuotes = true
        quoteChar = char
        continue
      }
      
      if (inQuotes && char === quoteChar) {
        inQuotes = false
        quoteChar = ''
        continue
      }
      
      if (!inQuotes && /\s/.test(char)) {
        if (current) {
          args.push(current)
          current = ''
        }
        continue
      }
      
      current += char
    }
    
    if (current) {
      args.push(current)
    }
    
    return args
  }
  
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create a basic CLI parser with default configuration
 */
export function createParser(config?: Partial<BasicParserConfig>): CLIParser {
  return new CLIParser(config)
}

/**
 * Create a simple parser for development use
 */
export function createSimpleParser(): CLIParser {
  return new CLIParser({ confidenceThreshold: 0.6 })
}