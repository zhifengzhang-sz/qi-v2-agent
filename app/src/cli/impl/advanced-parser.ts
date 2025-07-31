/**
 * Advanced CLI Parser - Uses lib layer classification system
 * 
 * Wrapper around lib layer's InputClassifier with CLI-specific enhancements
 */

import type { 
  InputClassificationResult, 
  ClassificationConfig,
  IInputClassifier,
  ProcessingContext
} from '@qi/lib'

// Re-export the proper types from lib layer
export type { InputClassificationResult, ClassificationConfig }

// Legacy compatibility
export interface AdvancedParseResult extends InputClassificationResult {}

// ============================================================================
// Advanced Parser Wrapper 
// ============================================================================

/**
 * CLI wrapper around lib layer's InputClassifier
 * Provides legacy API compatibility while using the sophisticated lib classification
 */
export class AdvancedCLIParser {
  private classifier: IInputClassifier
  
  constructor(classifier: IInputClassifier) {
    this.classifier = classifier
  }
  
  /**
   * Main classification method - delegates to lib layer
   */
  async classifyInput(
    input: string,
    context?: ProcessingContext
  ): Promise<AdvancedParseResult> {
    return await this.classifier.classifyInput(input, 'rule-based', context)
  }
  
  /**
   * Get supported input types
   */
  getSupportedTypes(): readonly string[] {
    return this.classifier.getSupportedTypes()
  }
  
  /**
   * Get supported classification methods
   */
  getSupportedMethods(): readonly string[] {
    const methods = this.classifier.getSupportedMethods()
    return methods.map(m => m.toString())
  }
  
  /**
   * Update classification configuration
   */
  updateClassificationRules(config: ClassificationConfig): void {
    this.classifier.updateClassificationRules(config)
  }
}

// ============================================================================
// Factory Functions
// ============================================================================

/**
 * Create advanced parser with lib layer classifier
 */
export function createAdvancedParser(classifier: IInputClassifier): AdvancedCLIParser {
  return new AdvancedCLIParser(classifier)
}

/**
 * Create development parser (legacy compatibility)
 */
export function createDevelopmentParser(classifier: IInputClassifier): AdvancedCLIParser {
  return new AdvancedCLIParser(classifier)
}