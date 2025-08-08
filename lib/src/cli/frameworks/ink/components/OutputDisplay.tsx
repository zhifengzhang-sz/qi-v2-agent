/**
 * Output Display Component for Ink CLI
 * 
 * Shows command results and system messages
 */

import React from 'react'
import { Box, Text, Newline } from 'ink'
import Spinner from 'ink-spinner'

interface OutputMessage {
  id: string
  content: string
  type: 'info' | 'success' | 'error' | 'warning' | 'command' | 'response' | 'streaming' | 'complete' | 'status'
  timestamp: Date
  isProcessing?: boolean
}

interface OutputDisplayProps {
  messages: OutputMessage[]
  maxMessages?: number
}

const MESSAGE_COLORS = {
  info: 'blue',
  success: 'green',
  error: 'red',
  warning: 'yellow',
  command: 'cyan',
  response: 'white',
  streaming: 'magenta',
  complete: 'green',
  status: 'gray'
} as const

const MESSAGE_PREFIXES = {
  info: 'ℹ️',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  command: '▶️',
  response: '💬',
  streaming: '🌊',
  complete: '✅',
  status: 'ℹ️'
} as const

export function OutputDisplay({ messages, maxMessages = 50 }: OutputDisplayProps) {
  // Show only the most recent messages
  const displayMessages = messages.slice(-maxMessages)
  
  if (displayMessages.length === 0) {
    return (
      <Box paddingLeft={1} paddingRight={1}>
        <Text color="dim" dimColor>
          Welcome to Qi CLI! Type /help for available commands.
        </Text>
      </Box>
    )
  }
  
  return (
    <Box flexDirection="column" paddingLeft={1} paddingRight={1}>
      {displayMessages.map((message, index) => (
        <MessageItem key={`${message.id}-${index}`} message={message} />
      ))}
    </Box>
  )
}

function MessageItem({ message }: { message: OutputMessage }) {
  const color = MESSAGE_COLORS[message.type]
  const prefix = MESSAGE_PREFIXES[message.type]
  
  // Format timestamp
  const timeStr = message.timestamp.toLocaleTimeString('en-US', { 
    hour12: false,
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  })
  
  return (
    <Box flexDirection="column" marginBottom={1}>
      <Box>
        <Text color="dim" dimColor>
          [{timeStr}] 
        </Text>
        {message.isProcessing ? (
          <Text color="cyan">
            <Spinner type="dots" />
            {' '}
          </Text>
        ) : (
          <Text color={color}>
            {prefix} 
          </Text>
        )}
        <Text color={color}>
          {message.content}
        </Text>
      </Box>
    </Box>
  )
}

// Counter to ensure unique message IDs
let messageCounter = 0;

// Helper function to create output messages
export function createOutputMessage(
  content: string, 
  type: OutputMessage['type'] = 'info',
  isProcessing: boolean = false
): OutputMessage {
  messageCounter++;
  return {
    id: `msg-${Date.now()}-${messageCounter}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    type,
    timestamp: new Date(),
    isProcessing
  }
}

export type { OutputMessage }