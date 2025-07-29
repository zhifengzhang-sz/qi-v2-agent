# Agent Framework Implementation - 2025 Pattern Recognition Enhancements (V2)

## Overview

This document provides **2025 LangChain pattern recognition enhancements** to the production-ready implementation in [agent.impl.corrected.md](./agent.impl.corrected.md). These enhancements are based on comprehensive research of 2025 LangChain best practices for intent classification, vector stores, and MCP integration.

**Base Implementation**: [agent.impl.corrected.md](./agent.impl.corrected.md) - Apply these corrections first  
**This Document**: 2025 pattern recognition evolution based on LangChain research

**Research Reference**: [impl.note.langchain.md](./impl/impl.note.langchain.md) - Contains full research findings

---

## 2025 Pattern Recognition Enhancements

### 1. Structured Output Pattern Classification (High Priority)

**Current Issue**: Manual text parsing from LLM responses is unreliable

**Base Implementation**: Text-based LLM fallback in `pattern-matcher.ts`

**2025 Enhancement**:

```typescript
// ENHANCEMENT 1: Structured output classification
import { z } from 'zod';
import { BaseChatModel } from '@langchain/core/language_models/chat_models';

// Define structured classification schema
const PatternClassificationSchema = z.object({
  pattern: z.enum(['analytical', 'creative', 'problem-solving', 'informational', 'conversational']),
  confidence: z.number().min(0).max(1),
  reasoning: z.string().min(10),
  signals_detected: z.array(z.string()).optional(),
  context_factors: z.array(z.string()).optional()
});

type PatternClassification = z.infer<typeof PatternClassificationSchema>;

export class StructuredPatternMatcher implements IPatternMatcher {
  private structuredLLM: BaseChatModel;
  private fallbackPrompt: PromptTemplate;
  
  constructor(config: PatternMatcherConfig) {
    // Initialize base components (keep existing multi-signal detection)
    super(config);
    
    // ADD: Initialize structured LLM
    this.structuredLLM = this.initializeStructuredLLM(config);
    this.fallbackPrompt = this.createStructuredPrompt();
  }

  private initializeStructuredLLM(config: PatternMatcherConfig): BaseChatModel {
    const baseModel = new ChatOllama({
      baseUrl: config.llmEndpoint || 'http://localhost:11434',
      model: config.fallbackModel || 'qwen2.5-coder:7b',
      temperature: 0.1, // Low temperature for consistent classification
      numCtx: 2048
    });

    // ENHANCEMENT: Use structured output instead of text parsing
    return baseModel.withStructuredOutput(PatternClassificationSchema, {
      name: "pattern_classification",
      description: "Classify user input into cognitive patterns with confidence and reasoning"
    });
  }

  private createStructuredPrompt(): PromptTemplate {
    return PromptTemplate.fromTemplate(`
You are an expert intent classifier for an AI assistant. Analyze the user's input and classify it into one of the cognitive patterns.

Available Patterns:
- analytical: Strategic analysis, planning, architecture, systematic thinking
- creative: Building, generating, implementing, designing new solutions  
- problem-solving: Fixing bugs, debugging errors, troubleshooting issues
- informational: Explaining concepts, answering questions, providing knowledge
- conversational: General chat, greetings, casual interactions

User Input: {input}
Context: {context}

Provide your classification with high confidence and clear reasoning for your decision.
Focus on the primary intent and action the user wants to take.
    `);
  }

  // ENHANCED: Structured LLM classification instead of text parsing
  private async structuredLLMClassification(
    input: string,
    context?: ProcessingContext
  ): Promise<PatternDetectionResult> {
    if (!this.structuredLLM || !this.fallbackPrompt) {
      return this.multiSignalDetection(input, context);
    }

    try {
      const prompt = await this.fallbackPrompt.format({
        input,
        context: context ? JSON.stringify(Object.fromEntries(context.environmentContext || [])) : 'none'
      });

      // ENHANCEMENT: Get structured response instead of parsing text
      const classification = await this.structuredLLM.invoke(prompt) as PatternClassification;
      
      const detectedPattern = this.patterns.find(p => p.name === classification.pattern);
      
      if (detectedPattern) {
        return {
          pattern: detectedPattern,
          confidence: classification.confidence,
          detectionMethod: 'structured-llm',
          metadata: new Map([
            ['reasoning', classification.reasoning],
            ['signals_detected', classification.signals_detected || []],
            ['context_factors', classification.context_factors || []],
            ['model', this.structuredLLM.model || 'unknown'],
            ['structured_output', true]
          ])
        };
      }

      // Fallback to conversational if pattern not found
      const conversationalPattern = this.patterns.find(p => p.name === 'conversational');
      if (conversationalPattern) {
        return {
          pattern: conversationalPattern,
          confidence: 0.5,
          detectionMethod: 'structured-llm-fallback',
          metadata: new Map([
            ['fallbackReason', 'pattern-not-found'],
            ['originalClassification', classification.pattern]
          ])
        };
      }
    } catch (error) {
      console.warn('Structured LLM classification failed:', error);
    }

    // Final fallback to multi-signal detection
    return this.multiSignalDetection(input, context);
  }
}
```

**Why This Enhancement**: Eliminates text parsing errors, provides consistent structured responses, and includes reasoning for better debugging.

---

### 2. Vector Store Semantic Enhancement (Medium Priority)

**Current Issue**: Keyword matching misses synonyms and contextual meaning

**Base Implementation**: Manual keyword arrays in `calculateToolSignalScore()`

**2025 Enhancement**:

```typescript
// ENHANCEMENT 2: Vector store semantic pattern recognition
import { MemoryVectorStore } from "langchain/vectorstores/memory";
import { OpenAIEmbeddings } from "@langchain/openai";
import { Document } from "@langchain/core/documents";

export class SemanticPatternMatcher extends StructuredPatternMatcher {
  private vectorStore: MemoryVectorStore;
  private embeddings: OpenAIEmbeddings;
  private patternExamples: Map<string, Document[]>;

  constructor(config: PatternMatcherConfig & { enableSemanticSearch?: boolean }) {
    super(config);
    
    if (config.enableSemanticSearch) {
      this.initializeSemanticComponents();
    }
  }

  private async initializeSemanticComponents(): Promise<void> {
    // Initialize embeddings (can use local embeddings for privacy)
    this.embeddings = new OpenAIEmbeddings({
      model: "text-embedding-3-small", // Cost-effective option
    });

    // Create pattern example documents
    this.patternExamples = new Map([
      ['analytical', [
        new Document({ 
          pageContent: "analyze the performance metrics", 
          metadata: { pattern: 'analytical', confidence: 0.9 } 
        }),
        new Document({ 
          pageContent: "plan the system architecture", 
          metadata: { pattern: 'analytical', confidence: 0.9 } 
        }),
        new Document({ 
          pageContent: "evaluate the trade-offs", 
          metadata: { pattern: 'analytical', confidence: 0.8 } 
        })
      ]],
      ['creative', [
        new Document({ 
          pageContent: "build a new user interface", 
          metadata: { pattern: 'creative', confidence: 0.9 } 
        }),
        new Document({ 
          pageContent: "implement the authentication system", 
          metadata: { pattern: 'creative', confidence: 0.9 } 
        }),
        new Document({ 
          pageContent: "design a REST API", 
          metadata: { pattern: 'creative', confidence: 0.8 } 
        })
      ]],
      ['problem-solving', [
        new Document({ 
          pageContent: "fix the TypeError in authentication", 
          metadata: { pattern: 'problem-solving', confidence: 0.9 } 
        }),
        new Document({ 
          pageContent: "debug the null pointer exception", 
          metadata: { pattern: 'problem-solving', confidence: 0.9 } 
        }),
        new Document({ 
          pageContent: "resolve the connection timeout", 
          metadata: { pattern: 'problem-solving', confidence: 0.8 } 
        })
      ]]
      // ... other patterns
    ]);

    // Initialize vector store with all examples
    const allDocuments = Array.from(this.patternExamples.values()).flat();
    this.vectorStore = await MemoryVectorStore.fromDocuments(allDocuments, this.embeddings);
  }

  // ENHANCED: Semantic similarity detection
  async detectPattern(input: string, context?: ProcessingContext): Promise<PatternDetectionResult> {
    // 1. Rule-based multi-signal detection (existing - keep for performance)
    const ruleBasedResult = await this.multiSignalDetection(input, context);
    
    // 2. High confidence rule-based result - use it
    if (ruleBasedResult.confidence > 0.8) {
      return ruleBasedResult;
    }

    // 3. Medium confidence - enhance with semantic search
    if (this.vectorStore && ruleBasedResult.confidence > 0.4) {
      const semanticResult = await this.semanticEnhancement(input, ruleBasedResult);
      
      // Combine rule-based and semantic signals
      const combinedConfidence = this.combineConfidences(
        ruleBasedResult.confidence, 
        semanticResult.confidence
      );
      
      if (combinedConfidence > 0.7) {
        return {
          ...semanticResult,
          confidence: combinedConfidence,
          detectionMethod: 'hybrid-semantic',
          metadata: new Map([
            ...semanticResult.metadata,
            ['ruleBasedConfidence', ruleBasedResult.confidence],
            ['semanticConfidence', semanticResult.confidence],
            ['combinedApproach', true]
          ])
        };
      }
    }

    // 4. Low confidence - use structured LLM classification
    if (ruleBasedResult.confidence < 0.5) {
      return this.structuredLLMClassification(input, context);
    }

    // 5. Return rule-based result with metadata
    return ruleBasedResult;
  }

  private async semanticEnhancement(
    input: string, 
    ruleBasedResult: PatternDetectionResult
  ): Promise<PatternDetectionResult> {
    // Search for semantically similar patterns
    const similarDocs = await this.vectorStore.similaritySearchWithScore(input, 3);
    
    // Calculate semantic confidence based on similarity scores
    const semanticScores = new Map<string, number>();
    
    for (const [doc, score] of similarDocs) {
      const pattern = doc.metadata.pattern;
      const currentScore = semanticScores.get(pattern) || 0;
      // Convert similarity score (higher is better) to confidence
      const confidence = Math.max(0, 1 - score); // Assuming cosine distance
      semanticScores.set(pattern, Math.max(currentScore, confidence));
    }

    // Find best semantic match
    let bestPattern = ruleBasedResult.pattern;
    let bestConfidence = 0;
    
    for (const [patternName, confidence] of semanticScores) {
      if (confidence > bestConfidence) {
        const pattern = this.patterns.find(p => p.name === patternName);
        if (pattern) {
          bestPattern = pattern;
          bestConfidence = confidence;
        }
      }
    }

    return {
      pattern: bestPattern,
      confidence: bestConfidence,
      detectionMethod: 'semantic-similarity',
      metadata: new Map([
        ['similarityResults', Array.from(semanticScores.entries())],
        ['topSimilarDocs', similarDocs.map(([doc, score]) => ({ 
          content: doc.pageContent.slice(0, 50) + '...', 
          pattern: doc.metadata.pattern,
          score 
        }))]
      ])
    };
  }

  private combineConfidences(ruleBasedConf: number, semanticConf: number): number {
    // Weighted combination: rule-based 60%, semantic 40%
    return (ruleBasedConf * 0.6) + (semanticConf * 0.4);
  }
}
```

**Why This Enhancement**: Handles synonyms, contextual meaning, and provides semantic understanding beyond keyword matching.

---

### 3. MCP Server Dynamic Keyword Management (Medium Priority)

**Current Issue**: Keywords hardcoded in source, difficult to update

**Base Implementation**: Static keyword arrays in `calculateToolSignalScore()`

**2025 Enhancement**:

```typescript
// ENHANCEMENT 3: MCP server for dynamic pattern management
import { MCPClient } from '@modelcontextprotocol/client';

export interface PatternMCPConfig {
  serverEndpoint: string;
  serverCommand?: string;
  serverArgs?: string[];
  enableDynamicKeywords: boolean;
}

export class MCPPatternMatcher extends SemanticPatternMatcher {
  private mcpClient?: MCPClient;
  private dynamicKeywords: Map<string, string[]> = new Map();
  private keywordCacheTimeout = 300000; // 5 minutes
  private lastKeywordUpdate = 0;

  constructor(config: PatternMatcherConfig & PatternMCPConfig) {
    super(config);
    
    if (config.enableDynamicKeywords && config.serverEndpoint) {
      this.initializeMCPClient(config);
    }
  }

  private async initializeMCPClient(config: PatternMCPConfig): Promise<void> {
    try {
      // Initialize MCP client for pattern server
      this.mcpClient = new MCPClient({
        serverEndpoint: config.serverEndpoint,
        command: config.serverCommand,
        args: config.serverArgs || []
      });

      await this.mcpClient.connect();
      
      // Load initial keywords
      await this.refreshKeywordsFromMCP();
      
      console.log('✅ MCP Pattern Server connected');
    } catch (error) {
      console.warn('⚠️  MCP Pattern Server failed to connect:', error);
      // Fall back to static keywords
    }
  }

  private async refreshKeywordsFromMCP(): Promise<void> {
    if (!this.mcpClient) return;

    try {
      // Fetch keywords for each pattern
      for (const pattern of this.patterns) {
        const keywords = await this.mcpClient.call('get_pattern_keywords', { 
          pattern: pattern.name 
        });
        
        if (Array.isArray(keywords)) {
          this.dynamicKeywords.set(pattern.name, keywords);
        }
      }
      
      this.lastKeywordUpdate = Date.now();
      console.log('🔄 Pattern keywords refreshed from MCP server');
    } catch (error) {
      console.warn('Failed to refresh keywords from MCP:', error);
    }
  }

  // ENHANCED: Dynamic keyword scoring with MCP server
  protected async calculateToolSignalScore(
    input: string, 
    pattern: CognitivePattern
  ): Promise<number> {
    // Check if keywords need refresh
    if (this.mcpClient && 
        (Date.now() - this.lastKeywordUpdate) > this.keywordCacheTimeout) {
      await this.refreshKeywordsFromMCP();
    }

    // Use dynamic keywords if available, otherwise fall back to static
    const keywords = this.dynamicKeywords.get(pattern.name) || 
                    this.getStaticKeywords(pattern.name);
    
    const matches = keywords.filter(keyword => 
      input.toLowerCase().includes(keyword.toLowerCase())
    ).length;
    
    return keywords.length > 0 ? matches / keywords.length : 0;
  }

  private getStaticKeywords(patternName: string): string[] {
    // Fallback to static keywords from base implementation
    const staticKeywords = {
      analytical: ['plan', 'architecture', 'approach', 'strategy', 'design'],
      creative: ['create', 'build', 'generate', 'implement', 'develop'],
      'problem-solving': ['fix', 'debug', 'error', 'bug', 'solve', 'troubleshoot'],
      informational: ['explain', 'what', 'how', 'why', 'help', 'documentation'],
      conversational: ['hello', 'hi', 'thanks', 'chat', 'talk']
    };
    
    return staticKeywords[patternName as keyof typeof staticKeywords] || [];
  }

  // NEW: Update keywords via MCP server
  async updatePatternKeywords(pattern: string, keywords: string[]): Promise<boolean> {
    if (!this.mcpClient) {
      console.warn('MCP client not available for keyword updates');
      return false;
    }

    try {
      await this.mcpClient.call('update_pattern_keywords', { pattern, keywords });
      
      // Update local cache
      this.dynamicKeywords.set(pattern, keywords);
      
      console.log(`🔄 Updated keywords for pattern: ${pattern}`);
      return true;
    } catch (error) {
      console.error('Failed to update keywords via MCP:', error);
      return false;
    }
  }

  // NEW: Learning from user feedback
  async learnFromInteraction(
    input: string, 
    detectedPattern: string, 
    userFeedback: 'correct' | 'incorrect', 
    correctPattern?: string
  ): Promise<void> {
    if (!this.mcpClient) return;

    try {
      await this.mcpClient.call('record_pattern_feedback', {
        input,
        detectedPattern,
        userFeedback,
        correctPattern: correctPattern || detectedPattern,
        timestamp: new Date().toISOString()
      });

      // If feedback indicates improvement needed, request keyword suggestions
      if (userFeedback === 'incorrect' && correctPattern) {
        const suggestions = await this.mcpClient.call('suggest_keyword_improvements', {
          input,
          correctPattern
        });
        
        if (suggestions && Array.isArray(suggestions)) {
          console.log(`💡 Keyword suggestions for ${correctPattern}:`, suggestions);
        }
      }
    } catch (error) {
      console.warn('Failed to record pattern feedback:', error);
    }
  }
}
```

**Why This Enhancement**: Enables dynamic pattern learning, real-time keyword updates, and continuous improvement from user interactions.

---

### 4. Complete Hybrid Pattern Matcher (Production Ready)

**Integration**: Combine all enhancements into production-ready implementation

```typescript
// COMPLETE: Production-ready hybrid pattern matcher
export class HybridPatternMatcher extends MCPPatternMatcher {
  private readonly approachWeights = {
    ruleBasedMultiSignal: 0.4,
    semanticSimilarity: 0.3,
    structuredLLM: 0.3
  };

  async detectPattern(
    input: string, 
    context?: ProcessingContext
  ): Promise<PatternDetectionResult> {
    const startTime = Date.now();
    
    // Check cache first (from base implementation)
    const cacheKey = this.createCacheKey(input, context);
    const cached = this.cache.get(cacheKey);
    if (cached) {
      return { ...cached, metadata: new Map([...cached.metadata, ['cacheHit', true]]) };
    }

    // 1. Rule-based multi-signal detection (fast)
    const ruleBasedResult = await this.multiSignalDetection(input, context);
    
    // 2. High confidence - use rule-based result
    if (ruleBasedResult.confidence > 0.85) {
      const result = {
        ...ruleBasedResult,
        detectionMethod: 'rule-based-high-confidence',
        metadata: new Map([
          ...ruleBasedResult.metadata,
          ['detectionTime', Date.now() - startTime],
          ['approach', 'rule-based-only']
        ])
      };
      this.cache.set(cacheKey, result);
      return result;
    }

    // 3. Medium confidence - enhance with semantic search
    let semanticResult: PatternDetectionResult | null = null;
    if (this.vectorStore && ruleBasedResult.confidence > 0.3) {
      semanticResult = await this.semanticEnhancement(input, ruleBasedResult);
    }

    // 4. Low confidence or ambiguous - use structured LLM
    let llmResult: PatternDetectionResult | null = null;
    if (ruleBasedResult.confidence < 0.6) {
      llmResult = await this.structuredLLMClassification(input, context);
    }

    // 5. Combine all approaches with weighted scoring
    const finalResult = this.combineAllApproaches(
      ruleBasedResult,
      semanticResult,
      llmResult,
      startTime
    );

    // Cache successful results
    if (finalResult.confidence > 0.5) {
      this.cache.set(cacheKey, finalResult);
    }

    return finalResult;
  }

  private combineAllApproaches(
    ruleBasedResult: PatternDetectionResult,
    semanticResult: PatternDetectionResult | null,
    llmResult: PatternDetectionResult | null,
    startTime: number
  ): PatternDetectionResult {
    const approaches = [
      { result: ruleBasedResult, weight: this.approachWeights.ruleBasedMultiSignal, name: 'rule-based' },
      ...(semanticResult ? [{ result: semanticResult, weight: this.approachWeights.semanticSimilarity, name: 'semantic' }] : []),
      ...(llmResult ? [{ result: llmResult, weight: this.approachWeights.structuredLLM, name: 'llm' }] : [])
    ];

    // Calculate weighted scores for each pattern
    const patternScores = new Map<string, number>();
    const approachDetails = new Map<string, { confidence: number; pattern: string }>();

    for (const approach of approaches) {
      const patternName = approach.result.pattern.name;
      const weightedScore = approach.result.confidence * approach.weight;
      
      patternScores.set(patternName, (patternScores.get(patternName) || 0) + weightedScore);
      approachDetails.set(approach.name, {
        confidence: approach.result.confidence,
        pattern: patternName
      });
    }

    // Find best combined result
    let bestPattern = ruleBasedResult.pattern;
    let bestScore = 0;
    
    for (const [patternName, score] of patternScores) {
      if (score > bestScore) {
        const pattern = this.patterns.find(p => p.name === patternName);
        if (pattern) {
          bestPattern = pattern;
          bestScore = score;
        }
      }
    }

    // Determine detection method based on primary contributor
    let detectionMethod = 'hybrid-combined';
    if (llmResult && llmResult.confidence > 0.8) {
      detectionMethod = 'structured-llm-primary';
    } else if (semanticResult && semanticResult.confidence > 0.7) {
      detectionMethod = 'semantic-primary';
    } else if (ruleBasedResult.confidence > 0.6) {
      detectionMethod = 'rule-based-primary';
    }

    return {
      pattern: bestPattern,
      confidence: Math.min(bestScore, 1.0), // Cap at 1.0
      detectionMethod,
      metadata: new Map([
        ['detectionTime', Date.now() - startTime],
        ['combinedScore', bestScore],
        ['approachDetails', Object.fromEntries(approachDetails)],
        ['patternScores', Object.fromEntries(patternScores)],
        ['approachesUsed', approaches.map(a => a.name)],
        ['weights', this.approachWeights]
      ])
    };
  }
}
```

---

## Implementation Timeline

### Phase 1: Immediate (High Priority)
1. **Structured Output Classification**: Replace text parsing with `withStructuredOutput()`
2. **Enhanced Error Handling**: Add proper schema validation and fallbacks

### Phase 2: Short-term (4-6 weeks)
1. **Vector Store Integration**: Add semantic similarity search
2. **Hybrid Approach**: Combine rule-based + semantic detection

### Phase 3: Medium-term (8-12 weeks) 
1. **MCP Server**: Dynamic keyword management
2. **Learning System**: User feedback integration

### Phase 4: Long-term (3-6 months)
1. **Production Optimization**: Performance tuning and monitoring
2. **Advanced Features**: Real-time pattern learning, domain-specific customization

---

## Configuration Updates

### Enhanced Configuration Schema

```yaml
# config/qi-config.yaml - Enhanced pattern recognition
patternRecognition:
  approach: "hybrid" # rule-based | semantic | llm | hybrid
  
  # Structured LLM configuration
  structuredLLM:
    enabled: true
    confidenceThreshold: 0.7
    fallbackModel: "qwen2.5-coder:7b"
    temperature: 0.1
    
  # Semantic search configuration  
  semanticSearch:
    enabled: true
    provider: "openai" # openai | local
    embeddingModel: "text-embedding-3-small"
    similarityThreshold: 0.7
    
  # MCP server configuration
  mcpServer:
    enabled: false
    endpoint: "http://localhost:8080/pattern-server"
    enableLearning: true
    keywordRefreshInterval: 300000 # 5 minutes
    
  # Approach weights for hybrid mode
  weights:
    ruleBasedMultiSignal: 0.4
    semanticSimilarity: 0.3  
    structuredLLM: 0.3
```

---

## Testing Strategy

### 1. Structured Output Testing
```typescript
// Test structured LLM responses
describe('Structured Pattern Classification', () => {
  it('should return valid schema-compliant responses', async () => {
    const result = await matcher.structuredLLMClassification('create a web app');
    expect(result.metadata.get('structured_output')).toBe(true);
    expect(result.pattern.name).toBeOneOf(['creative', 'analytical']);
    expect(result.confidence).toBeGreaterThan(0.5);
  });
});
```

### 2. Semantic Search Testing
```typescript
// Test semantic similarity
describe('Semantic Pattern Enhancement', () => {
  it('should find semantically similar patterns', async () => {
    const synonymTest = await matcher.detectPattern('construct a REST API');
    const originalTest = await matcher.detectPattern('build a REST API');
    expect(synonymTest.pattern.name).toBe(originalTest.pattern.name);
  });
});
```

### 3. Hybrid Integration Testing
```typescript
// Test combined approaches
describe('Hybrid Pattern Detection', () => {
  it('should combine multiple approaches effectively', async () => {
    const result = await matcher.detectPattern('debug the connection timeout issue');
    expect(result.detectionMethod).toContain('hybrid');
    expect(result.metadata.get('approachesUsed')).toContain('rule-based');
  });
});
```

---

## Migration Path

### From V1 → V1.1 (Structured Output)
1. Update `pattern-matcher.ts` with structured LLM classification
2. Add schema validation and proper error handling
3. Test with existing business logic tests

### From V1.1 → V1.2 (Semantic Enhancement)  
1. Add vector store integration
2. Implement hybrid detection logic
3. Update configuration schema

### From V1.2 → V2.0 (Full Enhancement)
1. Add MCP server integration
2. Implement learning system
3. Production optimization and monitoring

---

## References

### Research Documentation
- **[impl.note.langchain.md](./impl/impl.note.langchain.md)** - Complete research findings on 2025 LangChain best practices
- **[agent.impl.corrected.md](./agent.impl.corrected.md)** - Base production implementation

### LangChain 2025 Documentation
- [Structured Classification](https://python.langchain.com/docs/tutorials/classification/) - Structured output patterns
- [Vector Stores](https://python.langchain.com/docs/concepts/vectorstores/) - Semantic search integration
- [MCP Integration](https://cobusgreyling.medium.com/using-langchain-with-model-context-protocol-mcp-e89b87ee3c4c) - Dynamic tool management

### Package Dependencies (Additional)
```json
{
  "dependencies": {
    "zod": "^3.22.4",
    "langchain": "^0.1.25",
    "@langchain/openai": "^0.0.19",
    "langchain-mcp-adapters": "^0.1.0",
    "@modelcontextprotocol/client": "^0.1.0"
  }
}
```

---

**Implementation Status**: 🔄 Research Complete - Ready for Implementation  
**Priority**: High - Structured Output | Medium - Semantic/MCP Integration  
**Expected Impact**: 40-60% improvement in pattern recognition accuracy

**Next Steps**: Begin with structured output classification (Phase 1) while planning vector store integration (Phase 2).