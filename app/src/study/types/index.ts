/**
 * Shared types for classification study framework
 */

export interface TestSample {
  id?: number;
  input: string;
  expected: 'command' | 'prompt' | 'workflow';
  source?: string;
  complexity?: string;
}

export interface TestDataset {
  metadata?: {
    created?: string;
    totalSamples?: number;
    samplesPerCategory?: number;
    distribution?: Record<string, number>;
    sources?: Record<string, number>;
  };
  samples: TestSample[];
}

export interface StudyConfig {
  models: string[];
  methods: string[];
  dataPath: string;
  llm: {
    baseUrl: string;
    apiKey: string;
    temperature?: number;
    timeout?: number;
  };
  schema?: {
    name?: string;
    selectionCriteria?: {
      use_case?: 'development' | 'testing' | 'production';
      prioritize_accuracy?: boolean;
      prioritize_speed?: boolean;
      max_latency_ms?: number;
      min_accuracy_threshold?: number;
    };
  };
}

export interface TestParams {
  model: string;
  method: string;
  input: string;
}

export interface ClassificationResult {
  type: string;
  confidence: number;
  method: string;
}

export interface TestResult extends TestParams {
  result: ClassificationResult;
  latency: number;
  error?: string;
}

export interface StudyResults {
  results: TestResult[];
  expectedTypes: string[];
}

export interface CategoryMetrics {
  category: string;
  totalTests: number;
  correct: number;
  incorrect: number;
  errors: number;
  accuracyRate: number;
  averageLatency: number;
}

export interface AccuracyMetrics {
  totalTests: number;
  correct: number;
  incorrect: number;
  errors: number;
  accuracyRate: number;
  averageLatency: number;
  categoryBreakdown?: CategoryMetrics[];
}