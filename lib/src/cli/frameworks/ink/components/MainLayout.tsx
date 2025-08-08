/**
 * Main Layout Component for Ink CLI
 * 
 * Combines all UI components into a cohesive layout
 */

import React, { memo } from 'react'
import { Box, Text } from 'ink'
import Gradient from 'ink-gradient'
import BigText from 'ink-big-text'
import { StateIndicator } from './StateIndicator.js'
import { InputBox } from './InputBox.js'
import { OutputDisplay, type OutputMessage } from './OutputDisplay.js'
import type { AppState, AppSubState } from '../../../abstractions/index.js'
import { styles, defaultTheme, getInputBorderColor, textStyles, createProgressBar } from '../styles/theme.js'

interface MainLayoutProps {
  state: AppState
  subState?: AppSubState
  taskName?: string
  messages: OutputMessage[]
  onInput: (input: string) => void
  onStateChange?: () => void
  onCommand?: (command: string, args: string[]) => void
  onCancel?: () => void
  onClear?: () => void
  provider?: string
  model?: string
  mode?: string
  isProcessing?: boolean
  currentPhase?: string
  progress?: number
  framework?: any
}

export const MainLayout = memo(function MainLayout({
  state,
  subState,
  taskName,
  messages,
  onInput,
  onStateChange,
  onCommand,
  onCancel,
  onClear,
  provider = 'ollama',
  model = 'qwen3:0.6b',
  mode = 'interactive',
  isProcessing = false,
  currentPhase = '',
  progress = 0,
  framework
}: MainLayoutProps) {
  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Header */}
      <Box {...styles.header}>
        <Gradient name={defaultTheme.gradients.rainbow}>
          <Text {...textStyles.header}>QI CLI</Text>
        </Gradient>
      </Box>
      
      {/* Main Content Area */}
      <Box {...styles.content}>
        <OutputDisplay messages={messages} />
      </Box>
      
      {/* Input Area */}
      <Box 
        {...styles.inputContainer}
        borderColor={getInputBorderColor(state === 'busy' ? 'busy' : 'ready')}
      >
        <InputBox
          state={state}
          subState={subState}
          onSubmit={onInput}
          onStateChange={onStateChange}
          onCommand={onCommand}
          onCancel={onCancel}
          onClear={onClear}
          framework={framework}
        />
      </Box>
      
      {/* Progress Bar - Shows during processing */}
      {isProcessing && progress > 0 && (
        <Box paddingX={2} paddingY={0}>
          <Text {...textStyles.progress}>
            {createProgressBar(progress)} {currentPhase}
          </Text>
        </Box>
      )}

      {/* Status Line - Zero gap with input */}
      <Box {...styles.statusLine}>
        <Box {...styles.statusLeft}>
          <Gradient colors={defaultTheme.gradients.provider}>
            <Text {...textStyles.provider}>{provider}</Text>
          </Gradient>
          <Text {...textStyles.separator}> → </Text>
          <Gradient colors={defaultTheme.gradients.model}>
            <Text {...textStyles.model}>{model}</Text>
          </Gradient>
          <Text {...textStyles.separator}> | </Text>
          <Text {...textStyles.mode}>{mode}</Text>
        </Box>
        {isProcessing ? (
          <Box {...styles.statusRight}>
            <Text {...textStyles.processing}>⚡ {currentPhase}</Text>
            <Text {...textStyles.separator}> | </Text>
            <Text {...textStyles.progress}>Esc to cancel</Text>
          </Box>
        ) : (
          <Box {...styles.statusRight}>
            <Text {...textStyles.separator}>Ctrl+C to clear • Ctrl+D to exit</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
});