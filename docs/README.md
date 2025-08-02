# qi-v2-agent Documentation

Local AI coding assistant with three-type input classification system.

## Quick Start

```bash
bun --cwd lib build && bun --cwd app build
bun --cwd app src/main.ts unified   # Three-type agent interface
```

## Architecture

- **Input Classification**: Command `/help` | Prompt `"write quicksort"` | Workflow `"fix bug and test"`
- **Execution**: Direct commands | LLM generation | Multi-step workflows  
- **Technology**: TypeScript + LangGraph + LangChain + MCP + Ollama

## Module Documentation

Each module has contract specifications and logical structure docs:

- **[classifier/](classifier/)** - Three-type input classification system
- **[agent/](agent/)** - Main coordinator with streaming responses  
- **[workflow/](workflow/)** - Multi-step task orchestration
- **[prompt/](prompt/)** - LLM integration and template management
- **[cli/](cli/)** - Terminal interface implementations
- **[demos/](demos/)** - Working examples and test applications
- **[architecture/](architecture/)** - System design decisions
- **[api-reference.md](api-reference.md)** - Quick API reference

## Status

✅ Production-ready implementation with excellent code quality  
🔄 Documentation cleanup complete  
📋 See [CLAUDE.md](../CLAUDE.md) for development guidelines