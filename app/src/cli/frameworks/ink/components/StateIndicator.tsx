/**
 * State Indicator Component for Ink CLI
 * 
 * Shows current application state with visual indicators
 */

import React from 'react'
import { Box, Text } from 'ink'
import type { AppState, AppSubState } from '../../../abstractions/index.js'

interface StateIndicatorProps {
  state: AppState
  subState?: AppSubState
  taskName?: string
}

const STATE_COLORS = {
  busy: 'yellow',
  ready: 'green'
} as const

const SUB_STATE_LABELS = {
  planning: '📋 Planning',
  editing: '✏️  Editing', 
  generic: '💬 Generic'
} as const

export function StateIndicator({ state, subState, taskName }: StateIndicatorProps) {
  const getStateDisplay = () => {
    if (state === 'busy') {
      return taskName ? `⏳ Busy: ${taskName}` : '⏳ Busy'
    }
    
    if (state === 'ready' && subState) {
      return SUB_STATE_LABELS[subState]
    }
    
    return '🟢 Ready'
  }
  
  const getStatusColor = () => {
    return STATE_COLORS[state] || 'white'
  }
  
  return (
    <Box paddingLeft={1} paddingRight={1}>
      <Text color={getStatusColor()}>
        {getStateDisplay()}
      </Text>
      {state === 'ready' && (
        <Text color="dim" dimColor>
          {' '}(Shift+Tab to cycle)
        </Text>
      )}
    </Box>
  )
}