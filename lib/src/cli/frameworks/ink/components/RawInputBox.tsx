/**
 * Raw Input Box Component - Claude Code Style
 * 
 * Implements direct stdin handling with raw mode for sophisticated cursor navigation
 * Based on Claude Code's approach with process.stdin.setRawMode(true)
 */

import React, { useState, useEffect, useRef, useCallback } from 'react'
import { Box, Text, useApp } from 'ink'
import type { AppState, AppSubState } from '../../../abstractions/index.js'

interface RawInputBoxProps {
  state: AppState
  subState?: AppSubState
  onSubmit: (input: string) => void
  onStateChange?: () => void
  onCommand?: (command: string, args: string[]) => void
  onCancel?: () => void
  onClear?: () => void
  placeholder?: string
  framework?: any
  onSuggestions?: (suggestions: Array<{command: string, description: string}>) => void
}

// ANSI escape sequences for cursor control
const ESCAPE_SEQUENCES = {
  MOVE_CURSOR_LEFT: '\x1B[D',
  MOVE_CURSOR_RIGHT: '\x1B[C', 
  MOVE_CURSOR_UP: '\x1B[A',
  MOVE_CURSOR_DOWN: '\x1B[B',
  MOVE_TO_START: '\x1B[H',
  MOVE_TO_END: '\x1B[F',
  CLEAR_LINE: '\x1B[2K',
  SAVE_CURSOR: '\x1B[s',
  RESTORE_CURSOR: '\x1B[u',
  FOCUS_REPORTING_ON: '\x1B[?1004h',
  FOCUS_REPORTING_OFF: '\x1B[?1004l'
};

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

export function RawInputBox({ 
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
}: RawInputBoxProps) {
  const [input, setInput] = useState('')
  const [cursorPosition, setCursorPosition] = useState(0)
  const [historyIndex, setHistoryIndex] = useState(-1)
  const [currentInputBuffer, setCurrentInputBuffer] = useState('')
  const [isRawModeActive, setIsRawModeActive] = useState(false)
  
  const stdinListenerRef = useRef<NodeJS.ReadStream | null>(null)
  const { exit } = useApp()
  
  const isDisabled = state === 'busy'

  // Get command history from framework
  const getHistory = (): string[] => {
    if (framework && framework.state && framework.state.history) {
      return [...framework.state.history].reverse();
    }
    return [];
  };

  // Setup raw mode stdin listening (Claude Code approach)
  const setupStdinListening = useCallback(() => {
    if (isDisabled || isRawModeActive) return;
    
    try {
      stdinListenerRef.current = process.stdin;
      
      // Enable raw mode for direct key handling
      if (stdinListenerRef.current.setRawMode) {
        stdinListenerRef.current.setRawMode(true);
        stdinListenerRef.current.resume();
        
        // Enable focus reporting (Claude Code style)
        process.stdout.write(ESCAPE_SEQUENCES.FOCUS_REPORTING_ON);
        setIsRawModeActive(true);
      }
      
      // Handle raw input data
      stdinListenerRef.current.on('data', handleRawInput);
    } catch (error) {
      console.error('Failed to setup raw mode:', error);
    }
  }, [isDisabled, isRawModeActive]);

  // Cleanup raw mode
  const cleanupStdinListening = useCallback(() => {
    if (stdinListenerRef.current && isRawModeActive) {
      try {
        stdinListenerRef.current.off('data', handleRawInput);
        
        if (stdinListenerRef.current.setRawMode) {
          stdinListenerRef.current.setRawMode(false);
          stdinListenerRef.current.pause();
        }
        
        // Disable focus reporting
        process.stdout.write(ESCAPE_SEQUENCES.FOCUS_REPORTING_OFF);
        setIsRawModeActive(false);
      } catch (error) {
        console.error('Failed to cleanup raw mode:', error);
      }
    }
  }, [isRawModeActive]);

  // Handle raw stdin input (Claude Code style parsing)
  const handleRawInput = useCallback((chunk: Buffer) => {
    const inputStr = chunk.toString('utf8');
    
    // Parse special key sequences
    if (inputStr.includes('\x1B[')) {
      handleEscapeSequence(inputStr);
      return;
    }
    
    // Handle regular character input
    if (inputStr.length === 1) {
      const charCode = inputStr.charCodeAt(0);
      
      switch (charCode) {
        case 3: // Ctrl+C
          if (onCancel) onCancel();
          return;
        case 13: // Enter
          handleEnterKey();
          return;
        case 8: // Backspace
        case 127: // Delete (some terminals)
          handleBackspace();
          return;
        default:
          if (charCode >= 32 && charCode <= 126) { // Printable characters
            insertCharAtCursor(inputStr);
          }
          return;
      }
    }
  }, [input, cursorPosition, historyIndex]);

  // Handle escape sequences (arrow keys, etc.)
  const handleEscapeSequence = useCallback((sequence: string) => {
    const history = getHistory();
    
    if (sequence.includes('[A')) { // Up arrow
      handleUpArrow(history);
    } else if (sequence.includes('[B')) { // Down arrow  
      handleDownArrow(history);
    } else if (sequence.includes('[C')) { // Right arrow
      handleRightArrow();
    } else if (sequence.includes('[D')) { // Left arrow
      handleLeftArrow();
    } else if (sequence.includes('[H')) { // Home
      setCursorPosition(0);
    } else if (sequence.includes('[F')) { // End
      setCursorPosition(input.length);
    }
  }, [input, cursorPosition, historyIndex]);

  // Arrow key handlers with Claude Code behavior
  const handleUpArrow = useCallback((history: string[]) => {
    if (history.length === 0) return;
    
    if (historyIndex === -1) {
      setCurrentInputBuffer(input);
      setHistoryIndex(0);
      setInput(history[0]);
      setCursorPosition(history[0].length);
    } else if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
      setCursorPosition(history[newIndex].length);
    }
  }, [input, historyIndex]);

  const handleDownArrow = useCallback((history: string[]) => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      setInput(history[newIndex]);
      setCursorPosition(history[newIndex].length);
    } else if (historyIndex === 0) {
      setHistoryIndex(-1);
      setInput(currentInputBuffer);
      setCursorPosition(currentInputBuffer.length);
    } else if (historyIndex === -1) {
      // This is the key behavior: when on current input and at last line,
      // down arrow moves cursor to end of line (Claude Code behavior)
      const lines = input.split('\n');
      const currentLineIndex = getCurrentLineIndex();
      
      if (currentLineIndex === lines.length - 1) {
        // On last line - move to end of input (Claude Code behavior)
        setCursorPosition(input.length);
      } else {
        // Not on last line - move to next line
        moveCursorToNextLine();
      }
    }
  }, [input, historyIndex, currentInputBuffer, cursorPosition]);

  const handleLeftArrow = useCallback(() => {
    if (cursorPosition > 0) {
      setCursorPosition(cursorPosition - 1);
    }
  }, [cursorPosition]);

  const handleRightArrow = useCallback(() => {
    if (cursorPosition < input.length) {
      setCursorPosition(cursorPosition + 1);
    }
  }, [cursorPosition, input.length]);

  // Utility functions for line-based cursor movement
  const getCurrentLineIndex = useCallback((): number => {
    const beforeCursor = input.slice(0, cursorPosition);
    return beforeCursor.split('\n').length - 1;
  }, [input, cursorPosition]);

  const moveCursorToNextLine = useCallback(() => {
    const lines = input.split('\n');
    const currentLineIndex = getCurrentLineIndex();
    
    if (currentLineIndex < lines.length - 1) {
      const charactersBeforeCurrentLine = lines.slice(0, currentLineIndex + 1).join('\n').length;
      const nextLineStart = charactersBeforeCurrentLine + 1;
      setCursorPosition(Math.min(nextLineStart + getCursorPositionInCurrentLine(), 
                                 nextLineStart + lines[currentLineIndex + 1].length));
    }
  }, [input, cursorPosition]);

  const getCursorPositionInCurrentLine = useCallback((): number => {
    const beforeCursor = input.slice(0, cursorPosition);
    const lines = beforeCursor.split('\n');
    return lines[lines.length - 1].length;
  }, [input, cursorPosition]);

  // Character insertion/deletion
  const insertCharAtCursor = useCallback((char: string) => {
    const newInput = input.slice(0, cursorPosition) + char + input.slice(cursorPosition);
    setInput(newInput);
    setCursorPosition(cursorPosition + 1);
    setHistoryIndex(-1); // Reset history when typing
  }, [input, cursorPosition]);

  const handleBackspace = useCallback(() => {
    if (cursorPosition > 0) {
      const newInput = input.slice(0, cursorPosition - 1) + input.slice(cursorPosition);
      setInput(newInput);
      setCursorPosition(cursorPosition - 1);
      setHistoryIndex(-1);
    }
  }, [input, cursorPosition]);

  const handleEnterKey = useCallback(() => {
    if (input.trim()) {
      const trimmedValue = input.trim();
      
      // Check if it's a command
      if (trimmedValue.startsWith('/') && onCommand) {
        const parts = trimmedValue.slice(1).split(' ');
        const command = parts[0];
        const args = parts.slice(1);
        onCommand(command, args);
      } else {
        onSubmit(trimmedValue);
      }
      
      // Reset state
      setInput('');
      setCursorPosition(0);
      setHistoryIndex(-1);
      setCurrentInputBuffer('');
    }
  }, [input, onCommand, onSubmit]);

  // Setup and cleanup effects
  useEffect(() => {
    if (!isDisabled) {
      setupStdinListening();
    } else {
      cleanupStdinListening();
    }
    
    return cleanupStdinListening;
  }, [isDisabled, setupStdinListening, cleanupStdinListening]);

  // Cleanup on unmount
  useEffect(() => {
    return cleanupStdinListening;
  }, [cleanupStdinListening]);

  // Framework event listeners
  useEffect(() => {
    if (!framework) return;
    
    const handleClearInput = () => {
      setInput('');
      setCursorPosition(0);
      setHistoryIndex(-1);
      setCurrentInputBuffer('');
      if (onClear) onClear();
    };

    framework.on('clearInput', handleClearInput);
    return () => framework.off('clearInput', handleClearInput);
  }, [framework, onClear]);

  // Generate display with cursor
  const getDisplayText = useCallback((): { text: string, cursorChar: string } => {
    if (input.length === 0) {
      return { text: placeholder || '', cursorChar: '|' };
    }
    
    const beforeCursor = input.slice(0, cursorPosition);
    const atCursor = input.slice(cursorPosition, cursorPosition + 1);
    const afterCursor = input.slice(cursorPosition + 1);
    
    return {
      text: beforeCursor + (atCursor || ' ') + afterCursor,
      cursorChar: atCursor || '|'
    };
  }, [input, cursorPosition, placeholder]);

  const getPromptPrefix = () => {
    if (state === 'busy') return '⏳';
    
    const prefixes = {
      planning: '📋',
      editing: '✏️', 
      generic: '💬'
    };
    
    return prefixes[subState || 'generic'];
  };

  const { text: displayText, cursorChar } = getDisplayText();

  return (
    <Box flexDirection="column">
      <Box>
        <Text color="#007acc">{getPromptPrefix()} </Text>
        {!isDisabled ? (
          <Box>
            <Text>{displayText.slice(0, cursorPosition)}</Text>
            <Text backgroundColor="white" color="black">{cursorChar}</Text>
            <Text>{displayText.slice(cursorPosition + 1)}</Text>
          </Box>
        ) : (
          <Box>
            <Text color="#e0e0e0" dimColor> Processing...</Text>
          </Box>
        )}
      </Box>
    </Box>
  );
}