/**
 * Input Box Component for Ink CLI
 * 
 * Handles user input with proper parsing and command detection
 */

import React, { useState, useTransition, useRef, useEffect, useMemo } from 'react'
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
  onSuggestions?: (suggestions: Array<{command: string, description: string}>) => void
}

// Claude Code-style command suggestions
const COMMAND_SUGGESTIONS = [
  { command: '/help', description: 'Show available commands' },
  { command: '/clear', description: 'Clear conversation history' },
  { command: '/model', description: 'Switch AI model' },
  { command: '/provider', description: 'Switch AI provider' },
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
  framework,
  onSuggestions
}: InputBoxProps) {
  const [input, setInput] = useState('')
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(-1)  // -1 means current input, 0+ are history items
  const [currentInputBuffer, setCurrentInputBuffer] = useState('') // Store current input when navigating history
  const [hasNavigatedWithinText, setHasNavigatedWithinText] = useState(false) // Track if user has used arrows to navigate within current text
  const [isPending, startTransition] = useTransition()
  const { exit } = useApp()
  
  const isDisabled = state === 'busy' || isPending
  
  // Get command history from framework
  const getHistory = (): string[] => {
    if (framework && framework.state && framework.state.history) {
      return [...framework.state.history].reverse(); // Most recent first
    }
    return [];
  };
  
  
  // Reset history navigation when input changes (user typing)
  const handleInputChange = (newInput: string) => {
    setInput(newInput);
    setHistoryIndex(-1); // Reset to current input
    setHasNavigatedWithinText(false); // Reset navigation tracking
  };
  
  
  // Listen to global framework events for input clearing (avoids useInput conflict)
  useEffect(() => {
    if (!framework) return;
    
    const handleClearInput = () => {
      setInput('');
      setHistoryIndex(-1);
      setCurrentInputBuffer('');
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
        
        // Reset input and history navigation state
        setInput('')
        setHistoryIndex(-1)
        setCurrentInputBuffer('')
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

  // Memoize suggestions calculation to prevent infinite loops
  const suggestions = useMemo(() => {
    if (!input.startsWith('/')) return []
    
    // Show all commands when just typing '/'
    if (input.length === 1) {
      return COMMAND_SUGGESTIONS.slice(0, 6) // Show more commands initially
    }
    
    // Filter commands when typing more characters
    const query = input.toLowerCase()
    return COMMAND_SUGGESTIONS.filter(suggestion => 
      suggestion.command.toLowerCase().startsWith(query)
    ).slice(0, 6) // Show up to 6 suggestions
  }, [input])
  
  // Reset selection when suggestions change
  useEffect(() => {
    setSelectedSuggestionIndex(0)
  }, [suggestions.length])
  
  // Handle keyboard navigation for command suggestions and history
  useInput((inputChar, key) => {
    const history = getHistory();
    
    // History navigation takes priority when no suggestions are shown
    if (suggestions.length === 0) {
      if (key.upArrow && history.length > 0) {
        // Navigate up in history (to older commands)
        if (historyIndex === -1) {
          // First time entering history - save current input
          setCurrentInputBuffer(input);
          setHistoryIndex(0);
          setInput(history[0]);
        } else if (historyIndex < history.length - 1) {
          const newIndex = historyIndex + 1;
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
        }
        return;
      }
      
      if (key.downArrow) {
        if (historyIndex > 0) {
          // Move to newer history item
          const newIndex = historyIndex - 1;
          setHistoryIndex(newIndex);
          setInput(history[newIndex]);
          return;
        } else if (historyIndex === 0) {
          // At most recent history item, return to current input buffer
          setHistoryIndex(-1);
          setInput(currentInputBuffer);
          return;
        } else if (historyIndex === -1) {
          // Claude Code behavior: when on current input (last line of message),
          // down arrow moves cursor to end of line
          const lines = input.split('\n');
          
          // Simple heuristic: if it's multi-line text, assume cursor is on last line
          // and move to end of input (Claude Code style)
          if (lines.length > 1) {
            // Force cursor to end by temporarily adding/removing a character
            const originalInput = input;
            setInput(originalInput + ' ');
            setTimeout(() => {
              setInput(originalInput);
              setHasNavigatedWithinText(true);
            }, 1);
            return;
          } else {
            // Single line - move to end and prepare for history navigation
            const originalInput = input;
            setInput(originalInput + ' ');
            setTimeout(() => {
              setInput(originalInput);
              // After cursor is at end, subsequent down arrow goes to history
              if (hasNavigatedWithinText && history.length > 0) {
                setTimeout(() => {
                  setCurrentInputBuffer(originalInput);
                  setHistoryIndex(0);
                  setInput(history[0]);
                }, 10);
              } else {
                setHasNavigatedWithinText(true);
              }
            }, 1);
            return;
          }
        }
        // Let TextInput handle natural cursor movement
      }
    } else {
      // Command suggestion navigation when suggestions are visible
      if (key.upArrow) {
        setSelectedSuggestionIndex(prev => 
          prev <= 0 ? suggestions.length - 1 : prev - 1
        );
        return;
      }
      
      if (key.downArrow) {
        setSelectedSuggestionIndex(prev => 
          prev >= suggestions.length - 1 ? 0 : prev + 1
        );
        return;
      }
    }
    
    if (key.tab && suggestions.length > 0) {
      // Tab to select current suggestion
      const selectedCommand = suggestions[selectedSuggestionIndex];
      if (selectedCommand) {
        setInput(selectedCommand.command + ' ');
        setSelectedSuggestionIndex(0);
      }
      return;
    }
    
    if (key.return && suggestions.length > 0 && input.trim().startsWith('/')) {
      // Enter with suggestions visible - auto-complete first suggestion if input is just '/'
      if (input.trim() === '/') {
        const selectedCommand = suggestions[selectedSuggestionIndex];
        if (selectedCommand) {
          setInput(selectedCommand.command + ' ');
          setSelectedSuggestionIndex(0);
          return;
        }
      }
    }
  }, { isActive: !isDisabled });
  
  // Notify parent about suggestions changes (include selected index)
  useEffect(() => {
    if (onSuggestions) {
      onSuggestions(suggestions.map((suggestion, index) => ({
        ...suggestion,
        selected: index === selectedSuggestionIndex
      })));
    }
  }, [suggestions, selectedSuggestionIndex, onSuggestions]);
  
  return (
    <Box flexDirection="column">
      <Box>
        <Text color="#007acc">{getPromptPrefix()} </Text>
        {!isDisabled ? (
          <TextInput
            value={input}
            onChange={handleInputChange}
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

      
    </Box>
  )
}