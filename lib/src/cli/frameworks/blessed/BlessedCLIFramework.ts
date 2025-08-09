/**
 * neo-blessed CLI Framework Implementation
 * 
 * Complete blessed-based CLI framework that implements ICLIFramework interface.
 * Uses blessed widgets for rich terminal user interface.
 */

import * as blessed from 'neo-blessed';
import type { ICLIFramework, CLIConfig } from '../../abstractions/ICLIFramework.js';
import { BlessedTerminal } from './BlessedTerminal.js';
import { BlessedInputManager } from './BlessedInputManager.js';
import { BlessedProgressRenderer } from './BlessedProgressRenderer.js';
import { BlessedModeRenderer } from './BlessedModeRenderer.js';
import { BlessedStreamRenderer } from './BlessedStreamRenderer.js';

/**
 * neo-blessed CLI framework implementation
 * 
 * Provides a complete TUI CLI experience using blessed widgets.
 * Supports all CLI framework features with enhanced visual feedback.
 */
export class BlessedCLIFramework implements ICLIFramework {
  private isDestroyed = false;
  private screen: blessed.Widgets.Screen;
  private terminal: BlessedTerminal;
  private inputManager: BlessedInputManager;
  private progressRenderer: BlessedProgressRenderer;
  private modeRenderer: BlessedModeRenderer;
  private streamRenderer: BlessedStreamRenderer;
  private config: CLIConfig;

  constructor(config: Partial<CLIConfig> = {}) {
    this.config = {
      enableHotkeys: true,
      enableStreaming: true,
      debug: false,
      ...config
    };

    // Fix for blessed input duplication: Clean up any persistent stdin listeners
    // from previous CLI frameworks (readline, ink) before initializing blessed
    // This prevents interference that causes "hi" to become "hhii"
    process.stdin.removeAllListeners('data');
    process.stdin.removeAllListeners('keypress');

    // Create blessed screen (shared by all components)
    this.screen = blessed.screen({
      smartCSR: true,
      title: 'Qi CLI',
      cursor: {
        artificial: true,
        shape: 'line',
        blink: true
      },
      debug: this.config.debug,
      dockBorders: false,
      ignoreLocked: ['C-c']
    });

    // Initialize components (all sharing the same screen)
    this.terminal = new BlessedTerminal(this.screen);
    this.inputManager = new BlessedInputManager(this.screen);
    this.progressRenderer = new BlessedProgressRenderer(this.screen);
    this.modeRenderer = new BlessedModeRenderer(this.screen);
    this.streamRenderer = new BlessedStreamRenderer(this.screen);

    this.setupEventHandlers();
  }

  private setupEventHandlers(): void {
    // Handle screen-level events
    this.screen.key(['q', 'C-c'], () => {
      this.shutdown();
      process.exit(0);
    });

    // Handle escape key for cancellation
    this.screen.key(['escape'], () => {
      this.emit('cancel');
    });

    // Handle Shift+Tab for mode cycling
    this.screen.key(['S-tab'], () => {
      const newMode = this.modeRenderer.cycleMode();
      this.emit('modeChange', newMode);
    });

    // Handle window resize
    this.screen.on('resize', () => {
      this.render();
    });
  }

  async initialize(): Promise<void> {
    if (this.isDestroyed) return;

    // Show mode indicator
    this.modeRenderer.show();
    
    // Show input prompt
    this.inputManager.showPrompt();
    
    // Initial render
    this.render();
  }

  async start(): Promise<void> {
    await this.initialize();
    
    // Blessed handles the main loop automatically
    // The screen will continue processing events
  }

  async shutdown(): Promise<void> {
    if (this.isDestroyed) return;

    // Clean up components
    this.streamRenderer.destroy();
    this.progressRenderer.destroy();
    this.modeRenderer.destroy();
    this.inputManager.destroy();
    this.terminal.destroy();
    
    // Destroy screen
    this.screen.destroy();
    
    this.isDestroyed = true;
  }

  displayMessage(message: string, type: 'info' | 'warning' | 'error' | 'success' | 'complete' = 'info'): void {
    if (this.isDestroyed) return;

    // Add type indicator
    let prefix = '';
    switch (type) {
      case 'warning':
        prefix = '⚠️  ';
        break;
      case 'error':
        prefix = '❌ ';
        break;
      case 'success':
      case 'complete':
        prefix = '✅ ';
        break;
      case 'info':
      default:
        prefix = 'ℹ️  ';
        break;
    }

    this.inputManager.write(`${prefix}${message}\n`);
  }

  displayProgress(phase: string, progress: number): void {
    if (this.isDestroyed) return;

    this.progressRenderer.updateProgress(progress, phase);
  }

  startProgress(title: string): void {
    if (this.isDestroyed) return;

    this.progressRenderer.start({
      title,
      showPercentage: true,
      showPhase: true,
      initialMessage: 'Starting...'
    });
  }

  completeProgress(message?: string): void {
    if (this.isDestroyed) return;

    this.progressRenderer.complete(message);
  }

  cancelProgress(): void {
    if (this.isDestroyed) return;

    this.progressRenderer.cancel();
  }

  startStreaming(): void {
    if (this.isDestroyed) return;

    this.streamRenderer.startStreaming();
  }

  addStreamChunk(content: string): void {
    if (this.isDestroyed) return;

    this.streamRenderer.addChunk(content);
  }

  completeStream(): void {
    if (this.isDestroyed) return;

    this.streamRenderer.complete();
  }

  cancelStream(): void {
    if (this.isDestroyed) return;

    this.streamRenderer.cancel();
  }

  updatePrompt(prompt: string): void {
    if (this.isDestroyed) return;

    this.inputManager.setPrompt(prompt);
  }

  clearScreen(): void {
    if (this.isDestroyed) return;

    this.inputManager.clearScreen();
  }

  render(): void {
    if (this.isDestroyed) return;

    this.screen.render();
  }

  // Event emitter functionality
  private eventHandlers: Map<string, Function[]> = new Map();

  on(event: string, handler: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, []);
    }
    this.eventHandlers.get(event)!.push(handler);
  }

  off(event: string, handler: Function): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      const index = handlers.indexOf(handler);
      if (index !== -1) {
        handlers.splice(index, 1);
      }
    }
  }

  emit(event: string, ...args: any[]): void {
    const handlers = this.eventHandlers.get(event);
    if (handlers) {
      for (const handler of handlers) {
        try {
          handler(...args);
        } catch (error) {
          console.error(`Error in event handler for ${event}:`, error);
        }
      }
    }
  }

  // Input handling
  onInput(callback: (input: string) => void): void {
    this.inputManager.onInput(callback);
  }

  onKeypress(callback: (key: string, data: any) => void): void {
    this.inputManager.onKeypress(callback);
  }

  /**
   * Get the current CLI framework name
   */
  getFramework(): string {
    return 'blessed';
  }

  /**
   * Get framework-specific capabilities
   */
  getCapabilities(): Record<string, boolean> {
    return {
      colors: true,
      unicode: true,
      mouse: true,
      widgets: true,
      scrolling: true,
      windows: true,
      forms: true,
    };
  }

  /**
   * Get current configuration
   */
  getConfig(): CLIConfig {
    return { ...this.config };
  }

  /**
   * Connect agent for compatibility with setupQuickCLI
   */
  connectAgent(agent: any): void {
    if (!agent) return;

    // Set up agent communication similar to EventDrivenCLI
    this.onInput((input: string) => {
      if (agent.process) {
        agent.process({ input, context: {} });
      }
    });

    // Handle agent events if supported
    if (agent.on) {
      agent.on('progress', (data: any) => {
        if (data.progress !== undefined && data.phase) {
          this.displayProgress(data.phase, data.progress);
        }
      });

      agent.on('message', (data: any) => {
        if (data.content) {
          if (data.type === 'streaming') {
            this.addStreamChunk(data.content);
          } else {
            this.displayMessage(data.content, data.type || 'info');
          }
        }
      });

      agent.on('complete', (data: any) => {
        this.completeProgress();
        if (data.result && data.result.content) {
          this.displayMessage(data.result.content, 'complete');
        }
      });

      agent.on('error', (data: any) => {
        this.displayMessage(data.message || 'An error occurred', 'error');
      });
    }
  }
}