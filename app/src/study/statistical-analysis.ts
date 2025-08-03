/**
 * Statistical Analysis Utilities for Classification Studies
 * 
 * Provides rigorous statistical testing for method comparisons including:
 * - Confidence intervals for accuracy measurements
 * - Hypothesis testing for method comparisons
 * - Effect size calculations
 * - Sample size recommendations
 * - Statistical power analysis
 */

export interface ClassificationResult {
  correct: number;
  total: number;
  accuracy: number;
  confidences: number[];
  latencies: number[];
}

export interface StatisticalTestResult {
  pValue: number;
  significant: boolean;
  effectSize: number;
  confidenceInterval: { lower: number; upper: number };
  testType: string;
  interpretation: string;
}

export interface ConfidenceInterval {
  lower: number;
  upper: number;
  level: number; // e.g., 0.95 for 95%
}

export interface PowerAnalysis {
  requiredSampleSize: number;
  currentPower: number;
  recommendedSampleSize: number;
  interpretation: string;
}

/**
 * Calculate confidence interval for accuracy using Wilson score interval
 * (More accurate than normal approximation for small samples)
 */
export function calculateConfidenceInterval(
  correct: number, 
  total: number, 
  confidenceLevel: number = 0.95
): ConfidenceInterval {
  if (total === 0) {
    return { lower: 0, upper: 0, level: confidenceLevel };
  }

  const z = getZScore(confidenceLevel);
  const p = correct / total;
  const n = total;
  
  // Wilson score interval (better for small samples)
  const denominator = 1 + z * z / n;
  const center = (p + z * z / (2 * n)) / denominator;
  const margin = (z / denominator) * Math.sqrt((p * (1 - p) + z * z / (4 * n)) / n);
  
  return {
    lower: Math.max(0, center - margin),
    upper: Math.min(1, center + margin),
    level: confidenceLevel
  };
}

/**
 * Get Z-score for confidence level
 */
function getZScore(confidenceLevel: number): number {
  const alpha = 1 - confidenceLevel;
  // Common confidence levels
  if (confidenceLevel === 0.90) return 1.645;
  if (confidenceLevel === 0.95) return 1.96;
  if (confidenceLevel === 0.99) return 2.576;
  
  // Approximation for other levels
  return Math.sqrt(2) * Math.sqrt(-Math.log(alpha / 2));
}

/**
 * Perform McNemar's test for comparing two classification methods
 * (Appropriate for paired samples on same dataset)
 */
export function mcNemarTest(
  method1Results: boolean[], 
  method2Results: boolean[]
): StatisticalTestResult {
  if (method1Results.length !== method2Results.length) {
    throw new Error('Methods must have same number of results');
  }

  const n = method1Results.length;
  
  // Create contingency table
  let both_correct = 0;      // Method 1 correct, Method 2 correct
  let method1_only = 0;      // Method 1 correct, Method 2 wrong
  let method2_only = 0;      // Method 1 wrong, Method 2 correct
  let both_wrong = 0;        // Method 1 wrong, Method 2 wrong
  
  for (let i = 0; i < n; i++) {
    if (method1Results[i] && method2Results[i]) both_correct++;
    else if (method1Results[i] && !method2Results[i]) method1_only++;
    else if (!method1Results[i] && method2Results[i]) method2_only++;
    else both_wrong++;
  }

  // McNemar's statistic: Chi-square with continuity correction
  const discordant = method1_only + method2_only;
  
  if (discordant < 10) {
    // Use exact binomial test for small samples
    const p = Math.min(method1_only, method2_only) / discordant;
    const pValue = 2 * binomialCDF(Math.min(method1_only, method2_only), discordant, 0.5);
    
    return {
      pValue,
      significant: pValue < 0.05,
      effectSize: calculateCohenG(method1_only, method2_only),
      confidenceInterval: { lower: 0, upper: 1 }, // TODO: Implement exact CI
      testType: 'McNemar (Exact Binomial)',
      interpretation: interpretMcNemar(pValue, method1_only, method2_only, n)
    };
  } else {
    // Chi-square approximation with continuity correction
    const chiSquare = Math.pow(Math.abs(method1_only - method2_only) - 1, 2) / discordant;
    const pValue = 1 - chiSquareCDF(chiSquare, 1);
    
    return {
      pValue,
      significant: pValue < 0.05,
      effectSize: calculateCohenG(method1_only, method2_only),
      confidenceInterval: { lower: 0, upper: 1 }, // TODO: Implement CI for difference
      testType: 'McNemar (Chi-square)',
      interpretation: interpretMcNemar(pValue, method1_only, method2_only, n)
    };
  }
}

/**
 * Calculate Cohen's g effect size for McNemar's test
 */
function calculateCohenG(method1_only: number, method2_only: number): number {
  const total_discordant = method1_only + method2_only;
  if (total_discordant === 0) return 0;
  
  return Math.abs(method1_only - method2_only) / Math.sqrt(total_discordant);
}

/**
 * Interpret McNemar's test result
 */
function interpretMcNemar(
  pValue: number, 
  method1_only: number, 
  method2_only: number, 
  n: number
): string {
  const significanceLevel = pValue < 0.05 ? 'significant' : 'not significant';
  const betterMethod = method1_only > method2_only ? 'Method 1' : 'Method 2';
  const difference = Math.abs(method1_only - method2_only);
  
  let interpretation = `McNemar's test result: ${significanceLevel} (p = ${pValue.toFixed(4)}). `;
  
  if (pValue < 0.05) {
    interpretation += `${betterMethod} performs significantly better. `;
    interpretation += `Difference in disagreements: ${difference}/${n} cases (${(difference/n*100).toFixed(1)}%).`;
  } else {
    interpretation += `No significant difference between methods. `;
    interpretation += `Consider larger sample size for definitive comparison.`;
  }
  
  return interpretation;
}

/**
 * Calculate required sample size for detecting a given effect size
 */
export function calculateRequiredSampleSize(
  expectedDifference: number,
  baselineAccuracy: number = 0.8,
  alpha: number = 0.05,
  power: number = 0.8
): PowerAnalysis {
  // For McNemar's test, sample size depends on discordant pairs
  const p1 = baselineAccuracy;
  const p2 = baselineAccuracy + expectedDifference;
  
  // Approximate discordant proportion
  const p12 = p1 * (1 - p2) + p2 * (1 - p1);
  
  // Effect size (difference in discordant proportions)
  const delta = Math.abs(p1 * (1 - p2) - p2 * (1 - p1));
  
  if (delta === 0) {
    return {
      requiredSampleSize: Infinity,
      currentPower: 0,
      recommendedSampleSize: 1000,
      interpretation: 'Cannot detect zero effect size. Specify meaningful difference.'
    };
  }
  
  // Z-scores for alpha and power
  const z_alpha = getZScore(1 - alpha / 2);
  const z_power = getZScore(power);
  
  // Sample size calculation for McNemar's test
  const n = Math.pow(z_alpha + z_power, 2) * p12 / Math.pow(delta, 2);
  
  const requiredSampleSize = Math.ceil(n);
  const recommendedSampleSize = Math.max(100, Math.ceil(n * 1.2)); // 20% buffer
  
  return {
    requiredSampleSize,
    currentPower: power,
    recommendedSampleSize,
    interpretation: `To detect a ${(expectedDifference * 100).toFixed(1)}% difference with ${(power * 100)}% power: ${requiredSampleSize} samples needed`
  };
}

/**
 * Assess statistical power of current study
 */
export function assessStatisticalPower(
  currentSampleSize: number,
  observedDifference: number,
  alpha: number = 0.05
): number {
  if (observedDifference === 0) return 0;
  
  // Simplified power calculation
  const z_alpha = getZScore(1 - alpha / 2);
  const effect_size = observedDifference / Math.sqrt(1 / currentSampleSize);
  const z_power = effect_size - z_alpha;
  
  // Convert to power (approximate)
  return Math.max(0, Math.min(1, normalCDF(z_power)));
}

/**
 * Comprehensive statistical comparison of multiple methods
 */
export function compareMultipleMethods(
  methodResults: Record<string, ClassificationResult>
): {
  pairwiseComparisons: Record<string, StatisticalTestResult>;
  overallAnalysis: {
    sampleSize: number;
    statisticalPower: number;
    recommendations: string[];
  };
} {
  const methodNames = Object.keys(methodResults);
  const pairwiseComparisons: Record<string, StatisticalTestResult> = {};
  
  // Convert results to boolean arrays for McNemar's test
  const booleanResults: Record<string, boolean[]> = {};
  let sampleSize = 0;
  
  for (const [name, result] of Object.entries(methodResults)) {
    // Assume uniform distribution of correct/incorrect across samples
    const boolArray: boolean[] = [];
    sampleSize = result.total;
    
    // Create boolean array representing correct/incorrect predictions
    for (let i = 0; i < result.correct; i++) {
      boolArray.push(true);
    }
    for (let i = 0; i < result.total - result.correct; i++) {
      boolArray.push(false);
    }
    
    // Shuffle to avoid ordering bias
    for (let i = boolArray.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [boolArray[i], boolArray[j]] = [boolArray[j], boolArray[i]];
    }
    
    booleanResults[name] = boolArray;
  }
  
  // Perform pairwise comparisons
  for (let i = 0; i < methodNames.length; i++) {
    for (let j = i + 1; j < methodNames.length; j++) {
      const method1 = methodNames[i];
      const method2 = methodNames[j];
      const comparisonKey = `${method1}_vs_${method2}`;
      
      try {
        pairwiseComparisons[comparisonKey] = mcNemarTest(
          booleanResults[method1],
          booleanResults[method2]
        );
      } catch (error) {
        pairwiseComparisons[comparisonKey] = {
          pValue: 1.0,
          significant: false,
          effectSize: 0,
          confidenceInterval: { lower: 0, upper: 1 },
          testType: 'Error',
          interpretation: `Error comparing methods: ${error}`
        };
      }
    }
  }
  
  // Overall analysis
  const accuracies = Object.values(methodResults).map(r => r.accuracy);
  const maxDifference = Math.max(...accuracies) - Math.min(...accuracies);
  const statisticalPower = assessStatisticalPower(sampleSize, maxDifference);
  
  const recommendations: string[] = [];
  
  if (sampleSize < 50) {
    recommendations.push(`⚠️  Small sample size (${sampleSize}). Consider at least 100 samples for reliable statistical testing.`);
  }
  
  if (statisticalPower < 0.8) {
    const powerAnalysis = calculateRequiredSampleSize(0.1); // 10% difference
    recommendations.push(`⚠️  Low statistical power (${(statisticalPower * 100).toFixed(1)}%). ${powerAnalysis.interpretation}`);
  }
  
  const significantComparisons = Object.values(pairwiseComparisons).filter(c => c.significant).length;
  const totalComparisons = Object.keys(pairwiseComparisons).length;
  
  if (significantComparisons === 0 && totalComparisons > 0) {
    recommendations.push('🔍 No significant differences detected. Consider larger sample size or different methods.');
  } else if (significantComparisons > 0) {
    recommendations.push(`✅ Found ${significantComparisons}/${totalComparisons} significant method differences.`);
  }
  
  return {
    pairwiseComparisons,
    overallAnalysis: {
      sampleSize,
      statisticalPower,
      recommendations
    }
  };
}

// Helper statistical functions
function binomialCDF(k: number, n: number, p: number): number {
  let sum = 0;
  for (let i = 0; i <= k; i++) {
    sum += binomialPMF(i, n, p);
  }
  return sum;
}

function binomialPMF(k: number, n: number, p: number): number {
  return binomialCoefficient(n, k) * Math.pow(p, k) * Math.pow(1 - p, n - k);
}

function binomialCoefficient(n: number, k: number): number {
  if (k > n) return 0;
  if (k === 0 || k === n) return 1;
  
  let result = 1;
  for (let i = 1; i <= k; i++) {
    result = result * (n - i + 1) / i;
  }
  return result;
}

function chiSquareCDF(x: number, df: number): number {
  // Simplified approximation for df = 1
  if (df === 1) {
    return 2 * normalCDF(Math.sqrt(x)) - 1;
  }
  // For other degrees of freedom, use gamma function approximation
  return gammaIncomplete(df / 2, x / 2);
}

function normalCDF(x: number): number {
  // Standard normal CDF approximation
  return 0.5 * (1 + erf(x / Math.sqrt(2)));
}

function erf(x: number): number {
  // Error function approximation
  const a1 =  0.254829592;
  const a2 = -0.284496736;
  const a3 =  1.421413741;
  const a4 = -1.453152027;
  const a5 =  1.061405429;
  const p  =  0.3275911;

  const sign = x < 0 ? -1 : 1;
  x = Math.abs(x);

  const t = 1.0 / (1.0 + p * x);
  const y = 1.0 - (((((a5 * t + a4) * t) + a3) * t + a2) * t + a1) * t * Math.exp(-x * x);

  return sign * y;
}

function gammaIncomplete(a: number, x: number): number {
  // Simplified incomplete gamma function
  if (x === 0) return 0;
  if (a === 0.5) return erf(Math.sqrt(x));
  
  // Use series expansion for small values
  let sum = 0;
  let term = 1;
  for (let n = 0; n < 100; n++) {
    sum += term;
    term *= x / (a + n);
    if (term < 1e-10) break;
  }
  
  return sum * Math.pow(x, a) * Math.exp(-x) / gamma(a);
}

function gamma(z: number): number {
  // Stirling's approximation for gamma function
  if (z === 0.5) return Math.sqrt(Math.PI);
  if (z === 1) return 1;
  if (z === 1.5) return Math.sqrt(Math.PI) / 2;
  
  return Math.sqrt(2 * Math.PI / z) * Math.pow(z / Math.E, z);
}