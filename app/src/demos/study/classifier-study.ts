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

const testClassifier = (classifier) => (testCase) => 
  classifier.classify(testCase[0]).then(r => ({
    correct: r.type === testCase[1],
    confidence: r.confidence,
    latency: 0 // will be measured externally
  }));

const measure = (fn) => async (...args) => {
  const start = Date.now();
  const result = await fn(...args);
  return { ...result, latency: Date.now() - start };
};

const aggregate = (results) => ({
  accuracy: results.filter(r => r.correct).length / results.length * 100,
  avgLatency: results.reduce((s, r) => s + r.latency, 0) / results.length,
  avgConfidence: results.reduce((s, r) => s + r.confidence, 0) / results.length
});

const formatResults = (methods) => {
  console.log('\nMethod      Accuracy  Latency   Confidence');
  console.log('─'.repeat(45));
  methods.forEach(([name, stats]) => 
    console.log(`${name.padEnd(10)}  ${stats.accuracy.toFixed(1)}%     ${stats.avgLatency.toFixed(0)}ms      ${stats.avgConfidence.toFixed(2)}`));
};

async function main() {
  const model = process.argv[2] || 'qwen2.5-coder:7b';
  
  const { RuleBasedClassificationMethod } = await import('../../classifier/impl/rule-based-classification-method.js');
  const { LLMClassificationMethod } = await import('../../classifier/impl/llm-classification-method.js');
  
  const ruleClassifier = new RuleBasedClassificationMethod({
    commandPrefix: '/',
    promptIndicators: ['hi', 'hello', 'what', 'write', 'create', 'explain'],
    workflowIndicators: ['fix', 'refactor', 'implement', 'analyze', 'build'],
    complexityThresholds: new Map([['command', 1.0], ['prompt', 0.8], ['workflow', 0.7]])
  });
  
  const llmClassifier = new LLMClassificationMethod({
    baseUrl: 'http://172.18.144.1:11434',
    modelId: model,
    temperature: 0.1,
    maxTokens: 200
  });

  const [ruleResults, llmResults] = await Promise.all([
    Promise.all(testCases.map(measure(testClassifier(ruleClassifier)))),
    Promise.all(testCases.map(measure(testClassifier(llmClassifier))))
  ]);

  formatResults([
    ['rule-based', aggregate(ruleResults)],
    ['llm-based', aggregate(llmResults)]
  ].sort(([,a], [,b]) => b.accuracy - a.accuracy));
}

main().catch(console.error);