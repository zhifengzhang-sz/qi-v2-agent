# T3-2: ChromaDB RAG System Implementation

## Overview

This guide implements a local ChromaDB-based RAG (Retrieval-Augmented Generation) system for semantic codebase understanding. Based on research findings, ChromaDB provides excellent TypeScript integration with @langchain/community and supports local-first development.

## Prerequisites

- Phase 2 complete with basic agent
- T3-1 streaming agent implemented
- Docker installed for local ChromaDB instance
- Understanding of vector databases and embeddings

## Current Technology Status (Research-Based)

**ChromaDB Integration Status:**
- ✅ @langchain/community provides production-ready integration
- ✅ Local Docker deployment with `chroma run`
- ✅ No credentials required for local development
- ✅ Supports document addition, querying, and metadata filtering
- ⚠️ Some TypeScript integration challenges (workarounds available)

## Architecture Overview

```
Codebase Files → Document Processing → Text Splitting → 
Embedding Generation → ChromaDB Storage → Semantic Search → 
Context Retrieval → LLM Integration → Streaming Response
```

## Implementation Strategy

### Step 1: ChromaDB Setup and Configuration

**File: `src/rag/chromadb-setup.ts`**
```typescript
import { Chroma } from '@langchain/community/vectorstores/chroma';
import { OllamaEmbeddings } from '@langchain/ollama';
import type { Document } from '@langchain/core/documents';

export interface ChromaDBConfig {
  collectionName: string;
  url: string;
  embeddingModel: string;
  distanceFunction?: 'cosine' | 'l2' | 'ip';
}

export class ChromaDBManager {
  private vectorStore: Chroma | null = null;
  private embeddings: OllamaEmbeddings;
  private config: ChromaDBConfig;

  constructor(config: ChromaDBConfig) {
    this.config = config;
    this.embeddings = new OllamaEmbeddings({
      model: config.embeddingModel,
      baseUrl: 'http://localhost:11434', // Ollama default URL
    });
  }

  async initialize(): Promise<void> {
    console.log('🔧 Initializing ChromaDB connection...');
    
    try {
      this.vectorStore = new Chroma(this.embeddings, {
        collectionName: this.config.collectionName,
        url: this.config.url,
        collectionMetadata: {
          "hnsw:space": this.config.distanceFunction || "cosine",
        },
      });

      console.log(`✅ ChromaDB initialized: ${this.config.collectionName}`);
      
      // Test connection
      await this.testConnection();
      
    } catch (error) {
      console.error('❌ ChromaDB initialization failed:', error);
      throw error;
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.vectorStore) {
      throw new Error('Vector store not initialized');
    }

    try {
      // Test with a simple document
      const testDoc: Document = {
        pageContent: "Test connection to ChromaDB",
        metadata: { source: 'test', type: 'connection_test' }
      };

      await this.vectorStore.addDocuments([testDoc]);
      console.log('✅ ChromaDB connection verified');
      
    } catch (error) {
      console.error('❌ ChromaDB connection test failed:', error);
      throw error;
    }
  }

  getVectorStore(): Chroma {
    if (!this.vectorStore) {
      throw new Error('ChromaDB not initialized');
    }
    return this.vectorStore;
  }
}
```

### Step 2: Document Processing and Indexing

**File: `src/rag/document-processor.ts`**
```typescript
import { RecursiveCharacterTextSplitter } from '@langchain/textsplitters';
import { Document } from '@langchain/core/documents';
import { readFile, readdir, stat } from 'fs/promises';
import { join, extname, relative } from 'path';

export interface DocumentProcessingConfig {
  chunkSize: number;
  chunkOverlap: number;
  supportedExtensions: string[];
  ignorePaths: string[];
  maxFileSize: number; // in bytes
}

export class DocumentProcessor {
  private config: DocumentProcessingConfig;
  private textSplitter: RecursiveCharacterTextSplitter;

  constructor(config: DocumentProcessingConfig) {
    this.config = config;
    this.textSplitter = new RecursiveCharacterTextSplitter({
      chunkSize: config.chunkSize,
      chunkOverlap: config.chunkOverlap,
      separators: [
        // Code-specific separators
        '\n\nclass ',
        '\n\nfunction ',
        '\n\nexport ',
        '\n\nimport ',
        '\n\n',
        '\n',
        ' ',
        ''
      ]
    });
  }

  async processCodebase(rootPath: string): Promise<Document[]> {
    console.log(`📁 Processing codebase: ${rootPath}`);
    
    const files = await this.findCodeFiles(rootPath);
    console.log(`📄 Found ${files.length} code files`);
    
    const documents: Document[] = [];
    let processedCount = 0;

    for (const filePath of files) {
      try {
        const fileDocuments = await this.processFile(filePath, rootPath);
        documents.push(...fileDocuments);
        processedCount++;
        
        if (processedCount % 10 === 0) {
          console.log(`⏳ Processed ${processedCount}/${files.length} files`);
        }
        
      } catch (error) {
        console.warn(`⚠️ Failed to process ${filePath}:`, error);
      }
    }

    console.log(`✅ Processed ${processedCount} files, created ${documents.length} document chunks`);
    return documents;
  }

  private async findCodeFiles(rootPath: string): Promise<string[]> {
    const files: string[] = [];
    
    const scanDirectory = async (dirPath: string): Promise<void> => {
      const entries = await readdir(dirPath);
      
      for (const entry of entries) {
        const fullPath = join(dirPath, entry);
        const relativePath = relative(rootPath, fullPath);
        
        // Skip ignored paths
        if (this.shouldIgnorePath(relativePath)) {
          continue;
        }
        
        const stats = await stat(fullPath);
        
        if (stats.isDirectory()) {
          await scanDirectory(fullPath);
        } else if (stats.isFile()) {
          const ext = extname(fullPath);
          
          if (this.config.supportedExtensions.includes(ext) && 
              stats.size <= this.config.maxFileSize) {
            files.push(fullPath);
          }
        }
      }
    };

    await scanDirectory(rootPath);
    return files;
  }

  private shouldIgnorePath(relativePath: string): boolean {
    return this.config.ignorePaths.some(ignorePath => 
      relativePath.startsWith(ignorePath) || 
      relativePath.includes(ignorePath)
    );
  }

  private async processFile(filePath: string, rootPath: string): Promise<Document[]> {
    const content = await readFile(filePath, 'utf-8');
    const relativePath = relative(rootPath, filePath);
    
    // Create base metadata
    const baseMetadata = {
      source: relativePath,
      filePath: filePath,
      extension: extname(filePath),
      size: content.length,
      type: 'code',
      timestamp: new Date().toISOString()
    };

    // Split document into chunks
    const chunks = await this.textSplitter.createDocuments(
      [content],
      [baseMetadata]
    );

    // Add chunk-specific metadata
    return chunks.map((chunk, index) => ({
      ...chunk,
      metadata: {
        ...chunk.metadata,
        chunkIndex: index,
        totalChunks: chunks.length,
        chunkId: `${relativePath}:${index}`
      }
    }));
  }
}
```

### Step 3: RAG Pipeline Implementation

**File: `src/rag/rag-pipeline.ts`**
```typescript
import { ChromaDBManager } from './chromadb-setup.js';
import { DocumentProcessor } from './document-processor.js';
import type { Document } from '@langchain/core/documents';

export interface RAGConfig {
  chromaDB: {
    collectionName: string;
    url: string;
    embeddingModel: string;
  };
  processing: {
    chunkSize: number;
    chunkOverlap: number;
    supportedExtensions: string[];
    ignorePaths: string[];
    maxFileSize: number;
  };
  retrieval: {
    topK: number;
    scoreThreshold: number;
    includeMetadata: boolean;
  };
}

export class RAGPipeline {
  private chromaManager: ChromaDBManager;
  private documentProcessor: DocumentProcessor;
  private config: RAGConfig;
  private indexedPaths = new Set<string>();

  constructor(config: RAGConfig) {
    this.config = config;
    this.chromaManager = new ChromaDBManager(config.chromaDB);
    this.documentProcessor = new DocumentProcessor(config.processing);
  }

  async initialize(): Promise<void> {
    console.log('🚀 Initializing RAG pipeline...');
    await this.chromaManager.initialize();
    console.log('✅ RAG pipeline ready');
  }

  async indexCodebase(rootPath: string, forceReindex = false): Promise<void> {
    console.log(`📚 Indexing codebase: ${rootPath}`);
    
    if (this.indexedPaths.has(rootPath) && !forceReindex) {
      console.log('ℹ️ Codebase already indexed, skipping...');
      return;
    }

    try {
      // Process documents
      const documents = await this.documentProcessor.processCodebase(rootPath);
      
      if (documents.length === 0) {
        console.warn('⚠️ No documents to index');
        return;
      }

      // Add to vector store
      const vectorStore = this.chromaManager.getVectorStore();
      console.log(`🔄 Adding ${documents.length} documents to ChromaDB...`);
      
      await vectorStore.addDocuments(documents);
      
      this.indexedPaths.add(rootPath);
      console.log(`✅ Successfully indexed ${documents.length} document chunks`);
      
    } catch (error) {
      console.error('❌ Failed to index codebase:', error);
      throw error;
    }
  }

  async semanticSearch(query: string, options?: {
    topK?: number;
    scoreThreshold?: number;
    filter?: Record<string, any>;
  }): Promise<Document[]> {
    const {
      topK = this.config.retrieval.topK,
      scoreThreshold = this.config.retrieval.scoreThreshold,
      filter = {}
    } = options || {};

    console.log(`🔍 Semantic search: "${query}" (top ${topK})`);

    try {
      const vectorStore = this.chromaManager.getVectorStore();
      
      // Perform similarity search
      const results = await vectorStore.similaritySearchWithScore(
        query,
        topK,
        filter
      );

      // Filter by score threshold
      const filteredResults = results
        .filter(([_, score]) => score >= scoreThreshold)
        .map(([doc, score]) => ({
          ...doc,
          metadata: {
            ...doc.metadata,
            similarityScore: score
          }
        }));

      console.log(`📊 Found ${filteredResults.length} relevant documents`);
      
      return filteredResults;
      
    } catch (error) {
      console.error('❌ Semantic search failed:', error);
      throw error;
    }
  }

  async getRelevantContext(query: string, maxTokens = 4000): Promise<{
    context: string;
    sources: string[];
    metadata: any[];
  }> {
    const documents = await this.semanticSearch(query);
    
    if (documents.length === 0) {
      return {
        context: '',
        sources: [],
        metadata: []
      };
    }

    let context = '';
    const sources: string[] = [];
    const metadata: any[] = [];
    let tokenCount = 0;

    for (const doc of documents) {
      // Rough token estimation (1 token ≈ 4 characters)
      const docTokens = doc.pageContent.length / 4;
      
      if (tokenCount + docTokens > maxTokens) {
        break;
      }

      context += `\n\n--- ${doc.metadata.source} ---\n${doc.pageContent}`;
      sources.push(doc.metadata.source);
      metadata.push(doc.metadata);
      tokenCount += docTokens;
    }

    return {
      context: context.trim(),
      sources: [...new Set(sources)], // Remove duplicates
      metadata
    };
  }
}
```

### Step 4: Integration with Existing QiAgentFactory

**File: `lib/src/agent/factory.ts` (RAG Enhancement)**
```typescript
// Add to existing QiAgentFactory class

import { RAGPipeline } from '../rag/rag-pipeline.js';
import { ContextManager } from '../rag/context-manager.js';

export class QiAgentFactory {
  // ... existing properties ...
  private ragPipeline?: RAGPipeline;
  private contextManager?: ContextManager;
  private ragEnabled = false;

  // ... existing constructor and methods ...

  // Initialize RAG system alongside existing initialization
  async initialize(): Promise<void> {
    console.log('🤖 Initializing Qi Agent...');

    // Existing initialization...
    if (this.config.memory.enabled) {
      this.memorySaver = new MemorySaver();
      console.log('💾 Memory persistence enabled');
    }

    await this.mcpManager.initialize();
    const mcpTools = await this.mcpManager.getTools();
    const tools = this.mcpManager.convertToLangChainTools(mcpTools);

    // NEW: Initialize RAG system if enabled
    if (this.config.rag?.enabled) {
      console.log('🧠 Initializing RAG system...');
      await this.initializeRAG();
    }

    // Create LangGraph agent with existing logic
    this.agent = createReactAgent({
      llm: this.llm.getModel(),
      tools,
      ...(this.memorySaver && { checkpointSaver: this.memorySaver }),
    });

    console.log('✅ Qi Agent initialized successfully');
  }

  private async initializeRAG(): Promise<void> {
    const ragConfig = this.config.rag;
    if (!ragConfig) {
      throw new Error('RAG configuration required');
    }

    this.ragPipeline = new RAGPipeline(ragConfig);
    await this.ragPipeline.initialize();

    this.contextManager = new ContextManager(this.ragPipeline);
    this.ragEnabled = true;

    console.log('✅ RAG system initialized');
  }

  // Enhanced invoke with RAG context
  async invokeWithRAG(
    messages: AgentMessage[],
    options: {
      threadId?: string;
      intent?: 'explanation' | 'implementation' | 'debugging' | 'refactoring';
      scope?: 'file' | 'module' | 'project' | 'dependencies';
      currentFile?: string;
    } = {}
  ): Promise<AgentResponse> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const { threadId, intent = 'explanation', scope = 'project', currentFile } = options;
    const lastMessage = messages[messages.length - 1];

    try {
      let enhancedMessages = messages;

      // Add RAG context if enabled
      if (this.ragEnabled && this.contextManager && lastMessage.role === 'user') {
        console.log('🔍 Retrieving context for query...');
        
        const context = await this.contextManager.getContextForQuery(
          lastMessage.content,
          { intent, scope, currentFile }
        );

        if (context.content) {
          // Create enhanced prompt with context
          const contextualPrompt = this.createContextualPrompt(lastMessage.content, context.content);
          enhancedMessages = [
            ...messages.slice(0, -1),
            { role: 'user', content: contextualPrompt }
          ];
          
          console.log(`📚 Added context from ${context.sources.length} sources`);
        }
      }

      // Use existing invoke method with enhanced messages
      return await this.invoke(enhancedMessages, threadId);

    } catch (error) {
      console.error('RAG-enhanced invocation failed:', error);
      // Fallback to regular invoke without RAG
      return await this.invoke(messages, threadId);
    }
  }

  private createContextualPrompt(query: string, context: string): string {
    return `Context from codebase:
${context}

User Query: ${query}

Instructions:
1. Use the provided codebase context to answer the user's question
2. Reference specific files and code sections when relevant  
3. If the context doesn't contain relevant information, say so clearly
4. Provide accurate, helpful responses based on the actual codebase

Response:`;
  }

  async processQueryWithContext(query: string): Promise<{
    response: string;
    context: string;
    sources: string[];
  }> {
    console.log(`🤔 Processing query with RAG context: "${query}"`);

    try {
      // Get relevant context
      const { context, sources } = await this.ragPipeline.getRelevantContext(query);
      
      // Create RAG prompt
      const prompt = this.createRAGPrompt(query, context);
      
      // Generate response
      const response = await this.llm.invoke([
        { role: 'user', content: prompt }
      ]);

      return {
        response: response.content as string,
        context,
        sources
      };
      
    } catch (error) {
      console.error('❌ RAG query processing failed:', error);
      throw error;
    }
  }

  private createRAGPrompt(query: string, context: string): string {
    const template = `You are an AI coding assistant with access to the current codebase context.

Context from codebase:
{context}

User Query: {query}

Instructions:
1. Use the provided codebase context to answer the user's question
2. If the context doesn't contain relevant information, say so clearly
3. Reference specific files and code sections when relevant
4. Provide accurate, helpful responses based on the actual codebase
5. If suggesting changes, ensure they're compatible with the existing code structure

Response:`;

    return template
      .replace('{context}', context || 'No relevant context found.')
      .replace('{query}', query);
  }

  async *streamQueryWithContext(query: string): AsyncGenerator<{
    type: 'context' | 'response' | 'sources';
    data: any;
  }> {
    console.log(`🔄 Streaming query with RAG context: "${query}"`);

    try {
      // Yield context retrieval progress
      yield { type: 'context', data: { status: 'retrieving' } };
      
      const { context, sources } = await this.ragPipeline.getRelevantContext(query);
      
      yield { type: 'context', data: { context, sources } };
      yield { type: 'sources', data: sources };

      // Stream LLM response
      const prompt = this.createRAGPrompt(query, context);
      
      // Note: This would integrate with the streaming agent from T3-1
      const response = await this.llm.invoke([
        { role: 'user', content: prompt }
      ]);

      yield { 
        type: 'response', 
        data: { 
          content: response.content,
          complete: true 
        } 
      };
      
    } catch (error) {
      console.error('❌ Streaming RAG query failed:', error);
      throw error;
    }
  }
}
```

### Step 5: Configuration Schema Integration

**File: `lib/src/config/schema.ts` (Enhancement)**
```typescript
// Add to existing QiConfig schema

export const RAGConfigSchema = z.object({
  enabled: z.boolean().default(false),
  chromaDB: z.object({
    collectionName: z.string().default('qi-agent-codebase'),
    url: z.string().default('http://localhost:8000'),
    embeddingModel: z.string().default('nomic-embed-text'),
    distanceFunction: z.enum(['cosine', 'l2', 'ip']).default('cosine')
  }),
  
  processing: z.object({
    chunkSize: z.number().default(1000),
    chunkOverlap: z.number().default(200),
    supportedExtensions: z.array(z.string()).default([
      '.ts', '.js', '.tsx', '.jsx', '.py', '.java', '.cpp', '.c', '.h',
      '.go', '.rs', '.rb', '.php', '.cs', '.kt', '.swift', '.dart',
      '.md', '.txt', '.json', '.yaml', '.yml', '.toml', '.ini'
    ]),
    ignorePaths: z.array(z.string()).default([
      'node_modules',
      '.git',
      'dist',
      'build',
      '.next',
      'target',
      'bin',
      'obj',
      '.vscode',
      '.idea'
    ]),
    maxFileSize: z.number().default(1024 * 1024) // 1MB
  }),
  
  retrieval: z.object({
    topK: z.number().default(5),
    scoreThreshold: z.number().default(0.7),
    includeMetadata: z.boolean().default(true),
    maxContextTokens: z.number().default(4000)
  })
});

});

// Update main QiConfigSchema to include RAG
export const QiConfigSchema = z.object({
  // ... existing config properties ...
  rag: RAGConfigSchema.optional(), // Add RAG config as optional
});

export type RAGConfig = z.infer<typeof RAGConfigSchema>;
export type QiConfig = z.infer<typeof QiConfigSchema>;
```

## Testing & Validation

### Unit Tests

**File: `src/rag/__tests__/chromadb-setup.test.ts`**
```typescript
import { describe, test, expect, beforeAll, afterAll } from 'vitest';
import { ChromaDBManager } from '../chromadb-setup.js';

describe('ChromaDBManager', () => {
  let manager: ChromaDBManager;

  beforeAll(async () => {
    manager = new ChromaDBManager({
      collectionName: 'test-collection',
      url: 'http://localhost:8000',
      embeddingModel: 'nomic-embed-text'
    });
    
    await manager.initialize();
  });

  test('initializes ChromaDB connection', async () => {
    expect(manager.getVectorStore()).toBeDefined();
  });

  test('adds and retrieves documents', async () => {
    const vectorStore = manager.getVectorStore();
    
    const testDocs = [{
      pageContent: 'function testFunction() { return true; }',
      metadata: { source: 'test.ts', type: 'function' }
    }];

    await vectorStore.addDocuments(testDocs);
    
    const results = await vectorStore.similaritySearch('test function', 1);
    expect(results).toHaveLength(1);
    expect(results[0].pageContent).toContain('testFunction');
  }, 10000);
});
```

### Integration Tests

**File: `src/rag/__tests__/rag-pipeline.test.ts`**  
```typescript
import { describe, test, expect, beforeAll } from 'vitest';
import { RAGPipeline } from '../rag-pipeline.js';
import { mkdtemp, writeFile, rm } from 'fs/promises';
import { join } from 'path';
import { tmpdir } from 'os';

describe('RAG Pipeline Integration', () => {
  let ragPipeline: RAGPipeline;
  let testDir: string;

  beforeAll(async () => {
    // Create test directory with sample code
    testDir = await mkdtemp(join(tmpdir(), 'rag-test-'));
    
    await writeFile(join(testDir, 'example.ts'), `
export function calculateSum(a: number, b: number): number {
  return a + b;
}

export class Calculator {
  add(x: number, y: number): number {
    return calculateSum(x, y);
  }
}
`);

    const config = {
      chromaDB: {
        collectionName: 'test-rag-pipeline',
        url: 'http://localhost:8000',
        embeddingModel: 'nomic-embed-text'
      },
      processing: {
        chunkSize: 500,
        chunkOverlap: 50,
        supportedExtensions: ['.ts'],
        ignorePaths: [],
        maxFileSize: 1024 * 1024
      },
      retrieval: {
        topK: 3,
        scoreThreshold: 0.5,
        includeMetadata: true
      }
    };

    ragPipeline = new RAGPipeline(config);
    await ragPipeline.initialize();
  });

  afterAll(async () => {
    await rm(testDir, { recursive: true, force: true });
  });

  test('indexes codebase and performs semantic search', async () => {
    await ragPipeline.indexCodebase(testDir);
    
    const results = await ragPipeline.semanticSearch('calculator function');
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].pageContent).toContain('Calculator');
  }, 15000);

  test('gets relevant context for query', async () => {
    const { context, sources } = await ragPipeline.getRelevantContext('sum calculation');
    
    expect(context).toContain('calculateSum');
    expect(sources).toContain('example.ts');
  }, 10000);
});
```

## Docker Setup

**File: `docker-compose.rag.yml`**
```yaml
version: '3.8'

services:
  chromadb:
    image: chromadb/chroma:latest
    ports:
      - "8000:8000"
    volumes:
      - chromadb_data:/chroma/chroma
    environment:
      - CHROMA_SERVER_HOST=0.0.0.0
      - CHROMA_SERVER_HTTP_PORT=8000
    healthcheck:
      test: ["CMD", "curl", "-f", "http://localhost:8000/api/v1/heartbeat"]
      interval: 30s
      timeout: 10s
      retries: 3

volumes:
  chromadb_data:
    driver: local
```

## Performance Optimization

### Indexing Performance

```typescript
export class OptimizedRAGPipeline extends RAGPipeline {
  private indexingQueue: Array<{ path: string; priority: number }> = [];
  private isIndexing = false;

  async queueForIndexing(path: string, priority = 1): Promise<void> {
    this.indexingQueue.push({ path, priority });
    this.indexingQueue.sort((a, b) => b.priority - a.priority);
    
    if (!this.isIndexing) {
      this.processIndexingQueue();
    }
  }

  private async processIndexingQueue(): Promise<void> {
    this.isIndexing = true;
    
    while (this.indexingQueue.length > 0) {
      const { path } = this.indexingQueue.shift()!;
      
      try {
        await this.indexCodebase(path);
      } catch (error) {
        console.error(`Failed to index ${path}:`, error);
      }
    }
    
    this.isIndexing = false;
  }
}
```

## Success Criteria

### Functional Requirements
- [ ] **ChromaDB Integration**: Local ChromaDB instance running and accessible
- [ ] **Document Processing**: Code files processed into semantic chunks
- [ ] **Vector Storage**: Documents embedded and stored in ChromaDB
- [ ] **Semantic Search**: Queries return relevant code context
- [ ] **Context Retrieval**: Appropriate context provided for LLM queries

### Performance Requirements
- [ ] **Indexing Speed**: 1000 files indexed in <5 minutes
- [ ] **Search Latency**: Semantic search results in <2 seconds
- [ ] **Memory Usage**: <200MB for 10,000 document chunks
- [ ] **Accuracy**: >80% relevant results for code-related queries

### Integration Requirements
- [ ] **Streaming Agent**: Integrates with T3-1 streaming agent
- [ ] **Configuration**: Configurable via updated YAML settings
- [ ] **Error Handling**: Graceful handling of ChromaDB connection issues
- [ ] **Testing Coverage**: >85% test coverage for RAG components

## Next Steps

1. **Complete T3-3**: Implement semantic context retrieval enhancements
2. **T3-4 Integration**: Connect with multi-turn conversation system
3. **Performance Tuning**: Optimize chunk size and embedding strategies
4. **Advanced Features**: Implement SEM-RAG patterns for code understanding

This implementation provides a solid foundation for semantic codebase understanding, enabling the agent to provide contextually relevant responses based on the actual project code.