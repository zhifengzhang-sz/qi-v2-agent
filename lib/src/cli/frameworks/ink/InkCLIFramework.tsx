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
import { createOutputMessage, type OutputMessage } from './components/OutputDisplay.js';

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
    createOutputMessage('Welcome to Qi CLI with Ink! Type /help for commands.', 'info')
  ]);
  const [state, setState] = useState({
    ...initialState,
    currentPhase: '',
    progress: 0,
  });
  const [taskName, setTaskName] = useState<string>();
  const [providerInfo, setProviderInfo] = useState({ provider: 'ollama', model: 'qwen3:0.6b' });
  const { exit } = useApp();
  
  // Global input handler to intercept Ctrl+C before TextInput can block it
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
  });

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
    
    // Set up an interval to refresh agent info periodically - less frequent to avoid flicker
    const interval = setInterval(getAgentInfo, 10000); // Reduced from 2s to 10s
    return () => clearInterval(interval);
  }, [framework]);

  // Subscribe to framework events
  useEffect(() => {
    const handleMessageReceived = (data: { content: string; type: MessageType }) => {
      const message = createOutputMessage(data.content, data.type);
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
        currentPhase: data.phase,
        progress: data.progress
      }));
      // Don't add ugly progress messages - let the UI handle progress display
    };

    const handleStreamingChunk = (data: { content: string }) => {
      // Update the last message if it's a streaming message, or create new one
      setMessages(prev => {
        const lastMessage = prev[prev.length - 1];
        if (lastMessage && lastMessage.type === 'streaming') {
          return [
            ...prev.slice(0, -1),
            { ...lastMessage, content: lastMessage.content + data.content }
          ];
        } else {
          return [...prev, createOutputMessage(data.content, 'streaming')];
        }
      });
    };

    const handleStreamingComplete = () => {
      setState(prev => ({ 
        ...prev, 
        isStreamingActive: false, 
        isProcessing: false,
        currentPhase: '',
        progress: 0,
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
    // Add user's input to the message display
    const userMessage = createOutputMessage(`> ${input}`, 'info');
    setMessages(prev => [...prev, userMessage]);
    
    // Clear progress state when starting new request
    setState(prev => ({ 
      ...prev, 
      isProcessing: true,
      currentPhase: 'processing',
      progress: 0 
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
    // Add command message to display
    const commandMessage = createOutputMessage(`/${command} ${args.join(' ')}`, 'info');
    setMessages(prev => [...prev, commandMessage]);
    
    // Emit command event - the setupQuickCLI will handle routing to agent
    framework.emit('command', { command, args });
  }, [framework]);

  const handleCancel = useCallback(() => {
    // Add cancellation message
    const cancelMessage = createOutputMessage('Request cancelled', 'warning');
    setMessages(prev => [...prev, cancelMessage]);
    
    // Reset processing state
    setState(prev => ({ 
      ...prev, 
      isProcessing: false, 
      currentPhase: '', 
      progress: 0 
    }));
    
    // Emit cancel event - the setupQuickCLI will handle agent cancellation
    framework.emit('cancelRequested', { reason: 'user_escape' });
  }, [framework]);

  const handleClear = useCallback(() => {
    // Add clear message to show user feedback
    const clearMessage = createOutputMessage('Prompt cleared', 'info');
    setMessages(prev => [...prev, clearMessage]);
  }, []);

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
      progress={state.progress}
      framework={framework}
    />
  );
}

/**
 * Factory function to create Ink CLI
 */
export function createInkCLIImpl(config: Partial<CLIConfig> = {}): ICLIFramework {
  return new InkCLIFramework(config);
}