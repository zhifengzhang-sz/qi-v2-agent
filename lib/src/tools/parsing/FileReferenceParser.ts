/**
 * File Reference Parser Tool
 * 
 * Parses and extracts file references from text input.
 * Supports Claude Code-style @file.txt patterns and variations.
 */

/**
 * Parsed file reference information
 */
export interface ParsedFileReference {
  readonly original: string;        // Original matched text
  readonly filePath: string;       // Extracted file path
  readonly startIndex: number;     // Position in original text
  readonly endIndex: number;       // End position in original text
  readonly context?: string;       // Surrounding context
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * File reference parsing result
 */
export interface FileReferenceParsingResult {
  readonly input: string;
  readonly references: readonly ParsedFileReference[];
  readonly hasReferences: boolean;
  readonly cleanedInput: string;   // Input with references removed or marked
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * File reference parser configuration
 */
export interface FileReferenceParserConfig {
  readonly patterns: readonly string[];
  readonly maxContextLength: number;
  readonly preserveReferences: boolean;  // Keep references in cleaned text
  readonly markReferences: boolean;      // Mark references with special syntax
  readonly caseInsensitive: boolean;
}

/**
 * Default configuration for file reference parser
 */
const DEFAULT_CONFIG: FileReferenceParserConfig = {
  patterns: [
    '@([^\\s\\n]+)',                    // @path/to/file
    '@"([^"]+)"',                       // @"path with spaces"
    '@\'([^\']+)\'',                    // @'path with spaces'
    '`([^`]+)`',                        // `path/to/file`
    '\\./([^\\s\\n]+)',                 // ./relative/path
    '\\.\\./([^\\s\\n]+)',              // ../relative/path
    '/([^\\s\\n]+)',                    // /absolute/path (be careful with this)
  ],
  maxContextLength: 50,
  preserveReferences: false,
  markReferences: true,
  caseInsensitive: false,
};

import type { Tool } from '../index.js';

/**
 * File Reference Parser Tool
 * 
 * Extracts file references from natural language input.
 */
export class FileReferenceParser implements Tool<string, FileReferenceParsingResult> {
  readonly name = 'FileReferenceParser';
  readonly description = 'Parses and extracts file references from text input';
  readonly version = '1.0.0';
  private config: FileReferenceParserConfig;
  private compiledPatterns: RegExp[];

  constructor(config: Partial<FileReferenceParserConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.compiledPatterns = this.compilePatterns();
  }

  /**
   * Tool interface implementation
   */
  async execute(input: string): Promise<FileReferenceParsingResult> {
    return this.parseFileReferences(input);
  }

  /**
   * Parse file references from input text
   */
  parseFileReferences(input: string): FileReferenceParsingResult {
    const references: ParsedFileReference[] = [];
    let cleanedInput = input;
    
    // Process each pattern
    for (const pattern of this.compiledPatterns) {
      const matches = [...input.matchAll(pattern)];
      
      for (const match of matches) {
        if (match.index === undefined) continue;

        const original = match[0];
        const filePath = match[1] || match[0]; // Use capture group or full match
        const startIndex = match.index;
        const endIndex = startIndex + original.length;

        // Extract context around the reference
        const context = this.extractContext(input, startIndex, endIndex);

        // Skip if this looks like a false positive
        if (this.isFalsePositive(filePath, original, context)) {
          continue;
        }

        const metadata = new Map<string, unknown>();
        metadata.set('pattern', pattern.source);
        metadata.set('matchedAt', new Date().toISOString());
        metadata.set('confidence', this.calculateConfidence(filePath, original, context));

        references.push({
          original,
          filePath: this.normalizePath(filePath),
          startIndex,
          endIndex,
          context,
          metadata,
        });
      }
    }

    // Remove duplicates (same file path)
    const uniqueReferences = this.deduplicateReferences(references);

    // Process cleaned input
    if (!this.config.preserveReferences) {
      cleanedInput = this.removeReferences(input, uniqueReferences);
    } else if (this.config.markReferences) {
      cleanedInput = this.markReferences(input, uniqueReferences);
    }

    const metadata = new Map<string, unknown>();
    metadata.set('parsedAt', new Date().toISOString());
    metadata.set('totalMatches', references.length);
    metadata.set('uniqueReferences', uniqueReferences.length);

    return {
      input,
      references: uniqueReferences,
      hasReferences: uniqueReferences.length > 0,
      cleanedInput,
      metadata,
    };
  }

  /**
   * Check if the input contains file references
   */
  hasFileReferences(input: string): boolean {
    return this.compiledPatterns.some(pattern => pattern.test(input));
  }

  /**
   * Extract only file paths from input
   */
  extractFilePaths(input: string): string[] {
    const result = this.parseFileReferences(input);
    return result.references.map(ref => ref.filePath);
  }

  /**
   * Compile regex patterns from configuration
   */
  private compilePatterns(): RegExp[] {
    const flags = this.config.caseInsensitive ? 'gi' : 'g';
    
    return this.config.patterns.map(pattern => {
      try {
        return new RegExp(pattern, flags);
      } catch (error) {
        console.warn(`Invalid file reference pattern: ${pattern}`, error);
        return new RegExp('$^', flags); // Never matches
      }
    });
  }

  /**
   * Extract context around a file reference
   */
  private extractContext(input: string, startIndex: number, endIndex: number): string {
    const contextStart = Math.max(0, startIndex - this.config.maxContextLength);
    const contextEnd = Math.min(input.length, endIndex + this.config.maxContextLength);
    
    return input.substring(contextStart, contextEnd).trim();
  }

  /**
   * Check if a match is likely a false positive
   */
  private isFalsePositive(filePath: string, original: string, context: string): boolean {
    // Skip very short paths
    if (filePath.length < 2) {
      return true;
    }

    // Skip paths that are just numbers or common words
    if (/^\d+$/.test(filePath) || /^(and|or|the|a|an|is|are|was|were)$/i.test(filePath)) {
      return true;
    }

    // Skip URLs (basic check)
    if (filePath.includes('http://') || filePath.includes('https://') || filePath.includes('://')) {
      return true;
    }

    // Skip email addresses
    if (filePath.includes('@') && filePath.includes('.') && !filePath.includes('/')) {
      return true;
    }

    // Skip if it looks like it's part of code or configuration
    if (context.includes('=') && context.includes('"')) {
      return true;
    }

    return false;
  }

  /**
   * Calculate confidence score for a file reference match
   */
  private calculateConfidence(filePath: string, original: string, context: string): number {
    let confidence = 0.5; // Base confidence

    // File extension boosts confidence
    if (/\.[a-zA-Z]+$/.test(filePath)) {
      confidence += 0.2;
    }

    // Common programming file extensions boost more
    if (/\.(js|ts|tsx|jsx|py|java|cpp|h|cs|rb|go|rs|php|html|css|md|json|yaml|yml)$/.test(filePath)) {
      confidence += 0.2;
    }

    // Path separators indicate it's likely a file path
    if (filePath.includes('/') || filePath.includes('\\')) {
      confidence += 0.1;
    }

    // @ prefix is strong indicator
    if (original.startsWith('@')) {
      confidence += 0.2;
    }

    // Context mentions like "file", "look at", "check" boost confidence
    if (/\b(file|look\s+at|check|see|open|read|in)\b/i.test(context)) {
      confidence += 0.1;
    }

    return Math.min(1.0, confidence);
  }

  /**
   * Normalize file path (remove quotes, clean separators)
   */
  private normalizePath(filePath: string): string {
    return filePath
      .replace(/^["']|["']$/g, '') // Remove surrounding quotes
      .replace(/\\/g, '/');        // Normalize path separators
  }

  /**
   * Remove duplicate references (same file path)
   */
  private deduplicateReferences(references: ParsedFileReference[]): ParsedFileReference[] {
    const seen = new Set<string>();
    const unique: ParsedFileReference[] = [];

    for (const ref of references) {
      if (!seen.has(ref.filePath)) {
        seen.add(ref.filePath);
        unique.push(ref);
      }
    }

    return unique;
  }

  /**
   * Remove file references from input text
   */
  private removeReferences(input: string, references: ParsedFileReference[]): string {
    // Sort by position (descending) to avoid index issues
    const sortedRefs = [...references].sort((a, b) => b.startIndex - a.startIndex);
    
    let result = input;
    
    for (const ref of sortedRefs) {
      const before = result.substring(0, ref.startIndex);
      const after = result.substring(ref.endIndex);
      
      // Clean up extra whitespace
      result = (before.trimEnd() + ' ' + after.trimStart()).trim();
    }
    
    return result;
  }

  /**
   * Mark file references in input text
   */
  private markReferences(input: string, references: ParsedFileReference[]): string {
    // Sort by position (descending) to avoid index issues
    const sortedRefs = [...references].sort((a, b) => b.startIndex - a.startIndex);
    
    let result = input;
    
    for (const ref of sortedRefs) {
      const before = result.substring(0, ref.startIndex);
      const after = result.substring(ref.endIndex);
      const marked = `[FILE:${ref.filePath}]`;
      
      result = before + marked + after;
    }
    
    return result;
  }
}