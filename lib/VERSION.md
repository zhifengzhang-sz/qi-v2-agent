# qi-v2-agent Version History

## v-0.8.3 - Context Optimization
**Date**: 2025-08-22

### Enhancement 3: Context Optimization Implementation

**New Features:**
- **Context Optimization**: Intelligent context optimization to handle large contexts without hitting token limits
- **Token Management**: Provider-specific token limits with smart triggering at 80% threshold
- **Content Scoring**: Advanced algorithm scoring recency, code, Q&A, errors, and structured data
- **Smart Pruning**: Priority-based content selection with partial content fitting capabilities
- **Age-Based Filtering**: Timestamp extraction and age-based content filtering

**Technical Implementation:**
- Extended `IContextManager` interface with 4 new optimization methods
- Created `ContextOptimizer` class with configurable scoring algorithms
- Enhanced `ContextManager` with optimizer integration maintaining Result<T> patterns
- Updated `LangChainPromptHandler` with automatic optimization triggering
- Added provider detection for Ollama (8k), OpenRouter/Claude (32k), GPT-4 (32k)

**Files Added/Modified:**
- `lib/src/context/abstractions/IContextManager.ts` - Extended with optimization methods
- `lib/src/context/impl/ContextOptimizer.ts` - New comprehensive optimization implementation
- `lib/src/context/impl/ContextManager.ts` - Enhanced with optimizer integration
- `lib/src/prompt/impl/LangChainPromptHandler.ts` - Added optimization integration
- `lib/tests/context/ContextOptimizer.test.ts` - Comprehensive test coverage (17 tests)

**Benefits:**
- Eliminates context truncation and model failures from oversized prompts
- Reduces token usage while preserving conversation quality and important content
- Fast optimization (<500ms for 32k context) suitable for real-time conversation
- Maintains backward compatibility with graceful fallback mechanisms

---

## v-0.8.2 - Enhanced Session Persistence
**Date**: 2025-08-22

### Enhancement 1: Session Persistence Implementation

**New Features:**
- **Session Persistence**: Conversations now persist across qi-prompt restarts
- **Auto-save**: Sessions automatically save every 30 seconds and on shutdown  
- **Context Memory**: Key-value storage for session context and metadata
- **Session Management**: List, load, and manage previous conversation sessions
- **SQLite Database**: Robust local storage with proper schema and indexing

**Technical Implementation:**
- Extended `IStateManager` interface with session persistence methods
- Enhanced `StateManager` with SQLite database support
- Added database schema for sessions, context memory, and conversation entries
- Integrated automatic session loading/saving in qi-prompt lifecycle
- Added graceful error handling and database connection management

**Files Added/Modified:**
- `lib/src/state/abstractions/IStateManager.ts` - Extended with session persistence interfaces
- `lib/src/state/impl/StateManager.ts` - Implemented enhanced session persistence
- `lib/src/state/sql/sessions_schema.sql` - Database schema for session storage
- `app/src/prompt/qi-prompt.ts` - Integrated session persistence lifecycle
- Tests added for session persistence functionality

**Benefits:**
- User conversations are preserved across application restarts
- Improved user experience with context continuation
- Foundation for advanced workflow and context management features

---

## v-0.8.1 - QiCore Infrastructure and Tooling
**Date**: 2025-01-17

### Previous Release Features
- Complete QiCore v0.8.1 implementation with external/internal module compliance
- QiCore selective integration implementation
- Enhanced infrastructure and comprehensive tooling support
- Foundation for reliable TypeScript development patterns

---

## Version Notes

This project follows semantic versioning. Each release includes:
- **Major versions**: Breaking changes and significant architectural updates
- **Minor versions**: New features and enhancements (backward compatible)
- **Patch versions**: Bug fixes and minor improvements

For detailed implementation guides and technical documentation, see:
- `docs/roadmap/impl.v-0.8.x.simple.md` - Current implementation roadmap
- Individual module documentation in respective directories