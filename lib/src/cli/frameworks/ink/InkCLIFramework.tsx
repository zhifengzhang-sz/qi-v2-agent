/**
 * Ink CLI Framework Implementation
 * 
 * React-based CLI implementation using Ink framework
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { render, Text, useInput, useApp } from 'ink';
import { EventEmitter } from 'events';
import { randomBytes } from 'crypto';
import type {
  ICLIFramework,
  IAgentCLIBridge,
  CLIConfig,
  CLIState,
  CLIMode,
  CLIEvents,
  MessageType as ICLIFrameworkMessageType,
} from '../../abstractions/ICLIFramework.js';
import type { QiAsyncMessageQueue } from '../../../messaging/impl/QiAsyncMessageQueue.js';
import type { QiMessage } from '../../../messaging/types/MessageTypes.js';
import { MessageType } from '../../../messaging/types/MessageTypes.js';
import { MainLayout } from './components/MainLayout.js';
import { createOutputMessage, createUserMessage, createAssistantMessage, createSystemMessage, type OutputMessage } from './components/OutputDisplay.js';
import { createPermissionRequest, type PermissionRequest } from './components/PermissionDialog.js';
import { createDebugLogger } from '../../../utils/DebugLogger.js';

/**
 * Generate a unique message ID using crypto random bytes
 */
const generateUniqueId = (): string => {
  return randomBytes(8).toString('hex');
};

/**
 * Default CLI configuration for Ink
 */
const defaultInkConfig: CLIConfig = {
  enableHotkeys: true,
  enableModeIndicator: true,
  enableProgressDisplay: true,
  enableStreaming: true,
  prompt: '> ',
  colors: true,
  animations: true,
  historySize: 100,
  autoComplete: false,
  streamingThrottle: 10,
  maxBufferSize: 1000000,
  debug: false,
};

/**
 * Ink CLI Framework - React-based CLI implementation
 * Hybrid approach: EventEmitter for UI events, MessageQueue for agent communication
 */
export class InkCLIFramework extends EventEmitter implements ICLIFramework, IAgentCLIBridge {
  private config: CLIConfig;
  private state: CLIState;
  private isInitialized = false;
  private isShutdown = false;
  private renderInstance: any = null;
  private connectedAgent: any = null;
  private isCancelling = false;
  private messageQueue?: QiAsyncMessageQueue<QiMessage>;
  private debug = createDebugLogger('InkCLIFramework');

  constructor(config: Partial<CLIConfig> = {}, messageQueue?: QiAsyncMessageQueue<QiMessage>) {
    super(); // Initialize EventEmitter
    this.messageQueue = messageQueue;
    
    this.config = { ...defaultInkConfig, ...config };
    this.state = {
      mode: 'interactive',
      isProcessing: false,
      isStreamingActive: false,
      currentInput: '',
      history: [],
      startTime: new Date(),
      lastActivity: new Date(),
    };
  }

  // ==============================================
  // ICLIFramework Implementation
  // ==============================================

  async initialize(): Promise<void> {
    if (this.isInitialized) return;
    
    // Verify Ink is available
    try {
      require('ink');
      require('ink-text-input');
    } catch (error) {
      throw new Error('Ink packages not available. Install with: bun add ink ink-text-input');
    }
    
    this.isInitialized = true;
  }

  async start(): Promise<void> {
    if (!this.isInitialized) {
      await this.initialize();
    }
    
    if (this.renderInstance) {
      throw new Error('CLI already started');
    }

    // Render the Ink application with custom Ctrl+C handling
    this.renderInstance = render(
      <InkCLIApp
        framework={this}
        config={this.config}
        initialState={this.state}
      />,
      { exitOnCtrlC: false }
    );
  }

  async shutdown(): Promise<void> {
    if (this.isShutdown) return;
    
    this.isShutdown = true;
    
    if (this.renderInstance) {
      this.renderInstance.unmount();
      this.renderInstance = null;
    }
    
    // Clean up EventEmitter listeners
    this.removeAllListeners();
  }

  getState(): CLIState {
    return { ...this.state };
  }

  setMode(mode: CLIMode): void {
    const previousMode = this.state.mode;
    this.state.mode = mode;
    this.state.lastActivity = new Date();
    
    // Emit mode change event for React component
    this.emit('modeChange', { mode, previousMode });
  }

  getMode(): CLIMode {
    return this.state.mode;
  }

  showPrompt(): void {
    // In Ink, this is handled by the React component
  }

  handleInput(input: string): void {
    this.debug.log(`handleInput: "${input}"`);
    this.state.currentInput = input;
    this.state.history.push(input);
    if (this.state.history.length > this.config.historySize) {
      this.state.history = this.state.history.slice(-this.config.historySize);
    }
    this.state.lastActivity = new Date();
    
    // CRITICAL: Set processing state when handling input
    this.state.isProcessing = true;
    this.debug.log(`Set isProcessing to true for input processing`);
    
    // Handle exit commands: clear input and enqueue exit message
    if (input.trim() === '/exit' || input.trim() === '/quit') {
      // Clear input box in UI before exiting
      this.state.currentInput = '';
      this.emit('clearInput');

      if (this.messageQueue) {
        this.messageQueue.enqueue({
          type: MessageType.USER_INPUT,
          input: input,
          raw: false,
          source: 'cli' as const,
          timestamp: new Date(),
          id: generateUniqueId(),
          priority: 2 as any
        });
      }
      return;
    }
    
    // v-0.6.1: InkCLIFramework handles message enqueuing for React-based input
    // (EventDrivenCLI inputManager is not used in hybrid/ink mode)
    if (this.messageQueue) {
      this.debug.log(`Enqueuing to message queue: "${input}"`);
      this.messageQueue.enqueue({
        type: MessageType.USER_INPUT,
        input: input,
        raw: false,
        source: 'cli' as const,
        timestamp: new Date(),
        id: generateUniqueId(),
        priority: 2 as any
      });
    } else {
      console.error(`[InkCLIFramework] FATAL: No message queue - input lost!`);
    }
  }

  displayMessage(content: string, type: ICLIFrameworkMessageType = 'info'): void {
    // FIX: Prevent displaying empty or whitespace-only messages that cause empty lines
    if (!content || content.trim() === '') {
      this.debug.warn(`Skipping empty message display, type: ${type}`);
      return;
    }
    
    this.debug.log(`displayMessage: ${content}`);
    this.debug.log(`displayMessage type: ${type}`);
    this.debug.log(`displayMessage content length: ${content.length}`);
    
    // CRITICAL: Reset processing state when displaying final message
    this.state.isProcessing = false;
    this.debug.log(`Reset isProcessing to false`);
    
    // CRITICAL: Emit 'complete' event to reset React component processing state
    this.debug.log(`Emitting 'complete' event to reset React state`);
    this.emit('message', { content, type: 'complete' });
    
    // Essential: Signal that we're ready for new input after displaying message
    this.debug.log(`Ready for new input after displaying message`);
    this.emit('readyForInput');
  }

  displayProgress(phase: string, progress: number, details?: string): void {
    // FIX: Prevent empty or meaningless progress events that cause empty line rendering
    if (!phase || phase.trim() === '' || progress < 0 || progress > 100) {
      this.debug.warn(`Skipping invalid progress: phase="${phase}", progress=${progress}`);
      return;
    }
    
    this.debug.log(`Progress: ${phase} ${progress}% - Details: ${details}`);
    this.debug.log(`🔍 PROGRESS MESSAGE - This might be the workflow messages you're seeing!`);
    
    // Emit progress event for React component
    this.emit('progress', { phase, progress, details });
  }

  startStreaming(): void {
    this.state.isStreamingActive = true;
    
    // Emit streaming start event for React component
    this.emit('streamingStart');
  }

  addStreamingChunk(content: string): void {
    if (this.state.isStreamingActive) {
      // Emit streaming chunk event for React component
      this.emit('streamingChunk', { content });
    }
  }

  completeStreaming(message?: string): void {
    this.state.isStreamingActive = false;
    const totalTime = Date.now() - this.state.startTime.getTime();
    
    // Emit streaming complete event for React component
    this.emit('streamingComplete', { totalTime, message });
    
    if (message) {
      this.displayMessage(message, 'complete');
    }
  }

  cancelStreaming(): void {
    this.state.isStreamingActive = false;
    
    // Emit streaming cancelled event for React component
    this.emit('streamingCancelled');
  }

  updateConfig(config: Partial<CLIConfig>): void {
    this.config = { ...this.config, ...config };
  }

  getConfig(): CLIConfig {
    return { ...this.config };
  }

  // ==============================================
  // IAgentCLIBridge Implementation
  // ==============================================

  connectAgent(agent: any): void {
    this.connectedAgent = agent;
    
    // Listen for agent events if agent is an EventEmitter
    if (agent && typeof agent.on === 'function') {
      agent.on('progress', this.onAgentProgress.bind(this));
      agent.on('message', this.onAgentMessage.bind(this));
      agent.on('complete', this.onAgentComplete.bind(this));
      agent.on('error', this.onAgentError.bind(this));
      agent.on('cancelled', this.onAgentCancelled.bind(this));
    }
  }

  disconnectAgent(): void {
    if (this.connectedAgent && typeof this.connectedAgent.off === 'function') {
      this.connectedAgent.off('progress', this.onAgentProgress.bind(this));
      this.connectedAgent.off('message', this.onAgentMessage.bind(this));
      this.connectedAgent.off('complete', this.onAgentComplete.bind(this));
      this.connectedAgent.off('error', this.onAgentError.bind(this));
      this.connectedAgent.off('cancelled', this.onAgentCancelled.bind(this));
    }
    this.connectedAgent = null;
  }

  onAgentProgress(progress: { phase: string; progress: number; details?: string }): void {
    // FIX: Validate progress data before processing to prevent empty line rendering
    if (!progress || !progress.phase || progress.phase.trim() === '') {
      this.debug.warn(`Ignoring invalid progress event:`, progress);
      return;
    }
    
    this.state.isProcessing = true;
    this.displayProgress(progress.phase, progress.progress, progress.details);
  }

  onAgentMessage(message: { content: string; type: string }): void {
    // FIX: Validate message content to prevent empty line rendering
    if (!message || !message.content || message.content.trim() === '') {
      this.debug.warn(`Ignoring empty agent message:`, message);
      return;
    }
    
    this.displayMessage(message.content, message.type as ICLIFrameworkMessageType);
  }

  onAgentComplete(result: any): void {
    this.state.isProcessing = false;
    
    // Extract the actual response content
    let responseContent = 'Task completed successfully';
    if (result) {
      if (typeof result === 'string') {
        responseContent = result;
      } else if (result.content) {
        responseContent = result.content;
      } else if (result.data) {
        responseContent = result.data;
      } else if (result.response) {
        responseContent = result.response;
      }
    }
    
    // Emit the completion with the actual response
    this.displayMessage(responseContent, 'complete');
    
    // Also emit streaming complete to clear progress state
    this.emit('streamingComplete', { totalTime: 0, message: responseContent });
  }

  onAgentError(error: any): void {
    this.state.isProcessing = false;
    const errorMessage = error?.message || 'An error occurred';
    this.displayMessage(`Error: ${errorMessage}`, 'error');
    
    // Emit error event for React component
    this.emit('error', { error: errorMessage, originalError: error });
    console.error(`[InkCLIFramework] Agent error:`, error);
  }

  onAgentCancelled(reason: string): void {
    // Prevent recursive cancellation calls that cause infinite loops
    if (this.isCancelling) {
      return;
    }
    
    this.isCancelling = true;
    this.state.isProcessing = false;
    this.displayMessage(`Task cancelled: ${reason}`, 'warning');
    
    // Emit cancellation event for React component
    this.emit('cancelled', { reason });
    
    // Reset the cancellation flag after a brief delay
    setTimeout(() => {
      this.isCancelling = false;
    }, 100);
  }

  sendToAgent(input: string): void {
    if (this.connectedAgent && typeof this.connectedAgent.process === 'function') {
      this.state.isProcessing = true;
      this.connectedAgent.process({ input, context: {} });
    }
  }

  cancelAgent(): void {
    // Prevent recursive cancellation calls
    if (this.isCancelling) {
      return;
    }
    
    if (this.connectedAgent && typeof this.connectedAgent.cancel === 'function') {
      this.isCancelling = true;
      this.connectedAgent.cancel();
      
      // Reset cancellation flag after a brief delay
      setTimeout(() => {
        this.isCancelling = false;
      }, 100);
    }
  }
}

// ==============================================
// React Component
// ==============================================

interface InkCLIAppProps {
  framework: InkCLIFramework;
  config: CLIConfig;
  initialState: CLIState;
}

function InkCLIApp({ framework, config, initialState }: InkCLIAppProps) {
  // Initialize messages with welcome message
  const [messages, setMessages] = useState<OutputMessage[]>(() => [
    createSystemMessage('Welcome to Qi CLI with Ink! Type /help for commands.')
  ]);
  const [state, setState] = useState({
    ...initialState,
    currentPhase: '',
  });
  const [taskName, setTaskName] = useState<string>();
  const [providerInfo, setProviderInfo] = useState({ provider: 'ollama', model: 'qwen3:0.6b' });
  const [permissionRequest, setPermissionRequest] = useState<PermissionRequest | null>(null);
  const [isCancelling, setIsCancelling] = useState(false);
  const { exit } = useApp();
  

  // Get real provider/model info from connected agent
  useEffect(() => {
    const getAgentInfo = () => {
      try {
        const agent = (framework as any).connectedAgent;
        if (agent) {
          // Try to get provider and model from state manager's prompt config
          if (agent.stateManager?.getPromptConfig) {
            const promptConfig = agent.stateManager.getPromptConfig();
            if (promptConfig?.provider && promptConfig?.model) {
              setProviderInfo({
                provider: promptConfig.provider,
                model: promptConfig.model
              });
              return;
            }
          }

          // Fallback to getting from prompt handler
          if (agent.promptHandler?.getCurrentModel) {
            const currentModel = agent.promptHandler.getCurrentModel();
            if (currentModel) {
              setProviderInfo(prev => ({ ...prev, model: currentModel }));
            }
          }
        }
      } catch (error) {
        // Keep default values if we can't get agent info
      }
    };

    // Update agent info initially and when framework changes
    getAgentInfo();
    
    // Listen for state changes to refresh immediately
    const handleStateChange = (event: any) => {
      // Refresh provider info when config changes (provider/model switches)
      if (event.type === 'config') {
        getAgentInfo();
      }
    };
    
    // Subscribe to state changes from the agent's state manager
    try {
      const agent = (framework as any).connectedAgent;
      if (agent?.stateManager?.on) {
        agent.stateManager.on('stateChange', handleStateChange);
      }
    } catch (error) {
      // Ignore subscription errors
    }
    
    // Set up an interval to refresh agent info periodically as fallback
    const interval = setInterval(getAgentInfo, 2000);
    
    return () => {
      clearInterval(interval);
      // Clean up state change listener
      try {
        const agent = (framework as any).connectedAgent;
        if (agent?.stateManager?.off) {
          agent.stateManager.off('stateChange', handleStateChange);
        }
      } catch (error) {
        // Ignore cleanup errors
      }
    };
  }, [framework]);

  // Event subscriptions for React component updates
  useEffect(() => {
    const handleMessage = (data: { content: string; type: string }) => {
      const message = data.type === 'complete' 
        ? createAssistantMessage(data.content)
        : createSystemMessage(data.content);
      setMessages(prev => [...prev, message]);
      
      if (data.type === 'complete') {
        setState(prev => ({ ...prev, isProcessing: false, currentPhase: '' }));
      }
    };

    const handleProgress = (data: { phase: string; progress: number; details?: string }) => {
      setState(prev => ({ 
        ...prev, 
        isProcessing: true,
        currentPhase: data.phase 
      }));
    };

    const handleModeChange = (data: { mode: CLIMode; previousMode: CLIMode }) => {
      setState(prev => ({ ...prev, mode: data.mode }));
    };

    const handleStreamingChunk = (data: { content: string }) => {
      // Handle streaming chunks - could append to last message or create new
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.type === 'assistant') {
          // Append to existing assistant message
          const updated = [...prev];
          updated[updated.length - 1] = {
            ...lastMessage,
            content: lastMessage.content + data.content
          };
          return updated;
        } else {
          // Create new assistant message
          return [...prev, createAssistantMessage(data.content)];
        }
      });
    };

    const handleStreamingComplete = (data: { totalTime: number; message?: string }) => {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        isStreamingActive: false,
        currentPhase: '' 
      }));
    };

    const handleError = (data: { error: string; originalError: any }) => {
      setState(prev => ({ ...prev, isProcessing: false, currentPhase: '' }));
      const errorMessage = createSystemMessage(`❌ ${data.error}`);
      setMessages(prev => [...prev, errorMessage]);
    };

    const handleCancelled = (data: { reason: string }) => {
      setState(prev => ({ 
        ...prev, 
        isProcessing: false, 
        isStreamingActive: false,
        currentPhase: '' 
      }));
    };

    // Subscribe to framework events
    framework.on('message', handleMessage);
    framework.on('progress', handleProgress);
    framework.on('modeChange', handleModeChange);
    framework.on('streamingChunk', handleStreamingChunk);
    framework.on('streamingComplete', handleStreamingComplete);
    framework.on('error', handleError);
    framework.on('cancelled', handleCancelled);

    return () => {
      // Clean up event listeners
      framework.off('message', handleMessage);
      framework.off('progress', handleProgress);
      framework.off('modeChange', handleModeChange);
      framework.off('streamingChunk', handleStreamingChunk);
      framework.off('streamingComplete', handleStreamingComplete);
      framework.off('error', handleError);
      framework.off('cancelled', handleCancelled);
    };
  }, [framework]);

  const handleInput = useCallback((input: string) => {
    // Add user's input to the message display using Claude Code style
    const userMessage = createUserMessage(input);
    setMessages(prev => [...prev, userMessage]);
    
    // Clear progress state when starting new request
    setState(prev => ({ 
      ...prev, 
      isProcessing: true,
      currentPhase: 'Processing'
    }));
    
    // Just emit the userInput event - setupQuickCLI handles the rest
    framework.handleInput(input);
  }, [framework]);

  const handleStateChange = useCallback(() => {
    const currentMode = framework.getMode();
    const modes: CLIMode[] = ['interactive', 'command', 'streaming'];
    const currentIndex = modes.indexOf(currentMode);
    const nextIndex = (currentIndex + 1) % modes.length;
    framework.setMode(modes[nextIndex]);
  }, [framework]);

  const handleCommand = useCallback((command: string, args: string[]) => {
    // Add command as user message (like user typed it)
    const commandMessage = createUserMessage(`/${command} ${args.join(' ')}`);
    setMessages(prev => [...prev, commandMessage]);
    
    // Handle built-in commands locally
    switch (command) {
      case 'help':
        const helpMessage = createSystemMessage(
          'Available commands:\n' +
          '/help - Show this help message\n' +
          '/clear - Clear conversation history\n' +
          '/model - Switch AI model (not implemented)\n' +
          '/status - Show system status\n' +
          '/config - View configuration\n' +
          '/permission - Demo permission dialog'
        );
        setMessages(prev => [...prev, helpMessage]);
        break;
        
      case 'clear':
        setMessages([createSystemMessage('Conversation history cleared')]);
        break;
        
      case 'status':
        const statusMessage = createSystemMessage(
          `System Status:\n` +
          `Mode: ${state.mode}\n` +
          `Processing: ${state.isProcessing ? 'Yes' : 'No'}\n` +
          `Provider: ${providerInfo.provider}\n` +
          `Model: ${providerInfo.model}\n` +
          `Uptime: ${Math.floor((Date.now() - state.startTime.getTime()) / 1000)}s`
        );
        setMessages(prev => [...prev, statusMessage]);
        break;
        
      case 'config':
        const configMessage = createSystemMessage(
          `Configuration:\n` +
          `Colors: ${config.colors ? 'Enabled' : 'Disabled'}\n` +
          `Animations: ${config.animations ? 'Enabled' : 'Disabled'}\n` +
          `History Size: ${config.historySize}\n` +
          `Streaming: ${config.enableStreaming ? 'Enabled' : 'Disabled'}`
        );
        setMessages(prev => [...prev, configMessage]);
        break;
        
      case 'permission':
        const request = createPermissionRequest(
          'file-editor',
          'modify files',
          'The AI wants to edit source code files in your project.',
          [
            'May overwrite existing files',
            'Could introduce bugs or security issues',
            'Changes might be difficult to revert'
          ]
        );
        setPermissionRequest(request);
        break;
        
      default:
        // Unrecognized commands handled by message queue
        const commandInput = `/${command} ${args.join(' ')}`;
        framework.handleInput(commandInput);
    }
  }, [framework, state, config, providerInfo]);

  const handleCancel = useCallback(() => {
    // Prevent recursive cancellation calls
    if (isCancelling) return;
    
    // Only proceed if actually processing
    if (!state.isProcessing) return;
    
    setIsCancelling(true);
    
    // Add a brief cancelled message for user feedback
    const cancelMessage = createSystemMessage('🛑 Operation cancelled');
    setMessages(prev => [...prev, cancelMessage]);
    
    // Reset processing state
    setState(prev => ({ 
      ...prev, 
      isProcessing: false, 
      currentPhase: '',
      isStreamingActive: false
    }));
    
    // Direct cancellation through agent bridge
    framework.cancelAgent();
    
    // Reset cancellation flag after a brief delay
    setTimeout(() => {
      setIsCancelling(false);
    }, 100);
  }, [framework, state.isProcessing, isCancelling]);

  const handleClear = useCallback(() => {
    // Clear input without adding system feedback message
    // The visual feedback is the cleared input itself
  }, []);

  const handleEscapeWhenIdle = useCallback(() => {
    // Since we're in a React component scope, we can only emit events
    // The actual input clearing will be handled by the InputBox component
    const infoMessage = createSystemMessage('⏹️ ESC - No active operations to cancel');
    setMessages(prev => [...prev, infoMessage]);
    
    // Direct UI feedback only
  }, [framework]);

  // Permission dialog handlers
  const handlePermissionApprove = useCallback((requestId: string, remember?: boolean) => {
    const systemMessage = createSystemMessage(`Tool permission approved${remember ? ' (remembered)' : ''}`);
    setMessages(prev => [...prev, systemMessage]);
    setPermissionRequest(null);
    // Permission handling through message queue if needed
  }, [framework]);

  const handlePermissionDeny = useCallback((requestId: string, remember?: boolean) => {
    const systemMessage = createSystemMessage(`Tool permission denied${remember ? ' (remembered)' : ''}`);
    setMessages(prev => [...prev, systemMessage]);
    setPermissionRequest(null);
    // Permission handling through message queue if needed
  }, [framework]);

  const handlePermissionDismiss = useCallback(() => {
    setPermissionRequest(null);
  }, []);

  // Global input handler to intercept Ctrl+C, Esc, and Shift+Tab before TextInput can block them
  useInput((inputChar, key) => {
    // Handle Ctrl+C to clear input - high priority handler
    if (key.ctrl && inputChar === 'c') {
      // Direct input clearing handled by UI components
      return;
    }
    
    // Handle Ctrl+D for exit
    if (key.ctrl && inputChar === 'd') {
      exit();
      return;
    }
    
    // Handle Esc to cancel processing
    if (key.escape) {
      // Always handle ESC key for better user experience
      if (state.isProcessing) {
        // Call the cancel handler that's passed to MainLayout
        handleCancel();
      } else {
        // If not processing, clear input and show feedback
        handleEscapeWhenIdle();
      }
      return;
    }
    
    // Handle Shift+Tab to cycle modes
    if (key.shift && key.tab) {
      handleStateChange();
      return;
    }
  });

  return (
    <MainLayout
      state={state.isProcessing ? 'busy' : 'ready'}
      subState={state.mode === 'interactive' ? 'generic' : state.mode === 'command' ? 'planning' : 'editing'}
      taskName={taskName}
      messages={messages}
      onInput={handleInput}
      onStateChange={handleStateChange}
      onCommand={handleCommand}
      onCancel={handleCancel}
      onClear={handleClear}
      provider={providerInfo.provider}
      model={providerInfo.model}
      mode={state.mode}
      isProcessing={state.isProcessing}
      currentPhase={state.currentPhase}
      framework={framework}
      permissionRequest={permissionRequest}
      onPermissionApprove={handlePermissionApprove}
      onPermissionDeny={handlePermissionDeny}
      onPermissionDismiss={handlePermissionDismiss}
    />
  );
}

/**
 * Factory function to create Ink CLI
 */
export function createInkCLIImpl(config: Partial<CLIConfig> = {}): ICLIFramework {
  return new InkCLIFramework(config);
}