# Classifier Module Usage Guide

The classifier module provides intelligent input classification using a sophisticated three-type system with professional-grade error handling and flexible configuration options.

## Overview

The classifier implements a **two-layer architecture** with **three classification types**:

- **Commands**: System functions with `/` prefix (e.g., `/help`, `/config`)
- **Prompts**: Simple conversational inputs (e.g., "hi", "write a quicksort function")  
- **Workflows**: Complex multi-step tasks (e.g., "fix bug in auth.js and run tests")

### Architecture

```
User Input → InputClassifier → (Professional Manager | Legacy Methods) → ClassificationResult
            (Two-Layer)        (qicore Result<T> | Promise-based)
```

## Quick Start

### Basic Usage

```typescript
import { InputClassifier } from '@qi/classifier';

// Create classifier with defaults
const classifier = new InputClassifier();

// Classify input
const result = await classifier.classify("hi there!");
console.log(result.type); // "prompt"
console.log(result.confidence); // 0.85
console.log(result.reasoning); // "Simple greeting detected"
```

### With Configuration

```typescript
// Custom configuration
const classifier = new InputClassifier({
  defaultMethod: 'llm-based',
  confidenceThreshold: 0.9,
  commandPrefix: '!',
  promptIndicators: ['hello', 'hi', 'hey'],
  workflowIndicators: ['fix', 'create', 'build']
});
```

## Configuration Options

### 1. Standalone Usage (Config Files)

```typescript
// Load from YAML configuration files
const classifier = new InputClassifier({
  configPath: 'config/classification.yaml',
  schemaPath: 'config/schema/classification.yaml'
});

await classifier.initialize();
```

**Example classification.yaml:**
```yaml
classification:
  defaultMethod: llm-based
  fallbackMethod: rule-based
  confidenceThreshold: 0.8
  commandPrefix: "/"
  promptIndicators:
    - hi
    - hello
    - thanks
    - what
    - how
  workflowIndicators:
    - fix
    - create
    - refactor
    - implement
    - debug
  complexityThresholds:
    command: 1.0
    prompt: 0.8
    workflow: 0.7
```

### 2. Integrated Usage (State Manager)

```typescript
// With state manager LLM configuration
const llmConfig = stateManager.getLLMConfigForPromptModule();
const classifier = new InputClassifier({
  llmConfig: llmConfig?.llm
});

// Automatic LLM method configuration
await classifier.initialize();
```

### 3. Hybrid Configuration

```typescript
// Config file with runtime LLM override
const classifier = new InputClassifier({
  configPath: 'config/classification.yaml',
  llmConfigOverride: {
    modelId: 'qwen2.5:7b',
    baseUrl: 'http://localhost:11434',
    temperature: 0.1
  }
});
```

## Classification Methods

### Rule-Based Classification
- **Speed**: Very fast (~50ms average)
- **Accuracy**: Low (~9%)
- **Use Case**: Fallback method, always available
- **Features**: Pattern matching, keyword analysis

```typescript
const result = await classifier.classify("hello", { 
  method: 'rule-based' 
});
```

### LLM-Based Classification  
- **Speed**: Moderate (~350ms average)
- **Accuracy**: High (~92%)
- **Use Case**: Primary method for accuracy
- **Features**: Structured output, contextual understanding

```typescript
const result = await classifier.classify("fix the auth bug", { 
  method: 'llm-based' 
});
```

### Hybrid Classification
- **Speed**: Adaptive
- **Accuracy**: Balanced
- **Use Case**: Production environments
- **Features**: Automatic fallback, optimal performance

```typescript
// Automatically selects best available method
const result = await classifier.classify("create a new API endpoint");
```

## Advanced Features

### Context-Aware Classification

```typescript
const context = {
  sessionId: 'session-123',
  previousInputs: ['hello', 'what is TypeScript?'],
  timestamp: new Date(),
  metadata: new Map([['user', 'developer']])
};

const result = await classifier.classify("fix it", { 
  context,
  includeMetadata: true 
});
```

### Detailed Results

```typescript
const result = await classifier.classify("debug the API", {
  includeReasoning: true,
  includeAlternatives: true,
  includeMetadata: true
});

// Access detailed information
console.log(result.reasoning); // "Detected action verb 'debug' and technical term 'API'"
console.log(result.extractedData.get('workflowIndicators')); // ["debug"]
console.log(result.metadata.get('latency')); // "45"
```

### Classification Statistics

```typescript
// Get performance metrics
const stats = classifier.getStats();
console.log(stats.totalClassifications); // 1250
console.log(stats.averageConfidence); // 0.87
console.log(stats.averageProcessingTime); // 120ms
console.log(stats.typeDistribution.get('workflow')); // 45%
```

## Professional Error Handling

The classifier uses **qicore Result<T> patterns** internally for robust error handling:

### Graceful Degradation

```typescript
// Professional manager fails → Legacy methods continue working
const result = await classifier.classify("hello");
// Always returns a result, never throws for valid input
```

### Error Recovery

```typescript
// LLM service unavailable → Rule-based fallback
const result = await classifier.classify("complex workflow task");
// Automatically falls back to available methods
```

### Validation

```typescript
try {
  const result = await classifier.classify(""); // Invalid input
} catch (error) {
  console.log(error.message); // "Input cannot be empty or only whitespace"
}
```

## Performance Optimization

### Method Selection Strategy

1. **Commands**: Instant pattern matching (~1ms)
2. **Simple Prompts**: Rule-based classification (~50ms)  
3. **Complex Workflows**: LLM-based analysis (~350ms)
4. **Fallback Chain**: LLM → Rule-based → Basic patterns

### Caching Configuration

```typescript
const classifier = new InputClassifier({
  configPath: 'config.yaml',
  // Performance tuning will be available in enhanced config
});
```

### Monitoring

```typescript
// Built-in performance tracking
const stats = classifier.getStats();
console.log(`Average latency: ${stats.averageProcessingTime}ms`);
console.log(`Success rate: ${stats.methodUsage.get('llm-based')}%`);
```

## Integration Examples

### CLI Application

```typescript
import { InputClassifier } from '@qi/classifier';

const classifier = new InputClassifier({
  defaultMethod: 'rule-based', // Fast for interactive use
  confidenceThreshold: 0.7
});

async function handleUserInput(input: string) {
  const result = await classifier.classify(input);
  
  switch (result.type) {
    case 'command':
      return await executeCommand(input);
    case 'prompt': 
      return await handlePrompt(input);
    case 'workflow':
      return await executeWorkflow(input);
  }
}
```

### Web API

```typescript
import { InputClassifier } from '@qi/classifier';

const classifier = new InputClassifier({
  llmConfig: {
    modelId: 'qwen2.5:7b',
    baseUrl: process.env.OLLAMA_URL,
    temperature: 0.1
  }
});

app.post('/classify', async (req, res) => {
  try {
    const result = await classifier.classify(req.body.input, {
      context: { sessionId: req.session.id },
      includeMetadata: true
    });
    
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});
```

### Agent System

```typescript
import { InputClassifier } from '@qi/classifier';
import { StateManager } from '@qi/state';

const stateManager = new StateManager();
const llmConfig = stateManager.getLLMConfigForPromptModule();

const classifier = new InputClassifier({
  llmConfig: llmConfig?.llm,
  defaultMethod: 'llm-based',
  confidenceThreshold: 0.8
});

class Agent {
  async processInput(input: string) {
    const classification = await classifier.classify(input);
    
    switch (classification.type) {
      case 'command':
        return await this.commandHandler.execute(input);
      case 'prompt':
        return await this.promptHandler.process(input);
      case 'workflow':
        return await this.workflowEngine.execute(input);
    }
  }
}
```

## Best Practices

### 1. Method Selection
- **Interactive applications**: Start with `rule-based` for speed
- **Accuracy-critical**: Use `llm-based` as default
- **Production systems**: Let automatic fallback handle method selection

### 2. Configuration Management
- **Development**: Use direct configuration for quick iteration
- **Staging**: Use config files for environment consistency  
- **Production**: Use state manager integration for centralized config

### 3. Error Handling
- **Always handle classification errors gracefully**
- **Use the built-in fallback mechanisms**
- **Monitor performance metrics for optimization**

### 4. Performance Tuning
- **Cache frequently classified patterns**
- **Monitor average latency by method**
- **Adjust confidence thresholds based on accuracy needs**

## Troubleshooting

### Common Issues

1. **LLM Service Unavailable**
   ```typescript
   // Check service status
   const available = await classifier.isMethodAvailable('llm-based');
   if (!available) {
     // Will automatically use rule-based fallback
   }
   ```

2. **Low Classification Accuracy**
   ```typescript
   // Adjust confidence threshold
   const classifier = new InputClassifier({
     confidenceThreshold: 0.9, // Higher threshold
     defaultMethod: 'llm-based' // More accurate method
   });
   ```

3. **Slow Performance**
   ```typescript
   // Use faster method for real-time applications
   const classifier = new InputClassifier({
     defaultMethod: 'rule-based',
     fallbackMethod: 'rule-based'
   });
   ```

### Debug Information

```typescript
// Enable detailed logging
const result = await classifier.classify(input, {
  includeMetadata: true
});

console.log('Classification details:');
console.log('Method used:', result.method);
console.log('Processing time:', result.metadata.get('latency'));
console.log('Confidence:', result.confidence);
console.log('Reasoning:', result.reasoning);
```

## Migration Guide

### From v0.2.x to v0.3.x

```typescript
// Old API (still supported)
const classifier = new InputClassifier({
  defaultMethod: 'rule-based',
  confidenceThreshold: 0.8
});

// New flexible API
const classifier = new InputClassifier({
  configPath: 'config/classification.yaml', // File-based config
  llmConfig: { modelId: 'qwen2.5:7b' },    // Direct LLM config
  defaultMethod: 'rule-based'               // Backward compatibility
});
```

The classifier module provides professional-grade input classification with flexible configuration, robust error handling, and high performance suitable for production applications.