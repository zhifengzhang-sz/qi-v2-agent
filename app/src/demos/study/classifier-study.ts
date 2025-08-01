#!/usr/bin/env node

const testCases = [
  ['/help', 'command'], ['/config', 'command'], ['/status', 'command'],
  ['hi', 'prompt'], ['hello there', 'prompt'], ['what is recursion?', 'prompt'],
  ['explain closures in javascript', 'prompt'], ['write a quicksort function', 'prompt'],
  ['create a simple calculator in python', 'prompt'], ['test the application', 'prompt'],
  ['debug this code', 'prompt'], ['fix the bug in src/main.ts and run tests', 'workflow'],
  ['refactor auth module and update documentation', 'workflow'],
  ['create a new user authentication system with tests and documentation', 'workflow'],
  ['analyze the performance bottlenecks in the database and optimize queries', 'workflow'],
  ['build a REST API for user management with validation and error handling', 'workflow'],
  ['implement CI/CD pipeline with testing, linting, and deployment to production', 'workflow'],
  ['create tests for the entire authentication module and deploy to staging', 'workflow']
];

interface TestResult {
  correct: boolean;
  confidence: number;
  latency: number;
}

interface TestStats {
  accuracy: number;
  avgLatency: number;
  avgConfidence: number;
}

const testClassifier = (classifier: any) => (testCase: [string, string]) => 
  classifier.classify(testCase[0]).then((r: any) => ({
    correct: r.type === testCase[1],
    confidence: r.confidence,
    latency: 0 // will be measured externally
  }));

const measure = (fn: any) => async (...args: any[]) => {
  const start = Date.now();
  const result = await fn(...args);
  return { ...result, latency: Date.now() - start };
};

const aggregate = (results: TestResult[]): TestStats => {
  const validConfidences = results.filter(r => !isNaN(r.confidence) && isFinite(r.confidence));
  return {
    accuracy: results.filter(r => r.correct).length / results.length * 100,
    avgLatency: results.reduce((s, r) => s + r.latency, 0) / results.length,
    avgConfidence: validConfidences.length > 0 ? validConfidences.reduce((s, r) => s + r.confidence, 0) / validConfidences.length : 0
  };
};

const formatResults = (methods: [string, TestStats][]) => {
  console.log('\n📊 CLASSIFIER PERFORMANCE RESULTS');
  console.log('─'.repeat(50));
  console.log('\nMethod      Accuracy  Latency   Confidence');
  console.log('─'.repeat(45));
  methods.forEach(([name, stats]) => 
    console.log(`${name.padEnd(10)}  ${stats.accuracy.toFixed(1)}%     ${stats.avgLatency.toFixed(0)}ms      ${stats.avgConfidence.toFixed(2)}`));
  
  // Add markdown table output
  console.log('\n## Classification Results (Markdown)');
  console.log('```markdown');
  console.log('| Method     | Accuracy | Latency | Confidence |');
  console.log('|------------|----------|---------|------------|');
  methods.forEach(([name, stats]) => 
    console.log(`| ${name.padEnd(10)} | ${stats.accuracy.toFixed(1)}%     | ${stats.avgLatency.toFixed(0)}ms    | ${stats.avgConfidence.toFixed(2)}      |`));
  console.log('```');
  
  // Best performer summary
  const best = methods[0]; // Already sorted by accuracy
  if (best) {
    console.log(`\n🏆 Best Performer: ${best[0]} (${best[1].accuracy.toFixed(1)}% accuracy, ${best[1].avgLatency.toFixed(0)}ms avg latency)`);
  }
};

async function main() {
  console.log(`🧪 Three-Type Classification Performance Study`);
  console.log(`📊 Test Cases: ${testCases.length} inputs`);
  console.log(`🎯 Testing: rule-based vs LLM-based classification`);
  console.log();
  
  try {
    // Use the actual agent system with StateManager
    const { createStateManager } = await import('@qi/agent/state');
    const { createClassifier } = await import('@qi/agent/classifier');
    
    const stateManager = createStateManager();
    
    // Load LLM configuration from config file
    await stateManager.loadLLMConfig(process.cwd() + '/config');
    const classifierConfig = stateManager.getClassifierConfig();
    
    if (!classifierConfig) {
      throw new Error('Classifier configuration not found in config/llm-providers.yaml');
    }
    
    console.log(`📋 Using config model: ${classifierConfig.model} (${classifierConfig.provider})`);
    console.log(`🌡️ Temperature: ${classifierConfig.temperature}, Max Tokens: ${classifierConfig.maxTokens}`);
    console.log();
    
    // Create the actual classifier used by the agent
    const classifier = createClassifier(stateManager);
    
    // Also create individual methods for comparison
    const { RuleBasedClassificationMethod } = await import('@qi/classifier');
    const { LLMClassificationMethod } = await import('@qi/classifier');
    
    const ruleClassifier = new RuleBasedClassificationMethod({
      commandPrefix: '/',
      promptIndicators: ['hi', 'hello', 'what', 'write', 'create', 'explain'],
      workflowIndicators: ['fix', 'refactor', 'implement', 'analyze', 'build'],
      confidenceThresholds: new Map([['command', 1.0], ['prompt', 0.8], ['workflow', 0.7]])
    });
    
    // Use the configured base URL and model from the config
    const llmConfig = stateManager.getLLMConfigForPromptModule();
    const baseUrl = llmConfig?.llm?.providers?.ollama?.baseURL || 'http://localhost:11434';
    
    const llmClassifier = new LLMClassificationMethod({
      baseUrl: baseUrl,
      modelId: classifierConfig.model,
      temperature: classifierConfig.temperature || 0.1,
      maxTokens: classifierConfig.maxTokens || 200
    });

    console.log('🔍 Running rule-based classification...');
    const ruleResults = await Promise.all(testCases.map(measure(testClassifier(ruleClassifier))));
    
    console.log('🔍 Running LLM-based classification...');
    const llmResults = await Promise.all(testCases.map(measure(testClassifier(llmClassifier))));
    
    console.log('🔍 Running actual agent classifier...');
    const agentResults = await Promise.all(testCases.map(measure(testClassifier(classifier))));

    const methodResults: [string, TestStats][] = [
      ['rule-based', aggregate(ruleResults)],
      ['llm-based', aggregate(llmResults)],
      ['agent-system', aggregate(agentResults)]
    ];
    
    formatResults(methodResults.sort(([,a], [,b]) => b.accuracy - a.accuracy));
    
    // Detailed analysis
    console.log('\n🔍 DETAILED ANALYSIS');
    console.log('─'.repeat(50));
    
    // Show misclassified cases
    const misclassifiedRule = testCases.filter((_, i) => !ruleResults[i].correct);
    const misclassifiedLLM = testCases.filter((_, i) => !llmResults[i].correct);
    const misclassifiedAgent = testCases.filter((_, i) => !agentResults[i].correct);
    
    if (misclassifiedRule.length > 0) {
      console.log(`\n❌ Rule-based misclassifications (${misclassifiedRule.length}):`);
      misclassifiedRule.forEach(([input, expected]) => {
        console.log(`  • "${input}" → expected: ${expected}`);
      });
    }
    
    if (misclassifiedLLM.length > 0) {
      console.log(`\n❌ LLM-based misclassifications (${misclassifiedLLM.length}):`);
      misclassifiedLLM.forEach(([input, expected]) => {
        console.log(`  • "${input}" → expected: ${expected}`);
      });
    }
    
    if (misclassifiedAgent.length > 0) {
      console.log(`\n❌ Agent system misclassifications (${misclassifiedAgent.length}):`);
      misclassifiedAgent.forEach(([input, expected]) => {
        console.log(`  • "${input}" → expected: ${expected}`);
      });
    }
    
    console.log('\n✅ Classification study completed successfully!');
    
  } catch (error) {
    console.error('❌ Classification study failed:', error);
    console.error('\nPossible issues:');
    console.error('  • Ollama server not running');
    console.error('  • Configuration file not found: config/llm-providers.yaml');
    console.error('  • @qi/classifier import issues');
    console.error('  • QiError export mismatch in @qi/base');
    process.exit(1);
  }
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch(console.error);
}