# Implementation Guide: v-0.10.3 - Goal Management System

## Overview

Version 0.10.3 implements a comprehensive goal management system that enables agents to:
- Define and track hierarchical goals
- Manage goal dependencies and relationships
- Monitor progress and adapt strategies
- Persist goal state and history
- Provide goal-driven decision making

This version builds on the multi-agent coordination from v-0.10.2 and integrates with the decision engine from v-0.10.1.

## Prerequisites

- ✅ v-0.10.0: QiCore foundation and basic agent structure
- ✅ v-0.10.1: Basic decision engine implementation  
- ✅ v-0.10.2: Multi-agent coordination system
- 📋 Understanding of goal decomposition and planning algorithms
- 📋 Experience with state persistence and event sourcing

## Architecture Overview

```
lib/src/agent/goals/
├── types.ts              # Goal interfaces and types
├── manager/
│   ├── GoalManager.ts     # Main goal management orchestrator
│   └── GoalState.ts       # Goal state tracking and persistence
├── hierarchy/
│   ├── GoalHierarchy.ts   # Goal tree management
│   └── DependencyGraph.ts # Goal dependency resolution
├── progress/
│   ├── ProgressTracker.ts # Goal progress monitoring
│   └── MetricsCollector.ts# Goal performance metrics
├── strategies/
│   ├── GoalStrategy.ts    # Abstract goal achievement strategy
│   ├── SequentialStrategy.ts # Sequential goal execution
│   ├── ParallelStrategy.ts   # Parallel goal execution
│   └── AdaptiveStrategy.ts   # Dynamic strategy adjustment
└── storage/
    ├── GoalStorage.ts     # Goal persistence interface
    └── FileGoalStorage.ts # File-based goal storage
```

## Core Interfaces and Types

### types.ts

```typescript
import { Result } from '@qi/base';
import { QiError } from '@qi/core';

export enum GoalStatus {
  CREATED = 'created',
  ACTIVE = 'active', 
  PAUSED = 'paused',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled'
}

export enum GoalPriority {
  LOW = 1,
  NORMAL = 2,
  HIGH = 3,
  CRITICAL = 4
}

export interface GoalDefinition {
  id: string;
  title: string;
  description: string;
  priority: GoalPriority;
  parentGoalId?: string;
  dependencies?: string[];
  metadata: Record<string, unknown>;
  createdAt: Date;
  dueDate?: Date;
}

export interface GoalProgress {
  goalId: string;
  status: GoalStatus;
  progressPercentage: number;
  completedTasks: number;
  totalTasks: number;
  lastUpdated: Date;
  checkpoints: GoalCheckpoint[];
  metrics: GoalMetrics;
}

export interface GoalCheckpoint {
  id: string;
  goalId: string;
  title: string;
  description: string;
  completed: boolean;
  timestamp: Date;
  data?: Record<string, unknown>;
}

export interface GoalMetrics {
  timeSpent: number; // milliseconds
  resourcesUsed: Record<string, number>;
  efficiency: number; // 0-1 scale
  successRate: number; // 0-1 scale
  adaptations: number; // strategy changes
}

export interface GoalContext {
  agentId: string;
  sessionId: string;
  environment: Record<string, unknown>;
  constraints: GoalConstraint[];
  resources: GoalResource[];
}

export interface GoalConstraint {
  type: 'time' | 'resource' | 'dependency' | 'custom';
  value: unknown;
  description: string;
}

export interface GoalResource {
  type: string;
  name: string;
  available: number;
  allocated: number;
  unit: string;
}

export interface GoalEvent {
  id: string;
  goalId: string;
  type: 'created' | 'started' | 'progress' | 'completed' | 'failed' | 'adapted';
  timestamp: Date;
  data: Record<string, unknown>;
  agentId: string;
}

// Strategy interfaces
export interface GoalStrategy {
  name: string;
  canHandle(goal: GoalDefinition, context: GoalContext): boolean;
  estimate(goal: GoalDefinition, context: GoalContext): Promise<Result<GoalEstimate, QiError>>;
  execute(goal: GoalDefinition, context: GoalContext): AsyncGenerator<GoalEvent, GoalProgress>;
}

export interface GoalEstimate {
  timeEstimate: number; // milliseconds
  resourceEstimate: Record<string, number>;
  confidence: number; // 0-1 scale
  risks: string[];
  dependencies: string[];
}
```

## Goal Manager Implementation

### manager/GoalManager.ts

```typescript
import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { 
  GoalDefinition, 
  GoalProgress, 
  GoalContext, 
  GoalEvent, 
  GoalStatus,
  GoalStrategy 
} from '../types.js';
import { GoalHierarchy } from '../hierarchy/GoalHierarchy.js';
import { ProgressTracker } from '../progress/ProgressTracker.js';
import { GoalStorage } from '../storage/GoalStorage.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';
import { AgentLogger } from '../../config/logger.js';

export class GoalManager {
  private hierarchy: GoalHierarchy;
  private progressTracker: ProgressTracker;
  private storage: GoalStorage;
  private strategies: Map<string, GoalStrategy>;
  private activeGoals: Map<string, AsyncGenerator<GoalEvent, GoalProgress>>;
  private logger: AgentLogger;

  constructor(
    storage: GoalStorage,
    logger: AgentLogger
  ) {
    this.hierarchy = new GoalHierarchy();
    this.progressTracker = new ProgressTracker();
    this.storage = storage;
    this.strategies = new Map();
    this.activeGoals = new Map();
    this.logger = logger;
  }

  /**
   * Register a goal achievement strategy
   */
  registerStrategy(strategy: GoalStrategy): Result<void, QiError> {
    try {
      this.strategies.set(strategy.name, strategy);
      this.logger.debug('Goal strategy registered', { strategy: strategy.name });
      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to register goal strategy',
          { strategy: strategy.name, error }
        )
      );
    }
  }

  /**
   * Create a new goal
   */
  async createGoal(
    definition: Omit<GoalDefinition, 'id' | 'createdAt'>,
    context: GoalContext
  ): Promise<Result<GoalDefinition, QiError>> {
    try {
      const goal: GoalDefinition = {
        ...definition,
        id: `goal_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        createdAt: new Date()
      };

      // Validate goal definition
      const validationResult = await this.validateGoal(goal, context);
      if (!validationResult.success) {
        return createError(validationResult.error);
      }

      // Add to hierarchy
      const hierarchyResult = await this.hierarchy.addGoal(goal);
      if (!hierarchyResult.success) {
        return createError(hierarchyResult.error);
      }

      // Persist goal
      const storageResult = await this.storage.saveGoal(goal);
      if (!storageResult.success) {
        return createError(storageResult.error);
      }

      // Initialize progress tracking
      const progressResult = await this.progressTracker.initializeGoal(goal);
      if (!progressResult.success) {
        return createError(progressResult.error);
      }

      this.logger.info('Goal created', { 
        goalId: goal.id, 
        title: goal.title,
        agentId: context.agentId
      });

      return createResult(goal);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to create goal',
          { definition, error }
        )
      );
    }
  }

  /**
   * Start goal execution
   */
  async startGoal(
    goalId: string,
    context: GoalContext
  ): Promise<Result<AsyncGenerator<GoalEvent, GoalProgress>, QiError>> {
    try {
      if (this.activeGoals.has(goalId)) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal is already active',
            { goalId }
          )
        );
      }

      // Get goal definition
      const goalResult = await this.storage.getGoal(goalId);
      if (!goalResult.success) {
        return createError(goalResult.error);
      }
      const goal = goalResult.value;

      // Select strategy
      const strategyResult = await this.selectStrategy(goal, context);
      if (!strategyResult.success) {
        return createError(strategyResult.error);
      }
      const strategy = strategyResult.value;

      // Create execution generator
      const executor = this.createGoalExecutor(goal, context, strategy);
      this.activeGoals.set(goalId, executor);

      this.logger.info('Goal execution started', { 
        goalId, 
        strategy: strategy.name,
        agentId: context.agentId
      });

      return createResult(executor);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to start goal execution',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Stop goal execution
   */
  async stopGoal(goalId: string): Promise<Result<void, QiError>> {
    try {
      if (!this.activeGoals.has(goalId)) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal is not active',
            { goalId }
          )
        );
      }

      const executor = this.activeGoals.get(goalId)!;
      await executor.return({ 
        goalId, 
        status: GoalStatus.CANCELLED,
        progressPercentage: 0,
        completedTasks: 0,
        totalTasks: 0,
        lastUpdated: new Date(),
        checkpoints: [],
        metrics: {
          timeSpent: 0,
          resourcesUsed: {},
          efficiency: 0,
          successRate: 0,
          adaptations: 0
        }
      });

      this.activeGoals.delete(goalId);
      
      this.logger.info('Goal execution stopped', { goalId });
      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to stop goal execution',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Get goal progress
   */
  async getGoalProgress(goalId: string): Promise<Result<GoalProgress, QiError>> {
    try {
      return await this.progressTracker.getProgress(goalId);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get goal progress',
          { goalId, error }
        )
      );
    }
  }

  /**
   * List goals with optional filtering
   */
  async listGoals(filter?: {
    status?: GoalStatus;
    parentId?: string;
    agentId?: string;
  }): Promise<Result<GoalDefinition[], QiError>> {
    try {
      return await this.storage.listGoals(filter);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to list goals',
          { filter, error }
        )
      );
    }
  }

  /**
   * Update goal progress
   */
  async updateGoalProgress(
    goalId: string,
    progress: Partial<GoalProgress>
  ): Promise<Result<void, QiError>> {
    try {
      return await this.progressTracker.updateProgress(goalId, progress);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to update goal progress',
          { goalId, error }
        )
      );
    }
  }

  private async validateGoal(
    goal: GoalDefinition,
    context: GoalContext
  ): Promise<Result<void, QiError>> {
    // Validate required fields
    if (!goal.title.trim()) {
      return createError(
        createAgentError(
          AgentErrorCategory.VALIDATION,
          'Goal title is required',
          { goalId: goal.id }
        )
      );
    }

    // Validate parent goal exists
    if (goal.parentGoalId) {
      const parentResult = await this.storage.getGoal(goal.parentGoalId);
      if (!parentResult.success) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Parent goal not found',
            { goalId: goal.id, parentGoalId: goal.parentGoalId }
          )
        );
      }
    }

    // Validate dependencies exist
    if (goal.dependencies?.length) {
      for (const depId of goal.dependencies) {
        const depResult = await this.storage.getGoal(depId);
        if (!depResult.success) {
          return createError(
            createAgentError(
              AgentErrorCategory.VALIDATION,
              'Dependency goal not found',
              { goalId: goal.id, dependencyId: depId }
            )
          );
        }
      }
    }

    return createResult(undefined);
  }

  private async selectStrategy(
    goal: GoalDefinition,
    context: GoalContext
  ): Promise<Result<GoalStrategy, QiError>> {
    const availableStrategies = Array.from(this.strategies.values())
      .filter(strategy => strategy.canHandle(goal, context));

    if (availableStrategies.length === 0) {
      return createError(
        createAgentError(
          AgentErrorCategory.BUSINESS,
          'No suitable strategy found for goal',
          { goalId: goal.id }
        )
      );
    }

    // For now, select the first available strategy
    // In the future, we could implement strategy scoring/selection
    return createResult(availableStrategies[0]);
  }

  private async* createGoalExecutor(
    goal: GoalDefinition,
    context: GoalContext,
    strategy: GoalStrategy
  ): AsyncGenerator<GoalEvent, GoalProgress> {
    try {
      // Mark goal as active
      await this.progressTracker.updateProgress(goal.id, {
        status: GoalStatus.ACTIVE,
        lastUpdated: new Date()
      });

      // Execute strategy
      const executor = strategy.execute(goal, context);
      let lastProgress: GoalProgress | undefined;

      try {
        for await (const event of executor) {
          // Track progress
          if (event.type === 'progress') {
            await this.progressTracker.recordEvent(event);
          }

          yield event;

          // Check if goal is completed
          const progressResult = await this.progressTracker.getProgress(goal.id);
          if (progressResult.success) {
            lastProgress = progressResult.value;
            if (lastProgress.status === GoalStatus.COMPLETED || 
                lastProgress.status === GoalStatus.FAILED) {
              break;
            }
          }
        }

        // Get final progress
        if (!lastProgress) {
          const progressResult = await this.progressTracker.getProgress(goal.id);
          lastProgress = progressResult.success ? progressResult.value : {
            goalId: goal.id,
            status: GoalStatus.FAILED,
            progressPercentage: 0,
            completedTasks: 0,
            totalTasks: 0,
            lastUpdated: new Date(),
            checkpoints: [],
            metrics: {
              timeSpent: 0,
              resourcesUsed: {},
              efficiency: 0,
              successRate: 0,
              adaptations: 0
            }
          };
        }

        return lastProgress;

      } finally {
        this.activeGoals.delete(goal.id);
      }

    } catch (error) {
      // Mark goal as failed
      await this.progressTracker.updateProgress(goal.id, {
        status: GoalStatus.FAILED,
        lastUpdated: new Date()
      });

      this.activeGoals.delete(goal.id);
      
      throw createAgentError(
        AgentErrorCategory.SYSTEM,
        'Goal execution failed',
        { goalId: goal.id, error }
      );
    }
  }
}
```

## Goal Hierarchy Management

### hierarchy/GoalHierarchy.ts

```typescript
import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { GoalDefinition, GoalStatus } from '../types.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';

export interface GoalNode {
  goal: GoalDefinition;
  children: GoalNode[];
  parent?: GoalNode;
}

export class GoalHierarchy {
  private roots: Map<string, GoalNode>;
  private nodeIndex: Map<string, GoalNode>;

  constructor() {
    this.roots = new Map();
    this.nodeIndex = new Map();
  }

  /**
   * Add a goal to the hierarchy
   */
  async addGoal(goal: GoalDefinition): Promise<Result<void, QiError>> {
    try {
      const node: GoalNode = {
        goal,
        children: []
      };

      // Check for existing goal
      if (this.nodeIndex.has(goal.id)) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal already exists in hierarchy',
            { goalId: goal.id }
          )
        );
      }

      // Handle parent relationship
      if (goal.parentGoalId) {
        const parentNode = this.nodeIndex.get(goal.parentGoalId);
        if (!parentNode) {
          return createError(
            createAgentError(
              AgentErrorCategory.VALIDATION,
              'Parent goal not found in hierarchy',
              { goalId: goal.id, parentGoalId: goal.parentGoalId }
            )
          );
        }
        
        node.parent = parentNode;
        parentNode.children.push(node);
      } else {
        // Root goal
        this.roots.set(goal.id, node);
      }

      this.nodeIndex.set(goal.id, node);
      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to add goal to hierarchy',
          { goalId: goal.id, error }
        )
      );
    }
  }

  /**
   * Remove a goal and all its descendants
   */
  async removeGoal(goalId: string): Promise<Result<void, QiError>> {
    try {
      const node = this.nodeIndex.get(goalId);
      if (!node) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal not found in hierarchy',
            { goalId }
          )
        );
      }

      // Remove all descendants
      const toRemove = this.getDescendants(node);
      toRemove.push(node);

      for (const nodeToRemove of toRemove) {
        this.nodeIndex.delete(nodeToRemove.goal.id);
        
        if (!nodeToRemove.parent) {
          this.roots.delete(nodeToRemove.goal.id);
        }
      }

      // Update parent
      if (node.parent) {
        const index = node.parent.children.indexOf(node);
        if (index > -1) {
          node.parent.children.splice(index, 1);
        }
      }

      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to remove goal from hierarchy',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Get goal children
   */
  getChildren(goalId: string): Result<GoalDefinition[], QiError> {
    try {
      const node = this.nodeIndex.get(goalId);
      if (!node) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal not found in hierarchy',
            { goalId }
          )
        );
      }

      const children = node.children.map(child => child.goal);
      return createResult(children);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get goal children',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Get goal ancestors (path to root)
   */
  getAncestors(goalId: string): Result<GoalDefinition[], QiError> {
    try {
      const node = this.nodeIndex.get(goalId);
      if (!node) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal not found in hierarchy',
            { goalId }
          )
        );
      }

      const ancestors: GoalDefinition[] = [];
      let current = node.parent;
      
      while (current) {
        ancestors.unshift(current.goal);
        current = current.parent;
      }

      return createResult(ancestors);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get goal ancestors',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Check if goal can be started (dependencies satisfied)
   */
  canStartGoal(goalId: string, goalStatuses: Map<string, GoalStatus>): Result<boolean, QiError> {
    try {
      const node = this.nodeIndex.get(goalId);
      if (!node) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal not found in hierarchy',
            { goalId }
          )
        );
      }

      const goal = node.goal;

      // Check dependencies
      if (goal.dependencies?.length) {
        for (const depId of goal.dependencies) {
          const depStatus = goalStatuses.get(depId);
          if (depStatus !== GoalStatus.COMPLETED) {
            return createResult(false);
          }
        }
      }

      // Check parent status (parent must be active or completed)
      if (node.parent) {
        const parentStatus = goalStatuses.get(node.parent.goal.id);
        if (parentStatus !== GoalStatus.ACTIVE && parentStatus !== GoalStatus.COMPLETED) {
          return createResult(false);
        }
      }

      return createResult(true);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to check if goal can start',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Get all root goals
   */
  getRootGoals(): GoalDefinition[] {
    return Array.from(this.roots.values()).map(node => node.goal);
  }

  /**
   * Get goal tree as nested structure
   */
  getGoalTree(goalId?: string): Result<GoalNode | GoalNode[], QiError> {
    try {
      if (goalId) {
        const node = this.nodeIndex.get(goalId);
        if (!node) {
          return createError(
            createAgentError(
              AgentErrorCategory.VALIDATION,
              'Goal not found in hierarchy',
              { goalId }
            )
          );
        }
        return createResult(this.cloneNode(node));
      } else {
        const rootNodes = Array.from(this.roots.values()).map(node => this.cloneNode(node));
        return createResult(rootNodes);
      }

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get goal tree',
          { goalId, error }
        )
      );
    }
  }

  private getDescendants(node: GoalNode): GoalNode[] {
    const descendants: GoalNode[] = [];
    
    for (const child of node.children) {
      descendants.push(child);
      descendants.push(...this.getDescendants(child));
    }
    
    return descendants;
  }

  private cloneNode(node: GoalNode): GoalNode {
    return {
      goal: { ...node.goal },
      children: node.children.map(child => this.cloneNode(child))
    };
  }
}
```

## Progress Tracking Implementation

### progress/ProgressTracker.ts

```typescript
import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { GoalDefinition, GoalProgress, GoalEvent, GoalStatus, GoalCheckpoint, GoalMetrics } from '../types.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';
import { AgentLogger } from '../../config/logger.js';

export class ProgressTracker {
  private progressCache: Map<string, GoalProgress>;
  private checkpoints: Map<string, GoalCheckpoint[]>;
  private metrics: Map<string, GoalMetrics>;
  private logger: AgentLogger;

  constructor(logger: AgentLogger) {
    this.progressCache = new Map();
    this.checkpoints = new Map();
    this.metrics = new Map();
    this.logger = logger;
  }

  /**
   * Initialize tracking for a new goal
   */
  async initializeGoal(goal: GoalDefinition): Promise<Result<void, QiError>> {
    try {
      const progress: GoalProgress = {
        goalId: goal.id,
        status: GoalStatus.CREATED,
        progressPercentage: 0,
        completedTasks: 0,
        totalTasks: 1, // Default to 1 task
        lastUpdated: new Date(),
        checkpoints: [],
        metrics: {
          timeSpent: 0,
          resourcesUsed: {},
          efficiency: 0,
          successRate: 0,
          adaptations: 0
        }
      };

      this.progressCache.set(goal.id, progress);
      this.checkpoints.set(goal.id, []);
      this.metrics.set(goal.id, progress.metrics);

      this.logger.debug('Progress tracking initialized', { goalId: goal.id });
      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to initialize goal progress tracking',
          { goalId: goal.id, error }
        )
      );
    }
  }

  /**
   * Update goal progress
   */
  async updateProgress(
    goalId: string, 
    updates: Partial<GoalProgress>
  ): Promise<Result<void, QiError>> {
    try {
      const current = this.progressCache.get(goalId);
      if (!current) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal progress not found',
            { goalId }
          )
        );
      }

      const updated: GoalProgress = {
        ...current,
        ...updates,
        lastUpdated: new Date()
      };

      // Validate progress percentage
      if (updated.progressPercentage < 0 || updated.progressPercentage > 100) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Invalid progress percentage',
            { goalId, progressPercentage: updated.progressPercentage }
          )
        );
      }

      // Update cache
      this.progressCache.set(goalId, updated);

      // Log significant progress updates
      if (updates.status || (updates.progressPercentage && 
          updates.progressPercentage !== current.progressPercentage)) {
        this.logger.info('Goal progress updated', {
          goalId,
          status: updated.status,
          progress: updated.progressPercentage
        });
      }

      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to update goal progress',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Add a checkpoint to goal progress
   */
  async addCheckpoint(
    goalId: string,
    checkpoint: Omit<GoalCheckpoint, 'id' | 'goalId' | 'timestamp'>
  ): Promise<Result<GoalCheckpoint, QiError>> {
    try {
      if (!this.checkpoints.has(goalId)) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal not found for checkpoint',
            { goalId }
          )
        );
      }

      const fullCheckpoint: GoalCheckpoint = {
        ...checkpoint,
        id: `checkpoint_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
        goalId,
        timestamp: new Date()
      };

      const checkpoints = this.checkpoints.get(goalId)!;
      checkpoints.push(fullCheckpoint);

      // Update progress based on checkpoints
      const completedCheckpoints = checkpoints.filter(cp => cp.completed).length;
      const progressPercentage = checkpoints.length > 0 
        ? Math.round((completedCheckpoints / checkpoints.length) * 100)
        : 0;

      await this.updateProgress(goalId, {
        progressPercentage,
        completedTasks: completedCheckpoints,
        totalTasks: checkpoints.length
      });

      this.logger.debug('Checkpoint added', {
        goalId,
        checkpointId: fullCheckpoint.id,
        completed: fullCheckpoint.completed
      });

      return createResult(fullCheckpoint);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to add checkpoint',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Record a goal event and update metrics
   */
  async recordEvent(event: GoalEvent): Promise<Result<void, QiError>> {
    try {
      const metrics = this.metrics.get(event.goalId);
      if (!metrics) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal metrics not found',
            { goalId: event.goalId }
          )
        );
      }

      // Update metrics based on event type
      switch (event.type) {
        case 'progress':
          if (event.data.timeSpent) {
            metrics.timeSpent += Number(event.data.timeSpent);
          }
          if (event.data.resourcesUsed) {
            Object.entries(event.data.resourcesUsed as Record<string, number>)
              .forEach(([key, value]) => {
                metrics.resourcesUsed[key] = (metrics.resourcesUsed[key] || 0) + value;
              });
          }
          break;

        case 'adapted':
          metrics.adaptations++;
          break;

        case 'completed':
          metrics.successRate = 1.0;
          break;

        case 'failed':
          metrics.successRate = 0.0;
          break;
      }

      // Calculate efficiency (progress per time)
      const progress = this.progressCache.get(event.goalId);
      if (progress && metrics.timeSpent > 0) {
        metrics.efficiency = progress.progressPercentage / (metrics.timeSpent / 1000 / 60); // per minute
      }

      this.metrics.set(event.goalId, metrics);

      // Update progress with new metrics
      await this.updateProgress(event.goalId, { metrics });

      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to record goal event',
          { goalId: event.goalId, error }
        )
      );
    }
  }

  /**
   * Get goal progress
   */
  async getProgress(goalId: string): Promise<Result<GoalProgress, QiError>> {
    try {
      const progress = this.progressCache.get(goalId);
      if (!progress) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal progress not found',
            { goalId }
          )
        );
      }

      // Include current checkpoints
      const checkpoints = this.checkpoints.get(goalId) || [];
      const updatedProgress: GoalProgress = {
        ...progress,
        checkpoints: [...checkpoints]
      };

      return createResult(updatedProgress);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get goal progress',
          { goalId, error }
        )
      );
    }
  }

  /**
   * Get progress summary for multiple goals
   */
  async getProgressSummary(goalIds: string[]): Promise<Result<Map<string, GoalProgress>, QiError>> {
    try {
      const summary = new Map<string, GoalProgress>();

      for (const goalId of goalIds) {
        const progressResult = await this.getProgress(goalId);
        if (progressResult.success) {
          summary.set(goalId, progressResult.value);
        }
      }

      return createResult(summary);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get progress summary',
          { goalIds, error }
        )
      );
    }
  }

  /**
   * Clean up completed or failed goals from cache
   */
  async cleanup(retentionHours: number = 24): Promise<Result<number, QiError>> {
    try {
      let cleanedCount = 0;
      const cutoffTime = new Date(Date.now() - (retentionHours * 60 * 60 * 1000));

      for (const [goalId, progress] of this.progressCache.entries()) {
        if ((progress.status === GoalStatus.COMPLETED || 
             progress.status === GoalStatus.FAILED || 
             progress.status === GoalStatus.CANCELLED) &&
            progress.lastUpdated < cutoffTime) {
          
          this.progressCache.delete(goalId);
          this.checkpoints.delete(goalId);
          this.metrics.delete(goalId);
          cleanedCount++;
        }
      }

      this.logger.info('Progress cache cleaned', { cleanedCount, retentionHours });
      return createResult(cleanedCount);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to cleanup progress cache',
          { error }
        )
      );
    }
  }
}
```

## Goal Strategies

### strategies/SequentialStrategy.ts

```typescript
import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { 
  GoalDefinition, 
  GoalContext, 
  GoalEvent, 
  GoalProgress, 
  GoalStatus, 
  GoalStrategy,
  GoalEstimate 
} from '../types.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';

export class SequentialGoalStrategy implements GoalStrategy {
  name = 'sequential';

  canHandle(goal: GoalDefinition, context: GoalContext): boolean {
    // Can handle any goal, but best for goals with dependencies
    return true;
  }

  async estimate(
    goal: GoalDefinition, 
    context: GoalContext
  ): Promise<Result<GoalEstimate, QiError>> {
    try {
      // Basic estimation - in a real implementation, this would be more sophisticated
      const baseTime = 300000; // 5 minutes base
      const complexityMultiplier = goal.description.length > 100 ? 2 : 1;
      const dependencyMultiplier = (goal.dependencies?.length || 0) + 1;

      const estimate: GoalEstimate = {
        timeEstimate: baseTime * complexityMultiplier * dependencyMultiplier,
        resourceEstimate: {
          cpu: 0.5,
          memory: 100,
          network: 10
        },
        confidence: 0.7,
        risks: [
          'Dependencies may not be available',
          'External resources may be slow'
        ],
        dependencies: goal.dependencies || []
      };

      return createResult(estimate);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to estimate goal execution',
          { goalId: goal.id, error }
        )
      );
    }
  }

  async* execute(
    goal: GoalDefinition, 
    context: GoalContext
  ): AsyncGenerator<GoalEvent, GoalProgress> {
    const startTime = Date.now();

    try {
      // Emit start event
      yield {
        id: `event_${Date.now()}_start`,
        goalId: goal.id,
        type: 'started',
        timestamp: new Date(),
        data: { strategy: this.name },
        agentId: context.agentId
      };

      // Break goal into sequential steps
      const steps = this.decomposeGoal(goal);
      let completedSteps = 0;

      for (const step of steps) {
        // Execute step
        const stepResult = await this.executeStep(step, goal, context);
        
        if (!stepResult.success) {
          yield {
            id: `event_${Date.now()}_failed`,
            goalId: goal.id,
            type: 'failed',
            timestamp: new Date(),
            data: { 
              error: stepResult.error,
              step: step.title,
              completedSteps 
            },
            agentId: context.agentId
          };

          return {
            goalId: goal.id,
            status: GoalStatus.FAILED,
            progressPercentage: Math.round((completedSteps / steps.length) * 100),
            completedTasks: completedSteps,
            totalTasks: steps.length,
            lastUpdated: new Date(),
            checkpoints: [],
            metrics: {
              timeSpent: Date.now() - startTime,
              resourcesUsed: {},
              efficiency: 0,
              successRate: 0,
              adaptations: 0
            }
          };
        }

        completedSteps++;

        // Emit progress event
        yield {
          id: `event_${Date.now()}_progress`,
          goalId: goal.id,
          type: 'progress',
          timestamp: new Date(),
          data: {
            step: step.title,
            completedSteps,
            totalSteps: steps.length,
            timeSpent: Date.now() - startTime
          },
          agentId: context.agentId
        };

        // Simulate some processing time
        await this.delay(1000);
      }

      // Emit completion event
      yield {
        id: `event_${Date.now()}_completed`,
        goalId: goal.id,
        type: 'completed',
        timestamp: new Date(),
        data: { 
          completedSteps,
          totalTime: Date.now() - startTime
        },
        agentId: context.agentId
      };

      return {
        goalId: goal.id,
        status: GoalStatus.COMPLETED,
        progressPercentage: 100,
        completedTasks: completedSteps,
        totalTasks: steps.length,
        lastUpdated: new Date(),
        checkpoints: [],
        metrics: {
          timeSpent: Date.now() - startTime,
          resourcesUsed: {
            cpu: completedSteps * 0.1,
            memory: completedSteps * 10
          },
          efficiency: 1.0,
          successRate: 1.0,
          adaptations: 0
        }
      };

    } catch (error) {
      yield {
        id: `event_${Date.now()}_error`,
        goalId: goal.id,
        type: 'failed',
        timestamp: new Date(),
        data: { error },
        agentId: context.agentId
      };

      return {
        goalId: goal.id,
        status: GoalStatus.FAILED,
        progressPercentage: 0,
        completedTasks: 0,
        totalTasks: 1,
        lastUpdated: new Date(),
        checkpoints: [],
        metrics: {
          timeSpent: Date.now() - startTime,
          resourcesUsed: {},
          efficiency: 0,
          successRate: 0,
          adaptations: 0
        }
      };
    }
  }

  private decomposeGoal(goal: GoalDefinition): { title: string; description: string }[] {
    // Simple decomposition - in practice this would be more sophisticated
    const words = goal.description.split(' ');
    const chunkSize = Math.max(5, Math.floor(words.length / 3));
    
    const steps: { title: string; description: string }[] = [];
    
    for (let i = 0; i < words.length; i += chunkSize) {
      const chunk = words.slice(i, i + chunkSize);
      steps.push({
        title: `Step ${steps.length + 1}`,
        description: chunk.join(' ')
      });
    }

    return steps.length > 0 ? steps : [{ title: 'Execute', description: goal.description }];
  }

  private async executeStep(
    step: { title: string; description: string },
    goal: GoalDefinition,
    context: GoalContext
  ): Promise<Result<void, QiError>> {
    try {
      // Simulate step execution
      // In a real implementation, this would call appropriate tools/agents
      
      // Random failure for demonstration
      if (Math.random() < 0.05) { // 5% failure rate
        return createError(
          createAgentError(
            AgentErrorCategory.BUSINESS,
            'Step execution failed',
            { step: step.title, goalId: goal.id }
          )
        );
      }

      return createResult(undefined);

    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Error during step execution',
          { step: step.title, goalId: goal.id, error }
        )
      );
    }
  }

  private delay(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}
```

## Goal Storage Implementation

### storage/GoalStorage.ts

```typescript
import { Result } from '@qi/base';
import { QiError } from '@qi/core';
import { GoalDefinition, GoalProgress, GoalEvent, GoalStatus } from '../types.js';

export interface GoalStorage {
  /**
   * Save a goal definition
   */
  saveGoal(goal: GoalDefinition): Promise<Result<void, QiError>>;

  /**
   * Get a goal by ID
   */
  getGoal(goalId: string): Promise<Result<GoalDefinition, QiError>>;

  /**
   * List goals with optional filtering
   */
  listGoals(filter?: {
    status?: GoalStatus;
    parentId?: string;
    agentId?: string;
  }): Promise<Result<GoalDefinition[], QiError>>;

  /**
   * Update a goal
   */
  updateGoal(goalId: string, updates: Partial<GoalDefinition>): Promise<Result<void, QiError>>;

  /**
   * Delete a goal
   */
  deleteGoal(goalId: string): Promise<Result<void, QiError>>;

  /**
   * Save goal progress
   */
  saveProgress(progress: GoalProgress): Promise<Result<void, QiError>>;

  /**
   * Get goal progress
   */
  getProgress(goalId: string): Promise<Result<GoalProgress, QiError>>;

  /**
   * Save goal event
   */
  saveEvent(event: GoalEvent): Promise<Result<void, QiError>>;

  /**
   * Get goal events
   */
  getEvents(goalId: string, limit?: number): Promise<Result<GoalEvent[], QiError>>;
}
```

### storage/FileGoalStorage.ts

```typescript
import { Result, createResult, createError } from '@qi/base';
import { QiError } from '@qi/core';
import { promises as fs } from 'fs';
import path from 'path';
import { GoalDefinition, GoalProgress, GoalEvent, GoalStatus } from '../types.js';
import { GoalStorage } from './GoalStorage.js';
import { createAgentError, AgentErrorCategory } from '../../config/errors.js';
import { AgentLogger } from '../../config/logger.js';

export class FileGoalStorage implements GoalStorage {
  private storageDir: string;
  private logger: AgentLogger;

  constructor(storageDir: string, logger: AgentLogger) {
    this.storageDir = storageDir;
    this.logger = logger;
  }

  async initialize(): Promise<Result<void, QiError>> {
    try {
      await fs.mkdir(this.storageDir, { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'goals'), { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'progress'), { recursive: true });
      await fs.mkdir(path.join(this.storageDir, 'events'), { recursive: true });
      
      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to initialize goal storage',
          { storageDir: this.storageDir, error }
        )
      );
    }
  }

  async saveGoal(goal: GoalDefinition): Promise<Result<void, QiError>> {
    try {
      const goalPath = path.join(this.storageDir, 'goals', `${goal.id}.json`);
      await fs.writeFile(goalPath, JSON.stringify(goal, null, 2));
      
      this.logger.debug('Goal saved to storage', { goalId: goal.id });
      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to save goal to storage',
          { goalId: goal.id, error }
        )
      );
    }
  }

  async getGoal(goalId: string): Promise<Result<GoalDefinition, QiError>> {
    try {
      const goalPath = path.join(this.storageDir, 'goals', `${goalId}.json`);
      
      try {
        const goalData = await fs.readFile(goalPath, 'utf8');
        const goal = JSON.parse(goalData) as GoalDefinition;
        
        // Convert date strings back to Date objects
        goal.createdAt = new Date(goal.createdAt);
        if (goal.dueDate) {
          goal.dueDate = new Date(goal.dueDate);
        }
        
        return createResult(goal);
      } catch (readError) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Goal not found',
            { goalId }
          )
        );
      }
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get goal from storage',
          { goalId, error }
        )
      );
    }
  }

  async listGoals(filter?: {
    status?: GoalStatus;
    parentId?: string;
    agentId?: string;
  }): Promise<Result<GoalDefinition[], QiError>> {
    try {
      const goalsDir = path.join(this.storageDir, 'goals');
      
      try {
        const files = await fs.readdir(goalsDir);
        const goals: GoalDefinition[] = [];

        for (const file of files) {
          if (!file.endsWith('.json')) continue;

          const goalPath = path.join(goalsDir, file);
          const goalData = await fs.readFile(goalPath, 'utf8');
          const goal = JSON.parse(goalData) as GoalDefinition;
          
          // Convert date strings back to Date objects
          goal.createdAt = new Date(goal.createdAt);
          if (goal.dueDate) {
            goal.dueDate = new Date(goal.dueDate);
          }

          // Apply filters
          if (filter?.parentId && goal.parentGoalId !== filter.parentId) continue;
          // Note: status and agentId filtering would require progress data

          goals.push(goal);
        }

        return createResult(goals);
      } catch (readError) {
        // Directory doesn't exist yet
        return createResult([]);
      }
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to list goals from storage',
          { filter, error }
        )
      );
    }
  }

  async updateGoal(goalId: string, updates: Partial<GoalDefinition>): Promise<Result<void, QiError>> {
    try {
      const goalResult = await this.getGoal(goalId);
      if (!goalResult.success) {
        return createError(goalResult.error);
      }

      const updatedGoal = { ...goalResult.value, ...updates };
      return await this.saveGoal(updatedGoal);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to update goal in storage',
          { goalId, error }
        )
      );
    }
  }

  async deleteGoal(goalId: string): Promise<Result<void, QiError>> {
    try {
      const goalPath = path.join(this.storageDir, 'goals', `${goalId}.json`);
      await fs.unlink(goalPath);
      
      this.logger.debug('Goal deleted from storage', { goalId });
      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to delete goal from storage',
          { goalId, error }
        )
      );
    }
  }

  async saveProgress(progress: GoalProgress): Promise<Result<void, QiError>> {
    try {
      const progressPath = path.join(this.storageDir, 'progress', `${progress.goalId}.json`);
      await fs.writeFile(progressPath, JSON.stringify(progress, null, 2));
      
      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to save progress to storage',
          { goalId: progress.goalId, error }
        )
      );
    }
  }

  async getProgress(goalId: string): Promise<Result<GoalProgress, QiError>> {
    try {
      const progressPath = path.join(this.storageDir, 'progress', `${goalId}.json`);
      
      try {
        const progressData = await fs.readFile(progressPath, 'utf8');
        const progress = JSON.parse(progressData) as GoalProgress;
        
        // Convert date strings back to Date objects
        progress.lastUpdated = new Date(progress.lastUpdated);
        progress.checkpoints = progress.checkpoints.map(cp => ({
          ...cp,
          timestamp: new Date(cp.timestamp)
        }));
        
        return createResult(progress);
      } catch (readError) {
        return createError(
          createAgentError(
            AgentErrorCategory.VALIDATION,
            'Progress not found',
            { goalId }
          )
        );
      }
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get progress from storage',
          { goalId, error }
        )
      );
    }
  }

  async saveEvent(event: GoalEvent): Promise<Result<void, QiError>> {
    try {
      const eventsFile = path.join(this.storageDir, 'events', `${event.goalId}.json`);
      
      let events: GoalEvent[] = [];
      try {
        const eventsData = await fs.readFile(eventsFile, 'utf8');
        events = JSON.parse(eventsData);
      } catch {
        // File doesn't exist, start with empty array
      }

      events.push(event);
      await fs.writeFile(eventsFile, JSON.stringify(events, null, 2));
      
      return createResult(undefined);
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to save event to storage',
          { goalId: event.goalId, error }
        )
      );
    }
  }

  async getEvents(goalId: string, limit?: number): Promise<Result<GoalEvent[], QiError>> {
    try {
      const eventsFile = path.join(this.storageDir, 'events', `${goalId}.json`);
      
      try {
        const eventsData = await fs.readFile(eventsFile, 'utf8');
        let events = JSON.parse(eventsData) as GoalEvent[];
        
        // Convert date strings back to Date objects
        events = events.map(event => ({
          ...event,
          timestamp: new Date(event.timestamp)
        }));

        // Sort by timestamp (newest first)
        events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

        // Apply limit
        if (limit && limit > 0) {
          events = events.slice(0, limit);
        }

        return createResult(events);
      } catch (readError) {
        // File doesn't exist yet
        return createResult([]);
      }
    } catch (error) {
      return createError(
        createAgentError(
          AgentErrorCategory.SYSTEM,
          'Failed to get events from storage',
          { goalId, error }
        )
      );
    }
  }
}
```

## Testing Framework

### __tests__/GoalManager.test.ts

```typescript
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { GoalManager } from '../manager/GoalManager.js';
import { FileGoalStorage } from '../storage/FileGoalStorage.js';
import { SequentialGoalStrategy } from '../strategies/SequentialStrategy.js';
import { GoalPriority, GoalStatus } from '../types.js';
import { AgentLogger } from '../../config/logger.js';
import { tmpdir } from 'os';
import { join } from 'path';
import { promises as fs } from 'fs';

describe('GoalManager', () => {
  let goalManager: GoalManager;
  let storage: FileGoalStorage;
  let logger: AgentLogger;
  let tempDir: string;

  beforeEach(async () => {
    tempDir = join(tmpdir(), `goal-test-${Date.now()}`);
    logger = new AgentLogger({ level: 'debug' });
    storage = new FileGoalStorage(tempDir, logger);
    
    const initResult = await storage.initialize();
    expect(initResult.success).toBe(true);

    goalManager = new GoalManager(storage, logger);
    
    // Register test strategy
    const strategy = new SequentialGoalStrategy();
    const registerResult = goalManager.registerStrategy(strategy);
    expect(registerResult.success).toBe(true);
  });

  afterEach(async () => {
    try {
      await fs.rm(tempDir, { recursive: true, force: true });
    } catch {
      // Ignore cleanup errors
    }
  });

  it('should create a new goal', async () => {
    const definition = {
      title: 'Test Goal',
      description: 'A test goal for unit testing',
      priority: GoalPriority.NORMAL,
      metadata: { test: true }
    };

    const context = {
      agentId: 'test-agent',
      sessionId: 'test-session',
      environment: {},
      constraints: [],
      resources: []
    };

    const result = await goalManager.createGoal(definition, context);
    expect(result.success).toBe(true);
    
    if (result.success) {
      const goal = result.value;
      expect(goal.title).toBe(definition.title);
      expect(goal.id).toBeDefined();
      expect(goal.createdAt).toBeInstanceOf(Date);
    }
  });

  it('should start and execute a goal', async () => {
    // Create a goal first
    const definition = {
      title: 'Executable Goal',
      description: 'A goal that can be executed',
      priority: GoalPriority.HIGH,
      metadata: {}
    };

    const context = {
      agentId: 'test-agent',
      sessionId: 'test-session',
      environment: {},
      constraints: [],
      resources: []
    };

    const createResult = await goalManager.createGoal(definition, context);
    expect(createResult.success).toBe(true);
    
    if (!createResult.success) return;
    const goal = createResult.value;

    // Start execution
    const startResult = await goalManager.startGoal(goal.id, context);
    expect(startResult.success).toBe(true);

    if (!startResult.success) return;
    const executor = startResult.value;

    // Collect events
    const events = [];
    for await (const event of executor) {
      events.push(event);
      
      // Break after a few events to avoid infinite loop
      if (events.length >= 5) {
        await goalManager.stopGoal(goal.id);
        break;
      }
    }

    expect(events.length).toBeGreaterThan(0);
    expect(events[0].type).toBe('started');
  }, 15000);

  it('should track goal progress', async () => {
    const definition = {
      title: 'Progress Goal',
      description: 'A goal to test progress tracking',
      priority: GoalPriority.NORMAL,
      metadata: {}
    };

    const context = {
      agentId: 'test-agent',
      sessionId: 'test-session',
      environment: {},
      constraints: [],
      resources: []
    };

    const createResult = await goalManager.createGoal(definition, context);
    expect(createResult.success).toBe(true);
    
    if (!createResult.success) return;
    const goal = createResult.value;

    // Get initial progress
    const progressResult = await goalManager.getGoalProgress(goal.id);
    expect(progressResult.success).toBe(true);
    
    if (progressResult.success) {
      const progress = progressResult.value;
      expect(progress.goalId).toBe(goal.id);
      expect(progress.status).toBe(GoalStatus.CREATED);
      expect(progress.progressPercentage).toBe(0);
    }
  });

  it('should list goals', async () => {
    // Create multiple goals
    const goals = [];
    for (let i = 0; i < 3; i++) {
      const definition = {
        title: `Goal ${i + 1}`,
        description: `Description for goal ${i + 1}`,
        priority: GoalPriority.NORMAL,
        metadata: { index: i }
      };

      const context = {
        agentId: 'test-agent',
        sessionId: 'test-session',
        environment: {},
        constraints: [],
        resources: []
      };

      const result = await goalManager.createGoal(definition, context);
      expect(result.success).toBe(true);
      
      if (result.success) {
        goals.push(result.value);
      }
    }

    // List all goals
    const listResult = await goalManager.listGoals();
    expect(listResult.success).toBe(true);
    
    if (listResult.success) {
      const listedGoals = listResult.value;
      expect(listedGoals.length).toBe(3);
      expect(listedGoals.map(g => g.title)).toContain('Goal 1');
      expect(listedGoals.map(g => g.title)).toContain('Goal 2');
      expect(listedGoals.map(g => g.title)).toContain('Goal 3');
    }
  });

  it('should handle goal validation errors', async () => {
    const definition = {
      title: '', // Empty title should fail validation
      description: 'A goal with empty title',
      priority: GoalPriority.NORMAL,
      metadata: {}
    };

    const context = {
      agentId: 'test-agent',
      sessionId: 'test-session',
      environment: {},
      constraints: [],
      resources: []
    };

    const result = await goalManager.createGoal(definition, context);
    expect(result.success).toBe(false);
    
    if (!result.success) {
      expect(result.error.category).toBe('VALIDATION');
    }
  });
});
```

## Integration Guide

### Integration with v-0.10.2 Multi-Agent Coordination

```typescript
// In CoordinationExecutionEngine, goals can drive task distribution
export class GoalDrivenCoordination {
  constructor(
    private goalManager: GoalManager,
    private coordinationEngine: CoordinationExecutionEngine
  ) {}

  async executeGoalWithAgents(
    goalId: string,
    context: GoalContext
  ): Promise<Result<GoalProgress, QiError>> {
    // Get goal definition
    const goalResult = await this.goalManager.getGoalProgress(goalId);
    if (!goalResult.success) return createError(goalResult.error);

    // Decompose goal into tasks for agents
    const tasks: TaskPlan[] = this.decomposeGoalToTasks(goalResult.value);
    
    // Execute using coordination engine
    return await this.coordinationEngine.executeTaskPlan({
      id: `goal_plan_${goalId}`,
      tasks,
      strategy: 'adaptive',
      constraints: context.constraints,
      metadata: { goalId }
    }, context);
  }

  private decomposeGoalToTasks(goal: GoalProgress): TaskPlan[] {
    // Implementation would analyze goal and create appropriate tasks
    return [];
  }
}
```

## Performance Targets

### Success Criteria for v-0.10.3

1. **Goal Creation Performance**
   - Goal creation: < 50ms average
   - Goal validation: < 20ms average
   - Storage persistence: < 100ms average

2. **Goal Execution Performance**  
   - Strategy selection: < 30ms average
   - Event processing: < 10ms per event
   - Progress updates: < 25ms average

3. **Storage Performance**
   - Goal retrieval: < 50ms average
   - Progress queries: < 30ms average
   - Event queries: < 40ms average

4. **Memory Usage**
   - Goal cache: < 10MB for 1000 goals
   - Progress tracking: < 5MB for 1000 active goals
   - Event storage: Configurable retention

5. **Reliability Targets**
   - Goal persistence: 99.9% success rate
   - Progress accuracy: 100% consistency
   - Event ordering: Guaranteed chronological order

### Testing Requirements

- ✅ Unit tests for all goal management components
- ✅ Integration tests with storage systems
- ✅ Performance benchmarks for key operations
- ✅ Concurrency tests for multi-goal scenarios
- ✅ Error handling and recovery tests

### Quality Gates

- All tests pass with > 95% code coverage
- Performance targets met under load testing
- No memory leaks in long-running goal scenarios
- Proper error categorization and handling
- Complete documentation and examples

## Next Steps: v-0.10.4

With goal management complete, v-0.10.4 will implement:
- Learning system integration with goal outcomes
- Adaptive goal strategies based on historical performance  
- Goal recommendation engine
- Advanced goal analytics and insights
- Integration with external planning systems

The goal management system provides the foundation for intelligent, persistent agent behavior that can track progress, adapt to changing conditions, and learn from experience.