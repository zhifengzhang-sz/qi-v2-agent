# @qi/agent Version Scheme

## Current Version: v-0.1.0-alpha.1

### Version Format: `v-MAJOR.MINOR.PATCH[-PRERELEASE]`

## Version History

### v-0.1.0-alpha.1 (2025-09-01)
**Phase 1: Clean Architecture & Interfaces Only**

- ✅ **Complete restructure** to @qi/agent package 
- ✅ **Four-module architecture**: context-engineering, workflow-engine, sub-agent, tools
- ✅ **Clean abstractions** over Microsoft AutoGen/AgentChat frameworks
- ✅ **Interface-only implementation** with QiCore Result<T> patterns
- ✅ **Comprehensive documentation** with usage guides
- ✅ **TypeScript configuration** and build system
- ⚠️ **Peer dependencies** declared but @qi/amsg and @qi/cli don't exist yet

**Limitations:**
- Interface definitions only, no implementations
- Missing @qi/cli and @qi/amsg packages (need extraction from current codebase)
- Cannot be used in production until QiCore migration complete

**Next Phase:** v-0.2.0-alpha.1 will extract @qi/cli and @qi/amsg packages

## Version Scheme Rules

### Major Version (v-0.x.x → v-1.x.x)
- **v-0.x.x**: Pre-release development, missing dependencies
- **v-1.0.0**: Initial stable release with complete QiCore ecosystem
- **v-2.0.0**: Future major architectural changes

### Minor Version (v-x.Y.x)
- **New modules** or significant feature additions
- **QiCore package** extractions and integrations
- **API expansions** (backwards compatible)

### Patch Version (v-x.x.Z)
- **Bug fixes** in existing interfaces
- **Documentation** updates
- **Build system** improvements

### Pre-release Identifiers
- **alpha.N**: Early development, missing dependencies
- **beta.N**: Feature complete, dependencies available, testing phase
- **rc.N**: Release candidate, production ready

## Phase Roadmap

### Phase 1: Clean Architecture (v-0.1.0-alpha.1) ✅
- Interface definitions and package structure
- Missing @qi/cli and @qi/amsg packages

### Phase 1.5: QiCore Package Extraction (v-0.2.0-alpha.1)
- Extract @qi/cli package from current codebase
- Extract @qi/amsg package from current codebase
- Validate peer dependency integration

### Phase 2: Framework Adapters (v-0.3.0-alpha.1)
- AutoGen adapter implementation
- AgentChat adapter implementation
- MCP integration functionality

### Phase 3: Context Engineering (v-0.9.0-beta.1)
- RAG implementation with Chroma MCP
- Token optimization algorithms
- Cache strategies

### Phase 4: Production Ready (v-1.0.0)
- Complete QiCore ecosystem integration
- Full feature implementation
- Comprehensive testing
- Production documentation