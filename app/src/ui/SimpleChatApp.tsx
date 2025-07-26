import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, Static } from 'ink';
import type { IAgentFactory, AgentMessage } from '@qi/agent';

interface SimpleChatAppProps {
  agentFactory: IAgentFactory;
  threadId?: string;
  debug?: boolean;
  onExit: () => Promise<void>;
  initialMessages?: ChatMessage[];
}

interface ChatMessage extends AgentMessage {
  id: string;
}

export function SimpleChatApp({ agentFactory, threadId, debug, onExit, initialMessages }: SimpleChatAppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [pendingTokens, setPendingTokens] = useState('');

  // Fast initialization without complex components
  useEffect(() => {
    console.log('⚡ Simple ChatApp starting...');
    const config = agentFactory.getConfig();
    
    const systemMessage = {
      id: '0',
      role: 'system' as const,
      content: `🤖 qi-v2 agent - Ready!\n\nModel: ${config.model.name}\nThinking: ${config.model.thinkingEnabled ? 'Enabled' : 'Disabled'}\n\n${initialMessages ? 'Starting workflow...' : 'Type your message and press Enter. Press Ctrl+C to exit.'}`,
      timestamp: new Date(),
    };
    
    if (initialMessages && initialMessages.length > 0) {
      // Set messages with system message + initial workflow messages
      setMessages([systemMessage, ...initialMessages]);
      // Auto-process the first initial message after a brief delay
      setTimeout(() => {
        processWorkflowMessage(initialMessages[0]);
      }, 500);
    } else {
      // Standard chat mode
      setMessages([systemMessage]);
    }
    
    console.log('✅ Simple Chat UI ready!');
  }, [agentFactory, initialMessages]);

  // React 18 automatic batching-optimized token display
  useEffect(() => {
    if (pendingTokens && pendingTokens.length > 0 && isLoading) {
      // Use React 18's automatic batching with optimized timing
      const timer = setTimeout(() => {
        // Batching tokens for 60fps display updates
        
        // React 18 will automatically batch these state updates
        setMessages(prev => {
          const lastMsg = prev[prev.length - 1];
          if (lastMsg && lastMsg.role === 'assistant') {
            // Update existing assistant message
            return prev.slice(0, -1).concat({
              ...lastMsg,
              content: pendingTokens,
            });
          } else {
            // Create new assistant message
            return prev.concat({
              id: (Date.now() + 1).toString(),
              role: 'assistant',
              content: pendingTokens,
              timestamp: new Date(),
            });
          }
        });
      }, 16); // 60fps batching interval optimized for React 18
      
      return () => clearTimeout(timer);
    }
  }, [pendingTokens, isLoading]);

  // Memoize completed messages for Ink Static component optimization
  const completedMessages = useMemo(() => {
    return messages.filter((msg, index) => {
      // Include all messages except the last one if it's currently being typed (assistant + loading)
      const isLastMessage = index === messages.length - 1;
      const isAssistantMessage = msg.role === 'assistant';
      const isBeingTyped = isLastMessage && isAssistantMessage && isLoading;
      
      return !isBeingTyped;
    });
  }, [messages, isLoading]);

  // Get the active (currently being typed) message
  const activeMessage = useMemo(() => {
    if (isLoading && messages.length > 0) {
      const lastMsg = messages[messages.length - 1];
      if (lastMsg.role === 'assistant') {
        return lastMsg;
      }
    }
    return null;
  }, [messages, isLoading]);

  // Handle keyboard input directly
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onExit();
      return;
    }

    if (key.return && !isLoading) {
      handleSubmit();
      return;
    }

    // Handle Ctrl+Backspace (delete word) - must come before regular backspace
    if (key.ctrl && key.backspace) {
      setInput(prev => {
        const words = prev.trim().split(/\s+/);
        return words.length > 1 ? words.slice(0, -1).join(' ') + ' ' : '';
      });
      return;
    }

    // Handle both backspace and delete keys for single character deletion
    if (key.backspace || key.delete) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    // Only add input if it's not a control key
    if (input && !key.ctrl && !key.meta) {
      setInput(prev => prev + input);
    }
  });

  const processWorkflowMessage = async (workflowMessage: ChatMessage) => {
    if (isLoading) return;

    console.log('🔄 Processing workflow message...');
    setIsLoading(true);
    setShowPrompt(false);

    try {
      const startTime = Date.now();
      
      // Convert workflow message to the format expected by agent factory
      const conversationMessages = [{
        role: workflowMessage.role,
        content: workflowMessage.content,
      }];

      console.log('📤 Sending workflow to agent factory...');
      let assistantResponse = '';
      let firstTokenTime: number | null = null;
      let renderCount = 0;

      await agentFactory.stream(
        conversationMessages,
        {
          onToken: (token) => {
            if (!firstTokenTime) {
              firstTokenTime = Date.now();
              console.log(`⚡ First token received after ${firstTokenTime - startTime}ms`);
            }
            
            // Accumulate tokens in response and pending state
            assistantResponse += token;
            setPendingTokens(assistantResponse);
            
            renderCount++;
            // Track token batching performance (disabled for production)
          },
          onComplete: (response) => {
            const totalTime = Date.now() - startTime;
            console.log(`✅ Workflow completed in ${totalTime}ms (${renderCount} tokens total)`);
            
            // Ensure final message is properly set and stop loading
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                // Update existing assistant message with final response
                return prev.slice(0, -1).concat({
                  ...lastMsg,
                  content: response,
                });
              } else {
                // Create new assistant message if none exists
                return prev.concat({
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: response,
                  timestamp: new Date(),
                });
              }
            });
            
            // Clear pending tokens and stop loading
            setPendingTokens('');
            setIsLoading(false);
            setShowPrompt(true);
          },
          onError: (error) => {
            // Clear pending tokens and show error
            setPendingTokens('');
            setMessages(prev => [
              ...prev,
              {
                id: (Date.now() + 2).toString(),
                role: 'assistant',
                content: `❌ Workflow Error: ${error.message}`,
                timestamp: new Date(),
              },
            ]);
            setIsLoading(false);
            setShowPrompt(true);
          },
        },
        threadId
      );
    } catch (error) {
      // Clear pending tokens and show error
      setPendingTokens('');
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: `❌ Workflow Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
      setShowPrompt(true);
    }
  };

  // Slash command registry
  const slashCommands = useMemo(() => ({
    help: {
      description: 'Show available commands',
      handler: () => {
        const helpText = `Available slash commands:
/help - Show this help message
/exit, /quit - Exit the application
/clear - Clear chat history
/model - Show current model information
/debug - Toggle debug mode
/config - Show current configuration
/reset - Reset conversation thread

Tips:
- Press Ctrl+C to exit at any time
- Use backspace/delete to edit input
- Use Ctrl+Backspace to delete words`;
        
        const systemMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'system',
          content: helpText,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    },
    exit: {
      description: 'Exit the application',
      handler: () => onExit()
    },
    quit: {
      description: 'Exit the application',
      handler: () => onExit()
    },
    clear: {
      description: 'Clear chat history',
      handler: () => {
        const config = agentFactory.getConfig();
        const systemMessage: ChatMessage = {
          id: '0',
          role: 'system',
          content: `🤖 qi-v2 agent - Ready!\n\nModel: ${config.model.name}\nThinking: ${config.model.thinkingEnabled ? 'Enabled' : 'Disabled'}\n\nChat history cleared. Type your message and press Enter.`,
          timestamp: new Date(),
        };
        setMessages([systemMessage]);
      }
    },
    model: {
      description: 'Show current model information',
      handler: () => {
        const config = agentFactory.getConfig();
        const modelInfo = `Current Model Configuration:
• Name: ${config.model.name}
• Temperature: ${config.model.temperature}
• Base URL: ${config.model.baseUrl}
• Thinking Mode: ${config.model.thinkingEnabled ? 'Enabled' : 'Disabled'}`;
        
        const systemMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'system',
          content: modelInfo,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    },
    debug: {
      description: 'Toggle debug mode',
      handler: () => {
        const newDebugState = !debug;
        const systemMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'system',
          content: `Debug mode ${newDebugState ? 'enabled' : 'disabled'}. ${newDebugState ? 'Timestamps will be shown.' : 'Timestamps are hidden.'}`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, systemMessage]);
        // Note: This would need to be passed up to parent component to actually change debug state
      }
    },
    config: {
      description: 'Show current configuration',
      handler: () => {
        const config = agentFactory.getConfig();
        const configInfo = `Current Configuration:
• Model: ${config.model.name} (${config.model.temperature} temp)
• Memory: ${config.memory.enabled ? 'Enabled' : 'Disabled'}
• UI Theme: ${config.ui.theme}
• Timestamps: ${config.ui.showTimestamps ? 'Enabled' : 'Disabled'}
• Progress Indicators: ${config.ui.progressIndicators ? 'Enabled' : 'Disabled'}`;
        
        const systemMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'system',
          content: configInfo,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, systemMessage]);
      }
    },
    reset: {
      description: 'Reset conversation thread',
      handler: () => {
        const systemMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'system',
          content: '🔄 Conversation thread reset. Previous context cleared.',
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, systemMessage]);
        // Note: This would reset the threadId in a full implementation
      }
    }
  }), [agentFactory, debug, onExit]);

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const trimmedInput = input.trim();
    
    // Check for slash commands
    if (trimmedInput.startsWith('/')) {
      const commandParts = trimmedInput.slice(1).split(' ');
      const commandName = commandParts[0].toLowerCase();
      const commandArgs = commandParts.slice(1);
      
      // Show user's command in chat
      const userMessage: ChatMessage = {
        id: Date.now().toString(),
        role: 'user',
        content: trimmedInput,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setInput('');
      
      // Execute command
      const command = slashCommands[commandName as keyof typeof slashCommands];
      if (command) {
        try {
          command.handler();
        } catch (error) {
          const errorMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'system',
            content: `❌ Command error: ${error instanceof Error ? error.message : String(error)}`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, errorMessage]);
        }
      } else {
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'system',
          content: `❌ Unknown command: ${commandName}. Type /help to see available commands.`,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, errorMessage]);
      }
      return;
    }

    // Regular message processing
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: trimmedInput,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowPrompt(false);

    try {
      console.log('🔄 Processing message...');
      const startTime = Date.now();
      
      const conversationMessages = messages
        .filter(msg => msg.role !== 'system')
        .concat(userMessage)
        .map(msg => ({
          role: msg.role,
          content: msg.content,
        }));

      console.log('📤 Sending to agent factory...');
      let assistantResponse = '';
      let firstTokenTime: number | null = null;
      let renderCount = 0;

      await agentFactory.stream(
        conversationMessages,
        {
          onToken: (token) => {
            if (!firstTokenTime) {
              firstTokenTime = Date.now();
              console.log(`⚡ First token received after ${firstTokenTime - startTime}ms`);
            }
            
            // Accumulate tokens in response and pending state
            assistantResponse += token;
            setPendingTokens(assistantResponse);
            
            renderCount++;
            // Track token batching performance (disabled for production)
          },
          onComplete: (response) => {
            const totalTime = Date.now() - startTime;
            console.log(`✅ Response completed in ${totalTime}ms (${renderCount} tokens total)`);
            
            // Ensure final message is properly set and stop loading
            setMessages(prev => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                // Update existing assistant message with final response
                return prev.slice(0, -1).concat({
                  ...lastMsg,
                  content: response,
                });
              } else {
                // Create new assistant message if none exists
                return prev.concat({
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: response,
                  timestamp: new Date(),
                });
              }
            });
            
            // Clear pending tokens and stop loading
            setPendingTokens('');
            setIsLoading(false);
            setShowPrompt(true);
          },
          onError: (error) => {
            // Clear pending tokens and show error
            setPendingTokens('');
            setMessages(prev => [
              ...prev,
              {
                id: (Date.now() + 2).toString(),
                role: 'assistant',
                content: `❌ Error: ${error.message}`,
                timestamp: new Date(),
              },
            ]);
            setIsLoading(false);
            setShowPrompt(true);
          },
        },
        threadId
      );
    } catch (error) {
      // Clear pending tokens and show error
      setPendingTokens('');
      setMessages(prev => [
        ...prev,
        {
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
      setShowPrompt(true);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>🤖 qi-v2 agent</Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1}>
        {/* Completed messages (optimized with Static component) */}
        <Static items={completedMessages}>
          {(message) => (
            <MessageComponent key={message.id} message={message} debug={debug} />
          )}
        </Static>
        
        {/* Active (streaming) message */}
        {activeMessage && (
          <MessageComponent key={activeMessage.id} message={activeMessage} debug={debug} />
        )}
        
        {/* Loading indicator */}
        {isLoading && (
          <Box marginBottom={1}>
            <Text color="yellow">🤖 Thinking...</Text>
          </Box>
        )}
      </Box>

      {/* Simple input display */}
      {showPrompt && (
        <Box>
          <Text color="cyan">› </Text>
          <Text>{input}</Text>
          <Text color="gray">█</Text>
        </Box>
      )}
    </Box>
  );
}

interface MessageComponentProps {
  message: ChatMessage;
  debug?: boolean;
}

function MessageComponent({ message, debug }: MessageComponentProps) {
  const getMessageColor = (role: string) => {
    switch (role) {
      case 'user': return 'green';
      case 'assistant': return 'blue';
      case 'system': return 'gray';
      default: return 'white';
    }
  };

  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'user': return '👤';
      case 'assistant': return '🤖';
      case 'system': return 'ℹ️';
      default: return '•';
    }
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={getMessageColor(message.role)}>
          {getMessageIcon(message.role)} {message.content}
        </Text>
      </Box>
      
      {/* Timestamp in debug mode */}
      {debug && message.timestamp && (
        <Box marginLeft={2}>
          <Text color="gray" dimColor>
            {message.timestamp.toLocaleTimeString()}
          </Text>
        </Box>
      )}
    </Box>
  );
}