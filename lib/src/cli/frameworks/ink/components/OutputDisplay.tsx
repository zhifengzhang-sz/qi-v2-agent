/**
 * Output Display Component for Ink CLI
 * 
 * Shows command results and system messages
 */

import React from 'react'
import { Box, Text, Newline } from 'ink'

interface OutputMessage {
  id: string
  content: string
  type: 'info' | 'success' | 'error' | 'warning' | 'command' | 'response'
  timestamp: Date
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
  response: 'white'
} as const

const MESSAGE_PREFIXES = {
  info: 'ℹ️',
  success: '✅',
  error: '❌',
  warning: '⚠️',
  command: '▶️',
  response: '💬'
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
        <MessageItem key={message.id} message={message} />
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
        <Text color={color}>
          {prefix} 
        </Text>
        <Text color={color}>
          {message.content}
        </Text>
      </Box>
    </Box>
  )
}

// Helper function to create output messages
export function createOutputMessage(
  content: string, 
  type: OutputMessage['type'] = 'info'
): OutputMessage {
  return {
    id: `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    content,
    type,
    timestamp: new Date()
  }
}

export type { OutputMessage }