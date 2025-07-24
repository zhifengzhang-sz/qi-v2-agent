# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a local AI coding assistant project designed to provide Claude Code-like functionality with local LLM support. The project is currently in the design and planning phase, with comprehensive architecture documentation but no implementation yet.

## Architecture

The system uses a multi-layered architecture:

### Agent Definition
```
agent = toolbox + pe + llm
```
- **toolbox**: MCP servers + modules (external capabilities)
- **pe**: Process Executor (workflow orchestration) 
- **llm**: Language model interaction layer

### Workflow Hierarchy
- **Macro-workflow**: High-level agent orchestration using LangGraph StateGraph
- **Micro-workflow**: Internal agent prompt chains using n8n visual workflows

### Core Components
1. **User Interface Layer**: Ink + TypeScript CLI with React-based components
2. **Macro-Workflow Layer**: LangGraph with specialized agents (Context, Reasoning, Tool, Response)
3. **Micro-Workflow Layer**: n8n for prompt chain management
4. **Foundation Layer**: LangChain + Ollama for LLM, MCP servers for tools

## Technology Stack

- **Primary Language**: TypeScript
- **Runtime**: Node.js 18+
- **Package Manager**: npm/pnpm
- **UI Framework**: Ink + React for terminal interface
- **Agent Framework**: LangGraph for macro-workflows, n8n for micro-workflows
- **LLM Integration**: LangChain + Ollama for local models
- **Tools**: MCP (Model Context Protocol) servers

## Key Dependencies
```json
{
  "ui": ["ink", "@inkjs/ui", "react"],
  "agents": ["langgraph", "langchain", "langchain-mcp-adapters"],
  "workflows": ["n8n", "n8n-nodes-base"],
  "llm": ["ollama", "@langchain/ollama"],
  "tools": ["commander", "chalk", "inquirer"]
}
```

## Documentation Structure

- `docs/architecture/design.md`: Complete system architecture and technical specifications
- `docs/plan/plan.study.md`: Development plan with technology comparisons and implementation phases

## Development Phases

The project follows a 14-week development plan:
1. **Phase 1 (Weeks 1-2)**: Architecture study and reference implementation analysis
2. **Phase 2 (Weeks 3-6)**: MVP development with basic functionality
3. **Phase 3 (Weeks 7-10)**: Feature development for Claude Code parity
4. **Phase 4 (Weeks 11-14)**: Advanced features and production readiness

## Key Features (Planned)

- Conversational interface for natural language coding requests
- Project intelligence with automatic file discovery and context management
- Local LLM support via Ollama with offline capability
- Tool integration for file operations, shell commands, and Git workflows
- Professional terminal UI with streaming responses and progress indicators

## Configuration

- YAML-based configuration files
- Environment variable support
- User-specific and project-specific settings
- Runtime configuration updates

## Security Considerations

- All processing happens locally
- No external data transmission without consent
- Sandboxed command execution
- User confirmation for destructive operations

## Current Status

This project is in the planning phase. The repository contains comprehensive design documentation but no implementation code yet. Future development should follow the architecture outlined in the design documents.