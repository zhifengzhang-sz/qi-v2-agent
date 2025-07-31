/**
 * Main Layout Component for Ink CLI
 * 
 * Combines all UI components into a cohesive layout
 */

import React from 'react'
import { Box, Text } from 'ink'
import { StateIndicator } from './StateIndicator.js'
import { InputBox } from './InputBox.js'
import { OutputDisplay, type OutputMessage } from './OutputDisplay.js'
import type { AppState, AppSubState } from '../../../abstractions/index.js'

interface MainLayoutProps {
  state: AppState
  subState?: AppSubState
  taskName?: string
  messages: OutputMessage[]
  onInput: (input: string) => void
  onStateChange?: () => void
}

export function MainLayout({
  state,
  subState,
  taskName,
  messages,
  onInput,
  onStateChange
}: MainLayoutProps) {
  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Header */}
      <Box 
        borderStyle="single" 
        borderColor="cyan"
        paddingLeft={1}
        paddingRight={1}
        justifyContent="space-between"
      >
        <Text color="cyan" bold>
          🤖 Qi CLI v2
        </Text>
        <StateIndicator 
          state={state} 
          subState={subState} 
          taskName={taskName} 
        />
      </Box>
      
      {/* Main Content Area */}
      <Box flexGrow={1} flexDirection="column" paddingTop={1}>
        <OutputDisplay messages={messages} />
      </Box>
      
      {/* Input Area */}
      <Box 
        borderStyle="single"
        borderColor={state === 'busy' ? 'yellow' : 'green'}
        padding={1}
      >
        <InputBox
          state={state}
          subState={subState}
          onSubmit={onInput}
          onStateChange={onStateChange}
        />
      </Box>
      
      {/* Footer */}
      <Box paddingLeft={1} paddingRight={1}>
        <Text color="dim" dimColor>
          Use /help for commands • Ctrl+C to exit • Shift+Tab to cycle modes
        </Text>
      </Box>
    </Box>
  )
}