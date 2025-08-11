# Workflow Race Condition Fix Strategies

## Problem Summary

The current implementation has a race condition between workflow processing and original input processing:

1. **Line 222**: `this.emit('processInput', request.input)` - Async workflow starts
2. **Line 225**: `const parsed = parseInput(request.input)` - Sync processing continues immediately
3. **Result**: Original input may complete before workflow, causing @file references to fail with slow providers

## Test Results

- **Fast providers (Ollama)**: Workflow often completes before LLM processing → @file references work
- **Slow providers (OpenRouter)**: Original processing completes first → @file references broken

## Fix Strategy 1: Synchronous Workflow Detection (Recommended)

**Approach**: Detect workflow patterns synchronously and wait for workflow completion before proceeding.

**Pros**:
- Clean, predictable behavior
- No duplicate processing
- Works with all provider speeds
- Minimal code changes

**Cons**:
- Slightly increases latency for non-workflow inputs

**Implementation**:
```typescript
async process(request: AgentRequest): Promise<AgentResponse> {
  // ... existing setup ...

  try {
    // BEFORE processing, check if workflow is needed
    const needsWorkflow = this.detectWorkflowPattern(request.input);
    
    if (needsWorkflow) {
      // Wait for workflow to complete and get enhanced content
      const workflowResult = await this.processWorkflow(request.input);
      if (workflowResult.success) {
        // Create new request with enhanced content
        request = {
          ...request,
          input: workflowResult.data.output
        };
      }
    }

    // Now process the (potentially enhanced) input
    const parsed = parseInput(request.input);
    // ... rest of existing logic
  }
}

private detectWorkflowPattern(input: string): boolean {
  return input.includes('@') && (input.includes('.') || input.includes('/'));
}

private async processWorkflow(input: string): Promise<WorkflowResult> {
  // Move workflow processing logic here
  // Return promise that resolves when workflow is complete
}
```

## Fix Strategy 2: Event Coordination

**Approach**: Use event coordination to ensure workflow completes before original processing.

**Pros**:
- Maintains event-driven architecture
- More flexible for complex workflows

**Cons**:
- More complex state management
- Harder to debug
- Risk of deadlocks

**Implementation**:
```typescript
async process(request: AgentRequest): Promise<AgentResponse> {
  // ... existing setup ...

  try {
    // Check if workflow is needed
    const needsWorkflow = this.detectWorkflowPattern(request.input);
    
    if (needsWorkflow) {
      // Emit workflow request and wait for completion
      const workflowPromise = this.waitForWorkflowCompletion(request.input);
      this.emit('processInput', request.input);
      
      const workflowResult = await workflowPromise;
      if (workflowResult.success) {
        request = { ...request, input: workflowResult.data.output };
      }
    }

    // Continue with processing
    const parsed = parseInput(request.input);
    // ... rest of logic
  }
}

private waitForWorkflowCompletion(input: string): Promise<WorkflowResult> {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Workflow timeout'));
    }, 5000);

    this.once('workflowComplete', (result) => {
      clearTimeout(timeout);
      resolve(result);
    });
  });
}
```

## Fix Strategy 3: Input Queue with Priority

**Approach**: Queue all inputs and process workflow-enhanced content with higher priority.

**Pros**:
- Handles multiple concurrent requests well
- Can prioritize different input types

**Cons**:
- Much more complex implementation
- Changes fundamental processing model
- May introduce new race conditions

**Implementation**: (Complex - not recommended for this specific issue)

## Fix Strategy 4: Cancel and Restart

**Approach**: Cancel original processing when workflow completes if still in progress.

**Pros**:
- Minimal changes to existing flow
- Handles edge cases well

**Cons**:
- Wastes processing resources
- Complex cancellation logic
- May confuse users with multiple responses

## Recommended Solution: Strategy 1 (Synchronous Workflow Detection)

Strategy 1 is recommended because it:

1. **Solves the root cause**: Ensures workflow completes before processing
2. **Simple implementation**: Minimal changes to existing code
3. **Predictable behavior**: No race conditions, no duplicate processing
4. **Performance friendly**: Only adds latency when workflows are actually needed
5. **Provider agnostic**: Works equally well with fast and slow providers

## Implementation Plan

1. **Modify PromptAppOrchestrator.process()**:
   - Add synchronous workflow detection
   - Wait for workflow completion before parsing input
   - Process enhanced content instead of original

2. **Move workflow logic**:
   - Extract workflow processing from event handler to synchronous method
   - Remove `processInput` event emission
   - Remove duplicate `promptRequested` handling

3. **Update qi-prompt.ts**:
   - Remove `handleProcessInput` method
   - Remove `processInput` event handler
   - Workflow processing now handled directly in orchestrator

4. **Test thoroughly**:
   - Verify @file references work with both Ollama and OpenRouter
   - Ensure no performance regression for non-workflow inputs
   - Test cancellation behavior

This approach transforms the race condition into a deterministic, sequential process while maintaining the existing API and behavior patterns.