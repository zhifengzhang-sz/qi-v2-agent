# qi-v2-agent

**Professional AI coding assistant with unified MCP storage architecture and advanced context management.**

## Overview

qi-v2-agent provides a clean, production-ready prompt application with intelligent context management, multi-provider LLM support, and seamless file reference capabilities. Built with QiCore functional programming patterns and unified MCP storage for reliable session persistence.

## Key Features

- **🔄 Unified Storage**: MCP memory server for all persistence - no scattered state
- **📁 File References**: Use `@file` patterns to include content in prompts
- **🤖 Multi-Provider LLM**: 5 providers with 25+ models and smart fallback
- **⚡ Binary Compilation**: Portable 5.1MB executable with no dependencies
- **🎯 Professional CLI**: Complete configuration flexibility
- **🧠 QiCore Architecture**: Functional programming with Result<T> patterns

## Quick Start

### Install & Run
```bash
bun install
bun run build
./app/qi-prompt --config-path config/llm-providers.yaml --schema-path config/llm-providers.schema.json --env-path .env
```

### Usage Examples
```bash
# File reference patterns
@package.json analyze dependencies
@src/main.ts explain this code  
@config/llm-providers.yaml check this configuration

# Framework options
./app/qi-prompt --framework hybrid  # Auto-detect (default)
./app/qi-prompt --framework ink     # Rich UI with colors
./app/qi-prompt --framework readline # Basic terminal
```

## Binary Compilation

```bash
# Build portable binary
bun run build

# Run with configuration
./app/qi-prompt --config-path config/llm-providers.yaml --schema-path config/llm-providers.schema.json --env-path .env --framework hybrid
```

**Binary Features:**
- Single 5.1MB executable 
- No native dependencies (SQLite removed)
- Complete configuration flexibility
- Works on any Linux/macOS system

## Architecture

### Unified MCP Storage
- **Single storage system**: MCP memory server only
- **No scattered state**: Everything persists through unified architecture
- **Functional composition**: QiCore Result<T> patterns throughout
- **Session persistence**: Reliable conversation and context storage

### Technical Stack
- **Frontend**: React/Ink with hybrid framework support
- **Backend**: Bun runtime with TypeScript
- **State**: XState v5 with MCP integration
- **Storage**: Model Context Protocol memory server
- **Patterns**: QiCore functional programming

## Commands

```bash
# System commands
/help           # Show available commands
/tools          # List registered tools
/workflows      # Show execution statistics
/files          # List session file references

# Development
bun run check   # TypeScript + lint + tests
bun run build   # Build library and compile binary
```

## Hotkeys

- **Shift+Tab**: Cycle through Interactive/Command/Streaming modes
- **↑/↓**: Navigate command history
- **ESC**: Cancel operations or clear input
- **Ctrl+D**: Graceful exit

## Configuration

Requires three configuration files:
- `config/llm-providers.yaml` - LLM provider settings
- `config/llm-providers.schema.json` - Configuration schema
- `.env` - Environment variables

See `config/` directory for examples.

## Version

**Current**: v-0.8.4 - Unified MCP storage architecture with SQLite removal

---

**Status**: ✅ Production ready with unified storage architecture