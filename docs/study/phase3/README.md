# Phase 3: Core Features (Days 3-4)

## Overview

**Phase 3 Objective**: Essential functionality with RAG and streaming (Days 3-4 of 8-10 day total implementation)

**Prerequisites**: Phase 2 complete - SDK-First Implementation with basic agent and MCP integration

**Goal**: Transform basic agent into a feature-rich assistant with semantic understanding and advanced capabilities

## Research-First Approach ✅ **COMPLETED**

All Phase 3 implementation guides are based on comprehensive research of current technologies conducted in January 2025. See [research-findings-summary.md](./research-findings-summary.md) for detailed findings on:

- ChromaDB TypeScript integration & LangChain patterns  
- LangGraph streaming capabilities & real-time responses
- RAG implementation patterns with TypeScript & Ollama
- MCP server ecosystem & advanced tool integration
- Semantic search & context management approaches
- Multi-turn conversation management patterns

## Phase 3 Integration Approach ✅ **ARCHITECTURE-ALIGNED**

**Core Principle**: **Extend existing Phase 2 components** rather than creating new standalone systems

### Integration Strategy

**Primary Integration Point**: `lib/src/agent/factory.ts` (`qi-v2 agentFactory` class)
- All Phase 3 enhancements extend the existing factory pattern
- Maintains backward compatibility with Phase 2 functionality  
- Enables gradual feature adoption through configuration flags

### Day 3: Agent & RAG Implementation

**Morning: Enhanced Streaming (T3-1)**
- **Extend `qi-v2 agentFactory`** with `streamWithMode()` method
- **Add streaming capabilities** to existing agent (not replace)
- **Update existing types** in `lib/src/utils/types.ts`
- **Integrate with existing CLI** commands

**Afternoon: RAG Integration (T3-2)**
- **Enhance `qi-v2 agentFactory.initialize()`** to optionally include RAG
- **Add `invokeWithRAG()`** method extending existing `invoke()`
- **Update existing config schema** to include optional RAG settings
- **ChromaDB integration** as new dependency, not replacement

**Evening: Advanced Context (T3-3)**
- **Add `invokeWithAdvancedContext()`** to `qi-v2 agentFactory`
- **Integrate semantic search** with existing RAG pipeline
- **Enhance existing configuration** with context assembly options
- **CLI integration** with advanced context options

### Day 4: Tool Integration

**Morning: MCP Enhancement**
- **T4-1: Advanced MCP Integration**
  - Multi-server tool auto-loading with security focus
  - Integration with official MCP servers (filesystem, git)
  - Error handling and server health monitoring

**Afternoon: File & Shell Operations**
- **T4-2: File Operation Tools**
  - Enhanced file manipulation beyond basic read/write
  - Multi-file operations and batch processing
  - Integration with ChromaDB for file indexing

**Evening: Command Integration & Display**
- **T4-3: Shell Command Integration**
  - Safe command execution with proper validation
  - Sandboxed execution environment
  - Security measures and audit logging

- **T4-4: Tool Result Processing**
  - Professional output formatting for terminal UI
  - Streaming result display with progress indicators
  - Error handling and user feedback

## Documentation Structure

```
docs/study/phase3/
├── README.md                           # This overview document ✅
├── research-findings-summary.md        # Research foundation ✅  
├── T3-1-streaming-agent.md             # LangGraph streaming implementation
├── T3-2-chromadb-rag.md               # RAG system with ChromaDB
├── T3-3-context-retrieval.md          # Semantic search and context management
├── T3-4-conversation-history.md       # Multi-turn conversation support
├── T4-1-advanced-mcp.md               # Enhanced MCP tool integration
├── T4-2-file-operations.md            # Advanced file manipulation
├── T4-3-shell-integration.md          # Command execution and safety
├── T4-4-tool-results.md               # Result processing and display
└── phase3-validation.md               # Testing and validation checklist
```

## Success Criteria

### Day 3 Complete
- [ ] **Streaming Agent**: Real-time responses with multiple streaming modes
- [ ] **ChromaDB Integration**: Vector database indexes and searches codebase semantically  
- [ ] **Context Retrieval**: Semantic search with relevance ranking and SEM-RAG patterns
- [ ] **Conversation Memory**: Multi-turn conversation history persists across sessions

### Day 4 Complete
- [ ] **MCP Tool Loading**: Multiple servers auto-load tools with security validation
- [ ] **File Operations**: Advanced file manipulation with batch processing capabilities
- [ ] **Shell Integration**: Commands execute safely with proper sandboxing and validation
- [ ] **Professional Display**: Tool results show with streaming updates and progress indicators

### Phase 3 Exit Criteria
- [ ] **Feature-Rich Agent**: Ready for UI development (Phase 4) with comprehensive capabilities
- [ ] **RAG-Powered Intelligence**: Provides intelligent codebase understanding and semantic search
- [ ] **Advanced Tool Integration**: Supports complex development workflows with multiple MCP servers
- [ ] **Production Foundation**: Secure, performant foundation ready for security hardening and polish

## Key Technologies & Dependencies

### Core Technologies (Research-Validated)
- **@langchain/langgraph v0.3.11+**: Advanced streaming agent with built-in memory management
- **@langchain/community**: ChromaDB integration for vector database operations
- **chromadb**: Local vector database for semantic search capabilities
- **@langchain/ollama**: Local LLM integration with Ollama for offline operation
- **@modelcontextprotocol/sdk**: Official MCP client for tool integration

### Implementation Stack
```json
{
  "vectorDatabase": "chromadb (local Docker instance)",
  "embeddings": "OllamaEmbeddings with nomic-embed-text",
  "llm": "ChatOllama with configurable models",
  "streaming": "LangGraph built-in streaming modes",
  "memory": "Thread-scoped checkpoints with vector persistence",
  "tools": "Official MCP servers + custom integrations"
}
```

## Architecture Patterns

### RAG Implementation Pattern
```
User Query → Query Embedding → ChromaDB Semantic Search → 
Context Retrieval → LLM Context Injection → Streaming Response
```

### Memory Management Pattern  
```
Conversation Input → LangGraph State Update → ChromaDB Persistence →
Thread-Scoped Checkpoint → Multi-turn Context Continuity
```

### Tool Integration Pattern
```
MCP Host (Agent) → MCP Client → MCP Server → Tool Execution → 
Result Processing → Streaming Display → Context Update
```

## Integration Points with Existing Codebase

### Existing Phase 2 Components (Enhanced, Not Replaced)

**`lib/src/agent/factory.ts`** - **Primary Integration Point**
```typescript
// Existing methods (Phase 2) - maintained
- initialize(): Promise<void>
- invoke(messages, threadId?): Promise<AgentResponse>  
- stream(messages, options?, threadId?): Promise<void>
- healthCheck(): Promise<boolean>

// New methods (Phase 3) - additive enhancements
+ streamWithMode(messages, streamMode, options?, threadId?): Promise<void>
+ invokeWithRAG(messages, options?): Promise<AgentResponse>
+ invokeWithAdvancedContext(messages, options?): Promise<AgentResponse>
+ indexCodebase(path, force?): Promise<void>
```

**`lib/src/config/schema.ts`** - **Configuration Extension**
```typescript
// Existing QiConfigSchema (Phase 2) - maintained
interface QiConfig {
  model: ModelConfig;
  mcp: MCPConfig;
  memory: MemoryConfig;
  // New optional additions (Phase 3)
  rag?: RAGConfig; // ✅ Optional - backward compatible
}
```

**`app/src/cli/commands.ts`** - **CLI Enhancement**  
```typescript
// Existing commands (Phase 2) - enhanced with new options
- chat: Add --stream-mode, --intent, --scope, --advanced-context options
+ index: New command for codebase indexing
```

### New Components (Supporting Existing Architecture)

**`lib/src/rag/`** - **New Module**
- `rag-pipeline.ts`: ChromaDB integration
- `document-processor.ts`: Codebase indexing
- `context-manager.ts`: Semantic search

**`lib/src/context/`** - **New Module** 
- `semantic-search-engine.ts`: Advanced search patterns
- `context-assembler.ts`: Context optimization

### Backward Compatibility Guarantee

- **Phase 2 functionality** continues to work unchanged
- **New features** are opt-in via configuration flags
- **Graceful degradation** when advanced features are disabled
- **Existing CLI commands** maintain same behavior with optional enhancements

## Security & Performance Considerations

### Security Priorities (Research-Informed)
- **MCP Security**: Address 2025 security concerns with proper validation and access controls
- **Tool Permissions**: Implement granular permissions for all MCP server interactions  
- **Input Sanitization**: Protect against prompt injection and malicious inputs
- **Audit Logging**: Track all tool usage and system interactions

### Performance Targets
- **RAG Response Time**: <2 seconds for semantic search queries
- **Streaming Latency**: <200ms for real-time response streaming  
- **Memory Usage**: <500MB for large codebase indexing
- **Tool Execution**: <5 seconds for complex multi-file operations

## Development Workflow

### Day 3 Workflow
1. **Morning**: Set up streaming agent and test multiple streaming modes
2. **Afternoon**: Deploy ChromaDB locally and implement basic RAG pipeline  
3. **Evening**: Implement context retrieval and conversation memory

### Day 4 Workflow  
1. **Morning**: Integrate multiple MCP servers with security focus
2. **Afternoon**: Implement advanced file operations and shell integration
3. **Evening**: Polish tool result display and complete validation testing

## Validation & Testing

Each implementation guide includes:
- **Unit Tests**: Core functionality testing with realistic scenarios
- **Integration Tests**: End-to-end workflow testing with multiple components
- **Performance Tests**: Benchmarking against success criteria targets
- **Security Tests**: Validation of security measures and access controls

## Next Steps After Phase 3

**Phase 4 (Days 5-6): UI & Security**
- Professional terminal interface with Ink components
- Security hardening with 2025 best practices
- Interactive command handling and user experience polish

**Phase 5 (Days 7-8): Production Ready**
- Comprehensive testing suite and performance optimization
- Build system and deployment preparation
- Documentation and distribution setup

This Phase 3 plan leverages current research findings to implement sophisticated AI assistant capabilities while maintaining the SDK-first approach that made Phase 2 successful. The foundation established here enables the advanced features needed for Claude Code parity.