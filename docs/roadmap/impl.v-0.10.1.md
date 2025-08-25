# qi-v2-agent v-0.10.1 Implementation Guide
## Basic Decision Engine

**Document Version**: 1.0  
**Date**: 2025-01-23  
**Status**: Implementation Specification  
**Classification**: Decision Making Foundation  

## Executive Summary

This document provides the implementation specification for qi-v2-agent v-0.10.1, building on the v-0.10.0 foundation to add basic decision-making capabilities. This implementation focuses on structured task planning, simple reasoning workflows, and integration with the existing v-0.9.x Enhanced Workflow System.

## Prerequisites

- ✅ v-0.10.0: QiCore Foundation & Basic Agent Structure
- ✅ v-0.9.x: Enhanced Workflow System with intelligent pattern selection
- ✅ Proper Result<T, QiError> patterns and error handling established

## Architecture Overview

### Decision Engine Strategy

**Core Philosophy**: Build decision-making capabilities incrementally, starting with structured planning and basic reasoning before adding complex AI algorithms.

```typescript
// Decision Flow Pattern: All decisions return structured results
type DecisionOperation<T> = Promise<Result<DecisionResult<T>, QiError>>;

// Basic decision result structure
interface DecisionResult<T> {
  decision: T;
  confidence: number; // 0.0 - 1.0
  reasoning: string[];
  alternatives: Alternative<T>[];
  executionPlan?: ExecutionPlan;
  metadata: DecisionMetadata;
}
```

### Integration with Enhanced Workflow System

The decision engine leverages the existing v-0.9.x workflow patterns (ReAct, ReWOO, ADaPT) for execution while adding planning and reasoning capabilities.

## Module 1: Decision Engine Abstractions

### Core Decision Interfaces

```typescript
// lib/src/agent/decision/abstractions/IDecisionEngine.ts
import type { Result, QiError } from '@qi/base';
import type { AgentContext } from '../../abstractions/IAgent';
import type { WorkflowPattern } from '../../../workflow/abstractions/IWorkflowOrchestrator';

// Basic decision context
export interface DecisionContext {
  objective: string;
  constraints: Constraint[];
  availableResources: Resource[];
  timeLimit?: number;
  priorityLevel: 'low' | 'medium' | 'high' | 'critical';
  metadata: Record<string, unknown>;
}

// Decision constraint definition
export interface Constraint {
  type: 'resource' | 'time' | 'quality' | 'security' | 'business';
  description: string;
  mandatory: boolean;
  weight: number; // 0.0 - 1.0
  parameters: Record<string, unknown>;
}

// Available resource definition
export interface Resource {
  type: 'tool' | 'data' | 'service' | 'compute';
  identifier: string;
  availability: number; // 0.0 - 1.0
  cost: number;
  capabilities: string[];
  metadata: Record<string, unknown>;
}

// Task plan structure
export interface TaskPlan {
  id: string;
  objective: string;
  strategy: PlanningStrategy;
  phases: PlanPhase[];
  dependencies: PhaseDependency[];
  estimatedDuration: number;
  successCriteria: SuccessCriterion[];
  riskFactors: RiskFactor[];
  contingencies: ContingencyPlan[];
}

// Planning phase definition
export interface PlanPhase {
  id: string;
  name: string;
  description: string;
  workflowPattern: WorkflowPattern;
  inputs: PhaseInput[];
  outputs: PhaseOutput[];
  estimatedDuration: number;
  resources: Resource[];
  successCriteria: SuccessCriterion[];
  priority: number;
}

// Decision engine interface
export interface IDecisionEngine {
  // Task planning capabilities
  planTask(
    objective: string,
    context: DecisionContext,
    agentContext: AgentContext
  ): Promise<Result<DecisionResult<TaskPlan>, QiError>>;
  
  // Decision validation
  validatePlan(
    plan: TaskPlan,
    context: DecisionContext
  ): Promise<Result<ValidationResult, QiError>>;
  
  // Plan optimization
  optimizePlan(
    plan: TaskPlan,
    optimizationCriteria: OptimizationCriteria
  ): Promise<Result<DecisionResult<TaskPlan>, QiError>>;
  
  // Simple reasoning
  analyzeObjective(
    objective: string,
    context: DecisionContext
  ): Promise<Result<ObjectiveAnalysis, QiError>>;
  
  // Strategy selection
  selectPlanningStrategy(
    analysis: ObjectiveAnalysis,
    availableStrategies: PlanningStrategy[]
  ): Promise<Result<DecisionResult<PlanningStrategy>, QiError>>;
}

// Supporting interfaces
export interface Alternative<T> {
  option: T;
  confidence: number;
  pros: string[];
  cons: string[];
  estimatedOutcome: string;
}

export interface DecisionMetadata {
  decisionTime: Date;
  processingTimeMs: number;
  strategiesConsidered: number;
  dataSourcesUsed: string[];
  confidenceFactors: string[];
}

export interface ValidationResult {
  valid: boolean;
  issues: ValidationIssue[];
  suggestions: string[];
  riskAssessment: RiskAssessment;
}

export interface ValidationIssue {
  severity: 'error' | 'warning' | 'info';
  category: string;
  description: string;
  suggestion?: string;
}

export interface ObjectiveAnalysis {
  complexity: 'simple' | 'moderate' | 'complex' | 'very-complex';
  domain: string[];
  requiredCapabilities: string[];
  estimatedEffort: number;
  riskLevel: 'low' | 'medium' | 'high' | 'very-high';
  successFactors: string[];
  potentialChallenges: string[];
}

export interface PlanningStrategy {
  name: string;
  description: string;
  applicability: ApplicabilityCriteria;
  phases: PlanPhaseTemplate[];
  successCriteria: SuccessCriterion[];
  riskMitigation: RiskMitigation[];
  expectedEffectiveness: number; // 0.0 - 1.0
}

export interface OptimizationCriteria {
  optimizeFor: 'speed' | 'quality' | 'cost' | 'reliability' | 'balanced';
  constraints: Constraint[];
  weights: Record<string, number>;
}
```

## Module 2: Basic Decision Engine Implementation

### Core Decision Engine

```typescript
// lib/src/agent/decision/impl/BasicDecisionEngine.ts
import { success, failure, flatMap, map, match } from '@qi/base';
import { createAgentError } from '../../errors/AgentErrorSystem';
import { AgentLogger } from '../../logging/AgentLogger';
import type { 
  IDecisionEngine,
  DecisionContext,
  DecisionResult,
  TaskPlan,
  ObjectiveAnalysis,
  PlanningStrategy,
  ValidationResult,
  OptimizationCriteria
} from '../abstractions/IDecisionEngine';
import type { Result, QiError } from '@qi/base';
import type { AgentContext } from '../../abstractions/IAgent';
import type { IWorkflowOrchestrator } from '../../../workflow/abstractions/IWorkflowOrchestrator';

export class BasicDecisionEngine implements IDecisionEngine {
  private logger: AgentLogger;
  private workflowOrchestrator: IWorkflowOrchestrator;
  private planningStrategies: PlanningStrategy[];

  constructor(
    agentId: string,
    workflowOrchestrator: IWorkflowOrchestrator
  ) {
    this.logger = new AgentLogger(agentId, 'BasicDecisionEngine');
    this.workflowOrchestrator = workflowOrchestrator;
    this.planningStrategies = this.initializePlanningStrategies();
  }

  async planTask(
    objective: string,
    context: DecisionContext,
    agentContext: AgentContext
  ): Promise<Result<DecisionResult<TaskPlan>, QiError>> {
    const startTime = Date.now();
    const operationId = `plan-${Date.now()}`;

    try {
      this.logger.logInfo('Starting task planning', 
        this.logger.createMetadata()
          .operation('planTask')
          .execution(operationId)
          .custom('objective', objective)
          .custom('priority', context.priorityLevel)
          .build()
      );

      // Step 1: Analyze the objective
      const analysisResult = await this.analyzeObjective(objective, context);
      if (analysisResult.tag === 'failure') {
        return failure(analysisResult.error);
      }
      const analysis = analysisResult.value;

      // Step 2: Select optimal planning strategy
      const strategyResult = await this.selectPlanningStrategy(analysis, this.planningStrategies);
      if (strategyResult.tag === 'failure') {
        return failure(strategyResult.error);
      }
      const strategyDecision = strategyResult.value;

      // Step 3: Generate detailed task plan
      const planResult = await this.generateTaskPlan(
        objective,
        context,
        analysis,
        strategyDecision.decision
      );
      
      return flatMap(
        (plan: TaskPlan) => {
          const processingTime = Date.now() - startTime;
          
          // Create decision result
          const decisionResult: DecisionResult<TaskPlan> = {
            decision: plan,
            confidence: this.calculatePlanConfidence(plan, analysis),
            reasoning: this.generatePlanningReasoning(analysis, strategyDecision.decision, plan),
            alternatives: this.generatePlanAlternatives(objective, context, analysis),
            executionPlan: this.createExecutionPlan(plan),
            metadata: {
              decisionTime: new Date(),
              processingTimeMs: processingTime,
              strategiesConsidered: this.planningStrategies.length,
              dataSourcesUsed: ['objective-analysis', 'strategy-selection', 'workflow-patterns'],
              confidenceFactors: [
                'strategy-match',
                'resource-availability',
                'complexity-assessment'
              ]
            }
          };

          this.logger.logPerformance('planTask', processingTime, true, {
            executionId: operationId,
            planId: plan.id,
            strategyUsed: strategyDecision.decision.name,
            confidence: decisionResult.confidence
          });

          return success(decisionResult);
        },
        planResult
      );

    } catch (error) {
      const processingTime = Date.now() - startTime;
      
      this.logger.logError('Task planning failed unexpectedly', 
        this.logger.createMetadata()
          .operation('planTask')
          .execution(operationId)
          .performance(processingTime)
          .custom('error', error instanceof Error ? error.message : String(error))
          .build()
      );

      return failure(createAgentError.system(
        `Task planning failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'planTask',
          componentId: 'BasicDecisionEngine',
          recoverable: true,
          retryable: true,
          metadata: {
            operationId,
            objective,
            processingTime,
            originalError: error instanceof Error ? error.stack : String(error)
          }
        }
      ));
    }
  }

  async analyzeObjective(
    objective: string,
    context: DecisionContext
  ): Promise<Result<ObjectiveAnalysis, QiError>> {
    try {
      this.logger.logDebug('Analyzing objective', 
        this.logger.createMetadata()
          .operation('analyzeObjective')
          .custom('objective', objective)
          .build()
      );

      // Basic objective analysis using heuristics
      const complexity = this.assessComplexity(objective, context);
      const domain = this.identifyDomain(objective);
      const requiredCapabilities = this.identifyRequiredCapabilities(objective, context);
      const estimatedEffort = this.estimateEffort(objective, complexity, context);
      const riskLevel = this.assessRiskLevel(objective, context, complexity);

      const analysis: ObjectiveAnalysis = {
        complexity,
        domain,
        requiredCapabilities,
        estimatedEffort,
        riskLevel,
        successFactors: this.identifySuccessFactors(objective, context),
        potentialChallenges: this.identifyPotentialChallenges(objective, context)
      };

      return success(analysis);

    } catch (error) {
      return failure(createAgentError.system(
        `Objective analysis failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'analyzeObjective',
          componentId: 'BasicDecisionEngine',
          metadata: { objective, originalError: error }
        }
      ));
    }
  }

  async selectPlanningStrategy(
    analysis: ObjectiveAnalysis,
    availableStrategies: PlanningStrategy[]
  ): Promise<Result<DecisionResult<PlanningStrategy>, QiError>> {
    try {
      // Score each strategy based on the objective analysis
      const strategyScores = availableStrategies.map(strategy => ({
        strategy,
        score: this.scorePlanningStrategy(strategy, analysis)
      }));

      // Sort by score (descending)
      strategyScores.sort((a, b) => b.score - a.score);

      if (strategyScores.length === 0) {
        return failure(createAgentError.business(
          'No planning strategies available',
          {
            operation: 'selectPlanningStrategy',
            componentId: 'BasicDecisionEngine'
          }
        ));
      }

      const bestStrategy = strategyScores[0];
      
      // Generate alternatives
      const alternatives = strategyScores.slice(1, 4).map(scored => ({
        option: scored.strategy,
        confidence: scored.score,
        pros: this.getStrategyPros(scored.strategy, analysis),
        cons: this.getStrategyCons(scored.strategy, analysis),
        estimatedOutcome: `Expected effectiveness: ${(scored.score * 100).toFixed(1)}%`
      }));

      const decisionResult: DecisionResult<PlanningStrategy> = {
        decision: bestStrategy.strategy,
        confidence: bestStrategy.score,
        reasoning: this.generateStrategySelectionReasoning(bestStrategy.strategy, analysis),
        alternatives,
        metadata: {
          decisionTime: new Date(),
          processingTimeMs: 0,
          strategiesConsidered: availableStrategies.length,
          dataSourcesUsed: ['objective-analysis', 'strategy-scoring'],
          confidenceFactors: ['complexity-match', 'capability-alignment', 'risk-appropriateness']
        }
      };

      return success(decisionResult);

    } catch (error) {
      return failure(createAgentError.system(
        `Strategy selection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'selectPlanningStrategy',
          componentId: 'BasicDecisionEngine',
          metadata: { analysis, availableStrategiesCount: availableStrategies.length }
        }
      ));
    }
  }

  async validatePlan(
    plan: TaskPlan,
    context: DecisionContext
  ): Promise<Result<ValidationResult, QiError>> {
    try {
      const issues: ValidationIssue[] = [];
      
      // Validate plan structure
      if (!plan.phases || plan.phases.length === 0) {
        issues.push({
          severity: 'error',
          category: 'structure',
          description: 'Plan must contain at least one phase',
          suggestion: 'Add execution phases to the plan'
        });
      }

      // Validate dependencies
      const dependencyIssues = this.validateDependencies(plan);
      issues.push(...dependencyIssues);

      // Validate resource requirements
      const resourceIssues = this.validateResourceRequirements(plan, context);
      issues.push(...resourceIssues);

      // Validate time constraints
      const timeIssues = this.validateTimeConstraints(plan, context);
      issues.push(...timeIssues);

      // Generate suggestions
      const suggestions = this.generatePlanSuggestions(plan, context);

      // Assess overall risk
      const riskAssessment = this.assessPlanRisk(plan, context);

      const validationResult: ValidationResult = {
        valid: issues.filter(i => i.severity === 'error').length === 0,
        issues,
        suggestions,
        riskAssessment
      };

      return success(validationResult);

    } catch (error) {
      return failure(createAgentError.system(
        `Plan validation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'validatePlan',
          componentId: 'BasicDecisionEngine',
          metadata: { planId: plan.id }
        }
      ));
    }
  }

  async optimizePlan(
    plan: TaskPlan,
    criteria: OptimizationCriteria
  ): Promise<Result<DecisionResult<TaskPlan>, QiError>> {
    try {
      // Create optimized copy of plan
      let optimizedPlan: TaskPlan = JSON.parse(JSON.stringify(plan));
      const optimizations: string[] = [];

      // Apply optimization strategies based on criteria
      switch (criteria.optimizeFor) {
        case 'speed':
          optimizedPlan = this.optimizeForSpeed(optimizedPlan);
          optimizations.push('parallelized-phases', 'reduced-validation-overhead');
          break;
        
        case 'quality':
          optimizedPlan = this.optimizeForQuality(optimizedPlan);
          optimizations.push('enhanced-validation', 'additional-checkpoints');
          break;
        
        case 'cost':
          optimizedPlan = this.optimizeForCost(optimizedPlan);
          optimizations.push('resource-consolidation', 'alternative-tools');
          break;
        
        case 'reliability':
          optimizedPlan = this.optimizeForReliability(optimizedPlan);
          optimizations.push('redundant-phases', 'enhanced-error-handling');
          break;
        
        default: // balanced
          optimizedPlan = this.optimizeBalanced(optimizedPlan);
          optimizations.push('balanced-trade-offs');
          break;
      }

      const decisionResult: DecisionResult<TaskPlan> = {
        decision: optimizedPlan,
        confidence: 0.8, // Reasonable confidence for basic optimization
        reasoning: [
          `Optimized plan for ${criteria.optimizeFor}`,
          ...optimizations.map(opt => `Applied ${opt}`)
        ],
        alternatives: [], // Could generate alternative optimization approaches
        metadata: {
          decisionTime: new Date(),
          processingTimeMs: 50,
          strategiesConsidered: 1,
          dataSourcesUsed: ['original-plan', 'optimization-criteria'],
          confidenceFactors: ['optimization-type', 'plan-structure']
        }
      };

      return success(decisionResult);

    } catch (error) {
      return failure(createAgentError.system(
        `Plan optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'optimizePlan',
          componentId: 'BasicDecisionEngine',
          metadata: { planId: plan.id, criteria }
        }
      ));
    }
  }

  // Private implementation methods
  private async generateTaskPlan(
    objective: string,
    context: DecisionContext,
    analysis: ObjectiveAnalysis,
    strategy: PlanningStrategy
  ): Promise<Result<TaskPlan, QiError>> {
    try {
      const planId = `plan-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
      
      // Generate phases based on strategy and analysis
      const phases = await this.generatePlanPhases(objective, context, analysis, strategy);
      
      // Identify dependencies between phases
      const dependencies = this.identifyPhaseDependencies(phases);
      
      // Generate contingency plans
      const contingencies = this.generateContingencyPlans(phases, analysis);

      const plan: TaskPlan = {
        id: planId,
        objective,
        strategy,
        phases,
        dependencies,
        estimatedDuration: phases.reduce((sum, phase) => sum + phase.estimatedDuration, 0),
        successCriteria: strategy.successCriteria,
        riskFactors: this.identifyPlanRiskFactors(phases, analysis),
        contingencies
      };

      return success(plan);

    } catch (error) {
      return failure(createAgentError.system(
        `Failed to generate task plan: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'generateTaskPlan',
          componentId: 'BasicDecisionEngine',
          metadata: { objective, strategy: strategy.name }
        }
      ));
    }
  }

  private async generatePlanPhases(
    objective: string,
    context: DecisionContext,
    analysis: ObjectiveAnalysis,
    strategy: PlanningStrategy
  ): Promise<PlanPhase[]> {
    const phases: PlanPhase[] = [];

    // Map strategy phase templates to concrete phases
    for (let i = 0; i < strategy.phases.length; i++) {
      const template = strategy.phases[i];
      
      // Select appropriate workflow pattern based on phase requirements
      const workflowPattern = this.selectWorkflowPattern(template, analysis);
      
      const phase: PlanPhase = {
        id: `phase-${i + 1}`,
        name: template.name,
        description: template.description,
        workflowPattern,
        inputs: template.inputs || [],
        outputs: template.outputs || [],
        estimatedDuration: this.estimatePhaseDuration(template, analysis),
        resources: this.identifyPhaseResources(template, context),
        successCriteria: template.successCriteria || [],
        priority: i + 1
      };

      phases.push(phase);
    }

    return phases;
  }

  private selectWorkflowPattern(template: any, analysis: ObjectiveAnalysis): string {
    // Simple heuristics for workflow pattern selection
    if (analysis.complexity === 'simple') {
      return 'react'; // Simple reasoning and acting
    } else if (analysis.complexity === 'moderate') {
      return 'rewoo'; // Reasoning without observation for moderate complexity
    } else {
      return 'adapt'; // Adaptive planning for complex tasks
    }
  }

  private assessComplexity(objective: string, context: DecisionContext): ObjectiveAnalysis['complexity'] {
    // Simple heuristics for complexity assessment
    const indicators = {
      simple: 0,
      moderate: 0,
      complex: 0,
      veryComplex: 0
    };

    // Analyze objective text
    const words = objective.toLowerCase().split(/\s+/);
    const complexWords = ['analyze', 'optimize', 'integrate', 'coordinate', 'synthesize', 'evaluate'];
    const simpleWords = ['create', 'read', 'write', 'copy', 'move', 'delete'];

    for (const word of words) {
      if (complexWords.some(cw => word.includes(cw))) {
        indicators.complex += 1;
      } else if (simpleWords.some(sw => word.includes(sw))) {
        indicators.simple += 1;
      }
    }

    // Consider constraints
    if (context.constraints.length > 5) {
      indicators.complex += 1;
    } else if (context.constraints.length > 2) {
      indicators.moderate += 1;
    }

    // Consider time limits
    if (context.timeLimit && context.timeLimit < 60000) { // Less than 1 minute
      indicators.moderate += 1;
    }

    // Determine complexity
    if (indicators.complex >= 2) return 'complex';
    if (indicators.complex >= 1 || indicators.moderate >= 2) return 'moderate';
    return 'simple';
  }

  private identifyDomain(objective: string): string[] {
    const domains: string[] = [];
    const domainKeywords = {
      'development': ['code', 'program', 'develop', 'implement', 'debug', 'test'],
      'analysis': ['analyze', 'examine', 'investigate', 'study', 'research'],
      'automation': ['automate', 'script', 'workflow', 'process', 'execute'],
      'data': ['data', 'database', 'query', 'export', 'import', 'transform'],
      'communication': ['email', 'message', 'notify', 'report', 'document']
    };

    const objectiveLower = objective.toLowerCase();
    
    for (const [domain, keywords] of Object.entries(domainKeywords)) {
      if (keywords.some(keyword => objectiveLower.includes(keyword))) {
        domains.push(domain);
      }
    }

    return domains.length > 0 ? domains : ['general'];
  }

  private identifyRequiredCapabilities(objective: string, context: DecisionContext): string[] {
    const capabilities: string[] = [];
    const capabilityMap = {
      'file-operations': ['file', 'read', 'write', 'edit', 'create'],
      'web-operations': ['web', 'http', 'url', 'download', 'fetch'],
      'code-operations': ['code', 'program', 'debug', 'test', 'compile'],
      'data-operations': ['data', 'query', 'database', 'export', 'import'],
      'automation': ['automate', 'script', 'execute', 'run', 'process']
    };

    const objectiveLower = objective.toLowerCase();
    
    for (const [capability, keywords] of Object.entries(capabilityMap)) {
      if (keywords.some(keyword => objectiveLower.includes(keyword))) {
        capabilities.push(capability);
      }
    }

    // Add capabilities based on available resources
    for (const resource of context.availableResources) {
      if (resource.type === 'tool') {
        capabilities.push(`tool-${resource.identifier}`);
      }
    }

    return capabilities;
  }

  private estimateEffort(
    objective: string, 
    complexity: ObjectiveAnalysis['complexity'],
    context: DecisionContext
  ): number {
    // Base effort estimation (in arbitrary units)
    let effort = 1;

    switch (complexity) {
      case 'simple': effort = 1; break;
      case 'moderate': effort = 3; break;
      case 'complex': effort = 7; break;
      case 'very-complex': effort = 15; break;
    }

    // Adjust based on constraints
    effort *= (1 + context.constraints.length * 0.2);

    // Adjust based on priority (higher priority may require more careful planning)
    const priorityMultiplier = {
      'low': 0.8,
      'medium': 1.0,
      'high': 1.3,
      'critical': 1.6
    };

    effort *= priorityMultiplier[context.priorityLevel];

    return Math.round(effort * 10) / 10; // Round to 1 decimal place
  }

  private assessRiskLevel(
    objective: string,
    context: DecisionContext,
    complexity: ObjectiveAnalysis['complexity']
  ): ObjectiveAnalysis['riskLevel'] {
    let riskScore = 0;

    // Complexity contributes to risk
    switch (complexity) {
      case 'simple': riskScore += 1; break;
      case 'moderate': riskScore += 2; break;
      case 'complex': riskScore += 3; break;
      case 'very-complex': riskScore += 4; break;
    }

    // High-risk operations
    const riskKeywords = ['delete', 'remove', 'modify', 'replace', 'execute', 'run'];
    const objectiveLower = objective.toLowerCase();
    if (riskKeywords.some(keyword => objectiveLower.includes(keyword))) {
      riskScore += 2;
    }

    // Resource constraints increase risk
    if (context.availableResources.length < 3) {
      riskScore += 1;
    }

    // Time pressure increases risk
    if (context.timeLimit && context.timeLimit < 300000) { // Less than 5 minutes
      riskScore += 2;
    }

    // Map score to risk level
    if (riskScore >= 6) return 'very-high';
    if (riskScore >= 4) return 'high';
    if (riskScore >= 2) return 'medium';
    return 'low';
  }

  private identifySuccessFactors(objective: string, context: DecisionContext): string[] {
    const factors: string[] = [];
    
    // Always include basic factors
    factors.push('clear-objective-understanding');
    
    // Add context-specific factors
    if (context.availableResources.length > 0) {
      factors.push('resource-availability');
    }
    
    if (context.constraints.some(c => c.type === 'quality')) {
      factors.push('quality-validation');
    }
    
    if (context.priorityLevel === 'high' || context.priorityLevel === 'critical') {
      factors.push('priority-focus');
    }

    factors.push('systematic-execution');
    factors.push('progress-monitoring');

    return factors;
  }

  private identifyPotentialChallenges(objective: string, context: DecisionContext): string[] {
    const challenges: string[] = [];
    
    // Resource-based challenges
    if (context.availableResources.length < 2) {
      challenges.push('limited-resource-availability');
    }
    
    // Constraint-based challenges
    if (context.constraints.length > 3) {
      challenges.push('multiple-constraint-satisfaction');
    }
    
    // Time-based challenges
    if (context.timeLimit && context.timeLimit < 600000) { // Less than 10 minutes
      challenges.push('time-pressure');
    }
    
    // Complexity-based challenges
    const complexWords = ['integrate', 'coordinate', 'synthesize', 'optimize'];
    if (complexWords.some(word => objective.toLowerCase().includes(word))) {
      challenges.push('integration-complexity');
    }

    return challenges.length > 0 ? challenges : ['execution-coordination'];
  }

  private initializePlanningStrategies(): PlanningStrategy[] {
    return [
      {
        name: 'sequential-execution',
        description: 'Execute tasks in sequential order with validation at each step',
        applicability: {
          complexityRange: ['simple', 'moderate'],
          domains: ['general', 'development', 'automation'],
          minResources: 1,
          maxRiskLevel: 'medium'
        },
        phases: [
          {
            name: 'preparation',
            description: 'Prepare resources and validate requirements',
            inputs: [{ name: 'objective', type: 'string' }],
            outputs: [{ name: 'validated-plan', type: 'object' }],
            successCriteria: [{ criterion: 'resources-ready', threshold: 1.0 }]
          },
          {
            name: 'execution',
            description: 'Execute the main task logic',
            inputs: [{ name: 'validated-plan', type: 'object' }],
            outputs: [{ name: 'result', type: 'any' }],
            successCriteria: [{ criterion: 'task-completed', threshold: 1.0 }]
          },
          {
            name: 'validation',
            description: 'Validate results and cleanup',
            inputs: [{ name: 'result', type: 'any' }],
            outputs: [{ name: 'validated-result', type: 'any' }],
            successCriteria: [{ criterion: 'result-validated', threshold: 1.0 }]
          }
        ],
        successCriteria: [
          { criterion: 'all-phases-completed', threshold: 1.0 },
          { criterion: 'no-critical-errors', threshold: 1.0 }
        ],
        riskMitigation: [
          { risk: 'execution-failure', mitigation: 'checkpoint-rollback' },
          { risk: 'resource-unavailability', mitigation: 'alternative-resources' }
        ],
        expectedEffectiveness: 0.85
      },
      {
        name: 'parallel-execution',
        description: 'Execute independent tasks in parallel for efficiency',
        applicability: {
          complexityRange: ['moderate', 'complex'],
          domains: ['development', 'automation', 'data'],
          minResources: 2,
          maxRiskLevel: 'high'
        },
        phases: [
          {
            name: 'decomposition',
            description: 'Break down task into parallel components',
            inputs: [{ name: 'objective', type: 'string' }],
            outputs: [{ name: 'parallel-tasks', type: 'array' }],
            successCriteria: [{ criterion: 'tasks-identified', threshold: 1.0 }]
          },
          {
            name: 'parallel-execution',
            description: 'Execute tasks concurrently',
            inputs: [{ name: 'parallel-tasks', type: 'array' }],
            outputs: [{ name: 'parallel-results', type: 'array' }],
            successCriteria: [{ criterion: 'all-tasks-completed', threshold: 0.9 }]
          },
          {
            name: 'aggregation',
            description: 'Combine results from parallel execution',
            inputs: [{ name: 'parallel-results', type: 'array' }],
            outputs: [{ name: 'aggregated-result', type: 'any' }],
            successCriteria: [{ criterion: 'results-combined', threshold: 1.0 }]
          }
        ],
        successCriteria: [
          { criterion: 'efficiency-gained', threshold: 0.7 },
          { criterion: 'all-results-integrated', threshold: 1.0 }
        ],
        riskMitigation: [
          { risk: 'synchronization-issues', mitigation: 'coordination-checkpoints' },
          { risk: 'partial-failure', mitigation: 'graceful-degradation' }
        ],
        expectedEffectiveness: 0.75
      },
      {
        name: 'adaptive-execution',
        description: 'Dynamically adapt execution based on intermediate results',
        applicability: {
          complexityRange: ['complex', 'very-complex'],
          domains: ['analysis', 'development', 'automation'],
          minResources: 2,
          maxRiskLevel: 'very-high'
        },
        phases: [
          {
            name: 'initial-assessment',
            description: 'Assess situation and create initial plan',
            inputs: [{ name: 'objective', type: 'string' }],
            outputs: [{ name: 'initial-plan', type: 'object' }],
            successCriteria: [{ criterion: 'plan-created', threshold: 1.0 }]
          },
          {
            name: 'iterative-execution',
            description: 'Execute with continuous adaptation',
            inputs: [{ name: 'initial-plan', type: 'object' }],
            outputs: [{ name: 'adaptive-result', type: 'any' }],
            successCriteria: [{ criterion: 'objective-achieved', threshold: 0.8 }]
          },
          {
            name: 'optimization',
            description: 'Optimize results based on learning',
            inputs: [{ name: 'adaptive-result', type: 'any' }],
            outputs: [{ name: 'optimized-result', type: 'any' }],
            successCriteria: [{ criterion: 'optimization-applied', threshold: 1.0 }]
          }
        ],
        successCriteria: [
          { criterion: 'adaptation-successful', threshold: 0.8 },
          { criterion: 'learning-applied', threshold: 0.7 }
        ],
        riskMitigation: [
          { risk: 'endless-adaptation', mitigation: 'adaptation-limits' },
          { risk: 'objective-drift', mitigation: 'objective-monitoring' }
        ],
        expectedEffectiveness: 0.65
      }
    ];
  }

  private scorePlanningStrategy(strategy: PlanningStrategy, analysis: ObjectiveAnalysis): number {
    let score = strategy.expectedEffectiveness;

    // Adjust based on complexity match
    const complexityMatch = strategy.applicability.complexityRange.includes(analysis.complexity);
    score *= complexityMatch ? 1.2 : 0.8;

    // Adjust based on domain match
    const domainMatch = analysis.domain.some(d => 
      strategy.applicability.domains.includes(d)
    );
    score *= domainMatch ? 1.1 : 0.9;

    // Adjust based on risk level
    const riskLevels = ['low', 'medium', 'high', 'very-high'];
    const maxRiskIndex = riskLevels.indexOf(strategy.applicability.maxRiskLevel);
    const actualRiskIndex = riskLevels.indexOf(analysis.riskLevel);
    
    if (actualRiskIndex <= maxRiskIndex) {
      score *= 1.1;
    } else {
      score *= 0.7;
    }

    return Math.max(0, Math.min(1, score));
  }

  private generatePlanningReasoning(
    analysis: ObjectiveAnalysis,
    strategy: PlanningStrategy,
    plan: TaskPlan
  ): string[] {
    return [
      `Selected ${strategy.name} strategy based on ${analysis.complexity} complexity`,
      `Objective requires ${analysis.requiredCapabilities.join(', ')} capabilities`,
      `Risk level assessed as ${analysis.riskLevel}`,
      `Generated ${plan.phases.length} execution phases`,
      `Estimated total duration: ${plan.estimatedDuration}ms`
    ];
  }

  private generatePlanAlternatives(
    objective: string,
    context: DecisionContext,
    analysis: ObjectiveAnalysis
  ): Alternative<TaskPlan>[] {
    // For now, return simplified alternatives
    // In a more sophisticated implementation, we'd generate actual alternative plans
    return [
      {
        option: {} as TaskPlan, // Simplified for basic implementation
        confidence: 0.6,
        pros: ['Lower risk', 'Simpler execution'],
        cons: ['Potentially slower', 'Less optimization'],
        estimatedOutcome: 'Reliable but basic execution'
      }
    ];
  }

  private createExecutionPlan(plan: TaskPlan): any {
    // Create basic execution plan structure
    return {
      phases: plan.phases.map(phase => ({
        id: phase.id,
        workflowPattern: phase.workflowPattern,
        estimatedDuration: phase.estimatedDuration,
        dependencies: plan.dependencies.filter(dep => 
          dep.dependentPhase === phase.id
        )
      }))
    };
  }

  private calculatePlanConfidence(plan: TaskPlan, analysis: ObjectiveAnalysis): number {
    let confidence = 0.8; // Base confidence

    // Adjust based on analysis certainty
    if (analysis.complexity === 'simple') confidence += 0.1;
    if (analysis.riskLevel === 'low') confidence += 0.05;
    
    // Adjust based on plan completeness
    if (plan.phases.length > 0) confidence += 0.05;
    if (plan.contingencies && plan.contingencies.length > 0) confidence += 0.05;

    return Math.max(0.1, Math.min(1.0, confidence));
  }

  // Additional private helper methods would be implemented here...
  private validateDependencies(plan: TaskPlan): ValidationIssue[] {
    // Simplified dependency validation
    return [];
  }

  private validateResourceRequirements(plan: TaskPlan, context: DecisionContext): ValidationIssue[] {
    // Simplified resource validation
    return [];
  }

  private validateTimeConstraints(plan: TaskPlan, context: DecisionContext): ValidationIssue[] {
    const issues: ValidationIssue[] = [];
    
    if (context.timeLimit && plan.estimatedDuration > context.timeLimit) {
      issues.push({
        severity: 'warning',
        category: 'timing',
        description: `Estimated duration (${plan.estimatedDuration}ms) exceeds time limit (${context.timeLimit}ms)`,
        suggestion: 'Consider optimizing plan for speed or requesting additional time'
      });
    }

    return issues;
  }

  private generatePlanSuggestions(plan: TaskPlan, context: DecisionContext): string[] {
    const suggestions: string[] = [];
    
    if (plan.phases.length > 5) {
      suggestions.push('Consider consolidating phases for simpler execution');
    }
    
    if (context.priorityLevel === 'critical' && !plan.contingencies?.length) {
      suggestions.push('Add contingency plans for critical priority tasks');
    }

    return suggestions;
  }

  private assessPlanRisk(plan: TaskPlan, context: DecisionContext): any {
    return {
      overallRisk: 'medium',
      factors: ['complexity', 'resource-requirements'],
      mitigation: 'standard-error-handling'
    };
  }

  // Optimization methods (simplified implementations)
  private optimizeForSpeed(plan: TaskPlan): TaskPlan {
    // Simplified speed optimization
    const optimized = { ...plan };
    optimized.estimatedDuration = Math.floor(optimized.estimatedDuration * 0.8);
    return optimized;
  }

  private optimizeForQuality(plan: TaskPlan): TaskPlan {
    // Simplified quality optimization
    const optimized = { ...plan };
    optimized.estimatedDuration = Math.floor(optimized.estimatedDuration * 1.2);
    return optimized;
  }

  private optimizeForCost(plan: TaskPlan): TaskPlan {
    // Simplified cost optimization
    return { ...plan };
  }

  private optimizeForReliability(plan: TaskPlan): TaskPlan {
    // Simplified reliability optimization
    const optimized = { ...plan };
    optimized.estimatedDuration = Math.floor(optimized.estimatedDuration * 1.1);
    return optimized;
  }

  private optimizeBalanced(plan: TaskPlan): TaskPlan {
    // Simplified balanced optimization
    return { ...plan };
  }

  // Additional helper methods would be implemented here...
  private identifyPhaseDependencies(phases: PlanPhase[]): PhaseDependency[] {
    return [];
  }

  private generateContingencyPlans(phases: PlanPhase[], analysis: ObjectiveAnalysis): ContingencyPlan[] {
    return [];
  }

  private identifyPlanRiskFactors(phases: PlanPhase[], analysis: ObjectiveAnalysis): RiskFactor[] {
    return [];
  }

  private estimatePhaseDuration(template: any, analysis: ObjectiveAnalysis): number {
    let baseDuration = 5000; // 5 seconds base
    
    switch (analysis.complexity) {
      case 'simple': return baseDuration;
      case 'moderate': return baseDuration * 2;
      case 'complex': return baseDuration * 4;
      case 'very-complex': return baseDuration * 8;
      default: return baseDuration;
    }
  }

  private identifyPhaseResources(template: any, context: DecisionContext): Resource[] {
    return context.availableResources.slice(0, 2); // Simplified resource allocation
  }

  private generateStrategySelectionReasoning(strategy: PlanningStrategy, analysis: ObjectiveAnalysis): string[] {
    return [
      `Strategy matches ${analysis.complexity} complexity requirement`,
      `Suitable for ${analysis.domain.join(', ')} domain(s)`,
      `Acceptable risk level for ${analysis.riskLevel} risk assessment`
    ];
  }

  private getStrategyPros(strategy: PlanningStrategy, analysis: ObjectiveAnalysis): string[] {
    return [`High effectiveness (${(strategy.expectedEffectiveness * 100).toFixed(0)}%)`, 'Well-tested approach'];
  }

  private getStrategyCons(strategy: PlanningStrategy, analysis: ObjectiveAnalysis): string[] {
    return ['May not be optimal for all scenarios', 'Fixed approach'];
  }
}

// Supporting types and interfaces
interface ApplicabilityCriteria {
  complexityRange: ObjectiveAnalysis['complexity'][];
  domains: string[];
  minResources: number;
  maxRiskLevel: ObjectiveAnalysis['riskLevel'];
}

interface PlanPhaseTemplate {
  name: string;
  description: string;
  inputs?: PhaseInput[];
  outputs?: PhaseOutput[];
  successCriteria?: SuccessCriterion[];
}

interface PhaseInput {
  name: string;
  type: string;
  required?: boolean;
}

interface PhaseOutput {
  name: string;
  type: string;
}

interface SuccessCriterion {
  criterion: string;
  threshold: number;
}

interface RiskMitigation {
  risk: string;
  mitigation: string;
}

interface PhaseDependency {
  dependentPhase: string;
  dependsOn: string[];
  type: 'sequential' | 'parallel' | 'conditional';
}

interface ContingencyPlan {
  trigger: string;
  action: string;
  fallback: string;
}

interface RiskFactor {
  factor: string;
  severity: 'low' | 'medium' | 'high' | 'critical';
  mitigation?: string;
}

interface RiskAssessment {
  overallRisk: string;
  factors: string[];
  mitigation: string;
}

interface ExecutionPlan {
  phases: {
    id: string;
    workflowPattern: string;
    estimatedDuration: number;
    dependencies: PhaseDependency[];
  }[];
}
```

## Module 3: Integration with Workflow System

### Workflow Integration Layer

```typescript
// lib/src/agent/decision/integration/WorkflowIntegration.ts
import { success, failure, flatMap } from '@qi/base';
import { createAgentError } from '../../errors/AgentErrorSystem';
import type { Result, QiError } from '@qi/base';
import type { TaskPlan, PlanPhase } from '../abstractions/IDecisionEngine';
import type { IWorkflowOrchestrator, WorkflowRequest, WorkflowResult } from '../../../workflow/abstractions/IWorkflowOrchestrator';

export class DecisionWorkflowIntegration {
  constructor(
    private workflowOrchestrator: IWorkflowOrchestrator
  ) {}

  async executeTaskPlan(plan: TaskPlan): Promise<Result<TaskExecutionResult, QiError>> {
    try {
      const executionResults: PhaseExecutionResult[] = [];
      
      // Execute each phase using the workflow system
      for (const phase of plan.phases) {
        const phaseResult = await this.executePhase(phase);
        
        if (phaseResult.tag === 'failure') {
          // Handle phase failure - could implement retry logic here
          return failure(createAgentError.business(
            `Phase ${phase.name} failed: ${phaseResult.error.message}`,
            {
              operation: 'executeTaskPlan',
              componentId: 'DecisionWorkflowIntegration',
              metadata: {
                planId: plan.id,
                failedPhase: phase.id,
                completedPhases: executionResults.length
              }
            }
          ));
        }

        executionResults.push(phaseResult.value);
        
        // Check if we should continue based on results
        if (!this.shouldContinueExecution(phaseResult.value, plan)) {
          break;
        }
      }

      const overallResult: TaskExecutionResult = {
        planId: plan.id,
        success: true,
        phaseResults: executionResults,
        totalDuration: executionResults.reduce((sum, result) => sum + result.executionTime, 0),
        completedPhases: executionResults.length,
        totalPhases: plan.phases.length
      };

      return success(overallResult);

    } catch (error) {
      return failure(createAgentError.system(
        `Task plan execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'executeTaskPlan',
          componentId: 'DecisionWorkflowIntegration',
          metadata: { planId: plan.id }
        }
      ));
    }
  }

  private async executePhase(phase: PlanPhase): Promise<Result<PhaseExecutionResult, QiError>> {
    try {
      // Convert phase to workflow request
      const workflowRequest: WorkflowRequest = {
        pattern: phase.workflowPattern as any,
        context: {
          objective: phase.description,
          inputs: phase.inputs,
          expectedOutputs: phase.outputs,
          successCriteria: phase.successCriteria,
          resources: phase.resources,
          timeLimit: phase.estimatedDuration
        }
      };

      // Execute using workflow orchestrator
      const workflowResult = await this.workflowOrchestrator.orchestrateWorkflowExecution(
        workflowRequest.pattern,
        workflowRequest.context
      );

      return flatMap(
        (result: WorkflowResult) => {
          const phaseResult: PhaseExecutionResult = {
            phaseId: phase.id,
            success: result.success,
            result: result.result,
            executionTime: result.executionTime || 0,
            workflowPattern: phase.workflowPattern,
            metadata: {
              workflowSteps: result.stepsExecuted || 0,
              resourcesUsed: phase.resources.map(r => r.identifier),
              successCriteriasMet: result.success ? phase.successCriteria.length : 0
            }
          };

          return success(phaseResult);
        },
        workflowResult
      );

    } catch (error) {
      return failure(createAgentError.system(
        `Phase execution failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'executePhase',
          componentId: 'DecisionWorkflowIntegration',
          metadata: { phaseId: phase.id, workflowPattern: phase.workflowPattern }
        }
      ));
    }
  }

  private shouldContinueExecution(phaseResult: PhaseExecutionResult, plan: TaskPlan): boolean {
    // Basic continuation logic - could be enhanced with more sophisticated decision rules
    return phaseResult.success;
  }
}

interface TaskExecutionResult {
  planId: string;
  success: boolean;
  phaseResults: PhaseExecutionResult[];
  totalDuration: number;
  completedPhases: number;
  totalPhases: number;
}

interface PhaseExecutionResult {
  phaseId: string;
  success: boolean;
  result: any;
  executionTime: number;
  workflowPattern: string;
  metadata: {
    workflowSteps: number;
    resourcesUsed: string[];
    successCriteriasMet: number;
  };
}
```

## Module 4: Testing Implementation

### Decision Engine Testing

```typescript
// lib/src/agent/decision/__tests__/BasicDecisionEngine.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentTestUtils } from '../../testing/AgentTestUtils';
import { BasicDecisionEngine } from '../impl/BasicDecisionEngine';
import type { DecisionContext, ObjectiveAnalysis } from '../abstractions/IDecisionEngine';
import type { IWorkflowOrchestrator } from '../../../workflow/abstractions/IWorkflowOrchestrator';

// Mock workflow orchestrator for testing
class MockWorkflowOrchestrator implements IWorkflowOrchestrator {
  async orchestrateWorkflowExecution(pattern: any, context: any) {
    return AgentTestUtils.createSuccessResult({
      success: true,
      result: { mockResult: 'test-execution' },
      executionTime: 100,
      stepsExecuted: 3
    });
  }

  async selectOptimalPattern(request: any) {
    return AgentTestUtils.createSuccessResult({
      selectedPattern: 'react',
      confidence: 0.8,
      reasoning: ['Test pattern selection']
    });
  }
}

describe('BasicDecisionEngine', () => {
  let decisionEngine: BasicDecisionEngine;
  let mockWorkflowOrchestrator: MockWorkflowOrchestrator;

  beforeEach(() => {
    mockWorkflowOrchestrator = new MockWorkflowOrchestrator();
    decisionEngine = new BasicDecisionEngine('test-agent', mockWorkflowOrchestrator);
  });

  describe('objective analysis', () => {
    it('should analyze simple objectives correctly', async () => {
      const objective = 'Create a new text file with hello world';
      const context: DecisionContext = {
        objective,
        constraints: [],
        availableResources: [
          {
            type: 'tool',
            identifier: 'write',
            availability: 1.0,
            cost: 0,
            capabilities: ['file-creation'],
            metadata: {}
          }
        ],
        priorityLevel: 'medium',
        metadata: {}
      };

      const result = await decisionEngine.analyzeObjective(objective, context);
      const analysis = AgentTestUtils.expectSuccess(result);

      expect(analysis.complexity).toBe('simple');
      expect(analysis.domain).toContain('development');
      expect(analysis.requiredCapabilities).toContain('file-operations');
      expect(analysis.riskLevel).toBe('low');
    });

    it('should analyze complex objectives correctly', async () => {
      const objective = 'Analyze the codebase, optimize performance, and integrate with multiple external services';
      const context: DecisionContext = {
        objective,
        constraints: [
          { type: 'time', description: 'Complete within 1 hour', mandatory: true, weight: 0.8, parameters: {} },
          { type: 'quality', description: 'High quality standards', mandatory: true, weight: 0.9, parameters: {} },
          { type: 'resource', description: 'Limited memory usage', mandatory: false, weight: 0.6, parameters: {} }
        ],
        availableResources: [],
        priorityLevel: 'high',
        metadata: {}
      };

      const result = await decisionEngine.analyzeObjective(objective, context);
      const analysis = AgentTestUtils.expectSuccess(result);

      expect(analysis.complexity).toBe('complex');
      expect(analysis.riskLevel).toBe('high');
      expect(analysis.potentialChallenges).toContain('integration-complexity');
    });
  });

  describe('task planning', () => {
    it('should create basic task plan for simple objectives', async () => {
      const objective = 'Read and summarize a configuration file';
      const context: DecisionContext = {
        objective,
        constraints: [],
        availableResources: [
          {
            type: 'tool',
            identifier: 'read',
            availability: 1.0,
            cost: 0,
            capabilities: ['file-reading'],
            metadata: {}
          }
        ],
        priorityLevel: 'medium',
        metadata: {}
      };

      const agentContext = AgentTestUtils.createMockAgentContext();

      const result = await decisionEngine.planTask(objective, context, agentContext);
      const decisionResult = AgentTestUtils.expectSuccess(result);

      expect(decisionResult.decision.objective).toBe(objective);
      expect(decisionResult.decision.phases.length).toBeGreaterThan(0);
      expect(decisionResult.confidence).toBeGreaterThan(0.5);
      expect(decisionResult.reasoning).toContain('sequential-execution');
    });

    it('should handle planning failures gracefully', async () => {
      const objective = 'Impossible task with no resources';
      const context: DecisionContext = {
        objective,
        constraints: [
          { type: 'resource', description: 'No resources allowed', mandatory: true, weight: 1.0, parameters: {} }
        ],
        availableResources: [],
        priorityLevel: 'critical',
        metadata: {}
      };

      const agentContext = AgentTestUtils.createMockAgentContext();

      const result = await decisionEngine.planTask(objective, context, agentContext);
      // Should still succeed but with low confidence
      const decisionResult = AgentTestUtils.expectSuccess(result);
      
      expect(decisionResult.confidence).toBeLessThan(0.6);
      expect(decisionResult.decision.riskFactors).toBeDefined();
    });
  });

  describe('plan validation', () => {
    it('should validate well-formed plans', async () => {
      const plan: TaskPlan = {
        id: 'test-plan-1',
        objective: 'Test objective',
        strategy: {
          name: 'test-strategy',
          description: 'Test strategy',
          applicability: {
            complexityRange: ['simple'],
            domains: ['general'],
            minResources: 1,
            maxRiskLevel: 'medium'
          },
          phases: [],
          successCriteria: [],
          riskMitigation: [],
          expectedEffectiveness: 0.8
        },
        phases: [
          {
            id: 'phase-1',
            name: 'Test Phase',
            description: 'Test phase description',
            workflowPattern: 'react',
            inputs: [],
            outputs: [],
            estimatedDuration: 1000,
            resources: [],
            successCriteria: [],
            priority: 1
          }
        ],
        dependencies: [],
        estimatedDuration: 1000,
        successCriteria: [],
        riskFactors: [],
        contingencies: []
      };

      const context: DecisionContext = {
        objective: 'Test objective',
        constraints: [],
        availableResources: [],
        priorityLevel: 'medium',
        metadata: {}
      };

      const result = await decisionEngine.validatePlan(plan, context);
      const validation = AgentTestUtils.expectSuccess(result);

      expect(validation.valid).toBe(true);
      expect(validation.issues.filter(i => i.severity === 'error')).toHaveLength(0);
    });

    it('should identify validation issues', async () => {
      const invalidPlan: TaskPlan = {
        id: 'invalid-plan',
        objective: 'Test objective',
        strategy: {} as any,
        phases: [], // No phases - should be an issue
        dependencies: [],
        estimatedDuration: 10000,
        successCriteria: [],
        riskFactors: [],
        contingencies: []
      };

      const context: DecisionContext = {
        objective: 'Test objective',
        constraints: [],
        availableResources: [],
        timeLimit: 5000, // Plan exceeds time limit
        priorityLevel: 'medium',
        metadata: {}
      };

      const result = await decisionEngine.validatePlan(invalidPlan, context);
      const validation = AgentTestUtils.expectSuccess(result);

      expect(validation.valid).toBe(false);
      expect(validation.issues.some(i => i.severity === 'error' && i.category === 'structure')).toBe(true);
      expect(validation.issues.some(i => i.category === 'timing')).toBe(true);
    });
  });

  describe('plan optimization', () => {
    it('should optimize plans for speed', async () => {
      const originalPlan: TaskPlan = {
        id: 'original-plan',
        objective: 'Test optimization',
        strategy: {} as any,
        phases: [
          {
            id: 'phase-1',
            name: 'Slow Phase',
            description: 'Original slow phase',
            workflowPattern: 'react',
            inputs: [],
            outputs: [],
            estimatedDuration: 5000,
            resources: [],
            successCriteria: [],
            priority: 1
          }
        ],
        dependencies: [],
        estimatedDuration: 5000,
        successCriteria: [],
        riskFactors: [],
        contingencies: []
      };

      const optimizationCriteria: OptimizationCriteria = {
        optimizeFor: 'speed',
        constraints: [],
        weights: { speed: 1.0, quality: 0.5 }
      };

      const result = await decisionEngine.optimizePlan(originalPlan, optimizationCriteria);
      const optimizedDecision = AgentTestUtils.expectSuccess(result);

      expect(optimizedDecision.decision.estimatedDuration).toBeLessThan(originalPlan.estimatedDuration);
      expect(optimizedDecision.reasoning).toContain('speed');
    });
  });
});

// Test utilities extension
declare module '../../testing/AgentTestUtils' {
  namespace AgentTestUtils {
    function createSuccessResult<T>(value: T): Result<T, QiError>;
    function createMockAgentContext(): AgentContext;
  }
}
```

## Installation Dependencies

```bash
# No additional dependencies needed - builds on v-0.10.0 foundation
```

## Performance Targets

### v-0.10.1 Decision Engine Performance Goals
- **Objective Analysis**: <200ms for standard complexity assessment
- **Task Planning**: <500ms for basic plans, <2000ms for complex plans
- **Plan Validation**: <100ms for standard validation checks
- **Strategy Selection**: <50ms for strategy scoring and selection
- **Memory Usage**: <20MB additional footprint for decision capabilities

## Success Criteria

### Decision Engine Functionality Targets
- ✅ Objective analysis with complexity and risk assessment
- ✅ Basic task planning with multiple strategies
- ✅ Plan validation with issue identification
- ✅ Plan optimization for different criteria
- ✅ Integration with v-0.9.x workflow system
- ✅ Comprehensive error handling with QiCore patterns

### Quality Targets
- ✅ All operations return Result<T, QiError>
- ✅ Decision confidence scoring implemented
- ✅ Alternative generation for major decisions
- ✅ Performance monitoring and logging
- ✅ 95%+ test coverage for decision logic

### Integration Targets
- ✅ Seamless workflow system integration
- ✅ Strategy-based workflow pattern selection
- ✅ Phase execution through workflow orchestrator
- ✅ Result aggregation and reporting

---

**Next Steps**: This decision engine foundation enables the implementation of impl.v-0.10.2.md (Multi-Agent Coordination) with proper planning and reasoning capabilities.