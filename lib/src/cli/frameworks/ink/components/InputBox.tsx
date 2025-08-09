/**
 * Input Box Component for Ink CLI
 * 
 * Handles user input with proper parsing and command detection
 */

import React, { useState, useTransition, useRef, useEffect } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import TextInput, { UncontrolledTextInput } from 'ink-text-input'
import { LoadingSpinner } from './LoadingIndicator.js'
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

// Claude Code-style command suggestions
const COMMAND_SUGGESTIONS = [
  { command: '/help', description: 'Show available commands' },
  { command: '/clear', description: 'Clear conversation history' },
  { command: '/model', description: 'Switch AI model' },
  { command: '/status', description: 'Show system status' },
  { command: '/config', description: 'View configuration' },
  { command: '/permission', description: 'Demo permission dialog' },
];

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

  // Check if input matches command suggestions
  const getCommandSuggestions = () => {
    if (!input.startsWith('/') || input.length < 2) return []
    
    const query = input.toLowerCase()
    return COMMAND_SUGGESTIONS.filter(suggestion => 
      suggestion.command.toLowerCase().startsWith(query)
    ).slice(0, 3) // Show max 3 suggestions
  }

  const suggestions = getCommandSuggestions()
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="#007acc">{getPromptPrefix()} </Text>
        {!isDisabled ? (
          <TextInput
            value={input}
            onChange={setInput}
            onSubmit={handleSubmit}
            placeholder={placeholder}
            focus={true}
          />
        ) : (
          <Box>
            <LoadingSpinner />
            <Text color="#e0e0e0" dimColor> Please wait...</Text>
          </Box>
        )}
      </Box>

      {/* Command Suggestions - Claude Code style */}
      {suggestions.length > 0 && !isDisabled && (
        <Box flexDirection="column" paddingLeft={3}>
          {suggestions.map((suggestion, index) => (
            <Box key={suggestion.command}>
              <Text color="#4caf50">
                {suggestion.command}
              </Text>
              <Text color="dim" dimColor>
                {' '}- {suggestion.description}
              </Text>
            </Box>
          ))}
        </Box>
      )}
      
    </Box>
  )
}