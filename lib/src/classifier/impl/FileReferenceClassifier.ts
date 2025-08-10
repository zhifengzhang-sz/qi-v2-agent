/**
 * File Reference Classifier
 * 
 * Classifies input text to detect file references and determine workflow routing.
 * Replaces the "enhanced" classifier with proper functional naming.
 */

import { create, fromAsyncTryCatch, match, success, failure, type Result } from '@qi/base';
import type { 
  IClassificationMethod, 
  ClassificationMethod, 
  ClassificationResult,
  ClassificationType,
  ProcessingContext 
} from '../abstractions/index.js';
import { FileReferenceParser } from '../../tools/parsing/FileReferenceParser.js';
import { SimpleWorkflowClass } from '../../workflows/index.js';

/**
 * File-aware classification result with enhanced metadata
 */
export interface FileAwareClassificationResult extends ClassificationResult {
  readonly fileReferences: readonly string[];
  readonly workflowClass?: SimpleWorkflowClass;
  readonly hasExtendedThinking: boolean;
  readonly contextContinuation: boolean;
}

/**
 * File reference classifier configuration
 */
export interface FileReferenceClassifierConfig {
  readonly enableFileAwareness: boolean;
  readonly enableExtendedThinking: boolean;
  readonly enableContextContinuation: boolean;
  readonly confidenceThresholds: Map<string, number>;
  readonly fileReferencePatterns: readonly string[];
}

/**
 * Default configuration for file reference classifier
 */
const DEFAULT_CONFIG: FileReferenceClassifierConfig = {
  enableFileAwareness: true,
  enableExtendedThinking: true,
  enableContextContinuation: true,
  confidenceThresholds: new Map([
    ['command', 1.0],
    ['prompt', 0.8],
    ['simple-workflow', 0.7],
  ]),
  fileReferencePatterns: [
    '@([^\\s\\n]+)',
    '@"([^"]+)"',
    '@\'([^\']+)\'',
    '\\./([^\\s\\n]+)',
    '\\.\\./([^\\s\\n]+)',
  ],
};

/**
 * File Reference Classifier
 * 
 * Advanced input classification with file awareness and pattern recognition.
 */
export class FileReferenceClassifier implements IClassificationMethod {
  private config: FileReferenceClassifierConfig;
  private fileReferenceParser: FileReferenceParser;

  constructor(config: Partial<FileReferenceClassifierConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.fileReferenceParser = new FileReferenceParser({
      patterns: [...this.config.fileReferencePatterns],
    });
  }

  /**
   * Get method identifier
   */
  getMethodName(): ClassificationMethod {
    return 'file-reference';
  }

  /**
   * Get expected accuracy for this method
   */
  getExpectedAccuracy(): number {
    return 0.85;
  }

  /**
   * Get average processing latency
   */
  getAverageLatency(): number {
    return 50; // 50ms average
  }

  /**
   * Check if method is available/ready
   */
  async isAvailable(): Promise<boolean> {
    return true; // File reference classification is always available
  }

  /**
   * Classify input with file awareness and workflow detection
   */
  async classify(input: string, context?: ProcessingContext): Promise<ClassificationResult> {
    const startTime = Date.now();
    const trimmedInput = input.trim();
    const metadata = new Map<string, unknown>();
    metadata.set('classifiedAt', new Date().toISOString());
    metadata.set('inputLength', trimmedInput.length);

    // Parse file references if file awareness is enabled
    let fileReferences: string[] = [];
    let workflowClass: SimpleWorkflowClass | undefined;

    if (this.config.enableFileAwareness) {
      const parseResult = await this.fileReferenceParser.execute(trimmedInput);
      fileReferences = parseResult.references.map(ref => ref.filePath);
      metadata.set('fileReferencesFound', fileReferences.length);

      // If file references found, this becomes a simple workflow
      if (fileReferences.length > 0) {
        workflowClass = SimpleWorkflowClass.FILE_REFERENCE;
        metadata.set('workflowClass', workflowClass);
      }
    }

    // Detect extended thinking patterns
    const hasExtendedThinking = this.config.enableExtendedThinking && 
      this.detectExtendedThinking(trimmedInput);
    metadata.set('hasExtendedThinking', hasExtendedThinking);

    // Detect context continuation patterns  
    const contextContinuation = this.config.enableContextContinuation &&
      this.detectContextContinuation(trimmedInput);
    metadata.set('contextContinuation', contextContinuation);

    // Determine primary classification
    const classification = this.determineClassification(
      trimmedInput, 
      fileReferences.length > 0,
      hasExtendedThinking,
      contextContinuation
    );

    const confidence = this.calculateConfidence(classification, {
      hasFileReferences: fileReferences.length > 0,
      hasExtendedThinking,
      contextContinuation,
      inputLength: trimmedInput.length,
    });

    metadata.set('classification', classification);
    metadata.set('confidence', confidence);
    metadata.set('processingTime', Date.now() - startTime);

    const extractedData = new Map<string, unknown>();
    extractedData.set('fileReferences', fileReferences);
    if (workflowClass) {
      extractedData.set('workflowClass', workflowClass);
    }
    extractedData.set('hasExtendedThinking', hasExtendedThinking);
    extractedData.set('contextContinuation', contextContinuation);

    return {
      type: classification as ClassificationType,
      confidence,
      method: this.getMethodName(),
      metadata,
      extractedData,
      reasoning: this.generateReasoning(classification, {
        fileReferences: fileReferences.length,
        hasExtendedThinking,
        contextContinuation,
        workflowClass,
      }),
    } as ClassificationResult;
  }

  /**
   * Determine the primary classification type
   */
  private determineClassification(
    input: string,
    hasFileReferences: boolean,
    hasExtendedThinking: boolean,
    contextContinuation: boolean
  ): string {
    // Command detection (highest priority)
    if (this.isCommand(input)) {
      return 'command';
    }

    // Simple workflow detection
    if (hasFileReferences) {
      return 'simple-workflow';
    }

    // Extended thinking or context continuation suggests complex prompt
    if (hasExtendedThinking || contextContinuation) {
      return 'prompt';
    }

    // Default to prompt for natural language
    if (this.isNaturalLanguage(input)) {
      return 'prompt';
    }

    // Fallback
    return 'unknown';
  }

  /**
   * Check if input is a command
   */
  private isCommand(input: string): boolean {
    const commandPattern = /^\/[a-zA-Z][a-zA-Z0-9-]*(\s|$)/;
    return commandPattern.test(input);
  }

  /**
   * Check if input is natural language
   */
  private isNaturalLanguage(input: string): boolean {
    // Simple heuristics for natural language
    const hasWords = /\b[a-zA-Z]{3,}\b/.test(input);
    const hasSpaces = /\s/.test(input);
    const hasQuestionOrStatement = /[.?!]/.test(input) || input.length > 10;
    
    return hasWords && hasSpaces && hasQuestionOrStatement;
  }

  /**
   * Detect extended thinking patterns
   */
  private detectExtendedThinking(input: string): boolean {
    const extendedThinkingPatterns = [
      /\bthink\s+(about|through|step\s+by\s+step)\b/i,
      /\banalyze\b.*\bcarefully\b/i,
      /\bconsider\b.*\boptions\b/i,
      /\bwalk\s+me\s+through\b/i,
      /\bexplain\s+in\s+detail\b/i,
      /\bbreak\s+down\b/i,
      /\bstep\s+by\s+step\b/i,
    ];

    return extendedThinkingPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Detect context continuation patterns
   */
  private detectContextContinuation(input: string): boolean {
    const continuationPatterns = [
      /\bcontinue\b/i,
      /\bkeep\s+going\b/i,
      /\bmore\s+details?\b/i,
      /\belaborate\b/i,
      /\bexpand\s+on\b/i,
      /\btell\s+me\s+more\b/i,
      /\bwhat\s+else\b/i,
    ];

    return continuationPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Calculate confidence score based on classification signals
   */
  private calculateConfidence(
    classification: string,
    signals: {
      hasFileReferences: boolean;
      hasExtendedThinking: boolean;
      contextContinuation: boolean;
      inputLength: number;
    }
  ): number {
    const baseConfidence = this.config.confidenceThresholds.get(classification) || 0.5;
    let confidence = baseConfidence;

    // Boost confidence for strong signals
    if (classification === 'command' && signals.inputLength < 50) {
      confidence = Math.min(1.0, confidence + 0.2);
    }

    if (classification === 'simple-workflow' && signals.hasFileReferences) {
      confidence = Math.min(1.0, confidence + 0.25);
    }

    if (classification === 'prompt') {
      if (signals.hasExtendedThinking) {
        confidence = Math.min(1.0, confidence + 0.1);
      }
      if (signals.contextContinuation) {
        confidence = Math.min(1.0, confidence + 0.1);
      }
    }

    // Adjust for input length (very short inputs are less reliable)
    if (signals.inputLength < 5) {
      confidence = Math.max(0.1, confidence - 0.3);
    }

    return confidence;
  }

  /**
   * Generate human-readable reasoning for the classification
   */
  private generateReasoning(
    classification: string,
    context: {
      fileReferences: number;
      hasExtendedThinking: boolean;
      contextContinuation: boolean;
      workflowClass?: SimpleWorkflowClass;
    }
  ): string {
    const reasons: string[] = [];

    switch (classification) {
      case 'command':
        reasons.push('Input starts with / indicating a command');
        break;
        
      case 'simple-workflow':
        reasons.push(`Found ${context.fileReferences} file reference(s)`);
        if (context.workflowClass) {
          reasons.push(`Classified as ${context.workflowClass} workflow`);
        }
        break;
        
      case 'prompt':
        reasons.push('Natural language input detected');
        if (context.hasExtendedThinking) {
          reasons.push('Extended thinking patterns detected');
        }
        if (context.contextContinuation) {
          reasons.push('Context continuation patterns detected');
        }
        break;
        
      default:
        reasons.push('Default classification applied');
    }

    return reasons.join('; ');
  }
}