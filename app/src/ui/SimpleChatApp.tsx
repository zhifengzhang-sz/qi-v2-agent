import React, { useState, useEffect, useMemo } from 'react';
import { Box, Text, useInput, Static } from 'ink';
import type { QiAgentFactory, AgentMessage } from '@qi/agent';

interface SimpleChatAppProps {
  agentFactory: QiAgentFactory;
  threadId?: string;
  debug?: boolean;
  onExit: () => Promise<void>;
}

interface ChatMessage extends AgentMessage {
  id: string;
}

export function SimpleChatApp({ agentFactory, threadId, debug, onExit }: SimpleChatAppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [showPrompt, setShowPrompt] = useState(true);
  const [pendingTokens, setPendingTokens] = useState('');

  // Fast initialization without complex components
  useEffect(() => {
    console.log('⚡ Simple ChatApp starting...');
    const config = agentFactory.getConfig();
    
    setMessages([
      {
        id: '0',
        role: 'system',
        content: `🤖 Qi Agent V2 - Ready!\n\nModel: ${config.model.name}\nThinking: ${config.model.thinkingEnabled ? 'Enabled' : 'Disabled'}\n\nType your message and press Enter. Press Ctrl+C to exit.`,
        timestamp: new Date(),
      },
    ]);
    
    console.log('✅ Simple Chat UI ready!');
  }, [agentFactory]);

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

    if (key.backspace) {
      setInput(prev => prev.slice(0, -1));
      return;
    }

    if (input && !key.ctrl && !key.meta) {
      setInput(prev => prev + input);
    }
  });

  const handleSubmit = async () => {
    if (!input.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: input.trim(),
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
        <Text color="cyan" bold>🤖 Qi Agent V2</Text>
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