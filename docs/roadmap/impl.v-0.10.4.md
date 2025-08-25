# Implementation Guide: v-0.10.4 - Learning Integration

## Overview

Version 0.10.4 implements a comprehensive learning integration system that enables agents to:
- Learn from goal outcomes and execution patterns
- Adapt strategies based on historical performance
- Maintain persistent knowledge across sessions
- Share learnings between agents and contexts
- Provide intelligent recommendations and optimizations

This version builds on the goal management system from v-0.10.3 and integrates with the coordination system from v-0.10.2.

## Prerequisites

- ✅ v-0.10.0: QiCore foundation and basic agent structure
- ✅ v-0.10.1: Basic decision engine implementation  
- ✅ v-0.10.2: Multi-agent coordination system
- ✅ v-0.10.3: Goal management system
- 📋 Understanding of machine learning concepts (especially online learning)
- 📋 Knowledge of knowledge graphs and semantic relationships
- 📋 Experience with statistical analysis and pattern recognition

## Architecture Overview

```
lib/src/agent/learning/
├── types.ts                  # Learning interfaces and types
├── manager/
│   ├── LearningManager.ts     # Main learning orchestrator
│   └── KnowledgeBase.ts       # Centralized knowledge storage
├── analyzers/
│   ├── PerformanceAnalyzer.ts # Goal/task performance analysis
│   ├── PatternAnalyzer.ts     # Pattern recognition in execution
│   └── ContextAnalyzer.ts     # Context-outcome relationship analysis
├── adapters/
│   ├── StrategyAdapter.ts     # Strategy optimization based on learning
│   ├── ResourceAdapter.ts     # Resource allocation optimization
│   └── PlanningAdapter.ts     # Planning improvement suggestions
├── models/
│   ├── OutcomePredictor.ts    # Predict goal/task outcomes
│   ├── EfficiencyModel.ts     # Model for efficiency optimization
│   └── RiskAssessment.ts      # Risk prediction and mitigation
├── storage/
│   ├── LearningStorage.ts     # Learning data persistence interface
│   └── FileLearningStorage.ts # File-based learning storage
└── insights/
    ├── InsightEngine.ts       # Generate actionable insights
    └── RecommendationEngine.ts# Provide optimization recommendations
```

## Core Interfaces and Types

### types.ts

```typescript
import { Result } from '@qi/base';
import { QiError } from '@qi/core';
import { GoalDefinition, GoalProgress, GoalEvent, TaskPlan } from '../types.js';

export interface LearningEvent {
  id: string;
  type: 'goal_completed' | 'goal_failed' | 'strategy_changed' | 'performance_measured' | 'error_occurred';
  timestamp: Date;
  agentId: string;
  sessionId: string;
  data: LearningEventData;
  context: LearningContext;
}

export interface LearningEventData {
  goalId?: string;
  taskId?: string;
  strategyName?: string;
  performanceMetrics?: PerformanceMetrics;
  errorCategory?: string;
  resourceUsage?: ResourceUsage;
  outcomeType?: 'success' | 'failure' | 'partial';
  metadata?: Record<string, unknown>;
}

export interface LearningContext {
  environment: Record<string, unknown>;
  constraints: string[];
  resources: ResourceAvailability[];
  complexity: 'low' | 'medium' | 'high';
  urgency: 'low' | 'normal' | 'high' | 'critical';
  domainTags: string[];
}

export interface PerformanceMetrics {
  executionTime: number; // milliseconds
  resourceEfficiency: number; // 0-1 scale
  accuracyScore: number; // 0-1 scale
  userSatisfaction?: number; // 0-1 scale
  errorRate: number; // 0-1 scale
  adaptabilityScore: number; // 0-1 scale
}

export interface ResourceUsage {
  cpu: number;
  memory: number; // MB
  network: number; // KB
  storage: number; // MB
  tokens?: number; // LLM tokens
  apiCalls?: number;
}

export interface ResourceAvailability {
  type: string;
  available: number;
  total: number;
  unit: string;
}

export interface LearningPattern {
  id: string;
  type: 'performance' | 'failure' | 'optimization' | 'context';
  pattern: string; // Description of the pattern
  conditions: PatternCondition[];
  outcomes: PatternOutcome[];
  confidence: number; // 0-1 scale
  frequency: number; // How often this pattern occurs
  lastSeen: Date;
  examples: string[]; // Example goal/task IDs where this pattern occurred
}

export interface PatternCondition {
  attribute: string; // e.g., 'context.complexity', 'goal.priority'
  operator: 'equals' | 'greater' | 'less' | 'contains' | 'matches';
  value: unknown;
}

export interface PatternOutcome {
  attribute: string; // e.g., 'performance.executionTime', 'success.rate'
  value: unknown;
  impact: 'positive' | 'negative' | 'neutral';
}

export interface KnowledgeItem {
  id: string;
  type: 'fact' | 'rule' | 'heuristic' | 'constraint';
  domain: string; // Domain this knowledge applies to
  subject: string; // What this knowledge is about
  content: string; // The actual knowledge
  confidence: number; // 0-1 scale
  sources: string[]; // Where this knowledge came from
  validatedAt?: Date;
  lastUsed?: Date;
  usageCount: number;
}

export interface LearningInsight {
  id: string;
  type: 'performance_trend' | 'optimization_opportunity' | 'risk_pattern' | 'strategy_effectiveness';
  title: string;
  description: string;
  impact: 'high' | 'medium' | 'low';
  confidence: number; // 0-1 scale
  actionable: boolean;
  recommendations: string[];
  supportingData: Record<string, unknown>;
  createdAt: Date;
}

export interface StrategyRecommendation {
  strategyName: string;
  confidence: number; // 0-1 scale
  expectedImprovement: number; // Expected performance improvement %
  reasoning: string[];
  riskFactors: string[];
  applicableConditions: PatternCondition[];
}

export interface LearningModel {
  name: string;
  type: 'outcome_predictor' | 'efficiency_optimizer' | 'risk_assessor';
  version: string;
  trainedAt: Date;
  accuracy: number; // 0-1 scale
  parameters: Record<string, unknown>;
  trainingData: {
    samples: number;
    features: string[];
    labels: string[];
  };
}

export interface PredictionResult {
  outcome: 'success' | 'failure' | 'partial';
  confidence: number; // 0-1 scale
  expectedMetrics: PerformanceMetrics;
  riskFactors: string[];
  recommendations: string[];
}
```

## Learning Manager Implementation

### manager/LearningManager.ts

```typescript
import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { 
  LearningEvent, 
  LearningPattern, 
  KnowledgeItem, 
  LearningInsight,
  StrategyRecommendation,
  LearningContext,
  PredictionResult
} from '../types.js';
import { KnowledgeBase } from './KnowledgeBase.js';
import { PerformanceAnalyzer } from '../analyzers/PerformanceAnalyzer.js';
import { PatternAnalyzer } from '../analyzers/PatternAnalyzer.js';
import { ContextAnalyzer } from '../analyzers/ContextAnalyzer.js';
import { OutcomePredictor } from '../models/OutcomePredictor.js';
import { InsightEngine } from '../insights/InsightEngine.js';
import { RecommendationEngine } from '../insights/RecommendationEngine.js';
import { LearningStorage } from '../storage/LearningStorage.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';
import { AgentLogger } from '../../config/logger.js';

export class LearningManager {
  private knowledgeBase: KnowledgeBase;
  private performanceAnalyzer: PerformanceAnalyzer;
  private patternAnalyzer: PatternAnalyzer;
  private contextAnalyzer: ContextAnalyzer;
  private outcomePredictor: OutcomePredictor;
  private insightEngine: InsightEngine;
  private recommendationEngine: RecommendationEngine;
  private storage: LearningStorage;
  private logger: AgentLogger;

  constructor(
    storage: LearningStorage,
    logger: AgentLogger
  ) {
    this.storage = storage;
    this.logger = logger;
    this.knowledgeBase = new KnowledgeBase(storage, logger);
    this.performanceAnalyzer = new PerformanceAnalyzer(logger);
    this.patternAnalyzer = new PatternAnalyzer(storage, logger);
    this.contextAnalyzer = new ContextAnalyzer(logger);
    this.outcomePredictor = new OutcomePredictor(storage, logger);
    this.insightEngine = new InsightEngine(logger);
    this.recommendationEngine = new RecommendationEngine(storage, logger);
  }

  /**
   * Initialize the learning system
   */
  async initialize(): Promise<Result<void, QiError>> {
    try {
      // Initialize storage
      const storageResult = await this.storage.initialize();
      if (!storageResult.success) {
        return createError(storageResult.error);
      }

      // Initialize knowledge base
      const kbResult = await this.knowledgeBase.initialize();
      if (!kbResult.success) {
        return createError(kbResult.error);
      }

      // Load existing models
      const modelsResult = await this.outcomePredictor.loadModels();
      if (!modelsResult.success) {
        this.logger.warn('Failed to load existing models, will start fresh', {
          error: modelsResult.error
        });
      }

      this.logger.info('Learning system initialized successfully');
      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to initialize learning system',
          { error }
        )
      );
    }
  }

  /**
   * Record a learning event for analysis
   */
  async recordEvent(event: LearningEvent): Promise<Result<void, QiError>> {
    try {
      // Store the event
      const storageResult = await this.storage.saveEvent(event);
      if (!storageResult.success) {
        return createError(storageResult.error);
      }

      // Analyze the event for immediate insights
      const analysisPromises = [
        this.performanceAnalyzer.analyzeEvent(event),
        this.patternAnalyzer.analyzeEvent(event),
        this.contextAnalyzer.analyzeEvent(event)
      ];

      const analysisResults = await Promise.allSettled(analysisPromises);
      
      // Log any analysis failures but don't fail the entire operation
      analysisResults.forEach((result, index) => {
        if (result.status === 'rejected') {
          const analyzerNames = ['PerformanceAnalyzer', 'PatternAnalyzer', 'ContextAnalyzer'];
          this.logger.warn(`${analyzerNames[index]} failed to analyze event`, {
            eventId: event.id,
            error: result.reason
          });
        }
      });

      // Update knowledge base based on event
      if (event.type === 'goal_completed' || event.type === 'goal_failed') {
        await this.updateKnowledgeFromGoalOutcome(event);
      }

      this.logger.debug('Learning event recorded and analyzed', { eventId: event.id });
      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to record learning event',
          { eventId: event.id, error }
        )
      );
    }
  }

  /**
   * Get strategy recommendations for a given context
   */
  async getStrategyRecommendations(
    context: LearningContext,
    availableStrategies: string[]
  ): Promise<Result<StrategyRecommendation[], QiError>> {
    try {
      return await this.recommendationEngine.getStrategyRecommendations(
        context,
        availableStrategies
      );
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get strategy recommendations',
          { context, error }
        )
      );
    }
  }

  /**
   * Predict the outcome of a goal or task
   */
  async predictOutcome(
    goalOrTask: { 
      title: string; 
      description: string; 
      metadata?: Record<string, unknown> 
    },
    context: LearningContext,
    strategy?: string
  ): Promise<Result<PredictionResult, QiError>> {
    try {
      return await this.outcomePredictor.predict(goalOrTask, context, strategy);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to predict outcome',
          { goalOrTask, error }
        )
      );
    }
  }

  /**
   * Get learning insights for continuous improvement
   */
  async getInsights(
    timeframe?: { start: Date; end: Date },
    domains?: string[]
  ): Promise<Result<LearningInsight[], QiError>> {
    try {
      // Get events for analysis
      const eventsResult = await this.storage.getEvents({
        timeframe,
        domains
      });

      if (!eventsResult.success) {
        return createError(eventsResult.error);
      }

      // Generate insights
      return await this.insightEngine.generateInsights(eventsResult.value);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to generate insights',
          { timeframe, domains, error }
        )
      );
    }
  }

  /**
   * Get discovered patterns
   */
  async getPatterns(
    type?: 'performance' | 'failure' | 'optimization' | 'context',
    minConfidence?: number
  ): Promise<Result<LearningPattern[], QiError>> {
    try {
      return await this.patternAnalyzer.getPatterns(type, minConfidence);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get patterns',
          { type, minConfidence, error }
        )
      );
    }
  }

  /**
   * Query the knowledge base
   */
  async queryKnowledge(
    query: string,
    domain?: string
  ): Promise<Result<KnowledgeItem[], QiError>> {
    try {
      return await this.knowledgeBase.query(query, domain);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to query knowledge base',
          { query, domain, error }
        )
      );
    }
  }

  /**
   * Add knowledge to the knowledge base
   */
  async addKnowledge(knowledge: Omit<KnowledgeItem, 'id'>): Promise<Result<KnowledgeItem, QiError>> {
    try {
      return await this.knowledgeBase.addKnowledge(knowledge);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to add knowledge',
          { knowledge, error }
        )
      );
    }
  }

  /**
   * Retrain models based on recent data
   */
  async retrainModels(
    modelType?: 'outcome_predictor' | 'efficiency_optimizer' | 'risk_assessor'
  ): Promise<Result<void, QiError>> {
    try {
      const retrainResults: Result<void, QiError>[] = [];

      if (!modelType || modelType === 'outcome_predictor') {
        const result = await this.outcomePredictor.retrain();
        retrainResults.push(result);
      }

      // Add other model types as they're implemented

      // Check if any retraining failed
      const failures = retrainResults.filter(r => !r.success);
      if (failures.length > 0) {
        return createError(failures[0].error);
      }

      this.logger.info('Models retrained successfully', { modelType });
      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to retrain models',
          { modelType, error }
        )
      );
    }
  }

  /**
   * Get learning statistics and health metrics
   */
  async getStats(): Promise<Result<{
    eventsProcessed: number;
    patternsDiscovered: number;
    knowledgeItems: number;
    modelAccuracy: Record<string, number>;
    recentActivity: {
      lastWeek: number;
      lastMonth: number;
    };
  }, QiError>> {
    try {
      const [eventsResult, patternsResult, knowledgeResult] = await Promise.all([
        this.storage.getEventCount(),
        this.patternAnalyzer.getPatternCount(),
        this.knowledgeBase.getKnowledgeCount()
      ]);

      const modelAccuracy = await this.outcomePredictor.getModelAccuracy();

      // Get recent activity
      const oneWeekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
      const oneMonthAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);

      const [weeklyResult, monthlyResult] = await Promise.all([
        this.storage.getEventCount({ since: oneWeekAgo }),
        this.storage.getEventCount({ since: oneMonthAgo })
      ]);

      const stats = {
        eventsProcessed: eventsResult.success ? eventsResult.value : 0,
        patternsDiscovered: patternsResult.success ? patternsResult.value : 0,
        knowledgeItems: knowledgeResult.success ? knowledgeResult.value : 0,
        modelAccuracy: modelAccuracy.success ? modelAccuracy.value : {},
        recentActivity: {
          lastWeek: weeklyResult.success ? weeklyResult.value : 0,
          lastMonth: monthlyResult.success ? monthlyResult.value : 0
        }
      };

      return createResult(stats);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get learning statistics',
          { error }
        )
      );
    }
  }

  private async updateKnowledgeFromGoalOutcome(event: LearningEvent): Promise<void> {
    try {
      if (!event.data.goalId || !event.data.performanceMetrics) return;

      const outcome = event.type === 'goal_completed' ? 'success' : 'failure';
      const metrics = event.data.performanceMetrics;

      // Create knowledge about strategy effectiveness
      if (event.data.strategyName) {
        const knowledge: Omit<KnowledgeItem, 'id'> = {
          type: 'fact',
          domain: 'strategy_performance',
          subject: event.data.strategyName,
          content: `Strategy ${event.data.strategyName} resulted in ${outcome} with efficiency ${metrics.resourceEfficiency} and execution time ${metrics.executionTime}ms`,
          confidence: outcome === 'success' ? 0.8 : 0.6,
          sources: [`goal:${event.data.goalId}`, `event:${event.id}`],
          usageCount: 0
        };

        await this.knowledgeBase.addKnowledge(knowledge);
      }

      // Create knowledge about context-outcome relationships
      if (event.context.complexity || event.context.urgency) {
        const knowledge: Omit<KnowledgeItem, 'id'> = {
          type: 'heuristic',
          domain: 'context_outcomes',
          subject: `complexity_${event.context.complexity}_urgency_${event.context.urgency}`,
          content: `Goals with complexity=${event.context.complexity} and urgency=${event.context.urgency} typically ${outcome === 'success' ? 'succeed' : 'fail'} with accuracy ${metrics.accuracyScore}`,
          confidence: 0.7,
          sources: [`goal:${event.data.goalId}`, `event:${event.id}`],
          usageCount: 0
        };

        await this.knowledgeBase.addKnowledge(knowledge);
      }

    } catch (error) {
      this.logger.warn('Failed to update knowledge from goal outcome', {
        eventId: event.id,
        error
      });
    }
  }
}
```

## Knowledge Base Implementation

### manager/KnowledgeBase.ts

```typescript
import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { KnowledgeItem } from '../types.js';
import { LearningStorage } from '../storage/LearningStorage.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';
import { AgentLogger } from '../../config/logger.js';

export class KnowledgeBase {
  private storage: LearningStorage;
  private logger: AgentLogger;
  private knowledgeCache: Map<string, KnowledgeItem>;
  private cacheSize: number;
  private maxCacheSize: number;

  constructor(storage: LearningStorage, logger: AgentLogger, maxCacheSize = 10000) {
    this.storage = storage;
    this.logger = logger;
    this.knowledgeCache = new Map();
    this.cacheSize = 0;
    this.maxCacheSize = maxCacheSize;
  }

  async initialize(): Promise<Result<void, QiError>> {
    try {
      // Load frequently used knowledge into cache
      const recentResult = await this.storage.getKnowledge({
        orderBy: 'usageCount',
        limit: Math.min(this.maxCacheSize / 2, 1000)
      });

      if (recentResult.success) {
        for (const item of recentResult.value) {
          this.knowledgeCache.set(item.id, item);
          this.cacheSize++;
        }
        
        this.logger.info('Knowledge base initialized', { 
          cachedItems: this.cacheSize 
        });
      }

      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to initialize knowledge base',
          { error }
        )
      );
    }
  }

  /**
   * Add new knowledge to the base
   */
  async addKnowledge(knowledge: Omit<KnowledgeItem, 'id'>): Promise<Result<KnowledgeItem, QiError>> {
    try {
      // Check for similar existing knowledge to avoid duplicates
      const similarResult = await this.findSimilarKnowledge(knowledge);
      if (similarResult.success && similarResult.value.length > 0) {
        // Update existing knowledge instead of creating new
        const existing = similarResult.value[0];
        const updatedResult = await this.updateKnowledge(existing.id, {
          confidence: Math.max(existing.confidence, knowledge.confidence),
          sources: [...new Set([...existing.sources, ...knowledge.sources])],
          usageCount: existing.usageCount + 1
        });
        
        if (updatedResult.success) {
          return createResult(updatedResult.value);
        }
      }

      // Create new knowledge item
      const newKnowledge: KnowledgeItem = {
        ...knowledge,
        id: `knowledge_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        usageCount: 0
      };

      // Save to storage
      const saveResult = await this.storage.saveKnowledge(newKnowledge);
      if (!saveResult.success) {
        return createError(saveResult.error);
      }

      // Add to cache if there's space
      if (this.cacheSize < this.maxCacheSize) {
        this.knowledgeCache.set(newKnowledge.id, newKnowledge);
        this.cacheSize++;
      }

      this.logger.debug('Knowledge added', { 
        knowledgeId: newKnowledge.id,
        domain: newKnowledge.domain,
        type: newKnowledge.type
      });

      return createResult(newKnowledge);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to add knowledge',
          { knowledge, error }
        )
      );
    }
  }

  /**
   * Query knowledge by content, domain, or subject
   */
  async query(
    query: string,
    domain?: string,
    type?: 'fact' | 'rule' | 'heuristic' | 'constraint'
  ): Promise<Result<KnowledgeItem[], QiError>> {
    try {
      // First check cache for exact matches
      const cacheResults = this.searchCache(query, domain, type);
      
      // Then search storage for more comprehensive results
      const storageResult = await this.storage.searchKnowledge(query, domain, type);
      if (!storageResult.success) {
        return createError(storageResult.error);
      }

      // Combine and deduplicate results
      const allResults = new Map<string, KnowledgeItem>();
      
      // Add cache results (higher priority)
      for (const item of cacheResults) {
        allResults.set(item.id, item);
      }
      
      // Add storage results
      for (const item of storageResult.value) {
        if (!allResults.has(item.id)) {
          allResults.set(item.id, item);
        }
      }

      // Sort by relevance and confidence
      const sortedResults = Array.from(allResults.values()).sort((a, b) => {
        // Prioritize by confidence first, then by usage count
        const confidenceDiff = b.confidence - a.confidence;
        if (Math.abs(confidenceDiff) > 0.1) {
          return confidenceDiff;
        }
        return b.usageCount - a.usageCount;
      });

      // Update usage counts for returned items
      const updatePromises = sortedResults.slice(0, 10).map(item => 
        this.updateUsageCount(item.id)
      );
      await Promise.allSettled(updatePromises);

      return createResult(sortedResults.slice(0, 50)); // Limit results

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to query knowledge',
          { query, domain, type, error }
        )
      );
    }
  }

  /**
   * Update existing knowledge
   */
  async updateKnowledge(
    id: string,
    updates: Partial<Omit<KnowledgeItem, 'id'>>
  ): Promise<Result<KnowledgeItem, QiError>> {
    try {
      // Get existing knowledge
      const existingResult = await this.getKnowledge(id);
      if (!existingResult.success) {
        return createError(existingResult.error);
      }

      const updated: KnowledgeItem = {
        ...existingResult.value,
        ...updates,
        lastUsed: new Date()
      };

      // Save to storage
      const saveResult = await this.storage.saveKnowledge(updated);
      if (!saveResult.success) {
        return createError(saveResult.error);
      }

      // Update cache
      if (this.knowledgeCache.has(id)) {
        this.knowledgeCache.set(id, updated);
      }

      return createResult(updated);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to update knowledge',
          { id, updates, error }
        )
      );
    }
  }

  /**
   * Get knowledge by ID
   */
  async getKnowledge(id: string): Promise<Result<KnowledgeItem, QiError>> {
    try {
      // Check cache first
      const cached = this.knowledgeCache.get(id);
      if (cached) {
        return createResult(cached);
      }

      // Check storage
      const storageResult = await this.storage.getKnowledge({ ids: [id] });
      if (!storageResult.success) {
        return createError(storageResult.error);
      }

      if (storageResult.value.length === 0) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Knowledge item not found',
            { id }
          )
        );
      }

      const knowledge = storageResult.value[0];

      // Add to cache if there's space
      if (this.cacheSize < this.maxCacheSize) {
        this.knowledgeCache.set(id, knowledge);
        this.cacheSize++;
      }

      return createResult(knowledge);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get knowledge',
          { id, error }
        )
      );
    }
  }

  /**
   * Get knowledge count
   */
  async getKnowledgeCount(domain?: string): Promise<Result<number, QiError>> {
    try {
      return await this.storage.getKnowledgeCount(domain);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get knowledge count',
          { domain, error }
        )
      );
    }
  }

  /**
   * Validate and clean up knowledge base
   */
  async cleanup(options: {
    removeUnused?: boolean;
    minConfidence?: number;
    maxAge?: number; // days
  } = {}): Promise<Result<{ removed: number; updated: number }, QiError>> {
    try {
      let removed = 0;
      let updated = 0;

      // Get all knowledge for review
      const allResult = await this.storage.getKnowledge({});
      if (!allResult.success) {
        return createError(allResult.error);
      }

      const cutoffDate = options.maxAge ? 
        new Date(Date.now() - options.maxAge * 24 * 60 * 60 * 1000) : null;
      const minConfidence = options.minConfidence ?? 0.1;

      for (const item of allResult.value) {
        let shouldRemove = false;
        let shouldUpdate = false;
        const updates: Partial<KnowledgeItem> = {};

        // Check for removal conditions
        if (options.removeUnused && item.usageCount === 0 && 
            (!item.lastUsed || (cutoffDate && item.lastUsed < cutoffDate))) {
          shouldRemove = true;
        } else if (item.confidence < minConfidence) {
          shouldRemove = true;
        }

        // Check for updates
        if (!shouldRemove) {
          // Decay confidence over time if not used
          if (item.lastUsed && cutoffDate && item.lastUsed < cutoffDate) {
            const ageInDays = (Date.now() - item.lastUsed.getTime()) / (24 * 60 * 60 * 1000);
            const decayFactor = Math.max(0.1, 1 - (ageInDays / 365)); // Decay over a year
            const newConfidence = item.confidence * decayFactor;
            
            if (newConfidence !== item.confidence) {
              updates.confidence = newConfidence;
              shouldUpdate = true;
            }
          }
        }

        if (shouldRemove) {
          await this.storage.deleteKnowledge(item.id);
          this.knowledgeCache.delete(item.id);
          removed++;
        } else if (shouldUpdate) {
          await this.updateKnowledge(item.id, updates);
          updated++;
        }
      }

      this.logger.info('Knowledge base cleanup completed', { removed, updated });
      return createResult({ removed, updated });

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to cleanup knowledge base',
          { options, error }
        )
      );
    }
  }

  private searchCache(
    query: string,
    domain?: string,
    type?: string
  ): KnowledgeItem[] {
    const results: KnowledgeItem[] = [];
    const queryLower = query.toLowerCase();

    for (const item of this.knowledgeCache.values()) {
      // Check domain filter
      if (domain && item.domain !== domain) continue;
      
      // Check type filter
      if (type && item.type !== type) continue;

      // Check query match
      const contentMatch = item.content.toLowerCase().includes(queryLower);
      const subjectMatch = item.subject.toLowerCase().includes(queryLower);
      
      if (contentMatch || subjectMatch) {
        results.push(item);
      }
    }

    return results;
  }

  private async findSimilarKnowledge(
    knowledge: Omit<KnowledgeItem, 'id'>
  ): Promise<Result<KnowledgeItem[], QiError>> {
    try {
      // Search for knowledge with same domain and subject
      const searchResult = await this.storage.searchKnowledge(
        knowledge.subject,
        knowledge.domain,
        knowledge.type
      );

      if (!searchResult.success) {
        return createError(searchResult.error);
      }

      // Filter for truly similar items
      const similar = searchResult.value.filter(item => {
        const contentSimilarity = this.calculateSimilarity(
          knowledge.content.toLowerCase(),
          item.content.toLowerCase()
        );
        return contentSimilarity > 0.8; // 80% similarity threshold
      });

      return createResult(similar);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to find similar knowledge',
          { knowledge, error }
        )
      );
    }
  }

  private async updateUsageCount(id: string): Promise<void> {
    try {
      const item = this.knowledgeCache.get(id);
      if (item) {
        item.usageCount++;
        item.lastUsed = new Date();
        await this.storage.saveKnowledge(item);
      } else {
        // Update directly in storage
        const result = await this.getKnowledge(id);
        if (result.success) {
          await this.updateKnowledge(id, {
            usageCount: result.value.usageCount + 1,
            lastUsed: new Date()
          });
        }
      }
    } catch (error) {
      this.logger.warn('Failed to update usage count', { id, error });
    }
  }

  private calculateSimilarity(str1: string, str2: string): number {
    // Simple Levenshtein distance-based similarity
    const len1 = str1.length;
    const len2 = str2.length;
    
    if (len1 === 0) return len2 === 0 ? 1 : 0;
    if (len2 === 0) return 0;

    const matrix = Array(len2 + 1).fill(null).map(() => Array(len1 + 1).fill(null));

    for (let i = 0; i <= len1; i++) {
      matrix[0][i] = i;
    }
    for (let j = 0; j <= len2; j++) {
      matrix[j][0] = j;
    }

    for (let j = 1; j <= len2; j++) {
      for (let i = 1; i <= len1; i++) {
        const cost = str1[i - 1] === str2[j - 1] ? 0 : 1;
        matrix[j][i] = Math.min(
          matrix[j][i - 1] + 1,
          matrix[j - 1][i] + 1,
          matrix[j - 1][i - 1] + cost
        );
      }
    }

    const distance = matrix[len2][len1];
    const maxLen = Math.max(len1, len2);
    return (maxLen - distance) / maxLen;
  }
}
```

## Pattern Analyzer Implementation

### analyzers/PatternAnalyzer.ts

```typescript
import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { 
  LearningEvent, 
  LearningPattern, 
  PatternCondition, 
  PatternOutcome 
} from '../types.js';
import { LearningStorage } from '../storage/LearningStorage.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';
import { AgentLogger } from '../../config/logger.js';

export class PatternAnalyzer {
  private storage: LearningStorage;
  private logger: AgentLogger;
  private patterns: Map<string, LearningPattern>;
  private analysisWindow: number; // Number of events to analyze at once

  constructor(storage: LearningStorage, logger: AgentLogger) {
    this.storage = storage;
    this.logger = logger;
    this.patterns = new Map();
    this.analysisWindow = 1000; // Analyze last 1000 events
  }

  /**
   * Analyze a new event for patterns
   */
  async analyzeEvent(event: LearningEvent): Promise<Result<void, QiError>> {
    try {
      // Get recent events for pattern analysis
      const eventsResult = await this.storage.getEvents({
        limit: this.analysisWindow,
        orderBy: 'timestamp'
      });

      if (!eventsResult.success) {
        return createError(eventsResult.error);
      }

      const allEvents = [event, ...eventsResult.value];

      // Analyze for different pattern types
      await Promise.all([
        this.analyzePerformancePatterns(allEvents),
        this.analyzeFailurePatterns(allEvents),
        this.analyzeContextPatterns(allEvents),
        this.analyzeOptimizationPatterns(allEvents)
      ]);

      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to analyze event for patterns',
          { eventId: event.id, error }
        )
      );
    }
  }

  /**
   * Get discovered patterns
   */
  async getPatterns(
    type?: 'performance' | 'failure' | 'optimization' | 'context',
    minConfidence = 0.5
  ): Promise<Result<LearningPattern[], QiError>> {
    try {
      // Load patterns from storage
      const patternsResult = await this.storage.getPatterns({ type, minConfidence });
      if (!patternsResult.success) {
        return createError(patternsResult.error);
      }

      // Update in-memory cache
      for (const pattern of patternsResult.value) {
        this.patterns.set(pattern.id, pattern);
      }

      return createResult(patternsResult.value);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get patterns',
          { type, minConfidence, error }
        )
      );
    }
  }

  /**
   * Get pattern count
   */
  async getPatternCount(type?: string): Promise<Result<number, QiError>> {
    try {
      return await this.storage.getPatternCount(type);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get pattern count',
          { type, error }
        )
      );
    }
  }

  private async analyzePerformancePatterns(events: LearningEvent[]): Promise<void> {
    try {
      // Group events by context characteristics
      const contextGroups = new Map<string, LearningEvent[]>();

      for (const event of events) {
        if (!event.data.performanceMetrics) continue;

        const contextKey = this.createContextKey(event.context);
        if (!contextGroups.has(contextKey)) {
          contextGroups.set(contextKey, []);
        }
        contextGroups.get(contextKey)!.push(event);
      }

      // Analyze performance patterns within each context group
      for (const [contextKey, groupEvents] of contextGroups) {
        if (groupEvents.length < 5) continue; // Need minimum sample size

        const performances = groupEvents.map(e => e.data.performanceMetrics!);
        
        // Calculate statistics
        const avgExecutionTime = this.average(performances.map(p => p.executionTime));
        const avgEfficiency = this.average(performances.map(p => p.resourceEfficiency));
        const avgAccuracy = this.average(performances.map(p => p.accuracyScore));
        
        // Check if this represents a notable pattern
        const efficiencyStdDev = this.standardDeviation(performances.map(p => p.resourceEfficiency));
        if (efficiencyStdDev < 0.1 && avgEfficiency > 0.7) { // Consistent high performance
          await this.recordPattern({
            type: 'performance',
            pattern: `High performance pattern in context: ${contextKey}`,
            conditions: this.parseContextKey(contextKey),
            outcomes: [
              {
                attribute: 'performance.resourceEfficiency',
                value: avgEfficiency,
                impact: 'positive'
              },
              {
                attribute: 'performance.executionTime',
                value: avgExecutionTime,
                impact: avgExecutionTime < 30000 ? 'positive' : 'neutral'
              }
            ],
            confidence: Math.min(0.9, groupEvents.length / 20), // Confidence based on sample size
            frequency: groupEvents.length,
            examples: groupEvents.slice(0, 5).map(e => e.data.goalId || e.data.taskId || e.id)
          });
        }
      }

    } catch (error) {
      this.logger.warn('Failed to analyze performance patterns', { error });
    }
  }

  private async analyzeFailurePatterns(events: LearningEvent[]): Promise<void> {
    try {
      const failureEvents = events.filter(e => 
        e.type === 'goal_failed' || e.data.outcomeType === 'failure'
      );

      if (failureEvents.length < 3) return;

      // Group failures by error category
      const errorGroups = new Map<string, LearningEvent[]>();

      for (const event of failureEvents) {
        const errorCategory = event.data.errorCategory || 'unknown';
        if (!errorGroups.has(errorCategory)) {
          errorGroups.set(errorCategory, []);
        }
        errorGroups.get(errorCategory)!.push(event);
      }

      // Analyze failure patterns
      for (const [errorCategory, groupEvents] of errorGroups) {
        if (groupEvents.length < 2) continue;

        // Find common conditions leading to this error
        const commonConditions = this.findCommonConditions(groupEvents);
        
        if (commonConditions.length > 0) {
          await this.recordPattern({
            type: 'failure',
            pattern: `Common failure pattern for ${errorCategory}`,
            conditions: commonConditions,
            outcomes: [{
              attribute: 'outcome',
              value: 'failure',
              impact: 'negative'
            }],
            confidence: Math.min(0.8, groupEvents.length / 10),
            frequency: groupEvents.length,
            examples: groupEvents.slice(0, 3).map(e => e.data.goalId || e.data.taskId || e.id)
          });
        }
      }

    } catch (error) {
      this.logger.warn('Failed to analyze failure patterns', { error });
    }
  }

  private async analyzeContextPatterns(events: LearningEvent[]): Promise<void> {
    try {
      // Analyze how context affects outcomes
      const contextOutcomes = new Map<string, { success: number; failure: number }>();

      for (const event of events) {
        if (!event.data.outcomeType) continue;

        const contextKey = this.createContextKey(event.context);
        if (!contextOutcomes.has(contextKey)) {
          contextOutcomes.set(contextKey, { success: 0, failure: 0 });
        }

        const counts = contextOutcomes.get(contextKey)!;
        if (event.data.outcomeType === 'success') {
          counts.success++;
        } else {
          counts.failure++;
        }
      }

      // Find context patterns with strong correlations
      for (const [contextKey, counts] of contextOutcomes) {
        const total = counts.success + counts.failure;
        if (total < 5) continue;

        const successRate = counts.success / total;
        
        // Record patterns for very high or very low success rates
        if (successRate > 0.8 || successRate < 0.3) {
          await this.recordPattern({
            type: 'context',
            pattern: `Context ${successRate > 0.8 ? 'favors' : 'hinders'} success: ${contextKey}`,
            conditions: this.parseContextKey(contextKey),
            outcomes: [{
              attribute: 'success.rate',
              value: successRate,
              impact: successRate > 0.8 ? 'positive' : 'negative'
            }],
            confidence: Math.min(0.9, total / 20),
            frequency: total,
            examples: []
          });
        }
      }

    } catch (error) {
      this.logger.warn('Failed to analyze context patterns', { error });
    }
  }

  private async analyzeOptimizationPatterns(events: LearningEvent[]): Promise<void> {
    try {
      // Look for events where strategy changes led to improvements
      const strategyChanges = events.filter(e => e.type === 'strategy_changed');
      
      for (const changeEvent of strategyChanges) {
        // Find subsequent events for the same goal/task
        const targetId = changeEvent.data.goalId || changeEvent.data.taskId;
        if (!targetId) continue;

        const subsequentEvents = events.filter(e => 
          (e.data.goalId === targetId || e.data.taskId === targetId) &&
          e.timestamp > changeEvent.timestamp &&
          e.data.performanceMetrics
        );

        if (subsequentEvents.length === 0) continue;

        // Check if performance improved after strategy change
        const beforeEvents = events.filter(e =>
          (e.data.goalId === targetId || e.data.taskId === targetId) &&
          e.timestamp < changeEvent.timestamp &&
          e.data.performanceMetrics
        );

        if (beforeEvents.length === 0) continue;

        const beforePerformance = this.average(
          beforeEvents.map(e => e.data.performanceMetrics!.resourceEfficiency)
        );
        const afterPerformance = this.average(
          subsequentEvents.map(e => e.data.performanceMetrics!.resourceEfficiency)
        );

        if (afterPerformance > beforePerformance * 1.1) { // 10% improvement
          await this.recordPattern({
            type: 'optimization',
            pattern: `Strategy change to ${changeEvent.data.strategyName} improved performance`,
            conditions: [{
              attribute: 'strategy',
              operator: 'equals',
              value: changeEvent.data.strategyName
            }],
            outcomes: [{
              attribute: 'performance.improvement',
              value: (afterPerformance - beforePerformance) / beforePerformance,
              impact: 'positive'
            }],
            confidence: 0.7,
            frequency: 1,
            examples: [targetId]
          });
        }
      }

    } catch (error) {
      this.logger.warn('Failed to analyze optimization patterns', { error });
    }
  }

  private async recordPattern(patternData: Omit<LearningPattern, 'id' | 'lastSeen'>): Promise<void> {
    try {
      const pattern: LearningPattern = {
        ...patternData,
        id: `pattern_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        lastSeen: new Date()
      };

      // Check if similar pattern already exists
      const existing = Array.from(this.patterns.values()).find(p =>
        p.type === pattern.type && 
        p.pattern === pattern.pattern &&
        this.conditionsMatch(p.conditions, pattern.conditions)
      );

      if (existing) {
        // Update existing pattern
        existing.frequency += pattern.frequency;
        existing.confidence = Math.min(0.95, existing.confidence + 0.05);
        existing.lastSeen = new Date();
        existing.examples.push(...pattern.examples);
        
        await this.storage.savePattern(existing);
        this.patterns.set(existing.id, existing);
      } else {
        // Save new pattern
        await this.storage.savePattern(pattern);
        this.patterns.set(pattern.id, pattern);
      }

    } catch (error) {
      this.logger.warn('Failed to record pattern', { pattern: patternData, error });
    }
  }

  private createContextKey(context: { 
    complexity?: string; 
    urgency?: string; 
    domainTags?: string[] 
  }): string {
    const parts = [];
    if (context.complexity) parts.push(`complexity:${context.complexity}`);
    if (context.urgency) parts.push(`urgency:${context.urgency}`);
    if (context.domainTags?.length) {
      parts.push(`domains:${context.domainTags.sort().join(',')}`);
    }
    return parts.join('|');
  }

  private parseContextKey(contextKey: string): PatternCondition[] {
    const conditions: PatternCondition[] = [];
    const parts = contextKey.split('|');

    for (const part of parts) {
      const [attribute, value] = part.split(':');
      conditions.push({
        attribute: `context.${attribute}`,
        operator: 'equals',
        value
      });
    }

    return conditions;
  }

  private findCommonConditions(events: LearningEvent[]): PatternCondition[] {
    const conditions: PatternCondition[] = [];
    
    // Find common complexity levels
    const complexities = events.map(e => e.context.complexity).filter(Boolean);
    const commonComplexity = this.findMostCommon(complexities);
    if (commonComplexity && complexities.filter(c => c === commonComplexity).length > events.length * 0.7) {
      conditions.push({
        attribute: 'context.complexity',
        operator: 'equals',
        value: commonComplexity
      });
    }

    // Find common urgency levels
    const urgencies = events.map(e => e.context.urgency).filter(Boolean);
    const commonUrgency = this.findMostCommon(urgencies);
    if (commonUrgency && urgencies.filter(u => u === commonUrgency).length > events.length * 0.7) {
      conditions.push({
        attribute: 'context.urgency',
        operator: 'equals',
        value: commonUrgency
      });
    }

    return conditions;
  }

  private conditionsMatch(conditions1: PatternCondition[], conditions2: PatternCondition[]): boolean {
    if (conditions1.length !== conditions2.length) return false;
    
    return conditions1.every(c1 => 
      conditions2.some(c2 => 
        c1.attribute === c2.attribute && 
        c1.operator === c2.operator && 
        c1.value === c2.value
      )
    );
  }

  private average(numbers: number[]): number {
    return numbers.length > 0 ? numbers.reduce((a, b) => a + b, 0) / numbers.length : 0;
  }

  private standardDeviation(numbers: number[]): number {
    const avg = this.average(numbers);
    const squareDiffs = numbers.map(value => Math.pow(value - avg, 2));
    const avgSquareDiff = this.average(squareDiffs);
    return Math.sqrt(avgSquareDiff);
  }

  private findMostCommon<T>(items: T[]): T | undefined {
    if (items.length === 0) return undefined;
    
    const counts = new Map<T, number>();
    let maxCount = 0;
    let mostCommon: T | undefined;

    for (const item of items) {
      const count = (counts.get(item) || 0) + 1;
      counts.set(item, count);
      if (count > maxCount) {
        maxCount = count;
        mostCommon = item;
      }
    }

    return mostCommon;
  }
}
```

## Storage Interface Implementation

### storage/LearningStorage.ts

```typescript
import { Result } from '@qi/base';
import { QiError } from '@qi/core';
import { LearningEvent, LearningPattern, KnowledgeItem, LearningModel } from '../types.js';

export interface LearningStorage {
  /**
   * Initialize storage
   */
  initialize(): Promise<Result<void, QiError>>;

  /**
   * Save a learning event
   */
  saveEvent(event: LearningEvent): Promise<Result<void, QiError>>;

  /**
   * Get learning events
   */
  getEvents(options?: {
    timeframe?: { start: Date; end: Date };
    agentId?: string;
    sessionId?: string;
    domains?: string[];
    type?: string;
    limit?: number;
    orderBy?: 'timestamp' | 'type';
  }): Promise<Result<LearningEvent[], QiError>>;

  /**
   * Get event count
   */
  getEventCount(options?: { since?: Date }): Promise<Result<number, QiError>>;

  /**
   * Save a pattern
   */
  savePattern(pattern: LearningPattern): Promise<Result<void, QiError>>;

  /**
   * Get patterns
   */
  getPatterns(options?: {
    type?: string;
    minConfidence?: number;
    limit?: number;
  }): Promise<Result<LearningPattern[], QiError>>;

  /**
   * Get pattern count
   */
  getPatternCount(type?: string): Promise<Result<number, QiError>>;

  /**
   * Save knowledge
   */
  saveKnowledge(knowledge: KnowledgeItem): Promise<Result<void, QiError>>;

  /**
   * Get knowledge
   */
  getKnowledge(options?: {
    ids?: string[];
    domain?: string;
    type?: string;
    orderBy?: 'usageCount' | 'confidence' | 'lastUsed';
    limit?: number;
  }): Promise<Result<KnowledgeItem[], QiError>>;

  /**
   * Search knowledge
   */
  searchKnowledge(
    query: string,
    domain?: string,
    type?: string
  ): Promise<Result<KnowledgeItem[], QiError>>;

  /**
   * Get knowledge count
   */
  getKnowledgeCount(domain?: string): Promise<Result<number, QiError>>;

  /**
   * Delete knowledge
   */
  deleteKnowledge(id: string): Promise<Result<void, QiError>>;

  /**
   * Save model
   */
  saveModel(model: LearningModel): Promise<Result<void, QiError>>;

  /**
   * Get model
   */
  getModel(name: string, type: string): Promise<Result<LearningModel, QiError>>;

  /**
   * List models
   */
  listModels(type?: string): Promise<Result<LearningModel[], QiError>>;
}
```

## Testing Framework

### __tests__/LearningManager.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { LearningManager } from '../manager/LearningManager.js';
import { FileLearningStorage } from '../storage/FileLearningStorage.js';
import { LearningEvent, LearningContext } from '../types.js';
import { AgentLogger } from '../../config/logger.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';

describe('LearningManager', () => {
  let learningManager: LearningManager;
  let storage: FileLearningStorage;
  let logger: AgentLogger;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `learning-test-${Date.now()}`);
    logger = new AgentLogger({ level: 'debug' });
    storage = new FileLearningStorage(tempDir, logger);
    
    learningManager = new LearningManager(storage, logger);
    
    const initResult = await learningManager.initialize();
    expect(initResult.success).toBe(true);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should record and analyze learning events', async () => {
    const event: LearningEvent = {
      id: 'test-event-1',
      type: 'goal_completed',
      timestamp: new Date(),
      agentId: 'test-agent',
      sessionId: 'test-session',
      data: {
        goalId: 'goal-1',
        strategyName: 'sequential',
        performanceMetrics: {
          executionTime: 5000,
          resourceEfficiency: 0.8,
          accuracyScore: 0.9,
          errorRate: 0.1,
          adaptabilityScore: 0.7
        },
        outcomeType: 'success'
      },
      context: {
        environment: { test: true },
        constraints: [],
        resources: [],
        complexity: 'medium',
        urgency: 'normal',
        domainTags: ['test']
      }
    };

    const result = await learningManager.recordEvent(event);
    expect(result.success).toBe(true);
  });

  it('should provide strategy recommendations', async () => {
    // First, record some events to build knowledge
    const events: LearningEvent[] = [
      {
        id: 'event-1',
        type: 'goal_completed',
        timestamp: new Date(),
        agentId: 'test-agent',
        sessionId: 'test-session',
        data: {
          goalId: 'goal-1',
          strategyName: 'sequential',
          performanceMetrics: {
            executionTime: 3000,
            resourceEfficiency: 0.9,
            accuracyScore: 0.95,
            errorRate: 0.05,
            adaptabilityScore: 0.8
          },
          outcomeType: 'success'
        },
        context: {
          environment: {},
          constraints: [],
          resources: [],
          complexity: 'low',
          urgency: 'normal',
          domainTags: ['test']
        }
      },
      {
        id: 'event-2',
        type: 'goal_completed',
        timestamp: new Date(),
        agentId: 'test-agent',
        sessionId: 'test-session',
        data: {
          goalId: 'goal-2',
          strategyName: 'parallel',
          performanceMetrics: {
            executionTime: 8000,
            resourceEfficiency: 0.6,
            accuracyScore: 0.7,
            errorRate: 0.3,
            adaptabilityScore: 0.5
          },
          outcomeType: 'partial'
        },
        context: {
          environment: {},
          constraints: [],
          resources: [],
          complexity: 'low',
          urgency: 'normal',
          domainTags: ['test']
        }
      }
    ];

    for (const event of events) {
      await learningManager.recordEvent(event);
    }

    const context: LearningContext = {
      environment: {},
      constraints: [],
      resources: [],
      complexity: 'low',
      urgency: 'normal',
      domainTags: ['test']
    };

    const result = await learningManager.getStrategyRecommendations(
      context,
      ['sequential', 'parallel', 'adaptive']
    );

    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.value).toBeInstanceOf(Array);
    }
  });

  it('should predict outcomes', async () => {
    const goal = {
      title: 'Test Goal',
      description: 'A simple test goal',
      metadata: { complexity: 'low' }
    };

    const context: LearningContext = {
      environment: {},
      constraints: [],
      resources: [],
      complexity: 'low',
      urgency: 'normal',
      domainTags: ['test']
    };

    const result = await learningManager.predictOutcome(goal, context, 'sequential');
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.value).toHaveProperty('outcome');
      expect(result.value).toHaveProperty('confidence');
      expect(result.value).toHaveProperty('expectedMetrics');
    }
  });

  it('should add and query knowledge', async () => {
    const knowledge = {
      type: 'fact' as const,
      domain: 'testing',
      subject: 'unit_tests',
      content: 'Unit tests are essential for code quality',
      confidence: 0.9,
      sources: ['test'],
      usageCount: 0
    };

    const addResult = await learningManager.addKnowledge(knowledge);
    expect(addResult.success).toBe(true);

    if (addResult.success) {
      const queryResult = await learningManager.queryKnowledge('unit tests', 'testing');
      expect(queryResult.success).toBe(true);
      
      if (queryResult.success) {
        expect(queryResult.value.length).toBeGreaterThan(0);
        expect(queryResult.value[0].content).toContain('Unit tests');
      }
    }
  });

  it('should generate insights', async () => {
    // Record multiple events to generate insights from
    const events: LearningEvent[] = [];
    
    for (let i = 0; i < 10; i++) {
      events.push({
        id: `event-${i}`,
        type: i % 2 === 0 ? 'goal_completed' : 'goal_failed',
        timestamp: new Date(Date.now() - i * 60000), // Events spread over time
        agentId: 'test-agent',
        sessionId: 'test-session',
        data: {
          goalId: `goal-${i}`,
          strategyName: 'sequential',
          performanceMetrics: {
            executionTime: 3000 + Math.random() * 2000,
            resourceEfficiency: 0.5 + Math.random() * 0.4,
            accuracyScore: 0.6 + Math.random() * 0.3,
            errorRate: Math.random() * 0.3,
            adaptabilityScore: 0.5 + Math.random() * 0.3
          },
          outcomeType: i % 2 === 0 ? 'success' : 'failure'
        },
        context: {
          environment: {},
          constraints: [],
          resources: [],
          complexity: i % 3 === 0 ? 'low' : 'medium',
          urgency: 'normal',
          domainTags: ['test']
        }
      });
    }

    for (const event of events) {
      await learningManager.recordEvent(event);
    }

    const result = await learningManager.getInsights();
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.value).toBeInstanceOf(Array);
    }
  });

  it('should get learning statistics', async () => {
    // Record some events first
    for (let i = 0; i < 5; i++) {
      const event: LearningEvent = {
        id: `stats-event-${i}`,
        type: 'goal_completed',
        timestamp: new Date(),
        agentId: 'test-agent',
        sessionId: 'test-session',
        data: {
          goalId: `goal-${i}`,
          outcomeType: 'success'
        },
        context: {
          environment: {},
          constraints: [],
          resources: [],
          complexity: 'low',
          urgency: 'normal',
          domainTags: ['test']
        }
      };
      
      await learningManager.recordEvent(event);
    }

    const result = await learningManager.getStats();
    expect(result.success).toBe(true);
    
    if (result.success) {
      expect(result.value).toHaveProperty('eventsProcessed');
      expect(result.value).toHaveProperty('patternsDiscovered');
      expect(result.value).toHaveProperty('knowledgeItems');
      expect(result.value).toHaveProperty('recentActivity');
    }
  });
});
```

## Integration Guide

### Integration with Goal Management (v-0.10.3)

```typescript
// Enhanced GoalManager with learning integration
export class LearningEnabledGoalManager extends GoalManager {
  constructor(
    storage: GoalStorage,
    logger: AgentLogger,
    private learningManager: LearningManager
  ) {
    super(storage, logger);
  }

  async createGoal(
    definition: Omit<GoalDefinition, 'id' | 'createdAt'>,
    context: GoalContext
  ): Promise<Result<GoalDefinition, QiError>> {
    // Get strategy recommendations from learning system
    const recommendationsResult = await this.learningManager.getStrategyRecommendations(
      this.mapToLearningContext(context),
      ['sequential', 'parallel', 'adaptive']
    );

    if (recommendationsResult.success && recommendationsResult.value.length > 0) {
      const bestStrategy = recommendationsResult.value[0];
      logger.info('Strategy recommendation received', {
        strategy: bestStrategy.strategyName,
        confidence: bestStrategy.confidence
      });
    }

    // Get outcome prediction
    const predictionResult = await this.learningManager.predictOutcome(
      { title: definition.title, description: definition.description },
      this.mapToLearningContext(context)
    );

    if (predictionResult.success) {
      logger.info('Outcome prediction', {
        expected: predictionResult.value.outcome,
        confidence: predictionResult.value.confidence
      });
    }

    // Create goal normally
    const result = await super.createGoal(definition, context);

    // Record learning event
    if (result.success) {
      await this.learningManager.recordEvent({
        id: `goal_created_${result.value.id}`,
        type: 'goal_completed', // Will be updated when goal actually completes
        timestamp: new Date(),
        agentId: context.agentId,
        sessionId: context.sessionId,
        data: {
          goalId: result.value.id,
          outcomeType: 'success'
        },
        context: this.mapToLearningContext(context)
      });
    }

    return result;
  }

  private mapToLearningContext(context: GoalContext): LearningContext {
    return {
      environment: context.environment,
      constraints: context.constraints.map(c => c.description),
      resources: context.resources.map(r => ({
        type: r.type,
        available: r.available,
        total: r.available + r.allocated,
        unit: r.unit
      })),
      complexity: this.inferComplexity(context),
      urgency: this.inferUrgency(context),
      domainTags: this.extractDomainTags(context)
    };
  }

  private inferComplexity(context: GoalContext): 'low' | 'medium' | 'high' {
    const constraintCount = context.constraints.length;
    const resourceCount = context.resources.length;
    
    if (constraintCount <= 2 && resourceCount <= 3) return 'low';
    if (constraintCount <= 5 && resourceCount <= 7) return 'medium';
    return 'high';
  }

  private inferUrgency(context: GoalContext): 'low' | 'normal' | 'high' | 'critical' {
    // Default implementation - could be enhanced based on context
    return 'normal';
  }

  private extractDomainTags(context: GoalContext): string[] {
    // Extract domain tags from environment or metadata
    const tags: string[] = [];
    
    if (typeof context.environment.domain === 'string') {
      tags.push(context.environment.domain);
    }
    
    if (Array.isArray(context.environment.tags)) {
      tags.push(...context.environment.tags);
    }

    return tags;
  }
}
```

## Performance Targets

### Success Criteria for v-0.10.4

1. **Learning Performance**
   - Event processing: < 100ms per event
   - Pattern analysis: < 500ms for 1000 events
   - Knowledge queries: < 50ms average

2. **Prediction Accuracy**
   - Outcome prediction: > 70% accuracy after 100 training examples
   - Strategy recommendation: > 60% improvement rate
   - Risk assessment: > 80% accuracy for known patterns

3. **Storage Performance**
   - Event storage: < 25ms per event
   - Knowledge retrieval: < 30ms average
   - Pattern queries: < 100ms average

4. **Memory Usage**
   - Pattern cache: < 50MB for 10,000 patterns
   - Knowledge cache: < 100MB for 50,000 items
   - Event buffer: < 20MB for recent events

5. **Learning Effectiveness**
   - Pattern discovery: > 5 meaningful patterns per 1000 events
   - Knowledge accumulation: > 90% retention of validated knowledge
   - Adaptation rate: Measurable improvement within 50 similar tasks

### Quality Gates

- All tests pass with > 90% code coverage
- Performance benchmarks meet targets under load
- Learning accuracy improves over time with more data
- No data corruption or loss in long-running scenarios
- Comprehensive privacy and security measures

## Next Steps: v-0.10.5

With learning integration complete, v-0.10.5 will implement:
- Advanced UI dashboards for learning insights
- Real-time collaboration between multiple agents
- External API integrations for enhanced capabilities  
- Advanced security and privacy controls
- Production deployment and monitoring tools

The learning system provides the intelligence layer that enables agents to continuously improve, adapt strategies, and share knowledge across the entire agent ecosystem.