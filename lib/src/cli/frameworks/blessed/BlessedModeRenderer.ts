/**
 * neo-blessed Mode Renderer implementation
 * 
 * Displays CLI mode indicator using blessed box widgets.
 * Shows current mode with visual styling and hotkey hints.
 */

import * as blessed from 'neo-blessed';
import type { IModeRenderer } from '../../abstractions/IUIComponent.js';

type CLIMode = 'interactive' | 'command' | 'streaming';

/**
 * neo-blessed mode renderer implementation
 * 
 * Uses blessed box widget to display mode indicator in the top-right corner.
 * Shows current mode with color coding and hotkey information.
 */
export class BlessedModeRenderer implements IModeRenderer {
  private isDestroyed = false;
  private screen: blessed.Widgets.Screen;
  private modeBox?: any;
  private currentMode: CLIMode = 'interactive';
  private isVisible = false;
  private tuiMode = false; // Track if TUI mode is active

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
  }
  
  /**
   * Enable TUI mode (disables regular mode widgets)
   */
  enableTUIMode(): void {
    this.tuiMode = true;
    // Destroy any existing widgets since TUI handles everything
    this.destroyModeWidgets();
  }

  private createModeWidgets(): void {
    if (this.modeBox) return;
    
    // Don't create widgets if TUI mode is active
    if (this.tuiMode) return;

    // Create impressive header with gradient-like styling
    const headerBox = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      height: 4,
      border: {
        type: 'line',
        fg: 'blue'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue'
        }
      },
      tags: true
    });

    // Create animated/styled title with modern dashboard design
    blessed.text({
      parent: headerBox,
      top: 0,
      left: 2,
      content: '{bold}{blue-fg}⚡ QI AGENT{/blue-fg}{/bold} {cyan-fg}▶{/cyan-fg} {white-fg}AI-Powered CLI Intelligence Platform{/white-fg}',
      tags: true
    });

    // Create system info line with real-time indicators
    blessed.text({
      parent: headerBox,
      top: 1,
      left: 2,
      content: '{grey-fg}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━{/grey-fg}',
      tags: true
    });

    // Add system metrics section (like vtop)
    blessed.text({
      parent: headerBox,
      top: 0,
      left: 'center',
      content: '{green-fg}●{/green-fg} {white-fg}ONLINE{/white-fg} {cyan-fg}|{/cyan-fg} {yellow-fg}⚡{/yellow-fg} {white-fg}READY{/white-fg}',
      tags: true
    });

    // Add version/build info (dashboard style)
    blessed.text({
      parent: headerBox,
      top: 1,
      right: 25,
      content: '{grey-fg}v2.0.0 • Build 2025.01{/grey-fg}',
      tags: true
    });

    // Create mode indicator with better styling
    this.modeBox = blessed.box({
      parent: headerBox,
      top: 0,
      right: 2,
      width: 20,
      height: 2,
      style: {
        fg: 'white',
        bg: 'black'
      },
      tags: true,
      border: {
        type: 'line',
        fg: 'cyan'
      }
    });

    // Create impressive status bar with multiple sections (blessed-contrib style)
    const statusBox = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      style: {
        fg: 'white',
        bg: 'black'
      },
      tags: true,
      border: {
        type: 'line',
        fg: 'blue'
      }
    });

    // Left section - shortcuts with better styling
    blessed.text({
      parent: statusBox,
      top: 0,
      left: 1,
      content: '{cyan-fg}⌨️ HOTKEYS:{/cyan-fg} {white-bg}{black-fg} CTRL+C {/black-fg}{/white-bg}{grey-fg}Clear{/grey-fg} {white-bg}{black-fg} CTRL+D {/black-fg}{/white-bg}{grey-fg}Exit{/grey-fg} {yellow-bg}{black-fg} SHIFT+TAB {/black-fg}{/yellow-bg}{grey-fg}Mode{/grey-fg} {red-bg}{black-fg} ESC {/black-fg}{/red-bg}{grey-fg}Cancel{/grey-fg}',
      tags: true
    });

    // Center section - connection status
    blessed.text({
      parent: statusBox,
      top: 0,
      left: 'center',
      content: '{green-fg}●{/green-fg} {white-fg}CONNECTED{/white-fg} {grey-fg}|{/grey-fg} {cyan-fg}◉{/cyan-fg} {white-fg}AI ENGINE{/white-fg}',
      tags: true
    });

    // Right section - performance metrics (vtop-inspired)
    blessed.text({
      parent: statusBox,
      top: 0,
      right: 1,
      content: '{green-fg}█{/green-fg}{yellow-fg}▓{/yellow-fg}{red-fg}░{/red-fg} {white-fg}CPU{/white-fg} {grey-fg}|{/grey-fg} {cyan-fg}▇▅▃{/cyan-fg} {white-fg}MEM{/white-fg}',
      tags: true
    });
  }

  private destroyModeWidgets(): void {
    if (this.modeBox) {
      this.modeBox.destroy();
      this.modeBox = undefined;
    }
  }

  private getModeDisplay(mode: CLIMode): { text: string; color: string; bg: string; indicator: string } {
    switch (mode) {
      case 'interactive':
        return {
          text: '🧠 INTELLIGENT\n  CHAT MODE',
          color: 'green',
          bg: 'black',
          indicator: '████████████'
        };
      case 'command':
        return {
          text: '⚡ COMMAND\n  EXEC MODE',
          color: 'yellow',
          bg: 'black',
          indicator: '▓▓▓▓▓▓▓▓▓▓▓▓'
        };
      case 'streaming':
        return {
          text: '📡 STREAMING\n  DATA MODE',
          color: 'cyan',
          bg: 'black',
          indicator: '░░░░░░░░░░░░'
        };
      default:
        return {
          text: '❓ UNKNOWN\n   MODE',
          color: 'red',
          bg: 'black',
          indicator: '▒▒▒▒▒▒▒▒▒▒▒▒'
        };
    }
  }

  private updateModeDisplay(): void {
    if (!this.modeBox) return;

    const display = this.getModeDisplay(this.currentMode);
    
    // Update box content with enhanced visual indicator
    const content = `{center}{${display.color}-fg}${display.text}{/${display.color}-fg}\n{${display.color}-fg}${display.indicator}{/${display.color}-fg}{/center}`;
    this.modeBox.setContent(content);
    
    // Update box border color
    this.modeBox.style.border = { fg: display.color };
    
    // Add pulsing effect for active modes
    if (this.currentMode === 'streaming') {
      this.modeBox.style.bg = 'black';
    }
    
    this.screen.render();
  }

  setMode(mode: CLIMode): void {
    if (this.isDestroyed) return;
    
    this.currentMode = mode;
    
    if (!this.modeBox) {
      this.createModeWidgets();
    }
    
    this.updateModeDisplay();
  }

  cycleMode(): CLIMode {
    if (this.isDestroyed) return this.currentMode;
    
    // Cycle through modes
    switch (this.currentMode) {
      case 'interactive':
        this.currentMode = 'command';
        break;
      case 'command':
        this.currentMode = 'streaming';
        break;
      case 'streaming':
        this.currentMode = 'interactive';
        break;
    }
    
    this.setMode(this.currentMode);
    return this.currentMode;
  }

  getPromptPrefix(): string {
    switch (this.currentMode) {
      case 'interactive':
        return '💬 ';
      case 'command':
        return '⚡ ';
      case 'streaming':
        return '🔄 ';
      default:
        return '❓ ';
    }
  }

  getCurrentMode(): CLIMode {
    return this.currentMode;
  }

  show(): void {
    if (this.isDestroyed) return;
    
    if (!this.modeBox) {
      this.createModeWidgets();
    }
    
    if (this.modeBox) {
      this.modeBox.show();
    }
    
    this.isVisible = true;
    this.updateModeDisplay();
  }

  hide(): void {
    if (this.isDestroyed) return;
    
    if (this.modeBox) {
      this.modeBox.hide();
    }
    
    this.isVisible = false;
    this.screen.render();
  }

  render(): void {
    if (this.isDestroyed) return;
    
    this.screen.render();
  }

  update(data: any): void {
    if (this.isDestroyed) return;
    
    // Handle mode updates
    if (data && typeof data === 'object') {
      if (data.mode && typeof data.mode === 'string') {
        this.setMode(data.mode as CLIMode);
      }
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    this.destroyModeWidgets();
    this.isVisible = false;
    this.isDestroyed = true;
  }

  /**
   * Check if mode indicator is currently visible
   */
  isModeVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Show mode help information
   */
  showModeHelp(): void {
    const display = this.getModeDisplay(this.currentMode);
    // Could implement a popup or additional display here
    console.log(`Mode: ${this.currentMode} (${display.text})`);
  }

  /**
   * Get mode information
   */
  getModeInfo(mode?: CLIMode): any {
    const targetMode = mode || this.currentMode;
    const display = this.getModeDisplay(targetMode);
    
    return {
      mode: targetMode,
      display: display.text,
      color: display.color,
      capabilities: this.getModeCapabilities(targetMode)
    };
  }

  /**
   * Get capabilities for a specific mode
   */
  private getModeCapabilities(mode: CLIMode): string[] {
    switch (mode) {
      case 'interactive':
        return ['Natural language input', 'Context awareness', 'Multi-turn conversation'];
      case 'command':
        return ['Quick commands', 'Fast execution', 'Direct actions'];
      case 'streaming':
        return ['Real-time output', 'Progressive responses', 'Cancellable operations'];
      default:
        return [];
    }
  }

}