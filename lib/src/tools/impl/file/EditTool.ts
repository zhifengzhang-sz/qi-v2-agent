/**
 * @qi/tools - Edit Tool Implementation
 *
 * Precise string replacement editing with Claude Code's "forced read" pattern.
 * Requires file to be read before editing to ensure context awareness.
 */

import * as path from 'node:path';
import { failure, type QiError, type Result, success, validationError } from '@qi/base';
import { z } from 'zod';
import type { ToolContext } from '../../core/interfaces/index.js';
import { BaseFileTool } from './BaseTool.js';

/**
 * Input schema for EditTool
 */
const EditToolInputSchema = z.object({
  file_path: z.string().min(1, 'File path is required'),
  old_string: z.string().min(1, 'Old string cannot be empty'),
  new_string: z.string(),
  replace_all: z.boolean().optional().default(false),
});

type EditToolInput = z.infer<typeof EditToolInputSchema>;

/**
 * Output type for EditTool
 */
interface EditToolOutput {
  success: boolean;
  file_path: string;
  replacements_made: number;
  bytes_written: number;
  preview?: {
    before: string;
    after: string;
  };
}

/**
 * String replacement editing tool following Claude Code patterns:
 * - Forced read requirement (must read file before editing)
 * - Exact string matching for safety
 * - Replace all vs single replacement
 * - Context preview for verification
 */
export class EditTool extends BaseFileTool<EditToolInput, EditToolOutput> {
  readonly name = 'Edit';
  readonly description = 'Edit files using precise string replacement';
  readonly version = '1.0.0';
  readonly inputSchema = EditToolInputSchema;
  readonly isReadOnly = false;
  readonly isConcurrencySafe = false;

  private static readonly fileReadHistory = new Set<string>();

  async executeImpl(
    input: EditToolInput,
    _context: ToolContext
  ): Promise<Result<EditToolOutput, QiError>> {
    const { file_path, old_string, new_string, replace_all } = input;

    // Claude Code pattern: Check if file was read before editing
    if (!EditTool.fileReadHistory.has(file_path)) {
      return failure(
        validationError(
          `File '${file_path}' must be read before editing. Use the Read tool first to ensure context awareness.`
        )
      );
    }

    // Read current file content
    const contentResult = await this.readFileSafe(file_path);
    if (contentResult.tag === 'failure') {
      return contentResult;
    }

    const originalContent = contentResult.value;

    // Check if old_string exists in content
    if (!originalContent.includes(old_string)) {
      return failure(
        validationError(
          `String to replace not found in file. Ensure exact match including whitespace and line endings.`
        )
      );
    }

    // Prevent replacing with identical string
    if (old_string === new_string) {
      return failure(
        validationError('Old string and new string are identical. No changes needed.')
      );
    }

    // Perform replacement
    let newContent: string;
    let replacementCount: number;

    if (replace_all) {
      const parts = originalContent.split(old_string);
      replacementCount = parts.length - 1;
      newContent = parts.join(new_string);
    } else {
      // Replace only first occurrence
      const index = originalContent.indexOf(old_string);
      if (index === -1) {
        replacementCount = 0;
        newContent = originalContent;
      } else {
        replacementCount = 1;
        newContent =
          originalContent.substring(0, index) +
          new_string +
          originalContent.substring(index + old_string.length);
      }
    }

    if (replacementCount === 0) {
      return failure(validationError('No replacements were made'));
    }

    // Write modified content
    const writeResult = await this.writeFileSafe(file_path, newContent);
    if (writeResult.tag === 'failure') {
      return writeResult;
    }

    // Create preview for verification
    const preview = this.createPreview(originalContent, newContent, old_string, new_string);

    return success({
      success: true,
      file_path,
      replacements_made: replacementCount,
      bytes_written: Buffer.byteLength(newContent, 'utf-8'),
      preview,
    });
  }

  /**
   * Validate input with additional edit-specific checks
   */
  validate(input: EditToolInput): Result<void, QiError> {
    // Path must be absolute
    if (!path.isAbsolute(input.file_path)) {
      return failure(validationError('File path must be absolute'));
    }

    // Old string cannot be empty (required for safety)
    if (input.old_string.trim().length === 0) {
      return failure(validationError('Old string cannot be empty or whitespace-only'));
    }

    // Prevent extremely large replacements
    if (input.old_string.length > 100000 || input.new_string.length > 100000) {
      return failure(validationError('String length cannot exceed 100,000 characters'));
    }

    // Warn about potentially dangerous replacements
    const dangerousPatterns = [
      /rm\s+-rf/gi,
      /sudo\s+/gi,
      /chmod\s+777/gi,
      /<script>/gi,
      /eval\(/gi,
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input.new_string)) {
        return failure(
          validationError(`New string contains potentially dangerous content: ${pattern.source}`)
        );
      }
    }

    return success(undefined);
  }

  /**
   * Create a preview showing before/after context
   */
  private createPreview(
    originalContent: string,
    newContent: string,
    oldString: string,
    newString: string
  ): { before: string; after: string } {
    const maxPreviewLength = 200;

    // Find the first occurrence for preview
    const index = originalContent.indexOf(oldString);
    if (index === -1) {
      return { before: 'No changes', after: 'No changes' };
    }

    // Extract context around the change
    const contextStart = Math.max(0, index - maxPreviewLength / 2);
    const contextEnd = Math.min(
      originalContent.length,
      index + oldString.length + maxPreviewLength / 2
    );

    const beforeContext = originalContent.substring(contextStart, contextEnd);

    // For after context, we need to find where the replacement occurred in new content
    const newIndex = newContent.indexOf(newString);
    const newContextStart = Math.max(0, newIndex - maxPreviewLength / 2);
    const newContextEnd = Math.min(
      newContent.length,
      newIndex + newString.length + maxPreviewLength / 2
    );

    const afterContext = newContent.substring(newContextStart, newContextEnd);

    return {
      before: beforeContext,
      after: afterContext,
    };
  }

  /**
   * Static method to mark file as read (called by ReadTool)
   */
  static markFileAsRead(filePath: string): void {
    EditTool.fileReadHistory.add(filePath);
  }

  /**
   * Static method to check if file was read
   */
  static wasFileRead(filePath: string): boolean {
    return EditTool.fileReadHistory.has(filePath);
  }

  /**
   * Clear read history (for testing or session reset)
   */
  static clearReadHistory(): void {
    EditTool.fileReadHistory.clear();
  }
}
