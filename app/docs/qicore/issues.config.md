# QiCore Config Module API Design Issues

## Summary

The QiCore Config module forces developers into **anti-pattern manual Result unwrapping** instead of enabling clean functional composition. While the core architecture is sound (fluent ConfigBuilder + functional Result<T>), the Promise<Result<T>> return types break composition chains and force imperative code.

## Core Problem: Promise<Result<T>> Anti-Patterns

The Config module's async methods return `Promise<Result<T>>`, which forces developers into manual Result unwrapping anti-patterns instead of clean functional composition.

### Issue 1: Manual Result Unwrapping Anti-Pattern

**Current Forced Anti-Pattern:**
```typescript
// ❌ ANTI-PATTERN: Manual Result unwrapping (what developers must write)
const result = await ConfigBuilder
  .fromYamlFile('./config.yaml')
  .then(result => result.tag === 'success'  // ← Manual Result checking!
    ? result.value
        .merge(ConfigBuilder.fromEnv('STUDY_'))
        .validateWith(schema)
        .build()
        .flatMap(config => runStudy(config))
    : result
  );
```

**Desired Functional Pattern:**
```typescript
// ✅ CLEAN: Pure functional composition (what should be possible)
const result = flatMap(
  builder => builder
    .merge(ConfigBuilder.fromEnv('STUDY_'))
    .validateWith(schema)
    .build()
    .flatMap(config => runStudy(config)),
  await ConfigBuilder.fromYamlFile('./config.yaml')
);
```

**Problem:** `Promise<Result<ConfigBuilder>>` return type forces manual unwrapping instead of functional composition.

### Issue 2: Architecture Is Actually Correct

**The Core Architecture is Sound:**
```typescript
// ✅ ConfigBuilder: Fluent API for building
builder.merge(other).validateWith(schema).build()  // → Result<Config>

// ✅ Result<T>: Functional composition  
flatMap(config => runApp(config), configResult)
```

**The Problem:** Only the Promise<Result<T>> handling breaks the chain.

**Two-Phase Design (Correct):**
1. **Fluent Phase**: Build complex configuration objects
2. **Functional Phase**: Compose operations with error handling

**What's Wrong:** The transition from Promise to Result forces manual unwrapping.

### Issue 3: Promise<Result<T>> Creates Manual Unwrapping

**Root Cause:**
```typescript
ConfigBuilder.fromYamlFile(path)  // → Promise<Result<ConfigBuilder>>
//                                       ^^^^^^^ This forces .then() anti-pattern
```

**Manual Unwrapping Required:**
```typescript
// ❌ Forced to manually check Result tags
.then(result => result.tag === 'success' ? result.value.merge(...) : result)
```

**The Solution:** ConfigBuilder needs functional composition methods to handle Promise<Result<T>> cleanly.

## Specific API Design Problems

### 1. fromEnv() Inconsistency

```typescript
// Inconsistent with other loaders
fromYamlFile(path)  // → Promise<Result<Config, ConfigError>>
fromJsonFile(path)  // → Promise<Result<Config, ConfigError>>
fromEnv(prefix)     // → Config (no Result!)  ❌ INCONSISTENT
```

**Issue:** Environment variable parsing can fail (invalid values, missing required vars), but `fromEnv()` provides no error handling.

### 2. merge() Methods Lack Error Handling

```typescript
// Config merging can fail (conflicting schemas, type mismatches)
config1.merge(config2)  // → Config (no error handling) ❌
builder1.merge(builder2) // → ConfigBuilder (no error handling) ❌
```

**Issue:** Merging configurations can fail in real scenarios:
- Conflicting schema requirements
- Type mismatches between sources
- Invalid nested structures

### 3. Validation is External, Not Chainable

```typescript
// Current: Validation breaks the chain
const config = await fromYamlFile('./config.yaml');
const validated = validateConfig(config, schema);  // ❌ External function

// Desired: Validation as part of the chain
const config = await fromYamlFile('./config.yaml')
  .then(result => flatMap(c => c.validate(schema), result));
```

## Impact on Developer Experience

### Verbose Code Required

**Current Reality:**
```typescript
// 10+ lines of boilerplate for basic config loading
async function loadConfig() {
  const yamlResult = await fromYamlFile('./config.yaml');
  if (yamlResult.tag === 'failure') {
    throw new Error(yamlResult.error.message);
  }
  
  const yamlConfig = yamlResult.value;
  const envConfig = fromEnv('APP_');
  const mergedConfig = yamlConfig.merge(envConfig);
  
  const validatedResult = validateConfig(mergedConfig, schema);
  if (validatedResult.tag === 'failure') {
    throw new Error(validatedResult.error.message);
  }
  
  return validatedResult.value;
}
```

**Desired Experience:**
```typescript
// 3-4 lines with proper functional composition
const configResult = await fromYamlFile('./config.yaml')
  .then(result => flatMap(config => 
    config.mergeResult(fromEnv('APP_'))
          .flatMap(merged => merged.validate(schema)), 
    result));
```

## Proposed Solution: Add Functional Composition to ConfigBuilder

### The Core Issue
ConfigBuilder architecture is **correct** (fluent building + functional composition), but Promise<Result<T>> forces manual unwrapping.

### Solution: Extend ConfigBuilder with flatMap/map

```typescript
declare module '@qi/core/config' {
  interface ConfigBuilder {
    flatMap<T>(fn: (builder: ConfigBuilder) => Result<T, ConfigError>): Result<T, ConfigError>;
    map<T>(fn: (builder: ConfigBuilder) => T): ConfigBuilder;
  }
}

ConfigBuilder.prototype.flatMap = function<T>(
  fn: (builder: ConfigBuilder) => Result<T, ConfigError>
): Result<T, ConfigError> {
  return fn(this);
};
```

### Clean Result

```typescript
// ✅ With extension: Pure functional composition
const result = flatMap(
  builder => builder
    .merge(ConfigBuilder.fromEnv('STUDY_'))
    .validateWith(schema)
    .build()
    .flatMap(config => runStudy(config)),
  await ConfigBuilder.fromYamlFile('./config.yaml')
);
```

### Why This Works

1. **Preserves architecture**: Fluent building + functional composition
2. **Eliminates anti-patterns**: No manual Result unwrapping
3. **Minimal change**: Just adds missing functional methods
4. **Backward compatible**: Doesn't break existing code

## Current Workarounds

Until the API is fixed, developers must use verbose patterns:

### Working QiCore Pattern
```typescript
import { flatMap, match } from '@qi/base';
import { fromYamlFile, fromEnv, validateConfig } from '@qi/core/config';

const configResult = flatMap(
  (yamlConfig: Config) => validateConfig(yamlConfig.merge(fromEnv('STUDY_')), schema),
  await fromYamlFile('./config.yaml')
);

match(
  config => console.log('Success:', config),
  error => console.error('Failed:', error.message),
  configResult
);
```

### Pure FP Alternative
```typescript
import { readFileSync } from 'node:fs';
import { parse as parseYaml } from 'yaml';

// Sometimes simpler is better
const config = parseYaml(readFileSync('./config.yaml', 'utf-8'));
```

## Key Insight: Architecture is Sound

The fundamental insight is that **QiCore's two-phase architecture is correct**:

1. **Fluent Phase**: ConfigBuilder for complex object construction
2. **Functional Phase**: Result<T> for error-safe composition

**The only problem** is Promise<Result<T>> handling, which forces manual unwrapping anti-patterns.

## Recommendations

1. **Add flatMap/map to ConfigBuilder** - Enable functional composition without breaking the fluent/functional separation
2. **Keep the two-phase design** - Don't mix fluent and functional APIs
3. **Eliminate manual Result unwrapping** - Extensions solve this cleanly
4. **Preserve backward compatibility** - Extensions don't break existing code

## Priority

**Medium Priority** - The core architecture is sound. This is about eliminating anti-patterns, not fixing fundamental design flaws. Extensions provide a clean workaround that could be upstreamed.