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
import type {
  CLIConfig,
  CLIMode,
  CLIState,
  IAgentCLIBridge,
  ICLIFramework,
  MessageType,
} from '../abstractions/ICLIFramework.js';
import type {
  IAgentConnector,
  ICommandRouter,
} from '../abstractions/ICLIServices.js';
import type { IInputManager } from '../abstractions/IInputManager.js';
// Injected dependencies interfaces
import type { ITerminal } from '../abstractions/ITerminal.js';
import type {
  IModeRenderer,
  IProgressRenderer,
  IStreamRenderer,
} from '../abstractions/IUIComponent.js';
// v-0.6.1 Message Queue integration
import type { QiAsyncMessageQueue } from '../../messaging/impl/QiAsyncMessageQueue.js';
import type { QiMessage } from '../../messaging/types/MessageTypes.js';
import { MessageType } from '../../messaging/types/MessageTypes.js';

/**
 * v-0.6.1 Pure Enqueue-Only CLI - Message-driven architecture
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
export class EventDrivenCLI implements ICLIFramework, IAgentCLIBridge {
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

    this.setupEventHandlers();
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
    this.inputManager.onInput((input) => {
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

    this.terminal.writeLine('🚀 Event-Driven CLI Ready');
    this.terminal.writeLine('=========================');
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

  // v-0.6.1: handleInput moved to line 351 to follow design specification

  displayMessage(content: string, type?: MessageType): void {
    // Only responsibility: display (EXACT design specification)
    this.terminal.writeLine(content);
    // Essential: Show prompt for next input
    this.inputManager.showPrompt();
  }

  // v-0.6.1: All complex methods removed - CLI only enqueues and displays

  // v-0.6.1: Event handling completely removed - pure message-driven architecture

  // Configuration

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
    console.log(`[EventDrivenCLI] handleInput called with: "${input}"`);
    // Handle essential commands directly for functionality
    if (input.trim() === '/exit' || input.trim() === '/quit') {
      this.terminal.writeLine('👋 Goodbye!');
      process.exit(0);
      return;
    }
    
    // All other input goes to message queue
    console.log(`[EventDrivenCLI] Enqueuing to message queue`);
    this.messageQueue.enqueue({ type: MessageType.USER_INPUT, input: input });
  }

  // v-0.6.1: Pure message-driven CLI - only handleInput and displayMessage

  // v-0.6.1: All complex private methods removed - pure message-driven only

  // v-0.6.1: All complex private methods removed - CLI is now pure (only enqueue and display)
}

/**
 * v-0.6.1 Factory function - requires message queue injection
 */
export function createEventDrivenCLI(
  messageQueue: QiAsyncMessageQueue<QiMessage>,
  _config?: Partial<CLIConfig>
): EventDrivenCLI {
  // v-0.6.1: Message queue is required for pure enqueue-only architecture
  // The actual implementation will be handled by the factory functions
  throw new Error('Use createCLI() from factories with messageQueue parameter instead');
}
