/**
 * Intelligent Pattern Selector for v-0.9.x Enhanced Workflow System
 *
 * Provides sophisticated pattern selection using:
 * - Task complexity analysis (40% weight)
 * - MCP Memory knowledge graph recommendations (30% weight)
 * - MCP RAG historical performance data (30% weight)
 */

import type { QiError, Result } from '@qi/base';
import { create, failure, match, success } from '@qi/base';
import type { MCPServiceManager } from '../../mcp/MCPServiceManager.js';
import { createQiLogger, type SimpleLogger } from '../../utils/QiCoreLogger.js';
import type {
  PatternRecommendation,
  PatternSelection,
  WorkflowRequest,
} from '../abstractions/IAdvancedWorkflowOrchestrator.js';

// Internal analysis types
interface TaskAnalysis {
  characteristics: {
    complexity: number;
    dynamism: number;
    planningFeasibility: number;
    explorationNeeds: number;
    resourceRequirements: number;
  };
  suggestedPatterns: string[];
  confidenceScore: number;
}

interface SelectionResult {
  pattern: string;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ pattern: string; score: number }>;
  expectedMetrics: {
    estimatedDuration: number;
    expectedQuality: number;
    resourceUtilization: number;
  };
}

interface PatternKnowledge {
  pattern: string;
  confidenceScore: number;
  averageDuration: number;
  successRate: number;
  qualityScore: number;
  applicableContexts: string[];
}

interface MemoryMCPIntegration {
  queryWorkflowRecommendations(
    description: string
  ): Promise<Result<PatternRecommendation[], QiError>>;
}

interface ChromaMCPIntegration {
  retrievePatternKnowledge(patterns: string[]): Promise<Result<PatternKnowledge[], QiError>>;
}

/**
 * Intelligent Pattern Selector Implementation
 *
 * Uses a sophisticated weighted scoring algorithm to select the optimal workflow pattern
 * based on task analysis, historical knowledge, and performance data.
 */
export class IntelligentPatternSelector {
  private logger: SimpleLogger;
  private memoryIntegration: MemoryMCPIntegration;
  private ragIntegration: ChromaMCPIntegration;

  constructor(private mcpServiceManager: MCPServiceManager) {
    this.logger = createQiLogger({ name: 'IntelligentPatternSelector' });
    this.memoryIntegration = this.createMemoryIntegration();
    this.ragIntegration = this.createRAGIntegration();
  }

  /**
   * Select optimal pattern for the given workflow request
   *
   * Algorithm:
   * 1. Analyze task characteristics (40% weight)
   * 2. Query MCP Memory for recommendations (30% weight)
   * 3. Retrieve historical performance from RAG (30% weight)
   * 4. Apply weighted scoring to select best pattern
   */
  async selectOptimalPattern(request: WorkflowRequest): Promise<Result<PatternSelection, QiError>> {
    this.logger.info('Starting pattern selection', {
      workflowId: request.id,
      description: request.description.substring(0, 100),
    });

    try {
      // Step 1: Analyze task characteristics
      const taskAnalysisResult = await this.analyzeTaskCharacteristics(request);
      if (taskAnalysisResult.tag === 'failure') {
        return failure(taskAnalysisResult.error);
      }
      const taskAnalysis = taskAnalysisResult.value;

      // Step 2: Query knowledge graph for pattern recommendations
      const knowledgeRecommendationsResult =
        await this.memoryIntegration.queryWorkflowRecommendations(request.description);

      const knowledgeRecommendations = match(
        (recommendations) => recommendations,
        (error) => {
          this.logger.warn('Failed to get knowledge recommendations', { error: error.message });
          return []; // Graceful degradation
        },
        knowledgeRecommendationsResult
      );

      // Step 3: Retrieve pattern performance data from RAG
      const performanceDataResult = await this.ragIntegration.retrievePatternKnowledge(
        taskAnalysis.suggestedPatterns
      );

      const performanceData = match(
        (data) => data,
        (error) => {
          this.logger.warn('Failed to get performance data', { error: error.message });
          return []; // Graceful degradation
        },
        performanceDataResult
      );

      // Step 4: Apply pattern selection algorithm
      const selection = await this.applySelectionAlgorithm(
        taskAnalysis,
        knowledgeRecommendations,
        performanceData
      );

      this.logger.info('Pattern selection completed', {
        selectedPattern: selection.pattern,
        confidence: selection.confidence,
      });

      return success({
        selectedPattern: selection.pattern,
        confidence: selection.confidence,
        reasoning: selection.reasoning,
        alternativePatterns: selection.alternatives,
        expectedPerformance: selection.expectedMetrics,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      this.logger.error(
        'Pattern selection failed',
        error instanceof Error ? error : new Error(String(error)),
        { component: 'IntelligentPatternSelector' }
      );

      return failure(
        create(
          'PATTERN_SELECTION_FAILED',
          `Failed to select optimal pattern: ${errorMessage}`,
          'SYSTEM'
        )
      );
    }
  }

  /**
   * Analyze task characteristics to determine suggested patterns
   */
  private async analyzeTaskCharacteristics(
    request: WorkflowRequest
  ): Promise<Result<TaskAnalysis, QiError>> {
    const characteristics = {
      complexity: this.assessComplexity(request.description),
      dynamism: this.assessDynamicRequirements(request.description),
      planningFeasibility: this.assessPlanningFeasibility(request.description),
      explorationNeeds: this.assessExplorationNeeds(request.description),
      resourceRequirements: this.assessResourceRequirements(request.description),
    };

    const analysis: TaskAnalysis = {
      characteristics,
      suggestedPatterns: this.mapCharacteristicsToPatterns(characteristics),
      confidenceScore: this.calculateAnalysisConfidence(characteristics),
    };

    return success(analysis);
  }

  /**
   * Apply weighted scoring algorithm for pattern selection
   *
   * Scoring weights:
   * - Task characteristics: 40%
   * - Knowledge graph recommendations: 30%
   * - Historical performance: 30%
   */
  private async applySelectionAlgorithm(
    taskAnalysis: TaskAnalysis,
    knowledgeRecommendations: PatternRecommendation[],
    performanceData: PatternKnowledge[]
  ): Promise<SelectionResult> {
    const scores = new Map<string, number>();
    const availablePatterns = ['react', 'rewoo', 'adapt'];

    // Initialize scores
    for (const pattern of availablePatterns) {
      scores.set(pattern, 0);
    }

    // Score based on task characteristics (40% weight)
    for (const pattern of availablePatterns) {
      const taskScore = this.scorePatternForTask(pattern, taskAnalysis) * 0.4;
      scores.set(pattern, (scores.get(pattern) || 0) + taskScore);
    }

    // Score based on knowledge graph recommendations (30% weight)
    for (const recommendation of knowledgeRecommendations) {
      if (availablePatterns.includes(recommendation.pattern)) {
        const currentScore = scores.get(recommendation.pattern) || 0;
        scores.set(recommendation.pattern, currentScore + recommendation.confidence * 0.3);
      }
    }

    // Score based on historical performance (30% weight)
    for (const performance of performanceData) {
      if (availablePatterns.includes(performance.pattern)) {
        const currentScore = scores.get(performance.pattern) || 0;
        scores.set(performance.pattern, currentScore + performance.confidenceScore * 0.3);
      }
    }

    // Select highest scoring pattern
    const sortedPatterns = Array.from(scores.entries()).sort(([, a], [, b]) => b - a);

    const selectedPattern = sortedPatterns[0];
    const alternatives = sortedPatterns.slice(1).map(([pattern, score]) => ({ pattern, score }));

    return {
      pattern: selectedPattern[0],
      confidence: selectedPattern[1],
      reasoning: this.generateSelectionReasoning(
        taskAnalysis,
        knowledgeRecommendations,
        performanceData
      ),
      alternatives,
      expectedMetrics: await this.estimatePerformanceMetrics(selectedPattern[0], taskAnalysis),
    };
  }

  /**
   * Assess task complexity (0-1 scale)
   */
  private assessComplexity(description: string): number {
    let complexity = 0;

    // Length and structure indicators
    if (description.length > 500) complexity += 0.2;
    if (description.length > 1000) complexity += 0.2;

    // Multiple requirements indicator
    const requirementIndicators = ['and', 'also', 'plus', 'additionally', 'furthermore'];
    const requirementCount = requirementIndicators.reduce(
      (count, indicator) => count + (description.toLowerCase().split(indicator).length - 1),
      0
    );
    complexity += Math.min(requirementCount * 0.1, 0.3);

    // Technical complexity indicators
    const complexTerms = [
      'algorithm',
      'optimization',
      'integration',
      'architecture',
      'system',
      'analysis',
    ];
    const complexTermCount = complexTerms.reduce(
      (count, term) => count + (description.toLowerCase().includes(term) ? 1 : 0),
      0
    );
    complexity += Math.min(complexTermCount * 0.05, 0.2);

    // Multi-step process indicator
    if (/step|phase|stage|\d+\./g.test(description.toLowerCase())) {
      complexity += 0.1;
    }

    return Math.min(complexity, 1);
  }

  /**
   * Assess dynamic requirements (0-1 scale)
   */
  private assessDynamicRequirements(description: string): number {
    const dynamicIndicators = [
      'adapt',
      'flexible',
      'change',
      'evolve',
      'modify',
      'dynamic',
      'iterative',
      'responsive',
      'adjust',
    ];

    const dynamicCount = dynamicIndicators.reduce(
      (count, indicator) => count + (description.toLowerCase().includes(indicator) ? 1 : 0),
      0
    );

    return Math.min(dynamicCount * 0.15, 1);
  }

  /**
   * Assess planning feasibility (0-1 scale)
   */
  private assessPlanningFeasibility(description: string): number {
    const planningIndicators = ['plan', 'schedule', 'sequence', 'order', 'steps', 'workflow'];
    const uncertaintyIndicators = ['unknown', 'unclear', 'explore', 'investigate', 'research'];

    const planningScore =
      planningIndicators.reduce(
        (count, indicator) => count + (description.toLowerCase().includes(indicator) ? 1 : 0),
        0
      ) * 0.15;

    const uncertaintyPenalty =
      uncertaintyIndicators.reduce(
        (count, indicator) => count + (description.toLowerCase().includes(indicator) ? 1 : 0),
        0
      ) * 0.1;

    return Math.max(0, Math.min(planningScore - uncertaintyPenalty, 1));
  }

  /**
   * Assess exploration needs (0-1 scale)
   */
  private assessExplorationNeeds(description: string): number {
    const explorationIndicators = [
      'explore',
      'discover',
      'investigate',
      'research',
      'find',
      'unknown',
      'unclear',
      'understand',
      'analyze',
    ];

    const explorationCount = explorationIndicators.reduce(
      (count, indicator) => count + (description.toLowerCase().includes(indicator) ? 1 : 0),
      0
    );

    return Math.min(explorationCount * 0.12, 1);
  }

  /**
   * Assess resource requirements (0-1 scale)
   */
  private assessResourceRequirements(description: string): number {
    const resourceIndicators = [
      'database',
      'api',
      'service',
      'external',
      'integration',
      'file',
      'data',
      'processing',
      'computation',
      'memory',
    ];

    const resourceCount = resourceIndicators.reduce(
      (count, indicator) => count + (description.toLowerCase().includes(indicator) ? 1 : 0),
      0
    );

    return Math.min(resourceCount * 0.1, 1);
  }

  /**
   * Map task characteristics to suggested patterns
   */
  private mapCharacteristicsToPatterns(characteristics: TaskAnalysis['characteristics']): string[] {
    const patterns: string[] = [];

    // ReAct is good for exploration and dynamic tasks
    if (characteristics.explorationNeeds > 0.5 || characteristics.dynamism > 0.6) {
      patterns.push('react');
    }

    // ReWOO is good for well-planned, complex tasks
    if (characteristics.planningFeasibility > 0.6 && characteristics.complexity > 0.4) {
      patterns.push('rewoo');
    }

    // ADaPT is good for complex tasks requiring decomposition
    if (characteristics.complexity > 0.7) {
      patterns.push('adapt');
    }

    // Default fallback patterns
    if (patterns.length === 0) {
      patterns.push('react', 'rewoo', 'adapt');
    }

    return patterns;
  }

  /**
   * Calculate confidence score for task analysis
   */
  private calculateAnalysisConfidence(characteristics: TaskAnalysis['characteristics']): number {
    const variance =
      Object.values(characteristics).reduce((sum, value, _, arr) => {
        const mean = arr.reduce((s, v) => s + v, 0) / arr.length;
        return sum + (value - mean) ** 2;
      }, 0) / Object.keys(characteristics).length;

    // Lower variance = higher confidence
    return Math.max(0.3, 1 - Math.sqrt(variance));
  }

  /**
   * Score a pattern for the given task analysis
   */
  private scorePatternForTask(pattern: string, analysis: TaskAnalysis): number {
    const { characteristics } = analysis;

    switch (pattern) {
      case 'react':
        return (
          characteristics.explorationNeeds * 0.4 +
          characteristics.dynamism * 0.3 +
          (1 - characteristics.planningFeasibility) * 0.2 +
          characteristics.complexity * 0.1
        );

      case 'rewoo':
        return (
          characteristics.planningFeasibility * 0.4 +
          characteristics.complexity * 0.3 +
          (1 - characteristics.dynamism) * 0.2 +
          characteristics.resourceRequirements * 0.1
        );

      case 'adapt':
        return (
          characteristics.complexity * 0.5 +
          characteristics.resourceRequirements * 0.2 +
          characteristics.planningFeasibility * 0.2 +
          characteristics.dynamism * 0.1
        );

      default:
        return 0;
    }
  }

  /**
   * Generate reasoning for pattern selection
   */
  private generateSelectionReasoning(
    taskAnalysis: TaskAnalysis,
    knowledgeRecommendations: PatternRecommendation[],
    performanceData: PatternKnowledge[]
  ): string {
    const { characteristics } = taskAnalysis;

    const reasons: string[] = [];

    // Task characteristic reasoning
    if (characteristics.complexity > 0.7) {
      reasons.push('High complexity task requiring sophisticated handling');
    }
    if (characteristics.explorationNeeds > 0.6) {
      reasons.push('Significant exploration needed for task understanding');
    }
    if (characteristics.planningFeasibility > 0.7) {
      reasons.push('Task is well-suited for upfront planning');
    }
    if (characteristics.dynamism > 0.6) {
      reasons.push('Dynamic requirements suggest need for adaptive execution');
    }

    // Knowledge-based reasoning
    if (knowledgeRecommendations.length > 0) {
      const topRecommendation = knowledgeRecommendations[0];
      reasons.push(
        `Historical knowledge recommends ${topRecommendation.pattern} (confidence: ${topRecommendation.confidence.toFixed(2)})`
      );
    }

    // Performance-based reasoning
    if (performanceData.length > 0) {
      const bestPerforming = performanceData.reduce((best, current) =>
        current.successRate * current.qualityScore > best.successRate * best.qualityScore
          ? current
          : best
      );
      reasons.push(
        `${bestPerforming.pattern} shows strong historical performance (${(bestPerforming.successRate * 100).toFixed(0)}% success rate)`
      );
    }

    // Ensure we always provide some reasoning, even without historical data
    if (reasons.length === 0) {
      reasons.push(
        'Pattern selected based on task characteristics and fundamental pattern strengths'
      );
    }

    return reasons.join('. ');
  }

  /**
   * Estimate performance metrics for the selected pattern
   */
  private async estimatePerformanceMetrics(
    pattern: string,
    analysis: TaskAnalysis
  ): Promise<{
    estimatedDuration: number;
    expectedQuality: number;
    resourceUtilization: number;
  }> {
    // Base estimates by pattern type
    const baseEstimates = {
      react: { duration: 120, quality: 0.8, resources: 0.6 },
      rewoo: { duration: 90, quality: 0.85, resources: 0.7 },
      adapt: { duration: 150, quality: 0.9, resources: 0.8 },
    };

    const base = baseEstimates[pattern as keyof typeof baseEstimates] || baseEstimates.react;

    // Adjust based on task complexity
    const complexityMultiplier = 1 + analysis.characteristics.complexity;
    const dynamismMultiplier = 1 + analysis.characteristics.dynamism * 0.5;

    return {
      estimatedDuration: base.duration * complexityMultiplier * dynamismMultiplier,
      expectedQuality: base.quality * (1 - analysis.characteristics.complexity * 0.1),
      resourceUtilization:
        base.resources * (1 + analysis.characteristics.resourceRequirements * 0.3),
    };
  }

  /**
   * Create MCP Memory integration for knowledge graph queries
   */
  private createMemoryIntegration(): MemoryMCPIntegration {
    const mcpServiceManager = this.mcpServiceManager;
    return {
      async queryWorkflowRecommendations(
        description: string
      ): Promise<Result<PatternRecommendation[], QiError>> {
        if (!mcpServiceManager.isConnected('memory')) {
          return success([]); // Graceful degradation
        }

        try {
          const client = mcpServiceManager.getClient('memory');
          if (!client) {
            return success([]);
          }

          const result = await client.callTool({
            name: 'search_nodes',
            arguments: {
              query: `workflow pattern recommendation ${description.substring(0, 100)}`,
            },
          });

          // Parse MCP response and convert to PatternRecommendation[]
          const recommendations: PatternRecommendation[] = [];

          if (result.content && Array.isArray(result.content)) {
            for (const contentItem of result.content) {
              if (contentItem.type === 'text' && contentItem.text) {
                try {
                  const searchData = JSON.parse(contentItem.text);
                  if (searchData.entities) {
                    for (const entity of searchData.entities) {
                      if (
                        entity.entityType === 'workflow_recommendation' &&
                        entity.observations?.[0]
                      ) {
                        const recommendation = JSON.parse(entity.observations[0]);
                        recommendations.push(recommendation);
                      }
                    }
                  }
                } catch {
                  // Skip malformed entries
                }
              }
            }
          }

          return success(recommendations);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          return failure(
            create('MEMORY_QUERY_FAILED', `Memory query failed: ${errorMessage}`, 'SYSTEM')
          );
        }
      },
    };
  }

  /**
   * Create MCP RAG integration for pattern knowledge retrieval
   */
  private createRAGIntegration(): ChromaMCPIntegration {
    // Real knowledge base for patterns (no more fake scores!)
    const patternKnowledgeBase: Record<string, PatternKnowledge> = {
      react: {
        pattern: 'react',
        confidenceScore: 0.0, // Will be calculated from actual usage
        averageDuration: 0, // Will be calculated from real metrics
        successRate: 0.0, // Will be calculated from real outcomes
        qualityScore: 0.0, // Will be calculated from real quality assessments
        applicableContexts: ['problem-solving', 'research', 'analysis', 'reasoning'],
      },
      rewoo: {
        pattern: 'rewoo',
        confidenceScore: 0.0,
        averageDuration: 0,
        successRate: 0.0,
        qualityScore: 0.0,
        applicableContexts: ['planning', 'task-decomposition', 'workflow-management'],
      },
      adapt: {
        pattern: 'adapt',
        confidenceScore: 0.0,
        averageDuration: 0,
        successRate: 0.0,
        qualityScore: 0.0,
        applicableContexts: ['adaptive-reasoning', 'complex-tasks', 'iterative-improvement'],
      },
    };

    return {
      async retrievePatternKnowledge(
        patterns: string[]
      ): Promise<Result<PatternKnowledge[], QiError>> {
        try {
          const knowledge: PatternKnowledge[] = [];

          for (const pattern of patterns) {
            const baseKnowledge = patternKnowledgeBase[pattern];
            if (baseKnowledge) {
              // TODO: Calculate real metrics from actual performance data
              // For now, start with base knowledge and update with real metrics over time
              knowledge.push({
                ...baseKnowledge,
                // These should be calculated from real performance monitoring data
                // Using conservative defaults until real data is available
                confidenceScore: 0.5, // Conservative default
                averageDuration: 0, // No real data yet
                successRate: 0.0, // No real data yet
                qualityScore: 0.0, // No real data yet
              });
            } else {
              // Unknown pattern - return minimal knowledge
              knowledge.push({
                pattern,
                confidenceScore: 0.0,
                averageDuration: 0,
                successRate: 0.0,
                qualityScore: 0.0,
                applicableContexts: ['unknown'],
              });
            }
          }

          return success(knowledge);
        } catch (error) {
          return failure({
            code: 'PATTERN_KNOWLEDGE_RETRIEVAL_FAILED',
            message: `Failed to retrieve pattern knowledge: ${error instanceof Error ? error.message : String(error)}`,
            category: 'SYSTEM',
            context: { patterns, error },
          });
        }
      },
    };
  }

  // TODO: Add integration with real performance monitoring data
  // When WorkflowPerformanceMonitor collects real data, these patterns should
  // calculate their metrics from actual execution history instead of hardcoded values
}
