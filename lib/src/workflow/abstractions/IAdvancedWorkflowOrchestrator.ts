/**
 * Advanced Workflow Orchestration Interface for v-0.9.x Enhanced Workflow System
 *
 * Provides intelligent pattern selection, sophisticated orchestration, and workflow learning
 * capabilities that serve as the foundation for qi-code development (v-0.10.x).
 */

import type { QiError, Result } from '@qi/base';

// Core workflow request and execution types
export interface WorkflowRequest {
  id: string;
  description: string;
  context: Record<string, any>;
  priority: 'low' | 'normal' | 'high' | 'critical';
  expectedComplexity: 'simple' | 'moderate' | 'complex' | 'unknown';
  timeConstraints?: {
    maxDuration?: number;
    deadline?: Date;
  };
  resourceConstraints?: {
    maxMemory?: number;
    maxConcurrency?: number;
  };
}

export interface TaskDescription {
  content: string;
  domain: string;
  requiredCapabilities: string[];
  inputTypes: string[];
  expectedOutputTypes: string[];
}

// Pattern selection and analysis types
export interface ComplexityAnalysis {
  overallComplexity: number; // 0-1 scale
  characteristics: {
    complexity: number;
    dynamism: number;
    planningFeasibility: number;
    explorationNeeds: number;
    resourceRequirements: number;
  };
  suggestedPatterns: string[];
  confidenceScore: number;
  reasoning: string;
}

export interface PatternSelection {
  selectedPattern: string;
  confidence: number;
  reasoning: string;
  alternativePatterns: Array<{
    pattern: string;
    score: number;
  }>;
  expectedPerformance: {
    estimatedDuration: number;
    expectedQuality: number;
    resourceUtilization: number;
  };
}

export interface PatternRecommendation {
  pattern: string;
  confidence: number;
  reasoning: string;
  applicabilityConditions: string[];
  historicalPerformance?: {
    averageDuration: number;
    successRate: number;
    qualityScore: number;
  };
}

// Execution context and results
export interface ExecutionContext {
  workflowId: string;
  sessionId: string;
  userContext: Record<string, any>;
  systemState: Record<string, any>;
  availableResources: string[];
  constraints: {
    timeLimit?: number;
    memoryLimit?: number;
    apiLimits?: Record<string, number>;
  };
}

export interface WorkflowExecution {
  executionId: string;
  workflowId: string;
  pattern: string;
  status: 'pending' | 'running' | 'paused' | 'completed' | 'failed' | 'cancelled';
  startTime: Date;
  endTime?: Date;
  currentPhase?: string;
  progress: number; // 0-100
  steps: WorkflowStep[];
  metrics: WorkflowMetrics;
  adaptations: WorkflowAdaptation[];
}

export interface WorkflowStep {
  id: string;
  name: string;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'skipped';
  startTime?: Date;
  endTime?: Date;
  input: any;
  output?: any;
  error?: QiError;
  metrics?: StepMetrics;
}

export interface StepMetrics {
  duration: number;
  memoryUsage: number;
  apiCalls: Record<string, number>;
  qualityScore?: number;
}

// Performance monitoring and adaptation
export interface WorkflowMetrics {
  executionTime: number;
  memoryUsage: number;
  apiUsage: Record<string, number>;
  qualityScore: number;
  efficiencyScore: number;
  adaptationCount: number;
  checkpointTimes: number[];
}

export interface ExecutionFeedback {
  performanceMetrics: WorkflowMetrics;
  qualityAssessment: {
    outputQuality: number;
    completeness: number;
    accuracy: number;
  };
  issuesDetected: Array<{
    type: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    suggestedActions: string[];
  }>;
  userSatisfaction?: number;
}

export interface PatternAdaptation {
  adaptationId: string;
  timestamp: Date;
  reason: string;
  fromPattern: string;
  toPattern: string;
  success: boolean;
  newPattern?: string;
  adjustments: Record<string, any>;
  expectedImpact: {
    performanceChange: number;
    qualityChange: number;
    riskLevel: 'low' | 'medium' | 'high';
  };
}

export interface WorkflowAdaptation {
  adaptationId: string;
  timestamp: Date;
  reason: string;
  fromPattern: string;
  toPattern: string;
  success: boolean;
  newPattern?: string;
  adjustments: Record<string, any>;
}

export interface OptimizationSuggestions {
  suggestions: Array<{
    type: 'pattern_change' | 'parameter_adjustment' | 'resource_optimization' | 'flow_modification';
    priority: 'low' | 'medium' | 'high';
    description: string;
    expectedBenefit: number;
    implementationEffort: 'low' | 'medium' | 'high';
    riskLevel: 'low' | 'medium' | 'high';
  }>;
  aggregatedBenefit: number;
  confidence: number;
}

// Multi-pattern coordination
export interface WorkflowPattern {
  name: string;
  version: string;
  description: string;
  applicabilityConditions: string[];
  strengths: string[];
  weaknesses: string[];
  typicalUseCase: string[];
  performanceCharacteristics: {
    averageDuration: number;
    memoryFootprint: number;
    scalability: number;
    adaptability: number;
  };
}

export interface HybridWorkflowExecution {
  executionId: string;
  phases: Array<{
    pattern: string;
    startTime: Date;
    endTime?: Date;
    status: string;
    metrics: WorkflowMetrics;
  }>;
  transitions: Array<{
    fromPhase: number;
    toPhase: number;
    transitionTime: Date;
    reason: string;
    success: boolean;
  }>;
  overallMetrics: WorkflowMetrics;
}

export interface WorkflowState {
  currentPhase: string;
  phaseProgress: number;
  overallProgress: number;
  context: Record<string, any>;
  intermediate_results: any[];
  resources_used: string[];
  constraints_active: string[];
}

export interface TransitionResult {
  success: boolean;
  newState: WorkflowState;
  transitionMetrics: {
    duration: number;
    dataTransferred: number;
    lossyTransformation: boolean;
  };
  issues?: Array<{
    type: string;
    description: string;
    severity: 'low' | 'medium' | 'high';
  }>;
}

// Learning system integration
export interface WorkflowOutcome {
  executionId: string;
  workflowRequest: WorkflowRequest;
  patternUsed: string;
  success: boolean;
  metrics: WorkflowMetrics;
  qualityAssessment: {
    outputQuality: number;
    completeness: number;
    accuracy: number;
  };
  adaptations: WorkflowAdaptation[];
  userFeedback?: number;
  timestamp: Date;
}

export interface LearningInsights {
  patternOptimizations: OptimizationInsight[];
  contextualPatterns: ContextualPattern[];
  performanceImprovements: PerformanceImprovement[];
  failurePrevention: FailurePrevention[];
  confidence: number;
  applicabilityScope: string;
}

export interface OptimizationInsight {
  type: 'parameter_tuning' | 'pattern_preference' | 'resource_allocation' | 'flow_optimization';
  successFactors: string[];
  applicabilityConditions: string[];
  expectedImprovements: {
    performanceGain: number;
    qualityImprovement: number;
    reliabilityIncrease: number;
  };
  implementationSteps: string[];
  confidence: number;
}

export interface ContextualPattern {
  contextDescription: string;
  applicablePatterns: string[];
  performanceRanking: Array<{
    pattern: string;
    score: number;
    reasoning: string;
  }>;
  significance: number;
  sampleSize: number;
}

export interface PerformanceImprovement {
  area: string;
  improvement: string;
  measuredBenefit: number;
  applicability: string[];
  implementationComplexity: 'low' | 'medium' | 'high';
}

export interface FailurePrevention {
  failurePattern: string;
  preventionStrategy: string;
  earlyWarningSignals: string[];
  effectiveness: number;
  cost: 'low' | 'medium' | 'high';
}

/**
 * Advanced Workflow Orchestrator Interface
 *
 * Provides sophisticated workflow orchestration capabilities including:
 * - Intelligent pattern selection based on task analysis and historical data
 * - Real-time workflow adaptation and optimization
 * - Multi-pattern hybrid execution coordination
 * - Continuous learning and improvement from workflow outcomes
 */
export interface IAdvancedWorkflowOrchestrator {
  // Intelligent pattern selection
  selectOptimalPattern(request: WorkflowRequest): Promise<Result<PatternSelection, QiError>>;
  analyzeTaskComplexity(task: TaskDescription): Promise<Result<ComplexityAnalysis, QiError>>;
  recommendPatternWithReasoning(
    analysis: ComplexityAnalysis
  ): Promise<Result<PatternRecommendation, QiError>>;

  // Advanced orchestration
  orchestrateWorkflowExecution(
    pattern: WorkflowPattern,
    context: ExecutionContext
  ): Promise<Result<WorkflowExecution, QiError>>;

  adaptPatternDuringExecution(
    execution: WorkflowExecution,
    feedback: ExecutionFeedback
  ): Promise<Result<PatternAdaptation, QiError>>;

  optimizeWorkflowPerformance(
    metrics: WorkflowMetrics
  ): Promise<Result<OptimizationSuggestions, QiError>>;

  // Multi-pattern coordination
  coordinateHybridPatterns(
    patterns: WorkflowPattern[]
  ): Promise<Result<HybridWorkflowExecution, QiError>>;

  managePatternTransitions(
    fromPattern: string,
    toPattern: string,
    state: WorkflowState
  ): Promise<Result<TransitionResult, QiError>>;

  // Workflow learning integration
  learnFromWorkflowOutcomes(
    outcomes: WorkflowOutcome[]
  ): Promise<Result<LearningInsights, QiError>>;

  applyLearningsToFutureExecutions(insights: LearningInsights): Promise<Result<void, QiError>>;

  // Monitoring and health
  getWorkflowHealth(): Promise<
    Result<
      {
        activeExecutions: number;
        averagePerformance: number;
        systemLoad: number;
        learningEffectiveness: number;
      },
      QiError
    >
  >;

  // Configuration and lifecycle
  initialize(config: AdvancedWorkflowConfig): Promise<Result<void, QiError>>;
  shutdown(): Promise<Result<void, QiError>>;
}

export interface AdvancedWorkflowConfig {
  patternSelection: {
    enableIntelligentSelection: boolean;
    selectionAlgorithm: 'weighted-scoring' | 'ml-based' | 'rule-based';
    learningWeightDecay: number;
    minimumConfidenceThreshold: number;
  };

  monitoring: {
    enableRealTimeMonitoring: boolean;
    performanceCheckpointInterval: number;
    adaptationThresholds: {
      performanceDegradation: number;
      executionTimeExcess: number;
      qualityDegradation: number;
    };
  };

  learning: {
    enableContinuousLearning: boolean;
    learningBatchSize: number;
    learningFrequency: 'hourly' | 'daily' | 'weekly';
    retentionPeriod: number;
  };

  hybridExecution: {
    enableHybridPatterns: boolean;
    maxPhasesPerExecution: number;
    transitionOptimization: boolean;
  };

  mcpIntegration: {
    enableMemoryIntegration: boolean;
    enableRAGIntegration: boolean;
    enableDatabaseIntegration: boolean;
  };
}
