/**
 * Readline Input Manager implementation
 *
 * Implements IInputManager interface using Node.js readline module.
 * Provides input handling, history management, and keyboard shortcuts.
 */

import * as readline from 'node:readline';
import type { IInputManager, InputConfig, KeypressData } from '../../abstractions/IInputManager.js';

/**
 * Key sequence detection for special key combinations
 */
const _KEY_SEQUENCES = {
  SHIFT_TAB: Buffer.from([0x1b, 0x5b, 0x5a]),
  ESCAPE: Buffer.from([0x1b]),
  CTRL_C: Buffer.from([0x03]),
  ARROW_UP: Buffer.from([0x1b, 0x5b, 0x41]),
  ARROW_DOWN: Buffer.from([0x1b, 0x5b, 0x42]),
  ARROW_RIGHT: Buffer.from([0x1b, 0x5b, 0x43]),
  ARROW_LEFT: Buffer.from([0x1b, 0x5b, 0x44]),
} as const;

/**
 * Event callback types
 */
type InputCallback = (input: string) => void;
type KeypressCallback = (key: string, data?: KeypressData) => void;
type SpecialKeyCallback = () => void;

/**
 * Readline input manager using Node.js readline interface
 * Provides robust input handling with history and keyboard shortcuts
 */
export class ReadlineInputManager implements IInputManager {
  private rl: readline.Interface | null = null;
  private config: InputConfig;
  private currentPrompt: string = '> ';
  private history: string[] = [];
  private enabled = true;
  private isDestroyed = false;

  // Event callbacks
  private inputCallbacks: InputCallback[] = [];
  private keypressCallbacks: KeypressCallback[] = [];
  private shiftTabCallbacks: SpecialKeyCallback[] = [];
  private escapeCallbacks: SpecialKeyCallback[] = [];
  private ctrlCCallbacks: SpecialKeyCallback[] = [];
  private ctrlDCallbacks: SpecialKeyCallback[] = [];

  constructor() {
    this.config = {
      historySize: 100,
      autoComplete: false,
      enableColors: true,
    };
  }

  /**
   * Initialize the input manager
   */
  initialize(config?: InputConfig): void {
    if (this.isDestroyed) {
      throw new Error('Cannot initialize destroyed input manager');
    }

    // Only clean up if we already have an interface
    if (this.rl) {
      try {
        this.rl.close();
      } catch {
        // Ignore cleanup errors
      }
      this.rl = null;
    }

    // Update configuration
    if (config) {
      this.config = { ...this.config, ...config };
    }

    // Enable keypress events on stdin (required for Shift+Tab, Escape, etc.)
    if (process.stdin.isTTY) {
      // Enable keypress events
      const emitKeypressEvents = require('node:readline').emitKeypressEvents;
      emitKeypressEvents(process.stdin);
      if (process.stdin.setRawMode) {
        process.stdin.setRawMode(true);
      }
    }

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.currentPrompt,
      historySize: this.config.historySize,
      removeHistoryDuplicates: true,
      terminal: true,
      crlfDelay: Infinity,
    });

    // Setup event handlers
    this.setupEventHandlers();

    // Setup raw mode for special key detection
    this.setupRawMode();
  }

  /**
   * Set up input event handlers
   */
  onInput(callback: InputCallback): void {
    if (this.isDestroyed) {
      return;
    }

    this.inputCallbacks.push(callback);
  }

  /**
   * Set up keypress event handlers
   */
  onKeypress(callback: KeypressCallback): void {
    if (this.isDestroyed) {
      return;
    }

    this.keypressCallbacks.push(callback);
  }

  /**
   * Set up special key combination handlers
   */
  onShiftTab(callback: SpecialKeyCallback): void {
    if (this.isDestroyed) {
      return;
    }

    this.shiftTabCallbacks.push(callback);
  }

  onEscape(callback: SpecialKeyCallback): void {
    if (this.isDestroyed) {
      return;
    }

    this.escapeCallbacks.push(callback);
  }

  onCtrlC(callback: SpecialKeyCallback): void {
    if (this.isDestroyed) {
      return;
    }

    this.ctrlCCallbacks.push(callback);
  }

  onCtrlD(callback: SpecialKeyCallback): void {
    if (this.isDestroyed) {
      return;
    }

    this.ctrlDCallbacks.push(callback);
  }

  /**
   * Set the prompt string
   */
  setPrompt(prompt: string): void {
    if (this.isDestroyed || !this.rl) {
      return;
    }

    this.currentPrompt = prompt;
    this.rl.setPrompt(prompt);
  }

  /**
   * Display the prompt
   */
  showPrompt(): void {
    if (this.isDestroyed || !this.rl || !this.enabled) {
      return;
    }

    this.rl.prompt();
  }

  /**
   * Hide the prompt
   */
  hidePrompt(): void {
    if (this.isDestroyed || !this.rl) {
      return;
    }

    // Clear current line
    process.stdout.write('\r\x1b[K');
  }

  /**
   * Get current prompt string
   */
  getPrompt(): string {
    return this.currentPrompt;
  }

  /**
   * Clear current input line using proper readline method
   */
  clearInput(): void {
    if (this.isDestroyed || !this.rl) {
      return;
    }

    // Use the proper readline method to simulate Ctrl+U which clears the input line
    this.rl.write(null, { ctrl: true, name: 'u' });
  }

  /**
   * Set current input text
   */
  setInput(text: string): void {
    if (this.isDestroyed || !this.rl) {
      return;
    }

    (this.rl as any).line = text;
    (this.rl as any).cursor = text.length;

    // Refresh display
    this.hidePrompt();
    process.stdout.write(this.currentPrompt + text);
  }

  /**
   * Get current input text
   */
  getCurrentInput(): string {
    if (this.isDestroyed || !this.rl) {
      return '';
    }

    return this.rl.line;
  }

  /**
   * Add to input history
   */
  addToHistory(input: string): void {
    if (this.isDestroyed || !input.trim()) {
      return;
    }

    // Remove duplicates
    const existingIndex = this.history.indexOf(input);
    if (existingIndex !== -1) {
      this.history.splice(existingIndex, 1);
    }

    // Add to end
    this.history.push(input);

    // Trim to max size
    if (this.history.length > this.config.historySize!) {
      this.history = this.history.slice(-this.config.historySize!);
    }

    // Add to readline history as well
    if (this.rl) {
      // Clear readline history to prevent duplicates
      (this.rl as any).history = [];

      // Add our history to readline
      for (const item of this.history.slice().reverse()) {
        (this.rl as any).history.push(item);
      }
    }
  }

  /**
   * Get input history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Enable/disable input
   */
  setEnabled(enabled: boolean): void {
    if (this.isDestroyed) {
      return;
    }

    this.enabled = enabled;

    if (this.rl) {
      if (enabled) {
        this.rl.resume();
      } else {
        this.rl.pause();
      }
    }
  }

  /**
   * Check if input is enabled
   */
  isEnabled(): boolean {
    return this.enabled && !this.isDestroyed;
  }

  /**
   * Update configuration
   */
  updateConfig(config: Partial<InputConfig>): void {
    if (this.isDestroyed) {
      return;
    }

    this.config = { ...this.config, ...config };

    // Reinitialize if needed
    if (this.rl && config.historySize !== undefined) {
      // Trim current history
      if (this.history.length > config.historySize) {
        this.history = this.history.slice(-config.historySize);
      }
    }
  }

  /**
   * Clean up and close input manager
   */
  close(): void {
    if (this.isDestroyed) {
      return;
    }

    // Close readline interface
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    // Clear callbacks
    this.inputCallbacks = [];
    this.keypressCallbacks = [];
    this.shiftTabCallbacks = [];
    this.escapeCallbacks = [];
    this.ctrlCCallbacks = [];
    this.ctrlDCallbacks = [];

    this.isDestroyed = true;
  }

  /**
   * Get input statistics
   */
  getStats(): {
    historySize: number;
    currentInput: string;
    isEnabled: boolean;
    callbackCounts: Record<string, number>;
  } {
    return {
      historySize: this.history.length,
      currentInput: this.getCurrentInput(),
      isEnabled: this.enabled,
      callbackCounts: {
        input: this.inputCallbacks.length,
        keypress: this.keypressCallbacks.length,
        shiftTab: this.shiftTabCallbacks.length,
        escape: this.escapeCallbacks.length,
        ctrlC: this.ctrlCCallbacks.length,
      },
    };
  }

  /**
   * Get access to readline interface (for hybrid frameworks)
   */
  get readlineInterface(): readline.Interface | null {
    return this.rl;
  }

  /**
   * Get current cursor position (for Claude Code-style navigation)
   */
  getCursorPosition(): number {
    if (this.isDestroyed || !this.rl) {
      return 0;
    }
    return (this.rl as any).cursor || 0;
  }

  /**
   * Set cursor position (for Claude Code-style navigation)
   */
  setCursorPosition(position: number): void {
    if (this.isDestroyed || !this.rl) {
      return;
    }

    const maxPosition = this.rl.line.length;
    const clampedPosition = Math.max(0, Math.min(position, maxPosition));
    (this.rl as any).cursor = clampedPosition;

    // Refresh display
    this.refreshDisplay();
  }

  /**
   * Move cursor to end of input (Claude Code style)
   */
  moveToEndOfInput(): void {
    if (this.isDestroyed || !this.rl) {
      return;
    }

    (this.rl as any).cursor = this.rl.line.length;
    this.refreshDisplay();
  }

  /**
   * Get current line index based on cursor position (for multi-line support)
   */
  getCurrentLineIndex(): number {
    if (this.isDestroyed || !this.rl) {
      return 0;
    }

    const beforeCursor = this.rl.line.slice(0, (this.rl as any).cursor);
    return beforeCursor.split('\n').length - 1;
  }

  /**
   * Check if cursor is on the last line of multi-line input
   */
  isOnLastLine(): boolean {
    if (this.isDestroyed || !this.rl) {
      return true;
    }

    const lines = this.rl.line.split('\n');
    const currentLineIndex = this.getCurrentLineIndex();
    return currentLineIndex === lines.length - 1;
  }

  /**
   * Check if cursor is at the end of input
   */
  isAtEndOfInput(): boolean {
    if (this.isDestroyed || !this.rl) {
      return true;
    }

    return (this.rl as any).cursor === this.rl.line.length;
  }

  /**
   * Get total number of lines in current input
   */
  getLineCount(): number {
    if (this.isDestroyed || !this.rl) {
      return 1;
    }

    return this.rl.line.split('\n').length;
  }

  /**
   * Refresh display after cursor manipulation
   */
  private refreshDisplay(): void {
    if (this.isDestroyed || !this.rl || !this.enabled) {
      return;
    }

    // Force readline to redraw the current line with updated cursor position
    try {
      // Clear current line and redraw
      process.stdout.write('\r\x1b[K');
      process.stdout.write(this.currentPrompt + this.rl.line);

      // Move cursor to correct position
      const cursorPos = (this.rl as any).cursor;
      const promptLength = this.currentPrompt.length;
      const totalPosition = promptLength + cursorPos;

      // Move cursor to beginning and then to correct position
      process.stdout.write('\r');
      if (totalPosition > 0) {
        process.stdout.write(`\x1b[${totalPosition + 1}G`);
      }
    } catch (error) {
      // Fallback to simple redraw
      this.hidePrompt();
      this.showPrompt();
    }
  }

  // Private methods

  private setupEventHandlers(): void {
    if (!this.rl) {
      return;
    }

    // Line input handler
    this.rl.on('line', (input: string) => {
      const trimmedInput = input.trim();

      // Add to history if not empty
      if (trimmedInput) {
        this.addToHistory(trimmedInput);
      }

      // Notify callbacks
      this.inputCallbacks.forEach((callback) => {
        try {
          callback(trimmedInput);
        } catch (error) {
          console.error('Error in input callback:', error);
        }
      });
    });

    // Keypress handler for special keys (Shift+Tab, Escape, etc.)
    process.stdin.on('keypress', (str: string, key: any) => {
      this.handleKeypress(str, key);
    });

    // Close handler
    this.rl.on('close', () => {
      this.close();
    });

    // SIGINT handler (Ctrl+C) - Keep as backup for some environments
    this.rl.on('SIGINT', () => {
      this.ctrlCCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('Error in Ctrl+C callback:', error);
        }
      });
    });
  }

  private setupRawMode(): void {
    // For now, disable raw mode entirely to ensure basic functionality works
    // Special keys can be handled through readline's built-in mechanisms
    // TODO: Re-implement special key handling without interfering with input
    return;
  }

  private handleKeypress(str: string, key: any): void {
    if (this.isDestroyed || !this.enabled) {
      return;
    }

    // Create keypress data
    const keypressData: KeypressData = {
      name: key?.name,
      sequence: key?.sequence,
      ctrl: key?.ctrl || false,
      meta: key?.meta || false,
      shift: key?.shift || false,
    };

    // Check for special key combinations
    if (this.isSpecialKey(str, key)) {
      this.handleSpecialKey(str, key);
    } else {
      // Regular keypress
      this.keypressCallbacks.forEach((callback) => {
        try {
          callback(str, keypressData);
        } catch (error) {
          console.error('Error in keypress callback:', error);
        }
      });
    }
  }

  private isSpecialKey(_str: string, key: any): boolean {
    // Shift+Tab
    if (key?.name === 'tab' && key?.shift) {
      return true;
    }

    // Escape
    if (key?.name === 'escape') {
      return true;
    }

    // Ctrl+C
    if (key?.name === 'c' && key?.ctrl) {
      return true;
    }

    // Ctrl+D
    if (key?.name === 'd' && key?.ctrl) {
      return true;
    }

    return false;
  }

  private handleSpecialKey(_str: string, key: any): void {
    // Shift+Tab
    if (key?.name === 'tab' && key?.shift) {
      this.shiftTabCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('Error in Shift+Tab callback:', error);
        }
      });
      return;
    }

    // Escape
    if (key?.name === 'escape') {
      this.escapeCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('Error in Escape callback:', error);
        }
      });
      return;
    }

    // Ctrl+D
    if (key?.name === 'd' && key?.ctrl) {
      this.ctrlDCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('Error in Ctrl+D callback:', error);
        }
      });
      return;
    }

    // Ctrl+C
    if (key?.name === 'c' && key?.ctrl) {
      this.ctrlCCallbacks.forEach((callback) => {
        try {
          callback();
        } catch (error) {
          console.error('Error in Ctrl+C callback:', error);
        }
      });
      return;
    }
  }
}
