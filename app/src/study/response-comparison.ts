/**
 * Response Comparison Tool
 * 
 * Compares raw LLM responses vs final classification method outputs
 * to identify where truncation, corruption, or parsing issues occur.
 * 
 * Usage:
 *   bun run app/src/study/response-comparison.ts <model> <method> <dataset>
 *   
 * Example:
 *   bun run app/src/study/response-comparison.ts llama3.2:3b langchain-json-schema balanced-10x3.json
 */

import { createInputClassifier } from '@qi/agent/classifier';
import { TestDataLoader } from './loaders/index.js';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface ResponseComparison {
  input: string;
  expected: string;
  rawResponse: string | null;
  methodOutput: any;
  success: boolean;
  truncated: boolean;
  parseErrors: string[];
  summary: string;
  latencyMs: number;
}

interface ComparisonResults {
  model: string;
  method: string;
  dataset: string;
  totalTests: number;
  successful: number;
  truncated: number;
  parseErrors: number;
  comparisons: ResponseComparison[];
}

/**
 * Capture raw LLM response by intercepting HTTP calls
 */
class ResponseCapture {
  private rawResponses: Map<string, string> = new Map();
  private originalFetch = global.fetch;

  startCapturing() {
    const self = this;
    global.fetch = Object.assign(async function(url: any, options?: any) {
      const response = await self.originalFetch(url, options);
      
      // Only capture responses from LLM endpoints
      if (typeof url === 'string' && (url.includes('/chat/completions') || url.includes('/api/generate'))) {
        const clone = response.clone();
        const text = await clone.text();
        
        // Store raw response with timestamp as key
        const key = `${Date.now()}-${Math.random()}`;
        self.rawResponses.set(key, text);
      }
      
      return response;
    }, { preconnect: self.originalFetch.preconnect });
  }

  stopCapturing() {
    global.fetch = this.originalFetch;
  }

  getLatestResponse(): string | null {
    const entries = Array.from(this.rawResponses.entries());
    if (entries.length === 0) return null;
    
    // Get most recent response
    const latest = entries[entries.length - 1];
    return latest[1];
  }

  clear() {
    this.rawResponses.clear();
  }
}

async function compareResponse(
  model: string, 
  method: string, 
  input: string, 
  expected: string
): Promise<ResponseComparison> {
  const capture = new ResponseCapture();
  const startTime = Date.now();
  
  try {
    // Start capturing HTTP responses
    capture.startCapturing();
    
    // Create classifier with the specified method
    const classifier = createInputClassifier({ 
      method: method as any, 
      modelId: model,
      baseUrl: 'http://localhost:11434',
      apiKey: 'ollama',
      temperature: 0.1,
      timeout: 30000
    });
    
    let methodOutput: any;
    let success = false;
    let parseErrors: string[] = [];
    
    try {
      // Run the classification
      methodOutput = await classifier.classify(input);
      success = true;
    } catch (error) {
      methodOutput = { error: error instanceof Error ? error.message : String(error) };
      parseErrors.push(error instanceof Error ? error.message : String(error));
    }
    
    const latencyMs = Date.now() - startTime;
    
    // Get the raw LLM response
    const rawResponse = capture.getLatestResponse();
    
    // Analyze truncation
    let truncated = false;
    let summary = '';
    
    if (rawResponse) {
      // Check for common truncation indicators
      const indicators = [
        rawResponse.endsWith('"'),  // Unterminated string
        rawResponse.includes('...'), // Explicit truncation
        rawResponse.match(/\{[^}]*$/), // Incomplete JSON object
        rawResponse.includes('error": "error"'), // Malformed error responses
      ];
      
      truncated = indicators.some(Boolean);
      
      // Generate summary
      if (success && methodOutput.type) {
        summary = `✅ Success: ${methodOutput.type} (confidence: ${methodOutput.confidence})`;
      } else if (truncated) {
        summary = `❌ Truncated response detected`;
      } else if (parseErrors.length > 0) {
        summary = `❌ Parse error: ${parseErrors[0].substring(0, 100)}...`;
      } else {
        summary = `❌ Unknown failure`;
      }
    } else {
      summary = `❌ No raw response captured`;
    }
    
    return {
      input,
      expected,
      rawResponse,
      methodOutput,
      success,
      truncated,
      parseErrors,
      summary,
      latencyMs
    };
    
  } finally {
    capture.stopCapturing();
  }
}

async function runComparison(model: string, method: string, datasetFile: string): Promise<ComparisonResults> {
  console.log(`🔬 Response Comparison Analysis`);
  console.log(`Model: ${model}`);
  console.log(`Method: ${method}`);
  console.log(`Dataset: ${datasetFile}`);
  console.log('='.repeat(50));
  
  // Load dataset - use the same logic as the study framework
  const dataset = await TestDataLoader.load(datasetFile.includes('/') ? datasetFile : `./data-ops/datasets/${datasetFile}`);
  
  console.log(`Loaded ${dataset.samples.length} test samples`);
  console.log('');
  
  const comparisons: ResponseComparison[] = [];
  let successful = 0;
  let truncated = 0;
  let parseErrors = 0;
  
  // Run comparison for each sample
  for (let i = 0; i < dataset.samples.length; i++) {
    const sample = dataset.samples[i];
    console.log(`Test ${i + 1}/${dataset.samples.length}: "${sample.input.substring(0, 50)}..."`);
    
    const comparison = await compareResponse(model, method, sample.input, sample.expected);
    comparisons.push(comparison);
    
    if (comparison.success) successful++;
    if (comparison.truncated) truncated++;
    if (comparison.parseErrors.length > 0) parseErrors++;
    
    console.log(`  ${comparison.summary}`);
    
    if (comparison.rawResponse && !comparison.success) {
      console.log(`  Raw Response (first 200 chars): ${comparison.rawResponse.substring(0, 200)}...`);
    }
    
    console.log('');
  }
  
  const results: ComparisonResults = {
    model,
    method,
    dataset: datasetFile,
    totalTests: dataset.samples.length,
    successful,
    truncated,
    parseErrors,
    comparisons
  };
  
  return results;
}

function printSummary(results: ComparisonResults) {
  console.log('📊 SUMMARY REPORT');
  console.log('='.repeat(50));
  console.log(`Model: ${results.model}`);
  console.log(`Method: ${results.method}`);
  console.log(`Dataset: ${results.dataset}`);
  console.log(`Total Tests: ${results.totalTests}`);
  console.log(`Successful: ${results.successful} (${(results.successful / results.totalTests * 100).toFixed(1)}%)`);
  console.log(`Truncated: ${results.truncated} (${(results.truncated / results.totalTests * 100).toFixed(1)}%)`);
  console.log(`Parse Errors: ${results.parseErrors} (${(results.parseErrors / results.totalTests * 100).toFixed(1)}%)`);
  
  const avgLatency = results.comparisons.reduce((sum, c) => sum + c.latencyMs, 0) / results.comparisons.length;
  console.log(`Average Latency: ${avgLatency.toFixed(0)}ms`);
  console.log('');
  
  // Show examples of issues
  const truncatedExamples = results.comparisons.filter(c => c.truncated).slice(0, 3);
  if (truncatedExamples.length > 0) {
    console.log('🔍 TRUNCATION EXAMPLES:');
    truncatedExamples.forEach((example, i) => {
      console.log(`${i + 1}. Input: "${example.input.substring(0, 50)}..."`);
      console.log(`   Raw Response: ${example.rawResponse?.substring(0, 150)}...`);
      console.log('');
    });
  }
  
  const parseErrorExamples = results.comparisons.filter(c => c.parseErrors.length > 0).slice(0, 3);
  if (parseErrorExamples.length > 0) {
    console.log('🔍 PARSE ERROR EXAMPLES:');
    parseErrorExamples.forEach((example, i) => {
      console.log(`${i + 1}. Input: "${example.input.substring(0, 50)}..."`);
      console.log(`   Error: ${example.parseErrors[0]}`);
      console.log(`   Raw Response: ${example.rawResponse?.substring(0, 150)}...`);
      console.log('');
    });
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  
  if (args.length !== 3) {
    console.error('Usage: bun run response-comparison.ts <model> <method> <dataset>');
    console.error('');
    console.error('Examples:');
    console.error('  bun run response-comparison.ts llama3.2:3b langchain-json-schema balanced-10x3.json');
    console.error('  bun run response-comparison.ts qwen3:0.6b ollama-native balanced-10x3.json');
    console.error('');
    console.error('Available methods: langchain-json-schema, langchain-function-calling, langchain-json-mode, ollama-native, instructor-ollama');
    process.exit(1);
  }
  
  const [model, method, dataset] = args;
  
  try {
    const results = await runComparison(model, method, dataset);
    printSummary(results);
  } catch (error) {
    console.error('❌ Comparison failed:', error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}

if (import.meta.main) {
  main().catch(console.error);
}

export { runComparison, type ComparisonResults, type ResponseComparison };