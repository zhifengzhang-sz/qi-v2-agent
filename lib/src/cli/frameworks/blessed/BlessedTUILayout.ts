/**
 * Blessed TUI Layout Manager
 * 
 * Creates a proper multi-panel TUI interface with navigation between panels.
 * Based on blessed-contrib patterns and proper TUI design principles.
 */

import * as blessed from 'neo-blessed';

export interface TUILayoutOptions {
  title?: string;
  showBorder?: boolean;
  enableMouse?: boolean;
  enableVi?: boolean;
  screen?: blessed.Widgets.Screen; // Allow passing existing screen
}

/**
 * Multi-panel TUI layout for AI CLI
 * 
 * Layout structure:
 * ┌─────────────────────────────────────────┐
 * │ Header: QI Agent TUI                    │
 * ├─────────────────────┬───────────────────┤
 * │                     │ Context/History   │
 * │ Main Response       │ Panel             │
 * │ Panel               │ (scrollable)      │
 * │                     │                   │
 * ├─────────────────────┴───────────────────┤
 * │ Input Panel (focused by default)       │
 * ├─────────────────────────────────────────┤
 * │ Status Bar: Mode | Connection | Stats  │
 * └─────────────────────────────────────────┘
 */
export class BlessedTUILayout {
  private screen: blessed.Widgets.Screen;
  private widgets: {
    header?: any;
    mainPanel?: any;
    contextPanel?: any;
    inputPanel?: any;
    statusBar?: any;
  } = {};
  private activePanel: string = 'input';
  private isDestroyed = false;
  private inputCallback?: (value: string) => void;

  constructor(options: TUILayoutOptions = {}) {
    if (options.screen) {
      // Use provided screen
      this.screen = options.screen;
    } else {
      // Create new screen
      this.screen = blessed.screen({
        smartCSR: true,
        fullUnicode: true,
        title: options.title || 'QI Agent TUI',
        cursor: {
          artificial: true,
          shape: 'line',
          blink: true
        },
        debug: false,
        dockBorders: false,
        mouse: options.enableMouse !== false,
        keys: true,
        vi: options.enableVi !== false
      });
    }

    this.setupLayout();
    this.setupNavigation();
    this.setupKeyBindings();
    
    // Focus the input panel initially with proper focus handling
    if (this.widgets.inputPanel) {
      // Let addInputBlurFix add the proper methods first
      setTimeout(() => {
        if (this.widgets.inputPanel.inputFocus) {
          this.widgets.inputPanel.inputFocus();
        } else {
          this.widgets.inputPanel.focus();
        }
      }, 0);
    }
    
    // Initial render
    this.screen.render();
  }

  private setupLayout(): void {
    // Header with title and quick info
    this.widgets.header = blessed.box({
      parent: this.screen,
      top: 0,
      left: 0,
      right: 0,
      height: 3,
      label: ' QI Agent Terminal User Interface ',
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
      tags: true,
      content: '{center}{bold}{blue-fg}⚡ QI Agent AI CLI{/blue-fg}{/bold}\n{center}{grey-fg}Tab to navigate • F1 for help • q/Ctrl+C/Ctrl+D to quit{/grey-fg}{/center}'
    });

    // Main response panel (left side, larger)
    this.widgets.mainPanel = blessed.box({
      parent: this.screen,
      label: ' 🤖 AI Response ',
      top: 3,
      left: 0,
      width: '70%',
      bottom: 5, // Leave space for input and status
      border: {
        type: 'line',
        fg: 'green'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'green'
        }
      },
      scrollable: true,
      alwaysScroll: true,
      scrollbar: {
        style: {
          bg: 'green',
          fg: 'white'
        },
        track: {
          bg: 'grey'
        }
      },
      mouse: true,
      keys: true,
      vi: true, // Enable vi-style scrolling (j/k/g/G)
      tags: true,
      wrap: true,
      content: '{center}{grey-fg}AI responses will appear here...{/grey-fg}\n{center}{dim}Use j/k or ↑/↓ to scroll • g/G for top/bottom{/dim}{/center}'
    });

    // Context/History panel using proven list pattern from chat example
    this.widgets.contextPanel = blessed.list({
      parent: this.screen,
      label: ' 📝 Conversation History ',
      align: 'left',
      mouse: true,
      keys: true,
      width: '30%',
      height: '90%', // Leave space for input at bottom
      top: 3,
      left: '70%',
      scrollbar: {
        ch: ' ',
        inverse: true,
        style: {
          bg: 'yellow'
        }
      },
      border: {
        type: 'line',
        fg: 'yellow'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'yellow'
        },
        selected: {
          bg: 'yellow',
          fg: 'black'
        }
      },
      items: ['🕐 Conversation will appear here...']
    });

    // Input using proven blessed textarea pattern from chat examples
    // Fix for input duplication: Use inputOnFocus: false to prevent double listener registration
    this.widgets.inputPanel = blessed.textarea({
      parent: this.screen,
      bottom: 0,
      height: 3,
      left: 0,
      right: 0,
      inputOnFocus: false, // Fixed: Prevent automatic double listener registration
      padding: {
        top: 0,
        left: 1,
      },
      label: ' 💬 Your Message ',
      border: {
        type: 'line',
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'magenta'
        },
        focus: {
          fg: 'yellow',
          bg: 'black',
          border: {
            fg: 'yellow'
          }
        },
      },
      keys: true,
      mouse: true
    });

    // Set up proven input event handling pattern
    this.setupProvenInputHandling();
    
    // Add input blur fix for TUI textarea
    this.addInputBlurFix();

    // Status bar (bottom)
    this.widgets.statusBar = blessed.box({
      parent: this.screen,
      bottom: 0,
      left: 0,
      right: 0,
      height: 2,
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      },
      tags: true,
      content: '{left}{green-fg}● Connected{/green-fg} {grey-fg}|{/grey-fg} Mode: Interactive {grey-fg}|{/grey-fg} Panel: Input{/left}{right}{grey-fg}Use ← → ↑ ↓ to navigate{/right}'
    });

    // Set initial focus
    this.widgets.inputPanel.focus();
  }

  private setupNavigation(): void {
    const panels = ['input', 'main', 'context'];
    let currentIndex = 0;

    // Tab navigation between panels
    this.screen.key(['tab'], () => {
      currentIndex = (currentIndex + 1) % panels.length;
      this.focusPanel(panels[currentIndex]);
    });

    // Shift+Tab for reverse navigation
    this.screen.key(['S-tab'], () => {
      currentIndex = (currentIndex - 1 + panels.length) % panels.length;
      this.focusPanel(panels[currentIndex]);
    });

    // Arrow key navigation
    this.screen.key(['right'], () => {
      if (this.activePanel === 'main') {
        this.focusPanel('context');
      } else if (this.activePanel === 'input') {
        this.focusPanel('main');
      }
    });

    this.screen.key(['left'], () => {
      if (this.activePanel === 'context') {
        this.focusPanel('main');
      } else if (this.activePanel === 'main') {
        this.focusPanel('input');
      }
    });

    this.screen.key(['up'], () => {
      if (this.activePanel === 'input') {
        this.focusPanel('main');
      }
    });

    this.screen.key(['down'], () => {
      if (this.activePanel === 'main' || this.activePanel === 'context') {
        this.focusPanel('input');
      }
    });
  }

  private setupProvenInputHandling(): void {
    // Use the proven pattern from chat examples - simple key handler
    this.widgets.inputPanel.key('enter', () => {
      const message = this.widgets.inputPanel.getValue();
      
      if (message && message.trim()) {
        try {
          // Call our callback (like the chat example calls channel.sendMessage)
          if (this.inputCallback) {
            this.inputCallback(message.trim());
          }
        } catch (err) {
          console.error('Error handling input:', err);
        } finally {
          // Clear input and re-render (exactly like the example)
          this.widgets.inputPanel.clearValue();
          this.screen.render();
        }
      }
    });

    // Handle escape to cancel
    this.widgets.inputPanel.key('escape', () => {
      this.widgets.inputPanel.clearValue();
      this.screen.render();
    });

    // Focus the input initially (like the examples) with proper focus handling
    if (this.widgets.inputPanel.inputFocus) {
      this.widgets.inputPanel.inputFocus();
    } else {
      this.widgets.inputPanel.focus();
    }
  }

  private setupKeyBindings(): void {
    // Global quit keys using proven pattern from examples
    this.screen.key(['escape', 'q', 'C-c'], () => {
      return process.exit(0);
    });

    // Help
    this.screen.key(['f1'], () => {
      this.showHelp();
    });

    // Mode switching (example)
    this.screen.key(['m'], () => {
      this.updateStatus('Mode: Command');
    });

    // Clear current panel
    this.screen.key(['C-l'], () => {
      this.clearActivePanel();
    });
  }

  private focusPanel(panelName: string): void {
    this.activePanel = panelName;
    
    // Reset all borders to default
    if (this.widgets.mainPanel) this.widgets.mainPanel.style.border = { fg: 'green' };
    if (this.widgets.contextPanel) this.widgets.contextPanel.style.border = { fg: 'yellow' };
    if (this.widgets.inputPanel) this.widgets.inputPanel.style.border = { fg: 'magenta' };

    // Highlight active panel
    switch (panelName) {
      case 'main':
        this.widgets.mainPanel.style.border = { fg: 'white' };
        this.widgets.mainPanel.focus();
        break;
      case 'context':
        this.widgets.contextPanel.style.border = { fg: 'white' };
        this.widgets.contextPanel.focus();
        break;
      case 'input':
      default:
        this.widgets.inputPanel.style.border = { fg: 'white' };
        // Use proper input focus to prevent duplication
        if (this.widgets.inputPanel.inputFocus) {
          this.widgets.inputPanel.inputFocus();
        } else {
          this.widgets.inputPanel.focus();
        }
        break;
    }

    // Update status bar
    this.updateStatus(`Panel: ${panelName.charAt(0).toUpperCase() + panelName.slice(1)}`);
    this.screen.render();
  }

  private updateStatus(statusText: string): void {
    if (this.widgets.statusBar && !this.isDestroyed) {
      const currentContent = this.widgets.statusBar.getContent();
      // Update just the panel part, keep other status info
      const newContent = currentContent.replace(/Panel: \w+/, statusText);
      this.widgets.statusBar.setContent(newContent);
      this.screen.render();
    }
  }

  private clearActivePanel(): void {
    switch (this.activePanel) {
      case 'main':
        if (this.widgets.mainPanel) {
          this.widgets.mainPanel.setContent('{center}{grey-fg}AI responses will appear here...{/grey-fg}{/center}');
        }
        break;
      case 'context':
        if (this.widgets.contextPanel) {
          this.widgets.contextPanel.setContent('{center}{grey-fg}Conversation history...{/grey-fg}{/center}');
        }
        break;
      case 'input':
        if (this.widgets.inputPanel) {
          this.widgets.inputPanel.clearValue();
        }
        break;
    }
    this.screen.render();
  }

  private showHelp(): void {
    const helpBox = blessed.message({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: 60,
      height: 15,
      label: ' Help ',
      border: {
        type: 'line'
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

    helpBox.display(`{center}{bold}QI Agent TUI Help{/bold}{/center}

{bold}Navigation:{/bold}
Tab / Shift+Tab       Navigate between panels
← → ↑ ↓              Arrow key navigation
j / k                Vi-style scroll up/down
g / G                Jump to top/bottom
Enter                Send message (in input panel)

{bold}Commands:{/bold}
q / Ctrl+C / Ctrl+D   Quit application (press twice if typing)
F1                    Show this help
m                     Switch mode
Ctrl+L                Clear active panel
Escape                Clear input

{bold}Panels:{/bold}
• Input Panel     Type your messages here (multiline supported)
• Main Panel      AI responses with scrollbar
• Context Panel   Conversation history with timestamps

{bold}Features:{/bold}
• Vi-style scrolling (j/k/g/G)
• Mouse wheel scrolling
• Scrollbar indicators
• Multiline input support

{center}Press any key to close{/center}`, 0, () => {
      this.screen.render();
    });
  }

  // Public methods for external interaction

  public addToMain(content: string): void {
    if (this.widgets.mainPanel && !this.isDestroyed) {
      const current = this.widgets.mainPanel.getContent();
      const newContent = current + '\n' + content;
      this.widgets.mainPanel.setContent(newContent);
      this.widgets.mainPanel.setScrollPerc(100); // Scroll to bottom
      this.screen.render();
    }
  }

  public addToContext(content: string): void {
    if (this.widgets.contextPanel && !this.isDestroyed) {
      // Use proven list pattern from chat example
      this.widgets.contextPanel.addItem(content);
      this.widgets.contextPanel.scrollTo(100); // Scroll to latest message
      this.screen.render();
    }
  }

  public setMainContent(content: string): void {
    if (this.widgets.mainPanel && !this.isDestroyed) {
      this.widgets.mainPanel.setContent(content);
      this.screen.render();
    }
  }

  public getInputValue(): string {
    return this.widgets.inputPanel?.getValue() || '';
  }

  public clearInput(): void {
    if (this.widgets.inputPanel) {
      this.widgets.inputPanel.clearValue();
      this.screen.render();
    }
  }

  public onInput(callback: (value: string) => void): void {
    // Store callback for blessed textarea system
    this.inputCallback = callback;
  }

  public render(): void {
    if (!this.isDestroyed) {
      this.screen.render();
    }
  }

  public getScreen(): blessed.Widgets.Screen {
    return this.screen;
  }

  public destroy(): void {
    if (this.isDestroyed) return;
    
    // Clean up input panel listeners before destroying
    if (this.widgets.inputPanel && this.widgets.inputPanel.inputBlur) {
      this.widgets.inputPanel.inputBlur();
    }
    
    this.screen.destroy();
    this.isDestroyed = true;
  }

  /**
   * Fix for blessed textarea input duplication issue
   * Based on GitHub issues #109 and #383 solutions
   */
  private addInputBlurFix(): void {
    if (!this.widgets.inputPanel) return;

    // Add proper inputBlur method using setImmediate for timing
    this.widgets.inputPanel.inputBlur = () => {
      setImmediate(() => {
        if (this.widgets.inputPanel && this.widgets.inputPanel.__listener) {
          this.widgets.inputPanel.removeListener('keypress', this.widgets.inputPanel.__listener);
          delete this.widgets.inputPanel.__listener;
        }
      });
    };

    // Add proper inputFocus method to prevent double listeners
    this.widgets.inputPanel.inputFocus = () => {
      // Clean up any existing listeners first
      if (this.widgets.inputPanel.inputBlur) {
        this.widgets.inputPanel.inputBlur();
      }
      
      // Then add new listeners
      if (this.widgets.inputPanel.addHandlers) {
        this.widgets.inputPanel.addHandlers();
      }
      
      // Finally focus
      this.widgets.inputPanel.focus();
    };
  }

  /**
   * Graceful exit with cleanup
   */
  private gracefulExit(): void {
    try {
      // Show goodbye message
      const goodbyeBox = this.widgets.mainPanel;
      if (goodbyeBox) {
        goodbyeBox.setContent('\n{center}{bold}{cyan-fg}👋 Goodbye! Thanks for using QI Agent TUI{/cyan-fg}{/bold}{/center}');
        this.screen.render();
      }
      
      // Brief delay to show message, then cleanup and exit
      setTimeout(() => {
        this.destroy();
        process.exit(0);
      }, 500);
    } catch (error) {
      // Force exit if graceful exit fails
      process.exit(0);
    }
  }
}