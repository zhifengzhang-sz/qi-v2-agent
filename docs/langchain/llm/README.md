# LangChain LLM Integration

Documentation of how LangChain communicates with local LLM providers, particularly Ollama, and why certain approaches work while others don't.

## Overview

This system uses LangChain to communicate with local LLM providers (primarily Ollama) for classification tasks. The implementation avoids known problematic patterns and uses proven approaches for reliable communication.

## Communication Architecture

### OpenAI-Compatible API Approach ✅

**What we use and why it works:**

```typescript
import { ChatOpenAI } from '@langchain/openai';

const llm = new ChatOpenAI({
  model: 'qwen3:8b',
  temperature: 0.1,
  configuration: {
    baseURL: 'http://localhost:11434/v1',  // Ollama's OpenAI-compatible endpoint
    apiKey: 'ollama'                       // Dummy key (required by interface)
  }
});
```

**Key Points:**
- Uses Ollama's `/v1` OpenAI-compatible endpoint
- Avoids ChatOllama class entirely
- Works with all structured output methods
- Compatible with function calling models

### ChatOllama Approach ❌

**What we DON'T use and why it fails:**

```typescript
// DON'T USE THIS - Known to be problematic
import { ChatOllama } from '@langchain/ollama';

const llm = new ChatOllama({
  baseUrl: 'http://localhost:11434',
  model: 'qwen3:8b'
});
```

**Problems with ChatOllama:**
- Inconsistent structured output support
- Function calling compatibility issues
- Response parsing failures
- Timeout and connection issues
- Deprecated in favor of OpenAI-compatible approach

## LLM Provider Integration

### Ollama Integration

**Architecture:**
```
LangChain → OpenAI Client → Ollama /v1 endpoint → Local Model
```

**Configuration:**
```typescript
const config = {
  baseUrl: 'http://localhost:11434/v1',    // Ollama OpenAI-compatible endpoint
  modelId: 'qwen3:8b',                     // Model name in Ollama
  apiKey: 'ollama',                        // Dummy key (not validated by Ollama)
  temperature: 0.1,                        // Low temperature for consistent classification
  maxTokens: 1000                          // Sufficient for classification responses
};
```

**Endpoint Details:**
- **Native Ollama API**: `http://localhost:11434/api/generate` (not used)
- **OpenAI-compatible**: `http://localhost:11434/v1/chat/completions` (used)
- **Function calling**: Supported on `/v1` endpoint with compatible models

### Model Compatibility Matrix

#### Function Calling Support ✅
**These models work with withStructuredOutput:**

| Model | Version | Function Calling | Structured Output | Performance |
|-------|---------|------------------|-------------------|-------------|
| qwen3:8b | Latest | ✅ | ✅ | Excellent |
| qwen3:14b | Latest | ✅ | ✅ | Excellent |
| llama3.2:3b | Latest | ✅ | ✅ | Good |
| llama3.3:70b | Latest | ✅ | ✅ | Excellent |
| command-r:35b | Latest | ✅ | ✅ | Good |

#### No Function Calling Support ❌
**These models require OutputParser approach:**

| Model | Version | Function Calling | Structured Output | Workaround |
|-------|---------|------------------|-------------------|------------|
| qwen2.5-coder:7b | Latest | ❌ | ⚠️ | OutputParser |
| qwen2.5-coder:14b | Latest | ❌ | ⚠️ | OutputParser |
| SmolLM2:1.7B | Latest | ❌ | ❌ | Rule-based |
| CodeLlama-7B | Latest | ❌ | ⚠️ | OutputParser |
| deepseek-r1:7b | Latest | ❌ | ⚠️ | OutputParser |

### Communication Patterns

#### Structured Output Flow

**With Function Calling (qwen3:8b):**
```
1. LangChain creates function calling request
2. Sent to Ollama /v1/chat/completions
3. Model returns structured JSON in function call format
4. LangChain parses and validates against Zod schema
5. Returns typed TypeScript object
```

**Without Function Calling (qwen2.5-coder:7b):**
```
1. LangChain sends prompt with format instructions
2. Sent to Ollama /v1/chat/completions  
3. Model returns text response with JSON
4. OutputParser extracts and validates JSON
5. Returns typed TypeScript object or parsing error
```

#### Error Handling Patterns

**Connection Errors:**
```typescript
try {
  const response = await llm.invoke(prompt);
} catch (error) {
  if (error.message.includes('ECONNREFUSED')) {
    throw new Error('Ollama server not running on http://localhost:11434');
  }
  throw error;
}
```

**Parse Errors:**
```typescript
try {
  return await parser.parse(response.content);
} catch (parseError) {
  // Fallback to OutputFixingParser
  return await fixingParser.parse(response.content);
}
```

**Model Availability Check:**
```typescript
async function checkModelAvailability(modelId: string): Promise<boolean> {
  try {
    const response = await fetch('http://localhost:11434/api/tags');
    const data = await response.json();
    return data.models.some(m => m.name === modelId);
  } catch {
    return false;
  }
}
```

## Performance Optimization

### Connection Pooling
```typescript
// Reuse LLM instances to avoid connection overhead
const llmInstances = new Map<string, ChatOpenAI>();

function getLLM(config: LangChainConfig): ChatOpenAI {
  const key = `${config.modelId}_${config.temperature}`;
  if (!llmInstances.has(key)) {
    llmInstances.set(key, new ChatOpenAI(config));
  }
  return llmInstances.get(key)!;
}
```

### Request Optimization
```typescript
const optimizedConfig = {
  temperature: 0.1,           // Low temperature for consistent results
  maxTokens: 1000,           // Sufficient for classification, not excessive
  timeout: 30000,            // 30 second timeout
  stream: false,             // Disable streaming for classification
  stop: undefined            // Let model complete naturally
};
```

### Batch Processing
```typescript
// Process multiple inputs efficiently
async function batchClassify(inputs: string[]): Promise<Result[]> {
  const batchSize = 5;  // Optimal batch size for Ollama
  const results = [];
  
  for (let i = 0; i < inputs.length; i += batchSize) {
    const batch = inputs.slice(i, i + batchSize);
    const batchPromises = batch.map(input => classifier.classify(input));
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
}
```

## Debugging and Monitoring

### Connection Debugging
```typescript
// Test Ollama connectivity
async function debugOllamaConnection(): Promise<void> {
  console.log('Testing Ollama connection...');
  
  // Test native API
  try {
    const response = await fetch('http://localhost:11434/api/version');
    console.log('✅ Native API:', await response.json());
  } catch (error) {
    console.log('❌ Native API failed:', error.message);
  }
  
  // Test OpenAI-compatible API
  try {
    const response = await fetch('http://localhost:11434/v1/models');
    console.log('✅ OpenAI API:', await response.json());
  } catch (error) {
    console.log('❌ OpenAI API failed:', error.message);
  }
}
```

### Request/Response Logging
```typescript
class DebuggingLangChainClassifier {
  async classify(input: string): Promise<Result> {
    console.log('🔍 Input:', input);
    console.log('🔍 Model:', this.config.modelId);
    
    const startTime = Date.now();
    try {
      const result = await this.llm.invoke(prompt);
      const latency = Date.now() - startTime;
      
      console.log('✅ Success:', { latency, confidence: result.confidence });
      return result;
    } catch (error) {
      console.log('❌ Error:', error.message);
      throw error;
    }
  }
}
```

## Common Issues and Solutions

### Issue: "Model not found"
**Symptoms**: Error messages about model not being available
**Solution**: 
```bash
# Check available models
ollama list

# Pull required model
ollama pull qwen3:8b
```

### Issue: "Function calling not supported"
**Symptoms**: `withStructuredOutput` returns undefined or errors
**Solution**: Use models with function calling support or switch to OutputParser approach

### Issue: "Connection timeout"
**Symptoms**: Requests hanging or timing out
**Solution**: 
```typescript
const config = {
  timeout: 30000,  // Increase timeout
  maxRetries: 3,   // Add retry logic
};
```

### Issue: "Invalid JSON response"
**Symptoms**: Parse errors with structured output
**Solution**: Use OutputFixingParser or implement fallback logic

## Best Practices

1. **Always use OpenAI-compatible endpoint** (`/v1`) instead of native Ollama API
2. **Avoid ChatOllama class** - use ChatOpenAI with Ollama endpoint
3. **Check model function calling support** before using withStructuredOutput
4. **Implement fallback mechanisms** for parse errors
5. **Monitor connection health** and implement retry logic
6. **Use appropriate timeouts** for your use case
7. **Test with multiple models** to ensure compatibility

## Configuration Examples

### Development Configuration
```typescript
const devConfig = {
  baseUrl: 'http://localhost:11434/v1',
  modelId: 'qwen3:8b',
  temperature: 0.1,
  maxTokens: 500,
  timeout: 15000
};
```

### Production Configuration
```typescript
const prodConfig = {
  baseUrl: process.env.OLLAMA_URL || 'http://localhost:11434/v1',
  modelId: process.env.MODEL_ID || 'qwen3:8b',
  temperature: 0.05,  // Very low for consistency
  maxTokens: 1000,
  timeout: 30000,
  maxRetries: 3
};
```

---

**Key Takeaway**: The OpenAI-compatible approach with proper error handling provides the most reliable integration with local LLM providers through LangChain.