# qi-v2-agent

Local AI coding assistant. Smart input routing, multi-provider LLM support, local-first privacy.

## Install & Run

```bash
bun install
bun --cwd lib build && bun --cwd app build
bun --cwd lib src/qi-code.ts
```

**Prerequisites**: Node.js 18+, Bun, [Ollama](https://ollama.ai) running locally

## What It Does

- **Smart routing**: Commands (`/help`) → instant execution, prompts (`"write quicksort"`) → LLM, complex tasks → workflow
- **Local-first**: Your code stays private, uses local Ollama models primarily  
- **Multi-provider ready**: Uses multi-llm-ts library with proper context continuation and rate limiting
- **Fast classification**: 93% accuracy, <1ms latency for most inputs

## Quick Test

Try it:
- `/help` - instant system command
- `"write a quicksort in python"` - LLM prompt  
- `"fix bug in src/app.ts and run tests"` - complex workflow

## For Developers

**Test classification accuracy**:
```bash
bun run study:all                    # Run all classification tests
bun --cwd app src/demos/classifier/demo.ts  # Quick demo
```

**Configuration**: `config/llm-providers.yaml` - multi-provider LLM setup

**Documentation**: See `docs/` for technical details and API reference

---

**Status**: Production-ready core with excellent code quality. Works as a good prompt app right now.