# Qi Agent Demos

This directory contains demonstrations organized by functional category.

## Directory Structure

- **`classifier/`** - Input classification and pattern recognition demos
- **`workflow/`** - Workflow extraction and execution demos  
- **`cli/`** - Command-line interface and parser demos
- **`config/`** - Configuration management and multi-provider LLM demos
- **`prompt/`** - Prompt handling and template demos
- **`agent/`** - Agent coordination and orchestration demos (future)

## Featured Demo: Multi-Provider LLM

**File**: `config/multi-llm-demo.ts`

**Purpose**: Demonstrates unified multi-provider LLM management following proper qicore patterns.

**Key Features**:
- ✅ **@qi/base**: Pure Result<T> composition, no try/catch, no .then()/.catch()
- ✅ **@qi/core**: ConfigBuilder for YAML config loading, createLogger for structured logging
- ✅ **multi-llm-ts**: Provider abstraction for Ollama, Groq, HuggingFace, Together AI
- ✅ **Proper error handling**: Structured errors with categories and context
- ✅ **Fallback chains**: Automatic provider switching on failure
- ✅ **Schema validation**: Zod-based configuration validation

**Usage**:
```bash
# Run the demo  
bun src/demos/config/multi-llm-demo.ts

# Enable additional providers with environment variables
export GROQ_API_KEY="your-groq-key"
export HUGGINGFACE_API_KEY="your-hf-token" 
export TOGETHER_API_KEY="your-together-key"
```

**Configuration**:
- Config file: `config/llm-providers.yaml`
- Schema validation: `config/llm-providers.schema.json`
- TypeScript path aliases: `@qi/base`, `@qi/core`

## Available Demos

### Config Demos (`config/`)
- **`multi-llm-demo.ts`** - Multi-provider LLM management with @qi/base and @qi/core patterns

### Classifier Demos (`classifier/`)  
- **`working-classifier-demo.ts`** - Three-type classification using rule-based method

### CLI Demos (`cli/`)
- **`simple-cli-demo.ts`** - Proper CLI interface focused on CLI commands only
  - ✅ Interface commands: /help, /exit, /clear, /version
  - ❌ Does NOT do agent work (classification, LLM calls, etc.)
  - Shows proper separation of concerns: CLI handles interface, agent handles AI work

### Other Categories
- **`workflow/`** - Empty (legacy demos removed)
- **`prompt/`** - Empty (legacy demos removed)
- **`agent/`** - Empty (future agent demos)

## Best Practices Demonstrated

The `multi-llm-demo.ts` serves as the reference implementation for:

1. **Result<T> Composition**: No mixing of Promises with Result<T>
2. **Error Handling**: Using `fromAsyncTryCatch` instead of try/catch blocks
3. **Configuration**: Using `@qi/core` ConfigBuilder with schema validation
4. **Logging**: Using `@qi/core` createLogger instead of console.log
5. **Type Safety**: Proper TypeScript with Zod schemas
6. **Module Resolution**: Proper `@qi/base` and `@qi/core` aliases

## How to Run

1. **Prerequisites**: Ensure you're in the `/app` directory and dependencies are installed:
   ```bash
   cd app
   bun install
   ```

2. **Run the multi-provider LLM demo**:
   ```bash
   bun src/demos/multi-llm-demo.ts
   ```

3. **Run available demos**:
   ```bash
   # Multi-provider LLM demo (main working demo)
   bun src/demos/config/multi-llm-demo.ts
   
   # Classifier demo (shows three-type classification)
   bun src/demos/classifier/working-classifier-demo.ts
   
   # CLI demo (shows proper CLI interface)
   bun src/demos/cli/simple-cli-demo.ts
   ```