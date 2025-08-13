/**
 * Input Box Component for Ink CLI
 * 
 * Handles user input with proper parsing and command detection
 */

import React, { useState, useTransition, useRef, useEffect, useMemo } from 'react'
import { Box, Text, useInput, useApp } from 'ink'
import TextInput, { UncontrolledTextInput } from 'ink-text-input'
import { LoadingSpinner } from './LoadingIndicator.js'
import { HybridTextInput } from './HybridTextInput.js'
import { useHybridHistory } from '../../hybrid/hooks/useHybridHistory.js'
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
  currentInput?: string // Current input text controlled by framework
  onSuggestions?: (suggestions: Array<{command: string, description: string}>) => void
}

// Claude Code-style command suggestions
const COMMAND_SUGGESTIONS = [
  { command: '/help', description: 'Show available commands' },
  { command: '/clear', description: 'Clear conversation history' },
  { command: '/model', description: 'Switch AI model' },
  { command: '/provider', description: 'Switch AI provider' },
  { command: '/status', description: 'Show system status' },
  { command: '/tokens', description: 'Set max tokens limit' },
  { command: '/config', description: 'View configuration' },
  { command: '/exit', description: 'Exit the application' },
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
  currentInput,
  onSuggestions
}: InputBoxProps) {
  // Use currentInput from framework, fallback to local state for backward compatibility
  const [localInput, setLocalInput] = useState('')
  const [hybridInput, setHybridInput] = useState('')
  const [hybridCursor, setHybridCursor] = useState(0)
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0)
  const [isPending, startTransition] = useTransition()
  const { exit } = useApp()
  
  const isDisabled = state === 'busy' || isPending
  
  // Check if we're in hybrid mode (enhanced with Claude Code navigation)
  const isHybridMode = framework && 
    framework.constructor && 
    framework.constructor.name === 'HybridCLIFramework' && 
    framework.isHybridEnabled;


  // In hybrid mode, use hybrid input; otherwise use currentInput or localInput
  const input = isHybridMode ? hybridInput : (currentInput ?? localInput)
  
  // Listen to global framework events for input clearing (avoids useInput conflict)
  useEffect(() => {
    if (!framework) return;
    
    const handleClearInput = () => {
      setLocalInput('');
      if (isHybridMode) {
        setHybridInput('');
        setHybridCursor(0);
      }
      if (onClear) {
        onClear();
      }
    };

    const handleInputUpdate = (data: { text: string; cursorPosition: number }) => {
      if (isHybridMode) {
        setHybridInput(data.text);
        setHybridCursor(data.cursorPosition);
      }
    };

    // Event listeners removed - input clearing handled through direct callbacks
    // Hybrid mode input updates handled through StateManager subscriptions
  }, [framework, onClear, isHybridMode]);
  
  const handleSubmit = (value: string) => {
    if (value.trim()) {
      startTransition(() => {
        const trimmedValue = value.trim()
        
        // Add to history in hybrid mode
        if (isHybridMode && hybridHistory) {
          hybridHistory.addToHistory(trimmedValue);
          hybridHistory.resetHistory(); // Reset history navigation
        }
        
        // Check if it's a command
        if (trimmedValue.startsWith('/') && onCommand) {
          const parts = trimmedValue.slice(1).split(' ')
          const command = parts[0]
          const args = parts.slice(1)
          onCommand(command, args)
        } else {
          onSubmit(trimmedValue)
        }
        
        // Clear both local and hybrid input
        setLocalInput('')
        if (isHybridMode) {
          setHybridInput('')
          setHybridCursor(0)
        }
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
  
  // Handle keyboard navigation for command suggestions (skip in hybrid mode)
  useInput((input, key) => {
    // In hybrid mode, let HybridTextInput handle all input
    if (isHybridMode) {
      return;
    }
    
    // Regular mode: handle command suggestions
    if (suggestions.length === 0) return;
    
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
    
    if (key.tab && suggestions.length > 0) {
      // Tab to select current suggestion
      const selectedCommand = suggestions[selectedSuggestionIndex];
      if (selectedCommand) {
        setLocalInput(selectedCommand.command + ' ');
        setSelectedSuggestionIndex(0);
      }
      return;
    }
    
    if (key.return && suggestions.length > 0 && input.trim().startsWith('/')) {
      // Enter with suggestions visible - auto-complete first suggestion if input is just '/'
      if (input.trim() === '/') {
        const selectedCommand = suggestions[selectedSuggestionIndex];
        if (selectedCommand) {
          setLocalInput(selectedCommand.command + ' ');
          setSelectedSuggestionIndex(0);
          return;
        }
      }
    }
  }, { isActive: !isDisabled && !isHybridMode }); // Disable completely in hybrid mode
  
  // Notify parent about suggestions changes (include selected index)
  useEffect(() => {
    if (onSuggestions) {
      onSuggestions(suggestions.map((suggestion, index) => ({
        ...suggestion,
        selected: index === selectedSuggestionIndex
      })));
    }
  }, [suggestions, selectedSuggestionIndex, onSuggestions]);
  
  // History management for hybrid mode
  const hybridHistory = useHybridHistory({
    onSetInput: (value: string) => {
      setHybridInput(value);
      setHybridCursor(value.length); // Move cursor to end when setting from history
    },
    currentInput: hybridInput,
  });

  // Enhanced hybrid mode input handler that syncs with cursor changes
  const handleHybridInputChange = (newValue: string) => {
    setHybridInput(newValue);
    // Reset history navigation when user types
    if (hybridHistory.historyIndex > 0) {
      hybridHistory.resetHistory();
    }
    // Reset cursor end state when user types
    if (framework && framework.resetCursorEndState) {
      framework.resetCursorEndState();
    }
  };

  // History navigation handlers for hybrid mode
  const handleHistoryUp = () => {
    hybridHistory.onHistoryUp();
  };

  const handleHistoryDown = () => {
    hybridHistory.onHistoryDown();
  };

  // Command suggestion navigation handlers for hybrid mode
  const handleCommandSuggestionUp = () => {
    if (suggestions.length === 0) return;
    setSelectedSuggestionIndex(prev => 
      prev <= 0 ? suggestions.length - 1 : prev - 1
    );
  };

  const handleCommandSuggestionDown = () => {
    if (suggestions.length === 0) return;
    setSelectedSuggestionIndex(prev => 
      prev >= suggestions.length - 1 ? 0 : prev + 1
    );
  };

  const handleCommandSuggestionAccept = () => {
    if (suggestions.length > 0) {
      const selectedCommand = suggestions[selectedSuggestionIndex];
      if (selectedCommand) {
        setHybridInput(selectedCommand.command + ' ');
        setHybridCursor(selectedCommand.command.length + 1);
        setSelectedSuggestionIndex(0);
      }
    }
  };

  // In hybrid mode, use proper HybridTextInput following Claude Code architecture
  if (isHybridMode) {
    return (
      <Box flexDirection="column">
        <Box>
          <Text color="#007acc">{getPromptPrefix()} </Text>
          {!isDisabled ? (
            <HybridTextInput
              value={hybridInput}
              onChange={handleHybridInputChange}
              onSubmit={handleSubmit}
              onHistoryUp={handleHistoryUp}
              onHistoryDown={handleHistoryDown}
              onCommandSuggestionUp={handleCommandSuggestionUp}
              onCommandSuggestionDown={handleCommandSuggestionDown}
              onCommandSuggestionAccept={handleCommandSuggestionAccept}
              hasCommandSuggestions={suggestions.length > 0}
              placeholder={placeholder}
              focus={true}
              framework={framework}
              cursorOffset={hybridCursor}
              onCursorOffsetChange={setHybridCursor}
              columns={80}
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

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="#007acc">{getPromptPrefix()} </Text>
        {!isDisabled ? (
          <TextInput
            value={input}
            onChange={currentInput ? () => {} : setLocalInput} // No-op if controlled by framework
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