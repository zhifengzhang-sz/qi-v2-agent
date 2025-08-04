# Complete @qi/base and @qi/core Tutorial

## Overview

This tutorial covers the complete usage of @qi/base (functional composition) and @qi/core (infrastructure tools) with real-world examples. Learn how to build robust applications using Result<T> patterns and proper functional composition.

## Part 1: @qi/base Fundamentals

### Core Concept: Result<T>

`Result<T, E>` is a discriminated union that represents either success or failure:

```typescript
import { Ok, Err, success, failure, type Result } from '@qi/base';

// Creating Results
const successResult = Ok(42);              // or success(42)
const failureResult = Err(new Error('Failed')); // or failure(error)

// Type: Result<number, Error>
```

### Basic Result Handling

#### Pattern Matching with `match()`
```typescript
import { match } from '@qi/base';

const result: Result<number, Error> = Ok(42);

const message = match(
  value => `Success: ${value}`,      // Handle success
  error => `Error: ${error.message}`, // Handle failure
  result
);

console.log(message); // "Success: 42"
```

#### Direct Access (when you know the result)
```typescript
if (result.tag === 'success') {
  console.log(result.value); // TypeScript knows this is number
} else {
  console.log(result.error); // TypeScript knows this is Error
}
```

### Functional Composition

#### `map()` - Transform Success Values
```typescript
import { map } from '@qi/base';

const doubled = map(
  x => x * 2,        // Only runs if success
  Ok(21)             // Result<number, Error>
);
// Result: Ok(42)

const failed = map(
  x => x * 2,
  Err(new Error('Failed'))
);
// Result: Err(Error('Failed')) - unchanged
```

#### `flatMap()` - Chain Operations That Can Fail
```typescript
import { flatMap } from '@qi/base';

const divide = (a: number, b: number): Result<number, Error> => {
  if (b === 0) return Err(new Error('Division by zero'));
  return Ok(a / b);
};

const result = flatMap(
  x => divide(x, 2),  // Function that returns Result<T>
  Ok(10)              // Input Result
);
// Result: Ok(5)

// Chain multiple operations
const complexCalc = flatMap(
  x => flatMap(
    y => divide(y, 2),  // 10 / 2 = 5
    divide(x, 1)        // 10 / 1 = 10
  ),
  Ok(10)
);
```

### Error Handling Patterns

#### Creating Typed Errors
```typescript
import { create, validationError, networkError } from '@qi/base';

// Specific error with context
const customError = create(
  'INVALID_CONFIG',                    // Error code
  'Configuration validation failed',   // Message
  'VALIDATION',                       // Category
  { field: 'port', value: -1 }       // Context
);

// Common error patterns
const validation = validationError('Email format invalid');
const network = networkError('Connection timeout');
```

#### Error Propagation in Chains
```typescript
const validateAge = (age: number): Result<number, QiError> => {
  if (age < 0) return failure(validationError('Age cannot be negative'));
  if (age > 150) return failure(validationError('Age too high'));
  return success(age);
};

const validateEmail = (email: string): Result<string, QiError> => {
  if (!email.includes('@')) return failure(validationError('Invalid email'));
  return success(email);
};

// Chain validations - stops at first failure
const validateUser = (age: number, email: string) => flatMap(
  validAge => flatMap(
    validEmail => success({ age: validAge, email: validEmail }),
    validateEmail(email)
  ),
  validateAge(age)
);

const user = validateUser(25, 'john@example.com');
// Result: Ok({ age: 25, email: 'john@example.com' })

const invalidUser = validateUser(-5, 'bad-email');
// Result: Err(validationError('Age cannot be negative'))
```

### Async Operations

#### `fromAsyncTryCatch()` - Convert Promise to Result
```typescript
import { fromAsyncTryCatch } from '@qi/base';

const fetchData = async (url: string): Promise<Result<any, QiError>> => {
  return fromAsyncTryCatch(
    async () => {
      const response = await fetch(url);
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    },
    error => networkError(`Failed to fetch ${url}: ${error.message}`)
  );
};

// Usage
const data = await fetchData('https://api.example.com/users');
match(
  users => console.log('Fetched', users.length, 'users'),
  error => console.error('Fetch failed:', error.message),
  data
);
```

## Part 2: @qi/core Infrastructure

### Logger

#### Basic Logger Setup
```typescript
import { createLogger } from '@qi/core';
import { match } from '@qi/base';

const loggerResult = createLogger({
  level: 'info',
  pretty: process.env.NODE_ENV === 'development',
  name: 'my-app'
});

match(
  logger => {
    // Logger always uses 2-argument API: (message, context)
    logger.info('Application starting', { version: '1.0.0' });
    logger.error('Something failed', { error: 'details', retryable: true });
  },
  error => {
    console.error('Logger creation failed:', error.message);
    process.exit(1);
  },
  loggerResult
);
```

#### Structured Logging with Context
```typescript
// Create scoped loggers for different operations
const logger = loggerResult.value;
const dbLogger = logger.child({ service: 'database' });
const apiLogger = logger.child({ service: 'api' });

// Use throughout application
const processUser = async (userId: string) => {
  const userLogger = logger.child({ 
    operation: 'processUser', 
    userId 
  });
  
  userLogger.info('Starting user processing', { timestamp: Date.now() });
  
  try {
    const user = await fetchUser(userId);
    userLogger.info('User fetched successfully', { 
      email: user.email,
      role: user.role 
    });
    return success(user);
  } catch (error) {
    userLogger.error('User processing failed', { 
      error: error.message,
      shouldRetry: error.retryable 
    });
    return failure(networkError(error.message));
  }
};
```

### Cache

#### Memory Cache
```typescript
import { createMemoryCache } from '@qi/core';

// Cache returns ICache directly (no Result wrapper)
const cache = createMemoryCache({
  maxSize: 1000,
  defaultTtl: 300  // 5 minutes
});

// Cache-aside pattern
const getCachedUser = async (userId: string): Promise<Result<User, QiError>> => {
  const cacheKey = `user:${userId}`;
  
  // Try cache first
  const cached = await cache.get(cacheKey);
  
  return match(
    user => {
      logger.info('Cache hit', { userId, cacheKey });
      return success(user);
    },
    async error => {
      logger.info('Cache miss, fetching from API', { userId, cacheKey });
      
      // Fetch from API
      const userResult = await fetchUser(userId);
      
      // Cache successful result
      match(
        user => {
          cache.set(cacheKey, user, 300);  // Cache for 5 minutes
          logger.info('User cached', { userId, ttl: 300 });
        },
        error => {
          logger.warn('User fetch failed, not caching', { userId, error: error.message });
        },
        userResult
      );
      
      return userResult;
    },
    cached
  );
};
```

### Configuration

#### Complete Configuration Workflow
```typescript
import { ConfigBuilder } from '@qi/core/config';
import { flatMap, match } from '@qi/base';
import { z } from 'zod';

// 1. Define schema for validation
const appConfigSchema = z.object({
  app: z.object({
    name: z.string(),
    port: z.number().default(3000),
    environment: z.enum(['development', 'production', 'test'])
  }),
  database: z.object({
    host: z.string(),
    port: z.number().default(5432),
    name: z.string(),
    ssl: z.boolean().default(false)
  }),
  redis: z.object({
    host: z.string().default('localhost'),
    port: z.number().default(6379)
  }).optional()
});

type AppConfig = z.infer<typeof appConfigSchema>;

// 2. Load and validate configuration
async function loadAppConfig(): Promise<Result<AppConfig, ConfigError>> {
  const builderResult = await ConfigBuilder.fromYamlFile('./config.yaml');
  
  return flatMap(
    builder => builder
      .merge(ConfigBuilder.fromEnv('APP_'))  // Environment overrides
      .validateWith(appConfigSchema)         // Schema validation
      .build(),                              // Get Result<Config>
    builderResult
  );
}

// 3. Use configuration throughout application
async function startApplication() {
  const configResult = await loadAppConfig();
  
  await match(
    async config => {
      // Create logger with config
      const loggerResult = createLogger({
        level: 'info',
        name: config.app.name,
        pretty: config.app.environment === 'development'
      });
      
      match(
        logger => {
          logger.info('Application starting', {
            name: config.app.name,
            port: config.app.port,
            environment: config.app.environment
          });
          
          // Start server, connect to database, etc.
          startServer(config, logger);
        },
        error => {
          console.error('Logger creation failed:', error.message);
          process.exit(1);
        },
        loggerResult
      );
    },
    error => {
      console.error('Configuration failed:', error.message);
      process.exit(1);
    },
    configResult
  );
}
```

## Part 3: Complete Application Example

### Real-World API Service

```typescript
import { createLogger, createMemoryCache } from '@qi/core';
import { ConfigBuilder } from '@qi/core/config';
import { flatMap, match, success, failure, fromAsyncTryCatch } from '@qi/base';
import { z } from 'zod';

// Types and schemas
const serviceConfigSchema = z.object({
  server: z.object({
    port: z.number().default(3000),
    host: z.string().default('localhost')
  }),
  database: z.object({
    url: z.string(),
    poolSize: z.number().default(10)
  }),
  cache: z.object({
    maxSize: z.number().default(1000),
    ttl: z.number().default(300)
  })
});

type ServiceConfig = z.infer<typeof serviceConfigSchema>;

interface User {
  id: string;
  email: string;
  name: string;
}

// Infrastructure setup
async function createInfrastructure(config: ServiceConfig) {
  const loggerResult = createLogger({
    level: 'info',
    name: 'user-service',
    pretty: process.env.NODE_ENV === 'development'
  });
  
  return match(
    logger => {
      const cache = createMemoryCache({
        maxSize: config.cache.maxSize,
        defaultTtl: config.cache.ttl
      });
      
      return success({ logger, cache, config });
    },
    error => failure(error),
    loggerResult
  );
}

// Business logic
class UserService {
  constructor(
    private logger: Logger,
    private cache: ICache,
    private config: ServiceConfig
  ) {}
  
  async getUser(userId: string): Promise<Result<User, QiError>> {
    const opLogger = this.logger.child({ 
      operation: 'getUser', 
      userId 
    });
    
    const cacheKey = `user:${userId}`;
    
    // Try cache first
    const cached = await this.cache.get(cacheKey);
    
    return match(
      user => {
        opLogger.info('Cache hit', { cacheKey });
        return success(user);
      },
      async error => {
        opLogger.info('Cache miss, fetching from database', { cacheKey });
        
        // Fetch from database
        const userResult = await this.fetchUserFromDb(userId);
        
        // Cache successful result
        match(
          user => {
            this.cache.set(cacheKey, user);
            opLogger.info('User cached', { userId });
          },
          error => {
            opLogger.warn('Database fetch failed', { 
              userId, 
              error: error.message 
            });
          },
          userResult
        );
        
        return userResult;
      },
      cached
    );
  }
  
  private async fetchUserFromDb(userId: string): Promise<Result<User, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        // Simulate database call
        const response = await fetch(`${this.config.database.url}/users/${userId}`);
        if (!response.ok) {
          throw new Error(`User not found: ${userId}`);
        }
        return response.json();
      },
      error => networkError(`Database fetch failed: ${error.message}`)
    );
  }
}

// Application assembly
async function createApplication(): Promise<Result<UserService, QiError>> {
  // Load configuration
  const builderResult = await ConfigBuilder.fromYamlFile('./service-config.yaml');
  
  const configResult = flatMap(
    builder => builder
      .merge(ConfigBuilder.fromEnv('SERVICE_'))
      .validateWith(serviceConfigSchema)
      .build(),
    builderResult
  );
  
  // Create infrastructure
  return flatMap(
    async config => {
      const infraResult = await createInfrastructure(config);
      
      return match(
        ({ logger, cache }) => {
          const userService = new UserService(logger, cache, config);
          logger.info('User service created successfully', {
            cacheSize: config.cache.maxSize,
            dbUrl: config.database.url
          });
          return success(userService);
        },
        error => failure(error),
        infraResult
      );
    },
    configResult
  );
}

// Main application
async function main() {
  const appResult = await createApplication();
  
  match(
    async userService => {
      // Start HTTP server
      const server = createServer(userService);
      server.listen(3000, () => {
        console.log('✓ User service running on port 3000');
      });
    },
    error => {
      console.error('❌ Application startup failed:', error.message);
      process.exit(1);
    },
    appResult
  );
}

main().catch(console.error);
```

## Best Practices Summary

### @qi/base Patterns
1. **Always use functional composition** - `flatMap`, `map`, `match`
2. **Never manual Result unwrapping** - Avoid `result.tag === 'success'` 
3. **Create typed errors** - Use `create()` with specific codes and context
4. **Chain operations** - Build pipelines that handle errors automatically

### @qi/core Integration
1. **Logger: 2-argument API** - `logger.info(message, context)`
2. **Cache: Direct usage** - No Result wrapper, use cache-aside patterns
3. **Config: Two-phase approach** - Fluent building → Functional composition
4. **Infrastructure: Result-based** - All setup returns `Result<T>`

### Application Architecture
1. **Functional core** - Business logic uses pure functional composition
2. **Infrastructure shell** - Logger, cache, config provide capabilities
3. **Error boundaries** - Handle failures at appropriate levels
4. **Type safety** - Leverage TypeScript throughout chains

This tutorial covers complete real-world usage of both libraries. The key is understanding that **@qi/base provides the functional foundation** while **@qi/core provides practical infrastructure tools** that integrate seamlessly with functional patterns.