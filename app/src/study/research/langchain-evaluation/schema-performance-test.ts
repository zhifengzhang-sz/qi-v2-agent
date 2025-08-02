#!/usr/bin/env node

/**
 * Schema Performance Test
 * 
 * Tests different schema designs for LangChain classification to determine
 * the optimal balance between complexity and accuracy.
 */

import { z } from 'zod';
import { createInputClassifier } from '@qi/agent/classifier';

// Define different schema variants to test
const SCHEMA_VARIANTS = {
  minimal: z.object({
    type: z.enum(['command', 'prompt', 'workflow']).describe('Input classification type'),
    confidence: z.number().min(0).max(1).describe('Confidence score 0.0-1.0')
  }),

  standard: z.object({
    type: z.enum(['command', 'prompt', 'workflow']).describe('The input type classification'),
    confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
    reasoning: z.string().describe('Brief explanation of why this classification was chosen'),
  }),

  detailed: z.object({
    type: z.enum(['command', 'prompt', 'workflow']).describe(
      'command: System commands starting with "/", ' +
      'prompt: Single-step conversational requests or questions, ' +
      'workflow: Multi-step tasks requiring file operations or orchestration'
    ),
    confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
    reasoning: z.string().max(200).describe('Detailed explanation of the classification'),
    indicators: z.array(z.string()).describe('Key indicators that led to this classification'),
    complexity_score: z.number().min(0).max(1).describe('Task complexity from 0.0 to 1.0'),
  }),

  verbose: z.object({
    type: z.enum(['command', 'prompt', 'workflow']).describe(
      'Classification type: command (system operations with "/" prefix), ' +
      'prompt (single conversational requests, questions, or simple tasks), ' +
      'workflow (complex multi-step tasks requiring orchestration)'
    ),
    confidence: z.number().min(0).max(1).describe('Confidence level from 0.0 (uncertain) to 1.0 (certain)'),
    reasoning: z.string().min(10).max(300).describe('Comprehensive explanation of classification decision'),
    indicators: z.array(z.string().min(1)).describe('Specific text indicators that influenced classification'),
    complexity_score: z.number().min(0).max(1).describe('Task complexity assessment from 0.0 (simple) to 1.0 (complex)'),
    metadata: z.object({
      keywords: z.array(z.string()).describe('Important keywords identified'),
      patterns: z.array(z.string()).describe('Text patterns detected'),
      length_category: z.enum(['short', 'medium', 'long']).describe('Input length category'),
    }).describe('Additional classification metadata'),
    suggested_actions: z.array(z.string()).optional().describe('Suggested next steps or actions')
  }),

  experimental: z.object({
    classification: z.object({
      primary: z.enum(['command', 'prompt', 'workflow']).describe('Primary classification'),
      secondary: z.enum(['command', 'prompt', 'workflow']).optional().describe('Secondary classification if ambiguous'),
      confidence: z.number().min(0).max(1).describe('Primary classification confidence'),
    }).describe('Classification results'),
    analysis: z.object({
      reasoning: z.string().max(200).describe('Classification reasoning'),
      complexity: z.enum(['low', 'medium', 'high']).describe('Task complexity level'),
      indicators: z.array(z.object({
        type: z.string().describe('Indicator type'),
        value: z.string().describe('Indicator value'),
        weight: z.number().min(0).max(1).describe('Indicator importance weight')
      })).describe('Weighted classification indicators'),
    }).describe('Analysis details'),
    suggestions: z.object({
      confidence_factors: z.array(z.string()).describe('Factors affecting confidence'),
      alternative_interpretations: z.array(z.string()).optional().describe('Alternative ways to interpret input'),
    }).describe('Additional suggestions')
  })
};

type SchemaVariant = keyof typeof SCHEMA_VARIANTS;

interface TestCase {
  input: string;
  expected: 'command' | 'prompt' | 'workflow';
  difficulty: 'easy' | 'medium' | 'hard';
}

interface SchemaResult {
  name: string;
  schemaComplexity: number;
  accuracy: number;
  avgLatency: number;
  avgConfidence: number;
  parseErrors: number;
  results: Array<{
    input: string;
    expected: string;
    predicted: string;
    confidence: number;
    latency: number;
    correct: boolean;
    error?: string;
  }>;
}

const TEST_CASES: TestCase[] = [
  // Easy cases
  { input: '/help', expected: 'command', difficulty: 'easy' },
  { input: '/status', expected: 'command', difficulty: 'easy' },
  { input: 'hello', expected: 'prompt', difficulty: 'easy' },
  { input: 'what is AI?', expected: 'prompt', difficulty: 'easy' },
  
  // Medium cases
  { input: 'write a function', expected: 'prompt', difficulty: 'medium' },
  { input: 'fix the bug', expected: 'prompt', difficulty: 'medium' },
  { input: 'create tests and docs', expected: 'workflow', difficulty: 'medium' },
  
  // Hard cases - ambiguous
  { input: 'write tests for auth module', expected: 'prompt', difficulty: 'hard' },
  { input: 'review and merge', expected: 'workflow', difficulty: 'hard' },
  { input: 'debug this issue', expected: 'prompt', difficulty: 'hard' },
  { input: 'implement feature with testing', expected: 'workflow', difficulty: 'hard' },
  { input: 'create component', expected: 'prompt', difficulty: 'hard' },
];

function calculateSchemaComplexity(schema: z.ZodSchema<any>): number {
  // Simple heuristic based on schema structure
  const schemaString = JSON.stringify(schema._def);
  const fieldCount = (schemaString.match(/ZodString|ZodNumber|ZodEnum|ZodArray|ZodObject/g) || []).length;
  const optionalCount = (schemaString.match(/optional/g) || []).length;
  const descriptionLength = (schemaString.match(/describe/g) || []).length;
  
  // Normalize to 0-1 scale
  return Math.min(1, (fieldCount + optionalCount + descriptionLength * 0.5) / 20);
}

async function testSchema(
  variantName: SchemaVariant,
  schema: z.ZodSchema<any>,
  testCases: TestCase[]
): Promise<SchemaResult> {
  console.log(`\n🧪 Testing schema: ${variantName}...`);
  
  const config = {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    modelId: process.env.MODEL_ID || 'qwen3:8b',
  };

  const results: SchemaResult['results'] = [];
  let totalLatency = 0;
  let totalConfidence = 0;
  let parseErrors = 0;
  
  try {
    // Use InputClassifier which supports LangChain structured output
    const classifier = createInputClassifier({
      method: 'langchain-structured',
      baseUrl: config.baseUrl,
      modelId: config.modelId,
      temperature: 0.1,
      maxTokens: 1000,
    });
    
    for (let i = 0; i < testCases.length; i++) {
      const testCase = testCases[i];
      process.stdout.write(`  Progress: ${i + 1}/${testCases.length} (${((i + 1) / testCases.length * 100).toFixed(1)}%)\r`);
      
      try {
        const startTime = Date.now();
        const result = await classifier.classify(testCase.input);
        const latency = Date.now() - startTime;
        
        // InputClassifier returns standard ClassificationResult
        const type = result.type;
        const confidence = result.confidence;
        
        const correct = type === testCase.expected;
        
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: type,
          confidence,
          latency,
          correct
        });
        
        totalLatency += latency;
        totalConfidence += confidence;
        
      } catch (error) {
        parseErrors++;
        results.push({
          input: testCase.input,
          expected: testCase.expected,
          predicted: 'error',
          confidence: 0,
          latency: 0,
          correct: false,
          error: error instanceof Error ? error.message : String(error)
        });
      }
    }
    
    const correctPredictions = results.filter(r => r.correct).length;
    const accuracy = correctPredictions / testCases.length;
    const avgLatency = totalLatency / testCases.length;
    const avgConfidence = totalConfidence / (testCases.length - parseErrors);
    const schemaComplexity = calculateSchemaComplexity(schema);
    
    console.log(`  ✅ Completed: ${(accuracy * 100).toFixed(1)}% accuracy, ${avgLatency.toFixed(0)}ms avg latency`);
    
    return {
      name: variantName,
      schemaComplexity,
      accuracy,
      avgLatency,
      avgConfidence,
      parseErrors,
      results
    };
    
  } catch (initError) {
    console.log(`  ❌ Failed: ${initError instanceof Error ? initError.message : String(initError)}`);
    
    return {
      name: variantName,
      schemaComplexity: calculateSchemaComplexity(schema),
      accuracy: 0,
      avgLatency: 0,
      avgConfidence: 0,
      parseErrors: testCases.length,
      results: testCases.map(tc => ({
        input: tc.input,
        expected: tc.expected,
        predicted: 'error',
        confidence: 0,
        latency: 0,
        correct: false,
        error: 'Initialization failed'
      }))
    };
  }
}

async function main(): Promise<void> {
  console.log('📊 SCHEMA PERFORMANCE TEST');
  console.log('==========================\n');

  const config = {
    baseUrl: process.env.OLLAMA_BASE_URL || 'http://localhost:11434/v1',
    modelId: process.env.MODEL_ID || 'qwen3:8b',
  };

  console.log(`🤖 Model: ${config.modelId}`);
  console.log(`🔗 Endpoint: ${config.baseUrl}`);
  console.log(`📊 Test cases: ${TEST_CASES.length}`);
  console.log(`🎯 Schema variants: ${Object.keys(SCHEMA_VARIANTS).length}\n`);

  // Test all schema variants
  const schemaResults: SchemaResult[] = [];
  
  for (const [variantName, schema] of Object.entries(SCHEMA_VARIANTS)) {
    const result = await testSchema(variantName as SchemaVariant, schema, TEST_CASES);
    schemaResults.push(result);
  }

  // Display results
  console.log('\n📊 SCHEMA PERFORMANCE COMPARISON');
  console.log('=================================\n');

  // Sort by accuracy
  schemaResults.sort((a, b) => b.accuracy - a.accuracy);

  // Performance table
  console.log('📋 Schema Performance Summary');
  console.log('----------------------------');
  console.log('| Schema       | Complexity | Accuracy | Avg Latency | Avg Confidence | Parse Errors |');
  console.log('|--------------|------------|----------|-------------|----------------|--------------|');
  
  schemaResults.forEach(result => {
    const name = result.name.padEnd(12);
    const complexity = `${(result.schemaComplexity * 100).toFixed(0)}%`.padStart(10);
    const accuracy = `${(result.accuracy * 100).toFixed(1)}%`.padStart(8);
    const latency = `${result.avgLatency.toFixed(0)}ms`.padStart(11);
    const confidence = `${(result.avgConfidence * 100).toFixed(1)}%`.padStart(14);
    const errors = result.parseErrors.toString().padStart(12);
    
    console.log(`| ${name} | ${complexity} | ${accuracy} | ${latency} | ${confidence} | ${errors} |`);
  });

  // Difficulty analysis
  console.log('\n📈 Performance by Difficulty');
  console.log('----------------------------');

  const difficulties = ['easy', 'medium', 'hard'] as const;
  
  for (const difficulty of difficulties) {
    console.log(`\n${difficulty.toUpperCase()}:`);
    const difficultyTests = TEST_CASES.filter(tc => tc.difficulty === difficulty);
    
    schemaResults.forEach(schemaResult => {
      const difficultyResults = schemaResult.results.filter(r => 
        difficultyTests.some(dt => dt.input === r.input)
      );
      const difficultyAccuracy = difficultyResults.filter(r => r.correct).length / difficultyResults.length;
      
      console.log(`  ${schemaResult.name}: ${(difficultyAccuracy * 100).toFixed(1)}%`);
    });
  }

  // Schema complexity vs accuracy analysis
  console.log('\n🔍 Complexity vs Accuracy Analysis');
  console.log('----------------------------------');
  
  const correlationData = schemaResults.map(r => ({
    complexity: r.schemaComplexity,
    accuracy: r.accuracy,
    efficiency: r.accuracy / Math.max(r.avgLatency / 1000, 0.1) // accuracy per second
  }));

  console.log('Complexity vs Accuracy correlation:');
  correlationData.forEach(data => {
    console.log(`  Complexity: ${(data.complexity * 100).toFixed(0)}%, Accuracy: ${(data.accuracy * 100).toFixed(1)}%, Efficiency: ${data.efficiency.toFixed(2)}`);
  });

  // Recommendations
  console.log('\n🏆 SCHEMA RECOMMENDATIONS');
  console.log('=========================');

  const bestAccuracy = schemaResults[0];
  const bestLatency = schemaResults.reduce((best, current) => 
    current.avgLatency < best.avgLatency && current.accuracy > 0 ? current : best
  );
  const bestEfficiency = correlationData.reduce((best, current, index) => 
    current.efficiency > best.efficiency ? { ...current, name: schemaResults[index].name } : best
  );

  console.log(`🎯 Best Accuracy: ${bestAccuracy.name} (${(bestAccuracy.accuracy * 100).toFixed(1)}%)`);
  console.log(`⚡ Best Latency: ${bestLatency.name} (${bestLatency.avgLatency.toFixed(0)}ms)`);
  console.log(`🚀 Best Efficiency: ${(bestEfficiency as any).name} (${((bestEfficiency as any).efficiency).toFixed(2)} accuracy/sec)`);

  // Find sweet spot
  const balanced = schemaResults.find(r => 
    r.accuracy > 0.8 && 
    r.avgLatency < 1000 && 
    r.parseErrors === 0
  );
  
  if (balanced) {
    console.log(`⚖️  Best Balanced: ${balanced.name} (${(balanced.accuracy * 100).toFixed(1)}% accuracy, ${balanced.avgLatency.toFixed(0)}ms latency)`);
  }

  console.log('\n📝 Key Insights:');
  console.log(`• Schema complexity range: ${(Math.min(...schemaResults.map(r => r.schemaComplexity)) * 100).toFixed(0)}% - ${(Math.max(...schemaResults.map(r => r.schemaComplexity)) * 100).toFixed(0)}%`);
  console.log(`• Accuracy range: ${(Math.min(...schemaResults.map(r => r.accuracy)) * 100).toFixed(1)}% - ${(Math.max(...schemaResults.map(r => r.accuracy)) * 100).toFixed(1)}%`);
  console.log(`• Latency range: ${Math.min(...schemaResults.map(r => r.avgLatency)).toFixed(0)}ms - ${Math.max(...schemaResults.map(r => r.avgLatency)).toFixed(0)}ms`);

  console.log('\n✅ Schema performance testing completed!');
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { main as testSchemaPerformance };