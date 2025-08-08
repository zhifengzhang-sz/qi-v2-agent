# Manual Test Instructions for Ctrl+C Prompt Clearing

## Test Procedure

1. Start the CLI with readline framework:
   ```bash
   bun run app/src/prompt/qi-prompt.ts --framework=readline
   ```

2. Once the CLI starts, you should see:
   ```
   🚀 Event-Driven CLI Ready
   =========================
   💡 Press Shift+Tab to cycle modes, Esc to cancel operations
   ⌨️  Ctrl+C to clear prompt • Ctrl+D to exit

   ollama:qwen3:0.6b [💬] > 
   ```

3. Type some text in the prompt (don't press Enter):
   ```
   ollama:qwen3:0.6b [💬] > hello world this is test text
   ```

4. Press Ctrl+C - you should see:
   - The input line gets cleared
   - A message "ℹ️ Prompt cleared" appears
   - The prompt returns to clean state

5. Test Ctrl+D for exit:
   - Press Ctrl+D
   - CLI should exit gracefully with "👋 Goodbye!"

## Expected Behavior

- **Ctrl+C**: Clears current input, shows "Prompt cleared" message
- **Ctrl+D**: Exits the CLI gracefully  
- **Esc**: Cancels ongoing operations (when processing)

## Test Status

- [x] Ink framework: ✅ IMPLEMENTED - Uses controlled component + key-based re-render
- [x] Readline framework: ✅ WORKING - Uses `rl.write(null, { ctrl: true, name: 'u' })`

## Technical Implementation

**Readline Framework:** Uses the proper Node.js readline method `rl.write(null, { ctrl: true, name: 'u' })` which simulates the Ctrl+U keyboard shortcut to clear the current input line.

**Ink Framework:** Uses controlled component pattern with `setInput('')` + forced re-render via `key` prop increment. The `useInput` hook handles Ctrl+C detection while TextInput manages regular input. Note: Requires interactive TTY to test properly.