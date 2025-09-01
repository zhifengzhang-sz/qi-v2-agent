# @qi/agent Project Structure

Clean, minimal structure for the @qi/agent package with four-module architecture.

## Directory Structure

```
@qi/agent/
├── lib/src/                              # Core source code
│   ├── index.ts                          # Main package exports
│   ├── context-engineering/              # Context optimization module
│   │   └── index.ts                      # Context engineering interfaces
│   ├── workflow-engine/                  # AutoGen abstraction module  
│   │   └── index.ts                      # Workflow orchestration interfaces
│   ├── sub-agent/                        # AgentChat abstraction module
│   │   └── index.ts                      # Single-agent execution interfaces
│   └── tools/                            # Tool management module
│       └── index.ts                      # Tool registry and MCP integration
├── docs/                                 # Documentation
│   ├── PROJECT-STRUCTURE.md              # This file
│   └── modules/                          # Module-specific documentation
│       ├── context-engineering.md        # Context engineering guide
│       ├── workflow-engine.md            # Workflow engine guide
│       ├── sub-agent.md                  # Sub-agent guide
│       └── tools.md                      # Tools guide
├── package.json                          # Package configuration
├── README.md                             # Main project documentation
├── tsconfig.json                         # TypeScript configuration
└── tsconfig.build.json                   # Build-specific TypeScript config
```

## Module Architecture

### 🧠 Context Engineering (`lib/src/context-engineering/`)
- Advanced context optimization and token management
- RAG integration with Chroma MCP
- Cache strategies and dynamic adaptation

### 🔄 Workflow Engine (`lib/src/workflow-engine/`)
- AutoGen framework abstraction
- Multi-agent coordination and planning
- ReAct, ReWOO, and ADaPT strategies

### 🤖 Sub-Agent (`lib/src/sub-agent/`)  
- AgentChat framework abstraction
- Single-agent task execution
- Conversation management and tool coordination

### 🛠️ Tools (`lib/src/tools/`)
- Comprehensive tool registry and execution
- Model Context Protocol (MCP) integration
- Tool discovery and lifecycle management

## Key Features

- **Clean Interfaces Only**: No implementation details, only TypeScript interfaces
- **QiCore Integration**: Result<T> patterns and error handling
- **Framework Abstractions**: Clean abstractions over AutoGen/AgentChat
- **Professional Architecture**: Production-ready design patterns
- **Zero Dependencies**: Only peer dependencies on QiCore packages

## Development Status

This is Phase 1 of the @qi/agent restructuring. The project contains:
- ✅ Complete interface definitions for all four modules
- ✅ Comprehensive documentation and usage guides  
- ✅ Clean TypeScript configuration
- ✅ Proper package exports and peer dependencies

Phase 2 will implement the actual AutoGen/AgentChat adapter functionality.