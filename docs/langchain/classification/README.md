# LangChain Classification Methods

Comprehensive documentation of all LangChain-based classification approaches implemented in the system.

## Overview

LangChain provides multiple strategies for structured output classification. This system implements **5 different approaches**, each optimized for specific use cases and model capabilities.

## Method Comparison

| Method | Approach | Function Calling Required | Best Use Case | Accuracy | Latency |
|--------|----------|---------------------------|---------------|----------|---------|
| **withStructuredOutput** | Direct schema binding | Yes | Production (new models) | ~94% | ~400ms |
| **FewShotPromptTemplate** | Example-driven learning | Optional | Complex classification | ~90% | ~500ms |
| **StructuredOutputParser** | Traditional parsing | No | Legacy models | ~85% | ~450ms |
| **ChatPromptTemplate** | Conversational context | Optional | Chat applications | ~88% | ~480ms |
| **OutputFixingParser** | Auto-correction | No | Unreliable models | ~82% | ~600ms |

## Detailed Method Documentation

### 1. GenericLangChainClassifier (withStructuredOutput)

**Best for production use with function calling models**

```typescript
import { GenericLangChainClassifier } from '@qi/classifier';
import { ClassificationSchemas } from '@qi/schemas';

const classifier = new GenericLangChainClassifier(
  { modelId: 'qwen3:8b', baseUrl: 'http://localhost:11434/v1' },
  ClassificationSchemas.threeType
);

const result = await classifier.classify("write a function");
```

**Key Features:**
- Schema configured at construction time (performance optimized)
- Multiple classification methods: `classify()`, `classifyWithPrompt()`, `classifyRaw()`, `classifyBatch()`
- Runtime schema switching via `setSchema()`
- Requires function calling support (qwen3, llama3.2+)

**Technical Details:**
- Uses OpenAI-compatible API endpoint (`/v1`)
- Avoids ChatOllama compatibility issues
- Zod schema validation with structured output binding
- Error handling with graceful fallbacks

### 2. FewShotLangChainClassifier

**Best for complex classification requiring examples**

```typescript
import { FewShotLangChainClassifier } from '@qi/classifier';

const classifier = new FewShotLangChainClassifier(
  config,
  ClassificationSchemas.threeType,
  customExamples  // Optional: add domain-specific examples
);

const result = await classifier.classify("create API with docs and tests");
```

**Key Features:**
- 8 built-in examples covering all classification types
- Customizable example sets for domain specialization
- Uses LangChain's `FewShotPromptTemplate`
- Dynamic example selection based on semantic similarity

**Example Structure:**
```typescript
const examples = [
  {
    input: '/help',
    output: { type: 'command', confidence: 1.0, reasoning: 'System command with / prefix' }
  },
  {
    input: 'fix bug in auth.js and run tests',
    output: { type: 'workflow', confidence: 0.9, reasoning: 'Multi-step task with file reference' }
  }
];
```

### 3. OutputParserLangChainClassifier

**Best for models without function calling support**

```typescript
import { OutputParserLangChainClassifier } from '@qi/classifier';

const classifier = new OutputParserLangChainClassifier(config, schema);

// Automatic retry on parse failure
const result = await classifier.classifyWithRetry("ambiguous input", 3);
```

**Key Features:**
- Uses `StructuredOutputParser` for traditional JSON parsing
- Works with ANY model (no function calling required)
- Automatic retry logic with temperature adjustment
- Chain composition: Prompt → LLM → Parser

**Technical Implementation:**
- Manual prompt formatting with format instructions
- JSON schema validation and parsing
- Fallback mechanisms for malformed outputs
- Compatible with older models (qwen2.5-coder, etc.)

### 4. ChatPromptTemplateLangChainClassifier

**Best for conversational AI and chat applications**

```typescript
import { ChatPromptTemplateLangChainClassifier } from '@qi/classifier';

const classifier = new ChatPromptTemplateLangChainClassifier(config, schema);

// Classification with conversation context
const result = await classifier.classifyConversation(
  "create tests",
  "session_123",
  ["previous input 1", "previous input 2"]
);
```

**Key Features:**
- Uses LangChain's `ChatPromptTemplate` with system/human messages
- Conversation history and session awareness
- User profile support (experience level, preferences)
- Streaming classification for real-time chat

**Context Features:**
- Session management with conversation continuity
- User experience level adaptation (beginner/intermediate/expert)
- Previous input history for context-aware classification
- Custom system prompt injection

### 5. OutputFixingParserLangChainClassifier

**Best for unreliable models or complex schemas**

```typescript
import { OutputFixingParserLangChainClassifier } from '@qi/classifier';

const classifier = new OutputFixingParserLangChainClassifier(config, schema);

// Progressive classification with auto-correction
const result = await classifier.classifyWithProgression("complex input", 3);
```

**Key Features:**
- Uses LangChain's `OutputFixingParser` for automatic error correction
- Progressive retry with increasing temperature
- Rule-based fallback when all parsing fails
- Comparison mode (base parser vs fixing parser)

**Error Correction Flow:**
1. **First attempt**: Base parser with low temperature
2. **Parse failure**: OutputFixingParser attempts correction
3. **Still failing**: Progressive retry with higher temperature
4. **Final fallback**: Rule-based classification

## Schema Design Patterns

### Minimal Schema (Fast)
```typescript
const minimalSchema = z.object({
  type: z.enum(['command', 'prompt', 'workflow']),
  confidence: z.number().min(0).max(1)
});
```

### Standard Schema (Balanced)
```typescript
const standardSchema = z.object({
  type: z.enum(['command', 'prompt', 'workflow']).describe('Classification type'),
  confidence: z.number().min(0).max(1).describe('Confidence 0.0-1.0'),
  reasoning: z.string().max(200).describe('Brief explanation')
});
```

### Detailed Schema (Comprehensive)
```typescript
const detailedSchema = z.object({
  type: z.enum(['command', 'prompt', 'workflow']).describe('Detailed classification'),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().max(200),
  indicators: z.array(z.string()).describe('Key classification indicators'),
  complexity_score: z.number().min(0).max(1)
});
```

## Performance Considerations

### Model Compatibility

**Function Calling Models** (LangChain works best):
- ✅ qwen3:8b, qwen3:14b, qwen3:30b
- ✅ llama3.2:3b, llama3.3:70b  
- ✅ Command-R, Mistral-7B-Instruct

**Non-Function Calling Models** (Use OutputParser methods):
- ❌ qwen2.5-coder:7b, qwen2.5-coder:14b
- ❌ SmolLM2:1.7B, CodeLlama-7B

### Performance Benchmarks

Based on testing with balanced-100x3.json dataset:

| Method | Commands | Prompts | Workflows | Overall | Avg Latency |
|--------|----------|---------|-----------|---------|-------------|
| withStructuredOutput | 100% | 95% | 90% | 94% | 400ms |
| FewShotPromptTemplate | 100% | 88% | 85% | 90% | 500ms |
| StructuredOutputParser | 95% | 82% | 78% | 85% | 450ms |
| ChatPromptTemplate | 100% | 85% | 80% | 88% | 480ms |
| OutputFixingParser | 90% | 80% | 75% | 82% | 600ms |

## Usage Recommendations

### Development Phase
- Use `GenericLangChainClassifier` for quick prototyping
- Test with minimal schemas for faster iteration

### Production Deployment
- **High accuracy needed**: `GenericLangChainClassifier` with function calling models
- **Legacy model support**: `OutputParserLangChainClassifier`
- **Chat applications**: `ChatPromptTemplateLangChainClassifier`
- **Unreliable environments**: `OutputFixingParserLangChainClassifier`

### Domain Specialization
- Use `FewShotLangChainClassifier` with custom examples
- Create domain-specific schemas and example sets
- Implement semantic similarity example selection

## Testing and Validation

### Available Test Scripts
```bash
# Compare all methods
bun run study:langchain-methods-comparison

# Test schema performance
bun run study:schema-performance

# Individual method testing
bun run study:generic-langchain
```

### Performance Metrics
- **Accuracy**: Percentage of correct classifications
- **Latency**: Average response time in milliseconds
- **Confidence**: Average model confidence scores
- **Parse Errors**: Failed schema validations

## Best Practices

1. **Schema Design**: Balance detail with performance
2. **Model Selection**: Match method to model capabilities
3. **Error Handling**: Implement fallbacks for production
4. **Context Management**: Use conversation history wisely
5. **Performance Monitoring**: Track accuracy and latency metrics

---

**Note**: All methods support the same core interface but with different initialization patterns and specialized features.