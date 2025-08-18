# QiCore Two-Layer Architecture Design Principle

## Overview

The qi-v2-agent framework implements a **two-layer architecture design principle** that separates functional programming complexity from user-friendly interfaces. This approach enables the use of sophisticated QiCore patterns internally while maintaining clean, intuitive APIs for external consumers.

## Architecture Principle

### Layer 1: Inner QiCore Functional Programming Layer

**Purpose**: Handle all internal logic using functional programming patterns and QiCore framework
**Visibility**: Private to the module, not exposed to external consumers
**Patterns**: Result<T> monads, functional composition, structured error handling

#### Core Patterns

##### Result<T> Monads
```typescript
// Internal layer uses Result<T> throughout
private async classifyInternal(input: string): Promise<Result<AgentType>> {
  return fromAsyncTryCatch(async () => {
    const preprocessed = this.preprocessInput(input);
    return await this.executeClassification(preprocessed);
  })
  .flatMap(result => this.validateClassification(result))
  .flatMap(validated => this.enrichClassification(validated));
}
```

##### Functional Composition
```typescript
// Chaining operations with flatMap for data flow
private async processWorkflowInternal(classification: AgentType): Promise<Result<WorkflowOutput>> {
  return Result.success(classification)
    .flatMap(type => this.loadWorkflowPattern(type))
    .flatMap(pattern => this.executeWorkflow(pattern))
    .flatMap(result => this.validateOutput(result))
    .flatMap(validated => this.enrichOutput(validated));
}
```

##### QiError Categorization
```typescript
// Structured error handling with QiError
private validateInput(input: string): Result<string> {
  if (!input?.trim()) {
    return Result.failure(QiError.createValidationError(
      'INPUT_EMPTY',
      'Input cannot be empty',
      { input }
    ));
  }
  
  if (input.length > MAX_INPUT_LENGTH) {
    return Result.failure(QiError.createValidationError(
      'INPUT_TOO_LONG',
      'Input exceeds maximum length',
      { input: input.substring(0, 50) + '...', maxLength: MAX_INPUT_LENGTH }
    ));
  }
  
  return Result.success(input.trim());
}
```

##### Exception Boundaries
```typescript
// fromAsyncTryCatch replaces all try/catch blocks
private async executeToolInternal(tool: Tool, params: ToolParams): Promise<Result<ToolOutput>> {
  return fromAsyncTryCatch(async () => {
    const validated = await this.validateToolParams(tool, params);
    const executed = await tool.execute(validated);
    return await this.processToolOutput(executed);
  });
}
```

### Layer 2: Interface Abstraction Layer

**Purpose**: Provide clean, user-friendly APIs that hide QiCore complexity
**Visibility**: Public interfaces exposed to external consumers
**Patterns**: Traditional TypeScript patterns, Promise<T> return types, standard Error objects

#### Interface Transformation Patterns

##### Result<T> to Promise<T> Conversion
```typescript
// Public interface hides Result<T> complexity
public async classify(input: string): Promise<AgentType> {
  const result = await this.classifyInternal(input);
  return result.match(
    success => success,
    error => { 
      // Transform QiError to standard Error for public API
      throw new Error(`Classification failed: ${error.message}`);
    }
  );
}
```

##### Error Transformation
```typescript
// Transform QiError to user-friendly Error messages
public async processWorkflow(classification: AgentType): Promise<WorkflowOutput> {
  const result = await this.processWorkflowInternal(classification);
  return result.match(
    success => success,
    error => {
      // Provide meaningful error messages based on QiError categories
      switch (error.category) {
        case 'VALIDATION':
          throw new Error(`Invalid input: ${error.message}`);
        case 'CONFIGURATION':
          throw new Error(`Configuration error: ${error.message}`);
        case 'BUSINESS':
          throw new Error(`Workflow error: ${error.message}`);
        default:
          throw new Error(`System error: ${error.message}`);
      }
    }
  );
}
```

##### Backward Compatibility
```typescript
// Maintain existing method signatures while upgrading internals
export class AgentClassifier implements IAgentClassifier {
  // Public interface unchanged - maintains compatibility
  async classify(input: string): Promise<AgentType> {
    // Internal implementation uses QiCore patterns
    const result = await this.classifyInternal(input);
    return this.transformResult(result);
  }
  
  // Internal methods use QiCore patterns
  private async classifyInternal(input: string): Promise<Result<AgentType>> {
    return this.validateInput(input)
      .flatMap(valid => this.executeClassification(valid))
      .flatMap(result => this.enrichClassification(result));
  }
  
  // Transform internal Result<T> to public API format
  private transformResult(result: Result<AgentType>): Promise<AgentType> {
    return result.match(
      success => Promise.resolve(success),
      error => Promise.reject(new Error(error.message))
    );
  }
}
```

## Implementation Strategy

### Phase 1: Internal Layer Implementation

1. **Identify All Async Operations**
   - Replace all try/catch blocks with fromAsyncTryCatch
   - Convert all async functions to return Promise<Result<T>>
   - Add comprehensive QiError categorization

2. **Implement Functional Composition**
   - Chain operations using flatMap() and pipe()
   - Eliminate imperative control flow
   - Add pure function patterns throughout

3. **Add Structured Logging**
   - Integrate QiCore logger with structured context
   - Add performance and error metrics
   - Implement comprehensive audit trails

### Phase 2: Interface Layer Creation

1. **Preserve Public APIs**
   - Maintain all existing method signatures
   - Ensure 100% backward compatibility
   - Document any behavioral changes

2. **Add Error Transformation**
   - Transform QiError to appropriate Error objects
   - Provide meaningful error messages
   - Maintain error context where appropriate

3. **Optimize Performance**
   - Ensure Result<T> composition doesn't degrade performance
   - Add caching where beneficial
   - Monitor and optimize functional composition chains

## Benefits

### Architectural Excellence
- **Separation of Concerns**: Clear separation between functional logic and interface concerns
- **Maintainability**: Easier to maintain and debug functional code internally
- **Type Safety**: Enhanced type safety with Result<T> patterns
- **Error Resilience**: Comprehensive error handling with structured categories

### Developer Experience
- **Clean APIs**: External consumers see simple, intuitive interfaces
- **Backward Compatibility**: Existing code continues to work unchanged
- **Better Debugging**: Structured error context and logging
- **Functional Benefits**: Internal code benefits from functional programming advantages

### Production Readiness
- **Error Handling**: Comprehensive error categorization and recovery
- **Performance**: Optimized functional composition with minimal overhead
- **Monitoring**: Enhanced logging and metrics collection
- **Reliability**: Functional programming reduces side effects and bugs

## Quality Standards

### Internal Layer Requirements
- ✅ **100% Result<T> Usage**: All async operations return Result<T>
- ✅ **Zero try/catch Blocks**: All exception handling through fromAsyncTryCatch
- ✅ **Functional Composition**: All data flow through flatMap/pipe patterns
- ✅ **QiError Categories**: All errors properly categorized
- ✅ **Pure Functions**: No side effects in internal functions

### Interface Layer Requirements
- ✅ **Backward Compatibility**: All existing APIs continue to work
- ✅ **Zero QiCore Exposure**: No Result<T> or QiError in public APIs
- ✅ **Error Transformation**: Meaningful error messages for all failure cases
- ✅ **Performance**: No degradation from functional patterns
- ✅ **Documentation**: Clear documentation of public API behavior

## Testing Strategy

### Internal Layer Testing
- **Result<T> Composition**: Test functional composition chains
- **Error Categorization**: Verify QiError categories and context
- **Pure Function Testing**: Test functions in isolation
- **Performance Testing**: Ensure functional patterns perform well

### Interface Layer Testing
- **Contract Testing**: Verify public APIs maintain contracts
- **Error Transformation**: Test error transformation works correctly
- **Backward Compatibility**: Test existing code continues to work
- **Integration Testing**: Test end-to-end workflows

## Success Metrics

### Implementation Completeness
- **QiCore Compliance**: 100% internal compliance with QiCore patterns
- **Interface Quality**: Clean, intuitive public APIs with zero QiCore exposure
- **Error Handling**: Comprehensive error categorization and transformation
- **Testing Coverage**: 90%+ coverage for both layers

### Quality Metrics
- **Performance**: No degradation from functional patterns
- **Maintainability**: Improved code quality and debugging
- **Reliability**: Reduced bugs through functional programming
- **Developer Experience**: Clean APIs with comprehensive error handling

This two-layer architecture enables the best of both worlds: sophisticated functional programming internally with clean, user-friendly interfaces externally.