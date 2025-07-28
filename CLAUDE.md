# CLAUDE.md

This file provides guidance to Claude Code when working with code in this repository.

## Project Overview

qi-v2 agent is a practical local AI coding assistant providing Claude Code-like functionality with local LLM support. The project implements an **abstract pattern-based cognitive system** with domain specialization, multi-signal pattern detection, and operational reliability using a simplified, production-ready architecture.

## Quick Start

- **Runtime**: Node.js 18+ with Bun for package management
- **Main Interface**: `bun --cwd app src/main.ts unified` for practical agent chat interface
- **Configuration**: Unified YAML configuration system with environment variable support
- **Build**: Run `bun --cwd lib build && bun --cwd app build` after changes

## Architecture Overview

### Practical Agent Architecture

The project implements a straightforward, production-ready architecture based on **opus4 review corrections**:

```
User Input → Pattern Detection → Mode Validation → Workflow Execution → Response
             (Multi-Signal)     (Tool Safety)    (Direct Orchestration)
```

### Core Components

**Detection Layer**:
- **Multi-Signal Pattern Matcher**: Weighted analysis replacing keyword-based detection
- **Mode Validator**: Tool availability and safety validation
- **Context Tracker**: Conversation continuity and session management

**Execution Layer**:
- **Tool Executor**: Production-ready MCP tool execution with retry/timeout
- **Workflow Orchestrator**: Simple orchestration absorbing Smart Router functionality
- **Operational Handler**: Rate limiting, circuit breakers, cost tracking

**Agent Layer**:
- **Practical Agent**: Main coordinator with streaming and error handling
- **Agent Factory**: Simplified creation with development/production modes
- **Unified Configuration**: Single YAML config with environment variable support

### Domain-Specific Modes (from Abstract Patterns)
- **Planning**: Strategic analysis with sequential-thinking tools (from analytical pattern)
- **Coding**: Implementation with filesystem and git tools (from creative pattern)
- **Information**: Knowledge sharing with web-search tools (from informational pattern)
- **Debugging**: Problem resolution with comprehensive tool access (from problem-solving pattern)
- **Generic**: Safe default mode for conversational interactions (from conversational pattern)

### Core Principles
- **Practical Over Abstract**: Direct implementation without over-engineering
- **Operational Reliability**: Rate limiting, retries, circuit breakers, monitoring
- **Local Privacy**: All processing local-only with no external data transmission
- **Production Ready**: Comprehensive error handling and operational features

### Technology Stack
- **TypeScript** with direct interfaces and Zod validation
- **Multi-Signal Detection** replacing abstract cognitive patterns
- **MCP Protocol** for standardized tool integration
- **Ollama** for local LLM execution
- **Operational Services** for production reliability

## Documentation References

### For Architecture Understanding (PRIORITY)
- **[CURRENT] Corrected Agent Documentation**: `docs/agents/` - Practical agent framework
  - **Agent Overview**: `docs/agents/agent.md` - Abstract patterns with domain specialization and tool requirements
  - **Operational Features**: `docs/agents/operational-concerns.md` - Production reliability features
  - **Unified Configuration**: `docs/agents/unified-configuration.md` - Single YAML config system
  - **Architecture Reviews**: `docs/agents/reviews/opus4.md` - Critical corrections removing over-engineering

### For Implementation Work
- **Core Interfaces**: `lib/src/core/` - Direct, practical interfaces
- **Detection Layer**: `lib/src/detection/` - Multi-signal pattern detection and validation
- **Execution Layer**: `lib/src/execution/` - Production tools and workflow orchestration
- **Agent Layer**: `lib/src/agent/` - Main agent implementation and factory

### For Legacy Context (Historical)
- **Previous Design**: `docs/design/` - Over-engineered C4 framework (replaced)
- **Phase Studies**: `docs/study/` - Historical documentation (reference only)

## Current Status

### Architecture Maturity
- **Design Completeness**: ✅ Complete practical agent framework based on opus4 corrections
- **Implementation Status**: ✅ All core components implemented with operational reliability
- **Migration Strategy**: ✅ Ready to replace legacy monolithic implementation

### Working Components (Practical Agent Framework)
- ✅ **Core Interfaces**: Abstract patterns with domain specialization and clear tool requirements (`lib/src/core/`)
- ✅ **Multi-Signal Pattern Detection**: Weighted analysis replacing keyword matching (`lib/src/detection/`)
- ✅ **Production Tool Execution**: MCP integration with retry/timeout/monitoring (`lib/src/execution/`)
- ✅ **Workflow Orchestration**: Simple orchestration absorbing Smart Router functionality
- ✅ **Operational Services**: Rate limiting, circuit breakers, cost tracking
- ✅ **Practical Agent**: Main coordinator with streaming and comprehensive error handling
- ✅ **Unified Configuration**: Single YAML config with environment variable support
- ✅ **Agent Factory**: Development/production modes with mock providers for testing

### Next Implementation Phases  
- 🔄 **Phase 5**: Application layer integration (update CLI/UI to use practical agent)
- 🔄 **Phase 6**: Legacy replacement and comprehensive testing
- 🔄 **Phase 7**: Production deployment and monitoring

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
1. **Read agent docs** from `docs/agents/` to understand practical architecture
2. **Check opus4 reviews** in `docs/agents/reviews/` for architectural corrections
3. **Review implementation** in `lib/src/` to understand current system
4. **Use unified configuration** for consistent configuration management

### Architecture Principles
1. **Direct Implementation**: Use concrete cognitive modes, avoid abstract patterns
2. **Operational Reliability**: Include rate limiting, retries, circuit breakers
3. **Multi-Signal Detection**: Replace keyword matching with weighted analysis
4. **Unified Configuration**: Single YAML file with environment variable support

### Testing Strategy
1. **Mode Detection**: Verify multi-signal pattern matcher accuracy
2. **Tool Validation**: Ensure tool-mode restrictions work correctly
3. **Operational Features**: Test rate limiting, retries, circuit breakers
4. **Workflow Orchestration**: Verify direct mode-to-workflow execution

### File Structure (Current)
- `lib/src/core/` - Direct interfaces and cognitive modes
- `lib/src/detection/` - Multi-signal pattern detection and validation
- `lib/src/execution/` - Production tool execution and workflow orchestration
- `lib/src/agent/` - Main agent implementation and factory
- `app/src/` - CLI application layer (to be updated)
- `docs/agents/` - **CURRENT**: Practical agent architecture documentation
- `docs/design/` - **LEGACY**: Over-engineered architecture (replaced)

## Security Notes

- All processing local-only (no external data transmission)
- MCP servers provide sandboxed tool execution
- User confirmation required for destructive operations
- Configuration supports environment variable overrides

---

## Migration Guidance

**For New Development**: Follow the practical agent architecture in `docs/agents/` with abstract patterns, domain specialization, and operational reliability.

**For Integration**: Use the agent factory to create development or production agent instances with unified configuration.

**Implementation Priority**: The practical agent framework is complete and ready to replace the legacy monolithic implementation.

**Architecture Status**: Implementation is complete and consistent with opus4 corrected design principles.

---

**Important**: This project implements a practical, production-ready agent framework. Always consult `docs/agents/` for current architecture and `docs/agents/reviews/opus4.md` for design corrections.