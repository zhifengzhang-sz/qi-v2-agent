# QiCore Knowledge Refresh

Comprehensive QiCore framework knowledge refresh using hybrid memory + RAG approach.

## Command
```bash
# Usage: /qicore-refresh [module]
# Optional module parameter to focus on specific component
```

## Implementation

This command refreshes QiCore knowledge by:

1. **Memory Graph Query**: Retrieve structured entities and relationships
2. **Qdrant RAG Search**: Get complete documentation with semantic search  
3. **Hybrid Synthesis**: Combine both sources for comprehensive overview
4. **Module Focus** (optional): Deep dive into specific component

### Core Implementation
```typescript
async function refreshQiCoreKnowledge(focusModule?: string) {
  // Step 1: Query memory graph for structured relationships
  const graphEntities = await searchMemoryGraph("QiCore Framework");
  
  // Step 2: Semantic search in Qdrant for complete docs
  const ragResults = await searchQdrant({
    query: focusModule 
      ? `QiCore ${focusModule} implementation patterns usage`
      : "QiCore framework architecture Result<T> functional composition",
    collection: "qicore-knowledge",
    limit: 5
  });
  
  // Step 3: Combine and synthesize knowledge
  return combineKnowledgeSources(graphEntities, ragResults, focusModule);
}
```

### Usage Examples

**General refresh:**
```
/qicore-refresh
```

**Module-specific refresh:**
```
/qicore-refresh qi/base
/qicore-refresh qi/core
/qicore-refresh Config
/qicore-refresh Logger  
/qicore-refresh Cache
```

### Output Structure

1. **Architecture Overview** (from memory graph)
   - Framework structure and relationships
   - Module dependencies and interactions
   
2. **Implementation Details** (from Qdrant RAG)
   - Code examples and usage patterns
   - API documentation and best practices
   
3. **Module Deep Dive** (if specified)
   - Focused analysis of specific component
   - Integration patterns and real-world examples

### Benefits

- **No Information Loss**: Complete docs preserved in Qdrant
- **Structured Navigation**: Relationships mapped in memory graph
- **Fast Access**: Efficient hybrid retrieval system
- **Module Focus**: Targeted knowledge refresh capability