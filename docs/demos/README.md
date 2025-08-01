# Qi Agent Demos

This directory contains demonstrations of proper @qi/base and @qi/core patterns and qi-v2-agent framework components.

## Multi-Provider LLM Demo (NEW)

**File**: `multi-llm-demo.ts`

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
bun src/demos/multi-llm-demo.ts

# Enable additional providers with environment variables
export GROQ_API_KEY="your-groq-key"
export HUGGINGFACE_API_KEY="your-hf-token" 
export TOGETHER_API_KEY="your-together-key"
```

**Configuration**:
- Config file: `config/llm-providers.yaml`
- Schema validation: `config/llm-providers.schema.json`
- TypeScript path aliases: `@qi/base`, `@qi/core`

**Example Output**:
- Provider initialization with proper error handling
- Real LLM responses from Ollama
- Structured logging with context
- Fallback behavior demonstration

## Legacy Agent Framework Demos

### 1. Input Classification Demo

**File**: `input-classification-demo.ts`

**Purpose**: Demonstrates the three-type input classification system that determines how user input should be processed.

**Classification Types**:
- 📝 **PROMPT**: Simple conversational interactions (greetings, questions, acknowledgments)
- ⚡ **WORKFLOW**: Complex tasks requiring tools (fixing bugs, creating files, refactoring)
- 🔧 **COMMAND**: Direct commands with prefix (/)

**Usage**:
```bash
# Interactive demo
bun run demo:input-classification

# Automated test suite
bun run demo:input-classification:test
```

### 2. Pattern Recognition Demo

**File**: `pattern-recognition-demo.ts`

**Purpose**: Demonstrates the multi-signal cognitive pattern detection system that determines which processing approach to use.

**Cognitive Patterns**:
- 🔬 **ANALYTICAL**: Strategic analysis and planning tasks
- 🎨 **CREATIVE**: Implementation and generation tasks
- 🔧 **PROBLEM-SOLVING**: Debugging and troubleshooting tasks
- 📚 **INFORMATIONAL**: Knowledge sharing and explanation tasks
- 💬 **CONVERSATIONAL**: General conversation and simple interactions

**Usage**:
```bash
# Interactive demo
bun run demo:pattern-recognition

# Automated test suite
bun run demo:pattern-recognition:test
```

## Other Demos

**Note**: The following demos may need updating to follow proper qicore patterns:
- `config-manager-demo.ts`
- `prompt-manager-demo.ts` 
- `simple-prompt-demo.ts`

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

3. **Run legacy framework demos**:
   ```bash
   # Input Classification Demo
   bun run demo:input-classification
   
   # Pattern Recognition Demo  
   bun run demo:pattern-recognition
   ```