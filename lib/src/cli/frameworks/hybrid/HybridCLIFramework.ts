/**
 * Hybrid CLI Framework Implementation - CORRECT APPROACH
 *
 * Based on Claude Code analysis - uses Ink's React components for UI
 * with enhanced cursor navigation logic (no raw terminal takeover).
 *
 * Architecture:
 * - Extends InkCLIFramework for full React/Ink UI capabilities
 * - Adds sophisticated Cursor-based navigation logic
 * - Claude Code-style down arrow behavior: move to end → history
 */

import { Cursor } from '../../../utils/Cursor.js';
import type { CLIConfig } from '../../abstractions/ICLIFramework.js';
import { InkCLIFramework } from '../ink/InkCLIFramework.js';

/**
 * Hybrid CLI Framework that enhances Ink with Claude Code-style navigation
 *
 * Key Features:
 * - Full Ink React components for rich UI (progress bars, styling, etc.)
 * - Enhanced cursor navigation using Claude Code's Cursor class
 * - Smart down arrow behavior: cursor to end, then history navigation
 * - Maintains all Ink framework benefits
 */
export class HybridCLIFramework extends InkCLIFramework {
  public isHybridEnabled = true; // Public flag for InputBox detection
  private cursorAtEndState = false; // Track if cursor moved to end on last down arrow

  constructor(config: CLIConfig) {
    super(config);
  }

  /**
   * Enhanced input handling with Claude Code navigation logic
   */
  public handleClaudeCodeNavigation(
    text: string,
    cursorOffset: number,
    columns: number,
    key: { name?: string }
  ): {
    shouldTriggerHistory: boolean;
    newCursorOffset?: number;
    resetCursorEndState?: boolean;
  } {
    if (key.name === 'down') {
      return this.handleDownArrowNavigation(text, cursorOffset, columns);
    } else if (key.name === 'up') {
      // Reset cursor end state on up arrow
      this.cursorAtEndState = false;
      return { shouldTriggerHistory: false, resetCursorEndState: true };
    } else {
      // Reset cursor end state on any other key
      this.cursorAtEndState = false;
      return { shouldTriggerHistory: false, resetCursorEndState: true };
    }
  }

  /**
   * Handle down arrow with Claude Code two-step behavior
   */
  private handleDownArrowNavigation(
    text: string,
    cursorOffset: number,
    columns: number
  ): {
    shouldTriggerHistory: boolean;
    newCursorOffset?: number;
  } {
    // Create cursor from current state
    const cursor = Cursor.fromText(text, columns, cursorOffset);

    // Try to move cursor down
    const cursorDown = cursor.down();

    // Check if cursor movement succeeded (Claude Code logic)
    if (cursorDown.equals(cursor)) {
      // Cursor can't move down - we're on the last line

      if (!this.cursorAtEndState && cursorOffset < text.length) {
        // STEP 1: Move cursor to end of input
        this.cursorAtEndState = true;
        return {
          shouldTriggerHistory: false,
          newCursorOffset: text.length,
        };
      } else {
        // STEP 2: Cursor already at end - trigger history navigation
        this.cursorAtEndState = false;
        return { shouldTriggerHistory: true };
      }
    } else {
      // Cursor moved successfully to next line - normal navigation
      this.cursorAtEndState = false;
      return {
        shouldTriggerHistory: false,
        newCursorOffset: cursorDown.offset,
      };
    }
  }

  /**
   * Create Cursor instance for external use (by InputBox)
   */
  public createCursor(text: string, columns: number, offset: number = 0): Cursor {
    return Cursor.fromText(text, columns, offset);
  }

  /**
   * Get cursor navigation methods for InputBox integration
   */
  public getCursorMethods(cursor: Cursor) {
    return {
      up: () => cursor.up(),
      down: () => cursor.down(),
      left: () => cursor.left(),
      right: () => cursor.right(),
      startOfLine: () => cursor.startOfLine(),
      endOfLine: () => cursor.endOfLine(),
      nextWord: () => cursor.nextWord(),
      prevWord: () => cursor.prevWord(),
      insert: (text: string) => cursor.insert(text),
      backspace: () => cursor.backspace(),
      del: () => cursor.del(),
    };
  }

  /**
   * Check if two cursors are at the same position (for Claude Code logic)
   */
  public cursorsEqual(cursor1: Cursor, cursor2: Cursor): boolean {
    return cursor1.equals(cursor2);
  }

  /**
   * Reset cursor end state (called by InputBox on input changes)
   */
  public resetCursorEndState(): void {
    this.cursorAtEndState = false;
  }

  /**
   * Override parent's input handling to add hybrid navigation
   */
  public handleInput(input: string): void {
    // Reset cursor state on new input
    this.resetCursorEndState();

    // Delegate to parent Ink framework
    super.handleInput(input);
  }

  /**
   * Get hybrid framework statistics
   */
  public getHybridStats() {
    return {
      isHybridEnabled: this.isHybridEnabled,
      cursorAtEndState: this.cursorAtEndState,
      framework: 'hybrid',
      parentFramework: 'ink',
    };
  }
}
