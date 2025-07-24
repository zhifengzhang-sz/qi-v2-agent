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

**v-0.2.2**: Phase 1 study materials refined for consistency. Eliminated n8n complexity from all documentation, unified on simplified 3-layer architecture using official TypeScript SDKs.

## Development

This project follows an **8-10 day development plan** using official TypeScript SDKs:
1. **Phase 1**: Architecture study (✅ Complete)
2. **Phase 2**: SDK-First foundation (Days 1-2)
3. **Phase 3**: Core features (Days 3-4) 
4. **Phase 4**: UI & Security (Days 5-6)
5. **Phase 5**: Production ready (Days 7-8)