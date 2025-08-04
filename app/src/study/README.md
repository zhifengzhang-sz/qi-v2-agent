# Classification Study Framework

Clean, functional testing framework comparing different classification approaches.

## Available Implementations

### 1. Pure Functional Programming
```bash
# Simple YAML loading with minimal abstractions
bun run src/study/classification.fp.ts
```

### 2. QiCore Functional Composition
```bash
# Uses @qi/core with proper Result composition patterns
bun run src/study/classification.qicore.ts
```

### 3. Core Implementation
```bash
# Shared logic used by both approaches
bun run src/study/classification.ts
```

## Configuration

- **Config**: `classification-config.yaml` - models, methods, test inputs
- **Schema**: `classification-schema.json` - JSON schema validation
- **Comparison**: `CONFIG_APPROACHES_COMPARISON.md` - detailed analysis

## Architecture

- **Two functions**: `testClassification()`, `reportResults()`
- **Clean functional composition**: Load → Validate → Execute → Report
- **Identical results**: Both QiCore and pure FP produce same outputs
- **Schema validation**: Built-in type safety and error handling

## Example Output

```
🔬 SIMPLE STUDY RESULTS
========================

┌───┬──────────┬─────────────┬────────────────┬──────────┬────────────┬─────────┐
│   │ Model    │ Method      │ Input          │ Type     │ Confidence │ Latency │
├───┼──────────┼─────────────┼────────────────┼──────────┼────────────┼─────────┤
│ 0 │ qwen3:8b │ rule-based  │ /exit          │ command  │ 100.0%     │ 1ms     │
│ 1 │ qwen3:8b │ llm-direct  │ write algo...  │ prompt   │ 95.0%      │ 2500ms  │
└───┴──────────┴─────────────┴────────────────┴──────────┴────────────┴─────────┘

📊 SUMMARY BY METHOD
=====================

rule-based          : 100.0% success, 1ms avg
llm-direct          : 100.0% success, 2500ms avg
```

## Known Issues

### Method Compatibility

**✅ Working Methods (3/7):**
- `rule-based`: Fast, no LLM required
- `llm-based`: Slow but functional, real confidence scores
- `langchain-structured`: Fast, completes (function calling warnings but works)

**❌ Broken Methods (4/7):**
- `fewshot-langchain`: **HANGS** (timeouts) - EXCLUDE from testing
- `chatprompt-langchain`: **HANGS** (timeouts) - EXCLUDE from testing
- `outputparser-langchain`: **BROKEN** (retry loops, not working)
- `outputfixing-langchain`: **BROKEN** (retry loops, not working)

**Root Cause:** Models (qwen3:8b, qwen2.5-coder:7b) don't properly support function calling, causing LangChain methods to fail or timeout during validation.