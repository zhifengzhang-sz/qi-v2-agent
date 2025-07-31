#!/usr/bin/env node

/**
 * Demo of method comparison output format
 */

// Simulated results for demonstration
const results = [
  {
    model: 'qwen3:14b',
    method: 'rule-based',
    accuracy: 77.8,
    avgLatency: 12,
    avgConfidence: 0.75,
    successfulCases: 14,
    totalCases: 18,
    errors: 0
  },
  {
    model: 'qwen3:14b', 
    method: 'llm-based',
    accuracy: 100.0,
    avgLatency: 5174,
    avgConfidence: 0.94,
    successfulCases: 18,
    totalCases: 18,
    errors: 0
  },
  {
    model: 'qwen3:14b',
    method: 'hybrid',
    accuracy: 94.4,
    avgLatency: 1250,
    avgConfidence: 0.89,
    successfulCases: 17,
    totalCases: 18,
    errors: 0
  }
];

function generateReport() {
  console.log('📊 CLASSIFIER RESULTS');
  console.log('─'.repeat(100));

  const colWidths = [20, 12, 12, 12, 12, 12, 15];
  const headers = ['Model', 'Method', 'Accuracy', 'Latency', 'Confidence', 'Success', 'Errors'];
  
  let header = '';
  headers.forEach((h, i) => header += h.padEnd(colWidths[i]));
  console.log(header);
  console.log('─'.repeat(100));

  const sorted = results.sort((a, b) => b.accuracy - a.accuracy);
  for (const result of sorted) {
    const row = [
      result.model,
      result.method,
      `${result.accuracy.toFixed(1)}%`,
      `${result.avgLatency.toFixed(0)}ms`,
      result.avgConfidence.toFixed(2),
      `${result.successfulCases}/${result.totalCases}`,
      result.errors.toString()
    ];
    
    let line = '';
    row.forEach((cell, i) => line += cell.padEnd(colWidths[i]));
    console.log(line);
  }

  console.log('─'.repeat(100));
  const best = sorted[0];
  console.log(`🏆 Best: ${best.model} (${best.method}) - ${best.accuracy.toFixed(1)}% accuracy, ${best.avgLatency.toFixed(0)}ms latency`);
}

function generateMarkdownSummary() {
  console.log('\n📋 MARKDOWN SUMMARY');
  console.log('─'.repeat(50));

  console.log('\n## Classifier Method Comparison\n');
  console.log(`### qwen3:14b\n`);
  console.log('| Method | Accuracy | Latency | Confidence | Success Rate | Errors |');
  console.log('|--------|----------|---------|------------|--------------|--------|');
  
  const sorted = results.sort((a, b) => b.accuracy - a.accuracy);
  for (const result of sorted) {
    console.log(`| ${result.method} | ${result.accuracy.toFixed(1)}% | ${result.avgLatency.toFixed(0)}ms | ${result.avgConfidence.toFixed(2)} | ${result.successfulCases}/${result.totalCases} | ${result.errors} |`);
  }
  
  console.log('\n### Top Performers\n');
  console.log('| Rank | Model | Method | Accuracy | Latency |');
  console.log('|------|-------|--------|----------|---------|');
  
  sorted.slice(0, 3).forEach((result, index) => {
    console.log(`| ${index + 1} | ${result.model} | ${result.method} | ${result.accuracy.toFixed(1)}% | ${result.avgLatency.toFixed(0)}ms |`);
  });

  console.log('\n### Key Insights\n');
  console.log('- **Best Overall**: qwen3:14b (llm-based) - 100.0%');
  console.log('- **Fastest**: qwen3:14b (rule-based) - 12ms');  
  console.log('- **Best Balance**: qwen3:14b (hybrid) - 94.4% accuracy, 1250ms latency');
  console.log('\n**Recommendation**: Use hybrid method for production - combines speed and accuracy optimally.');
}

console.log('🔍 Classifier Study: 18 test cases, 1 model(s)\n');
console.log('Testing qwen3:14b (rule-based)... ✅ 77.8%');
console.log('Testing qwen3:14b (llm-based)... ✅ 100.0%');
console.log('Generated qwen3:14b (hybrid): 94.4%');

generateReport();
generateMarkdownSummary();