# Ink Framework Development Lessons Learned

## Overview
This document captures key insights from implementing Ctrl+C input clearing in our Ink-based CLI framework, learned through analysis of Claude Code's implementation.

## Key Technical Insights

### 1. TextInput Ctrl+C Blocking Issue
**Problem**: The `ink-text-input` component internally intercepts Ctrl+C and "returns without action", preventing `useInput` handlers from receiving the event.

**Root Cause**: TextInput's source code explicitly handles Ctrl+C to prevent it from reaching other handlers.

### 2. The useInput + TextInput Conflict
**Problem**: Using both `useInput` and `TextInput` simultaneously causes input handling conflicts where both try to process the same keyboard events.

**Solution**: Use only one input handler per component:
- `TextInput` for regular typing (letters, numbers, backspace, etc.)
- `useInput` only for special key combinations at the app level

### 3. App-Level Configuration Solution
**Key Setting**: 
```tsx
render(<App />, { exitOnCtrlC: false })
```

This disables Ink's automatic Ctrl+C -> exit behavior, allowing custom handling.

## Successful Architecture Pattern

### 1. Global Input Handler
```tsx
// At InkCLIApp level
useInput((inputChar, key) => {
  if (key.ctrl && inputChar === 'c') {
    framework.emit('clearInput', { reason: 'ctrl+c' });
    return;
  }
  
  if (key.ctrl && inputChar === 'd') {
    exit();
    return;
  }
});
```

### 2. Component Event Listening
```tsx
// In InputBox component
useEffect(() => {
  const handleClearInput = () => {
    setInput(''); // Uses controlled component pattern
    if (onClear) onClear();
  };

  framework.on('clearInput', handleClearInput);
  return () => framework.off('clearInput', handleClearInput);
}, [framework, onClear]);
```

### 3. Clean Component Separation
- **App Level**: Handles special keys (Ctrl+C, Ctrl+D, global shortcuts)
- **Component Level**: Uses TextInput for regular typing, listens for framework events
- **No Conflicts**: Each layer handles its specific responsibilities

## Claude Code Analysis

Our implementation was inspired by Claude Code CLI, which:
- Uses Ink framework with React for terminal UI
- Implements Ctrl+C as "Cancel current input or generation" (not exit)
- Uses similar app-level input handling architecture
- Separates global shortcuts from component input

## Best Practices Learned

1. **Never mix useInput + TextInput** for the same input
2. **Use exitOnCtrlC: false** for custom Ctrl+C handling
3. **Handle special keys globally**, regular input at component level
4. **Use event system** for cross-component communication
5. **Follow Ink's controlled component patterns** with `setInput('')`

## Framework-Specific Solutions

### Readline Framework
```javascript
// Clear input using Node.js readline method
rl.write(null, { ctrl: true, name: 'u' }); // Simulates Ctrl+U
```

### Ink Framework
```javascript
// Clear input using React state + event system
setInput(''); // Controlled component pattern
```

## Testing Limitations

- Ink requires interactive TTY mode for proper testing
- "Raw mode is not supported" errors are expected in automated environments
- UI rendering success indicates proper implementation

## Version History

- **v0.4.1**: Successfully implemented Ctrl+C input clearing for both readline and Ink frameworks
- Architecture: Event-driven input handling with framework communication