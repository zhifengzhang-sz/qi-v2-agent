# qi-v2-agent

**Extensible AI coding assistant framework with dual-agent architecture and tool-specialized sub-agents.**

## Overview

qi-v2-agent provides both a professional prompt application (qi-prompt) and a complete coding agent (qi-code) with advanced workflow orchestration. Features intelligent context management, multi-provider LLM support, tool-specialized sub-agents, and unified MCP storage. Built with QiCore functional programming patterns for enterprise-grade reliability.

## Key Features

### **🤖 Dual-Agent Architecture**
- **qi-prompt**: Advanced prompt application with context management and simple workflows
- **qi-code**: Full coding agent with tool-specialized sub-agents and advanced orchestration
- **Extensible Framework**: Support for unlimited specialized agent implementations

### **🔧 Tool-Specialized Sub-Agents (qi-code)**
- **FileOpsSubAgent**: Complete file system operations (read, write, edit, search)
- **SearchSubAgent**: Advanced content and pattern search capabilities
- **GitSubAgent**: Full version control operations with workflow integration
- **WebSubAgent**: Web operations, search, and content extraction

### **🏗️ Enterprise Architecture**
- **🔄 Unified Storage**: MCP memory server for all persistence - no scattered state
- **📁 File References**: Use `@file` patterns to include content in prompts
- **🤖 Multi-Provider LLM**: 5 providers with 25+ models and smart fallback
- **⚡ Binary Compilation**: Portable executables with no dependencies
- **🎯 Professional CLI**: Complete configuration flexibility
- **🧠 QiCore Architecture**: Functional programming with Result<T> patterns

## Quick Start

### Install & Run
```bash
bun install
bun run build

# qi-prompt: Advanced prompt application
bun run --cwd app qi-prompt

# qi-code: Full coding agent with sub-agents
bun run --cwd app qi-code
```

### Usage Examples

#### **qi-prompt: Advanced Context Management**
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

#### **qi-code: Full Coding Agent**
```bash
# Complex coding tasks with sub-agent coordination
bun run --cwd app qi-code --debug

# Advanced workflow patterns (ReAct, ReWOO, ADaPT)
# Automatic sub-agent selection for file, search, git, web operations
# Complete MCP service integration
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

## Architecture Comparison

| Feature | qi-prompt | qi-code |
|---------|-----------|---------|
| **Purpose** | Advanced prompt application | Full coding agent |
| **Orchestrator** | PromptAppOrchestrator | QiCodeAgent |
| **Sub-Agents** | None | FileOps, Search, Git, Web |
| **Workflows** | Simple, well-defined patterns | Advanced ReAct, ReWOO, ADaPT |
| **Complexity** | Clean, no fancy algorithms | Sophisticated orchestration |
| **Use Cases** | Prompt engineering, simple tasks | Complex coding, multi-step projects |
| **Target Users** | Context-focused prompt work | Full coding assistance |

## Version

**Current**: v-0.10.1 - Complete Sub-Agent Architecture with qi-code Implementation

### **Milestones Achieved**
- ✅ **v-0.8.x**: qi-prompt production-ready with unified MCP storage  
- ✅ **v-0.9.x**: Enhanced workflow system with intelligent pattern selection
- ✅ **v-0.10.x**: qi-code milestone with tool-specialized sub-agents

---

**Status**: ✅ Dual-agent framework complete with extensible sub-agent architecture