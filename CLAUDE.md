# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

qi-v2 agent is a local AI coding assistant providing Claude Code-like functionality with local LLM support. The project implements a unified chat interface with natural language file operations, code analysis, and workflow automation using a two-container architecture with interface-driven design principles.

## Quick Start

- **Runtime**: Node.js 18+ with Bun for package management
- **Main Interface**: `bun --cwd app src/main.ts unified` for chat interface
- **Configuration**: `config/qi-config.yaml` for model and MCP server settings
- **Build**: Run `bun --cwd lib build && bun --cwd app build` after changes

## Architecture

### Design Philosophy (C4 Framework)
The project follows interface-driven design with two main containers:

```
CLI Container ← → Smart Router Container
(User Interaction)   (AI Intelligence)
```

### Current vs. Proposed Architecture

**Current Implementation (Functional)**:
```
User → CLI Commands → AgentFactory → Smart Router → (Direct LLM | LangGraph + Tools) → Response
```

**Proposed Design (Interface-Driven)**:
```
User → CLI Container → Smart Router Container → Response
       (9 Components)   (9 Components)
```

- **CLI Container**: Command parsing, UI rendering, input handling, workflow execution
- **Smart Router Container**: Request processing, intent analysis, LLM integration, tool orchestration

### Core Principles
- **Smart Routing as Intelligence**: All user input flows through intelligent routing decisions
- **Progressive Enhancement**: Static → Interactive → Workflow commands with increasing AI capability
- **Interface-First Design**: Every component designed for substitutability and testability
- **Local Privacy**: All processing local-only with no external data transmission

### Technology Stack
- **TypeScript** with Ink React for terminal UI
- **LangGraph + LangChain** for agent orchestration
- **Ollama** for local LLM execution
- **MCP servers** for tool integration
- **Zod** for schema validation
- **Commander.js** for CLI argument parsing

## Documentation References

### For Architecture Understanding (PRIORITY)
- **[NEW] Design Documentation**: `docs/design/` - Complete C4 framework architecture with interface contracts
  - **Architecture Overview**: `docs/design/architecture/` - C4 diagrams and system design
  - **Container Contracts**: `docs/design/containers/` - CLI and Smart Router interface specifications  
  - **Component Contracts**: `docs/design/components/` - 18 detailed component interface contracts
- **Design Principles**: `docs/design/README.md` - Interface-driven design philosophy and migration strategy

### For Implementation Work
- **Current Issue**: `docs/study/phase2/core/impl.note.md` - Critical bugs and fixes
- **Fix Guide**: `docs/study/phase2/cli/ink/unified-chat-fixed-impl-guide.md` - Complete implementation blueprint
- **Alternative Approach**: `docs/study/phase2/cli/neo-blessed/neo-blessed-xstate-impl-guide.md` - Recommended high-performance approach
- **Technology Info**: Use `.claude/commands/knowledge.phase2.md` command for latest tech updates

### For Legacy Context
- **Phase 1**: `docs/study/phase1/` - Architecture and reference analysis
- **Phase 2**: `docs/study/phase2/` - MVP implementation (historical reference)
- **Phase 3**: `docs/study/phase3/` - Feature development planning

## Current Status

### Architecture Maturity
- **Design Completeness**: ✅ Complete C4 framework with 18 component interface contracts
- **Implementation Status**: ⚠️ Functional but monolithic (Consistency Score: 4.2/10)
- **Migration Strategy**: ✅ Defined 4-phase evolution path to interface-driven architecture

### Working Components (Current Implementation)
- ✅ CLI infrastructure and commands (`app/src/cli/commands.ts`)
- ✅ Smart routing and intent detection (`lib/src/agent/factory.ts`)
- ✅ LangGraph agent initialization
- ✅ MCP server integration (`lib/src/mcp/`)
- ✅ Terminal UI with streaming (`app/src/ui/SimpleChatApp.tsx`)

### Architecture Gaps (vs. Design)
- ❌ **Missing Container Abstractions**: No formal CLI/Smart Router interfaces
- ❌ **Missing Component Interfaces**: Monolithic `AgentFactory` instead of separated components
- ❌ **No Request Validation**: Security and data integrity concerns
- ❌ **No Session Management**: Limited conversation persistence
- ❌ **No Performance Monitoring**: No metrics or observability

### Key Commands
```bash
# Test current system
bun --cwd app src/main.ts unified   # Unified chat interface
bun --cwd app src/main.ts chat      # Basic chat
bun --cwd app src/main.ts edit file.js "fix bug"    # Workflow commands
bun --cwd app src/main.ts analyze src/             # Code analysis
bun --cwd app src/main.ts config --show            # Show configuration
bun --cwd app src/main.ts servers --list           # List MCP servers
```

## Development Guidelines

### Before Making Changes
1. **Read design docs** from `docs/design/` to understand target architecture
2. **Check component contracts** in `docs/design/components/` for interface specifications
3. **Review implementation gaps** to understand current vs. proposed architecture
4. **Use `/knowledge-phase2`** command for technology information (legacy)

### Architecture Evolution Strategy
1. **Phase 1**: Extract interfaces from existing monoliths (`IAgentFactory` → `ISmartRouter`)
2. **Phase 2**: Implement container contracts with structured error handling
3. **Phase 3**: Add missing components (RequestHandler, ConversationManager, SessionManager)
4. **Phase 4**: Full interface implementation with comprehensive testing

### Testing Strategy
1. **Interface Compliance**: New components must implement defined interface contracts
2. **Functional Testing**: Verify core workflows (edit, analyze, explain commands)
3. **Integration Testing**: Test container communication and error handling
4. **Performance Testing**: Monitor metrics against design requirements

### File Structure (Current)
- `lib/src/` - Smart Router Container implementation (monolithic `AgentFactory`)
- `app/src/` - CLI Container implementation (commands, UI, workflows)
- `config/` - YAML configuration files with Zod validation
- `docs/design/` - **NEW**: Complete interface-driven architecture specification
- `docs/study/` - **LEGACY**: Historical implementation documentation

## Security Notes

- All processing local-only (no external data transmission)
- MCP servers provide sandboxed tool execution
- User confirmation required for destructive operations
- Configuration supports environment variable overrides

---

## Migration Guidance

**For New Development**: Follow interface contracts in `docs/design/components/` to ensure compatibility with target architecture.

**For Refactoring**: Reference `docs/design/README.md` for migration strategy from current monolithic implementation to interface-driven design.

**Implementation Priority**: Focus on extracting interfaces and implementing container contracts before adding new features.

**Consistency Score**: Current implementation has 4.2/10 consistency with design. Target is 9.0+ through systematic interface adoption.

---

**Important**: This project is transitioning from functional prototype to production-ready architecture. Always consult `docs/design/` for target architecture and interface specifications before making changes.