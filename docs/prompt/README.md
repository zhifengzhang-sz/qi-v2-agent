# Prompt Module: Professional LLM Integration

## Two-Layer Architecture Excellence

The prompt module demonstrates sophisticated **two-layer architecture** combining professional reliability with developer accessibility:

### Inner Layer (qicore Professional)
**Purpose**: Production-grade reliability using advanced functional patterns
- **@qi/base**: Result<T> patterns with `Ok()`, `Err()`, `match()`, `fromAsyncTryCatch()`, `flatMap()`
- **@qi/core**: ConfigBuilder with schema validation and environment variable support
- **Domain-specific errors**: `LLMError extends QiError` with structured context
- **Operational reliability**: Circuit breakers, retries, proper async composition

### Interfacing Layer (Developer-Friendly)
**Purpose**: Simple API surface hiding qicore complexity
- **Promise-based interfaces**: Standard TypeScript patterns most developers expect
- **Context continuation**: LangChain ChatPromptTemplate with conversation history
- **Template system**: Five specialized templates for different use cases
- **Clean abstractions**: No Result<T> exposure in public API

## Technology Stack

### Core Integration Libraries
- **multi-llm-ts v4.2.2**: Unified TypeScript interface for multiple LLM providers
- **@langchain/core**: Message types and ChatPromptTemplate for structured prompting
- **@qi/base**: Professional Result<T> patterns and error handling
- **@qi/core**: Configuration management with schema validation

### Provider Architecture
- **Ollama** (primary): Local models with full privacy
- **Multi-provider ready**: Configuration-driven provider selection
- **LiteLLM** (planned): Production cost monitoring and rate limiting

## Architecture Examples

### Interfacing Layer API (Developer-Friendly)
```typescript
// Simple Promise-based interface - no qicore knowledge required
interface IPromptHandler {
  initialize(configPath: string, schemaPath: string): Promise<PromptResponse>
  complete(prompt: string, options?: PromptOptions): Promise<PromptResponse>
  completeWithContext(prompt: string, context: ConversationContext): Promise<PromptResponse>
  getAvailableProviders(): Promise<ProviderInfo[]>
}

type PromptResponse = 
  | { success: true; data: string; metadata?: any }
  | { success: false; error: string }
```

### Inner Layer Implementation (qicore Professional)
```typescript
// Advanced Result<T> patterns with functional composition
class QiCorePromptManager implements IPromptManager {
  async loadConfig(configPath: string): Promise<Result<LLMConfig, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const builderResult = await ConfigBuilder.fromYamlFile(configPath);
        return match(
          (builder) => builder.validateWithSchemaFile(schemaPath).build(),
          (error: QiError) => { throw new Error(`Config loading failed: ${error.message}`); },
          builderResult
        );
      },
      (error) => validationError(`Config loading failed: ${error.message}`)
    );
  }

  async executePrompt(prompt: string, options: PromptExecutionOptions): Promise<Result<string, QiError>> {
    return match(
      async (validatedPrompt: string) => await this.tryProvider(options.providerId, validatedPrompt, options),
      async (error: LLMError) => Err(error),
      this.validatePrompt(prompt)
    );
  }
}
```

## Context Continuation System

### LangChain Integration
```typescript
class LangChainPromptHandler implements IPromptHandler {
  async completeWithContext(
    prompt: string, 
    context: ConversationContext, 
    options: { templateType?: string } = {}
  ): Promise<PromptResponse> {
    // Select specialized template
    const template = this.templates.get(options.templateType || 'default');
    
    // Convert context messages to LangChain format
    const conversationHistory = this.convertContextMessages([...context.messages]);
    
    // Format with MessagesPlaceholder for conversation history
    const messages = await template.formatMessages({
      domain: options.domain || 'software development',
      context_type: context.type || 'general',
      conversation_history: conversationHistory,  // MessagesPlaceholder injection
      current_input: prompt,
    });
    
    return this.baseHandler.complete(this.messagesToString(messages), options);
  }
}
```

### Template System (5 Specialized Templates)
1. **Default**: General-purpose context-aware assistant
2. **Coding**: Expert software developer and coding assistant  
3. **Problem-solving**: Step-by-step analysis and solution provider
4. **Educational**: Patient teacher with examples and explanations
5. **Debugging**: Systematic troubleshooting expert

**Local-First Strategy with Model Specialization**:
- **Primary**: Ollama local models (zero cost, full privacy)
- **Task-Specific Models**: Different models optimized for specific tasks based on empirical studies
  - **Classifier**: `qwen3:8b` at temperature 0.1 for consistent classification
  - **User Prompts**: `qwen2.5:7b` for balanced performance/capability
  - **Code Tasks**: `deepseek-coder:6.7b` specialized for programming
- **Study-Driven Selection**: Model choices determined by performance studies in `app/src/study/`
- **Configuration-Driven**: YAML-based provider and model selection strategies

## Professional Error Handling

### Domain-Specific Error Types
```typescript
interface LLMError extends QiError {
  context: {
    provider?: string;
    model?: string; 
    operation?: string;
    availableProviders?: string[];
  };
}

const llmError = (
  code: string,
  message: string, 
  category: ErrorCategory,
  context: LLMError['context'] = {}
): LLMError => create(code, message, category, context) as LLMError;
```

### Operational Reliability Patterns
- **Circuit Breaker**: Provider marked unavailable after failure threshold
- **Retry Strategy**: Exponential backoff with `fromAsyncTryCatch()`
- **Graceful Degradation**: Automatic fallback to base handler on template failure
- **Health Monitoring**: Provider availability and performance tracking

## Configuration Management

**@qi/core ConfigBuilder Integration**:
```yaml
llm:
  defaultProvider: "ollama"
  timeout: 30000
  maxRetries: 3
  
  providers:
    ollama:
      baseURL: "http://172.18.144.1:11434"
      models: ["qwen2.5:7b", "llama3.2:3b", "deepseek-coder:6.7b"]
    
    # API providers configured but require keys
    groq:
      baseURL: "https://api.groq.com/openai/v1"
      apiKey: "${GROQ_API_KEY}"
```

## Future Integration: LiteLLM Production Features

**Planned for Production Deployment**:
- **Cost Monitoring**: Automatic spend tracking across all providers with tag-based attribution
- **Rate Limiting**: TPM/RPM limits with multi-instance coordination using Redis
- **Budget Management**: Per-user/team/org spending limits with alerts
- **Usage Analytics**: Real-time cost callbacks and spend logging to S3/GCS

**Integration Pattern**:
```typescript
// LiteLLM will provide OpenAI-compatible proxy
const liteLLMConfig = {
  baseURL: "http://localhost:4000", // LiteLLM proxy
  providers: {
    ollama: { budget: "unlimited", priority: 1 },
    groq: { budget: "$50/month", tpm_limit: 14400 },
    together: { budget: "$30/month", rpm_limit: 60 }
  }
};
```

## Empirical Model Selection Framework

### Study-Driven Optimization (`app/src/study/`)
The prompt module's model selection is **empirically validated** through comprehensive testing:

**Classification Studies**:
- **Dataset**: CLINC150, banking intents, balanced datasets (700×3 samples)
- **Models tested**: Multiple Ollama models for classification accuracy
- **Result**: `qwen3:8b` selected for optimal classification performance
- **Configuration**: Temperature 0.1 for consistency, 200 max tokens for efficiency

**Performance Testing Framework**:
```bash
bun run study:all                    # Comprehensive classification tests
bun run study:benchmark             # Performance benchmarking
bun run study:quick                 # Rapid validation testing
```

**Key Insights from Studies**:
- **Small models for focused tasks**: Classification doesn't need 70B models
- **Temperature tuning**: 0.1 for classification, 0.7-0.8 for creative tasks
- **Cost efficiency**: Local 3B-8B models often outperform API calls for specific tasks
- **Task specialization**: DeepSeek-Coder excels at programming, Qwen for reasoning

### Strategic Model Allocation
```yaml
# Task-optimized model selection based on empirical studies
classifier:
  model: "qwen3:8b"        # Validated for classification accuracy
  temperature: 0.1         # Consistency over creativity
  
prompt:
  currentModel: "qwen2.5:7b"  # Balanced capability/performance
  
coding:
  preferredModel: "deepseek-coder:6.7b"  # Code-specialized
```

## Why This Architecture Works

### For Regular Developers
- **Familiar Patterns**: Standard Promise-based TypeScript interfaces
- **No Learning Curve**: Use without understanding qicore complexity
- **Rich Features**: Context continuation, templates, multi-provider support
- **Optimized Performance**: Models pre-selected based on empirical validation

### For Professional Systems
- **Operational Reliability**: qicore Result<T> patterns with proper error propagation
- **Functional Composition**: Advanced patterns like `flatMap()` for elegant error chaining
- **Production Ready**: Circuit breakers, retries, health monitoring, cost tracking
- **Data-Driven Decisions**: Model selection backed by comprehensive testing

## Implementation Structure

**Location**: `lib/src/prompt/`
- **Interfaces**: Clean TypeScript contracts in `interfaces/`
- **Implementation**: Two-layer architecture in `impl/`
  - `QiCorePromptManager.ts`: Inner layer with qicore patterns
  - `LangChainPromptHandler.ts`: Interfacing layer with context continuation
  - `DefaultPromptHandler.ts`: Base implementation