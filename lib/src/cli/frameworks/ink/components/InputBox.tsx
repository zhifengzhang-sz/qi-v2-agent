/**
 * Input Box Component for Ink CLI
 * 
 * Handles user input with proper parsing and command detection
 */

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import TextInput, { UncontrolledTextInput } from 'ink-text-input'
import type { AppState, AppSubState } from '../../../abstractions/index.js'

interface InputBoxProps {
  state: AppState
  subState?: AppSubState
  onSubmit: (input: string) => void
  onStateChange?: () => void
  onCommand?: (command: string, args: string[]) => void
  onCancel?: () => void
  onClear?: () => void
  placeholder?: string
  framework?: any // Framework instance for listening to events
}

export function InputBox({ 
  state, 
  subState, 
  onSubmit, 
  onStateChange,
  onCommand,
  onCancel,
  onClear,
  placeholder = 'Enter command or prompt...',
  framework
}: InputBoxProps) {
  const [input, setInput] = useState('')
  const [isPending, startTransition] = useTransition()
  const { exit } = useApp()
  
  const isDisabled = state === 'busy' || isPending
  
  // Listen to global framework events for input clearing (avoids useInput conflict)
  useEffect(() => {
    if (!framework) return;
    
    const handleClearInput = () => {
      setInput('');
      if (onClear) {
        onClear();
      }
    };

    // Listen to the clearInput event from the global handler
    framework.on('clearInput', handleClearInput);
    
    return () => {
      framework.off('clearInput', handleClearInput);
    };
  }, [framework, onClear]);
  
  const handleSubmit = (value: string) => {
    if (value.trim()) {
      startTransition(() => {
        const trimmedValue = value.trim()
        
        // Check if it's a command
        if (trimmedValue.startsWith('/') && onCommand) {
          const parts = trimmedValue.slice(1).split(' ')
          const command = parts[0]
          const args = parts.slice(1)
          onCommand(command, args)
        } else {
          onSubmit(trimmedValue)
        }
        
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
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="cyan">{getPromptPrefix()} </Text>
        {!isDisabled ? (
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder={placeholder}
            focus={true}
          />
        ) : (
          <Text color="gray" dimColor>
            Please wait...
          </Text>
        )}
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