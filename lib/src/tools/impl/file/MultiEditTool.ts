/**
 * @qi/tools - MultiEdit Tool Implementation
 *
 * Atomic batch editing with multiple string replacements in a single operation.
 * Provides transactional safety - either all edits succeed or none are applied.
 */

import * as path from 'node:path';
import {
  failure,
  type QiError,
  type Result,
  success,
  systemError,
  validationError,
} from '@qi/base';
import { z } from 'zod';
import type { ToolContext } from '../../core/interfaces/index.js';
import { BaseFileTool } from './BaseTool.js';
import { EditTool } from './EditTool.js';

/**
 * Single edit operation schema
 */
const EditOperationSchema = z.object({
  old_string: z.string().min(1, 'Old string cannot be empty'),
  new_string: z.string(),
  replace_all: z.boolean().optional().default(false),
});

/**
 * Input schema for MultiEditTool
 */
const MultiEditToolInputSchema = z.object({
  file_path: z.string().min(1, 'File path is required'),
  edits: z.array(EditOperationSchema).min(1, 'At least one edit operation is required'),
});

type EditOperation = z.infer<typeof EditOperationSchema>;
type MultiEditToolInput = z.infer<typeof MultiEditToolInputSchema>;

/**
 * Output type for MultiEditTool
 */
interface MultiEditToolOutput {
  success: boolean;
  file_path: string;
  total_edits: number;
  successful_edits: number;
  total_replacements: number;
  bytes_written: number;
  edit_results: Array<{
    edit_index: number;
    old_string: string;
    new_string: string;
    replacements_made: number;
    success: boolean;
    error?: string;
  }>;
}

/**
 * Multi-edit tool for atomic batch editing operations:
 * - Transactional safety (all or nothing)
 * - Sequential edit application
 * - Comprehensive result reporting
 * - Same forced-read requirement as EditTool
 */
export class MultiEditTool extends BaseFileTool<MultiEditToolInput, MultiEditToolOutput> {
  readonly name = 'MultiEdit';
  readonly description = 'Perform multiple atomic string replacements in a single file';
  readonly version = '1.0.0';
  readonly inputSchema = MultiEditToolInputSchema;
  readonly isReadOnly = false;
  readonly isConcurrencySafe = false;

  async executeImpl(
    input: MultiEditToolInput,
    _context: ToolContext
  ): Promise<Result<MultiEditToolOutput, QiError>> {
    const { file_path, edits } = input;

    try {
      // Check if file was read before editing (Claude Code pattern)
      if (!EditTool.wasFileRead(file_path)) {
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

      let currentContent = contentResult.value;
      const _originalContent = contentResult.value;

      const editResults: MultiEditToolOutput['edit_results'] = [];
      let totalReplacements = 0;
      let successfulEdits = 0;

      // Apply edits sequentially
      for (let i = 0; i < edits.length; i++) {
        const edit = edits[i];
        const editResult = this.applyEdit(currentContent, edit, i);

        editResults.push({
          edit_index: i,
          old_string: edit.old_string,
          new_string: edit.new_string,
          replacements_made: editResult.replacements,
          success: editResult.success,
          error: editResult.error,
        });

        if (editResult.success) {
          currentContent = editResult.newContent;
          totalReplacements += editResult.replacements;
          successfulEdits++;
        } else {
          // On failure, revert to original content and report failure
          return failure(
            validationError(
              `Edit ${i + 1} failed: ${editResult.error}. No changes were made to maintain file integrity.`
            )
          );
        }
      }

      // All edits successful - write the final content
      const writeResult = await this.writeFileSafe(file_path, currentContent);
      if (writeResult.tag === 'failure') {
        return writeResult;
      }

      return success({
        success: true,
        file_path,
        total_edits: edits.length,
        successful_edits: successfulEdits,
        total_replacements: totalReplacements,
        bytes_written: Buffer.byteLength(currentContent, 'utf-8'),
        edit_results: editResults,
      });
    } catch (error) {
      return failure(
        systemError(
          `Failed to perform multi-edit on '${file_path}': ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Validate input with multi-edit specific checks
   */
  validate(input: MultiEditToolInput): Result<void, QiError> {
    // Path must be absolute
    if (!path.isAbsolute(input.file_path)) {
      return failure(validationError('File path must be absolute'));
    }

    // Validate each edit operation
    for (let i = 0; i < input.edits.length; i++) {
      const edit = input.edits[i];

      // Old string cannot be empty
      if (edit.old_string.trim().length === 0) {
        return failure(
          validationError(`Edit ${i + 1}: Old string cannot be empty or whitespace-only`)
        );
      }

      // Prevent identical old/new strings
      if (edit.old_string === edit.new_string) {
        return failure(validationError(`Edit ${i + 1}: Old string and new string are identical`));
      }

      // Check for extremely large replacements
      if (edit.old_string.length > 50000 || edit.new_string.length > 50000) {
        return failure(
          validationError(`Edit ${i + 1}: String length cannot exceed 50,000 characters`)
        );
      }
    }

    // Check for conflicting edits (same old_string with different new_string)
    const oldStrings = new Map<string, number>();
    for (let i = 0; i < input.edits.length; i++) {
      const oldString = input.edits[i].old_string;
      const existingIndex = oldStrings.get(oldString);

      if (existingIndex !== undefined) {
        const existingEdit = input.edits[existingIndex];
        const currentEdit = input.edits[i];

        if (existingEdit.new_string !== currentEdit.new_string) {
          return failure(
            validationError(
              `Conflicting edits: Edit ${existingIndex + 1} and Edit ${i + 1} both target "${oldString}" but with different replacements`
            )
          );
        }
      } else {
        oldStrings.set(oldString, i);
      }
    }

    // Limit number of edits to prevent abuse
    if (input.edits.length > 100) {
      return failure(validationError('Maximum 100 edit operations per multi-edit'));
    }

    return success(undefined);
  }

  /**
   * Apply a single edit operation to content
   */
  private applyEdit(
    content: string,
    edit: EditOperation,
    _editIndex: number
  ): { success: boolean; newContent: string; replacements: number; error?: string } {
    try {
      const { old_string, new_string, replace_all } = edit;

      // Check if old_string exists in content
      if (!content.includes(old_string)) {
        return {
          success: false,
          newContent: content,
          replacements: 0,
          error: `String "${old_string}" not found in file content`,
        };
      }

      // Perform replacement
      let newContent: string;
      let replacements: number;

      if (replace_all) {
        const parts = content.split(old_string);
        replacements = parts.length - 1;
        newContent = parts.join(new_string);
      } else {
        // Replace only first occurrence
        const index = content.indexOf(old_string);
        if (index === -1) {
          replacements = 0;
          newContent = content;
        } else {
          replacements = 1;
          newContent =
            content.substring(0, index) + new_string + content.substring(index + old_string.length);
        }
      }

      return {
        success: true,
        newContent,
        replacements,
      };
    } catch (error) {
      return {
        success: false,
        newContent: content,
        replacements: 0,
        error: error instanceof Error ? error.message : String(error),
      };
    }
  }
}
