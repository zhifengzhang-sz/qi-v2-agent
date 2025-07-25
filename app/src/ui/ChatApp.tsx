import React, { useState, useEffect } from 'react';
import { Box, Text, useInput } from 'ink';
import { TextInput, Spinner } from '@inkjs/ui';
import type { QiAgentFactory, AgentMessage } from '@qi/agent';

interface ChatAppProps {
  agentFactory: QiAgentFactory;
  threadId?: string;
  debug?: boolean;
  onExit: () => Promise<void>;
}

interface ChatMessage extends AgentMessage {
  id: string;
  thinking?: string;
}

export function ChatApp({ agentFactory, threadId, debug, onExit }: ChatAppProps) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [thinking, setThinking] = useState('');
  const [showInput, setShowInput] = useState(true);

  // Show welcome message with optimized initialization
  useEffect(() => {
    const initializeChat = async () => {
      console.log('⚡ ChatApp useEffect started');
      
      // Allow React to render first, then initialize
      await new Promise(resolve => setTimeout(resolve, 0));
      console.log('🔧 Getting agent config...');
      
      const config = agentFactory.getConfig();
      console.log('📝 Setting initial messages...');
      
      setMessages([
        {
          id: '0',
          role: 'system',
          content: `🤖 Qi Agent V2 - Ready!\\n\\nModel: ${config.model.name}\\nThinking: ${config.model.thinkingEnabled ? 'Enabled' : 'Disabled'}\\n\\nType your message and press Enter. Press Ctrl+C to exit.`,
          timestamp: new Date(),
        },
      ]);
      
      console.log('✅ Chat UI fully ready!');
    };
    
    initializeChat();
  }, [agentFactory]);

  // Handle keyboard input
  useInput((input, key) => {
    if (key.ctrl && input === 'c') {
      onExit();
    }
  });

  const handleSubmit = async (query: string) => {
    if (!query.trim() || isLoading) return;

    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: query.trim(),
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setIsLoading(true);
    setShowInput(false);
    setThinking('');

    try {
      // Prepare messages for the agent
      const conversationMessages = messages
        .filter((msg) => msg.role !== 'system')
        .concat(userMessage)
        .map((msg) => ({
          role: msg.role,
          content: msg.content,
        }));

      let assistantResponse = '';
      let thinkingContent = '';

      // Stream the response
      await agentFactory.stream(
        conversationMessages,
        {
          onToken: (token) => {
            assistantResponse += token;
            // Update the assistant message in real-time
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                return prev.slice(0, -1).concat({
                  ...lastMsg,
                  content: assistantResponse,
                });
              } else {
                return prev.concat({
                  id: (Date.now() + 1).toString(),
                  role: 'assistant',
                  content: assistantResponse,
                  timestamp: new Date(),
                });
              }
            });
          },
          onThinking: (thinking) => {
            thinkingContent += thinking;
            setThinking(thinkingContent);
          },
          onComplete: (response) => {
            // Final update
            setMessages((prev) => {
              const lastMsg = prev[prev.length - 1];
              if (lastMsg && lastMsg.role === 'assistant') {
                return prev.slice(0, -1).concat({
                  ...lastMsg,
                  content: response,
                  thinking: thinkingContent || undefined,
                });
              }
              return prev;
            });
            setThinking('');
            setIsLoading(false);
            setShowInput(true);
          },
          onError: (error) => {
            setMessages((prev) => [
              ...prev,
              {
                id: (Date.now() + 2).toString(),
                role: 'assistant',
                content: `❌ Error: ${error.message}`,
                timestamp: new Date(),
              },
            ]);
            setThinking('');
            setIsLoading(false);
            setShowInput(true);
          },
        },
        threadId
      );
    } catch (error) {
      setMessages((prev) => [
        ...prev,
        {
          id: (Date.now() + 3).toString(),
          role: 'assistant',
          content: `❌ Error: ${error instanceof Error ? error.message : String(error)}`,
          timestamp: new Date(),
        },
      ]);
      setIsLoading(false);
      setShowInput(true);
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      {/* Header */}
      <Box marginBottom={1}>
        <Text color="cyan" bold>
          🤖 Qi Agent V2
        </Text>
      </Box>

      {/* Messages */}
      <Box flexDirection="column" marginBottom={1}>
        {messages.map((msg) => (
          <MessageComponent key={msg.id} message={msg} debug={debug} />
        ))}
        
        {/* Thinking indicator */}
        {thinking && (
          <Box marginBottom={1}>
            <Text color="yellow">🤔 Thinking: {thinking}</Text>
          </Box>
        )}
        
        {/* Loading indicator */}
        {isLoading && !thinking && (
          <Box marginBottom={1}>
            <Spinner label="Processing..." />
          </Box>
        )}
      </Box>

      {/* Input */}
      {showInput && (
        <Box>
          <Text color="cyan">› </Text>
          <TextInput
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder="Ask me anything..."
          />
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
      case 'user':
        return 'green';
      case 'assistant':
        return 'blue';
      case 'system':
        return 'gray';
      default:
        return 'white';
    }
  };

  const getMessageIcon = (role: string) => {
    switch (role) {
      case 'user':
        return '👤';
      case 'assistant':
        return '🤖';
      case 'system':
        return 'ℹ️';
      default:
        return '•';
    }
  };

  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color={getMessageColor(message.role)}>
          {getMessageIcon(message.role)} {message.content}
        </Text>
      </Box>
      
      {/* Show thinking content if available and debug is enabled */}
      {debug && message.thinking && (
        <Box marginLeft={2}>
          <Text color="yellow" dimColor>
            💭 Thinking: {message.thinking}
          </Text>
        </Box>
      )}
      
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