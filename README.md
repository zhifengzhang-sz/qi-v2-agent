# qi-v2-agent

Reusable and extensible AI agent framework with tool-specialized sub-agents and workflow orchestration.

## Overview

qi-v2-agent is an extensible framework for building specialized AI agents. It provides a foundation for creating agents with tool-specialized sub-agents, multi-provider LLM support, and unified MCP storage, built on QiCore functional programming patterns. The framework includes reference implementations: qi-prompt for prompt engineering and qi-code for coding assistance.

## Framework Architecture

### Extensible Agent System
- **QiCore Foundation**: Functional programming patterns with Result<T> error handling
- **Sub-Agent Architecture**: Composable, tool-specialized agents for specific domains
- **Workflow Orchestration**: ReAct, ReWOO, and ADaPT patterns for complex task coordination
- **Multi-Provider LLM**: Unified interface across 5 providers with 25+ models
- **MCP Integration**: Model Context Protocol for standardized storage and persistence

### Reference Sub-Agent Implementations
- **FileOpsSubAgent**: File system operations (read, write, edit, search)
- **SearchSubAgent**: Content and pattern search capabilities
- **GitSubAgent**: Version control operations with workflow integration
- **WebSubAgent**: Web operations, search, and content extraction

### Framework Features
- **Composable Architecture**: Mix and match sub-agents for different use cases
- **Extensible Design**: Create custom agents by extending base classes
- **Unified Storage**: Model Context Protocol (MCP) for consistent persistence
- **Multi-Provider LLM**: Abstract interface supporting multiple LLM providers
- **Binary Distribution**: Compile to portable executables with zero dependencies
- **Professional CLI**: Complete configuration flexibility and professional interface

## Reference Implementations

### qi-prompt
Advanced prompt application demonstrating context management and simple workflows.

### qi-code  
Complete coding agent showcasing tool-specialized sub-agents and advanced orchestration.

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

#### Using qi-prompt (Context Management)
```bash
# File reference patterns
@package.json analyze dependencies
@src/main.ts explain this code  
@config/llm-providers.yaml check this configuration

# Framework options
./app/qi-prompt --framework hybrid    # Auto-detect (default)
./app/qi-prompt --framework ink       # Rich UI with colors
./app/qi-prompt --framework readline  # Basic terminal
```

#### Using qi-code (Advanced Workflow Orchestration)
```bash
# Development mode
bun run --cwd app qi-code --config-path ../config/llm-providers.yaml --schema-path ../config/qi-prompt.schema.json --env-path ../.env

# Production binary
./app/qi-code --config-path config/llm-providers.yaml --schema-path config/qi-prompt.schema.json --env-path .env
```

## Binary Compilation

```bash
# Build portable binary
bun run build

# Run with configuration
./app/qi-prompt --config-path config/llm-providers.yaml --schema-path config/llm-providers.schema.json --env-path .env --framework hybrid
```

Binary features:
- Single 5.1MB executable 
- No native dependencies
- Complete configuration flexibility
- Cross-platform compatibility (Linux/macOS)

## Storage and State Management

### MCP Integration
- Single storage system using MCP memory server
- Unified persistence architecture 
- QiCore Result<T> functional patterns
- Reliable session and conversation storage

### Implementation Details
- **Frontend**: React/Ink with hybrid framework support
- **Runtime**: Bun with TypeScript
- **State Management**: XState v5 with MCP integration
- **Storage Protocol**: Model Context Protocol
- **Error Handling**: QiCore functional programming patterns

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

## Interface

### Keyboard Controls
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

## Framework Usage

| Component | qi-prompt | qi-code |
|-----------|-----------|---------|
| **Purpose** | Demonstrates context management | Showcases advanced orchestration |
| **Orchestrator** | PromptAppOrchestrator | QiCodeAgent |
| **Sub-Agents** | None | FileOps, Search, Git, Web |
| **Workflows** | Simple patterns | Advanced ReAct, ReWOO, ADaPT |
| **Complexity** | Minimal, focused | Sophisticated multi-agent coordination |
| **Use Cases** | Prompt engineering, context work | Complex coding, multi-step projects |
| **Framework Role** | Simple reference implementation | Advanced framework demonstration |

## Version

**Current**: v-0.10.3 - CLI Framework Fix & Development Experience

### Latest Updates (v-0.10.3)
- Fixed CLI Framework: Resolved "Cannot access 'InkCLIFramework' before initialization" error
- Development Support: Both qi-prompt and qi-code work with `bun run` for development
- Zod Conflict Resolution: Fixed module loading issues that prevented Hybrid CLI initialization
- CLI Argument Parity: qi-code now supports same configuration arguments as qi-prompt
- Production Ready: Built binaries continue to work with improved development experience

### Development Experience
```bash
# Both applications work with CLI arguments during development
bun run --cwd app qi-prompt --config-path ../config/llm-providers.yaml --schema-path ../config/qi-prompt.schema.json --env-path ../.env --framework hybrid
bun run --cwd app qi-code --config-path ../config/llm-providers.yaml --schema-path ../config/qi-prompt.schema.json --env-path ../.env --debug
```

### Release History
- **v-0.8.x**: qi-prompt production-ready with unified MCP storage  
- **v-0.9.x**: Enhanced workflow system with intelligent pattern selection
- **v-0.10.x**: qi-code milestone with tool-specialized sub-agents
- **v-0.10.3**: CLI framework issues resolved, seamless development experience

## Status

Extensible agent framework complete with reference implementations and sub-agent architecture.