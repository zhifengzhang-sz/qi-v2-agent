# Workflow Module Documentation

This directory contains documentation for the workflow module (`app/src/workflow/`).

## Contents

- **workflow-architecture.md** - Workflow system architecture and design
- **integration-guide.md** - CLI integration and usage patterns  
- **api-reference.md** - Interface and implementation documentation
- **examples.md** - Usage examples and patterns

## Related Code

The corresponding implementation is in `app/src/workflow/`:
- `interfaces/` - TypeScript interfaces (IWorkflow, IWorkflowExtractor, IWorkflowEngine)
- `impl/` - Concrete implementations (QiWorkflowExtractor, QiWorkflowEngine)
- `index.ts` - Module exports and factory functions

## Key Concepts

- **Workflow Extraction**: Convert natural language to executable workflow specifications
- **Workflow Execution**: Execute multi-step workflows with state management
- **CLI Integration**: Seamless integration with command-line interface
- **Pattern Recognition**: Cognitive pattern detection for workflow optimization
- **Streaming Support**: Real-time workflow execution updates

## Quick Start

```typescript
import { createWorkflowExtractor, createWorkflowEngine } from '@qi/workflow';

// Create components
const extractor = createWorkflowExtractor();
const engine = createWorkflowEngine();

// Extract workflow from natural language
const result = await extractor.extractWorkflow(
  'create a React component and write tests for it'
);

// Execute workflow
if (result.success && result.workflowSpec) {
  const workflow = engine.createWorkflow(result.pattern);
  const execution = await engine.execute(workflow, initialState);
}
```

## Demo Scripts

- `bun run demo:workflow-extractor` - Test workflow extraction
- `bun run demo:workflow-integration` - Test CLI integration