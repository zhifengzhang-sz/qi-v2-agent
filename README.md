# Qi V2 Agent

Local AI agent with conversational interface and extensible tool integration.

## Architecture

- **Frontend**: Ink + TypeScript CLI
- **Workflow**: LangGraph.js v0.3.11+ (unified orchestration)
- **LLM**: LangChain + Ollama (local)
- **Knowledge**: ChromaDB vector database
- **Tools**: MCP servers (official SDK integration)

## Documentation

- [Design Document](docs/architecture/design.md) - Complete system architecture
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

**v-0.2.3**: Complete SDK-first implementation with 2-layer architecture. Features LangGraph agent factory, MCP integration, Ollama LLM support, professional terminal UI, and comprehensive test suite. 1,200+ lines of production-ready TypeScript achieving 80%+ complexity reduction through official SDKs.

## Quick Start

```bash
# Install dependencies
bun install

# Run verification checks
bun run check

# Start development
bun run dev

# Chat with the agent
bun run chat --config config/qi-config.yaml
```

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