# MCP Integration Guide

**Document Version**: 1.0  
**Date**: 2025-01-25  
**Status**: Design Phase  
**Target**: v-0.11.x Context Engineering Foundation

## Overview

This guide details how to leverage existing MCP (Model Context Protocol) services for context engineering storage and operations. By building on proven MCP infrastructure, we avoid implementing custom storage solutions while gaining production-ready capabilities.

## MCP Service Architecture for Context Engineering

### **Service Specialization Strategy**

Each MCP service handles specific context engineering aspects based on its strengths:

```
┌─────────────────────────────────────────────────────────────────┐
│                    Context Engineering Layer                    │
└─────────────────────────────────────────────────────────────────┘
                                   │
┌─────────────────┬─────────────────┬─────────────────────────────────┐
│   Memory MCP    │   SQLite MCP    │      Filesystem MCP             │
│                 │                 │                                 │
│ • Hot Storage   │ • Queries &     │ • Compressed Archives           │
│ • Real-time     │   Indexing      │ • Long-term Storage             │
│ • Agent Sync    │ • Relationships │ • Backup & Recovery             │
│ • Cache Layer   │ • Metadata      │ • Binary Context Data           │
└─────────────────┴─────────────────┴─────────────────────────────────┘
```

## Memory MCP Service Integration

### **Purpose**: Hot Context Storage and Real-Time Operations

The Memory MCP service provides in-memory storage ideal for:
- **Active Contexts**: Currently accessed contexts
- **Agent Coordination**: Inter-agent context sharing
- **Cache Layer**: Fast access to frequently used contexts
- **Real-Time Sync**: Immediate context updates

### **Integration Pattern**

```typescript
interface MemoryContextStorage {
  // Hot storage operations
  storeActive(context: Context): Promise<Result<void, QiError>>;
  getActive(id: ContextId): Promise<Result<Context | null, QiError>>;
  listActive(): Promise<Result<ContextId[], QiError>>;
  
  // Agent coordination
  shareWithAgent(contextId: ContextId, agentId: AgentId): Promise<Result<void, QiError>>;
  getSharedContexts(agentId: AgentId): Promise<Result<Context[], QiError>>;
  
  // Cache operations
  cache(contextId: ContextId, context: Context, ttl?: number): Promise<Result<void, QiError>>;
  invalidate(contextId: ContextId): Promise<Result<void, QiError>>;
  evictExpired(): Promise<Result<ContextId[], QiError>>;
}

class MemoryMCPContextStorage implements MemoryContextStorage {
  constructor(
    private memoryService: MCPServiceConnection,
    private logger: SimpleLogger
  ) {}

  async storeActive(context: Context): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const key = `context:active:${context.id}`;
        const serialized = JSON.stringify(context);
        
        await this.memoryService.client.callTool({
          name: 'store',
          arguments: { key, value: serialized }
        });
        
        this.logger.debug('Stored active context', { contextId: context.id });
        return success(undefined);
      },
      (error) => create('MEMORY_STORE_ERROR', `Failed to store context: ${error}`, 'SYSTEM')
    );
  }

  async getActive(id: ContextId): Promise<Result<Context | null, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const key = `context:active:${id}`;
        
        const result = await this.memoryService.client.callTool({
          name: 'retrieve',
          arguments: { key }
        });
        
        if (!result.content) {
          return success(null);
        }
        
        const context = JSON.parse(result.content) as Context;
        
        // Validate retrieved context
        const validation = ContextSchema.safeParse(context);
        if (!validation.success) {
          return failure(create('CONTEXT_VALIDATION_ERROR', 'Retrieved context invalid', 'BUSINESS'));
        }
        
        this.logger.debug('Retrieved active context', { contextId: id });
        return success(validation.data);
      },
      (error) => create('MEMORY_RETRIEVE_ERROR', `Failed to retrieve context: ${error}`, 'SYSTEM')
    );
  }

  async shareWithAgent(contextId: ContextId, agentId: AgentId): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const shareKey = `context:shared:${agentId}:${contextId}`;
        const indexKey = `agent:contexts:${agentId}`;
        
        // Add to shared contexts
        await this.memoryService.client.callTool({
          name: 'store',
          arguments: { key: shareKey, value: contextId }
        });
        
        // Add to agent's context index
        const existingContexts = await this.memoryService.client.callTool({
          name: 'retrieve',
          arguments: { key: indexKey }
        });
        
        const contextList = existingContexts.content 
          ? JSON.parse(existingContexts.content) as ContextId[]
          : [];
        
        if (!contextList.includes(contextId)) {
          contextList.push(contextId);
          await this.memoryService.client.callTool({
            name: 'store',
            arguments: { key: indexKey, value: JSON.stringify(contextList) }
          });
        }
        
        this.logger.info('Context shared with agent', { contextId, agentId });
        return success(undefined);
      },
      (error) => create('CONTEXT_SHARE_ERROR', `Failed to share context: ${error}`, 'SYSTEM')
    );
  }
}
```

### **Memory Service Configuration**

```typescript
// Memory service configuration for context engineering
const MEMORY_SERVICE_CONFIG: MCPServiceConfig = {
  name: 'context-memory',
  command: ['npx', '@modelcontextprotocol/server-memory'],
  environment: {
    MEMORY_MAX_SIZE: '512MB',           // Maximum memory usage
    MEMORY_EVICTION_POLICY: 'LRU',     // Eviction strategy
    MEMORY_TTL_DEFAULT: '3600',        // Default TTL in seconds
    MEMORY_PERSIST_INTERVAL: '300',    // Persistence interval
  },
  autoConnect: true, // Always needed for context operations
};
```

## SQLite MCP Service Integration

### **Purpose**: Queryable Context Index and Relationships

The SQLite MCP service provides structured storage ideal for:
- **Context Metadata**: Searchable context information
- **Relationship Mapping**: Context-to-context relationships
- **Query Operations**: Complex context queries
- **Indexing**: Fast lookups and filtering

### **Database Schema**

```sql
-- Context metadata table
CREATE TABLE contexts (
  id TEXT PRIMARY KEY,
  type TEXT NOT NULL CHECK (type IN ('conversation', 'task', 'workflow', 'distributed')),
  priority INTEGER DEFAULT 5 CHECK (priority BETWEEN 0 AND 10),
  relevance_score REAL DEFAULT 0.0 CHECK (relevance_score BETWEEN 0.0 AND 1.0),
  compression_level TEXT DEFAULT 'none' CHECK (compression_level IN ('none', 'semantic', 'lossless')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  last_accessed TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  ttl INTEGER, -- TTL in seconds
  storage_service TEXT NOT NULL,
  storage_location TEXT NOT NULL,
  encrypted BOOLEAN DEFAULT FALSE
);

-- Context relationships table
CREATE TABLE context_relationships (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  source_id TEXT NOT NULL,
  target_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL CHECK (relationship_type IN ('parent', 'child', 'sibling', 'reference')),
  weight REAL DEFAULT 0.5 CHECK (weight BETWEEN 0.0 AND 1.0),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (source_id) REFERENCES contexts(id) ON DELETE CASCADE,
  FOREIGN KEY (target_id) REFERENCES contexts(id) ON DELETE CASCADE,
  UNIQUE(source_id, target_id, relationship_type)
);

-- Context tags for flexible categorization
CREATE TABLE context_tags (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  context_id TEXT NOT NULL,
  tag TEXT NOT NULL,
  value TEXT, -- Optional tag value
  FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE,
  UNIQUE(context_id, tag)
);

-- Indexes for performance
CREATE INDEX idx_contexts_type ON contexts(type);
CREATE INDEX idx_contexts_priority ON contexts(priority);
CREATE INDEX idx_contexts_relevance ON contexts(relevance_score);
CREATE INDEX idx_contexts_created ON contexts(created_at);
CREATE INDEX idx_contexts_accessed ON contexts(last_accessed);
CREATE INDEX idx_relationships_source ON context_relationships(source_id);
CREATE INDEX idx_relationships_target ON context_relationships(target_id);
CREATE INDEX idx_relationships_type ON context_relationships(relationship_type);
CREATE INDEX idx_tags_context ON context_tags(context_id);
CREATE INDEX idx_tags_tag ON context_tags(tag);
```

### **Integration Pattern**

```typescript
interface SQLiteContextIndex {
  // Metadata operations
  indexContext(context: Context): Promise<Result<void, QiError>>;
  findContexts(query: ContextQuery): Promise<Result<ContextMetadata[], QiError>>;
  updateMetadata(id: ContextId, updates: Partial<ContextMetadata>): Promise<Result<void, QiError>>;
  
  // Relationship operations
  addRelationship(sourceId: ContextId, targetId: ContextId, type: RelationshipType, weight?: number): Promise<Result<void, QiError>>;
  getRelationships(contextId: ContextId): Promise<Result<ContextRelationship[], QiError>>;
  findRelated(contextId: ContextId, type?: RelationshipType): Promise<Result<ContextId[], QiError>>;
  
  // Tag operations
  tagContext(contextId: ContextId, tag: string, value?: string): Promise<Result<void, QiError>>;
  findByTag(tag: string, value?: string): Promise<Result<ContextId[], QiError>>;
  getContextTags(contextId: ContextId): Promise<Result<ContextTag[], QiError>>;
}

class SQLiteMCPContextIndex implements SQLiteContextIndex {
  constructor(
    private sqliteService: MCPServiceConnection,
    private logger: SimpleLogger
  ) {}

  async indexContext(context: Context): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const sql = `
          INSERT OR REPLACE INTO contexts 
          (id, type, priority, relevance_score, compression_level, storage_service, storage_location, encrypted, last_accessed)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
        `;
        
        const params = [
          context.id,
          context.type,
          context.metadata.priority,
          context.metadata.relevanceScore,
          context.metadata.compressionLevel,
          context.metadata.mcpStorage.service,
          context.metadata.mcpStorage.location,
          context.metadata.mcpStorage.encrypted
        ];
        
        await this.sqliteService.client.callTool({
          name: 'execute',
          arguments: { sql, params }
        });
        
        // Index relationships
        for (const relationship of context.relationships || []) {
          await this.addRelationship(
            context.id,
            relationship.targetId,
            relationship.type,
            relationship.weight
          );
        }
        
        this.logger.debug('Indexed context in SQLite', { contextId: context.id });
        return success(undefined);
      },
      (error) => create('SQLITE_INDEX_ERROR', `Failed to index context: ${error}`, 'SYSTEM')
    );
  }

  async findContexts(query: ContextQuery): Promise<Result<ContextMetadata[], QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        let sql = 'SELECT * FROM contexts WHERE 1=1';
        const params: unknown[] = [];
        
        // Build dynamic query
        if (query.type) {
          sql += ' AND type = ?';
          params.push(query.type);
        }
        
        if (query.minPriority !== undefined) {
          sql += ' AND priority >= ?';
          params.push(query.minPriority);
        }
        
        if (query.minRelevance !== undefined) {
          sql += ' AND relevance_score >= ?';
          params.push(query.minRelevance);
        }
        
        if (query.tags?.length) {
          const tagPlaceholders = query.tags.map(() => '?').join(',');
          sql += ` AND id IN (
            SELECT DISTINCT context_id FROM context_tags 
            WHERE tag IN (${tagPlaceholders})
          )`;
          params.push(...query.tags);
        }
        
        // Add ordering
        sql += ' ORDER BY ';
        switch (query.sortBy || 'relevance') {
          case 'created':
            sql += 'created_at DESC';
            break;
          case 'accessed':
            sql += 'last_accessed DESC';
            break;
          case 'priority':
            sql += 'priority DESC';
            break;
          default:
            sql += 'relevance_score DESC';
        }
        
        if (query.limit) {
          sql += ' LIMIT ?';
          params.push(query.limit);
        }
        
        const result = await this.sqliteService.client.callTool({
          name: 'query',
          arguments: { sql, params }
        });
        
        const contexts = result.rows.map((row: any) => ({
          id: row.id,
          type: row.type,
          priority: row.priority,
          relevanceScore: row.relevance_score,
          compressionLevel: row.compression_level,
          createdAt: new Date(row.created_at),
          lastAccessed: new Date(row.last_accessed),
          ttl: row.ttl,
          storageService: row.storage_service,
          storageLocation: row.storage_location,
          encrypted: Boolean(row.encrypted)
        }));
        
        this.logger.debug('Found contexts in SQLite', { count: contexts.length });
        return success(contexts);
      },
      (error) => create('SQLITE_QUERY_ERROR', `Failed to query contexts: ${error}`, 'SYSTEM')
    );
  }

  async addRelationship(
    sourceId: ContextId, 
    targetId: ContextId, 
    type: RelationshipType, 
    weight: number = 0.5
  ): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const sql = `
          INSERT OR REPLACE INTO context_relationships 
          (source_id, target_id, relationship_type, weight)
          VALUES (?, ?, ?, ?)
        `;
        
        await this.sqliteService.client.callTool({
          name: 'execute',
          arguments: { 
            sql, 
            params: [sourceId, targetId, type, weight] 
          }
        });
        
        this.logger.debug('Added context relationship', { sourceId, targetId, type, weight });
        return success(undefined);
      },
      (error) => create('SQLITE_RELATIONSHIP_ERROR', `Failed to add relationship: ${error}`, 'SYSTEM')
    );
  }
}
```

## Filesystem MCP Service Integration

### **Purpose**: Compressed Archives and Long-Term Storage

The Filesystem MCP service provides file-based storage ideal for:
- **Compressed Context Archives**: Space-efficient long-term storage
- **Binary Context Data**: Large context payloads
- **Backup and Recovery**: Persistent context storage
- **Batch Operations**: Efficient bulk context operations

### **File Organization Strategy**

```
context-storage/
├── active/           # Active contexts (JSON)
│   ├── conversation/
│   ├── task/
│   └── workflow/
├── archived/         # Compressed archives
│   ├── 2025/01/
│   ├── 2025/02/
│   └── compressed/   # LZ4 compressed contexts
├── indexes/          # Context indexes
│   ├── by-type.json
│   ├── by-priority.json
│   └── by-date.json
└── backups/          # Regular backups
    ├── daily/
    ├── weekly/
    └── monthly/
```

### **Integration Pattern**

```typescript
interface FilesystemContextStorage {
  // Archive operations
  archiveContext(context: Context): Promise<Result<ArchiveLocation, QiError>>;
  restoreFromArchive(location: ArchiveLocation): Promise<Result<Context, QiError>>;
  listArchives(filter?: ArchiveFilter): Promise<Result<ArchiveLocation[], QiError>>;
  
  // Compression operations
  compressContext(context: Context, algorithm: CompressionAlgorithm): Promise<Result<CompressedContext, QiError>>;
  decompressContext(compressed: CompressedContext): Promise<Result<Context, QiError>>;
  
  // Batch operations
  batchStore(contexts: Context[]): Promise<Result<StorageLocation[], QiError>>;
  batchRetrieve(locations: StorageLocation[]): Promise<Result<Context[], QiError>>;
  
  // Backup operations
  createBackup(contextIds: ContextId[]): Promise<Result<BackupLocation, QiError>>;
  restoreBackup(location: BackupLocation): Promise<Result<Context[], QiError>>;
}

class FilesystemMCPContextStorage implements FilesystemContextStorage {
  constructor(
    private filesystemService: MCPServiceConnection,
    private logger: SimpleLogger,
    private basePath: string = '/tmp/qi-contexts'
  ) {}

  async archiveContext(context: Context): Promise<Result<ArchiveLocation, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Create archive directory structure
        const date = new Date();
        const year = date.getFullYear();
        const month = String(date.getMonth() + 1).padStart(2, '0');
        const archivePath = `${this.basePath}/archived/${year}/${month}`;
        
        // Ensure directory exists
        await this.filesystemService.client.callTool({
          name: 'create_directory',
          arguments: { path: archivePath }
        });
        
        // Compress context before archiving
        const compressed = await this.compressContext(context, 'lz4');
        if (compressed.tag === 'failure') {
          return compressed;
        }
        
        // Write compressed context to archive
        const filename = `${context.id}.lz4`;
        const filePath = `${archivePath}/${filename}`;
        
        await this.filesystemService.client.callTool({
          name: 'write_file',
          arguments: { 
            path: filePath, 
            content: compressed.value.data,
            encoding: 'base64'
          }
        });
        
        // Update archive index
        await this.updateArchiveIndex(context.id, filePath, compressed.value.stats);
        
        const location: ArchiveLocation = {
          path: filePath,
          contextId: context.id,
          compressionAlgorithm: 'lz4',
          originalSize: compressed.value.stats.originalSize,
          compressedSize: compressed.value.stats.compressedSize,
          archivedAt: new Date()
        };
        
        this.logger.info('Context archived', { 
          contextId: context.id, 
          path: filePath,
          compressionRatio: compressed.value.stats.compressionRatio
        });
        
        return success(location);
      },
      (error) => create('FILESYSTEM_ARCHIVE_ERROR', `Failed to archive context: ${error}`, 'SYSTEM')
    );
  }

  async compressContext(context: Context, algorithm: CompressionAlgorithm): Promise<Result<CompressedContext, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const serialized = JSON.stringify(context);
        const originalSize = Buffer.byteLength(serialized, 'utf8');
        
        let compressed: Buffer;
        
        switch (algorithm) {
          case 'lz4': {
            // Use Node.js LZ4 compression
            const lz4 = await import('lz4');
            compressed = lz4.encode(Buffer.from(serialized, 'utf8'));
            break;
          }
          
          case 'gzip': {
            // Use built-in zlib
            const zlib = await import('zlib');
            compressed = await new Promise<Buffer>((resolve, reject) => {
              zlib.gzip(Buffer.from(serialized, 'utf8'), (err, result) => {
                if (err) reject(err);
                else resolve(result);
              });
            });
            break;
          }
          
          default:
            return failure(create('UNSUPPORTED_COMPRESSION', `Unsupported algorithm: ${algorithm}`, 'BUSINESS'));
        }
        
        const compressedSize = compressed.length;
        const compressionRatio = compressedSize / originalSize;
        
        const result: CompressedContext = {
          contextId: context.id,
          algorithm,
          data: compressed.toString('base64'),
          stats: {
            originalSize,
            compressedSize,
            compressionRatio,
            compressedAt: new Date()
          }
        };
        
        this.logger.debug('Context compressed', { 
          contextId: context.id,
          algorithm,
          originalSize,
          compressedSize,
          ratio: compressionRatio
        });
        
        return success(result);
      },
      (error) => create('COMPRESSION_ERROR', `Failed to compress context: ${error}`, 'SYSTEM')
    );
  }

  async batchStore(contexts: Context[]): Promise<Result<StorageLocation[], QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const locations: StorageLocation[] = [];
        
        // Process contexts in batches to avoid overwhelming the filesystem
        const batchSize = 10;
        for (let i = 0; i < contexts.length; i += batchSize) {
          const batch = contexts.slice(i, i + batchSize);
          
          // Store batch in parallel
          const batchPromises = batch.map(async (context) => {
            const path = this.generateStoragePath(context);
            
            await this.filesystemService.client.callTool({
              name: 'write_file',
              arguments: { 
                path, 
                content: JSON.stringify(context, null, 2)
              }
            });
            
            return {
              contextId: context.id,
              path,
              storedAt: new Date()
            } as StorageLocation;
          });
          
          const batchResults = await Promise.all(batchPromises);
          locations.push(...batchResults);
        }
        
        this.logger.info('Batch stored contexts', { count: contexts.length });
        return success(locations);
      },
      (error) => create('BATCH_STORE_ERROR', `Failed to batch store contexts: ${error}`, 'SYSTEM')
    );
  }

  private generateStoragePath(context: Context): string {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    
    return `${this.basePath}/active/${context.type}/${year}-${month}-${day}/${context.id}.json`;
  }

  private async updateArchiveIndex(contextId: ContextId, filePath: string, stats: CompressionStats): Promise<void> {
    const indexPath = `${this.basePath}/indexes/archive-index.json`;
    
    // Read existing index
    let index: Record<string, any> = {};
    try {
      const existingIndex = await this.filesystemService.client.callTool({
        name: 'read_file',
        arguments: { path: indexPath }
      });
      if (existingIndex.content) {
        index = JSON.parse(existingIndex.content);
      }
    } catch {
      // Index doesn't exist yet, will create new one
    }
    
    // Update index
    index[contextId] = {
      filePath,
      archivedAt: new Date().toISOString(),
      originalSize: stats.originalSize,
      compressedSize: stats.compressedSize,
      compressionRatio: stats.compressionRatio
    };
    
    // Write updated index
    await this.filesystemService.client.callTool({
      name: 'write_file',
      arguments: { 
        path: indexPath,
        content: JSON.stringify(index, null, 2)
      }
    });
  }
}
```

## Service Configuration

### **MCP Service Configurations for Context Engineering**

```typescript
export const CONTEXT_ENGINEERING_MCP_SERVICES: MCPServiceConfig[] = [
  // Memory service for hot storage
  {
    name: 'context-memory',
    command: ['npx', '@modelcontextprotocol/server-memory'],
    environment: {
      MEMORY_MAX_SIZE: '1GB',
      MEMORY_EVICTION_POLICY: 'LRU',
      MEMORY_TTL_DEFAULT: '3600',
      MEMORY_PERSIST_INTERVAL: '300',
      MEMORY_COMPRESSION: 'true',
    },
    autoConnect: true,
  },
  
  // SQLite service for indexing and queries
  {
    name: 'context-sqlite',
    command: ['npx', '@modelcontextprotocol/server-sqlite'],
    environment: {
      SQLITE_DATABASE_PATH: './data/context-index.db',
      SQLITE_JOURNAL_MODE: 'WAL',
      SQLITE_SYNCHRONOUS: 'NORMAL',
      SQLITE_CACHE_SIZE: '10000',
      SQLITE_TEMP_STORE: 'MEMORY',
    },
    autoConnect: true,
  },
  
  // Filesystem service for archives
  {
    name: 'context-filesystem',
    command: ['npx', '@modelcontextprotocol/server-filesystem', './data/contexts'],
    environment: {
      FILESYSTEM_ALLOWED_EXTENSIONS: 'json,lz4,gz',
      FILESYSTEM_MAX_FILE_SIZE: '100MB',
      FILESYSTEM_COMPRESSION: 'true',
      FILESYSTEM_BACKUP_INTERVAL: '3600',
    },
    autoConnect: true,
  },
];
```

### **Service Initialization**

```typescript
class ContextEngineeringMCPManager {
  private services: Map<string, MCPServiceConnection> = new Map();
  
  async initialize(): Promise<Result<void, QiError>> {
    const mcpManager = new MCPServiceManager();
    
    // Initialize all context engineering services
    for (const config of CONTEXT_ENGINEERING_MCP_SERVICES) {
      const connectionResult = await mcpManager.connectToService(config);
      
      if (connectionResult.tag === 'failure') {
        this.logger.error(`Failed to connect to ${config.name}`, { error: connectionResult.error });
        continue;
      }
      
      const connection = mcpManager.getConnection(config.name);
      if (connection) {
        this.services.set(config.name, connection);
        this.logger.info(`Connected to MCP service: ${config.name}`);
      }
    }
    
    // Verify required services are available
    const requiredServices = ['context-memory', 'context-sqlite', 'context-filesystem'];
    const missingServices = requiredServices.filter(name => !this.services.has(name));
    
    if (missingServices.length > 0) {
      return failure(create(
        'MISSING_SERVICES', 
        `Required MCP services not available: ${missingServices.join(', ')}`,
        'SYSTEM'
      ));
    }
    
    return success(undefined);
  }
  
  getService(name: string): MCPServiceConnection | undefined {
    return this.services.get(name);
  }
  
  async healthCheck(): Promise<Result<ServiceHealthStatus, QiError>> {
    const status: ServiceHealthStatus = {
      services: {},
      overallHealth: 'healthy'
    };
    
    for (const [name, connection] of this.services) {
      try {
        // Ping service to check health
        await connection.client.callTool({
          name: 'ping',
          arguments: {}
        });
        
        status.services[name] = { status: 'healthy', lastChecked: new Date() };
      } catch (error) {
        status.services[name] = { status: 'unhealthy', error: String(error), lastChecked: new Date() };
        status.overallHealth = 'degraded';
      }
    }
    
    return success(status);
  }
}
```

## Integration Testing

### **MCP Service Integration Tests**

```typescript
describe('MCP Context Storage Integration', () => {
  let mcpManager: ContextEngineeringMCPManager;
  let memoryStorage: MemoryMCPContextStorage;
  let sqliteIndex: SQLiteMCPContextIndex;
  let filesystemStorage: FilesystemMCPContextStorage;
  
  beforeAll(async () => {
    mcpManager = new ContextEngineeringMCPManager();
    await mcpManager.initialize();
    
    memoryStorage = new MemoryMCPContextStorage(
      mcpManager.getService('context-memory')!,
      testLogger
    );
    
    sqliteIndex = new SQLiteMCPContextIndex(
      mcpManager.getService('context-sqlite')!,
      testLogger
    );
    
    filesystemStorage = new FilesystemMCPContextStorage(
      mcpManager.getService('context-filesystem')!,
      testLogger
    );
  });
  
  test('should store and retrieve context from memory', async () => {
    const context = createTestContext();
    
    const storeResult = await memoryStorage.storeActive(context);
    expect(storeResult.tag).toBe('success');
    
    const retrieveResult = await memoryStorage.getActive(context.id);
    expect(retrieveResult.tag).toBe('success');
    expect(retrieveResult.value?.id).toBe(context.id);
  });
  
  test('should index and query context metadata', async () => {
    const context = createTestContext();
    
    const indexResult = await sqliteIndex.indexContext(context);
    expect(indexResult.tag).toBe('success');
    
    const queryResult = await sqliteIndex.findContexts({ 
      type: context.type,
      limit: 10 
    });
    expect(queryResult.tag).toBe('success');
    expect(queryResult.value?.length).toBeGreaterThan(0);
  });
  
  test('should compress and archive context', async () => {
    const context = createTestContext();
    
    const archiveResult = await filesystemStorage.archiveContext(context);
    expect(archiveResult.tag).toBe('success');
    expect(archiveResult.value?.compressionRatio).toBeLessThan(1.0);
  });
  
  test('should handle service failures gracefully', async () => {
    // Simulate service failure
    const invalidService = new MCPServiceConnection(/* invalid config */);
    const storage = new MemoryMCPContextStorage(invalidService, testLogger);
    
    const result = await storage.storeActive(createTestContext());
    expect(result.tag).toBe('failure');
    expect(result.error.category).toBe('SYSTEM');
  });
});
```

## Performance Considerations

### **Optimization Strategies**

1. **Service Selection**: Choose appropriate MCP service based on access patterns
2. **Batch Operations**: Group operations to reduce MCP call overhead
3. **Compression**: Use appropriate compression algorithms for context size
4. **Caching**: Implement multi-level caching strategy
5. **Connection Pooling**: Reuse MCP connections efficiently

### **Performance Monitoring**

```typescript
interface MCPPerformanceMetrics {
  operationLatency: Map<string, HistogramMetric>;
  serviceAvailability: Map<string, GaugeMetric>;
  compressionRatio: HistogramMetric;
  cacheHitRate: RatioMetric;
}

class MCPPerformanceMonitor {
  private metrics: MCPPerformanceMetrics;
  
  recordOperation(service: string, operation: string, duration: number): void {
    const metricKey = `${service}.${operation}`;
    this.metrics.operationLatency.get(metricKey)?.observe(duration);
  }
  
  recordServiceHealth(service: string, isHealthy: boolean): void {
    this.metrics.serviceAvailability.get(service)?.set(isHealthy ? 1 : 0);
  }
  
  recordCompression(originalSize: number, compressedSize: number): void {
    const ratio = compressedSize / originalSize;
    this.metrics.compressionRatio.observe(ratio);
  }
}
```

## Next Steps

1. **Schema Design**: Define complete Zod schemas for all context types
2. **Strategy Implementation**: Implement Write, Select, Compress, Isolate strategies using MCP services
3. **Multi-Agent Coordination**: Build distributed context management on MCP foundation
4. **Performance Optimization**: Implement caching, batching, and monitoring
5. **Testing Framework**: Comprehensive integration and performance testing

---

**References**:
- [MCP SDK Documentation](https://github.com/modelcontextprotocol/sdk)
- [SQLite Performance Tuning](https://www.sqlite.org/optoverview.html)
- [Node.js Compression Libraries](https://nodejs.org/api/zlib.html)