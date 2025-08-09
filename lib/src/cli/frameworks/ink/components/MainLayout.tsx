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
import { LoadingIndicator } from './LoadingIndicator.js'
import { PermissionDialog, type PermissionRequest } from './PermissionDialog.js'
import type { AppState, AppSubState } from '../../../abstractions/index.js'
import { styles, defaultTheme, getInputBorderColor, textStyles } from '../styles/theme.js'

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
  framework?: any
  permissionRequest?: PermissionRequest | null
  onPermissionApprove?: (requestId: string, remember?: boolean) => void
  onPermissionDeny?: (requestId: string, remember?: boolean) => void
  onPermissionDismiss?: () => void
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
  framework,
  permissionRequest = null,
  onPermissionApprove,
  onPermissionDeny,
  onPermissionDismiss
}: MainLayoutProps) {
  return (
    <Box flexDirection="column" height="100%" width="100%">
      {/* Header - Claude Code style */}
      <Box {...styles.header}>
        <Text color="#007acc" bold>
          █ Qi CLI
        </Text>
        <Text color="dim" dimColor>
          {' '}– AI-powered development assistant
        </Text>
      </Box>
      
      {/* Main Content Area */}
      <Box {...styles.content}>
        <OutputDisplay messages={messages} />
        
        {/* Permission Dialog Overlay */}
        {permissionRequest && (
          <PermissionDialog
            request={permissionRequest}
            onApprove={onPermissionApprove || (() => {})}
            onDeny={onPermissionDeny || (() => {})}
            onDismiss={onPermissionDismiss || (() => {})}
          />
        )}
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
      
      {/* Processing Indicator - Simple and real */}
      {isProcessing && currentPhase && (
        <Box paddingX={2} paddingY={0}>
          <Text color="#ff9800">
            {currentPhase}...
          </Text>
        </Box>
      )}

      {/* Status Line - Claude Code style */}
      <Box {...styles.statusLine}>
        <Box {...styles.statusLeft}>
          <Text color="#ff6b35" bold>{provider}</Text>
          <Text color="dim" dimColor> → </Text>
          <Text color="#4caf50" bold>{model}</Text>
          <Text color="dim" dimColor> • </Text>
          <Text color="#007acc">{mode}</Text>
        </Box>
        {isProcessing ? (
          <Box {...styles.statusRight}>
            <LoadingIndicator 
              message={currentPhase || 'Processing'} 
              showAnimation={true}
              color="#ff9800"
            />
            <Text color="dim" dimColor> • </Text>
            <Text color="#2196f3">Esc to cancel</Text>
          </Box>
        ) : (
          <Box {...styles.statusRight}>
            <Text color="dim" dimColor>Ctrl+C clear • Ctrl+D exit</Text>
          </Box>
        )}
      </Box>
    </Box>
  )
});