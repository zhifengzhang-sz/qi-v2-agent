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
 * - QiCore integration with proper logging and error handling
 */

import { create, failure, match, type QiError, type Result, success } from '@qi/base';
import { ConfigBuilder, createLogger, type Logger, type ValidatedConfig } from '@qi/core';
import { Cursor } from '../../../utils/Cursor.js';
import type { CLIConfig } from '../../abstractions/ICLIFramework.js';
import { InkCLIFramework } from '../ink/InkCLIFramework.js';

/**
 * QiCore error types for hybrid framework operations
 */
interface HybridFrameworkError extends QiError {
  context: {
    operation?: string;
    cursorOffset?: number;
    textLength?: number;
    framework?: string;
  };
}

const hybridError = (
  code: string,
  message: string,
  context: HybridFrameworkError['context'] = {}
): HybridFrameworkError =>
  create(code, message, 'SYSTEM', { framework: 'hybrid', ...context }) as HybridFrameworkError;

/**
 * Default configuration for hybrid framework
 */
const defaultHybridConfig = {
  hybrid: {
    enableTTYDetection: true,
    fallbackToInk: true,
    cursorBehavior: {
      enableClaudeCodeNavigation: true,
      twoStepDownArrow: true,
    },
  },
};

/**
 * Hybrid CLI Framework that enhances Ink with Claude Code-style navigation
 *
 * Key Features:
 * - Full Ink React components for rich UI (progress bars, styling, etc.)
 * - Enhanced cursor navigation using Claude Code's Cursor class
 * - Smart down arrow behavior: cursor to end, then history navigation
 * - QiCore integration with structured logging and error handling
 * - Professional Result<T> patterns throughout
 */
export class HybridCLIFramework extends InkCLIFramework {
  public isHybridEnabled = true; // Public flag for InputBox detection
  private cursorAtEndState = false; // Track if cursor moved to end on last down arrow
  private logger: Logger | null = null; // QiCore logger instance
  private hybridConfig: any | null = null; // QiCore configuration (using any for now until ValidatedConfig is available)

  constructor(config: CLIConfig) {
    super(config);
    this.initializeInfrastructure(config);
  }

  /**
   * Initialize QiCore infrastructure (logger + config) with proper error handling
   */
  private initializeInfrastructure(config: CLIConfig): void {
    // Initialize configuration first
    this.initializeConfiguration();

    // Initialize logger (depends on config)
    this.initializeLogger();
  }

  /**
   * Initialize configuration using simple defaults and environment variables
   * Following QiCore patterns but simplified until full API is available
   */
  private initializeConfiguration(): void {
    // For now, use a simple configuration approach with environment variable overrides
    this.hybridConfig = {
      get: <T>(path: string): Result<T, QiError> => {
        const keys = path.split('.');
        let value: any = defaultHybridConfig;

        // Navigate through the config object
        for (const key of keys) {
          if (value && typeof value === 'object' && key in value) {
            value = value[key];
          } else {
            return failure(
              create('CONFIG_NOT_FOUND', `Configuration key not found: ${path}`, 'VALIDATION')
            );
          }
        }

        // Check for environment variable overrides
        const envKey = `HYBRID_${keys.join('_').toUpperCase()}`;
        const envValue = process.env[envKey];
        if (envValue !== undefined) {
          // Simple type conversion
          if (envValue === 'true') return success(true as T);
          if (envValue === 'false') return success(false as T);
          if (!isNaN(Number(envValue))) return success(Number(envValue) as T);
          return success(envValue as T);
        }

        return success(value as T);
      },
    };

    this.logger?.debug('Configuration initialized', {
      hasConfig: true,
      environmentPrefix: 'HYBRID_',
    });
  }

  /**
   * Initialize QiCore logger with proper error handling
   */
  private initializeLogger(): void {
    const loggerResult = createLogger({
      level: 'info',
      name: 'hybrid-cli-framework',
      pretty: process.env.NODE_ENV === 'development',
    });

    match(
      (logger) => {
        this.logger = logger;
        this.logger.info('Hybrid CLI Framework initialized', {
          isHybridEnabled: this.isHybridEnabled,
          framework: 'hybrid',
          parent: 'ink',
          configLoaded: this.hybridConfig !== null,
        });
      },
      (error) => {
        // Fallback: if logger creation fails, we'll use null and handle gracefully
        this.logger = null;
        // Note: Following QiCore patterns - no console usage, graceful degradation
      },
      loggerResult
    );
  }

  /**
   * Get configuration value using QiCore patterns
   */
  private getConfigValue<T>(path: string, defaultValue: T): T {
    if (!this.hybridConfig) return defaultValue;

    // Use QiCore config pattern
    const result = this.hybridConfig.get(path);
    return match(
      (value: T) => value,
      () => defaultValue,
      result
    );
  }

  /**
   * Check if Claude Code navigation is enabled
   */
  private isClaudeCodeNavigationEnabled(): boolean {
    return this.getConfigValue('hybrid.cursorBehavior.enableClaudeCodeNavigation', true);
  }

  /**
   * Check if two-step down arrow is enabled
   */
  private isTwoStepDownArrowEnabled(): boolean {
    return this.getConfigValue('hybrid.cursorBehavior.twoStepDownArrow', true);
  }

  /**
   * Enhanced input handling with Claude Code navigation logic
   * Uses proper QiCore Result<T> patterns - no try/catch
   */
  public handleClaudeCodeNavigation(
    text: string,
    cursorOffset: number,
    columns: number,
    key: { name?: string }
  ): Result<
    {
      shouldTriggerHistory: boolean;
      newCursorOffset?: number;
      resetCursorEndState?: boolean;
    },
    HybridFrameworkError
  > {
    this.logger?.info('Handling navigation input', {
      keyName: key.name,
      cursorOffset,
      textLength: text.length,
      columns,
    });

    if (key.name === 'down') {
      return this.handleDownArrowNavigation(text, cursorOffset, columns);
    } else if (key.name === 'up') {
      // Reset cursor end state on up arrow
      this.cursorAtEndState = false;
      this.logger?.debug('Reset cursor state on up arrow', {
        cursorAtEndState: this.cursorAtEndState,
      });
      return success({ shouldTriggerHistory: false, resetCursorEndState: true });
    } else {
      // Reset cursor end state on any other key
      this.cursorAtEndState = false;
      this.logger?.debug('Reset cursor state on key press', {
        keyName: key.name,
        cursorAtEndState: this.cursorAtEndState,
      });
      return success({ shouldTriggerHistory: false, resetCursorEndState: true });
    }
  }

  /**
   * Handle down arrow with Claude Code two-step behavior
   * Pure QiCore functional approach - no try/catch needed
   */
  private handleDownArrowNavigation(
    text: string,
    cursorOffset: number,
    columns: number
  ): Result<
    {
      shouldTriggerHistory: boolean;
      newCursorOffset?: number;
    },
    HybridFrameworkError
  > {
    // Validate inputs using QiCore validation patterns
    if (cursorOffset < 0 || cursorOffset > text.length) {
      const error = hybridError('INVALID_CURSOR_OFFSET', 'Cursor offset is out of bounds', {
        operation: 'handleDownArrowNavigation',
        cursorOffset,
        textLength: text.length,
      });
      this.logger?.warn('Invalid cursor offset detected', {
        cursorOffset,
        textLength: text.length,
        error: error.message,
      });
      return failure(error);
    }

    if (columns <= 0) {
      const error = hybridError('INVALID_COLUMNS', 'Column width must be positive', {
        operation: 'handleDownArrowNavigation',
        cursorOffset,
        textLength: text.length,
      });
      this.logger?.warn('Invalid column width', {
        columns,
        error: error.message,
      });
      return failure(error);
    }

    // Create cursor from current state
    const cursor = Cursor.fromText(text, columns, cursorOffset);

    // Try to move cursor down
    const cursorDown = cursor.down();

    // Check if cursor movement succeeded (Claude Code logic)
    if (cursorDown.equals(cursor)) {
      // Cursor can't move down - we're on the last line
      this.logger?.debug('Cursor on last line, applying Claude Code behavior', {
        cursorAtEndState: this.cursorAtEndState,
        cursorOffset,
        textLength: text.length,
      });

      if (!this.cursorAtEndState && cursorOffset < text.length) {
        // STEP 1: Move cursor to end of input
        this.cursorAtEndState = true;
        this.logger?.info('Step 1: Moving cursor to end of input', {
          oldOffset: cursorOffset,
          newOffset: text.length,
        });
        return success({
          shouldTriggerHistory: false,
          newCursorOffset: text.length,
        });
      } else {
        // STEP 2: Cursor already at end - trigger history navigation
        this.cursorAtEndState = false;
        this.logger?.info('Step 2: Triggering history navigation', {
          cursorOffset,
          textLength: text.length,
        });
        return success({ shouldTriggerHistory: true });
      }
    } else {
      // Cursor moved successfully to next line - normal navigation
      this.cursorAtEndState = false;
      this.logger?.debug('Normal cursor down movement', {
        oldOffset: cursorOffset,
        newOffset: cursorDown.offset,
      });
      return success({
        shouldTriggerHistory: false,
        newCursorOffset: cursorDown.offset,
      });
    }
  }

  /**
   * Create Cursor instance for external use (by InputBox)
   * Pure QiCore functional approach
   */
  public createCursor(
    text: string,
    columns: number,
    offset: number = 0
  ): Result<Cursor, HybridFrameworkError> {
    // Validation using QiCore patterns
    if (columns <= 0) {
      return failure(
        hybridError('INVALID_COLUMNS', 'Column width must be positive', {
          operation: 'createCursor',
        })
      );
    }

    if (offset < 0 || offset > text.length) {
      return failure(
        hybridError('INVALID_CURSOR_OFFSET', 'Cursor offset is out of bounds', {
          operation: 'createCursor',
          cursorOffset: offset,
          textLength: text.length,
        })
      );
    }

    // QiCore: operations that can succeed, we just do directly
    const cursor = Cursor.fromText(text, columns, offset);

    this.logger?.debug('Cursor created successfully', {
      textLength: text.length,
      columns,
      offset: cursor.offset,
    });

    return success(cursor);
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
