/**
 * Hotkey Manager for CLI
 * 
 * Handles keyboard input detection including special key combinations:
 * - Shift+Tab: Mode cycling
 * - Esc: Cancel current operation
 * - Ctrl+C: Graceful exit (SIGINT)
 * 
 * Uses raw mode for precise key detection while preserving normal readline functionality.
 */

import { EventEmitter } from 'node:events';

export interface HotkeyEvents {
  shiftTab: void;
  escape: void;
  ctrlC: void;
  keypress: { key: string; raw: Buffer };
}

export interface HotkeyConfig {
  enableShiftTab: boolean;
  enableEscape: boolean;
  enableCtrlC: boolean;
  passthrough: boolean; // Whether to pass keys to readline
}

/**
 * Manages keyboard input and hotkey detection
 */
export class HotkeyManager extends EventEmitter {
  private isRawMode = false;
  private config: HotkeyConfig;
  private originalStdinListeners: Array<(...args: any[]) => void> = [];

  constructor(config: Partial<HotkeyConfig> = {}) {
    super();
    
    this.config = {
      enableShiftTab: true,
      enableEscape: true,
      enableCtrlC: true,
      passthrough: true,
      ...config,
    };
  }

  /**
   * Enable raw mode and start listening for hotkeys
   */
  enable(): void {
    if (this.isRawMode) {
      return; // Already enabled
    }

    // Store existing listeners to restore later
    this.originalStdinListeners = process.stdin.listeners('data') as Array<(...args: any[]) => void>;
    
    // Remove existing listeners to avoid conflicts
    process.stdin.removeAllListeners('data');
    
    // Enable raw mode for precise key detection
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(true);
    }
    
    process.stdin.resume();
    process.stdin.on('data', this.handleKeypress.bind(this));
    
    this.isRawMode = true;
    this.emit('enabled');
  }

  /**
   * Disable raw mode and restore normal input handling
   */
  disable(): void {
    if (!this.isRawMode) {
      return; // Already disabled
    }

    // Remove our listener
    process.stdin.removeListener('data', this.handleKeypress.bind(this));
    
    // Disable raw mode
    if (process.stdin.setRawMode) {
      process.stdin.setRawMode(false);
    }
    
    // Restore original listeners
    for (const listener of this.originalStdinListeners) {
      process.stdin.on('data', listener);
    }
    
    this.isRawMode = false;
    this.emit('disabled');
  }

  /**
   * Handle individual keypress events
   */
  private handleKeypress(chunk: Buffer): void {
    const key = chunk.toString();
    const raw = chunk;

    // Emit raw keypress for debugging/logging
    this.emit('keypress', { key, raw });

    // Check for hotkey combinations
    if (this.detectShiftTab(chunk)) {
      if (this.config.enableShiftTab) {
        this.emit('shiftTab');
        return; // Don't pass through hotkey
      }
    }

    if (this.detectEscape(chunk)) {
      if (this.config.enableEscape) {
        this.emit('escape');
        return; // Don't pass through hotkey
      }
    }

    if (this.detectCtrlC(chunk)) {
      if (this.config.enableCtrlC) {
        this.emit('ctrlC');
        // Note: Ctrl+C should still be passed through for SIGINT
      }
    }

    // Pass through to normal input handling if enabled
    if (this.config.passthrough) {
      this.passthroughKey(chunk);
    }
  }

  /**
   * Detect Shift+Tab key combination
   * Shift+Tab sends: ESC[Z (0x1b, 0x5b, 0x5a)
   */
  private detectShiftTab(chunk: Buffer): boolean {
    return chunk.length === 3 && 
           chunk[0] === 0x1b && 
           chunk[1] === 0x5b && 
           chunk[2] === 0x5a;
  }

  /**
   * Detect Escape key
   * Escape sends: ESC (0x1b) - but we need to distinguish from escape sequences
   */
  private detectEscape(chunk: Buffer): boolean {
    // Pure ESC key (not part of escape sequence)
    return chunk.length === 1 && chunk[0] === 0x1b;
  }

  /**
   * Detect Ctrl+C key combination
   * Ctrl+C sends: ETX (0x03)
   */
  private detectCtrlC(chunk: Buffer): boolean {
    return chunk.length === 1 && chunk[0] === 0x03;
  }

  /**
   * Pass key through to normal readline processing
   */
  private passthroughKey(chunk: Buffer): void {
    // Re-emit the data event for readline to process
    for (const listener of this.originalStdinListeners) {
      listener(chunk);
    }
  }

  /**
   * Check if hotkey detection is currently enabled
   */
  isEnabled(): boolean {
    return this.isRawMode;
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<HotkeyConfig>): void {
    this.config = { ...this.config, ...newConfig };
    this.emit('configUpdated', this.config);
  }

  /**
   * Get current configuration
   */
  getConfig(): HotkeyConfig {
    return { ...this.config };
  }

  /**
   * Clean up resources
   */
  destroy(): void {
    this.disable();
    this.removeAllListeners();
  }
}

/**
 * Utility function to create a HotkeyManager with common settings
 */
export function createHotkeyManager(config?: Partial<HotkeyConfig>): HotkeyManager {
  return new HotkeyManager(config);
}

/**
 * Debug utility to display key codes
 */
export function debugKeypress(chunk: Buffer): string {
  const bytes = Array.from(chunk).map(b => `0x${b.toString(16).padStart(2, '0')}`).join(' ');
  const chars = chunk.toString().split('').map(c => {
    const code = c.charCodeAt(0);
    if (code < 32) {
      return `^${String.fromCharCode(code + 64)}`;
    }
    return c;
  }).join('');
  
  return `Bytes: [${bytes}] Chars: "${chars}"`;
}