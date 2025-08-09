/**
 * Ink CLI Framework Implementation
 * 
 * React-based CLI implementation using Ink framework
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { render, Text, useInput, useApp } from 'ink';
import { EventEmitter } from 'node:events';
import type {
  ICLIFramework,
  IAgentCLIBridge,
  CLIConfig,
  CLIState,
  CLIMode,
  CLIEvents,
  MessageType,
} from '../../abstractions/ICLIFramework.js';
import { MainLayout } from './components/MainLayout.js';
import { createOutputMessage, createUserMessage, createAssistantMessage, createSystemMessage, type OutputMessage } from './components/OutputDisplay.js';
import { createPermissionRequest, type PermissionRequest } from './components/PermissionDialog.js';

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
 */
export class InkCLIFramework extends EventEmitter implements ICLIFramework, IAgentCLIBridge {
  private config: CLIConfig;
  private state: CLIState;
  private isInitialized = false;
  private isShutdown = false;
  private renderInstance: any = null;
  private connectedAgent: any = null;

  constructor(config: Partial<CLIConfig> = {}) {
    super();
    
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
    this.emit('ready', { startTime: this.state.startTime });
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
    
    this.emit('shutdown', { reason: 'user_requested' });
    this.removeAllListeners();
  }

  getState(): CLIState {
    return { ...this.state };
  }

  setMode(mode: CLIMode): void {
    const previousMode = this.state.mode;
    this.state.mode = mode;
    this.state.lastActivity = new Date();
    this.emit('modeChanged', { previousMode, newMode: mode });
  }

  getMode(): CLIMode {
    return this.state.mode;
  }

  showPrompt(): void {
    // In Ink, this is handled by the React component
  }

  handleInput(input: string): void {
    this.state.currentInput = input;
    this.state.history.push(input);
    if (this.state.history.length > this.config.historySize) {
      this.state.history = this.state.history.slice(-this.config.historySize);
    }
    this.state.lastActivity = new Date();
    
    // Follow the same pattern as EventDrivenCLI - just emit the event
    // setupQuickCLI will handle the agent communication
    this.emit('userInput', { input, mode: this.state.mode });
  }

  displayMessage(content: string, type: MessageType = 'info'): void {
    this.emit('messageReceived', { content, type });
  }

  displayProgress(phase: string, progress: number, details?: string): void {
    this.emit('progressUpdate', { phase, progress, details });
  }

  startStreaming(): void {
    this.state.isStreamingActive = true;
    this.emit('streamingStarted');
  }

  addStreamingChunk(content: string): void {
    if (this.state.isStreamingActive) {
      this.emit('streamingChunk', { content });
    }
  }

  completeStreaming(message?: string): void {
    this.state.isStreamingActive = false;
    const totalTime = Date.now() - this.state.startTime.getTime();
    this.emit('streamingComplete', { totalTime });
    
    if (message) {
      this.displayMessage(message, 'complete');
    }
  }

  cancelStreaming(): void {
    this.state.isStreamingActive = false;
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
    this.state.isProcessing = true;
    this.displayProgress(progress.phase, progress.progress, progress.details);
  }

  onAgentMessage(message: { content: string; type: string }): void {
    this.displayMessage(message.content, message.type as MessageType);
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
    this.emit('streamingComplete', { totalTime: Date.now() - this.state.startTime.getTime() });
  }

  onAgentError(error: any): void {
    this.state.isProcessing = false;
    const errorMessage = error?.message || 'An error occurred';
    this.displayMessage(`Error: ${errorMessage}`, 'error');
    this.emit('error', { error, context: 'agent' });
  }

  onAgentCancelled(reason: string): void {
    this.state.isProcessing = false;
    this.displayMessage(`Task cancelled: ${reason}`, 'warning');
    this.emit('cancelRequested', { reason });
  }

  sendToAgent(input: string): void {
    if (this.connectedAgent && typeof this.connectedAgent.process === 'function') {
      this.state.isProcessing = true;
      this.connectedAgent.process({ input, context: {} });
    }
  }

  cancelAgent(): void {
    if (this.connectedAgent && typeof this.connectedAgent.cancel === 'function') {
      this.connectedAgent.cancel();
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

  // Subscribe to framework events
  useEffect(() => {
    const handleMessageReceived = (data: { content: string; type: MessageType }) => {
      // Filter out generic processing messages
      const genericMessages = [
        'Processing request...',
        'Task completed successfully',
        'Request processed',
        'Processing...',
        'Task complete'
      ];
      
      if (genericMessages.includes(data.content.trim())) {
        return; // Skip these generic messages
      }
      
      // Use appropriate message type based on content - Claude Code style differentiation
      let message: OutputMessage;
      
      if (data.type === 'complete') {
        // This is likely an AI response
        message = createAssistantMessage(data.content);
      } else if (data.type === 'streaming') {
        // Streaming AI response
        message = createAssistantMessage(data.content, false);
      } else {
        // System messages (info, warning, error, etc.)
        message = createOutputMessage(data.content, data.type);
      }
      
      setMessages(prev => [...prev, message]);
    };

    const handleModeChanged = (data: { previousMode: CLIMode; newMode: CLIMode }) => {
      setState(prev => ({ ...prev, mode: data.newMode, lastActivity: new Date() }));
    };

    const handleProgressUpdate = (data: { phase: string; progress: number; details?: string }) => {
      setState(prev => ({ 
        ...prev, 
        isProcessing: true, 
        lastActivity: new Date(),
        currentPhase: data.phase
      }));
      // Don't add ugly progress messages - let the UI handle progress display
    };

    const handleStreamingChunk = (data: { content: string }) => {
      // Update the last message if it's a streaming message, or create new one
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && (lastMessage.type === 'streaming' || lastMessage.sender === 'assistant')) {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: lastMessage.content + data.content }
          ];
        } else {
          return [...prev, createAssistantMessage(data.content, false)];
        }
      });
    };

    const handleStreamingComplete = () => {
      setState(prev => ({ 
        ...prev, 
        isStreamingActive: false, 
        isProcessing: false,
        currentPhase: '',
        lastActivity: new Date() 
      }));
    };

    framework.on('messageReceived', handleMessageReceived);
    framework.on('modeChanged', handleModeChanged);
    framework.on('progressUpdate', handleProgressUpdate);
    framework.on('streamingChunk', handleStreamingChunk);
    framework.on('streamingComplete', handleStreamingComplete);

    return () => {
      framework.off('messageReceived', handleMessageReceived);
      framework.off('modeChanged', handleModeChanged);
      framework.off('progressUpdate', handleProgressUpdate);
      framework.off('streamingChunk', handleStreamingChunk);
      framework.off('streamingComplete', handleStreamingComplete);
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
        // For unrecognized commands, emit to agent/CLI system
        framework.emit('command', { command, args });
    }
  }, [framework, state, config, providerInfo]);

  const handleCancel = useCallback(() => {
    // Only proceed if actually processing
    if (!state.isProcessing) return;
    
    // Add a brief cancelled message for user feedback
    const cancelMessage = createSystemMessage('Request cancelled');
    setMessages(prev => [...prev, cancelMessage]);
    
    // Reset processing state
    setState(prev => ({ 
      ...prev, 
      isProcessing: false, 
      currentPhase: ''
    }));
    
    // Emit cancel event - the setupQuickCLI will handle agent cancellation
    framework.emit('cancelRequested', { reason: 'user_escape' });
  }, [framework, state.isProcessing]);

  const handleClear = useCallback(() => {
    // Clear input without adding system feedback message
    // The visual feedback is the cleared input itself
  }, []);

  // Permission dialog handlers
  const handlePermissionApprove = useCallback((requestId: string, remember?: boolean) => {
    const systemMessage = createSystemMessage(`Tool permission approved${remember ? ' (remembered)' : ''}`);
    setMessages(prev => [...prev, systemMessage]);
    setPermissionRequest(null);
    // Emit approval event for the agent/CLI system
    framework.emit('permissionApproved', { requestId, remember });
  }, [framework]);

  const handlePermissionDeny = useCallback((requestId: string, remember?: boolean) => {
    const systemMessage = createSystemMessage(`Tool permission denied${remember ? ' (remembered)' : ''}`);
    setMessages(prev => [...prev, systemMessage]);
    setPermissionRequest(null);
    // Emit denial event for the agent/CLI system
    framework.emit('permissionDenied', { requestId, remember });
  }, [framework]);

  const handlePermissionDismiss = useCallback(() => {
    setPermissionRequest(null);
  }, []);

  // Global input handler to intercept Ctrl+C, Esc, and Shift+Tab before TextInput can block them
  useInput((inputChar, key) => {
    // Handle Ctrl+C to clear input - high priority handler
    if (key.ctrl && inputChar === 'c') {
      // Emit a custom event that InputBox can listen to
      framework.emit('clearInput', { reason: 'ctrl+c' });
      return;
    }
    
    // Handle Ctrl+D for exit
    if (key.ctrl && inputChar === 'd') {
      exit();
      return;
    }
    
    // Handle Esc to cancel processing
    if (key.escape) {
      // Only cancel if we're actually processing
      if (state.isProcessing) {
        // Call the cancel handler that's passed to MainLayout
        handleCancel();
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