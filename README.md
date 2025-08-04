# qi-v2-agent

Local AI coding assistant with smart input classification and multi-provider LLM support.

## Install & Run

```bash
bun install
bun --cwd lib build && bun --cwd app build
bun --cwd lib src/qi-code.ts
```

**Prerequisites**: Node.js 18+, Bun, [Ollama](https://ollama.ai) running locally

## Classification System

**7 methods** for command/prompt/workflow classification:
- **rule-based**: Pattern matching, 0ms latency, offline capability
- **llm-direct**: Universal model compatibility, ~50ms latency
- **langchain-structured**: Function calling models, optimal accuracy
- **4 langchain variants**: fewshot, chatprompt, outputparser, outputfixing

## Performance Study

```bash
# Run classification performance study
bun run src/study/classification.ts

# Quick classifier demo
bun --cwd app src/demos/classifier/demo.ts
```

## Architecture

- **Interface Layer**: `InputClassifier` - simple API, no QiCore exposure
- **Internal Layer**: 7 classification methods with proper QiCore Result<T> patterns
- **Configuration**: YAML-based multi-provider LLM setup
- **Local-first**: Private by design, uses local models

## Quick Test

```bash
/help                                           # → command
write a quicksort algorithm in haskell          # → prompt  
write into a file foo.hs a quicksort algorithm  # → workflow
```

---

**Status**: Production-ready classification system with comprehensive performance analysis.