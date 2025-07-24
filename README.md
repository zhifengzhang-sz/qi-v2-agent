# Qi V2 Agent

Local AI agent with conversational interface and extensible tool integration.

## Architecture

- **Frontend**: Ink + TypeScript CLI
- **Workflow**: LangGraph (macro) + n8n (micro)
- **LLM**: LangChain + Ollama (local)
- **Knowledge**: ChromaDB vector database
- **Tools**: MCP servers

## Documentation

- [Design Document](docs/architecture/design.md) - Complete system architecture
- [Development Plan](docs/plan/plan.study.md) - Implementation roadmap and technology analysis
- **[Phase 1 Study](docs/study/phase1/README.md)** - LangGraph + MCP implementation analysis with TypeScript trivialization proof

## Current Status

**v-0.2.1**: Phase 1 study complete with conceptual foundation. Added T0: Conceptual Overview explaining LangGraph, LangChain, and MCP fundamentals before implementation details.

## Development

This project follows a 14-week development plan:
1. Architecture study (Weeks 1-2)
2. MVP development (Weeks 3-6) 
3. Feature development (Weeks 7-10)
4. Advanced features (Weeks 11-14)

See the development plan for detailed milestones and technology analysis.