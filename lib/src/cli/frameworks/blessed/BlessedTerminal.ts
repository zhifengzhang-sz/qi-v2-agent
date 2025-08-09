/**
 * neo-blessed Terminal implementation
 * 
 * Traditional TUI terminal implementation using neo-blessed framework.
 * Provides widget-based terminal operations with efficient rendering.
 */

import * as blessed from 'neo-blessed';
import type { ITerminal, TerminalDimensions } from '../../abstractions/ITerminal.js';

/**
 * neo-blessed terminal implementation
 * 
 * Uses blessed screen for efficient widget-based terminal operations.
 * Only draws changes (damage) to screen for optimal performance.
 */
export class BlessedTerminal implements ITerminal {
  private isDestroyed = false;
  private screen: blessed.Widgets.Screen;
  private ownScreen: boolean = false;

  constructor(screen?: blessed.Widgets.Screen) {
    if (screen) {
      // Use provided screen
      this.screen = screen;
      this.ownScreen = false;
    } else {
      // Create own screen
      this.screen = blessed.screen({
        smartCSR: true,
        title: 'Qi CLI Application',
        cursor: {
          artificial: true,
          shape: 'line',
          blink: true
        },
        debug: false,
        dockBorders: false,
        ignoreLocked: ['C-c']
      });
      this.ownScreen = true;
      
      // Setup screen cleanup on destroy
      this.screen.on('destroy', () => {
        this.isDestroyed = true;
      });
      
      // Set up signal handlers for proper cleanup
      this.setupSignalHandlers();
    }
  }
  
  private setupSignalHandlers(): void {
    // Handle SIGINT (Ctrl+C) and SIGTERM gracefully
    const gracefulExit = () => {
      this.destroy();
      process.exit(0);
    };
    
    process.on('SIGINT', gracefulExit);
    process.on('SIGTERM', gracefulExit);
    process.on('SIGQUIT', gracefulExit);
    
    // Handle uncaught exceptions to ensure proper cleanup
    process.on('uncaughtException', (error) => {
      console.error('Uncaught Exception:', error);
      this.destroy();
      process.exit(1);
    });
  }

  write(text: string): void {
    if (this.isDestroyed) return;
    
    // Use blessed screen for output
    this.screen.program.write(text);
  }

  writeLine(text: string = ''): void {
    if (this.isDestroyed) return;
    
    // Use blessed screen for line output
    this.screen.program.write(text + '\n');
  }

  clear(): void {
    if (this.isDestroyed) return;
    
    // Clear entire screen using blessed
    this.screen.clearRegion(0, 0, this.screen.width, this.screen.height);
    this.screen.render();
  }

  clearLine(): void {
    if (this.isDestroyed) return;
    
    // Clear current line using blessed program
    this.screen.program.write('\r\x1b[K');
  }

  cursorToStart(): void {
    if (this.isDestroyed) return;
    
    // Move cursor to start of line
    this.screen.program.write('\r');
  }

  cursorUp(lines: number = 1): void {
    if (this.isDestroyed || lines <= 0) return;
    
    // Move cursor up using blessed program
    this.screen.program.cuu(lines);
  }

  cursorDown(lines: number = 1): void {
    if (this.isDestroyed || lines <= 0) return;
    
    // Move cursor down using blessed program
    this.screen.program.cud(lines);
  }

  moveCursor(x: number, y: number): void {
    if (this.isDestroyed) return;
    
    // Move cursor to absolute position using blessed
    const row = Math.max(0, Math.floor(y));
    const col = Math.max(0, Math.floor(x));
    this.screen.program.cup(row, col);
  }

  getDimensions(): TerminalDimensions {
    // Get dimensions from blessed screen
    return {
      width: this.screen.width,
      height: this.screen.height,
    };
  }

  saveCursor(): void {
    if (this.isDestroyed) return;
    
    // Save cursor position using blessed program
    this.screen.program.sc();
  }

  restoreCursor(): void {
    if (this.isDestroyed) return;
    
    // Restore cursor position using blessed program
    this.screen.program.rc();
  }

  hideCursor(): void {
    if (this.isDestroyed) return;
    
    // Hide cursor using blessed program
    this.screen.program.civis();
  }

  showCursor(): void {
    if (this.isDestroyed) return;
    
    // Show cursor using blessed program
    this.screen.program.cnorm();
  }

  setColor(colorCode: number): void {
    if (this.isDestroyed) return;
    
    // Set color using blessed program
    this.screen.program.setFg(colorCode);
  }

  resetFormatting(): void {
    if (this.isDestroyed) return;
    
    // Reset formatting using blessed program
    this.screen.program.sgr0();
  }

  supportsColor(): boolean {
    // Check blessed color support
    return this.screen.program.tput && this.screen.program.tput.colors > 0;
  }

  supportsUnicode(): boolean {
    // Check blessed Unicode support - blessed generally supports Unicode
    return this.screen.program.tput && this.screen.program.tput.unicode !== false;
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    // Perform blessed-specific cleanup
    this.resetFormatting();
    this.showCursor();
    
    // Only destroy screen if we own it
    if (this.ownScreen) {
      this.screen.destroy();
    }
    
    this.isDestroyed = true;
  }

  /**
   * Get the blessed screen instance for use by other blessed components
   */
  getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }
}

/**
 * Check if neo-blessed is available
 */
export function isBlessedAvailable(): boolean {
  try {
    require('neo-blessed');
    return true;
  } catch {
    return false;
  }
}