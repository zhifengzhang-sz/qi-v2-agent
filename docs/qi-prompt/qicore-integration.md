# QiCore Integration Guide (v-0.6.3)

*Complete guide to QiCore patterns used in qi-prompt implementation*

## Overview

QiPrompt v-0.6.3 fully integrates QiCore patterns for professional, enterprise-grade code quality. This includes structured logging, functional error handling, and configuration-driven behavior.

## Logger Integration

### Basic Logger Setup

All components initialize QiCore logger with graceful fallback:

```typescript
import { createLogger, type Logger } from '@qi/core';
import { match, type Result, type QiError } from '@qi/base';

class MyComponent {
  private logger: Logger | SimpleLogger;

  constructor() {
    // Initialize QiCore logger with fallback
    const loggerResult = createLogger({ 
      level: 'info', 
      pretty: true,
      name: 'my-component'
    });
    
    this.logger = match(
      (logger) => logger,
      () => ({
        info: () => {},
        error: () => {},
        warn: () => {},
        debug: () => {}
      }),
      loggerResult
    );
  }
}
```

### Conditional Debug Logging

Debug logging is conditional on the `--debug` flag:

```typescript
class QiPromptApp {
  private debugMode: boolean;
  private logger: Logger;

  constructor(options: { debug?: boolean }) {
    this.debugMode = options.debug ?? false;
    
    // Initialize logger with appropriate level
    const loggerResult = createLogger({ 
      level: this.debugMode ? 'debug' : 'info', 
      pretty: true 
    });
    this.logger = match(logger => logger, () => fallbackLogger, loggerResult);
  }

  someMethod() {
    // Always log important information
    this.logger.info('Important state change', undefined, {
      component: 'QiPromptApp',
      method: 'someMethod',
    });

    // Only log debug information when debug mode is enabled
    if (this.debugMode) {
      this.logger.debug('Debug details', undefined, {
        component: 'QiPromptApp',
        method: 'someMethod',
        debugData: someData,
      });
    }
  }
}
```

## Structured Metadata Standards

### Required Metadata Fields

All log entries **must** include:
- `component`: String identifying the component (e.g., 'QiPromptCLI', 'StateManager')

### Optional but Recommended Fields

- `method`: Method name where logging occurs
- `step`: Processing step identifier
- `messageId`: For message processing logs
- `error`: Error object or message for error logs
- `errorContext`: Additional error context
- `performance`: Timing and performance data

### Examples

```typescript
// Information logging
this.logger.info('🚀 Initializing component', undefined, {
  component: 'QiPromptApp',
  version: 'v-0.6.3',
});

// Debug logging with data
this.logger.debug('⏳ Processing message', undefined, {
  messageId: message.id,
  messageType: message.type,
  component: 'QiPromptCLI',
  method: 'processMessage',
});

// Error logging with context
this.logger.error('❌ Operation failed', undefined, {
  component: 'StateManager',
  method: 'loadConfig',
  error: error.message,
  errorContext: error.context,
  step: 'config_validation',
});

// Performance logging
this.logger.info('✅ Operation completed', undefined, {
  component: 'PromptHandler',
  method: 'processPrompt',
  performance: {
    duration: Date.now() - startTime,
    tokensProcessed: result.tokens,
  },
});
```

## Result<T> Pattern Usage

### Basic Pattern

Replace all try/catch blocks with `fromAsyncTryCatch`:

```typescript
// ❌ OLD: try/catch pattern
async badExample() {
  try {
    const result = await someAsyncOperation();
    return result;
  } catch (error) {
    console.error('Operation failed:', error);
    throw error;
  }
}

// ✅ NEW: QiCore Result<T> pattern
async goodExample(): Promise<Result<SomeType, QiError>> {
  return fromAsyncTryCatch(
    async () => {
      const result = await someAsyncOperation();
      return result;
    },
    (error) => systemError('Operation failed', {
      originalError: error instanceof Error ? error.message : String(error),
      errorStack: error instanceof Error ? error.stack : undefined,
      component: 'ComponentName',
      step: 'operation_name',
    })
  );
}
```

### Using Results

Always use `match` to handle Result<T> values:

```typescript
async useResults() {
  const result = await this.goodExample();
  
  match(
    (value) => {
      // Success case
      this.logger.info('Operation succeeded', undefined, {
        component: 'ComponentName',
        resultSize: value.length,
      });
      return value;
    },
    (error) => {
      // Error case
      this.logger.error('Operation failed', undefined, {
        component: 'ComponentName',
        error: error.message,
        errorContext: error.context,
      });
      throw error; // or handle gracefully
    },
    result
  );
}
```

## Configuration-Driven Behavior

### Logger Configuration

```typescript
// Configuration drives logger behavior
const loggerConfig = {
  level: config.getOr('logging.level', 'info'),
  pretty: config.getOr('logging.pretty', true),
  name: config.getOr('logging.component', 'qi-prompt'),
};

const loggerResult = createLogger(loggerConfig);
```

### Environment Variable Support

```bash
# Override logging configuration
QI_PROMPT_LOGGING_LEVEL=debug bun run qi-prompt
QI_PROMPT_LOGGING_PRETTY=false bun run qi-prompt
QI_PROMPT_APP_DEBUG=true bun run qi-prompt
```

## Error Handling Patterns

### Error Types

Use appropriate QiError constructors:

```typescript
import { systemError, validationError, businessError } from '@qi/base';

// System errors (infrastructure failures)
const sysError = systemError('Database connection failed', {
  component: 'DatabaseManager',
  connectionString: 'postgres://...',
  retryAttempt: 3,
});

// Validation errors (invalid input)
const validError = validationError('Invalid email format', {
  component: 'UserValidator',
  email: userInput.email,
  pattern: EMAIL_REGEX.toString(),
});

// Business errors (business rule violations)
const bizError = businessError('Insufficient permissions', {
  component: 'AuthManager',
  userId: user.id,
  requiredRole: 'admin',
  userRole: user.role,
});
```

### Error Context Preservation

Always preserve error context when chaining:

```typescript
async chainedOperations(): Promise<Result<FinalResult, QiError>> {
  return fromAsyncTryCatch(
    async () => {
      const step1Result = await this.step1();
      const step1Value = match(
        (value) => value,
        (error) => {
          // Chain error context
          throw systemError('Step 1 failed in chained operation', {
            component: 'ChainedProcessor',
            step: 'step1',
            originalError: error.message,
            originalContext: error.context,
          });
        },
        step1Result
      );

      // Continue with step2, step3, etc.
      return finalResult;
    },
    (error) => systemError('Chained operation failed', {
      component: 'ChainedProcessor',
      originalError: error instanceof Error ? error.message : String(error),
    })
  );
}
```

## Performance Considerations

### Conditional Logging

Avoid expensive operations in logging when not needed:

```typescript
// ❌ BAD: Always serializes complex object
this.logger.debug('State dump', undefined, {
  component: 'StateManager',
  fullState: JSON.stringify(this.complexState), // Always executed!
});

// ✅ GOOD: Only serialize when debug logging is enabled
if (this.debugMode) {
  this.logger.debug('State dump', undefined, {
    component: 'StateManager',
    fullState: JSON.stringify(this.complexState), // Only when needed
  });
}
```

### Lazy Evaluation

Use functions for expensive computations:

```typescript
// ✅ GOOD: Lazy evaluation of expensive metadata
this.logger.info('Complex operation completed', undefined, {
  component: 'ComplexProcessor',
  get expensiveData() {
    // Only computed if logging level includes this entry
    return computeExpensiveMetadata();
  },
});
```

## Migration Patterns

### Console.log Replacement

```typescript
// ❌ OLD: Direct console usage
console.log('Debug info:', data);
console.error('Error occurred:', error);
console.warn('Warning:', message);

// ✅ NEW: Structured QiCore logging
this.logger.debug('Debug information', undefined, {
  component: 'ComponentName',
  data: data,
});

this.logger.error('Error occurred', undefined, {
  component: 'ComponentName',
  error: error.message,
  errorStack: error.stack,
});

this.logger.warn('Warning condition detected', undefined, {
  component: 'ComponentName',
  warning: message,
  context: additionalContext,
});
```

### Try/Catch Replacement

```typescript
// ❌ OLD: Manual error handling
try {
  const result = await operation();
  console.log('Success:', result);
  return result;
} catch (error) {
  console.error('Failed:', error);
  throw new Error(`Operation failed: ${error.message}`);
}

// ✅ NEW: QiCore functional pattern
const operationResult = await fromAsyncTryCatch(
  async () => {
    const result = await operation();
    this.logger.info('Operation succeeded', undefined, {
      component: 'ComponentName',
      resultType: typeof result,
    });
    return result;
  },
  (error) => systemError('Operation failed', {
    component: 'ComponentName',
    originalError: error instanceof Error ? error.message : String(error),
  })
);

return match(
  (value) => value,
  (error) => {
    this.logger.error('Operation failed', undefined, {
      component: 'ComponentName',
      error: error.message,
      errorContext: error.context,
    });
    throw error;
  },
  operationResult
);
```

## Best Practices Summary

1. **Always use QiCore logger** - Never use console.log directly
2. **Include structured metadata** - Every log entry needs component and context
3. **Use conditional debug logging** - Expensive logs only when needed
4. **Replace try/catch with Result<T>** - Use fromAsyncTryCatch and match
5. **Preserve error context** - Chain errors with proper context
6. **Configuration-driven behavior** - Let configuration control logging levels
7. **Performance awareness** - Avoid expensive operations in logging paths

## Troubleshooting

### Logger Not Working

Check logger initialization:

```typescript
// Add fallback logging to verify
const loggerResult = createLogger({ level: 'debug', pretty: true });
if (loggerResult.tag === 'failure') {
  console.error('QiCore logger failed, using fallback');
  // Use fallback logger
}
```

### Missing Metadata

Always include at least component name:

```typescript
// ❌ Missing metadata
this.logger.info('Something happened');

// ✅ Proper metadata
this.logger.info('Something happened', undefined, {
  component: 'MyComponent',
});
```

### Debug Logs Not Showing

Verify debug mode is enabled:

```bash
# Enable debug mode
bun run qi-prompt --debug

# Or via environment
QI_PROMPT_APP_DEBUG=true bun run qi-prompt
```

## Conclusion

QiCore integration in qi-prompt v-0.6.3 provides professional-grade logging and error handling. Follow these patterns consistently for maintainable, debuggable, and production-ready code.