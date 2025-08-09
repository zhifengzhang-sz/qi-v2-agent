/**
 * neo-blessed Input Manager implementation
 * 
 * Handles user input using blessed textbox widgets and key event handling.
 * Provides advanced input capabilities with command history and hotkeys.
 */

import * as blessed from 'neo-blessed';
import type { IInputManager, InputConfig, KeypressData } from '../../abstractions/IInputManager.js';
import { BlessedTUILayout } from './BlessedTUILayout.js';

/**
 * neo-blessed input manager implementation
 * 
 * Uses blessed textbox and key event handling for rich terminal input.
 * Supports command history, hotkeys, and multi-line input.
 */
export class BlessedInputManager implements IInputManager {
  private isDestroyed = false;
  private screen: blessed.Widgets.Screen;
  private textbox: any;
  private separator: any;
  private tuiLayout?: BlessedTUILayout;
  private useTUI: boolean = false;
  private currentPrompt: string = '> ';
  
  // Event callbacks (arrays to support multiple listeners like readline)
  private inputCallbacks: ((input: string) => void)[] = [];
  private keypressCallbacks: ((key: string, data?: KeypressData) => void)[] = [];
  private shiftTabCallbacks: (() => void)[] = [];
  private escapeCallbacks: (() => void)[] = [];
  private ctrlCCallbacks: (() => void)[] = [];
  private ctrlDCallbacks: (() => void)[] = [];
  private history: string[] = [];
  private historyIndex: number = -1;
  private enabled: boolean = true;
  private config: InputConfig = {};

  constructor(screen: blessed.Widgets.Screen, autoEnableTUI: boolean = false) {
    this.screen = screen;
    
    // Check for TUI mode from environment variable or explicit parameter
    const enableTUI = autoEnableTUI || 
                      process.env.QI_BLESSED_TUI === 'true' || 
                      process.argv.includes('--blessed-tui') || 
                      process.argv.includes('--tui');
    
    if (enableTUI) {
      this.enableTUIMode();
    } else {
      this.setupTextbox();
      this.setupKeyHandling();
    }
  }
  
  /**
   * Get TUI layout instance (if enabled)
   */
  getTUILayout(): BlessedTUILayout | undefined {
    return this.tuiLayout;
  }
  
  /**
   * Enable full TUI mode with multi-panel layout
   */
  enableTUIMode(): void {
    if (this.useTUI) {
      return;
    }
    
    this.useTUI = true;
    
    // Destroy existing textbox if it exists to prevent double input
    if (this.textbox) {
      this.textbox.destroy();
      this.textbox = undefined;
    }
    
    if (this.separator) {
      this.separator.destroy();
      this.separator = undefined;
    }
    
    this.tuiLayout = new BlessedTUILayout({
      title: 'QI Agent TUI',
      enableMouse: true,
      enableVi: true,
      screen: this.screen // Pass the existing screen
    });
    
    // No need to replace screen - TUI layout uses the existing one
    
    // Set up TUI input handling
    this.tuiLayout.onInput((value: string) => {
      if (value.trim()) {
        this.history.push(value.trim());
        this.historyIndex = -1;
        
        // Add user input to conversation history
        const timestamp = new Date().toLocaleTimeString();
        this.tuiLayout.addToContext(`{bold}{blue-fg}[${timestamp}] You:{/blue-fg}{/bold} ${value.trim()}`);
        
        // Call all input callbacks with error handling
        this.inputCallbacks.forEach(callback => {
          try {
            callback(value.trim());
          } catch (error) {
            console.error('Error in input callback:', error);
          }
        });
      }
    });
  }

  private setupTextbox(): void {
    // Create visual separator above input
    this.separator = blessed.line({
      parent: this.screen,
      bottom: 6,
      left: 0,
      right: 0,
      orientation: 'horizontal',
      style: {
        fg: 'grey'
      }
    });

    // Create impressive input widget with modern styling
    // Fix for input duplication: Use inputOnFocus: false to prevent double listener registration
    this.textbox = blessed.textbox({
      parent: this.screen,
      bottom: 2, // Leave space for enhanced status bar
      left: 0,
      height: 4,
      width: '100%',
      inputOnFocus: false, // Fixed: Prevent automatic double listener registration
      keys: true,
      mouse: true,
      style: {
        fg: 'white',
        bg: 'black',
        focus: {
          fg: 'yellow',
          bg: 'black',
          border: {
            fg: 'yellow'
          }
        },
        border: {
          fg: 'magenta'
        }
      },
      border: {
        type: 'line',
        fg: 'magenta'
      },
      label: ' 📝 YOUR INPUT HERE ',
      tags: true
    });

    // Add custom input blur handling to prevent listener accumulation
    this.addInputBlurFix();

    // Handle textbox input submission
    this.textbox.on('submit', (value: string) => {
      const trimmedValue = value.trim();
      if (trimmedValue) {
        // Add to history
        this.history.push(trimmedValue);
        this.historyIndex = -1;
        
        // Clear textbox
        this.textbox.clearValue();
        this.textbox.setContent('');
        this.screen.render();
        
        // Call all input callbacks with error handling
        this.inputCallbacks.forEach(callback => {
          try {
            callback(trimmedValue);
          } catch (error) {
            console.error('Error in input callback:', error);
          }
        });
      }
    });

    // Handle textbox cancel (Escape)
    this.textbox.on('cancel', () => {
      this.textbox.clearValue();
      this.textbox.setContent('');
      this.screen.render();
    });
  }

  private setupKeyHandling(): void {
    // Set up key bindings directly on textbox to avoid conflicts
    this.textbox.key(['up'], () => {
      this.navigateHistory(-1);
    });

    this.textbox.key(['down'], () => {
      this.navigateHistory(1);
    });

    // Handle special keys at screen level for global functionality
    this.screen.key(['S-tab'], () => {
      this.shiftTabCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in Shift+Tab callback:', error);
        }
      });
    });

    this.screen.key(['escape'], () => {
      this.escapeCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in Escape callback:', error);
        }
      });
      this.clearInput();
    });

    this.screen.key(['C-c'], () => {
      this.ctrlCCallbacks.forEach(callback => {
        try {
          callback();
        } catch (error) {
          console.error('Error in Ctrl+C callback:', error);
        }
      });
    });

    this.screen.key(['C-d'], () => {
      let handled = false;
      this.ctrlDCallbacks.forEach(callback => {
        try {
          callback();
          handled = true;
        } catch (error) {
          console.error('Error in Ctrl+D callback:', error);
        }
      });
      
      // Force exit if no callbacks were registered to handle it
      if (this.ctrlDCallbacks.length === 0) {
        this.forceExit();
      }
    });
    
    // Also handle q key for quit (common blessed pattern)
    this.screen.key(['q'], () => {
      this.forceExit();
    });

    // Set up keypress callback handler for all registered callbacks
    this.screen.on('keypress', (ch: string, key: any) => {
      if (this.isDestroyed) return;
      
      const keypressData: KeypressData = {
        name: key?.name,
        sequence: key?.sequence,
        ctrl: key?.ctrl || false,
        meta: key?.meta || false,
        shift: key?.shift || false,
      };
      
      // Call all keypress callbacks with error handling
      this.keypressCallbacks.forEach(callback => {
        try {
          callback(ch, keypressData);
        } catch (error) {
          console.error('Error in keypress callback:', error);
        }
      });
    });
  }

  private navigateHistory(direction: number): void {
    if (this.history.length === 0) return;

    const newIndex = this.historyIndex + direction;
    
    if (newIndex >= 0 && newIndex < this.history.length) {
      this.historyIndex = newIndex;
      const historyValue = this.history[this.history.length - 1 - this.historyIndex];
      this.textbox.setValue(historyValue);
      this.screen.render();
    } else if (newIndex < 0) {
      // Go to newest (clear)
      this.historyIndex = -1;
      this.textbox.clearValue();
      this.textbox.setContent('');
      this.screen.render();
    }
  }

  /**
   * Fix for blessed textbox input duplication issue
   * Based on GitHub issues #109 and #383 solutions
   */
  private addInputBlurFix(): void {
    if (!this.textbox) return;

    // Add proper inputBlur method using setImmediate for timing
    this.textbox.inputBlur = () => {
      setImmediate(() => {
        if (this.textbox && this.textbox.__listener) {
          this.textbox.removeListener('keypress', this.textbox.__listener);
          delete this.textbox.__listener;
        }
      });
    };

    // Add proper inputFocus method to prevent double listeners
    this.textbox.inputFocus = () => {
      // Clean up any existing listeners first
      if (this.textbox.inputBlur) {
        this.textbox.inputBlur();
      }
      
      // Then add new listeners
      if (this.textbox.addHandlers) {
        this.textbox.addHandlers();
      }
      
      // Finally focus
      this.textbox.focus();
    };
  }


  initialize(config: InputConfig = {}): void {
    this.config = { ...this.config, ...config };
  }

  onInput(callback: (input: string) => void): void {
    if (this.isDestroyed) return;
    this.inputCallbacks.push(callback);
  }

  onKeypress(callback: (key: string, data?: KeypressData) => void): void {
    if (this.isDestroyed) return;
    this.keypressCallbacks.push(callback);
  }

  onShiftTab(callback: () => void): void {
    if (this.isDestroyed) return;
    this.shiftTabCallbacks.push(callback);
  }

  onEscape(callback: () => void): void {
    if (this.isDestroyed) return;
    this.escapeCallbacks.push(callback);
  }

  onCtrlC(callback: () => void): void {
    if (this.isDestroyed) return;
    this.ctrlCCallbacks.push(callback);
  }

  onCtrlD(callback: () => void): void {
    if (this.isDestroyed) return;
    this.ctrlDCallbacks.push(callback);
  }

  setPrompt(prompt: string): void {
    this.currentPrompt = prompt;
    
    if (this.useTUI && this.tuiLayout) {
      // TUI mode handles prompts differently
      return;
    } else if (this.textbox) {
      // Update textbox label with prompt
      this.textbox.setLabel(` ${prompt} `);
      this.screen.render();
    }
  }

  showPrompt(): void {
    if (this.isDestroyed) return;
    
    if (this.useTUI && this.tuiLayout) {
      // TUI handles focus automatically
      this.tuiLayout.render();
    } else if (this.textbox) {
      // Use proper input focus to prevent duplication
      if (this.textbox.inputFocus) {
        this.textbox.inputFocus();
      } else {
        this.textbox.focus();
      }
      this.screen.render();
    }
  }

  hidePrompt(): void {
    if (this.isDestroyed) return;
    
    if (this.useTUI && this.tuiLayout) {
      // TUI doesn't hide prompt, just renders
      this.tuiLayout.render();
    } else if (this.textbox) {
      // Hide the textbox
      this.textbox.hide();
      this.screen.render();
    }
  }

  getPrompt(): string {
    return this.currentPrompt;
  }

  clearInput(): void {
    if (this.useTUI && this.tuiLayout) {
      this.tuiLayout.clearInput();
    } else if (this.textbox) {
      this.textbox.clearValue();
      this.textbox.setContent('');
      this.screen.render();
    }
    this.historyIndex = -1;
  }

  setInput(text: string): void {
    this.setCurrentInput(text);
  }

  addToHistory(input: string): void {
    if (input.trim()) {
      this.history.push(input);
      this.historyIndex = -1;
    }
  }

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    if (this.textbox) {
      if (enabled) {
        this.textbox.show();
      } else {
        this.textbox.hide();
      }
      this.screen.render();
    }
  }

  isEnabled(): boolean {
    return this.enabled;
  }

  updateConfig(config: Partial<InputConfig>): void {
    this.config = { ...this.config, ...config };
  }

  clearScreen(): void {
    if (this.isDestroyed) return;
    
    // Clear screen but keep textbox
    this.screen.clearRegion(0, 0, this.screen.width, this.screen.height - 2);
    this.screen.render();
  }

  write(text: string): void {
    if (this.isDestroyed) return;
    
    // Write text above the input area
    const lines = text.split('\n');
    for (const line of lines) {
      this.screen.program.write(line + '\n');
    }
    
    // Ensure textbox stays at bottom
    this.textbox.focus();
    this.screen.render();
  }

  close(): void {
    this.destroy();
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    // Clean up textbox and separator
    if (this.textbox) {
      this.textbox.destroy();
    }
    
    if (this.separator) {
      this.separator.destroy();
    }
    
    // Clear callback arrays
    this.inputCallbacks = [];
    this.keypressCallbacks = [];
    this.shiftTabCallbacks = [];
    this.escapeCallbacks = [];
    this.ctrlCCallbacks = [];
    this.ctrlDCallbacks = [];
    
    this.isDestroyed = true;
  }

  /**
   * Get the current input value
   */
  getCurrentInput(): string {
    if (this.useTUI && this.tuiLayout) {
      return this.tuiLayout.getInputValue();
    }
    return this.textbox?.getValue() || '';
  }

  /**
   * Set the current input value
   */
  setCurrentInput(value: string): void {
    if (this.isDestroyed) return;
    
    if (this.useTUI && this.tuiLayout) {
      // TUI layout handles input internally
      return;
    } else if (this.textbox) {
      this.textbox.setValue(value);
      this.screen.render();
    }
  }
  
  /**
   * Set input text (alias for setCurrentInput for interface compatibility)
   */
  setInput(text: string): void {
    this.setCurrentInput(text);
  }

  /**
   * Get the input history
   */
  getHistory(): string[] {
    return [...this.history];
  }

  /**
   * Clear the input history
   */
  clearHistory(): void {
    this.history = [];
    this.historyIndex = -1;
  }
  
  /**
   * Get input statistics (like readline implementation)
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
        ctrlD: this.ctrlDCallbacks.length,
      },
    };
  }
  
  /**
   * Force exit the application with proper cleanup
   */
  private forceExit(): void {
    // Perform cleanup
    this.destroy();
    
    // Restore terminal and exit
    if (this.screen) {
      this.screen.destroy();
    }
    
    // Exit gracefully
    process.exit(0);
  }
}