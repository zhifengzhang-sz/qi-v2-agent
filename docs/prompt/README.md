# Prompt Module Documentation

This directory contains documentation for the prompt module (`app/src/prompt/`).

## Contents

- **prompt-design.md** - High-level design and requirements
- **prompt-design-impl.md** - Implementation design details
- **prompt-impl.md** - Implementation notes and patterns

## Related Code

The corresponding implementation is in `app/src/prompt/`:
- `interfaces/` - TypeScript interfaces (IPromptHandler, IPromptManager)
- `impl/` - Concrete implementations (DefaultPromptHandler, QiCorePromptManager)
- `index.ts` - Module exports

## Key Concepts

- LLM provider abstraction via multi-llm-ts
- Template rendering and management
- Configuration-driven prompt processing
- Local model support (Ollama integration)