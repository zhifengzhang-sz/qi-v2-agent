/**
 * v-0.6.1 Pure Enqueue-Only CLI Framework
 *
 * Transformed for pure message-driven architecture:
 * - No direct orchestrator calls - only enqueues messages
 * - Integrates with QiAsyncMessageQueue for coordination
 * - Maintains same public API for backward compatibility
 * - All processing happens through message flow
 *
 * Key changes for v-0.6.1:
 * - sendToAgent() -> enqueueUserInput()
 * - All agent communication through message queue
 * - Event emission converted to message enqueuing
 * - Pure display and input handling only
 */

import type { ICommandHandler } from '../../command/abstractions/index.js';
// v-0.6.1 Message Queue integration
import type { QiAsyncMessageQueue } from '../../messaging/impl/QiAsyncMessageQueue.js';
import type { QiMessage, UserInputMessage } from '../../messaging/types/MessageTypes.js';
import { MessagePriority, MessageType } from '../../messaging/types/MessageTypes.js';
import type {
  CLIConfig,
  CLIEvents,
  MessageType as CLIMessageType,
  CLIMode,
  CLIState,
  IAgentCLIBridge,
  ICLIFramework,
} from '../abstractions/ICLIFramework.js';
import type { IAgentConnector, ICommandRouter } from '../abstractions/ICLIServices.js';
import type { IInputManager } from '../abstractions/IInputManager.js';
// Injected dependencies interfaces
import type { ITerminal } from '../abstractions/ITerminal.js';
import type {
  IModeRenderer,
  IProgressRenderer,
  IStreamRenderer,
} from '../abstractions/IUIComponent.js';

/**
 * v-0.6.1 Pure Message-Driven CLI Architecture
 *
 * This implementation delegates all operations to injected components:
 * - Terminal operations → ITerminal implementation
 * - Input handling → IInputManager implementation
 * - Progress display → IProgressRenderer implementation
 * - Mode management → IModeRenderer implementation
 * - Streaming → IStreamRenderer implementation
 * - v-0.6.1: Events removed - pure message coordination
 * - Commands → ICommandRouter implementation
 * - Message coordination → QiAsyncMessageQueue (v-0.6.1)
 */
export class MessageDrivenCLI implements ICLIFramework, IAgentCLIBridge {
  private config: CLIConfig;
  private state: CLIState;
  private isInitialized = false;
  private isStarted = false;

  constructor(
    private terminal: ITerminal,
    private inputManager: IInputManager,
    private progressRenderer: IProgressRenderer,
    private modeRenderer: IModeRenderer,
    private streamRenderer: IStreamRenderer,
    // v-0.6.1: IEventManager removed - pure message-driven
    private commandRouter: ICommandRouter,
    private messageQueue: QiAsyncMessageQueue<QiMessage>, // v-0.6.1: Replace agentConnector
    config: Partial<CLIConfig> = {},
    private commandHandler?: ICommandHandler
  ) {
    // Default configuration
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
      debug: false,
      ...config,
    };

    // Initialize state
    this.state = {
      mode: 'interactive',
      isProcessing: false,
      isStreamingActive: false,
      currentInput: '',
      history: [],
      startTime: new Date(),
      lastActivity: new Date(),
    };

    // v-0.6.1: No event handlers needed - pure message-driven
  }

  /**
   * Initialize the CLI framework
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // v-0.6.1: Minimal initialization - pure message-driven CLI
    this.inputManager.initialize({
      historySize: this.config.historySize,
      autoComplete: this.config.autoComplete,
      enableColors: this.config.colors,
    });

    // Essential: Connect input capture to message flow
    // NOTE: This is only used for readline-based frameworks
    // Ink/Hybrid frameworks handle input directly through React components
    this.inputManager.onInput((input) => {
      console.log(`[EventDrivenCLI] inputManager.onInput called: "${input}"`);
      this.handleInput(input);
    });

    this.isInitialized = true;
  }

  /**
   * Start the CLI
   */
  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    if (this.isStarted) {
      return;
    }

    this.terminal.writeLine('🚀 Message-Driven CLI Ready');
    this.terminal.writeLine('============================');
    this.terminal.writeLine('💡 Type /exit to quit');
    this.terminal.writeLine('');

    // Show initial prompt
    this.inputManager.showPrompt();

    this.isStarted = true;
  }

  /**
   * Shutdown the CLI
   */
  async shutdown(): Promise<void> {
    if (!this.isStarted) return;

    // Cancel any active operations
    if (this.state.isProcessing) {
      // v-0.6.1: Direct cancellation instead of events
      this.state.isProcessing = false;
    }

    // Cleanup components
    this.progressRenderer.destroy();
    this.modeRenderer.destroy();
    this.streamRenderer.destroy();
    this.inputManager.close();
    // v-0.6.1: No eventManager to destroy

    this.isStarted = false;
    // v-0.6.1: No shutdown events
  }

  // State management (delegated to components)

  getState(): CLIState {
    return { ...this.state };
  }

  setMode(mode: CLIMode): void {
    // v-0.6.1: Simplified mode setting
    this.state.mode = mode;
  }

  getMode(): CLIMode {
    return this.state.mode;
  }

  // Input/Output (delegated to injected components)

  showPrompt(): void {
    if (this.isPromptActive()) {
      this.inputManager.showPrompt();
    }
  }

  private isPromptActive(): boolean {
    return !this.state.isProcessing && !this.state.isStreamingActive;
  }

  // v-0.6.1: handleInput moved to line 351 to follow design specification

  displayMessage(content: string, type?: CLIMessageType): void {
    // Only responsibility: display (EXACT design specification)
    this.terminal.writeLine(content);

    // CRITICAL: Reset processing state when displaying final message
    this.state.isProcessing = false;

    // Essential: Show prompt for next input
    this.inputManager.showPrompt();
  }

  /**
   * CRITICAL: Reset processing state to stop infinite loading
   * Called by QiPromptCLI after processing messages
   */
  resetProcessingState(): void {
    this.state.isProcessing = false;
  }

  displayProgress(phase: string, progress: number, details?: string): void {
    this.progressRenderer.updateProgress(progress, phase, details);
  }

  // Streaming methods (delegated to streamRenderer)
  startStreaming(): void {
    this.state.isStreamingActive = true;
    this.streamRenderer.startStreaming();
  }

  addStreamingChunk(content: string): void {
    this.streamRenderer.addChunk(content);
  }

  completeStreaming(message?: string): void {
    this.state.isStreamingActive = false;
    this.streamRenderer.complete(message);
    this.showPrompt();
  }

  cancelStreaming(): void {
    this.state.isStreamingActive = false;
    this.streamRenderer.cancel();
    this.showPrompt();
  }

  // Event methods (deprecated for v-0.6.1 message-driven architecture)
  on<K extends keyof CLIEvents>(event: K, listener: (data: CLIEvents[K]) => void): void {
    // v-0.6.1: Event system simplified - most events converted to messages
    console.warn(
      `[MessageDrivenCLI] Event '${event}' registration - consider using message queue instead`
    );
  }

  off<K extends keyof CLIEvents>(event: K, listener: (data: CLIEvents[K]) => void): void {
    // v-0.6.1: Event system simplified
    console.warn(
      `[MessageDrivenCLI] Event '${event}' removal - consider using message queue instead`
    );
  }

  emit<K extends keyof CLIEvents>(event: K, data: CLIEvents[K]): void {
    // v-0.6.1: Most events converted to messages
    console.warn(
      `[MessageDrivenCLI] Event '${event}' emission - consider using message queue instead`
    );
  }

  // IAgentCLIBridge implementation (simplified for v-0.6.1)
  connectAgent(agent: any): void {
    // v-0.6.1: Agent connection handled through message queue
    console.log('[MessageDrivenCLI] Agent connection - handled via message queue');
  }

  disconnectAgent(): void {
    // v-0.6.1: Agent disconnection handled through message queue
    console.log('[MessageDrivenCLI] Agent disconnection - handled via message queue');
  }

  onAgentProgress(progress: { phase: string; progress: number; details?: string }): void {
    this.displayProgress(progress.phase, progress.progress, progress.details);
  }

  onAgentMessage(message: { content: string; type: string }): void {
    this.displayMessage(message.content, message.type as CLIMessageType);
  }

  onAgentComplete(result: any): void {
    this.state.isProcessing = false;
    this.displayMessage(`✅ Complete: ${result}`);
  }

  onAgentError(error: any): void {
    this.state.isProcessing = false;
    this.displayMessage(`❌ Error: ${error}`, 'error');
  }

  onAgentCancelled(reason: string): void {
    this.state.isProcessing = false;
    this.displayMessage(`🛑 Cancelled: ${reason}`, 'warning');
  }

  sendToAgent(input: string): void {
    // v-0.6.1: Delegate to handleInput which uses message queue
    this.handleInput(input);
  }

  cancelAgent(): void {
    this.state.isProcessing = false;
    this.cancelStreaming();
    this.displayMessage('🛑 Operation cancelled');
  }

  // v-0.6.1: All complex methods removed - CLI only enqueues and displays

  // v-0.6.1: Event handling completely removed - pure message-driven architecture

  // Configuration

  // State Management Integration (required by ICLIFramework)
  subscribeToStateChanges(stateManager: any): void {
    // v-0.6.1: MessageDrivenCLI uses message queue for state coordination
    console.log('[MessageDrivenCLI] StateManager subscription - handled via message queue');
  }

  updateConfig(newConfig: Partial<CLIConfig>): void {
    this.config = { ...this.config, ...newConfig };

    // Update component configurations
    this.progressRenderer.updateConfig({ animated: this.config.animations });
    this.streamRenderer.updateConfig({ throttleMs: this.config.streamingThrottle });
    this.inputManager.updateConfig({
      historySize: this.config.historySize,
      autoComplete: this.config.autoComplete,
    });
  }

  getConfig(): CLIConfig {
    return { ...this.config };
  }

  // v-0.6.1: Pure message queue - no agent integration methods needed

  // v-0.6.1: Agent callbacks removed - communication through message queue only

  // Design specification: handleInput() method
  handleInput(input: string): void {
    console.log(`[MessageDrivenCLI] handleInput called with: "${input}"`);
    // Handle essential commands directly for functionality
    if (input.trim() === '/exit' || input.trim() === '/quit') {
      this.terminal.writeLine('👋 Goodbye!');
      process.exit(0);
      return;
    }

    // All other input goes to message queue
    console.log(`[MessageDrivenCLI] Enqueuing to message queue`);
    const userInputMessage: UserInputMessage = {
      id: Math.random().toString(36).substring(2, 15),
      type: MessageType.USER_INPUT,
      timestamp: new Date(),
      priority: MessagePriority.NORMAL,
      input: input,
      raw: false,
      source: 'cli',
    };
    this.messageQueue.enqueue(userInputMessage);
  }

  // v-0.6.1: Pure message-driven CLI - only handleInput and displayMessage

  // v-0.6.1: All complex private methods removed - pure message-driven only

  // v-0.6.1: All complex private methods removed - CLI is now pure (only enqueue and display)
}

/**
 * v-0.6.1 Factory function - requires message queue injection
 */
export function createMessageDrivenCLI(
  messageQueue: QiAsyncMessageQueue<QiMessage>,
  _config?: Partial<CLIConfig>
): MessageDrivenCLI {
  // v-0.6.1: Message queue is required for pure enqueue-only architecture
  // The actual implementation will be handled by the factory functions
  throw new Error('Use createCLI() from factories with messageQueue parameter instead');
}
