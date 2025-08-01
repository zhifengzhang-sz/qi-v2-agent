#!/usr/bin/env node

/**
 * LangChain Structured Output Classification Test
 * 
 * Tests LangChain's withStructuredOutput method with Zod schema validation
 * for three-type classification. This demonstrates the latest LangChain 2024-2025
 * structured output capabilities and evaluation methods.
 */

import { z } from 'zod';
import { ChatOllama } from '@langchain/ollama';
import { ChatOpenAI } from '@langchain/openai';
import { ChatGroq } from '@langchain/groq';

/**
 * Comprehensive Zod schema for classification with detailed metadata
 * Based on LangChain structured output best practices
 */
const ClassificationSchema = z.object({
  type: z.enum(['command', 'prompt', 'workflow']).describe(
    'The primary classification type: command (system function), prompt (simple request), workflow (multi-step task)'
  ),
  confidence: z.number().min(0).max(1).describe(
    'Confidence score between 0 and 1, where 1 is completely certain'
  ),
  reasoning: z.string().min(10).describe(
    'Detailed explanation of why this classification was chosen, including key indicators'
  ),
  primary_indicators: z.array(z.string()).describe(
    'Main words, patterns, or structures that led to this classification'
  ),
  complexity_score: z.number().min(0).max(1).describe(
    'How complex the request is: 0 = very simple, 1 = highly complex'
  ),
  ambiguity_level: z.enum(['low', 'medium', 'high']).describe(
    'How ambiguous or unclear the input is'
  ),
  alternative_classification: z.object({
    type: z.enum(['command', 'prompt', 'workflow']).optional(),
    probability: z.number().min(0).max(1).optional(),
    reason: z.string().optional()
  }).optional().describe('Alternative classification if the input is ambiguous'),
  metadata: z.object({
    word_count: z.number(),
    has_technical_terms: z.boolean(),
    has_multiple_actions: z.boolean(),
    contains_file_references: z.boolean(),
    urgency_level: z.enum(['low', 'medium', 'high'])
  }).describe('Additional metadata about the input')
});

type StructuredClassification = z.infer<typeof ClassificationSchema>;

/**
 * Test dataset with challenging cases for structured output validation
 */
const structuredTestCases: Array<[string, 'command' | 'prompt' | 'workflow', string]> = [
  // Clear command cases
  ['/help', 'command', 'Simple system command'],
  ['/config show', 'command', 'Command with parameter'],
  ['/status --verbose', 'command', 'Command with flag'],
  
  // Clear prompt cases  
  ['what is TypeScript?', 'prompt', 'Direct question'],
  ['explain async/await', 'prompt', 'Educational request'],
  ['write a hello world function', 'prompt', 'Simple creation task'],
  
  // Clear workflow cases
  ['fix the bug in auth.ts and run all tests', 'workflow', 'Multi-step with file reference'],
  ['implement OAuth, add tests, and update docs', 'workflow', 'Complex multi-step task'],
  ['analyze performance and optimize database queries', 'workflow', 'Analysis and optimization workflow'],
  
  // Ambiguous/challenging cases for structured output testing
  ['test the login feature', 'prompt', 'Could be simple or complex'],
  ['debug this code and fix issues', 'workflow', 'Debugging workflow'],
  ['create a REST API with authentication', 'workflow', 'Complex creation task'],
  ['help me understand closures', 'prompt', 'Help-based learning request'],
  ['build and deploy to staging', 'workflow', 'Build and deployment pipeline'],
  ['what does /status command do?', 'prompt', 'Question about a command'],
  ['run the tests', 'prompt', 'Simple action, not workflow'],
  ['setup CI/CD pipeline with monitoring', 'workflow', 'Infrastructure setup'],
  ['fix this', 'prompt', 'Vague request'],
  ['implement feature X with tests and documentation', 'workflow', 'Full feature implementation']
];

/**
 * Classification prompt template optimized for structured output
 */
const CLASSIFICATION_PROMPT = `You are an expert at classifying user inputs into three categories:

1. **COMMAND**: System functions that start with "/" or are direct system operations
   - Examples: /help, /status, /config
   - Characteristics: System control, immediate execution, single operation

2. **PROMPT**: Simple conversational requests or questions that expect a single response
   - Examples: "what is X?", "write a function", "explain Y"
   - Characteristics: Information seeking, simple creation, single deliverable

3. **WORKFLOW**: Complex multi-step tasks requiring coordination of multiple actions
   - Examples: "fix bug and run tests", "implement feature with tests and docs"
   - Characteristics: Multiple steps, coordination needed, complex deliverables

Analyze the input carefully and provide a detailed classification with your reasoning.

Input to classify: "{input}"`;

/**
 * Create structured output classifier using state manager for config
 */
async function createStructuredClassifier(provider: 'ollama' | 'openai' | 'groq' = 'ollama', modelOverride?: string) {
  // Use state manager to load configuration
  const { createStateManager } = await import('@qi/agent/state');
  const stateManager = createStateManager();
  
  // Load LLM configuration from config file
  // Go up from app/ to root, then to config/
  const configPath = process.cwd().replace('/app', '') + '/config';
  await stateManager.loadLLMConfig(configPath);
  const classifierConfig = stateManager.getClassifierConfig();
  
  if (!classifierConfig) {
    throw new Error('Classifier configuration not found in config/llm-providers.yaml');
  }
  
  // Use command line override or config default
  const modelToUse = modelOverride || classifierConfig.model;
  const providerToUse = provider || classifierConfig.provider;
  
  console.log(`🔧 Using ${providerToUse} provider with model: ${modelToUse}`);
  console.log(`🌡️ Temperature: ${classifierConfig.temperature}, Max Tokens: ${classifierConfig.maxTokens}`);
  
  let model: ChatOllama | ChatOpenAI | ChatGroq;
  
  switch (providerToUse) {
    case 'ollama':
      // Get Ollama base URL from config
      const llmConfig = stateManager.getLLMConfigForPromptModule();
      const ollamaProvider = llmConfig?.llm?.providers?.ollama;
      
      if (!ollamaProvider?.baseURL) {
        throw new Error('No Ollama provider configuration found in config');
      }
      
      const baseUrl = ollamaProvider.baseURL;
      
      model = new ChatOllama({
        baseUrl,
        model: modelToUse,
        temperature: classifierConfig.temperature,
        maxTokens: classifierConfig.maxTokens,
      });
      break;
      
    case 'openai':
      model = new ChatOpenAI({
        modelName: modelToUse,
        temperature: classifierConfig.temperature,
        maxTokens: classifierConfig.maxTokens,
      });
      break;
      
    case 'groq':
      model = new ChatGroq({
        modelName: modelToUse,
        temperature: classifierConfig.temperature,
        maxTokens: classifierConfig.maxTokens,
      });
      break;
      
    default:
      throw new Error(`Unsupported provider: ${providerToUse}`);
  }
  
  // Use LangChain's withStructuredOutput method
  const structuredModel = model.withStructuredOutput(ClassificationSchema, {
    name: 'classify_input',
    description: 'Classify user input into command, prompt, or workflow categories'
  });
  
  return async (input: string): Promise<StructuredClassification> => {
    try {
      const prompt = CLASSIFICATION_PROMPT.replace('{input}', input);
      const result = await structuredModel.invoke(prompt);
      
      // Ensure the result matches our schema
      return ClassificationSchema.parse(result);
    } catch (error) {
      console.warn(`Structured classification failed for "${input}":`, error);
      
      // Fallback classification
      return {
        type: 'prompt',
        confidence: 0.1,
        reasoning: `Classification failed due to error: ${error}. Defaulting to prompt.`,
        primary_indicators: ['error_fallback'],
        complexity_score: 0.5,
        ambiguity_level: 'high',
        metadata: {
          word_count: input.split(' ').length,
          has_technical_terms: false,
          has_multiple_actions: false,
          contains_file_references: false,
          urgency_level: 'low'
        }
      };
    }
  };
}

/**
 * Evaluation metrics for structured output
 */
interface StructuredTestResult {
  input: string;
  expected: string;
  predicted: string;
  correct: boolean;
  confidence: number;
  latency: number;
  reasoning: string;
  complexity_score: number;
  ambiguity_level: string;
  metadata: any;
  schema_valid: boolean;
}

/**
 * Test structured output classifier
 */
async function testStructuredClassifier(
  classifier: (input: string) => Promise<StructuredClassification>,
  testCase: [string, string, string]
): Promise<StructuredTestResult> {
  const [input, expected, description] = testCase;
  const start = Date.now();
  
  try {
    const result = await classifier(input);
    const latency = Date.now() - start;
    
    // Validate schema compliance
    let schema_valid = true;
    try {
      ClassificationSchema.parse(result);
    } catch {
      schema_valid = false;
    }
    
    return {
      input,
      expected,
      predicted: result.type,
      correct: result.type === expected,
      confidence: result.confidence,
      latency,
      reasoning: result.reasoning,
      complexity_score: result.complexity_score,
      ambiguity_level: result.ambiguity_level,
      metadata: result.metadata,
      schema_valid
    };
  } catch (error) {
    console.warn(`Test failed for "${input}":`, error);
    return {
      input,
      expected,
      predicted: 'error',
      correct: false,
      confidence: 0,
      latency: Date.now() - start,
      reasoning: `Error: ${error}`,
      complexity_score: 0,
      ambiguity_level: 'high',
      metadata: {},
      schema_valid: false
    };
  }
}

/**
 * Comprehensive evaluation of structured output performance
 */
async function evaluateStructuredOutput(provider: 'ollama' | 'openai' | 'groq' = 'ollama', modelOverride?: string) {
  console.log(`🧪 LangChain Structured Output Classification Test (${provider.toUpperCase()})`);
  console.log('═'.repeat(70));
  console.log(`📊 Test Cases: ${structuredTestCases.length}`);
  console.log(`🔧 Provider: ${provider}`);
  if (modelOverride) {
    console.log(`🎯 Model Override: ${modelOverride}`);
  }
  console.log(`📋 Schema: Comprehensive Zod validation`);
  console.log('');
  
  try {
    // Create structured classifier
    console.log('🔧 Initializing structured output classifier...');
    const classifier = await createStructuredClassifier(provider, modelOverride);
    
    // Run tests
    console.log('🔍 Running structured output classification tests...');
    const results: StructuredTestResult[] = [];
    
    for (let i = 0; i < structuredTestCases.length; i++) {
      const testCase = structuredTestCases[i];
      console.log(`  Testing ${i + 1}/${structuredTestCases.length}: "${testCase[0]}"`);
      
      const result = await testStructuredClassifier(classifier, testCase);
      results.push(result);
      
      // Brief delay to avoid overwhelming the API
      await new Promise(resolve => setTimeout(resolve, 100));
    }
    
    // Calculate metrics
    const validResults = results.filter(r => r.predicted !== 'error');
    const correctResults = validResults.filter(r => r.correct);
    const schemaValidResults = validResults.filter(r => r.schema_valid);
    
    const accuracy = (correctResults.length / validResults.length) * 100;
    const avgLatency = validResults.reduce((sum, r) => sum + r.latency, 0) / validResults.length;
    const avgConfidence = validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length;
    const schemaCompliance = (schemaValidResults.length / validResults.length) * 100;
    const avgComplexity = validResults.reduce((sum, r) => sum + r.complexity_score, 0) / validResults.length;
    
    // Display results
    console.log('\n📊 STRUCTURED OUTPUT EVALUATION RESULTS');
    console.log('═'.repeat(60));
    console.log(`🎯 Overall Accuracy: ${accuracy.toFixed(1)}% (${correctResults.length}/${validResults.length})`);
    console.log(`⚡ Average Latency: ${avgLatency.toFixed(0)}ms`);
    console.log(`🎲 Average Confidence: ${avgConfidence.toFixed(3)}`);
    console.log(`📋 Schema Compliance: ${schemaCompliance.toFixed(1)}% (${schemaValidResults.length}/${validResults.length})`);
    console.log(`🔧 Average Complexity Score: ${avgComplexity.toFixed(3)}`);
    
    // Type-specific accuracy
    const typeAccuracy = {
      command: 0,
      prompt: 0,
      workflow: 0
    };
    
    (['command', 'prompt', 'workflow'] as const).forEach(type => {
      const typeResults = validResults.filter(r => r.expected === type);
      const typeCorrect = typeResults.filter(r => r.correct).length;
      typeAccuracy[type] = typeResults.length > 0 ? (typeCorrect / typeResults.length) * 100 : 0;
    });
    
    console.log('\n🏷️ Type-Specific Performance');
    console.log('─'.repeat(40));
    console.log(`Command: ${typeAccuracy.command.toFixed(1)}%`);
    console.log(`Prompt: ${typeAccuracy.prompt.toFixed(1)}%`);
    console.log(`Workflow: ${typeAccuracy.workflow.toFixed(1)}%`);
    
    // Ambiguity analysis
    const ambiguityLevels = validResults.reduce((acc, r) => {
      acc[r.ambiguity_level] = (acc[r.ambiguity_level] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    console.log('\n🌫️ Ambiguity Level Distribution');
    console.log('─'.repeat(40));
    Object.entries(ambiguityLevels).forEach(([level, count]) => {
      const percentage = (count / validResults.length) * 100;
      console.log(`${level}: ${count} cases (${percentage.toFixed(1)}%)`);
    });
    
    // Show detailed examples
    console.log('\n🔍 Example Classifications');
    console.log('─'.repeat(60));
    
    // Show a few successful classifications
    const successfulResults = correctResults.slice(0, 3);
    successfulResults.forEach(result => {
      console.log(`\n✅ "${result.input}"`);
      console.log(`   Predicted: ${result.predicted} (confidence: ${result.confidence.toFixed(3)})`);
      console.log(`   Reasoning: ${result.reasoning.substring(0, 80)}...`);
    });
    
    // Show misclassifications
    const errors = validResults.filter(r => !r.correct).slice(0, 2);
    if (errors.length > 0) {
      console.log('\n❌ Misclassifications');
      errors.forEach(error => {
        console.log(`\n❌ "${error.input}"`);
        console.log(`   Expected: ${error.expected}, Got: ${error.predicted}`);
        console.log(`   Reasoning: ${error.reasoning.substring(0, 80)}...`);
      });
    }
    
    // Performance recommendations
    console.log('\n💡 Recommendations');
    console.log('─'.repeat(40));
    
    if (accuracy >= 90) {
      console.log('🏆 Excellent performance! Consider this approach for production.');
    } else if (accuracy >= 80) {
      console.log('✅ Good performance. Consider fine-tuning for edge cases.');
    } else {
      console.log('⚠️ Performance needs improvement. Consider prompt engineering or model selection.');
    }
    
    if (schemaCompliance < 100) {
      console.log(`📋 Schema compliance needs attention (${schemaCompliance.toFixed(1)}%).`);
    }
    
    if (avgLatency > 1000) {
      console.log(`⚡ Consider latency optimization (current: ${avgLatency.toFixed(0)}ms).`);
    }
    
    return {
      accuracy,
      avgLatency,
      avgConfidence,
      schemaCompliance,
      typeAccuracy,
      ambiguityLevels,
      results: validResults
    };
    
  } catch (error) {
    console.error('❌ Evaluation failed:', error);
    throw error;
  }
}

/**
 * Compare multiple providers
 */
async function compareProviders() {
  console.log('🚀 MULTI-PROVIDER STRUCTURED OUTPUT COMPARISON');
  console.log('═'.repeat(70));
  
  const providers: Array<'ollama' | 'openai' | 'groq'> = ['ollama'];
  // Add other providers if available
  // const providers: Array<'ollama' | 'openai' | 'groq'> = ['ollama', 'openai', 'groq'];
  
  const results: Record<string, any> = {};
  
  for (const provider of providers) {
    console.log(`\n🔧 Testing ${provider.toUpperCase()}...`);
    try {
      const result = await evaluateStructuredOutput(provider);
      results[provider] = result;
    } catch (error) {
      console.error(`❌ ${provider} failed:`, error);
      results[provider] = null;
    }
  }
  
  // Compare results
  console.log('\n📊 PROVIDER COMPARISON');
  console.log('═'.repeat(50));
  console.log('Provider'.padEnd(12) + 'Accuracy'.padEnd(12) + 'Latency'.padEnd(12) + 'Schema%');
  console.log('─'.repeat(50));
  
  Object.entries(results).forEach(([provider, result]) => {
    if (result) {
      console.log(
        provider.padEnd(12) + 
        `${result.accuracy.toFixed(1)}%`.padEnd(12) + 
        `${result.avgLatency.toFixed(0)}ms`.padEnd(12) + 
        `${result.schemaCompliance.toFixed(1)}%`
      );
    } else {
      console.log(provider.padEnd(12) + 'FAILED'.padEnd(36));
    }
  });
  
  return results;
}

/**
 * Main execution function
 */
async function main() {
  const args = process.argv.slice(2);
  
  // Parse command line arguments
  let provider: 'ollama' | 'openai' | 'groq' = 'ollama';
  let modelOverride: string | undefined;
  let compare = false;
  
  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--compare') {
      compare = true;
    } else if (arg === '--model' && i + 1 < args.length) {
      modelOverride = args[i + 1];
      i++; // Skip next argument as it's the model name
    } else if (['ollama', 'openai', 'groq'].includes(arg)) {
      provider = arg as 'ollama' | 'openai' | 'groq';
    }
  }
  
  try {
    if (compare) {
      await compareProviders();
    } else {
      await evaluateStructuredOutput(provider, modelOverride);
    }
    
    console.log('\n✅ Structured output test completed successfully!');
    
  } catch (error) {
    console.error('❌ Test execution failed:', error);
    process.exit(1);
  }
}

// Usage information
if (process.argv.includes('--help') || process.argv.includes('-h')) {
  console.log('🧪 LangChain Structured Output Classification Test');
  console.log('');
  console.log('Usage:');
  console.log('  bun run src/study/langchain-structured-output-test.ts [provider] [options]');
  console.log('');
  console.log('Providers:');
  console.log('  ollama (default)  Use local Ollama instance');
  console.log('  openai           Use OpenAI API');
  console.log('  groq             Use Groq API');
  console.log('');
  console.log('Options:');
  console.log('  --model MODEL    Override the model specified in config');
  console.log('  --compare        Compare multiple providers');
  console.log('  --help, -h       Show this help message');
  console.log('');
  console.log('Examples:');
  console.log('  bun run src/study/langchain-structured-output-test.ts');
  console.log('  bun run src/study/langchain-structured-output-test.ts ollama --model qwen3:0.6b');
  console.log('  bun run src/study/langchain-structured-output-test.ts groq');
  console.log('  bun run src/study/langchain-structured-output-test.ts --compare');
  console.log('');
  console.log('Note: Uses state manager to load config from config/llm-providers.yaml');
  process.exit(0);
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export {
  ClassificationSchema,
  createStructuredClassifier,
  evaluateStructuredOutput,
  structuredTestCases
};