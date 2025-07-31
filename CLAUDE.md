# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

qi-v2 agent is a practical local AI coding assistant providing Claude Code-like functionality with local LLM support. The project implements a **three-type input classification system** with abstract cognitive patterns, domain specialization, and production-ready architecture.

## Quick Start

- **Runtime**: Node.js 18+ with Bun for package management
- **Main Interface**: `bun --cwd app src/main.ts unified` for three-type agent chat interface
- **Configuration**: Unified YAML configuration system with environment variable support
- **Build**: Run `bun --cwd lib build && bun --cwd app build` after changes

## Architecture Overview

### Three-Type Classification System

The project implements a modern three-type input classification architecture:

```
User Input → Input Classifier → (Command|Prompt|Workflow) → Handler → Response
             (Complexity Analysis)  (Three Types)         (Specialized)
```

### Core Components

**Input Classification Layer**:
- **Input Classifier**: Three-type classification (command/prompt/workflow)
- **Command Handler**: Direct system command execution  
- **Workflow Extractor**: Complex task workflow extraction

**Execution Layer**:
- **Model Provider**: Direct LLM interaction for prompts (Ollama support)
- **Tool Provider**: Production-ready MCP tool execution with retry/timeout
- **Workflow Engine**: LangGraph-based workflow orchestration

**Agent Layer**:
- **Three-Type Agent**: Main coordinator with streaming and error handling
- **Agent Factory**: Simplified creation with development/production modes
- **Memory Provider**: Optional conversation state management

### Three Input Types
1. **Command**: System functions with `/` prefix (e.g., `/help`, `/config`)
2. **Prompt**: Simple conversational inputs (e.g., "hi", "write a quicksort in haskell")
3. **Workflow**: Complex multi-step tasks requiring tool orchestration

### Abstract Cognitive Patterns
- **Analytical**: Deep analysis and structured reasoning
- **Creative**: Generation and synthesis of new content  
- **Informational**: Knowledge sharing and explanation
- **Problem-solving**: Issue identification and resolution
- **Conversational**: General dialog and interaction

### Core Principles
- **Practical Over Abstract**: Direct implementation without over-engineering
- **Operational Reliability**: Rate limiting, retries, circuit breakers, monitoring
- **Local Privacy**: All processing local-only with no external data transmission
- **Production Ready**: Comprehensive error handling and operational features

### Technology Stack
- **TypeScript** with abstract interfaces following docs/agents/v1/
- **Three-Type Classification** with complexity analysis
- **LangGraph** for workflow orchestration  
- **LangChain** for model provider abstractions
- **MCP Protocol** for standardized tool integration
- **Ollama** for local LLM execution

## Documentation References

### For Architecture Understanding (PRIORITY)
- **[CURRENT] Agent Framework**: `docs/agents/v1/` - Complete agent framework
  - **Abstract Interfaces**: `docs/agents/v1/agent.abstractions.md` - Pure technology-agnostic interfaces
  - **Implementation Guide**: `docs/agents/v1/agent.impl.md` - Concrete LangGraph/LangChain/MCP implementations
  - **Three-Type Classification**: Input classification with command/prompt/workflow types

### For Implementation Work (Component-Based Structure)
- **Core Interfaces**: `lib/src/core/interfaces.ts` - All abstract interfaces from docs/agents/v1/
- **Input Classification**: `lib/src/impl/classifiers/input-classifier.ts` - Three-type input classification
- **Command Handling**: `lib/src/impl/commands/command-handler.ts` - Built-in command system
- **Prompt Processing**:
  - `lib/src/impl/prompts/prompt-handler.ts` - Prompt orchestration and template rendering
  - `lib/src/impl/prompts/prompt-manager.ts` - Template and model configuration management
- **Model Integration**:
  - `lib/src/impl/models/ollama-model-provider.ts` - Local Ollama LLM support
  - `lib/src/impl/models/model-routing-engine.ts` - Provider selection logic
- **Workflow Processing**:
  - `lib/src/impl/workflows/workflow-extractor.ts` - Natural language to workflow conversion
  - `lib/src/impl/workflows/langgraph-workflow-engine.ts` - LangGraph orchestration
- **Tool Integration**: `lib/src/impl/tools/mcp-tool-provider.ts` - MCP tool integration
- **Memory Management**: `lib/src/impl/memory/memory-provider.ts` - Conversation state persistence
- **Agent Coordination**: `lib/src/impl/agents/three-type-agent.ts` - Main agent coordinator

## Current Status

### Architecture Maturity
- **Design Completeness**: ✅ Complete three-type classification agent framework
- **Implementation Status**: ✅ All core components implemented following docs/agents/v1/
- **Migration Strategy**: ✅ Ready for application layer integration

### Working Components (Three-Type Agent Framework)
- ✅ **Core Interfaces**: Complete abstract interfaces from docs/agents/v1/ (`lib/src/core/interfaces.ts`)
- ✅ **Input Classification**: Three-type classification with complexity analysis (`lib/src/impl/classifiers/input-classifier.ts`)
- ✅ **Command System**: Built-in commands with extensible registration (`lib/src/impl/commands/command-handler.ts`)
- ✅ **Prompt Processing**: Template rendering and model integration (`lib/src/impl/prompts/`)
- ✅ **Model Providers**: Ollama local LLM support with routing (`lib/src/impl/models/`)
- ✅ **Workflow Engine**: LangGraph StateGraph orchestration (`lib/src/impl/workflows/`)
- ✅ **Tool Integration**: MCP protocol with retry/timeout/monitoring (`lib/src/impl/tools/mcp-tool-provider.ts`)
- ✅ **Memory Management**: Conversation state and session handling (`lib/src/impl/memory/memory-provider.ts`)
- ✅ **Agent Coordination**: Three-type agent coordinator (`lib/src/impl/agents/three-type-agent.ts`)

### Next Implementation Phases  
- 🔄 **Phase 5**: Application layer demos and integration
- 🔄 **Phase 6**: Memory provider implementation
- 🔄 **Phase 7**: Production deployment and monitoring

### Key Commands
```bash
# Build and test current system
bun --cwd lib build && bun --cwd app build

# Test components (upcoming demos)
bun --cwd app src/demo-input-classification.ts    # Input classification demo
bun --cwd app src/demo-pattern-recognition.ts     # Pattern recognition demo  
bun --cwd app src/demo-workflow-extraction.ts     # Workflow extraction demo
bun --cwd app src/demo-workflow-engine.ts         # Workflow engine demo

# Main agent interface (to be implemented)
bun --cwd app src/main.ts unified   # Three-type agent interface
```

## Development Guidelines

### Before Making Changes
1. **Read architecture docs** from `docs/agents/v1/` to understand the three-type classification system
2. **Review abstract interfaces** in `docs/agents/v1/agent.abstractions.md` 
3. **Check implementation guide** in `docs/agents/v1/agent.impl.md` for technology mapping
4. **Review current implementation** in `lib/src/` to understand system components

### Architecture Principles
1. **Three-Type Classification**: All inputs classified as command/prompt/workflow
2. **Abstract Interfaces**: Technology-agnostic interfaces from docs/agents/v1/
3. **Complexity Analysis**: Sophisticated input analysis replacing simple keyword matching
4. **Local Privacy**: All processing local-only with no external data transmission

### Input Classification Rules
- **"hi"** → **prompt** (greeting detected in promptIndicators)
- **"write a quicksort in haskell"** → **prompt** (simple conversational coding request)
- **"/help"** → **command** (starts with command prefix)
- **"fix bug in src/file.ts and run tests"** → **workflow** (multi-step task with file references)

### Testing Strategy
1. **Input Classification**: Test three-type classification accuracy
2. **Pattern Recognition**: Verify cognitive pattern detection
3. **Workflow Extraction**: Test complex task extraction
4. **Tool Integration**: Ensure MCP tool execution works correctly

### File Structure (Component-Based Architecture)

```
lib/src/impl/
├── agents/                    # 🤖 Main agent implementations
│   ├── three-type-agent.ts    # Primary agent coordinator
│   └── agent.ts               # Base agent implementation
├── classifiers/               # 🔍 Input classification components
│   ├── input-classifier.ts    # Three-type classification
│   └── pattern-matcher.ts     # Pattern recognition utilities
├── commands/                  # ⚡ Command processing
│   └── command-handler.ts     # Built-in command system
├── config/                    # ⚙️ Configuration management (ready for implementation)
├── models/                    # 🧠 Model providers and routing
│   ├── ollama-model-provider.ts
│   └── model-routing-engine.ts
├── prompts/                   # 💬 Prompt processing pipeline  
│   ├── prompt-handler.ts      # Template rendering and orchestration
│   └── prompt-manager.ts      # Configuration management
├── workflows/                 # 🔄 Workflow processing engine
│   ├── workflow-extractor.ts  # Natural language → WorkflowSpec
│   └── langgraph-workflow-engine.ts  # LangGraph execution
├── tools/                     # 🛠️ Tool integration
│   └── mcp-tool-provider.ts   # MCP protocol implementation
├── memory/                    # 💾 Memory and state management
│   └── memory-provider.ts     # Conversation persistence
└── utils/                     # 🔧 Cross-cutting utilities
    └── operational-reliability.ts  # Production reliability features
```

**Key Directories**:
- `lib/src/core/interfaces.ts` - All abstract interfaces from docs/agents/v1/
- `lib/src/impl/` - Component-based concrete implementations
- `app/src/` - Application layer and demos  
- `docs/agents/v1/` - **CURRENT**: Complete agent framework documentation

## Security Notes

- All processing local-only (no external data transmission)
- MCP servers provide sandboxed tool execution
- User confirmation required for destructive operations
- Configuration supports environment variable overrides

---

## Implementation Guidance

**For New Development**: Follow the three-type classification architecture in `docs/agents/v1/` with abstract interfaces and concrete technology implementations.

**For Integration**: Use the agent factory with input classifier, model provider, tool provider, and workflow engine components.

**Implementation Priority**: The three-type agent framework is complete and ready for application layer integration.

**Architecture Status**: Implementation is complete and consistent with docs/agents/v1/ abstract interface design.

---

**Important**: This project implements a three-type input classification agent framework. Always consult `docs/agents/v1/` for current architecture, with `agent.abstractions.md` for interfaces and `agent.impl.md` for implementation guidance.