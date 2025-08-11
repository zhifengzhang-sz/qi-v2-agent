/**
 * File Reference Workflow
 *
 * Handles @file.txt patterns by resolving file content and enhancing prompts.
 * This is a bounded, simple workflow with max 3 operations.
 */

import type { FileContentResolver, FileReferenceParser } from '../tools/index.js';
import {
  SimpleWorkflow,
  SimpleWorkflowClass,
  type WorkflowInput,
  type WorkflowResult,
} from './SimpleWorkflow.js';

/**
 * File Reference Workflow Implementation
 *
 * Workflow steps (max 3):
 * 1. Parse file references from input
 * 2. Resolve file content using FileContentResolver
 * 3. Enhance prompt with file content
 */
export class FileReferenceWorkflow extends SimpleWorkflow {
  /**
   * Get the workflow class this handles
   */
  getWorkflowClass(): SimpleWorkflowClass {
    return SimpleWorkflowClass.FILE_REFERENCE;
  }

  /**
   * Get workflow description
   */
  getDescription(): string {
    return 'Processes file references (@file.txt) and includes content in prompts';
  }

  /**
   * Check if this workflow can handle the input
   */
  canHandle(input: WorkflowInput): boolean {
    return (
      input.classification === SimpleWorkflowClass.FILE_REFERENCE &&
      this.hasFileReferences(input.originalInput)
    );
  }

  /**
   * Execute the file reference workflow
   */
  async execute(input: WorkflowInput): Promise<WorkflowResult> {
    const metadata = new Map<string, unknown>();
    metadata.set('workflowClass', this.getWorkflowClass());
    metadata.set('executedAt', new Date().toISOString());

    try {
      // Validate complexity upfront (3 operations max)
      this.validateComplexity(3);

      // Operation 1: Parse file references from input
      const parser = this.toolRegistry.get<FileReferenceParser>('file-reference-parser');
      if (!parser) {
        return this.createErrorResult('FileReferenceParser tool not available', metadata);
      }

      const parseResult = await parser.execute(input.originalInput);
      metadata.set('referencesFound', parseResult.references.length);

      if (!parseResult.hasReferences) {
        return this.createErrorResult('No file references found in input', metadata);
      }

      // Limit number of files to maintain bounded complexity
      const maxFiles = 5;
      if (parseResult.references.length > maxFiles) {
        metadata.set('referencesLimited', true);
        metadata.set('originalReferenceCount', parseResult.references.length);
      }

      const references = parseResult.references.slice(0, maxFiles);

      // Operation 2: Resolve file content
      const resolver = this.toolRegistry.get<FileContentResolver>('file-content-resolver');
      if (!resolver) {
        return this.createErrorResult('FileContentResolver tool not available', metadata);
      }

      const filePaths = references.map((ref) => ref.filePath);
      const basePath = input.projectPath || process.cwd();

      // Resolve each file individually since the tool interface expects single input
      const fileReferences = await Promise.all(
        filePaths.map((filePath) => resolver.resolveFile(filePath, basePath))
      );

      const validFiles = fileReferences.filter((ref) => ref.exists && ref.content);
      const invalidFiles = fileReferences.filter((ref) => !ref.exists || ref.error);

      metadata.set('validFiles', validFiles.length);
      metadata.set('invalidFiles', invalidFiles.length);

      // Operation 3: Enhance prompt with file content
      // Filter out files with undefined content
      const filesWithContent = validFiles.filter((file) => file.content !== undefined) as Array<{
        relativePath: string;
        content: string;
        lastModified?: Date;
      }>;

      const enhancedPrompt = this.buildEnhancedPrompt(
        parseResult.cleanedInput,
        filesWithContent,
        invalidFiles
      );

      metadata.set('enhancedPromptLength', enhancedPrompt.length);
      metadata.set('originalPromptLength', input.originalInput.length);

      return this.createSuccessResult(
        enhancedPrompt,
        metadata,
        validFiles.map((ref) => ref.relativePath),
        ['file-content', 'project-structure']
      );
    } catch (error) {
      metadata.set('error', error instanceof Error ? error.message : 'Unknown error');
      return this.createErrorResult(
        `File reference workflow failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        metadata
      );
    }
  }

  /**
   * Check if input contains file references
   */
  private hasFileReferences(input: string): boolean {
    // Simple check for common file reference patterns
    const patterns = [
      /@[^\s\n]+/, // @path/to/file
      /@"[^"]+"/, // @"path with spaces"
      /@'[^']+'/, // @'path with spaces'
    ];

    return patterns.some((pattern) => pattern.test(input));
  }

  /**
   * Build enhanced prompt with file content
   */
  private buildEnhancedPrompt(
    cleanedInput: string,
    validFiles: Array<{ relativePath: string; content: string; lastModified?: Date }>,
    invalidFiles: Array<{ relativePath: string; error?: string }>
  ): string {
    let enhanced = '';

    // Add file content sections
    if (validFiles.length > 0) {
      enhanced += '# Referenced Files\n\n';

      for (const file of validFiles) {
        enhanced += `## ${file.relativePath}\n`;
        if (file.lastModified) {
          enhanced += `*Last modified: ${file.lastModified.toISOString()}*\n\n`;
        }
        enhanced += '```\n';
        enhanced += file.content;
        enhanced += '\n```\n\n';
      }
    }

    // Add information about invalid files
    if (invalidFiles.length > 0) {
      enhanced += '# Unavailable Files\n\n';

      for (const file of invalidFiles) {
        enhanced += `- **${file.relativePath}**: ${file.error || 'File not found'}\n`;
      }
      enhanced += '\n';
    }

    // Add the original prompt
    enhanced += '# Request\n\n';
    enhanced += cleanedInput;

    return enhanced;
  }
}
