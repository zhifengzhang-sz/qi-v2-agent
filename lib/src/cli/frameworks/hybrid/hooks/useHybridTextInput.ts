/**
 * useHybridTextInput Hook - Following Claude Code's Design Pattern
 *
 * This hook implements Claude Code's exact input handling pattern:
 * 1. Immutable cursor operations
 * 2. Functional input mapping
 * 3. cursor.equals() for boundary detection
 * 4. Proper separation of concerns
 *
 * Based on analysis of Claude Code's useTextInput.ts
 */

import chalk from 'chalk';
import type { Key } from 'ink';
import { useState } from 'react';
import { Cursor } from '../../../../utils/Cursor.js';
import type { HybridCLIFramework } from '../HybridCLIFramework.js';

type MaybeCursor = void | Cursor;
type InputHandler = (input: string) => MaybeCursor;
type InputMapper = (input: string) => MaybeCursor;

// Claude Code's mapInput pattern
function mapInput(input_map: Array<[string, InputHandler]>): InputMapper {
  return function (input: string): MaybeCursor {
    const handler = new Map(input_map).get(input) ?? (() => {});
    return handler(input);
  };
}

interface UseHybridTextInputProps {
  value: string;
  onChange: (value: string) => void;
  onSubmit?: (value: string) => void;
  onHistoryUp?: () => void;
  onHistoryDown?: () => void;
  columns: number;
  cursorOffset: number;
  onCursorOffsetChange: (offset: number) => void;
  framework?: HybridCLIFramework;
}

interface UseHybridTextInputResult {
  renderedValue: string;
  onInput: (input: string, key: Key) => void;
}

export function useHybridTextInput({
  value,
  onChange,
  onSubmit,
  onHistoryUp,
  onHistoryDown,
  columns,
  cursorOffset,
  onCursorOffsetChange,
  framework,
}: UseHybridTextInputProps): UseHybridTextInputResult {
  // Create cursor from current state (Claude Code pattern)
  const cursor = Cursor.fromText(value, columns, cursorOffset);

  // Claude Code's exact navigation pattern
  function upOrHistoryUp() {
    // Step 1: Try cursor movement first
    const cursorUp = cursor.up();

    // Step 2: Check if cursor movement failed
    if (cursorUp.equals(cursor)) {
      // Step 3: Cursor couldn't move - trigger history
      onHistoryUp?.();
    }

    // Step 4: Always return cursor (moved or unchanged)
    return cursorUp;
  }

  function downOrHistoryDown() {
    // Step 1: Try cursor movement first
    const cursorDown = cursor.down();

    // Step 2: Check if cursor movement failed
    if (cursorDown.equals(cursor)) {
      // Step 3: Cursor couldn't move - trigger history
      onHistoryDown?.();
    }

    // Step 4: Always return cursor (moved or unchanged)
    return cursorDown;
  }

  // Handle Enter key
  function handleEnter() {
    onSubmit?.(value);
    return cursor; // Return current cursor, don't change text
  }

  // Claude Code's Ctrl key mappings
  const handleCtrl = mapInput([
    ['a', () => cursor.startOfLine()], // Ctrl+A
    ['e', () => cursor.endOfLine()], // Ctrl+E
    ['f', () => cursor.right()], // Ctrl+F
    ['b', () => cursor.left()], // Ctrl+B
    ['d', () => cursor.del()], // Ctrl+D
    ['h', () => cursor.backspace()], // Ctrl+H
    ['k', () => cursor.deleteToLineEnd()], // Ctrl+K
    ['u', () => cursor.deleteToLineStart()], // Ctrl+U
    ['w', () => cursor.deleteWordBefore()], // Ctrl+W
  ]);

  // Claude Code's Meta key mappings
  const handleMeta = mapInput([
    ['f', () => cursor.nextWord()], // Alt+F
    ['b', () => cursor.prevWord()], // Alt+B
    ['d', () => cursor.deleteWordAfter()], // Alt+D
  ]);

  // Claude Code's main input handler pattern
  function onInput(input: string, key: Key): void {
    // Handle backspace/delete first (Claude Code pattern)
    if (key.backspace || key.delete || input === '\b' || input === '\x7f' || input === '\x08') {
      const nextCursor = cursor.backspace();
      if (!cursor.equals(nextCursor)) {
        onCursorOffsetChange(nextCursor.offset);
        if (cursor.text !== nextCursor.text) {
          onChange(nextCursor.text);
        }
      }
      return;
    }

    // Get next cursor from key mapping
    const nextCursor = mapKey(key)(input);
    if (nextCursor) {
      if (!cursor.equals(nextCursor)) {
        onCursorOffsetChange(nextCursor.offset);
        if (cursor.text !== nextCursor.text) {
          onChange(nextCursor.text);
        }
      }
    }
  }

  // Claude Code's key mapping function
  function mapKey(key: Key): InputMapper {
    switch (true) {
      case key.leftArrow && (key.ctrl || key.meta):
        return () => cursor.prevWord();
      case key.rightArrow && (key.ctrl || key.meta):
        return () => cursor.nextWord();
      case key.ctrl:
        return handleCtrl;
      case key.meta:
        return handleMeta;
      case key.return:
        return () => {
          handleEnter();
          return cursor; // Don't change cursor for Enter
        };
      case key.upArrow:
        return upOrHistoryUp;
      case key.downArrow:
        return downOrHistoryDown;
      case key.leftArrow:
        return () => cursor.left();
      case key.rightArrow:
        return () => cursor.right();
    }

    // Handle regular character input (Claude Code pattern)
    return function (input: string) {
      switch (true) {
        // Home key
        case input === '\x1b[H' || input === '\x1b[1~':
          return cursor.startOfLine();
        // End key
        case input === '\x1b[F' || input === '\x1b[4~':
          return cursor.endOfLine();
        // Handle backspace character explicitly
        case input === '\b' || input === '\x7f' || input === '\x08':
          return cursor.backspace();
        default:
          return cursor.insert(input);
      }
    };
  }

  // Use Claude Code's cursor.render() for proper display
  const renderedValue = cursor.render(' ', '', (text: string) => chalk.inverse(text));

  return {
    onInput,
    renderedValue,
  };
}
