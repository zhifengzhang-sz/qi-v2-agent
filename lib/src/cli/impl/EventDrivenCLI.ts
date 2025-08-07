/**
 * Event-Driven CLI Framework
 * 
 * Main implementation of the responsive, event-driven CLI system with:
 * - Hotkey support (Shift+Tab for mode cycling, Esc for cancellation)
 * - Real-time progress indicators
 * - Mode switching (Interactive/Command/Streaming)
 * - Agent integration with bidirectional events
 */

import { EventEmitter } from 'node:events';
import * as readline from 'node:readline';
import type {
  ICLIFramework,
  IAgentCLIBridge,
  CLIEvents,
  CLIConfig,
  CLIState,
  CLIMode,
  MessageType,
} from '../abstractions/ICLIFramework.js';
import { HotkeyManager } from '../keyboard/HotkeyManager.js';
import { ProgressDisplay } from '../ui/ProgressDisplay.js';
import { ModeIndicator } from '../ui/ModeIndicator.js';
import { StreamingRenderer } from '../ui/StreamingRenderer.js';
import { Terminal, Colors } from '../keyboard/KeyboardUtils.js';

/**
 * Event-driven CLI framework implementation
 */
export class EventDrivenCLI extends EventEmitter implements ICLIFramework, IAgentCLIBridge {
  private config: CLIConfig;
  private state: CLIState;
  private rl: readline.Interface | null = null;
  private isInitialized = false;
  private isStarted = false;

  // UI Components
  private hotkeyManager: HotkeyManager;
  private progressDisplay: ProgressDisplay;
  private modeIndicator: ModeIndicator;
  private streamingRenderer: StreamingRenderer;

  // Agent integration
  private connectedAgent: any = null;

  constructor(config: Partial<CLIConfig> = {}) {
    super();
    
    this.config = {
      enableHotkeys: true,
      enableModeIndicator: true,
      enableProgressDisplay: true,
      enableStreaming: true,
      prompt: '> ',
      colors: true,
      animations: true,
      historySize: 100,
      autoComplete: false,
      streamingThrottle: 0,
      maxBufferSize: 10000,
      ...config,
    };

    this.state = {
      mode: 'interactive',
      isProcessing: false,
      isStreamingActive: false,
      currentInput: '',
      history: [],
      startTime: new Date(),
      lastActivity: new Date(),
    };

    // Initialize UI components
    this.hotkeyManager = new HotkeyManager({
      enableShiftTab: this.config.enableHotkeys,
      enableEscape: this.config.enableHotkeys,
      enableCtrlC: true,
    });

    this.progressDisplay = new ProgressDisplay({
      animated: this.config.animations,
      showElapsed: true,
    });

    this.modeIndicator = new ModeIndicator({
      showIcon: this.config.colors,
      showLabel: true,
    });

    this.streamingRenderer = new StreamingRenderer({
      streamingSpeed: this.config.streamingThrottle,
      showCursor: this.config.animations,
    });

    this.setupEventHandlers();
  }

  /**
   * Initialize the CLI framework
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // Create readline interface
    this.rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      prompt: this.getFormattedPrompt(),
      historySize: this.config.historySize,
    });

    // Setup readline event handlers
    this.setupReadlineHandlers();

    // Enable hotkeys if configured
    if (this.config.enableHotkeys) {
      this.hotkeyManager.enable();
    }

    // Show mode indicator if configured
    if (this.config.enableModeIndicator) {
      this.modeIndicator.show();
    }

    this.isInitialized = true;
    this.emit('ready', { startTime: this.state.startTime });
  }

  /**
   * Start the CLI
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isStarted) return;

    console.log('🚀 Event-Driven CLI Ready');
    console.log('=========================');
    this.showModeHelp();
    console.log('💡 Press Shift+Tab to cycle modes, Esc to cancel operations');
    console.log('');

    this.showPrompt();
    this.isStarted = true;
  }

  /**
   * Shutdown the CLI
   */
  async shutdown(): Promise<void> {
    if (!this.isStarted) return;

    // Cancel any active operations
    if (this.state.isProcessing) {
      this.emit('cancelRequested', { reason: 'shutdown' });
    }

    // Cleanup components
    this.hotkeyManager.destroy();
    this.progressDisplay.destroy();
    this.modeIndicator.destroy();
    this.streamingRenderer.destroy();

    // Close readline
    if (this.rl) {
      this.rl.close();
      this.rl = null;
    }

    this.isStarted = false;
    this.emit('shutdown', { reason: 'normal' });
  }

  /**
   * Setup event handlers for all components
   */
  private setupEventHandlers(): void {
    // Hotkey events
    this.hotkeyManager.on('shiftTab', () => {
      if (!this.state.isProcessing) {
        this.cycleMode();
      }
    });

    this.hotkeyManager.on('escape', () => {
      if (this.state.isProcessing || this.state.isStreamingActive) {
        this.handleCancellation();
      }
    });

    this.hotkeyManager.on('ctrlC', () => {
      this.handleGracefulExit();
    });

    // Streaming renderer events
    this.streamingRenderer.on('streamingComplete', (content: string) => {
      this.state.isStreamingActive = false;
      this.emit('streamingComplete', { totalTime: Date.now() - this.state.lastActivity.getTime() });
      this.showPrompt();
    });

    this.streamingRenderer.on('streamingCancelled', () => {
      this.state.isStreamingActive = false;
      this.emit('streamingCancelled');
      this.showPrompt();
    });
  }

  /**
   * Setup readline event handlers
   */
  private setupReadlineHandlers(): void {
    if (!this.rl) return;

    this.rl.on('line', (input: string) => {
      this.handleUserInput(input.trim());
    });

    this.rl.on('close', () => {
      this.shutdown();
    });

    // Handle SIGINT (Ctrl+C)
    this.rl.on('SIGINT', () => {
      this.handleGracefulExit();
    });
  }

  /**
   * Handle user input
   */
  private handleUserInput(input: string): void {
    if (!input) {
      this.showPrompt();
      return;
    }

    // Add to history
    this.addToHistory(input);
    this.state.currentInput = input;
    this.state.lastActivity = new Date();

    // Handle CLI commands first
    if (this.handleCLICommand(input)) {
      return;
    }

    // Emit user input event
    this.emit('userInput', { input, mode: this.state.mode });
  }

  /**
   * Handle CLI-specific commands
   */
  private handleCLICommand(input: string): boolean {
    const command = input.toLowerCase().trim();

    switch (command) {
      case '/help':
      case '/h':
        this.showHelp();
        return true;

      case '/mode':
      case '/m':
        this.showModeHelp();
        return true;

      case '/clear':
      case '/c':
        console.clear();
        this.showPrompt();
        return true;

      case '/exit':
      case '/quit':
      case '/q':
        console.log('\n👋 Goodbye!');
        this.shutdown();
        // Exit immediately without waiting
        process.exit(0);
        return true;

      case '/status':
      case '/s':
        this.showStatus();
        return true;

      default:
        return false;
    }
  }

  /**
   * Show help information
   */
  private showHelp(): void {
    console.log('\n📚 CLI Commands:');
    console.log('  /help, /h        - Show this help');
    console.log('  /mode, /m        - Show mode information');
    console.log('  /clear, /c       - Clear screen');
    console.log('  /status, /s      - Show system status');
    console.log('  /exit, /quit, /q - Exit CLI');
    console.log('\n🔥 Hotkeys:');
    console.log('  Shift+Tab        - Cycle modes');
    console.log('  Esc             - Cancel current operation');
    console.log('  Ctrl+C          - Graceful exit');
    console.log('');
    this.showPrompt();
  }

  /**
   * Show mode help
   */
  private showModeHelp(): void {
    this.modeIndicator.showModeHelp();
    this.showPrompt();
  }

  /**
   * Show system status
   */
  private showStatus(): void {
    console.log(`\n📊 CLI Status:`);
    console.log(`  Mode: ${this.state.mode}`);
    console.log(`  Processing: ${this.state.isProcessing}`);
    console.log(`  Streaming: ${this.state.isStreamingActive}`);
    console.log(`  History: ${this.state.history.length} items`);
    console.log(`  Agent: ${this.connectedAgent ? 'Connected' : 'Disconnected'}`);
    console.log(`  Uptime: ${Math.floor((Date.now() - this.state.startTime.getTime()) / 1000)}s`);
    console.log('');
    this.showPrompt();
  }

  /**
   * Handle mode cycling
   */
  private cycleMode(): void {
    const previousMode = this.state.mode;
    const newMode = this.modeIndicator.cycleMode();
    
    this.state.mode = newMode;
    this.emit('modeChanged', { previousMode, newMode });
    
    // Update readline prompt
    if (this.rl) {
      this.rl.setPrompt(this.getFormattedPrompt());
    }
  }

  /**
   * Handle cancellation requests
   */
  private handleCancellation(): void {
    if (this.state.isStreamingActive) {
      this.streamingRenderer.cancel();
      this.state.isStreamingActive = false;
    }

    if (this.state.isProcessing) {
      this.state.isProcessing = false;
      this.progressDisplay.hide();
    }

    this.emit('cancelRequested', { reason: 'user_escape' });
    this.showPrompt();
  }

  /**
   * Handle graceful exit
   */
  private handleGracefulExit(): void {
    console.log('\n👋 Goodbye!');
    this.shutdown();
    // Force exit immediately on Ctrl+C
    process.exit(0);
  }

  /**
   * Get formatted prompt with mode indicator
   */
  private getFormattedPrompt(): string {
    const prefix = this.config.enableModeIndicator ? this.modeIndicator.getPromptPrefix() : '';
    return prefix + this.config.prompt;
  }

  /**
   * Add input to history
   */
  private addToHistory(input: string): void {
    this.state.history.push(input);
    
    // Trim history if it gets too long
    if (this.state.history.length > this.config.historySize) {
      this.state.history = this.state.history.slice(-this.config.historySize);
    }
  }

  // Implementation of ICLIFramework interface
  
  getState(): CLIState {
    return { ...this.state };
  }

  setMode(mode: CLIMode): void {
    const previousMode = this.state.mode;
    this.state.mode = mode;
    this.modeIndicator.setMode(mode);
    
    if (this.rl) {
      this.rl.setPrompt(this.getFormattedPrompt());
    }
    
    this.emit('modeChanged', { previousMode, newMode: mode });
  }

  getMode(): CLIMode {
    return this.state.mode;
  }

  showPrompt(): void {
    if (this.rl && !this.state.isProcessing && !this.state.isStreamingActive) {
      this.rl.prompt();
    }
  }

  handleInput(input: string): void {
    this.handleUserInput(input);
  }

  displayMessage(content: string, type: MessageType = 'info'): void {
    const icons = {
      status: 'ℹ️',
      streaming: '📡',
      complete: '✅',
      error: '❌',
      info: 'ℹ️',
      warning: '⚠️',
    };

    const icon = icons[type] || 'ℹ️';
    console.log(`${icon} ${content}`);
    
    this.emit('messageReceived', { content, type });
  }

  displayProgress(phase: string, progress: number, details?: string): void {
    if (!this.config.enableProgressDisplay) return;
    
    this.progressDisplay.update({ phase, progress, details });
    this.emit('progressUpdate', { phase, progress, details });
  }

  startStreaming(): void {
    if (!this.config.enableStreaming) return;
    
    this.state.isStreamingActive = true;
    this.streamingRenderer.startStreaming();
    this.emit('streamingStarted');
  }

  addStreamingChunk(content: string): void {
    if (!this.state.isStreamingActive) return;
    
    this.streamingRenderer.addChunk({ content, type: 'text' });
    this.emit('streamingChunk', { content });
  }

  completeStreaming(message?: string): void {
    if (!this.state.isStreamingActive) return;
    
    this.streamingRenderer.complete(message);
    // State is updated in event handler
  }

  cancelStreaming(): void {
    if (!this.state.isStreamingActive) return;
    
    this.streamingRenderer.cancel();
    // State is updated in event handler
  }

  updateConfig(newConfig: Partial<CLIConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // Update component configs
    this.hotkeyManager.updateConfig({
      enableShiftTab: this.config.enableHotkeys,
      enableEscape: this.config.enableHotkeys,
    });
    
    this.progressDisplay.updateConfig({
      animated: this.config.animations,
    });
    
    this.streamingRenderer.updateConfig({
      streamingSpeed: this.config.streamingThrottle,
      showCursor: this.config.animations,
    });
  }

  getConfig(): CLIConfig {
    return { ...this.config };
  }

  // Implementation of IAgentCLIBridge interface
  
  connectAgent(agent: any): void {
    this.connectedAgent = agent;
    
    // Setup agent event listeners
    if (agent.on) {
      agent.on('progress', this.onAgentProgress.bind(this));
      agent.on('message', this.onAgentMessage.bind(this));
      agent.on('complete', this.onAgentComplete.bind(this));
      agent.on('error', this.onAgentError.bind(this));
      agent.on('cancelled', this.onAgentCancelled.bind(this));
    }
  }

  disconnectAgent(): void {
    this.connectedAgent = null;
  }

  onAgentProgress(progress: { phase: string; progress: number; details?: string }): void {
    this.state.isProcessing = true;
    this.displayProgress(progress.phase, progress.progress, progress.details);
  }

  onAgentMessage(message: { content: string; type: string }): void {
    if (message.type === 'streaming' && this.config.enableStreaming) {
      if (!this.state.isStreamingActive) {
        this.startStreaming();
      }
      this.addStreamingChunk(message.content);
    } else {
      this.displayMessage(message.content, message.type as MessageType);
    }
  }

  onAgentComplete(result: any): void {
    this.state.isProcessing = false;
    this.progressDisplay.hide();
    
    if (this.state.isStreamingActive) {
      this.completeStreaming('Response completed');
    }
    
    this.displayMessage('Request completed', 'complete');
    this.showPrompt();
  }

  onAgentError(error: any): void {
    this.state.isProcessing = false;
    this.progressDisplay.hide();
    
    if (this.state.isStreamingActive) {
      this.streamingRenderer.cancel();
      this.state.isStreamingActive = false;
    }
    
    const errorMessage = error.message || error.error?.message || String(error);
    this.displayMessage(`Error: ${errorMessage}`, 'error');
    this.emit('error', { error: new Error(errorMessage), context: 'agent' });
    this.showPrompt();
  }

  onAgentCancelled(reason: string): void {
    this.state.isProcessing = false;
    this.progressDisplay.hide();
    
    if (this.state.isStreamingActive) {
      this.streamingRenderer.cancel();
      this.state.isStreamingActive = false;
    }
    
    this.displayMessage(`Request cancelled: ${reason}`, 'warning');
    this.showPrompt();
  }

  sendToAgent(input: string): void {
    if (!this.connectedAgent) {
      this.displayMessage('No agent connected', 'error');
      this.showPrompt();
      return;
    }
    
    this.state.isProcessing = true;
    
    // Start progress display
    this.progressDisplay.start({ phase: 'starting', progress: 0, details: 'Initializing...' });
    
    // Send to agent (assume it has a process method)
    if (this.connectedAgent.process) {
      const request = {
        input,
        context: {
          sessionId: 'cli-session',
          timestamp: new Date(),
          source: 'event-driven-cli',
          mode: this.state.mode,
        },
      };
      
      this.connectedAgent.process(request).catch((error: Error) => {
        this.onAgentError(error);
      });
    } else {
      this.displayMessage('Agent does not support processing', 'error');
      this.state.isProcessing = false;
      this.showPrompt();
    }
  }

  cancelAgent(): void {
    if (this.connectedAgent && this.connectedAgent.cancel) {
      this.connectedAgent.cancel();
    } else {
      // Manual cancellation fallback
      this.onAgentCancelled('manual');
    }
  }
}

/**
 * Create an EventDrivenCLI instance
 */
export function createEventDrivenCLI(config?: Partial<CLIConfig>): EventDrivenCLI {
  return new EventDrivenCLI(config);
}