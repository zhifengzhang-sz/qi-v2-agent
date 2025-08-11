/**
 * Hybrid Text Input Component - Following Claude Code's Architecture
 * 
 * This component follows Claude Code's exact design pattern:
 * 1. Presentation component with minimal logic
 * 2. Delegates all logic to useHybridTextInput hook  
 * 3. Uses cursor.render() for proper display
 * 4. Clean props interface
 * 
 * Based on analysis of Claude Code's TextInput.tsx
 */

import React from 'react';
import { Text, useInput } from 'ink';
import type { Key } from 'ink';
import { useHybridTextInput } from '../../hybrid/hooks/useHybridTextInput.js';
import type { HybridCLIFramework } from '../../hybrid/HybridCLIFramework.js';

export interface HybridTextInputProps {
  /**
   * Current text value
   */
  value: string;
  
  /**
   * Called when text changes
   */
  onChange: (value: string) => void;
  
  /**
   * Called when Enter is pressed
   */
  onSubmit?: (value: string) => void;
  
  /**
   * Called when up arrow triggers history navigation
   */
  onHistoryUp?: () => void;
  
  /**
   * Called when down arrow triggers history navigation  
   */
  onHistoryDown?: () => void;
  
  /**
   * Called when up arrow is used to navigate command suggestions
   */
  onCommandSuggestionUp?: () => void;
  
  /**
   * Called when down arrow is used to navigate command suggestions
   */
  onCommandSuggestionDown?: () => void;
  
  /**
   * Called when Tab is pressed to accept current command suggestion
   */
  onCommandSuggestionAccept?: () => void;
  
  /**
   * Whether command suggestions are currently visible
   */
  hasCommandSuggestions?: boolean;
  
  /**
   * Placeholder text when empty
   */
  placeholder?: string;
  
  /**
   * Whether component should listen to input
   */
  focus?: boolean;
  
  /**
   * Terminal column width for text wrapping
   */
  columns?: number;
  
  /**
   * Current cursor position
   */
  cursorOffset: number;
  
  /**
   * Called when cursor position changes
   */
  onCursorOffsetChange: (offset: number) => void;
  
  /**
   * Hybrid framework instance for enhanced navigation
   */
  framework?: HybridCLIFramework;
}

/**
 * HybridTextInput Component
 * 
 * Follows Claude Code's architecture:
 * - Minimal presentation component
 * - All logic delegated to hook
 * - Clean props interface
 * - Proper cursor rendering
 */
export function HybridTextInput({
  value,
  onChange,
  onSubmit,
  onHistoryUp,
  onHistoryDown,
  onCommandSuggestionUp,
  onCommandSuggestionDown,
  onCommandSuggestionAccept,
  hasCommandSuggestions = false,
  placeholder = '',
  focus = true,
  columns = 80,
  cursorOffset,
  onCursorOffsetChange,
  framework,
}: HybridTextInputProps) {
  
  // Delegate all logic to hook (Claude Code pattern)
  const { onInput, renderedValue } = useHybridTextInput({
    value,
    onChange,
    onSubmit,
    onHistoryUp,
    onHistoryDown,
    onCommandSuggestionUp,
    onCommandSuggestionDown,
    onCommandSuggestionAccept,
    hasCommandSuggestions,
    columns,
    cursorOffset,
    onCursorOffsetChange,
    framework,
  });

  // Capture input events (Claude Code pattern)
  useInput(onInput, { isActive: focus });

  // Show placeholder when empty (Claude Code pattern)
  if (value === '' && placeholder) {
    return <Text dimColor>{placeholder}</Text>;
  }

  // Render using cursor.render() output (Claude Code pattern)
  return <Text>{renderedValue}</Text>;
}