# QiCore-Specialist File Reading Patterns

## Quick File Access Patterns

### External Modules (Two-Layer Architecture)
```bash
# Primary external modules
Read lib/src/agent/PromptAppOrchestrator.ts
Read lib/src/classifier/index.ts
Read lib/src/context/index.ts
Read app/src/prompt/qi-prompt.ts

# External module discovery
Glob lib/src/agent/*.ts
Glob lib/src/classifier/*.ts
Glob app/src/prompt/*.ts
```

### Internal Modules (Direct QiCore)
```bash
# Core internal modules
Read lib/src/messaging/impl/QiAsyncMessageQueue.ts
Read lib/src/context/impl/ContextManager.ts
Read lib/src/state/persistence/StatePersistence.ts
Read lib/src/cli/impl/MessageDrivenCLI.ts

# Internal module discovery
Glob lib/src/messaging/impl/*.ts
Glob lib/src/context/impl/*.ts
Glob lib/src/state/persistence/*.ts
Glob lib/src/cli/impl/*.ts
```

### QiCore Pattern Searches
```bash
# Find QiCore imports
Grep "from.*@qi/base" lib/src/
Grep "from.*@qi/core" lib/src/

# Find Result<T> usage
Grep "Result<.*>" lib/src/
Grep "fromAsyncTryCatch" lib/src/

# Find functional composition
Grep "match\(" lib/src/
Grep "flatMap\(" lib/src/
Grep "success\(" lib/src/
Grep "failure\(" lib/src/

# Find error patterns
Grep "QiError" lib/src/
Grep "create\(" lib/src/
```

### Module Discovery Patterns
```bash
# Find all managers
Glob lib/src/**/*Manager.ts

# Find all implementations
Glob lib/src/**/impl/*.ts

# Find all interfaces/abstractions
Glob lib/src/**/abstractions/*.ts
Glob lib/src/**/interfaces/*.ts

# Find entry points
Glob lib/src/**/index.ts
```

### Verification Commands
```bash
# Verify file existence
Bash test -f lib/src/agent/PromptAppOrchestrator.ts && echo "exists" || echo "missing"

# Find specific files
Bash find lib/src -name "*Context*" -type f
Bash find lib/src -name "*Message*" -type f
Bash find lib/src -name "*Manager*" -type f

# Count files to avoid truncation
Bash find lib/src -name "*.ts" -type f | wc -l
```

## Troubleshooting File Access

### If Glob Returns Truncated Results:
1. Use more specific patterns: `lib/src/agent/*.ts` instead of `**/*.ts`
2. Break into smaller chunks: search one directory at a time
3. Use Bash find commands: `find lib/src -name "*.ts" -maxdepth 2`

### If Files Don't Exist:
1. Verify path with Bash: `find . -name "*filename*"`
2. Check directory structure: `ls -la lib/src/`
3. Report missing files clearly in analysis

### If Analysis Fails:
1. Start with known working files first
2. Use Read tool to verify file contents before analysis
3. Fall back to Grep searches in specific directories
4. Never proceed with analysis if files can't be accessed

## File Priority Order

### High Priority (Always check first):
1. `lib/src/agent/PromptAppOrchestrator.ts` - Main external module
2. `lib/src/messaging/impl/QiAsyncMessageQueue.ts` - Internal module example
3. `lib/src/context/impl/ContextManager.ts` - Internal module example

### Medium Priority:
1. `lib/src/classifier/index.ts` - External API
2. `lib/src/state/persistence/StatePersistence.ts` - Internal persistence
3. `app/src/prompt/qi-prompt.ts` - Main application

### Low Priority:
1. Test files in `lib/tests/`
2. Configuration files
3. Documentation files