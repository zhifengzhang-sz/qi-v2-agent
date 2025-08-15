# QiCore Integration Guide for Workflow System

## Overview

The workflow system fully embraces QiCore functional programming patterns throughout. This guide demonstrates proper QiCore integration patterns and best practices for workflow development.

## Architecture: Two-Layer Pattern

### Interface Layer (Recommended for Most Users)
- Simple Promise-based APIs
- Automatic error conversion from QiCore Result<T> to Promise rejection
- Clean TypeScript interfaces without QiCore complexity

### Internal QiCore Layer (Advanced Usage)
- Full Result<T> pattern usage with match(), flatMap(), and fromAsyncTryCatch()
- Professional error handling with QiCore create() function
- Structured logging with createQiLogger

## Basic Usage Examples

### 1. Interface Layer - Simple Promise APIs

```typescript
import { createWorkflowHandler } from '@qi/workflow';

// Create handler with graceful fallback
const workflowHandler = await createWorkflowHandler({
  toolExecutor: myToolExecutor,
  logLevel: 'info'
});

try {
  // Simple Promise-based API
  const result = await workflowHandler.executeReAct('Analyze codebase structure');
  console.log('Analysis complete:', result.output);
  console.log('Execution time:', result.executionTime);
  console.log('Tools used:', result.toolResults.length);
} catch (error) {
  console.error('Workflow failed:', error.message);
}
```

### 2. QiCore Layer - Professional Result<T> Patterns

```typescript
import { QiCoreWorkflowManager } from '@qi/workflow';
import { match } from '@qi/base';

// Initialize QiCore manager
const manager = new QiCoreWorkflowManager(toolExecutor);
const initResult = await manager.initialize();

// Handle initialization with QiCore patterns
match(
  () => console.log('Manager initialized successfully'),
  (error) => console.error('Initialization failed:', error.message),
  initResult
);

// Execute with full QiCore error handling
const context = {
  sessionId: 'analysis-session',
  domain: 'codebase',
  enableMetrics: true
};

const executionResult = await manager.executeReActPattern(
  'Analyze codebase structure',
  context
);

// Professional error handling with match()
match(
  (success) => {
    console.log('✅ Analysis completed:', success.output);
    console.log('📊 Performance:', Object.fromEntries(success.performance));
    console.log('🔧 Tools used:', success.toolResults.length);
  },
  (error) => {
    console.error('❌ Analysis failed:', error.message);
    console.error('🔍 Error code:', error.code);
    console.error('📋 Context:', error.context);
  },
  executionResult
);
```

## Advanced QiCore Patterns

### 1. Chaining Operations with flatMap

```typescript
import { flatMap, success } from '@qi/base';

// Chain multiple workflow operations
const analysisResult = await manager.executeReActPattern(input, context)
  .then(result => flatMap(
    (analysis) => manager.executeReWOOPattern(
      `Build on analysis: ${analysis.output}`,
      context
    ),
    result
  ))
  .then(result => flatMap(
    (planning) => manager.executeADaPTPattern(
      `Implement plan: ${planning.output}`,
      context
    ),
    result
  ));

// Handle final chained result
match(
  (finalResult) => console.log('Complete workflow chain:', finalResult.output),
  (error) => console.error('Chain failed at:', error.context),
  analysisResult
);
```

### 2. Error Recovery with QiCore Patterns

```typescript
// Execute with fallback strategy using QiCore patterns
const executeWithFallback = async (input: string) => {
  // Try ReAct pattern first
  const reactResult = await manager.executeReActPattern(input, context);
  
  return match(
    (success) => success, // Return successful result
    async (error) => {
      // Log the failure professionally
      logger.warn('ReAct pattern failed, trying ReWOO fallback', undefined, {
        originalError: error.message,
        fallbackStrategy: 'ReWOO'
      });
      
      // Try ReWOO as fallback
      const fallbackResult = await manager.executeReWOOPattern(input, context);
      
      return match(
        (success) => success,
        (fallbackError) => {
          // Both failed - return structured error
          throw create(
            'ALL_PATTERNS_FAILED',
            'Both ReAct and ReWOO patterns failed',
            'SYSTEM',
            {
              originalError: error.message,
              fallbackError: fallbackError.message,
              input: input.substring(0, 100)
            }
          );
        },
        fallbackResult
      );
    },
    reactResult
  );
};
```

### 3. Streaming with QiCore Error Handling

```typescript
// Stream workflow execution with proper QiCore error handling
const streamWithQiCore = async () => {
  try {
    for await (const chunkResult of manager.streamWorkflow('react', input, context)) {
      match(
        (chunk) => {
          console.log(`Stage: ${chunk.state.metadata.currentStage}`);
          console.log(`Progress: ${chunk.isComplete ? 'Complete' : 'In Progress'}`);
          
          if (chunk.state.output) {
            console.log(`Output: ${chunk.state.output}`);
          }
        },
        (error) => {
          logger.error('Stream chunk error', undefined, {
            errorCode: error.code,
            errorMessage: error.message,
            context: error.context
          });
          throw new Error(`Stream failed: ${error.message}`);
        },
        chunkResult
      );
    }
  } catch (error) {
    console.error('Streaming workflow failed:', error);
  }
};
```

## QiCore Best Practices for Workflows

### 1. Structured Error Creation

```typescript
import { create } from '@qi/base';

// Always use QiCore create() for errors
const workflowError = create(
  'WORKFLOW_VALIDATION_FAILED',
  'Input validation failed for workflow execution',
  'VALIDATION',
  {
    input: input.substring(0, 100),
    validationRules: ['non-empty', 'max-length'],
    sessionId: context.sessionId
  }
);
```

### 2. Professional Logging

```typescript
import { createQiLogger } from '../../utils/QiCoreLogger.js';

const logger = createQiLogger({
  name: 'MyWorkflowComponent',
  level: 'info'
});

// Structured logging with context
logger.info('🚀 Starting workflow execution', undefined, {
  component: 'MyWorkflowComponent',
  method: 'executeWorkflow',
  pattern: 'ReAct',
  sessionId: context.sessionId,
  inputLength: input.length
});

// Error logging with full context
logger.error('❌ Workflow execution failed', undefined, {
  component: 'MyWorkflowComponent',
  method: 'executeWorkflow',
  errorCode: error.code,
  errorMessage: error.message,
  context: error.context,
  executionTime: Date.now() - startTime
});
```

### 3. Result<T> Return Types

```typescript
import { Result, success, failure } from '@qi/base';

// Always return Result<T> for operations that can fail
const validateWorkflowInput = (input: string): Result<string, QiError> => {
  if (!input.trim()) {
    return failure(create(
      'EMPTY_INPUT',
      'Workflow input cannot be empty',
      'VALIDATION',
      { input }
    ));
  }
  
  if (input.length > 10000) {
    return failure(create(
      'INPUT_TOO_LONG',
      'Workflow input exceeds maximum length',
      'VALIDATION',
      { inputLength: input.length, maxLength: 10000 }
    ));
  }
  
  return success(input.trim());
};
```

## Integration with Tool System

### WorkflowToolExecutor QiCore Patterns

```typescript
// Tool execution with QiCore patterns
const executeToolWithQiCore = async (toolName: string, input: Record<string, unknown>) => {
  const request = {
    toolName,
    input,
    nodeId: 'workflow-node',
    workflowId: 'workflow-123',
    sessionId: 'session-456'
  };
  
  const result = await toolExecutor.executeTool(request);
  
  return match(
    (toolResult) => {
      logger.info('🔧 Tool executed successfully', undefined, {
        toolName: toolResult.toolName,
        executionTime: toolResult.executionTime,
        success: toolResult.success
      });
      return toolResult;
    },
    (error) => {
      logger.error('❌ Tool execution failed', undefined, {
        toolName,
        errorCode: error.code,
        errorMessage: error.message
      });
      throw error; // Re-throw QiCore error
    },
    result
  );
};
```

## Testing with QiCore Patterns

### Unit Testing QiCore Components

```typescript
import { describe, it, expect } from 'vitest';
import { success, failure } from '@qi/base';

describe('QiCore Workflow Manager', () => {
  it('should handle successful pattern execution', async () => {
    const manager = new QiCoreWorkflowManager();
    await manager.initialize();
    
    const result = await manager.executeReActPattern('test input', context);
    
    expect(result.tag).toBe('success');
    if (result.tag === 'success') {
      expect(result.value.output).toBeDefined();
      expect(result.value.executionTime).toBeGreaterThan(0);
    }
  });
  
  it('should handle pattern failures gracefully', async () => {
    const manager = new QiCoreWorkflowManager();
    // Don't initialize to force failure
    
    const result = await manager.executeReActPattern('test input', context);
    
    expect(result.tag).toBe('failure');
    if (result.tag === 'failure') {
      expect(result.error.code).toBe('MANAGER_NOT_INITIALIZED');
      expect(result.error.category).toBe('SYSTEM');
    }
  });
});
```

This comprehensive guide demonstrates proper QiCore integration throughout the workflow system, maintaining functional programming principles while providing both simple and advanced usage patterns.