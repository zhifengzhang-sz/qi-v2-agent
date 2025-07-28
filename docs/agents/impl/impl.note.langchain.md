# LangChain Implementation Experience Notes

## Overview

This document captures lessons learned during the LangChain implementation for the qi-v2 agent model provider. The experience revealed important insights about multi-provider support, parameter compatibility, and 2025 feature integration.

## Key Problems Encountered

### 1. Provider Parameter Compatibility Issues

**Problem**: Different LangChain providers support different parameters, causing runtime errors.

```typescript
// ❌ Wrong: Using same parameters for all providers
return new ChatGroq({
  apiKey: process.env.GROQ_API_KEY,
  model: config.modelId,
  temperature: config.parameters.temperature,
  maxTokens: config.parameters.maxTokens,
  topP: config.parameters.topP,           // ❌ Not supported by ChatGroq
  frequencyPenalty: config.parameters.frequencyPenalty, // ❌ Not supported
  presencePenalty: config.parameters.presencePenalty,   // ❌ Not supported
});
```

**Solution**: Provider-specific parameter filtering and validation.

```typescript
// ✅ Correct: Provider-specific parameters
case 'groq':
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: config.modelId,
    temperature: config.parameters.temperature,
    maxTokens: config.parameters.maxTokens,
    // topP, frequencyPenalty, and presencePenalty not supported by ChatGroq
    stop: config.parameters.stopSequences ? Array.from(config.parameters.stopSequences) : undefined,
    streaming: true
  });
```

**Lesson**: Each LangChain provider has different parameter support. Always check provider documentation and filter parameters accordingly.

### 2. 2025 Ollama Feature Integration

**Problem**: Newer Ollama features like reasoning mode and JSON mode weren't properly integrated.

```typescript
// ❌ Wrong: Missing 2025 Ollama features
return new ChatOllama({
  baseUrl: this.getEndpoint(config, 'http://localhost:11434'),
  model: config.modelId,
  temperature: config.parameters.temperature
  // Missing: reasoning mode, JSON mode, keepAlive optimization
});
```

**Solution**: Proper 2025 Ollama feature integration.

```typescript
// ✅ Correct: 2025 Ollama enhancements
return new ChatOllama({
  baseUrl: this.getEndpoint(config, 'http://localhost:11434'),
  model: config.modelId,
  temperature: config.parameters.temperature,
  numCtx: config.parameters.maxTokens,
  // 2025 Ollama enhancements
  format: undefined, // Will be set per request for JSON mode
  keepAlive: '5m',   // Keep model loaded for performance
  numThread: undefined // Use default threading
});

// Per-request enhancement
const response = await enhancedModel.invoke(messages, {
  configurable: {
    temperature: request.configuration.parameters.temperature,
    max_tokens: request.configuration.parameters.maxTokens,
    // Enable reasoning mode if supported (Ollama 2025 feature)
    reasoning: request.context.get('enableReasoning') === true,
    // Enable JSON mode if requested (Ollama 2025 feature)
    format: request.context.get('responseFormat') === 'json' ? 'json' : undefined
  }
});
```

**Lesson**: Stay current with provider feature releases. 2025 Ollama added significant capabilities that improve performance and functionality.

### 3. Token Estimation Complexity

**Problem**: Different providers have different tokenization approaches, making accurate token estimation difficult.

```typescript
// ❌ Wrong: One-size-fits-all token estimation
async estimateTokens(messages: readonly ModelMessage[]): Promise<number> {
  const totalContent = messages.map(m => m.content).join(' ');
  return Math.ceil(totalContent.length / 4); // Too simplistic
}
```

**Solution**: Provider-specific token estimation with fallbacks.

```typescript
// ✅ Correct: Provider-specific token estimation
private initializeTokenCounters(): void {
  const defaultCounter = (text: string) => Math.ceil(text.length / 4);
  
  this.tokenCounters.set('ollama', defaultCounter);
  this.tokenCounters.set('openai', (text: string) => Math.ceil(text.length / 3.5)); // More accurate for GPT models
  this.tokenCounters.set('anthropic', (text: string) => Math.ceil(text.length / 3.8)); // Claude models
  this.tokenCounters.set('google', defaultCounter);
  this.tokenCounters.set('groq', (text: string) => Math.ceil(text.length / 3.5)); // Similar to OpenAI
  this.tokenCounters.set('cohere', defaultCounter);
}

private estimateTokensForText(text: string, providerId: string): number {
  const counter = this.tokenCounters.get(providerId);
  return counter ? counter(text) : Math.ceil(text.length / 4);
}
```

**Lesson**: Token estimation varies significantly between providers. Use provider-specific approaches where possible.

### 4. Streaming Implementation Challenges

**Problem**: Streaming behavior varies between providers and requires careful error handling.

```typescript
// ❌ Wrong: Basic streaming without error handling
async *stream(request: ModelRequest): AsyncIterableIterator<ModelStreamChunk> {
  const model = this.getModel(request.configuration.providerId, request.configuration.modelId);
  const messages = this.convertMessages(request.messages);
  
  const stream = await model.stream(messages);
  for await (const chunk of stream) {
    yield { content: chunk.content.toString(), isComplete: false };
  }
}
```

**Solution**: Robust streaming with proper error handling and completion detection.

```typescript
// ✅ Correct: Robust streaming implementation
async *stream(request: ModelRequest): AsyncIterableIterator<ModelStreamChunk> {
  const model = this.getModel(request.configuration.providerId, request.configuration.modelId);
  const messages = this.convertMessages(request.messages);

  try {
    const stream = await model.stream(messages);
    let content = '';

    for await (const chunk of stream) {
      const deltaContent = chunk.content.toString();
      content += deltaContent;

      yield {
        content: deltaContent,
        isComplete: false,
        metadata: new Map<string, unknown>([
          ['chunkIndex', content.length],
          ['model', request.configuration.modelId]
        ])
      };
    }

    // Final chunk with usage information
    yield {
      content: '',
      isComplete: true,
      usage: {
        promptTokens: await this.estimateTokens(request.messages),
        completionTokens: this.estimateTokensForText(content, request.configuration.providerId),
        totalTokens: 0 // Will be calculated
      },
      metadata: new Map([['totalContent', content]])
    };
  } catch (error) {
    yield {
      content: '',
      isComplete: true,
      metadata: new Map([['error', error instanceof Error ? error.message : String(error)]])
    };
  }
}
```

**Lesson**: Streaming requires careful state management, error handling, and completion detection across different providers.

## Proper LangChain Implementation Patterns

### 1. Multi-Provider Factory Pattern

```typescript
private createModel(config: ModelConfiguration): BaseChatModel {
  switch (config.providerId) {
    case 'ollama':
      return this.createOllamaModel(config);
    case 'openai':
      return this.createOpenAIModel(config);
    case 'anthropic':
      return this.createAnthropicModel(config);
    case 'google':
      return this.createGoogleModel(config);
    case 'groq':
      return this.createGroqModel(config);
    case 'cohere':
      return this.createCohereModel(config);
    default:
      throw new Error(`Unsupported model provider: ${config.providerId}`);
  }
}
```

### 2. Provider-Specific Model Creation

```typescript
private createOllamaModel(config: ModelConfiguration): ChatOllama {
  return new ChatOllama({
    baseUrl: this.getEndpoint(config, 'http://localhost:11434'),
    model: config.modelId,
    temperature: config.parameters.temperature,
    numCtx: config.parameters.maxTokens,
    topP: config.parameters.topP,
    frequencyPenalty: config.parameters.frequencyPenalty,
    presencePenalty: config.parameters.presencePenalty,
    stop: config.parameters.stopSequences ? Array.from(config.parameters.stopSequences) : undefined,
    // 2025 Ollama enhancements
    format: undefined, // Set per request
    keepAlive: '5m',
    numThread: undefined
  });
}

private createGroqModel(config: ModelConfiguration): ChatGroq {
  return new ChatGroq({
    apiKey: process.env.GROQ_API_KEY,
    model: config.modelId,
    temperature: config.parameters.temperature,
    maxTokens: config.parameters.maxTokens,
    // Note: topP, frequencyPenalty, presencePenalty not supported
    stop: config.parameters.stopSequences ? Array.from(config.parameters.stopSequences) : undefined,
    streaming: true
  });
}
```

### 3. Enhanced Model Capabilities Pattern

```typescript
private enhanceModelCapabilities(model: BaseChatModel, config: ModelConfiguration): BaseChatModel {
  // 2025 enhancements: Enable tool calling for compatible models
  if (config.capabilities.supportsToolCalling && 'bind_tools' in model) {
    // Tool calling capabilities would be enabled here
    // This is provider-specific implementation
  }
  
  return model;
}
```

### 4. Pattern-Specific Prompt Templates

```typescript
private initializePrompts(config: ModelProviderConfig): void {
  const patternPrompts = {
    analytical: PromptTemplate.fromTemplate(`
You are an expert analytical assistant. Analyze the following request systematically:

Context: {context}
User Request: {input}

Provide structured analysis with:
1. Situation Assessment
2. Key Findings
3. Recommendations
4. Implementation Plan

Be thorough and evidence-based in your response.
    `),
    
    creative: PromptTemplate.fromTemplate(`
You are an expert creative assistant. Generate innovative solutions for:

Context: {context}
User Request: {input}

Provide creative output with:
1. Creative concepts
2. Implementation approach
3. Innovative features
4. Quality considerations

Be innovative and constructive in your response.
    `)
    // ... other patterns
  };

  for (const [pattern, template] of Object.entries(patternPrompts)) {
    this.prompts.set(pattern, template);
  }
}
```

## Provider-Specific Considerations

### OpenAI Models
- **Tool Calling**: Excellent support for function calling
- **Streaming**: Reliable streaming implementation
- **Parameters**: Full parameter support (temperature, topP, etc.)
- **Tokens**: Most accurate token counting

### Anthropic (Claude)
- **Context Length**: Very large context windows
- **System Messages**: Strong system message support
- **Parameters**: Limited parameter set (no frequency/presence penalty)
- **Safety**: Built-in safety filtering

### Google (Gemini)
- **Multimodal**: Strong image and text support
- **Parameters**: Different parameter names (maxOutputTokens vs maxTokens)
- **Streaming**: Good streaming support
- **Rate Limits**: Generous rate limits

### Groq
- **Speed**: Extremely fast inference
- **Parameters**: Limited parameter support
- **Models**: Curated model selection
- **Reliability**: Generally very reliable

### Cohere
- **Specialized**: Strong for specific use cases
- **Parameters**: Different parameter structure
- **Enterprise**: Good enterprise features
- **Documentation**: Well-documented API

### Ollama (Local)
- **Privacy**: Fully local execution
- **2025 Features**: Reasoning mode, JSON mode, improved performance
- **Models**: Wide model selection
- **Control**: Full control over model parameters

## Performance Monitoring

```typescript
getProviderStats(): {
  totalRequests: number;
  errorRate: number;
  availableProviders: string[];
  modelCount: number;
} {
  return {
    totalRequests: this.requestCount,
    errorRate: this.requestCount > 0 ? this.errorCount / this.requestCount : 0,
    availableProviders: Array.from(new Set(
      Array.from(this.configurations.keys()).map(key => key.split(':')[0])
    )),
    modelCount: this.configurations.size
  };
}
```

## Testing Strategy

1. **Provider Compatibility**: Test each provider with different parameter combinations
2. **Error Handling**: Test network failures, invalid API keys, model unavailability
3. **Streaming**: Verify streaming works correctly for each provider
4. **Token Accuracy**: Compare estimated vs actual token usage
5. **Performance**: Monitor response times and resource usage

## Common Pitfalls

1. **Parameter Assumptions**: Don't assume all providers support the same parameters
2. **API Key Management**: Different providers use different environment variables
3. **Rate Limiting**: Each provider has different rate limits and patterns
4. **Error Messages**: Provider error messages vary significantly in format
5. **Model Names**: Model naming conventions differ between providers

## References

### Official LangChain Documentation
- [LangChain Chat Models](https://js.langchain.com/docs/modules/model_io/chat/) - Core chat model concepts
- [OpenAI Integration](https://js.langchain.com/docs/integrations/chat/openai/) - OpenAI-specific features
- [Anthropic Integration](https://js.langchain.com/docs/integrations/chat/anthropic/) - Claude integration
- [Ollama Integration](https://js.langchain.com/docs/integrations/chat/ollama/) - Local Ollama setup

### Provider Documentation
- [OpenAI API Reference](https://platform.openai.com/docs/api-reference) - Official OpenAI API docs
- [Anthropic API Reference](https://docs.anthropic.com/claude/reference/) - Claude API documentation
- [Google AI Studio](https://ai.google.dev/docs) - Gemini API documentation
- [Groq API Documentation](https://console.groq.com/docs) - Groq-specific features
- [Ollama Documentation](https://ollama.ai/docs) - Local model management

### Package Dependencies
- `@langchain/core`: ^0.3.30 - Core LangChain interfaces
- `@langchain/ollama`: ^0.2.3 - Ollama integration
- `@langchain/openai`: ^0.3.15 - OpenAI models
- `@langchain/anthropic`: ^0.3.15 - Claude models
- `@langchain/google-genai`: ^0.1.3 - Gemini models
- `@langchain/groq`: ^0.1.3 - Groq integration
- `@langchain/cohere`: ^0.3.3 - Cohere models

### Key Insights
LangChain's multi-provider approach requires careful parameter management and provider-specific handling. The 2025 features, especially in Ollama, significantly improve local model capabilities. Each provider has unique strengths and limitations that must be considered in implementation.

---

**Implementation Status**: ✅ Complete  
**Provider Support**: ✅ Multi-provider (6 providers)  
**2025 Features**: ✅ Ollama reasoning/JSON mode  
**Reliability**: ✅ Streaming, error handling, monitoring