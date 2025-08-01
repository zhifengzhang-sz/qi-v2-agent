/**
 * Input Box Component for Ink CLI
 * 
 * Handles user input with proper parsing and command detection
 */

import React, { useState, useTransition } from 'react'
import { Box, Text, useInput } from 'ink'
import { TextInput } from '@inkjs/ui'
import type { AppState, AppSubState } from '../../../abstractions/index.js'

interface InputBoxProps {
  state: AppState
  subState?: AppSubState
  onSubmit: (input: string) => void
  onStateChange?: () => void
  placeholder?: string
}

export function InputBox({ 
  state, 
  subState, 
  onSubmit, 
  onStateChange,
  placeholder = 'Enter command or prompt...'
}: InputBoxProps) {
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  
  useInput((input, key) => {
    // Handle Shift+Tab for state cycling
    if (key.shift && key.tab && state === 'ready' && onStateChange) {
      onStateChange()
      return
    }
    
    // Handle Ctrl+C for exit
    if (key.ctrl && input === 'c') {
      process.exit(0)
    }
  })
  
  const handleSubmit = (value: string) => {
    if (value.trim()) {
      startTransition(() => {
        onSubmit(value.trim())
        setInput('')
      })
    }
  }
  
  const getPromptPrefix = () => {
    if (state === 'busy') {
      return '⏳'
    }
    
    const prefixes = {
      planning: '📋',
      editing: '✏️',
      generic: '💬'
    }
    
    return prefixes[subState || 'generic']
  }
  
  const isDisabled = state === 'busy' || isPending
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{getPromptPrefix()} </Text>
        <TextInput
          onChange={setInput}
          onSubmit={handleSubmit}
          placeholder={isDisabled ? 'Please wait...' : placeholder}
          isDisabled={isDisabled}
        />
      </Box>
      
      {isDisabled && (
        <Box paddingLeft={2}>
          <Text color="yellow" dimColor>
            System is processing your request...
          </Text>
        </Box>
      )}
    </Box>
  )
}