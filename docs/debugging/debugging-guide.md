# Qi-Prompt Debugging Guide

*Practical debugging strategies for the v0.6.1 message-driven architecture*

## Debug Mode Usage

### Enabling Debug Output

```bash
# Enable debug output
bun run qi-prompt --framework=hybrid --debug

# Or via environment variable
QI_CLI_DEBUG=true bun run qi-prompt --framework=hybrid
```

### Debug Output Levels

**Without `--debug`**: Clean output, only essential system messages
**With `--debug`**: Detailed component-specific logging:

- `[QiPromptCLI]` - Message processing lifecycle
- `[QiAsyncMessageQueue]` - Queue operations and async iteration
- `[PromptAppOrchestrator]` - Input classification and LLM timing
- `[InkCLIFramework]` - UI events and state changes

## Common Debugging Scenarios

### 1. Message Processing Issues

**Symptoms**: 
- Messages not being processed
- Duplicate processing
- Processing hangs

**Debug Steps**:
```bash
# Run with debug to see message flow
bun run qi-prompt --framework=hybrid --debug

# Look for these patterns:
# ✅ Normal: "📤 Enqueuing message ID=abc123, type=user_input"
# ✅ Normal: "⏳ About to process message ID=abc123"
# ✅ Normal: "✅ Finished processing message ID=abc123"

# 🚨 Problem: Missing enqueue logs = UI not sending messages
# 🚨 Problem: Missing processing logs = Queue iteration stopped
# 🚨 Problem: Same ID processing twice = Duplicate iterator
```

**Key Files**:
- `QiPromptCLI.ts:152` - Message processing loop
- `QiAsyncMessageQueue.ts:198` - Message enqueueing
- `InkCLIFramework.tsx:193` - UI message creation

### 2. LLM Integration Issues

**Symptoms**:
- No response from LLM
- Slow responses
- Error responses

**Debug Steps**:
```bash
# Look for LLM timing logs:
# ✅ Normal: "🚀 About to call LLM with contextAwarePromptHandler for: 'hello'"
# ✅ Normal: "⚡ LLM call completed in 1250ms"

# 🚨 Problem: No LLM start log = Request not reaching orchestrator
# 🚨 Problem: LLM start but no completion = LLM provider issue
# 🚨 Problem: Very long duration = Network/provider performance issue
```

**Key Files**:
- `PromptAppOrchestrator.ts:510` - LLM call initiation
- `PromptAppOrchestrator.ts:522` - Basic fallback handler

### 3. UI State Issues

**Symptoms**:
- UI not updating
- Input not working
- Processing state stuck

**Debug Steps**:
```bash
# Look for UI event logs:
# ✅ Normal: "handleInput: 'hello'"
# ✅ Normal: "Set isProcessing to true for input processing"
# ✅ Normal: "Reset isProcessing to false"
# ✅ Normal: "Ready for new input after displaying message"

# 🚨 Problem: No handleInput = Input component issue
# 🚨 Problem: isProcessing true but no reset = Display not called
```

**Key Files**:
- `InkCLIFramework.tsx:158` - Input handling
- `InkCLIFramework.tsx:220` - Processing state management

### 4. Performance Analysis

**Debug Timing Patterns**:
```bash
# Message processing timing
⏳ [QiPromptCLI] About to process message ID=abc123
🔄 [QiPromptCLI] Processing message: ID=abc123, type=user_input
📝 [QiPromptCLI] Processing USER_INPUT: "hello"
✅ [PromptAppOrchestrator] Input "hello" correctly classified as prompt
🚀 [PromptAppOrchestrator] About to call LLM for: "hello"
⚡ [PromptAppOrchestrator] LLM call completed in 1250ms
📺 [QiPromptCLI] Displaying LLM response directly
✅ [QiPromptCLI] Message processing complete for ID=abc123
```

**Performance Benchmarks**:
- **Input to Processing**: Should be < 10ms
- **LLM Call**: Varies by provider (500ms - 5000ms typical)
- **Response Display**: Should be < 50ms
- **Total User Experience**: Target < 3 seconds for simple prompts

## Architecture-Specific Debugging

### Message Queue Debugging

**Common Issues**:
1. **Multiple Iterators**: Queue throws "ALREADY_STARTED" error
2. **Queue Starvation**: Messages enqueued but not processed
3. **Memory Leaks**: Messages not cleaned up

**Debug Commands**:
```typescript
// Check queue state (add to QiAsyncMessageQueue for debugging)
getQueueState() {
  return {
    queueLength: this.queue.length,
    isStarted: this.state.started,
    isDone: this.state.isDone,
    hasReadResolver: !!this.readResolve
  };
}
```

### React/Ink Debugging

**Common Issues**:
1. **Re-render Loops**: Component renders continuously
2. **State Sync Issues**: React state out of sync with framework state
3. **Event Handling**: Events not properly bound/unbound

**Debug Techniques**:
```typescript
// Add to React components for debugging
useEffect(() => {
  console.log('[DEBUG] Component re-rendered:', { 
    isProcessing, 
    messages: messages.length,
    currentPhase 
  });
});

// Check for event listener leaks
useEffect(() => {
  return () => {
    console.log('[DEBUG] Component unmounting, cleaning up listeners');
  };
}, []);
```

## Known Issues and Workarounds

### 1. Empty Lines During Processing (v0.6.1)

**Status**: UNRESOLVED
**Symptoms**: Multiple empty lines appear during LLM processing wait
**Temporary Workaround**: None - cosmetic issue only
**Investigation Priority**: Low (doesn't affect functionality)

### 2. LoadingIndicator Re-render Loop

**Status**: FIXED (v0.6.1)
**Cause**: `useEffect` dependency on `frameIndex` that was updated inside effect
**Fix**: Removed `frameIndex` from dependency array, use state updater function

### 3. Message ID Collisions

**Status**: FIXED (v0.6.1)
**Cause**: `Math.random().toString(36)` could create duplicate IDs
**Fix**: Use `crypto.randomBytes(8).toString('hex')` for unique IDs

## Debugging Checklist

### Before Reporting a Bug

- [ ] Run with `--debug` flag to capture detailed logs
- [ ] Check if issue reproduces consistently
- [ ] Note the exact input that triggers the issue
- [ ] Capture timing information from debug logs
- [ ] Check browser console (if applicable) for React errors
- [ ] Verify environment (Node version, OS, terminal type)

### Essential Log Collection

```bash
# Capture complete debug session
bun run qi-prompt --framework=hybrid --debug 2>&1 | tee debug-session.log

# Test specific scenario
echo "test input" | bun run qi-prompt --framework=hybrid --debug > debug-output.txt 2>&1
```

### Component-Specific Debug Points

**QiPromptCLI**: Message processing loop, state transitions
**QiAsyncMessageQueue**: Enqueue/dequeue operations, iterator state
**PromptAppOrchestrator**: Input classification, LLM timing
**InkCLIFramework**: UI events, state management
**React Components**: Re-renders, event handling, state sync

## Troubleshooting Quick Reference

| Symptom | Component | Debug Log Pattern | Likely Cause |
|---------|-----------|-------------------|--------------|
| No response to input | InkCLIFramework | Missing "handleInput" | Input event not bound |
| Input processed but no LLM call | PromptAppOrchestrator | Missing "About to call LLM" | Classification/routing issue |
| LLM call but no response | PromptAppOrchestrator | "About to call" but no "completed" | LLM provider issue |
| Response generated but not displayed | QiPromptCLI | Missing "Displaying LLM response" | Display message not called |
| Infinite processing | Multiple | Repeating message IDs | Circular message loop |
| UI frozen | InkCLIFramework | Missing "Reset isProcessing" | State not reset properly |

## Advanced Debugging

### Memory Usage Monitoring

```bash
# Monitor memory usage during operation
node --inspect-brk=9229 $(which bun) run qi-prompt --framework=hybrid --debug

# Use Chrome DevTools at chrome://inspect
```

### Message Flow Visualization

```bash
# Generate message flow logs
bun run qi-prompt --framework=hybrid --debug 2>&1 | \
  grep -E "(Enqueuing|Processing|Displaying)" | \
  awk '{print $1 " " $2 " " $NF}' > message-flow.log
```

This debugging guide should be updated as new issues are discovered and resolved.