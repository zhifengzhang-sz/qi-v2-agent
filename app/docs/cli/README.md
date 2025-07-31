# CLI Module Documentation

This directory contains documentation for the CLI module (`app/src/cli/`).

## Contents

### Design Documents
- **cli-design.md** - High-level CLI design and requirements
- **cli-design-impl.md** - Implementation design details
- **command-design-impl.md** - Command system implementation
- **workflow-design.md** - Workflow system design
- **workflow-design-impl.md** - Workflow implementation details
- **workflow-impl.md** - Workflow implementation notes

### Architecture Documents
- **cli-architecture.md** - CLI architecture overview
- **state-management.md** - XState-based state management

## Related Code

The corresponding implementation is in `app/src/cli/`:
- `abstractions/` - CLI interfaces, state machine definitions
- `frameworks/` - Framework-specific implementations (Ink, neo-blessed)
- `impl/` - Core implementations (parsers, handlers, state management)
- `index.ts` - Module exports

## Key Concepts

- Multi-framework CLI support (Ink React, neo-blessed)
- XState 5 hierarchical state machines
- Pluggable CLI architecture
- Command and workflow processing
- Interactive terminal interfaces