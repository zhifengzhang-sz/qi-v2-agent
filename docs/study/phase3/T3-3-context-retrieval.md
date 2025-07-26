# T3-3: Semantic Context Retrieval Implementation

## Overview

This guide implements intelligent context management with relevance ranking and SEM-RAG patterns for advanced code understanding. Based on research findings, this moves beyond traditional RAG to semantic relationship understanding and architectural coherence.

## Prerequisites

- T3-1 streaming agent implemented
- T3-2 ChromaDB RAG system operational
- Understanding of semantic search and static analysis concepts

## Current Technology Status (Research-Based)

**Advanced Context Management Status:**
- ✅ SEM-RAG (Semantic Retrieval-Augmented Generation) patterns available
- ✅ Static analysis integration for TypeScript projects
- ✅ Import statement analysis and dependency understanding
- ✅ Leading implementations (Cursor, GitHub Copilot) provide proven patterns
- ✅ MCP integration enables universal adapter capabilities

## Architecture Overview

```
Query → Semantic Analysis → Multi-dimensional Search → 
Relevance Ranking → Architectural Coherence Check → 
Context Assembly → Token Optimization → LLM Integration
```

## Implementation Strategy

### Step 1: Enhanced Semantic Search Engine

**File: `src/context/semantic-search-engine.ts`**
```typescript
import type { Document } from '@langchain/core/documents';
import { RAGPipeline } from '../rag/rag-pipeline.js';

export interface SearchContext {
  query: string;
  intent: 'explanation' | 'implementation' | 'debugging' | 'refactoring';
  scope: 'file' | 'module' | 'project' | 'dependencies';
  codeContext?: {
    currentFile?: string;
    selectedCode?: string;
    cursorPosition?: { line: number; column: number };
  };
}

export interface RelevanceScore {
  semantic: number;        // Vector similarity score
  syntactic: number;       // Text/keyword matching
  structural: number;      // Code structure relevance
  contextual: number;      // Current context relevance
  temporal: number;        // Recent usage/modification
  combined: number;        // Weighted combination
}

export class SemanticSearchEngine {
  private ragPipeline: RAGPipeline;
  private searchHistory = new Map<string, Document[]>();
  private contextCache = new Map<string, any>();

  constructor(ragPipeline: RAGPipeline) {
    this.ragPipeline = ragPipeline;
  }

  async search(context: SearchContext): Promise<{
    documents: Document[];
    relevanceScores: Map<string, RelevanceScore>;
    searchMetadata: any;
  }> {
    console.log(`🔍 Enhanced semantic search: "${context.query}"`);
    console.log(`📊 Intent: ${context.intent}, Scope: ${context.scope}`);

    try {
      // Multi-dimensional search strategy
      const searchResults = await this.performMultiDimensionalSearch(context);
      
      // Calculate advanced relevance scores
      const relevanceScores = await this.calculateRelevanceScores(
        searchResults,
        context
      );
      
      // Apply architectural coherence filtering
      const coherentResults = await this.applyArchitecturalCoherence(
        searchResults,
        relevanceScores,
        context
      );
      
      // Cache results for future queries
      this.cacheSearchResults(context.query, coherentResults);
      
      return {
        documents: coherentResults,
        relevanceScores,
        searchMetadata: {
          totalResults: searchResults.length,
          filteredResults: coherentResults.length,
          searchTime: Date.now(),
          intent: context.intent,
          scope: context.scope
        }
      };
      
    } catch (error) {
      console.error('❌ Enhanced semantic search failed:', error);
      throw error;
    }
  }

  private async performMultiDimensionalSearch(context: SearchContext): Promise<Document[]> {
    const searchStrategies = [
      // Semantic vector search
      this.semanticVectorSearch(context),
      
      // Syntactic keyword search
      this.syntacticKeywordSearch(context),
      
      // Structural code search
      this.structuralCodeSearch(context),
      
      // Contextual proximity search
      this.contextualProximitySearch(context)
    ];

    const results = await Promise.all(searchStrategies);
    
    // Merge and deduplicate results
    const mergedResults = new Map<string, Document>();
    
    for (const resultSet of results) {
      for (const doc of resultSet) {
        const key = doc.metadata.chunkId || doc.metadata.source;
        if (!mergedResults.has(key)) {
          mergedResults.set(key, doc);
        }
      }
    }
    
    return Array.from(mergedResults.values());
  }

  private async semanticVectorSearch(context: SearchContext): Promise<Document[]> {
    // Enhanced query processing based on intent
    const enhancedQuery = this.enhanceQueryByIntent(context.query, context.intent);
    
    return this.ragPipeline.semanticSearch(enhancedQuery, {
      topK: 15, // Increased for multi-dimensional filtering
      scoreThreshold: 0.6, // Lower threshold for broader initial search
      filter: this.buildScopeFilter(context.scope, context.codeContext)
    });
  }

  private async syntacticKeywordSearch(context: SearchContext): Promise<Document[]> {
    // Extract keywords and technical terms
    const keywords = this.extractTechnicalKeywords(context.query);
    
    // Build keyword-based filter
    const keywordFilter = {
      $or: keywords.map(keyword => ({
        pageContent: { $contains: keyword }
      }))
    };
    
    return this.ragPipeline.semanticSearch(context.query, {
      topK: 10,
      scoreThreshold: 0.5,
      filter: keywordFilter
    });
  }

  private async structuralCodeSearch(context: SearchContext): Promise<Document[]> {
    // Search for specific code structures based on intent
    const structuralPatterns = this.getStructuralPatterns(context.intent);
    
    const results: Document[] = [];
    
    for (const pattern of structuralPatterns) {
      const patternResults = await this.ragPipeline.semanticSearch(pattern, {
        topK: 5,
        scoreThreshold: 0.7
      });
      results.push(...patternResults);
    }
    
    return results;
  }

  private async contextualProximitySearch(context: SearchContext): Promise<Document[]> {
    if (!context.codeContext?.currentFile) {
      return [];
    }

    // Search for related files and modules
    const currentFileFilter = {
      source: { $regex: context.codeContext.currentFile.replace(/\.[^/.]+$/, '') }
    };
    
    return this.ragPipeline.semanticSearch(context.query, {
      topK: 8,
      scoreThreshold: 0.6,
      filter: currentFileFilter
    });
  }

  private enhanceQueryByIntent(query: string, intent: SearchContext['intent']): string {
    const intentEnhancements = {
      explanation: `Explain how ${query} works and its purpose`,
      implementation: `Show implementation details and examples of ${query}`,
      debugging: `Find issues, errors, or problems related to ${query}`,
      refactoring: `Find code that can be improved or refactored for ${query}`
    };
    
    return intentEnhancements[intent] || query;
  }

  private extractTechnicalKeywords(query: string): string[] {
    // Simple keyword extraction - could be enhanced with NLP
    const technicalTerms = query.match(/\b[A-Z][a-zA-Z]*[A-Z][a-zA-Z]*\b/g) || []; // CamelCase
    const functionNames = query.match(/\b[a-z][a-zA-Z]*\(/g)?.map(m => m.slice(0, -1)) || [];
    const regularWords = query.toLowerCase().split(/\s+/).filter(w => w.length > 3);
    
    return [...new Set([...technicalTerms, ...functionNames, ...regularWords])];
  }

  private getStructuralPatterns(intent: SearchContext['intent']): string[] {
    const patterns = {
      explanation: ['class definition', 'function signature', 'interface declaration'],
      implementation: ['function implementation', 'method body', 'constructor'],
      debugging: ['try catch', 'error handling', 'console.log', 'debugging'],
      refactoring: ['duplicate code', 'long function', 'complex condition']
    };
    
    return patterns[intent] || [];
  }

  private buildScopeFilter(scope: SearchContext['scope'], codeContext?: SearchContext['codeContext']) {
    const filters: any = {};
    
    switch (scope) {
      case 'file':
        if (codeContext?.currentFile) {
          filters.source = codeContext.currentFile;
        }
        break;
      case 'module':
        if (codeContext?.currentFile) {
          const moduleDir = codeContext.currentFile.split('/').slice(0, -1).join('/');
          filters.source = { $regex: `^${moduleDir}/` };
        }
        break;
      case 'dependencies':
        filters.source = { $regex: '(node_modules|imports|dependencies)' };
        break;
      // 'project' scope uses no filter (searches everything)
    }
    
    return filters;
  }

  private async calculateRelevanceScores(
    documents: Document[],
    context: SearchContext
  ): Promise<Map<string, RelevanceScore>> {
    const scores = new Map<string, RelevanceScore>();
    
    for (const doc of documents) {
      const score = await this.calculateDocumentRelevance(doc, context);
      const key = doc.metadata.chunkId || doc.metadata.source;
      scores.set(key, score);
    }
    
    return scores;
  }

  private async calculateDocumentRelevance(
    document: Document,
    context: SearchContext
  ): Promise<RelevanceScore> {
    // Semantic score (from vector similarity)
    const semantic = document.metadata.similarityScore || 0;
    
    // Syntactic score (keyword matching)
    const syntactic = this.calculateSyntacticScore(document, context.query);
    
    // Structural score (code structure relevance)
    const structural = this.calculateStructuralScore(document, context);
    
    // Contextual score (current context relevance)
    const contextual = this.calculateContextualScore(document, context);
    
    // Temporal score (recent usage/modification)
    const temporal = this.calculateTemporalScore(document);
    
    // Combined weighted score
    const weights = { semantic: 0.3, syntactic: 0.2, structural: 0.2, contextual: 0.2, temporal: 0.1 };
    const combined = 
      weights.semantic * semantic +
      weights.syntactic * syntactic +
      weights.structural * structural +
      weights.contextual * contextual +
      weights.temporal * temporal;
    
    return { semantic, syntactic, structural, contextual, temporal, combined };
  }

  private calculateSyntacticScore(document: Document, query: string): number {
    const queryTerms = query.toLowerCase().split(/\s+/);
    const docContent = document.pageContent.toLowerCase();
    
    let matches = 0;
    for (const term of queryTerms) {
      if (docContent.includes(term)) {
        matches++;
      }
    }
    
    return matches / queryTerms.length;
  }

  private calculateStructuralScore(document: Document, context: SearchContext): number {
    const content = document.pageContent;
    let score = 0;
    
    // Boost for code structures based on intent
    if (context.intent === 'implementation') {
      if (content.includes('function ') || content.includes('const ') || content.includes('class ')) {
        score += 0.3;
      }
    }
    
    if (context.intent === 'explanation') {
      if (content.includes('/**') || content.includes('//')) {
        score += 0.3;
      }
    }
    
    // TypeScript specific boosts
    if (document.metadata.extension === '.ts' || document.metadata.extension === '.tsx') {
      if (content.includes('interface ') || content.includes('type ')) {
        score += 0.2;
      }
    }
    
    return Math.min(score, 1.0);
  }

  private calculateContextualScore(document: Document, context: SearchContext): number {
    if (!context.codeContext?.currentFile) {
      return 0;
    }
    
    const docSource = document.metadata.source;
    const currentFile = context.codeContext.currentFile;
    
    // Same file gets highest score
    if (docSource === currentFile) {
      return 1.0;
    }
    
    // Same directory gets high score
    const docDir = docSource.split('/').slice(0, -1).join('/');
    const currentDir = currentFile.split('/').slice(0, -1).join('/');
    if (docDir === currentDir) {
      return 0.8;
    }
    
    // Related by import statements (simplified check)
    if (document.pageContent.includes(`from './${currentFile}'`) ||
        document.pageContent.includes(`import * from './${currentFile}'`)) {
      return 0.9;
    }
    
    return 0.1;
  }

  private calculateTemporalScore(document: Document): number {
    const timestamp = document.metadata.timestamp;
    if (!timestamp) {
      return 0.5; // Neutral score for documents without timestamp
    }
    
    const docTime = new Date(timestamp).getTime();
    const now = Date.now();
    const dayInMs = 24 * 60 * 60 * 1000;
    const weekInMs = 7 * dayInMs;
    
    const age = now - docTime;
    
    if (age < dayInMs) {
      return 1.0; // Very recent
    } else if (age < weekInMs) {
      return 0.8; // Recent
    } else {
      return 0.3; // Older
    }
  }

  private async applyArchitecturalCoherence(
    documents: Document[],
    relevanceScores: Map<string, RelevanceScore>,
    context: SearchContext
  ): Promise<Document[]> {
    // Sort by combined relevance score
    const sortedDocuments = documents.sort((a, b) => {
      const scoreA = relevanceScores.get(a.metadata.chunkId || a.metadata.source)?.combined || 0;
      const scoreB = relevanceScores.get(b.metadata.chunkId || b.metadata.source)?.combined || 0;
      return scoreB - scoreA;
    });
    
    // Apply architectural coherence filtering
    const coherentDocuments = [];
    const includedSources = new Set<string>();
    
    for (const doc of sortedDocuments) {
      const source = doc.metadata.source;
      
      // Avoid too many chunks from the same file
      if (this.countChunksFromSource(coherentDocuments, source) >= 3) {
        continue;
      }
      
      // Ensure diverse representation of different parts of codebase
      if (coherentDocuments.length >= 10 && includedSources.has(source.split('/')[0])) {
        continue;
      }
      
      coherentDocuments.push(doc);
      includedSources.add(source.split('/')[0]);
      
      // Limit total results
      if (coherentDocuments.length >= 15) {
        break;
      }
    }
    
    return coherentDocuments;
  }

  private countChunksFromSource(documents: Document[], source: string): number {
    return documents.filter(doc => doc.metadata.source === source).length;
  }

  private cacheSearchResults(query: string, results: Document[]): void {
    // Simple LRU cache implementation
    if (this.searchHistory.size >= 100) {
      const firstKey = this.searchHistory.keys().next().value;
      this.searchHistory.delete(firstKey);
    }
    this.searchHistory.set(query, results);
  }
}
```

### Step 2: Context Assembly and Optimization

**File: `src/context/context-assembler.ts`**
```typescript
import type { Document } from '@langchain/core/documents';
import type { RelevanceScore } from './semantic-search-engine.js';

export interface AssembledContext {
  content: string;
  sources: string[];
  metadata: ContextMetadata;
  tokenCount: number;
}

export interface ContextMetadata {
  relevanceScores: RelevanceScore[];
  coverageMap: Map<string, number>;
  searchMetadata: any;
  assemblyStrategy: string;
  optimizations: string[];
}

export class ContextAssembler {
  private readonly MAX_TOKENS = 8000; // Leave room for query and response
  private readonly TOKEN_BUFFER = 1000; // Safety buffer

  async assembleContext(
    documents: Document[],
    relevanceScores: Map<string, RelevanceScore>,
    searchMetadata: any,
    query: string
  ): Promise<AssembledContext> {
    console.log(`🔧 Assembling context from ${documents.length} documents`);

    // Choose assembly strategy based on document types and relevance
    const strategy = this.chooseAssemblyStrategy(documents, searchMetadata);
    console.log(`📋 Using assembly strategy: ${strategy}`);

    let assembledContext: AssembledContext;

    switch (strategy) {
      case 'hierarchical':
        assembledContext = await this.assembleHierarchical(documents, relevanceScores, searchMetadata);
        break;
      case 'thematic':
        assembledContext = await this.assembleThematic(documents, relevanceScores, searchMetadata);
        break;
      case 'sequential':
        assembledContext = await this.assembleSequential(documents, relevanceScores, searchMetadata);
        break;
      default:
        assembledContext = await this.assembleBalanced(documents, relevanceScores, searchMetadata);
    }

    // Apply final optimizations
    const optimizedContext = await this.optimizeContext(assembledContext, query);

    console.log(`✅ Context assembled: ${optimizedContext.tokenCount} tokens, ${optimizedContext.sources.length} sources`);
    return optimizedContext;
  }

  private chooseAssemblyStrategy(documents: Document[], searchMetadata: any): string {
    const intent = searchMetadata.intent;
    const scope = searchMetadata.scope;
    
    // Strategy selection logic
    if (intent === 'explanation' && scope === 'project') {
      return 'hierarchical'; // Overview first, then details
    }
    
    if (intent === 'implementation' && documents.length > 10) {
      return 'thematic'; // Group by functionality
    }
    
    if (intent === 'debugging' || scope === 'file') {
      return 'sequential'; // Follow code flow
    }
    
    return 'balanced'; // Default balanced approach
  }

  private async assembleHierarchical(
    documents: Document[],
    relevanceScores: Map<string, RelevanceScore>,
    searchMetadata: any
  ): Promise<AssembledContext> {
    // Group documents by abstraction level
    const levels = this.groupByAbstractionLevel(documents);
    
    let content = '';
    const sources: string[] = [];
    const relevanceList: RelevanceScore[] = [];
    let tokenCount = 0;
    const availableTokens = this.MAX_TOKENS - this.TOKEN_BUFFER;

    // Start with high-level overview
    for (const level of ['high', 'medium', 'low']) {
      if (!levels[level] || tokenCount >= availableTokens) break;
      
      content += `\n\n=== ${level.toUpperCase()} LEVEL OVERVIEW ===\n`;
      
      for (const doc of levels[level]) {
        const docTokens = this.estimateTokens(doc.pageContent);
        if (tokenCount + docTokens > availableTokens) break;
        
        content += `\n--- ${doc.metadata.source} ---\n${doc.pageContent}\n`;
        sources.push(doc.metadata.source);
        
        const score = relevanceScores.get(doc.metadata.chunkId || doc.metadata.source);
        if (score) relevanceList.push(score);
        
        tokenCount += docTokens;
      }
    }

    return {
      content: content.trim(),
      sources: [...new Set(sources)],
      metadata: {
        relevanceScores: relevanceList,
        coverageMap: this.calculateCoverageMap(documents, sources),
        searchMetadata,
        assemblyStrategy: 'hierarchical',
        optimizations: []
      },
      tokenCount
    };
  }

  private async assembleThematic(
    documents: Document[],
    relevanceScores: Map<string, RelevanceScore>,
    searchMetadata: any
  ): Promise<AssembledContext> {
    // Group documents by theme/functionality
    const themes = this.groupByTheme(documents);
    
    let content = '';
    const sources: string[] = [];
    const relevanceList: RelevanceScore[] = [];
    let tokenCount = 0;
    const availableTokens = this.MAX_TOKENS - this.TOKEN_BUFFER;

    // Process themes by importance
    const sortedThemes = Object.entries(themes).sort(([, a], [, b]) => b.length - a.length);
    
    for (const [theme, docs] of sortedThemes) {
      if (tokenCount >= availableTokens) break;
      
      content += `\n\n=== ${theme.toUpperCase()} ===\n`;
      
      for (const doc of docs) {
        const docTokens = this.estimateTokens(doc.pageContent);
        if (tokenCount + docTokens > availableTokens) break;
        
        content += `\n--- ${doc.metadata.source} ---\n${doc.pageContent}\n`;
        sources.push(doc.metadata.source);
        
        const score = relevanceScores.get(doc.metadata.chunkId || doc.metadata.source);
        if (score) relevanceList.push(score);
        
        tokenCount += docTokens;
      }
    }

    return {
      content: content.trim(),
      sources: [...new Set(sources)],
      metadata: {
        relevanceScores: relevanceList,
        coverageMap: this.calculateCoverageMap(documents, sources),
        searchMetadata,
        assemblyStrategy: 'thematic',
        optimizations: []
      },
      tokenCount
    };
  }

  private async assembleSequential(
    documents: Document[],
    relevanceScores: Map<string, RelevanceScore>,
    searchMetadata: any
  ): Promise<AssembledContext> {
    // Sort documents by relevance and code flow
    const sortedDocs = this.sortByCodeFlow(documents, relevanceScores);
    
    let content = '';
    const sources: string[] = [];
    const relevanceList: RelevanceScore[] = [];
    let tokenCount = 0;
    const availableTokens = this.MAX_TOKENS - this.TOKEN_BUFFER;

    for (const doc of sortedDocs) {
      const docTokens = this.estimateTokens(doc.pageContent);
      if (tokenCount + docTokens > availableTokens) break;
      
      content += `\n--- ${doc.metadata.source} ---\n${doc.pageContent}\n`;
      sources.push(doc.metadata.source);
      
      const score = relevanceScores.get(doc.metadata.chunkId || doc.metadata.source);
      if (score) relevanceList.push(score);
      
      tokenCount += docTokens;
    }

    return {
      content: content.trim(),
      sources: [...new Set(sources)],
      metadata: {
        relevanceScores: relevanceList,
        coverageMap: this.calculateCoverageMap(documents, sources),
        searchMetadata,
        assemblyStrategy: 'sequential',
        optimizations: []
      },
      tokenCount
    };
  }

  private async assembleBalanced(
    documents: Document[],
    relevanceScores: Map<string, RelevanceScore>,
    searchMetadata: any
  ): Promise<AssembledContext> {
    // Balanced approach: mix of relevance and diversity
    const sortedDocs = documents.sort((a, b) => {
      const scoreA = relevanceScores.get(a.metadata.chunkId || a.metadata.source)?.combined || 0;
      const scoreB = relevanceScores.get(b.metadata.chunkId || b.metadata.source)?.combined || 0;
      return scoreB - scoreA;
    });

    let content = '';
    const sources: string[] = [];
    const relevanceList: RelevanceScore[] = [];
    let tokenCount = 0;
    const availableTokens = this.MAX_TOKENS - this.TOKEN_BUFFER;
    const sourceCount = new Map<string, number>();

    for (const doc of sortedDocs) {
      // Limit chunks per source for diversity
      const sourceChunks = sourceCount.get(doc.metadata.source) || 0;
      if (sourceChunks >= 2) continue;
      
      const docTokens = this.estimateTokens(doc.pageContent);
      if (tokenCount + docTokens > availableTokens) break;
      
      content += `\n--- ${doc.metadata.source} ---\n${doc.pageContent}\n`;
      sources.push(doc.metadata.source);
      sourceCount.set(doc.metadata.source, sourceChunks + 1);
      
      const score = relevanceScores.get(doc.metadata.chunkId || doc.metadata.source);
      if (score) relevanceList.push(score);
      
      tokenCount += docTokens;
    }

    return {
      content: content.trim(),
      sources: [...new Set(sources)],
      metadata: {
        relevanceScores: relevanceList,
        coverageMap: this.calculateCoverageMap(documents, sources),
        searchMetadata,
        assemblyStrategy: 'balanced',
        optimizations: []
      },
      tokenCount
    };
  }

  private groupByAbstractionLevel(documents: Document[]): Record<string, Document[]> {
    const levels: Record<string, Document[]> = { high: [], medium: [], low: [] };
    
    for (const doc of documents) {
      const content = doc.pageContent.toLowerCase();
      
      if (content.includes('interface ') || content.includes('abstract ') || 
          content.includes('/**') || content.includes('readme')) {
        levels.high.push(doc);
      } else if (content.includes('class ') || content.includes('function ') ||
                 content.includes('export ')) {
        levels.medium.push(doc);
      } else {
        levels.low.push(doc);
      }
    }
    
    return levels;
  }

  private groupByTheme(documents: Document[]): Record<string, Document[]> {
    const themes: Record<string, Document[]> = {};
    
    for (const doc of documents) {
      const content = doc.pageContent.toLowerCase();
      let theme = 'general';
      
      if (content.includes('test') || doc.metadata.source.includes('test')) {
        theme = 'testing';
      } else if (content.includes('config') || content.includes('setup')) {
        theme = 'configuration';
      } else if (content.includes('component') || content.includes('render')) {
        theme = 'ui_components';
      } else if (content.includes('api') || content.includes('endpoint')) {
        theme = 'api';
      } else if (content.includes('util') || content.includes('helper')) {
        theme = 'utilities';
      }
      
      if (!themes[theme]) themes[theme] = [];
      themes[theme].push(doc);
    }
    
    return themes;
  }

  private sortByCodeFlow(documents: Document[], relevanceScores: Map<string, RelevanceScore>): Document[] {
    return documents.sort((a, b) => {
      // First sort by relevance
      const scoreA = relevanceScores.get(a.metadata.chunkId || a.metadata.source)?.combined || 0;
      const scoreB = relevanceScores.get(b.metadata.chunkId || b.metadata.source)?.combined || 0;
      
      if (Math.abs(scoreA - scoreB) > 0.1) {
        return scoreB - scoreA;
      }
      
      // Then by code order (chunk index)
      const chunkA = a.metadata.chunkIndex || 0;
      const chunkB = b.metadata.chunkIndex || 0;
      return chunkA - chunkB;
    });
  }

  private calculateCoverageMap(allDocuments: Document[], includedSources: string[]): Map<string, number> {
    const coverageMap = new Map<string, number>();
    const sourceCounts = new Map<string, number>();
    
    // Count total chunks per source
    for (const doc of allDocuments) {
      const source = doc.metadata.source;
      sourceCounts.set(source, (sourceCounts.get(source) || 0) + 1);
    }
    
    // Calculate coverage percentage
    for (const source of includedSources) {
      const includedCount = includedSources.filter(s => s === source).length;
      const totalCount = sourceCounts.get(source) || 1;
      coverageMap.set(source, includedCount / totalCount);
    }
    
    return coverageMap;
  }

  private estimateTokens(text: string): number {
    // Rough estimation: 1 token ≈ 4 characters for English text
    return Math.ceil(text.length / 4);
  }

  private async optimizeContext(context: AssembledContext, query: string): Promise<AssembledContext> {
    const optimizations: string[] = [];
    let optimizedContent = context.content;
    
    // Remove excessive whitespace
    if (optimizedContent.includes('\n\n\n')) {
      optimizedContent = optimizedContent.replace(/\n{3,}/g, '\n\n');
      optimizations.push('whitespace_cleanup');
    }
    
    // Truncate if still too long
    const finalTokenCount = this.estimateTokens(optimizedContent);
    if (finalTokenCount > this.MAX_TOKENS) {
      const maxChars = this.MAX_TOKENS * 4;
      optimizedContent = optimizedContent.substring(0, maxChars) + '\n... [truncated]';
      optimizations.push('content_truncation');
    }
    
    return {
      ...context,
      content: optimizedContent,
      tokenCount: this.estimateTokens(optimizedContent),
      metadata: {
        ...context.metadata,
        optimizations
      }
    };
  }
}
```

### Step 3: Integration with Existing qi-v2 agentFactory

**File: `lib/src/agent/factory.ts` (Context Enhancement)**
```typescript
// Add to existing qi-v2 agentFactory class

import { SemanticSearchEngine, type SearchContext } from '../context/semantic-search-engine.js';
import { ContextAssembler, type AssembledContext } from '../context/context-assembler.js';

export class qi-v2 agentFactory {
  // ... existing properties ...
  private semanticSearchEngine?: SemanticSearchEngine;
  private contextAssembler?: ContextAssembler;

  // ... existing constructor and methods ...

  // Enhanced RAG initialization with context management
  private async initializeRAG(): Promise<void> {
    const ragConfig = this.config.rag;
    if (!ragConfig) {
      throw new Error('RAG configuration required');
    }

    this.ragPipeline = new RAGPipeline(ragConfig);
    await this.ragPipeline.initialize();

    // Initialize advanced context management
    this.semanticSearchEngine = new SemanticSearchEngine(this.ragPipeline);
    this.contextAssembler = new ContextAssembler();
    this.contextManager = new ContextManager(this.ragPipeline);
    this.ragEnabled = true;

    console.log('✅ RAG system with advanced context management initialized');
  }

  // Enhanced context-aware invocation
  async invokeWithAdvancedContext(
    messages: AgentMessage[],
    options: {
      threadId?: string;
      intent?: 'explanation' | 'implementation' | 'debugging' | 'refactoring';
      scope?: 'file' | 'module' | 'project' | 'dependencies';
      currentFile?: string;
      selectedCode?: string;
      assemblyStrategy?: 'hierarchical' | 'thematic' | 'sequential' | 'balanced';
    } = {}
  ): Promise<AgentResponse & { contextMetadata?: any }> {
    if (!this.agent) {
      throw new Error('Agent not initialized. Call initialize() first.');
    }

    const { 
      threadId, 
      intent = 'explanation', 
      scope = 'project', 
      currentFile,
      selectedCode,
      assemblyStrategy = 'balanced'
    } = options;
    
    const lastMessage = messages[messages.length - 1];

    try {
      let enhancedMessages = messages;
      let contextMetadata = {};

      // Use advanced context retrieval if available
      if (this.ragEnabled && this.semanticSearchEngine && this.contextAssembler && lastMessage.role === 'user') {
        console.log('🧠 Using advanced semantic context retrieval...');
        
        // Create search context
        const searchContext: SearchContext = {
          query: lastMessage.content,
          intent,
          scope,
          codeContext: {
            currentFile,
            selectedCode
          }
        };

        // Perform enhanced semantic search
        const { documents, relevanceScores, searchMetadata } = 
          await this.semanticSearchEngine.search(searchContext);

        if (documents.length > 0) {
          // Assemble optimized context
          const assembledContext = await this.contextAssembler.assembleContext(
            documents,
            relevanceScores,
            { ...searchMetadata, assemblyStrategy },
            lastMessage.content
          );

          if (assembledContext.content) {
            // Create enhanced prompt with assembled context
            const contextualPrompt = this.createAdvancedContextualPrompt(
              lastMessage.content, 
              assembledContext
            );
            
            enhancedMessages = [
              ...messages.slice(0, -1),
              { role: 'user', content: contextualPrompt }
            ];
            
            contextMetadata = {
              sources: assembledContext.sources,
              tokenCount: assembledContext.tokenCount,
              assemblyStrategy: assembledContext.metadata.assemblyStrategy,
              relevanceScores: assembledContext.metadata.relevanceScores.length,
              searchMetadata: assembledContext.metadata.searchMetadata
            };

            console.log(`📚 Assembled context: ${assembledContext.sources.length} sources, ${assembledContext.tokenCount} tokens`);
          }
        }
      }

      // Use existing invoke method with enhanced messages
      const response = await this.invoke(enhancedMessages, threadId);
      
      return {
        ...response,
        contextMetadata
      };

    } catch (error) {
      console.error('Advanced context invocation failed:', error);
      // Fallback to regular RAG invoke, then to basic invoke
      if (this.ragEnabled) {
        return await this.invokeWithRAG(messages, { threadId, intent, scope, currentFile });
      }
      return await this.invoke(messages, threadId);
    }
  }

  private createAdvancedContextualPrompt(query: string, context: AssembledContext): string {
    const sourcesList = context.sources.map(source => `- ${source}`).join('\n');
    
    return `Context from codebase (${context.metadata.assemblyStrategy} assembly):
${context.content}

Sources referenced:
${sourcesList}

Context metadata:
- Assembly strategy: ${context.metadata.assemblyStrategy}
- Token count: ${context.tokenCount}
- Sources: ${context.sources.length}

User Query: ${query}

Instructions:
1. Use the provided codebase context to answer comprehensively
2. Reference specific files and code sections with line numbers when possible
3. Consider the assembly strategy when structuring your response
4. If the context doesn't fully address the query, clearly state what's missing
5. Provide accurate, actionable responses based on the actual codebase structure

Response:`;
  }

  async getContextForQuery(query: string, options: {
    intent?: SearchContext['intent'];
    scope?: SearchContext['scope'];
    currentFile?: string;
    selectedCode?: string;
    maxTokens?: number;
  } = {}): Promise<AssembledContext> {
    
    const searchContext: SearchContext = {
      query,
      intent: options.intent || 'explanation',
      scope: options.scope || 'project',
      codeContext: {
        currentFile: options.currentFile,
        selectedCode: options.selectedCode
      }
    };

    console.log(`🎯 Getting context for query: "${query}"`);
    console.log(`📋 Context: ${searchContext.intent} (${searchContext.scope})`);

    try {
      // Perform enhanced semantic search
      const { documents, relevanceScores, searchMetadata } = 
        await this.searchEngine.search(searchContext);

      if (documents.length === 0) {
        console.log('⚠️ No relevant documents found');
        return {
          content: '',
          sources: [],
          metadata: {
            relevanceScores: [],
            coverageMap: new Map(),
            searchMetadata,
            assemblyStrategy: 'none',
            optimizations: []
          },
          tokenCount: 0
        };
      }

      // Assemble optimized context
      const assembledContext = await this.assembler.assembleContext(
        documents,
        relevanceScores,
        searchMetadata,
        query
      );

      console.log(`✅ Context assembled: ${assembledContext.sources.length} sources, ${assembledContext.tokenCount} tokens`);
      return assembledContext;

    } catch (error) {
      console.error('❌ Context retrieval failed:', error);
      throw error;
    }
  }

  async *streamContextRetrieval(query: string, options: Parameters<typeof this.getContextForQuery>[1] = {}) {
    yield { type: 'search_start', data: { query, options } };
    
    try {
      const context = await this.getContextForQuery(query, options);
      
      yield { type: 'search_complete', data: { 
        sourceCount: context.sources.length,
        tokenCount: context.tokenCount 
      }};
      
      yield { type: 'context_ready', data: context };
      
    } catch (error) {
      yield { type: 'search_error', data: { error: error.message } };
    }
  }
}
```

### Step 4: CLI Integration for Advanced Context

**File: `app/src/cli/commands.ts` (Context Enhancement)**
```typescript
// Add advanced context options to existing CLI commands

export function createCLI() {
  const program = new Command();
  
  // ... existing commands ...

  // Enhanced chat command with context options
  program
    .command('chat')
    .description('Start interactive chat session')
    .option('-m, --stream-mode <mode>', 'Streaming mode: messages, values, updates, custom', 'messages')
    .option('--show-updates', 'Show internal state updates', false)
    .option('--intent <intent>', 'Query intent: explanation, implementation, debugging, refactoring', 'explanation')
    .option('--scope <scope>', 'Context scope: file, module, project, dependencies', 'project')
    .option('--assembly <strategy>', 'Context assembly: hierarchical, thematic, sequential, balanced', 'balanced')
    .option('--current-file <file>', 'Current file for context scoping')
    .option('--advanced-context', 'Use advanced semantic context retrieval', false)
    .action(async (options) => {
      const config = await loadConfig();
      const agentFactory = new QiV2AgentFactory(config);
      await agentFactory.initialize();

      // Use appropriate invocation method based on options
      const contextOptions = {
        streamMode: options.streamMode,
        showUpdates: options.showUpdates,
        intent: options.intent,
        scope: options.scope,
        assemblyStrategy: options.assembly,
        currentFile: options.currentFile,
        useAdvancedContext: options.advancedContext
      };

      await startInteractiveChat(agentFactory, contextOptions);
    });

  // Add context indexing command
  program
    .command('index <path>')
    .description('Index codebase for semantic search')
    .option('--force', 'Force reindexing even if already indexed', false)
    .action(async (path, options) => {
      const config = await loadConfig();
      
      if (!config.rag?.enabled) {
        console.error('❌ RAG system not enabled. Enable in config.yaml');
        process.exit(1);
      }

      const agentFactory = new QiV2AgentFactory(config);
      await agentFactory.initialize();
      
      console.log(`📚 Indexing codebase: ${path}`);
      await agentFactory.indexCodebase(path, options.force);
      console.log('✅ Indexing complete');
    });

  return program;
}
```

## Testing & Validation

**File: `lib/src/agent/__tests__/context-integration.test.ts`**
```typescript
import { describe, test, expect, beforeAll } from 'vitest';
import { ContextManager } from '../context-manager.js';
import { RAGPipeline } from '../../rag/rag-pipeline.js';

describe('Context Manager Integration', () => {
  let contextManager: ContextManager;
  let ragPipeline: RAGPipeline;

  beforeAll(async () => {
    // Setup test RAG pipeline
    const config = {
      chromaDB: {
        collectionName: 'test-context-manager',
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
        topK: 5,
        scoreThreshold: 0.5,
        includeMetadata: true
      }
    };

    ragPipeline = new RAGPipeline(config);
    await ragPipeline.initialize();
    
    contextManager = new ContextManager(ragPipeline);
  });

  test('retrieves context with different intents', async () => {
    const query = 'how to create a user interface component';
    
    const explanationContext = await contextManager.getContextForQuery(query, {
      intent: 'explanation'
    });
    
    const implementationContext = await contextManager.getContextForQuery(query, {
      intent: 'implementation'
    });
    
    expect(explanationContext.content).toBeDefined();
    expect(implementationContext.content).toBeDefined();
    expect(explanationContext.metadata.assemblyStrategy).toBeDefined();
    expect(implementationContext.metadata.assemblyStrategy).toBeDefined();
  }, 15000);

  test('handles different scope levels', async () => {
    const query = 'user authentication logic';
    
    const fileScope = await contextManager.getContextForQuery(query, {
      scope: 'file',
      currentFile: 'src/auth/login.ts'
    });
    
    const projectScope = await contextManager.getContextForQuery(query, {
      scope: 'project'
    });
    
    expect(fileScope.sources.length).toBeLessThanOrEqual(projectScope.sources.length);
  }, 12000);
});
```

## Success Criteria

### Functional Requirements
- [ ] **Multi-dimensional Search**: Semantic, syntactic, structural, and contextual search working
- [ ] **Relevance Scoring**: Advanced scoring with multiple factors (semantic, syntactic, structural, contextual, temporal)
- [ ] **Context Assembly**: Multiple assembly strategies (hierarchical, thematic, sequential, balanced)
- [ ] **Token Optimization**: Context fits within token limits while maintaining relevance
- [ ] **Intent Recognition**: Different search behaviors based on query intent

### Performance Requirements
- [ ] **Search Speed**: Context retrieval in <3 seconds for complex queries
- [ ] **Relevance Quality**: >85% relevant results for typical coding queries
- [ ] **Token Efficiency**: Optimal use of available context window
- [ ] **Memory Usage**: <100MB additional overhead for context management

### Integration Requirements
- [ ] **RAG Integration**: Seamless integration with T3-2 ChromaDB RAG system
- [ ] **Streaming Ready**: Prepared for integration with T3-1 streaming agent
- [ ] **Configuration**: Configurable search strategies and parameters
- [ ] **Testing Coverage**: >80% test coverage for context retrieval components

## Next Steps

1. **Complete T3-4**: Integrate with multi-turn conversation management
2. **T4-1 Integration**: Connect with advanced MCP tool integration
3. **Performance Optimization**: Fine-tune search algorithms and assembly strategies
4. **SEM-RAG Implementation**: Implement advanced semantic relationship understanding

This implementation provides sophisticated context retrieval capabilities that go beyond traditional RAG to provide architecturally coherent, relevance-ranked context for AI-assisted coding tasks.