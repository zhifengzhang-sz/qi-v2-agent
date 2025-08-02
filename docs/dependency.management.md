# Dependency Management: Local Package Linking

## Overview

This document explains the complex dependency setup required for linking to local qicore packages and why this "terrible setup" is necessary.

## The Problem

We have a monorepo-like structure where multiple TypeScript projects need to depend on a shared local package (qi-v2-qicore), but they're not in a traditional monorepo managed by tools like Lerna, Rush, or Nx.

```
qi-ecosystem/
├── qi-v2-qicore/typescript/     # Foundation library (@qi)
├── qi-v2-agent/lib/             # This project (@qi/agent)  
├── qi-v2-dp-actor/typescript/   # Data processing (@qi/dp-actor)
└── other-qi-projects/
```

## The Setup Requirements

### 1. Namespace Collision Avoidance
- **qicore** publishes as `@qi` with subpath exports (`@qi/base`, `@qi/core`)
- **Our projects** must use different namespaces to avoid collision:
  - `@qi/agent` (this project)
  - `@qi/dp-actor` (data processing project)

### 2. Local Development vs Production
- **Development**: Need to link to local qicore source for rapid iteration
- **Production**: Will eventually consume published qicore from npm registry
- **Problem**: TypeScript path mapping, build systems, and runtime resolution must all work

## Two Approaches to Local Linking

### Approach 1: `file:` Protocol (Our Current Setup)

```json
{
  "name": "@qi/agent",
  "dependencies": {
    "@qi": "file:../../qi-v2-qicore/typescript"
  }
}
```

**How it works:**
- npm/bun treats the local directory as if it were a published package
- Copies the entire directory into node_modules/@qi
- Uses qicore's package.json exports configuration

**Pros:**
- Simple and straightforward
- Works with any package manager (npm, yarn, bun, pnpm)
- Respects package.json exports exactly as published package would

**Cons:**
- Creates a full copy in node_modules (disk space)
- Changes in qicore require reinstall to see updates
- Less "live" development experience

### Approach 2: `workspace:` Protocol (qi-v2-dp-actor Setup)

```json
{
  "name": "@qi/dp-actor", 
  "dependencies": {
    "@qi": "workspace:../../qi-v2-qicore/typescript"
  }
}
```

**How it works:**
- Package manager creates a symlink to the local directory
- Changes in qicore are immediately visible (live linking)
- Still respects package.json exports

**Pros:**
- Live development - changes appear immediately
- No disk space duplication
- True "workspace" development experience

**Cons:**
- Requires workspace-aware package manager (yarn, pnpm, bun workspaces)
- Slightly more complex setup
- May have edge cases with build tools

## Why This Setup is "Terrible"

### The Fundamental Problem
Modern JavaScript/TypeScript tooling was designed for either:
1. **Published packages**: Download from registry, use normally
2. **Monorepos**: Single root with workspace management

Our situation is neither - we have **related but separate repositories** that need to share code during development.

### The Complexity Chain

1. **TypeScript Path Mapping**: Need `paths` in tsconfig.json for compilation
   ```json
   "paths": {
     "@qi/base": ["../../qi-v2-qicore/typescript/dist/base"],
     "@qi/core": ["../../qi-v2-qicore/typescript/dist/core"]
   }
   ```

2. **Build System**: Must mark qicore as external to avoid bundling
   ```typescript
   // tsup.config.ts
   external: ['@qi', '@qi/base', '@qi/core']
   ```

3. **Runtime Resolution**: Package manager must resolve imports correctly
   ```typescript
   import { Ok, Err } from '@qi/base';  // Must work at runtime
   ```

4. **Subpath Exports**: qicore uses modern package.json exports
   ```json
   "exports": {
     "./base": { "import": "./dist/base.js" },
     "./core": { "import": "./dist/core.js" }
   }
   ```

### Why We Can't Use Simpler Alternatives

#### ❌ Relative Imports
```typescript
import { Ok } from '../../qi-v2-qicore/typescript/dist/base.js';
```
- Breaks when files move
- Exposes internal structure  
- Makes refactoring nightmare
- No clean API boundary

#### ❌ npm link
```bash
npm link ../../qi-v2-qicore/typescript
```
- Global pollution
- Version conflicts across projects
- Doesn't work well with modern build tools
- Fragile and hard to debug

#### ❌ Git Submodules
- Adds git complexity
- Version management nightmare
- Still need build/linking setup
- Doesn't solve the fundamental tooling problem

## Current Working Solution

### Our Setup (qi-v2-agent)
```json
{
  "name": "@qi/agent",
  "dependencies": {
    "@qi": "file:../../qi-v2-qicore/typescript"
  }
}
```

### TypeScript Configuration
```json
{
  "paths": {
    "@qi/base": ["../../qi-v2-qicore/typescript/dist/base"],
    "@qi/core": ["../../qi-v2-qicore/typescript/dist/core"]
  }
}
```

### Build Configuration  
```typescript
// tsup.config.ts
export default defineConfig({
  external: ['@qi', '@qi/base', '@qi/core']
});
```

## Testing the Setup

```bash
# Install dependencies
bun install

# Verify TypeScript compilation
bun run type-check

# Verify build process
bun run build

# Test runtime resolution
bun test-qicore-runtime.js
```

## Future Improvements

### Option 1: True Monorepo
Move all qi projects into a single repository with proper workspace management:
```
qi-monorepo/
├── packages/
│   ├── qicore/
│   ├── agent/
│   └── dp-actor/
└── package.json  # Root workspace config
```

### Option 2: Private Package Registry
Publish qicore to a private npm registry and consume normally:
```json
{
  "dependencies": {
    "@qi": "^1.0.0"  # From private registry
  }
}
```

### Option 3: Git Dependencies with Build Automation
```json
{
  "dependencies": {
    "@qi": "git+ssh://git@github.com/qi-platform/qi-v2-qicore.git#v1.0.0"
  }
}
```

## Conclusion

This setup is "terrible" because we're working around the limitations of the JavaScript/TypeScript ecosystem's assumption about how projects should be organized. However, it's the most practical solution given our constraints:

1. ✅ **Works reliably** across different environments
2. ✅ **Maintains clean APIs** through proper package boundaries  
3. ✅ **Supports development workflow** with local changes
4. ✅ **Prepares for production** where qicore will be published
5. ✅ **Follows established patterns** (same as qi-v2-dp-actor)

The complexity is justified by the benefits of maintaining separate repositories while enabling shared development.