# QiCore Framework Knowledge Base

## Overview

QiCore Foundation is a TypeScript framework providing mathematical foundation types and infrastructure services for reliable application development. Version 0.8.1 implements selective integration with two main modules:

- **qi/base**: Functional foundation with Result<T> and QiError types
- **qi/core**: Infrastructure tools (Config, Logger, Cache) built on Result<T> patterns

## qi/base Module - Functional Foundation

### Result<T> Type System

The core of QiCore is the `Result<T, E>` discriminated union:

```typescript
type Result<T, E> = 
  | { tag: 'success', value: T }
  | { tag: 'failure', error: E }
```

**Key Functions:**
- `success(value)` / `Ok(value)` - Create successful Result
- `failure(error)` / `Err(error)` - Create failed Result  
- `map(fn, result)` - Transform success values
- `flatMap(fn, result)` - Chain operations that can fail
- `match(onSuccess, onFailure, result)` - Pattern matching

**Factory Functions:**
- `fromTryCatch(operation, errorHandler?)` - Convert exceptions to Results
- `fromAsyncTryCatch(operation, errorHandler?)` - Async exception handling
- `fromMaybe(value, errorIfNull)` - Convert nullable values

### QiError Type System

Structured error handling with categories and retry strategies:

**Error Categories:**
- `VALIDATION` - Input validation failures (never retry)
- `NETWORK` - Network issues (retry with backoff)
- `BUSINESS` - Business rule violations (never retry)
- `AUTHENTICATION` - Login failures (never retry)
- `AUTHORIZATION` - Permission denied (never retry)  
- `SYSTEM` - Infrastructure failures (limited retry)

**Factory Functions:**
- `validationError(message)` - Input validation errors
- `networkError(message)` - Network connectivity issues
- `businessError(message)` - Business logic violations
- `systemError(message)` - Infrastructure problems

### Functional Composition Patterns

**Error Propagation:**
```typescript
const result = flatMap(
  validData => flatMap(
    processedData => success(processedData.result),
    processData(validData)
  ),
  validateInput(rawInput)
);
```

**Pattern Matching:**
```typescript
match(
  value => console.log('Success:', value),
  error => console.error('Failed:', error.message),
  result
);
```

## qi/core Module - Infrastructure Services

### Config Service

Multi-source configuration management with validation:

**ConfigBuilder Pattern:**
```typescript
const configResult = ConfigBuilder
  .fromYamlFile('./config.yaml')        // Base configuration
  .merge(ConfigBuilder.fromEnv('APP_'))  // Environment overrides
  .validateWith(schema)                  // Zod schema validation
  .build();                              // Returns Result<Config>
```

**Supported Sources:**
- YAML/JSON/TOML files
- Environment variables (PREFIX_SECTION_KEY → section.key)
- JavaScript objects
- Remote APIs and databases

**Features:**
- Left-to-right precedence (later overrides earlier)
- Zod schema validation and type inference
- Two-phase architecture: fluent building + functional composition

### Logger Service  

Structured logging with context accumulation:

**Basic Usage:**
```typescript
const loggerResult = createLogger({
  level: 'info',
  name: 'my-app',
  pretty: process.env.NODE_ENV === 'development'
});

match(
  logger => {
    logger.info('User action', { userId: '123', action: 'login' });
    logger.error('Database error', error, { query: 'SELECT users' });
  },
  error => console.error('Logger creation failed:', error.message),
  loggerResult
);
```

**Context Management:**
```typescript
const requestLogger = logger.child({ requestId: 'req_123' });
const operationLogger = requestLogger.child({ operation: 'validation' });
```

**Features:**
- Structured JSON logging with pino backend
- Context inheritance and accumulation
- Log levels: trace, debug, info, warn, error, fatal
- Environment-aware configurations
- Result<T> integration for consistent error logging

### Cache Service

Performance optimization with memory and Redis backends:

**Memory Cache:**
```typescript
const cache = createMemoryCache({
  maxSize: 1000,
  defaultTtl: 300  // 5 minutes
});
```

**Redis Cache:**
```typescript
const cacheResult = await createRedisCache({
  redis: {
    host: 'localhost',
    port: 6379
  }
});
```

**Cache-Aside Pattern:**
```typescript
async function getCachedUser(userId: string): Promise<Result<User, QiError>> {
  const cached = await cache.get(`user:${userId}`);
  
  return match(
    user => success(user),  // Cache hit
    async error => {        // Cache miss
      const user = await fetchUserFromDB(userId);
      await cache.set(`user:${userId}`, user, 300);
      return success(user);
    },
    cached
  );
}
```

**Features:**
- ICache interface for pluggable backends
- Built-in performance statistics (hits, misses, size)
- Batch operations: mget, mset, mdelete
- TTL support with automatic cleanup
- Graceful degradation on cache failures

## Architecture Principles

### Two-Phase Design

1. **Fluent Phase**: Build complex objects with fluent APIs
2. **Functional Phase**: Compose operations with Result<T> error handling

### Pure Functional Error Handling

- No exceptions - all errors explicit in function signatures
- Composable error handling - failures propagate automatically
- Type-safe - TypeScript ensures correctness at compile time
- Contract-driven - functions follow mathematical behavioral laws

### Integration Patterns

All services use consistent Result<T> patterns:

```typescript
// Config → Logger → Cache integration
match(
  config => {
    const loggerResult = createLogger({
      level: config.logging.level,
      name: config.app.name
    });
    
    match(
      logger => {
        const cache = createMemoryCache({
          maxSize: config.cache.maxSize
        });
        
        startApplication(config, logger, cache);
      },
      error => handleLoggerError(error),
      loggerResult
    );
  },
  error => handleConfigError(error),
  configResult
);
```

## Best Practices

### Functional Composition
- Always use functional composition: flatMap, map, match
- Never manual Result unwrapping: avoid `result.tag === 'success'`
- Create typed errors with specific codes and context
- Chain operations to build error-safe pipelines

### Error Handling
- Use appropriate error categories for retry strategies
- Include context in errors for better debugging
- Log errors with structured data
- Handle failures at appropriate architectural boundaries

### Service Integration
- Configure services from centralized config
- Use structured logging throughout
- Implement cache-aside patterns for performance
- Maintain type safety across all operations

## Implementation Details

**File Structure:**
```
../qi-v2-qicore/typescript/
├── lib/src/
│   ├── base/          # qi/base module
│   │   ├── result.ts  # Result<T> implementation
│   │   └── error.ts   # QiError system
│   ├── core/          # qi/core module
│   │   ├── config.ts  # Configuration management
│   │   ├── logger.ts  # Structured logging
│   │   └── cache.ts   # Performance caching
│   └── index.ts       # Main exports
├── docs/tutorial/     # Complete documentation
└── app/              # Working examples
```

**Key Dependencies:**
- Zod for schema validation and type inference
- Pino for structured JSON logging
- ioredis for Redis connectivity
- YAML parser for configuration files

This knowledge base provides comprehensive coverage of QiCore's functional foundation and infrastructure services, enabling reliable TypeScript application development with explicit error handling and consistent patterns.