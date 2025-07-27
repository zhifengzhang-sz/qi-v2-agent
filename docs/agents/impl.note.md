## Corrected Implementation Plan (Based on Opus4 Reviews)

```bash
●User approved corrected plan after opus4 reviews identified over-engineering:

  ⎿ Plan: Simplified Practical Agent Architecture

    Overview

    Create a simplified, production-ready agent architecture that removes over-engineering 
    while adding essential operational features missing from the original design.

    Key Corrections from Opus4 Reviews:

    REMOVED (Over-engineered):
    - Abstract cognitive patterns layer (unnecessary abstraction)
    - Smart Router container (just a lookup table) 
    - Complex workflow orchestration patterns (99% are simple)
    - Scattered configuration across 5+ containers

    ADDED (Missing essentials):
    - Enhanced multi-signal pattern detection (replaces keyword matching)
    - Operational concerns: retry logic, rate limiting, timeouts, cost tracking
    - Unified configuration system
    - Direct mode-to-tool mapping (no abstract layer)

    Target Architecture (Corrected):

    - Target: Direct cognitive modes (planning, coding, information, debugging, generic)
    - Target: Multi-signal pattern detection with tool requirements validation
    - Target: 4 containers (not 5) - Pattern Recognition, Tool, Workflow Executor, Input
    - Target: Production-ready operational features (missing from original)

    Corrected Migration Plan

    Phase 1: Create Simplified Core Interfaces

    1. Create lib/src/core/:
      - interfaces.ts - Direct, practical interfaces (no abstract patterns)
      - modes.ts - Direct cognitive modes with tool requirements
      - operational.ts - Rate limiting, retry, timeout interfaces

    Phase 2: Implement Enhanced Pattern Detection

    2. Create lib/src/detection/:
      - multi-signal-matcher.ts - Enhanced multi-signal detection algorithm
      - mode-validator.ts - Tool requirements validation
      - context-tracker.ts - Context-aware detection

    Phase 3: Implement Production Tools & Workflow

    3. Create lib/src/execution/:
      - tool-executor.ts - Tool execution with retry/timeout (replaces Tool Container)
      - workflow-orchestrator.ts - Simple orchestration + mode mapping (absorbs Smart Router)
      - operational-handler.ts - Rate limiting, circuit breaker, cost tracking

    Phase 4: Create Main Agent Coordinator

    4. Create lib/src/agent/:
      - practical-agent.ts - Main coordinator (simplified from original)
      - unified-config.ts - Single configuration system
      - agent-factory.ts - Setup utilities for different environments

    Phase 5: Update Application Layer

    5. Update app/src/:
      - Modify CLI commands to use simplified agent
      - Update UI components for new detection results
      - Implement unified configuration loading
      - Add operational monitoring dashboards

    Phase 6: Migration and Testing

    6. Replace Old Implementation:
      - Remove over-engineered abstractions
      - Update all imports to use simplified interfaces  
      - Add comprehensive tests for operational features
      - Performance testing for multi-signal detection

    Key Benefits of Migration

    Architecture Improvements:

    - Technology Independence: Can swap LangGraph/LangChain for alternatives
    - Domain Extensibility: Easy to add legal, medical, research domains
    - Pattern Sophistication: Better intent detection with context awareness
    - Production Readiness: Comprehensive error handling, monitoring, security

    Development Benefits:

    - Type Safety: Full TypeScript interfaces throughout
    - Testability: Mock implementations for unit testing
    - Maintainability: Clear separation of concerns
    - Extensibility: New patterns, tools, and domains easily added

    Implementation Strategy

    Incremental Migration:

    1. Create new architecture alongside existing code
    2. Migrate one command at a time to new system
    3. Run both systems in parallel during transition
    4. Remove old code once migration is complete and tested

    Risk Mitigation:

    - Keep existing implementation as backup during migration
    - Comprehensive testing at each phase
    - Gradual rollout with fallback mechanisms
    - Configuration compatibility maintained

    Success Criteria

    Technical:

    - All existing functionality preserved
    - New cognitive pattern detection working
    - Domain specialization functional
    - Performance targets met (<50ms pattern detection)
    - Comprehensive test coverage

    User Experience:

    - No breaking changes to CLI interface
    - Improved response quality with patterns
    - Better tool selection and usage
    - Enhanced streaming and error handling

    This migration transforms qi-v2 from a functional prototype into a sophisticated, extensible, and 
    production-ready universal agent framework following the architectural excellence documented in docs/agents/.
```