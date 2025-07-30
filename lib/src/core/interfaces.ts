// Pure Abstract Interfaces - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.
//
// This file is maintained for backward compatibility.
// All interfaces have been split into focused modules in ./interfaces/
// Use: import from './interfaces/index.js' for new code

// Re-export all interfaces from focused modules
export * from './interfaces/index.js';