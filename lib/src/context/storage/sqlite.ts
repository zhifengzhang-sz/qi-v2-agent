/**
 * SQLite MCP Storage Wrapper
 *
 * Provides a wrapper around the SQLite MCP service for context indexing,
 * complex queries, and relational data storage.
 */

import { create, failure, fromAsyncTryCatch, type QiError, type Result, success } from '@qi/base';
import type { MCPServiceConnection } from '../../messaging/index.js';
import type { SimpleLogger } from '../../utils/index.js';
import {
  type Context,
  type ContextFilter,
  type ContextQuery,
  type ContextRelationship,
  type StorageLocation,
  validateContext,
} from '../schemas/index.js';

// =============================================================================
// SQLite Storage Types
// =============================================================================

/**
 * SQLite storage configuration
 */
export interface SQLiteStorageConfig {
  databasePath: string;
  journalMode: 'DELETE' | 'TRUNCATE' | 'PERSIST' | 'MEMORY' | 'WAL' | 'OFF';
  cacheSize: number;
  enabled: boolean;
  indexingEnabled: boolean;
  fullTextSearchEnabled: boolean;
}

/**
 * Query execution statistics
 */
export interface QueryStats {
  executionTime: number;
  rowsReturned: number;
  indexesUsed: string[];
  fullTableScan: boolean;
}

/**
 * SQLite storage metrics
 */
export interface SQLiteStorageMetrics {
  totalContexts: number;
  totalRelationships: number;
  indexSize: number;
  queryCount: number;
  averageQueryTime: number;
  cacheHitRate: number;
}

// =============================================================================
// SQLite Storage Implementation
// =============================================================================

/**
 * SQLite MCP storage wrapper for context indexing and complex queries
 */
export class SQLiteContextStorage {
  private sqliteService: MCPServiceConnection;
  private logger: SimpleLogger;
  private config: SQLiteStorageConfig;
  private metrics: SQLiteStorageMetrics;
  private isInitialized: boolean = false;

  constructor(
    sqliteService: MCPServiceConnection,
    logger: SimpleLogger,
    config: SQLiteStorageConfig
  ) {
    this.sqliteService = sqliteService;
    this.logger = logger;
    this.config = config;
    this.metrics = {
      totalContexts: 0,
      totalRelationships: 0,
      indexSize: 0,
      queryCount: 0,
      averageQueryTime: 0,
      cacheHitRate: 0,
    };
  }

  /**
   * Initialize SQLite database schema
   */
  async initialize(): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        if (this.isInitialized) {
          return success(undefined);
        }

        this.logger.info('Initializing SQLite context storage schema');

        // Create contexts table
        await this.executeQuery(`
          CREATE TABLE IF NOT EXISTS contexts (
            id TEXT PRIMARY KEY,
            type TEXT NOT NULL,
            schema_version TEXT NOT NULL,
            content_json TEXT NOT NULL,
            metadata_json TEXT NOT NULL,
            checksum TEXT,
            version INTEGER NOT NULL DEFAULT 1,
            parent_version TEXT,
            
            -- Metadata fields for indexing
            priority INTEGER NOT NULL DEFAULT 5,
            relevance_score REAL NOT NULL DEFAULT 0.0,
            compression_level TEXT NOT NULL DEFAULT 'none',
            created_at INTEGER NOT NULL,
            last_accessed INTEGER NOT NULL,
            modified_at INTEGER,
            ttl INTEGER,
            expires_at INTEGER,
            archived INTEGER NOT NULL DEFAULT 0,
            
            -- Storage metadata
            storage_service TEXT NOT NULL DEFAULT 'sqlite',
            storage_location TEXT NOT NULL,
            storage_size INTEGER,
            compressed INTEGER NOT NULL DEFAULT 0,
            encrypted INTEGER NOT NULL DEFAULT 0,
            
            -- Access control
            owner TEXT,
            permissions TEXT, -- JSON array
            
            -- Quality metrics
            quality_score REAL,
            completeness_score REAL,
            accuracy_score REAL,
            
            -- Performance metadata
            access_count INTEGER NOT NULL DEFAULT 0,
            compression_ratio REAL,
            
            -- Full text search content
            searchable_content TEXT,
            tags TEXT -- JSON array for tag indexing
          )
        `);

        // Create relationships table
        await this.executeQuery(`
          CREATE TABLE IF NOT EXISTS context_relationships (
            id TEXT PRIMARY KEY,
            source_id TEXT NOT NULL,
            target_id TEXT NOT NULL,
            relationship_type TEXT NOT NULL,
            weight REAL NOT NULL DEFAULT 0.5,
            bidirectional INTEGER NOT NULL DEFAULT 0,
            created_at INTEGER NOT NULL,
            created_by TEXT,
            description TEXT,
            properties_json TEXT,
            
            FOREIGN KEY (source_id) REFERENCES contexts (id) ON DELETE CASCADE,
            FOREIGN KEY (target_id) REFERENCES contexts (id) ON DELETE CASCADE
          )
        `);

        // Create indexes for performance
        await this.createIndexes();

        // Enable full-text search if configured
        if (this.config.fullTextSearchEnabled) {
          await this.setupFullTextSearch();
        }

        // Update metrics
        await this.updateMetrics();

        this.isInitialized = true;
        this.logger.info('SQLite context storage schema initialized successfully');

        return success(undefined);
      },
      (error) =>
        create('SQLITE_INIT_ERROR', `Failed to initialize SQLite storage: ${error}`, 'SYSTEM', {
          error,
        })
    );
  }

  /**
   * Store a context with full indexing
   */
  async store(context: Context): Promise<Result<StorageLocation, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        // Ensure initialization
        const initResult = await this.initialize();
        if (initResult.tag === 'failure') {
          return initResult;
        }

        // Validate context
        const validationResult = validateContext(context);
        if (validationResult.tag === 'failure') {
          return validationResult;
        }

        const validatedContext = validationResult.value;

        // Prepare searchable content for full-text search
        const searchableContent = this.extractSearchableContent(validatedContext);

        // Insert or replace context
        const _result = await this.executeQuery(
          `
          INSERT OR REPLACE INTO contexts (
            id, type, schema_version, content_json, metadata_json, checksum, version, parent_version,
            priority, relevance_score, compression_level, created_at, last_accessed, modified_at,
            ttl, expires_at, archived, storage_service, storage_location, storage_size,
            compressed, encrypted, owner, permissions, quality_score, completeness_score,
            accuracy_score, access_count, compression_ratio, searchable_content, tags
          ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
          `,
          [
            validatedContext.id,
            validatedContext.type,
            validatedContext.schemaVersion,
            JSON.stringify(validatedContext.content),
            JSON.stringify(validatedContext.metadata),
            validatedContext.checksum,
            validatedContext.version,
            validatedContext.parentVersion,
            validatedContext.metadata.priority,
            validatedContext.metadata.relevanceScore,
            validatedContext.metadata.compressionLevel,
            validatedContext.metadata.createdAt.getTime(),
            validatedContext.metadata.lastAccessed.getTime(),
            validatedContext.metadata.modifiedAt?.getTime(),
            validatedContext.metadata.ttl,
            validatedContext.metadata.expiresAt?.getTime(),
            validatedContext.metadata.archived ? 1 : 0,
            'sqlite',
            `contexts/${validatedContext.id}`,
            JSON.stringify(validatedContext).length,
            validatedContext.metadata.compressionLevel !== 'none' ? 1 : 0,
            validatedContext.metadata.mcpStorage.encrypted ? 1 : 0,
            validatedContext.metadata.owner,
            JSON.stringify(validatedContext.metadata.permissions),
            validatedContext.metadata.qualityScore,
            validatedContext.metadata.completenessScore,
            validatedContext.metadata.accuracyScore,
            validatedContext.metadata.accessCount,
            validatedContext.metadata.compressionRatio,
            searchableContent,
            JSON.stringify(validatedContext.metadata.tags),
          ]
        );

        // Store relationships
        await this.storeRelationships(validatedContext.id, validatedContext.relationships);

        // Create storage location
        const storageLocation: StorageLocation = {
          contextId: validatedContext.id,
          service: 'sqlite',
          path: `contexts/${validatedContext.id}`,
          storedAt: new Date(),
          storageSize: JSON.stringify(validatedContext).length,
          compressed: validatedContext.metadata.compressionLevel !== 'none',
          encrypted: validatedContext.metadata.mcpStorage.encrypted,
          accessCount: 0,
        };

        // Update metrics
        this.updateStoreMetrics(Date.now() - startTime);

        this.logger.debug('Context stored in SQLite', {
          contextId: validatedContext.id,
          type: validatedContext.type,
          size: storageLocation.storageSize,
        });

        return success(storageLocation);
      },
      (error) =>
        create('SQLITE_STORE_ERROR', `Failed to store context in SQLite: ${error}`, 'SYSTEM', {
          contextId: context.id,
          error,
        })
    );
  }

  /**
   * Retrieve a context by ID
   */
  async retrieve(contextId: string): Promise<Result<Context, QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        const result = await this.executeQuery(`SELECT * FROM contexts WHERE id = ?`, [contextId]);

        if (!result.rows || result.rows.length === 0) {
          return failure(
            create('CONTEXT_NOT_FOUND', `Context ${contextId} not found in SQLite`, 'BUSINESS')
          );
        }

        const row = result.rows[0];
        const context = this.rowToContext(row);

        // Load relationships
        const relationshipsResult = await this.loadRelationships(contextId);
        if (relationshipsResult.tag === 'success') {
          context.relationships = relationshipsResult.value;
        }

        // Update access count
        await this.executeQuery(
          `UPDATE contexts SET access_count = access_count + 1, last_accessed = ? WHERE id = ?`,
          [Date.now(), contextId]
        );

        this.updateRetrieveMetrics(Date.now() - startTime);

        this.logger.debug('Context retrieved from SQLite', { contextId });

        return success(context);
      },
      (error) =>
        create(
          'SQLITE_RETRIEVE_ERROR',
          `Failed to retrieve context from SQLite: ${error}`,
          'SYSTEM',
          { contextId, error }
        )
    );
  }

  /**
   * Complex context query with full SQL capabilities
   */
  async query(query: ContextQuery): Promise<Result<Context[], QiError>> {
    const startTime = Date.now();

    return await fromAsyncTryCatch(
      async () => {
        const sqlQuery = this.buildSQLQuery(query);
        const result = await this.executeQuery(sqlQuery.sql, sqlQuery.params);

        const contexts: Context[] = [];

        if (result.rows) {
          for (const row of result.rows) {
            const context = this.rowToContext(row);

            // Load relationships if requested
            if (query.includeRelationships !== false) {
              const relationshipsResult = await this.loadRelationships(context.id);
              if (relationshipsResult.tag === 'success') {
                context.relationships = relationshipsResult.value;
              }
            }

            contexts.push(context);
          }
        }

        this.updateQueryMetrics(Date.now() - startTime, contexts.length);

        this.logger.debug('SQLite query completed', {
          resultCount: contexts.length,
          executionTime: Date.now() - startTime,
          query: sqlQuery.sql,
        });

        return success(contexts);
      },
      (error) =>
        create('SQLITE_QUERY_ERROR', `Failed to query contexts from SQLite: ${error}`, 'SYSTEM', {
          error,
        })
    );
  }

  /**
   * Advanced filtering with custom SQL conditions
   */
  async filter(filter: ContextFilter): Promise<Result<Context[], QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        const sqlQuery = this.buildFilterQuery(filter);
        const result = await this.executeQuery(sqlQuery.sql, sqlQuery.params);

        const contexts: Context[] = [];

        if (result.rows) {
          for (const row of result.rows) {
            contexts.push(this.rowToContext(row));
          }
        }

        this.logger.debug('SQLite filter completed', {
          resultCount: contexts.length,
          filter,
        });

        return success(contexts);
      },
      (error) =>
        create('SQLITE_FILTER_ERROR', `Failed to filter contexts from SQLite: ${error}`, 'SYSTEM', {
          error,
        })
    );
  }

  /**
   * Full-text search across context content
   */
  async fullTextSearch(searchQuery: string, limit = 50): Promise<Result<Context[], QiError>> {
    if (!this.config.fullTextSearchEnabled) {
      return failure(
        create('FULL_TEXT_SEARCH_DISABLED', 'Full-text search is not enabled', 'BUSINESS')
      );
    }

    return await fromAsyncTryCatch(
      async () => {
        const result = await this.executeQuery(
          `
          SELECT contexts.*, fts.rank
          FROM context_fts fts
          JOIN contexts ON contexts.id = fts.rowid
          WHERE context_fts MATCH ?
          ORDER BY fts.rank DESC
          LIMIT ?
          `,
          [searchQuery, limit]
        );

        const contexts: Context[] = [];

        if (result.rows) {
          for (const row of result.rows) {
            contexts.push(this.rowToContext(row));
          }
        }

        this.logger.debug('Full-text search completed', {
          searchQuery,
          resultCount: contexts.length,
        });

        return success(contexts);
      },
      (error) =>
        create('SQLITE_FULL_TEXT_SEARCH_ERROR', `Full-text search failed: ${error}`, 'SYSTEM', {
          searchQuery,
          error,
        })
    );
  }

  /**
   * Get relationship graph for a context
   */
  async getRelationshipGraph(contextId: string, depth = 2): Promise<Result<Context[], QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Recursive CTE to traverse relationships
        const result = await this.executeQuery(
          `
          WITH RECURSIVE relationship_graph AS (
            -- Base case: start with the given context
            SELECT id, type, 0 as depth
            FROM contexts 
            WHERE id = ?
            
            UNION ALL
            
            -- Recursive case: find related contexts
            SELECT c.id, c.type, rg.depth + 1
            FROM relationship_graph rg
            JOIN context_relationships cr ON (cr.source_id = rg.id OR cr.target_id = rg.id)
            JOIN contexts c ON (c.id = CASE 
              WHEN cr.source_id = rg.id THEN cr.target_id 
              ELSE cr.source_id 
            END)
            WHERE rg.depth < ?
              AND c.id NOT IN (SELECT id FROM relationship_graph)
          )
          SELECT DISTINCT c.*
          FROM relationship_graph rg
          JOIN contexts c ON c.id = rg.id
          `,
          [contextId, depth]
        );

        const contexts: Context[] = [];

        if (result.rows) {
          for (const row of result.rows) {
            const context = this.rowToContext(row);

            // Load relationships for each context
            const relationshipsResult = await this.loadRelationships(context.id);
            if (relationshipsResult.tag === 'success') {
              context.relationships = relationshipsResult.value;
            }

            contexts.push(context);
          }
        }

        this.logger.debug('Relationship graph retrieved', {
          rootContext: contextId,
          depth,
          relatedContexts: contexts.length,
        });

        return success(contexts);
      },
      (error) =>
        create(
          'SQLITE_RELATIONSHIP_GRAPH_ERROR',
          `Failed to get relationship graph: ${error}`,
          'SYSTEM',
          { contextId, depth, error }
        )
    );
  }

  /**
   * Delete a context and its relationships
   */
  async delete(contextId: string): Promise<Result<void, QiError>> {
    return await fromAsyncTryCatch(
      async () => {
        // Delete context (relationships will cascade)
        await this.executeQuery(`DELETE FROM contexts WHERE id = ?`, [contextId]);

        this.logger.debug('Context deleted from SQLite', { contextId });

        return success(undefined);
      },
      (error) =>
        create('SQLITE_DELETE_ERROR', `Failed to delete context from SQLite: ${error}`, 'SYSTEM', {
          contextId,
          error,
        })
    );
  }

  /**
   * Get storage metrics
   */
  getMetrics(): SQLiteStorageMetrics {
    return { ...this.metrics };
  }

  // =============================================================================
  // Private Helper Methods
  // =============================================================================

  private async executeQuery(sql: string, params: any[] = []): Promise<any> {
    return await this.sqliteService.client.callTool({
      name: 'execute_query',
      arguments: { sql, params },
    });
  }

  private async createIndexes(): Promise<void> {
    const indexes = [
      'CREATE INDEX IF NOT EXISTS idx_contexts_type ON contexts(type)',
      'CREATE INDEX IF NOT EXISTS idx_contexts_created_at ON contexts(created_at)',
      'CREATE INDEX IF NOT EXISTS idx_contexts_last_accessed ON contexts(last_accessed)',
      'CREATE INDEX IF NOT EXISTS idx_contexts_priority ON contexts(priority)',
      'CREATE INDEX IF NOT EXISTS idx_contexts_relevance_score ON contexts(relevance_score)',
      'CREATE INDEX IF NOT EXISTS idx_contexts_owner ON contexts(owner)',
      'CREATE INDEX IF NOT EXISTS idx_contexts_archived ON contexts(archived)',
      'CREATE INDEX IF NOT EXISTS idx_contexts_expires_at ON contexts(expires_at)',
      'CREATE INDEX IF NOT EXISTS idx_relationships_source ON context_relationships(source_id)',
      'CREATE INDEX IF NOT EXISTS idx_relationships_target ON context_relationships(target_id)',
      'CREATE INDEX IF NOT EXISTS idx_relationships_type ON context_relationships(relationship_type)',
    ];

    for (const indexSql of indexes) {
      await this.executeQuery(indexSql);
    }
  }

  private async setupFullTextSearch(): Promise<void> {
    await this.executeQuery(`
      CREATE VIRTUAL TABLE IF NOT EXISTS context_fts USING fts5(
        id UNINDEXED,
        type UNINDEXED,
        searchable_content,
        tags,
        content=contexts,
        content_rowid=rowid
      )
    `);

    // Create triggers to keep FTS table in sync
    await this.executeQuery(`
      CREATE TRIGGER IF NOT EXISTS contexts_fts_insert AFTER INSERT ON contexts
      BEGIN
        INSERT INTO context_fts(rowid, id, type, searchable_content, tags)
        VALUES (new.rowid, new.id, new.type, new.searchable_content, new.tags);
      END
    `);

    await this.executeQuery(`
      CREATE TRIGGER IF NOT EXISTS contexts_fts_delete AFTER DELETE ON contexts
      BEGIN
        INSERT INTO context_fts(context_fts, rowid, id, type, searchable_content, tags)
        VALUES ('delete', old.rowid, old.id, old.type, old.searchable_content, old.tags);
      END
    `);

    await this.executeQuery(`
      CREATE TRIGGER IF NOT EXISTS contexts_fts_update AFTER UPDATE ON contexts
      BEGIN
        INSERT INTO context_fts(context_fts, rowid, id, type, searchable_content, tags)
        VALUES ('delete', old.rowid, old.id, old.type, old.searchable_content, old.tags);
        INSERT INTO context_fts(rowid, id, type, searchable_content, tags)
        VALUES (new.rowid, new.id, new.type, new.searchable_content, new.tags);
      END
    `);
  }

  private extractSearchableContent(context: Context): string {
    const content = [];

    // Add content text
    const contentStr = JSON.stringify(context.content);
    content.push(contentStr);

    // Add tags
    content.push(context.metadata.tags.join(' '));

    // Add type-specific searchable content
    if (context.type === 'conversation') {
      // Extract conversation turns for searching
      const conv = context as any; // Type assertion for conversation context
      if (conv.content?.turns) {
        content.push(conv.content.turns.map((t: any) => t.content).join(' '));
      }
    }

    return content.join(' ').toLowerCase();
  }

  private rowToContext(row: any): Context {
    return {
      id: row.id,
      type: row.type,
      schemaVersion: row.schema_version,
      content: JSON.parse(row.content_json),
      metadata: {
        ...JSON.parse(row.metadata_json),
        createdAt: new Date(row.created_at),
        lastAccessed: new Date(row.last_accessed),
        modifiedAt: row.modified_at ? new Date(row.modified_at) : undefined,
        expiresAt: row.expires_at ? new Date(row.expires_at) : undefined,
      },
      relationships: [], // Will be loaded separately
      version: row.version,
      parentVersion: row.parent_version,
      checksum: row.checksum,
    };
  }

  private async storeRelationships(
    contextId: string,
    relationships: ContextRelationship[]
  ): Promise<void> {
    // Delete existing relationships
    await this.executeQuery(`DELETE FROM context_relationships WHERE source_id = ?`, [contextId]);

    // Insert new relationships
    for (const rel of relationships) {
      await this.executeQuery(
        `
        INSERT INTO context_relationships (
          id, source_id, target_id, relationship_type, weight, bidirectional,
          created_at, created_by, description, properties_json
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `,
        [
          `${contextId}-${rel.targetId}-${rel.type}`,
          contextId,
          rel.targetId,
          rel.type,
          rel.weight,
          rel.bidirectional ? 1 : 0,
          rel.createdAt.getTime(),
          rel.createdBy,
          rel.description,
          JSON.stringify(rel.properties),
        ]
      );
    }
  }

  private async loadRelationships(
    contextId: string
  ): Promise<Result<ContextRelationship[], QiError>> {
    try {
      const result = await this.executeQuery(
        `SELECT * FROM context_relationships WHERE source_id = ? OR (bidirectional = 1 AND target_id = ?)`,
        [contextId, contextId]
      );

      const relationships: ContextRelationship[] = [];

      if (result.rows) {
        for (const row of result.rows) {
          relationships.push({
            targetId: row.source_id === contextId ? row.target_id : row.source_id,
            type: row.relationship_type,
            weight: row.weight,
            bidirectional: row.bidirectional === 1,
            createdAt: new Date(row.created_at),
            createdBy: row.created_by,
            description: row.description,
            properties: row.properties_json ? JSON.parse(row.properties_json) : undefined,
          });
        }
      }

      return success(relationships);
    } catch (error) {
      return failure(
        create(
          'SQLITE_LOAD_RELATIONSHIPS_ERROR',
          `Failed to load relationships: ${error}`,
          'SYSTEM',
          { contextId, error }
        )
      );
    }
  }

  private buildSQLQuery(query: ContextQuery): { sql: string; params: any[] } {
    const conditions: string[] = [];
    const params: any[] = [];

    // Build WHERE conditions
    if (query.ids && query.ids.length > 0) {
      conditions.push(`id IN (${query.ids.map(() => '?').join(', ')})`);
      params.push(...query.ids);
    }

    if (query.type) {
      conditions.push('type = ?');
      params.push(query.type);
    }

    if (query.types && query.types.length > 0) {
      conditions.push(`type IN (${query.types.map(() => '?').join(', ')})`);
      params.push(...query.types);
    }

    if (query.minPriority !== undefined) {
      conditions.push('priority >= ?');
      params.push(query.minPriority);
    }

    if (query.maxPriority !== undefined) {
      conditions.push('priority <= ?');
      params.push(query.maxPriority);
    }

    if (query.createdAfter) {
      conditions.push('created_at >= ?');
      params.push(query.createdAfter.getTime());
    }

    if (query.createdBefore) {
      conditions.push('created_at <= ?');
      params.push(query.createdBefore.getTime());
    }

    if (query.archived !== undefined) {
      conditions.push('archived = ?');
      params.push(query.archived ? 1 : 0);
    }

    // Build ORDER BY
    const orderBy = this.buildOrderBy(query.sortBy || 'relevance', query.sortOrder || 'desc');

    // Build final SQL
    let sql = 'SELECT * FROM contexts';
    if (conditions.length > 0) {
      sql += ` WHERE ${conditions.join(' AND ')}`;
    }
    sql += ` ${orderBy}`;
    sql += ` LIMIT ${query.limit || 50}`;
    if (query.offset) {
      sql += ` OFFSET ${query.offset}`;
    }

    return { sql, params };
  }

  private buildFilterQuery(_filter: ContextFilter): { sql: string; params: any[] } {
    // This would implement more complex filtering logic
    // For now, return a basic implementation
    return {
      sql: 'SELECT * FROM contexts LIMIT 50',
      params: [],
    };
  }

  private buildOrderBy(sortBy: string, sortOrder: string): string {
    const column = this.getSortColumn(sortBy);
    return `ORDER BY ${column} ${sortOrder.toUpperCase()}`;
  }

  private getSortColumn(sortBy: string): string {
    switch (sortBy) {
      case 'created':
        return 'created_at';
      case 'modified':
        return 'COALESCE(modified_at, created_at)';
      case 'accessed':
        return 'last_accessed';
      case 'priority':
        return 'priority';
      case 'relevance':
        return 'relevance_score';
      default:
        return 'relevance_score';
    }
  }

  private async updateMetrics(): Promise<void> {
    try {
      const contextCountResult = await this.executeQuery('SELECT COUNT(*) as count FROM contexts');
      this.metrics.totalContexts = contextCountResult.rows[0]?.count || 0;

      const relationshipCountResult = await this.executeQuery(
        'SELECT COUNT(*) as count FROM context_relationships'
      );
      this.metrics.totalRelationships = relationshipCountResult.rows[0]?.count || 0;
    } catch (error) {
      this.logger.warn('Failed to update SQLite metrics', { error });
    }
  }

  private updateStoreMetrics(executionTime: number): void {
    this.metrics.totalContexts++;
    this.updateAverageQueryTime(executionTime);
  }

  private updateRetrieveMetrics(executionTime: number): void {
    this.updateAverageQueryTime(executionTime);
  }

  private updateQueryMetrics(executionTime: number, _resultCount: number): void {
    this.metrics.queryCount++;
    this.updateAverageQueryTime(executionTime);
  }

  private updateAverageQueryTime(executionTime: number): void {
    this.metrics.averageQueryTime =
      (this.metrics.averageQueryTime * (this.metrics.queryCount - 1) + executionTime) /
      this.metrics.queryCount;
  }
}
