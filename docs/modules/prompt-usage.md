# Prompt Module Usage Guide

The prompt module provides professional LLM interaction with advanced features including template management, context continuation, rate limiting, and robust error handling using qicore Result<T> patterns.

## Overview

The prompt module implements a **two-layer architecture**:

- **Professional Layer**: QiCorePromptManager with Result<T> patterns
- **User-Friendly Layer**: Simple Promise-based API hiding complexity

### Key Features

- **Template Management**: Dynamic prompt templates with variable substitution
- **Context Continuation**: Stateful conversation management
- **Rate Limiting**: Built-in request throttling and retry logic
- **Model Routing**: Support for multiple LLM providers (Ollama, OpenAI, etc.)
- **Professional Error Handling**: qicore Result<T> patterns with graceful fallbacks

## Quick Start

### Basic Prompting

```typescript
import { DefaultPromptHandler } from '@qi/prompt';

// Create prompt handler
const promptHandler = new DefaultPromptHandler();

// Initialize with configuration
await promptHandler.initialize('config/llm.yaml', 'config/schema/llm.yaml');

// Send basic prompt
const response = await promptHandler.sendPrompt('Explain recursion in simple terms');
console.log(response.content); // LLM response
console.log(response.metadata.tokens); // Token usage
```

### With Context

```typescript
// Create request with context
const request = {
  prompt: 'What did we discuss about recursion yesterday?',
  context: {
    sessionId: 'user-session-123',
    conversationId: 'convo-456',
    previousInputs: ['Explain recursion'],
    timestamp: new Date()
  }
};

const response = await promptHandler.sendPromptWithContext(request);
```

## Configuration

### YAML Configuration

**config/llm.yaml:**
```yaml
llm:
  # Model Configuration
  model:
    provider: ollama
    modelId: qwen2.5:7b
    baseUrl: http://localhost:11434
    
  # Generation Parameters
  generation:
    temperature: 0.7
    maxTokens: 2000
    topP: 0.9
    
  # Rate Limiting
  rateLimiting:
    enabled: true
    requestsPerMinute: 60
    burstLimit: 10
    retryConfig:
      maxRetries: 3
      baseDelay: 1000
      maxDelay: 10000
      
  # Context Management
  context:
    maxHistorySize: 20
    contextWindow: 8192
    summaryThreshold: 0.8
    
  # Templates
  templates:
    system: "You are a helpful AI assistant specialized in coding tasks."
    user: "{{prompt}}"
    continuation: "Previous context:\n{{context}}\n\nCurrent request: {{prompt}}"
```

**config/schema/llm.yaml:**
```yaml
type: object
properties:
  llm:
    type: object
    properties:
      model:
        type: object
        properties:
          provider: 
            type: string
            enum: [ollama, openai, groq]
          modelId:
            type: string
          baseUrl:
            type: string
        required: [provider, modelId]
      generation:
        type: object
        properties:
          temperature:
            type: number
            minimum: 0
            maximum: 2
          maxTokens:
            type: integer
            minimum: 1
        required: [temperature, maxTokens]
    required: [model, generation]
required: [llm]
```

### Programmatic Configuration

```typescript
// Direct configuration
const promptHandler = new DefaultPromptHandler();

const config = {
  llm: {
    model: {
      provider: 'ollama',
      modelId: 'qwen2.5:7b',
      baseUrl: 'http://localhost:11434'
    },
    generation: {
      temperature: 0.7,
      maxTokens: 2000
    },
    rateLimiting: {
      enabled: true,
      requestsPerMinute: 60
    }
  }
};

await promptHandler.initializeWithConfig(config);
```

### State Manager Integration

```typescript
import { StateManager } from '@qi/state';

// Get LLM config from state manager
const stateManager = new StateManager();
const llmConfig = stateManager.getLLMConfigForPromptModule();

// Initialize with state manager configuration
await promptHandler.initializeWithConfig(llmConfig);
```

## Template Management

### Dynamic Templates

```typescript
// Register custom templates
await promptHandler.registerTemplate('code-review', {
  system: 'You are an expert code reviewer.',
  user: 'Review this {{language}} code:\n\n```{{language}}\n{{code}}\n```\n\nFocus on: {{aspects}}',
  variables: ['language', 'code', 'aspects']
});

// Use template with variables
const response = await promptHandler.sendPromptWithTemplate('code-review', {
  language: 'typescript',
  code: 'function add(a: number, b: number) { return a + b; }',
  aspects: 'type safety, performance, readability'
});
```

### Template Inheritance

```typescript
// Base template
await promptHandler.registerTemplate('base-assistant', {
  system: 'You are a helpful AI assistant.',
  user: '{{prompt}}'
});

// Extended template
await promptHandler.registerTemplate('code-assistant', {
  extends: 'base-assistant',
  system: 'You are a helpful AI assistant specialized in programming.',
  user: 'Programming question: {{prompt}}\n\nProvide code examples where appropriate.'
});
```

### Conditional Templates

```typescript
// Template with conditions
await promptHandler.registerTemplate('adaptive-response', {
  system: 'You are an AI assistant.',
  user: `
    {{#if isComplexQuery}}
    This is a complex query requiring detailed analysis:
    {{/if}}
    {{prompt}}
    {{#if needsExamples}}
    Please provide practical examples.
    {{/if}}
  `,
  conditions: {
    isComplexQuery: (context) => context.prompt.length > 100,
    needsExamples: (context) => context.includeExamples === true
  }
});
```

## Context Continuation

### Conversation Management

```typescript
// Start new conversation
const conversation = await promptHandler.startConversation('user-123');

// Send messages with automatic context
const response1 = await promptHandler.sendPromptWithConversation(
  conversation.id,
  'Explain the factory pattern in TypeScript'
);

const response2 = await promptHandler.sendPromptWithConversation(
  conversation.id,
  'Show me a practical example' // Automatically includes previous context
);

// Get conversation history
const history = await promptHandler.getConversationHistory(conversation.id);
console.log(history.messages); // All messages in conversation
```

### Smart Context Summarization

```typescript
// Configure automatic summarization
const promptHandler = new DefaultPromptHandler();
await promptHandler.initialize('config/llm.yaml', 'config/schema/llm.yaml');

// Long conversation - automatically summarizes when context limit reached
for (let i = 0; i < 50; i++) {
  const response = await promptHandler.sendPromptWithConversation(
    'long-conversation',
    `Question ${i + 1}: What is ${i + 1} + ${i + 1}?`
  );
  // Context automatically managed and summarized
}
```

### Context Strategies

```typescript
// Different context strategies
const strategies = {
  // Keep all messages
  full: await promptHandler.sendPromptWithContext({
    prompt: 'Continue our discussion',
    context: { strategy: 'full', maxMessages: -1 }
  }),
  
  // Keep recent messages only
  recent: await promptHandler.sendPromptWithContext({
    prompt: 'Continue our discussion', 
    context: { strategy: 'recent', maxMessages: 5 }
  }),
  
  // Summarize old, keep recent
  hybrid: await promptHandler.sendPromptWithContext({
    prompt: 'Continue our discussion',
    context: { strategy: 'hybrid', summaryThreshold: 10, recentCount: 3 }
  })
};
```

## Rate Limiting

### Basic Rate Limiting

```typescript
// Configure rate limits
const config = {
  llm: {
    rateLimiting: {
      enabled: true,
      requestsPerMinute: 30,    // 30 requests per minute
      burstLimit: 5,            // Allow 5 requests in quick succession
      retryConfig: {
        maxRetries: 3,
        baseDelay: 1000,        // Start with 1 second delay
        maxDelay: 10000,        // Max 10 second delay
        backoffMultiplier: 2    // Exponential backoff
      }
    }
  }
};

await promptHandler.initializeWithConfig(config);

// Requests are automatically rate limited
const responses = await Promise.all([
  promptHandler.sendPrompt('Question 1'),
  promptHandler.sendPrompt('Question 2'),
  promptHandler.sendPrompt('Question 3'),
  // Will be queued and sent respecting rate limits
]);
```

### Priority Queues

```typescript
// High priority request
const urgentResponse = await promptHandler.sendPrompt('Critical system issue!', {
  priority: 'high'
});

// Normal priority (default)
const normalResponse = await promptHandler.sendPrompt('Regular question');

// Low priority (background processing)
const backgroundResponse = await promptHandler.sendPrompt('Generate docs', {
  priority: 'low'
});
```

### Rate Limit Monitoring

```typescript
// Check current rate limit status
const status = await promptHandler.getRateLimitStatus();
console.log('Remaining requests:', status.remaining);
console.log('Reset time:', status.resetTime);
console.log('Current window:', status.windowStart);

// Handle rate limit events
promptHandler.on('rateLimitHit', (event) => {
  console.log(`Rate limit hit. Retry after: ${event.retryAfter}ms`);
});

promptHandler.on('rateLimitReset', (event) => {
  console.log('Rate limit window reset');
});
```

## Model Routing

### Multiple Providers

```typescript
// Configure multiple models
const config = {
  llm: {
    models: [
      {
        id: 'primary',
        provider: 'ollama',
        modelId: 'qwen2.5:7b',
        baseUrl: 'http://localhost:11434',
        priority: 1
      },
      {
        id: 'fallback',
        provider: 'groq',
        modelId: 'llama2-70b-4096',
        apiKey: process.env.GROQ_API_KEY,
        priority: 2
      }
    ],
    routing: {
      strategy: 'failover',  // Try primary, fallback to secondary
      healthCheckInterval: 30000
    }
  }
};

await promptHandler.initializeWithConfig(config);

// Automatically routes to available model
const response = await promptHandler.sendPrompt('Hello');
```

### Load Balancing

```typescript
// Round-robin between models
const config = {
  llm: {
    models: [
      { id: 'model1', provider: 'ollama', modelId: 'qwen2.5:7b' },
      { id: 'model2', provider: 'ollama', modelId: 'llama2:7b' }
    ],
    routing: {
      strategy: 'round-robin',
      weights: { model1: 0.7, model2: 0.3 } // 70/30 split
    }
  }
};
```

### Model-Specific Routing

```typescript
// Route based on request type
const response = await promptHandler.sendPrompt('Write a poem', {
  preferredModel: 'creative-model'
});

const codeResponse = await promptHandler.sendPrompt('Review this code', {
  preferredModel: 'code-model'
});
```

## Error Handling

### Professional Error Handling

```typescript
// The prompt module uses qicore Result<T> patterns internally
try {
  const response = await promptHandler.sendPrompt('Test prompt');
  console.log(response.content);
} catch (error) {
  if (error.code === 'RATE_LIMIT_EXCEEDED') {
    console.log('Rate limited. Retry after:', error.retryAfter);
  } else if (error.code === 'MODEL_UNAVAILABLE') {
    console.log('Model not available:', error.modelId);
  } else {
    console.log('Unexpected error:', error.message);
  }
}
```

### Graceful Degradation

```typescript
// Automatic fallback to available models
const response = await promptHandler.sendPrompt('Hello', {
  fallbackStrategy: 'any-available',
  maxRetries: 3
});

// Will try all configured models before failing
```

### Error Recovery

```typescript
// Custom error recovery
promptHandler.on('modelError', async (error, context) => {
  console.log(`Model ${error.modelId} failed:`, error.message);
  
  if (error.code === 'CONTEXT_LENGTH_EXCEEDED') {
    // Automatically truncate context and retry
    const truncatedContext = await promptHandler.truncateContext(context);
    return await promptHandler.retryWithContext(truncatedContext);
  }
});
```

## Streaming Responses

### Real-Time Streaming

```typescript
// Stream response in real-time
const stream = await promptHandler.sendPromptStream('Write a long story');

for await (const chunk of stream) {
  process.stdout.write(chunk.content);
  
  if (chunk.metadata) {
    console.log('\nTokens used:', chunk.metadata.tokens);
  }
}
```

### Streaming with Context

```typescript
// Stream with conversation context
const conversationStream = await promptHandler.sendPromptStreamWithConversation(
  'convo-123',
  'Continue the story'
);

for await (const chunk of conversationStream) {
  // Handle streaming chunks
  if (chunk.type === 'content') {
    updateUI(chunk.content);
  } else if (chunk.type === 'metadata') {
    updateStats(chunk.metadata);
  }
}
```

## Advanced Features

### Prompt Caching

```typescript
// Enable response caching
const config = {
  llm: {
    caching: {
      enabled: true,
      ttl: 3600000,        // 1 hour cache
      maxSize: 1000,       // Max 1000 cached responses
      keyStrategy: 'hash'  // Cache key based on prompt hash
    }
  }
};

// Subsequent identical prompts will use cached responses
const response1 = await promptHandler.sendPrompt('What is TypeScript?');
const response2 = await promptHandler.sendPrompt('What is TypeScript?'); // From cache
```

### Prompt Analytics

```typescript
// Get detailed analytics
const analytics = await promptHandler.getAnalytics();

console.log('Total prompts:', analytics.totalPrompts);
console.log('Average response time:', analytics.averageResponseTime);
console.log('Token usage:', analytics.tokenUsage);
console.log('Model usage distribution:', analytics.modelUsage);
console.log('Error rate:', analytics.errorRate);
```

### A/B Testing

```typescript
// A/B test different prompts
const testConfig = {
  experimentId: 'prompt-optimization-v1',
  variants: [
    { 
      id: 'control',
      template: 'standard-prompt',
      weight: 0.5
    },
    { 
      id: 'treatment',
      template: 'enhanced-prompt',
      weight: 0.5
    }
  ]
};

const response = await promptHandler.sendPromptWithExperiment(
  'Explain machine learning',
  testConfig
);

// Track results
await promptHandler.trackExperimentResult(testConfig.experimentId, {
  variant: response.metadata.variant,
  responseTime: response.metadata.responseTime,
  userSatisfaction: 4.5
});
```

## Integration Examples

### CLI Application

```typescript
import { DefaultPromptHandler } from '@qi/prompt';
import readline from 'readline';

const promptHandler = new DefaultPromptHandler();
await promptHandler.initialize('config/llm.yaml', 'config/schema/llm.yaml');

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

const conversationId = await promptHandler.startConversation('cli-user');

while (true) {
  const userInput = await new Promise(resolve => 
    rl.question('You: ', resolve)
  );
  
  if (userInput === 'exit') break;
  
  try {
    const response = await promptHandler.sendPromptWithConversation(
      conversationId.id,
      userInput
    );
    
    console.log('AI:', response.content);
  } catch (error) {
    console.log('Error:', error.message);
  }
}
```

### Web API

```typescript
import express from 'express';
import { DefaultPromptHandler } from '@qi/prompt';

const app = express();
const promptHandler = new DefaultPromptHandler();

await promptHandler.initialize('config/llm.yaml', 'config/schema/llm.yaml');

app.post('/chat', async (req, res) => {
  try {
    const { message, sessionId } = req.body;
    
    const response = await promptHandler.sendPromptWithContext({
      prompt: message,
      context: { sessionId }
    });
    
    res.json({
      response: response.content,
      metadata: {
        tokens: response.metadata.tokens,
        responseTime: response.metadata.responseTime
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.listen(3000);
```

### Agent Integration

```typescript
import { DefaultPromptHandler } from '@qi/prompt';
import { StateManager } from '@qi/state';

class Agent {
  private promptHandler: DefaultPromptHandler;
  
  constructor() {
    this.promptHandler = new DefaultPromptHandler();
  }
  
  async initialize() {
    const stateManager = new StateManager();
    const config = stateManager.getLLMConfigForPromptModule();
    await this.promptHandler.initializeWithConfig(config);
  }
  
  async processRequest(input: string, context: any) {
    return await this.promptHandler.sendPromptWithContext({
      prompt: input,
      context: {
        sessionId: context.sessionId,
        conversationId: context.conversationId,
        previousInputs: context.history
      }
    });
  }
}
```

## Best Practices

### 1. Configuration Management
- **Use YAML files for environment-specific settings**
- **Leverage state manager for centralized configuration**
- **Validate configuration schemas to prevent runtime errors**

### 2. Context Management
- **Use conversation management for multi-turn interactions**
- **Implement smart context summarization for long conversations**
- **Choose appropriate context strategies based on use case**

### 3. Rate Limiting
- **Configure appropriate limits based on provider quotas**
- **Implement priority queues for different request types**
- **Monitor rate limit status and handle gracefully**

### 4. Error Handling
- **Always handle LLM service failures gracefully**
- **Implement proper fallback strategies**
- **Use the built-in retry mechanisms with exponential backoff**

### 5. Performance Optimization
- **Enable caching for repeated prompts**
- **Use streaming for long responses**
- **Monitor token usage and response times**

## Troubleshooting

### Common Issues

1. **Model Connection Failures**
   ```typescript
   // Check model availability
   const status = await promptHandler.checkModelHealth();
   console.log('Model status:', status);
   ```

2. **Context Length Exceeded**
   ```typescript
   // Enable automatic context truncation
   const config = {
     llm: {
       context: {
         autoTruncate: true,
         maxContextLength: 4096
       }
     }
   };
   ```

3. **Rate Limit Issues**
   ```typescript
   // Monitor rate limits
   const status = await promptHandler.getRateLimitStatus();
   if (status.remaining < 5) {
     console.log('Approaching rate limit');
   }
   ```

The prompt module provides enterprise-grade LLM interaction with professional error handling, flexible configuration, and advanced features suitable for production applications.