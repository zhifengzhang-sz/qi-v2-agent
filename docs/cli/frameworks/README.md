# CLI Frameworks

This directory contains documentation for different CLI framework implementations.

## Available Frameworks

### 🖥️ [Hybrid Framework](./hybrid/)
**Claude Code-style Input Navigation**
- Sophisticated cursor navigation with multiline support
- Dual-purpose arrow keys (cursor movement + history navigation)
- Immutable cursor operations with boundary detection
- Seamless integration with Ink for rendering

**Key Features:**
- ✅ Claude Code navigation parity
- ✅ Cursor-first, history-fallback behavior
- ✅ Proper multiline text editing
- ✅ Clean separation of concerns

**Best For:** Advanced text input scenarios requiring sophisticated navigation

### ⚛️ Ink Framework
**React-based Terminal UI**
- JSX components for terminal interfaces
- React hooks and state management
- Rich component ecosystem

**Best For:** Complex UI layouts with React familiarity

### 📟 Neo-Blessed Framework
**Traditional Terminal Widgets**
- Low-level terminal control
- Widget-based architecture
- High performance

**Best For:** Performance-critical or traditional terminal applications

### 📝 Pure CLI Framework
**Minimal Readline Interface**
- Lightweight implementation
- Fast startup times
- Basic functionality

**Best For:** Simple command-line tools or resource-constrained environments

## Framework Selection Guide

| Use Case | Recommended Framework | Reason |
|----------|----------------------|---------|
| Advanced text editing | Hybrid | Claude Code navigation |
| Complex UI layouts | Ink | React component model |
| High performance needs | Neo-Blessed | Low overhead |
| Simple command tools | Pure CLI | Minimal footprint |

## Implementation Location

Framework implementations are located in:
- **Code:** `/lib/src/cli/frameworks/`
- **Documentation:** `/docs/cli/frameworks/`

Each framework follows the same interface contracts defined in the [CLI module](../README.md).