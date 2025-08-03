# QiCore Classification Module

Professional three-type input classification: **command/prompt/workflow**.

## Architecture

### 4-Tier Design
```
classifier/
├── abstractions/        # Core interfaces and types
├── impl/               # 7 classification methods
├── shared/            # Performance tracking and error handling
└── schema-registry/   # Dynamic schema management
```

### Implementation Files
```
impl/
├── rule-based.ts           # Pattern matching (0ms)
├── llm-direct.ts           # Universal LLM wrapper (3ms)
├── structured-output.ts    # Main LangChain method (3ms)
├── fewshot.ts             # Few-shot learning
├── chat-prompt.ts         # Conversational context
├── output-parser.ts       # Legacy model support
├── output-fixing.ts       # Auto-correction retry
└── input-classifier.ts    # Interface layer
```

## Quick Start

```typescript
import { createInputClassifier } from '@qi/agent/classifier'

// Default (best accuracy)
const classifier = createInputClassifier()
const result = await classifier.classify('hello world')
// → { type: 'prompt', confidence: 0.95, method: 'langchain-structured' }

// Fast rule-based
const fast = createInputClassifier({ method: 'rule-based' })
```

## Classification Methods

### Core Methods
- **rule-based** - Pattern matching, no LLM (68% accuracy, 0ms)
- **llm-direct** - Universal wrapper (85% accuracy, 3ms)  
- **langchain-structured** - Main method (94% accuracy, 3ms)

### LangChain Variants
- **fewshot-langchain** - Example-driven learning
- **chatprompt-langchain** - Session-aware templates
- **outputparser-langchain** - Legacy model compatibility
- **outputfixing-langchain** - Progressive retry with correction

## Method Selection

```typescript
// Production (best accuracy)
createInputClassifier({ method: 'langchain-structured' })

// Development (fastest)
createInputClassifier({ method: 'rule-based' })

// Specific LangChain variants
createFewShotLangChainClassifier()
createChatPromptLangChainClassifier()
createOutputParserLangChainClassifier()
createOutputFixingLangChainClassifier()
```

## Key Features

### Dynamic Schema Registry
- **Real-time performance tracking** via `globalSchemaRegistry`
- **Automatic schema selection** based on model capabilities
- **Performance measurement** replacing hardcoded metrics

### Error Handling
- **Shared error types** across all methods (`shared/error-types.ts`)
- **QiCore Result<T> patterns** with proper error propagation
- **Contextual error information** for debugging

### Statistical Analysis
- **Confidence intervals** (Wilson score method)
- **Pairwise comparisons** (McNemar's test)
- **Effect size calculations** and power analysis
- **Sample size recommendations**

## Performance Characteristics

| Method | Accuracy | Latency | Use Case |
|--------|----------|---------|----------|
| `rule-based` | 68% | 0ms | Development/testing |
| `llm-direct` | 85% | 3ms | Universal production |
| `langchain-structured` | 94% | 3ms | Function calling models |
| `fewshot-langchain` | 90% | 4ms | Complex classification |
| `chatprompt-langchain` | 91% | 5ms | Conversational AI |

## Design Principles

### QiCore Integration
- **Result<T> patterns** for error handling
- **flatMap chains** for operation composition
- **match() functions** for result processing
- **fromAsyncTryCatch** for exception boundaries

### LangChain Best Practices
- **OpenAI-compatible API** (avoids ChatOllama issues)
- **withStructuredOutput** for function calling models
- **Dynamic imports** for better compatibility
- **Schema validation** with Zod

### Performance Optimization
- **Command detection shortcuts** for all LLM methods
- **Real-time measurement** via schema registry
- **Shared utilities** for common operations
- **Lazy initialization** of expensive resources

## Configuration

### Basic Configuration
```typescript
const classifier = createInputClassifier({
  method: 'langchain-structured',
  baseUrl: 'http://localhost:11434/v1',
  modelId: 'qwen2.5:7b',
  temperature: 0.1
})
```

### Advanced Configuration
```typescript
const classifier = createLangChainClassifier({
  schemaName: 'optimized',
  schemaSelectionCriteria: {
    use_case: 'production',
    model_supports_function_calling: true,
    prioritize_accuracy: true
  }
})
```

## Research Integration

### Statistical Testing
```typescript
import { compareMultipleMethods } from '@qi/agent/study/statistical-analysis'

const results = compareMultipleMethods(methodResults)
// Provides McNemar's tests, confidence intervals, effect sizes
```

### Performance Tracking
```typescript
import { trackClassificationPerformance } from '@qi/agent/classifier/shared/performance-tracking'

// Real-time measurement during classification
trackClassificationPerformance(schema, startTime, success, parseSuccess)
```

## Migration Guide

### From Old Filenames
- `rule-based-classification-method.ts` → `rule-based.ts`
- `langchain-classification-method.ts` → `structured-output.ts`
- `fewshot-langchain-classification-method.ts` → `fewshot.ts`

### From Hardcoded Metrics
- Use `getEffectiveAccuracy()` and `getEffectiveLatency()`
- Real performance measurement via schema registry
- Statistical analysis with confidence intervals

## Implementation Notes

### Error Handling Patterns
```typescript
// Use shared error factories
import { createClassificationError } from '../shared/error-types.js'

const error = createClassificationError('method-name', 'ERROR_CODE', message, category, context)
```

### Performance Tracking
```typescript
// Track real metrics
const startTime = Date.now()
// ... perform classification
trackClassificationPerformance(selectedSchema, startTime, success, parseSuccess)
```

### Method Identification
```typescript
// Each method returns unique identifier
getMethodName(): ClassificationMethod {
  return 'fewshot-langchain'  // Not generic 'langchain-structured'
}
```