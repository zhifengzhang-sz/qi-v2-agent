# qi-v2 agent

Practical local AI coding assistant with CLI interface, three-type input classification, and LangChain template-based context continuation.

## Architecture

### Core System (v0.3.0)
- **Three-Type Classification**: Command, Prompt, Workflow input routing
- **Context Continuation**: LangChain ChatPromptTemplate with conversation history
- **Agent Coordination**: Session-based context management with security isolation
- **Local LLM**: Ollama integration with multi-llm-ts for provider abstraction
- **CLI Interface**: Command-line interface with built-in command system

### Technology Stack
- **TypeScript**: Type-safe implementation with abstract interfaces
- **LangChain**: Structured prompt templates and message handling
- **Ollama**: Local LLM execution and model management
- **MCP Protocol**: Tool integration (planned)
- **LangGraph**: Workflow orchestration (planned)

## Documentation

### Usage
- **[Ollama Setup Guide](docs/usage/ollama-setup.md)** - Complete setup and usage instructions

### Architecture
- **[Design Documentation](docs/design/README.md)** - Complete C4 framework architecture with interface contracts
- [Legacy Design Document](docs/architecture/design.md) - Original system architecture reference
- [Development Plan](docs/plan/plan.study.md) - Implementation roadmap and technology analysis
- **[Phase 1 Study](docs/study/phase1/README.md)** - LangGraph + MCP implementation analysis with TypeScript trivialization proof

## Study Setup

The Phase 1 study analyzes external repositories to understand implementation patterns. To reproduce the study findings:

```bash
# Clone the reference implementations (analyzed in Phase 1)
cd study/phase1

# Main implementation example
git clone https://github.com/teddynote-lab/langgraph-mcp-agents.git

# Official LangChain MCP integration library (Python)
git clone https://github.com/langchain-ai/langchain-mcp-adapters.git

# The study documents reference files in this structure:
# study/phase1/langgraph-mcp-agents/app.py
# study/phase1/langgraph-mcp-agents/utils.py  
# study/phase1/langchain-mcp-adapters/langchain_mcp_adapters/client.py
# etc.
```

**Note**: External repositories are used for analysis only and are not checked into this project.

## Current Status

**v0.3.0**: CLI + Agent with Command, Prompt & Context Continuation capabilities:

### ✅ Implemented Features
- **Three-Type Input Classification**: Commands (`/help`), Prompts (`hello`), Workflows (multi-step tasks)
- **Context Continuation**: LangChain ChatPromptTemplate with conversation history across sessions
- **Agent Coordination**: Session-to-context mapping with proper conversation state management
- **Command System**: Built-in commands for model, status, configuration management
- **Prompt Templates**: 5 specialized templates (coding, educational, debugging, problem-solving, default)
- **Local LLM Integration**: Ollama provider with multi-llm-ts abstraction
- **Security Isolation**: Context boundaries and security restrictions for sub-agents

### 🧪 Testing
```bash
# Test context continuation
bun --cwd app run test:context

# Test LangChain integration  
bun --cwd app run test:langchain

# Run all demos
bun --cwd app run demo:three-type
```

## Quick Start

```bash
# Install dependencies
bun install

# Build components
bun --cwd lib build && bun --cwd app build

# Test the system
bun --cwd app run test:context    # Context continuation
bun --cwd app run test:langchain  # LangChain templates

# Run demos
bun --cwd app run demo:three-type        # Input classification
bun --cwd app run demo:context-manager   # Context management
```

📖 **For complete setup with Ollama, configuration, and usage instructions, see [Ollama Setup Guide](docs/usage/ollama-setup.md)**

## Scripts

- `bun run check` - Run TypeScript + linting + tests
- `bun run test` - Run unit tests
- `bun run build` - Build the project
- `bun run dev` - Start in development mode

## Development

This project follows an **8-10 day development plan** using official TypeScript SDKs:
1. **Phase 1**: Architecture study (✅ Complete)
2. **Phase 2**: SDK-First foundation (✅ Complete - v-0.2.3)
3. **Phase 3**: Core features (Next)
4. **Phase 4**: UI & Security 
5. **Phase 5**: Production ready