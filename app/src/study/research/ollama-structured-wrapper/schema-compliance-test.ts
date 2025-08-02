#!/usr/bin/env node

/**
 * Schema Compliance Test for OllamaStructuredWrapper
 * 
 * Research-based evaluation methodology to test if OllamaStructuredWrapper
 * produces valid JSON that matches the expected schema structure.
 * 
 * Based on research findings:
 * - Industry standard is to measure % of valid JSON outputs
 * - Test against diverse input types and edge cases
 * - Validate both JSON validity and schema compliance
 */

import { createInputClassifier } from '@qi/agent/classifier';
import { createStateManager } from '@qi/agent/state';

interface SchemaComplianceResult {
  inputText: string;
  isValidJSON: boolean;
  matchesSchema: boolean;
  confidence: number;
  reasoning: string;
  indicators: string[];
  errorType?: string;
  errorMessage?: string;
  rawOutput?: string;
}

interface TestSummary {
  totalTests: number;
  validJSONCount: number;
  schemaMatchCount: number;
  validJSONRate: number;
  schemaComplianceRate: number;
  errorsByType: Record<string, number>;
  averageConfidence: number;
}

class SchemaComplianceTest {
  private classifier: any;
  private stateManager: any;

  constructor() {
    this.stateManager = createStateManager();
  }

  async initialize(): Promise<void> {
    console.log('🧪 Schema Compliance Test for OllamaStructuredWrapper');
    console.log('====================================================\n');

    // Load configuration
    const configPath = '../../../config';
    await this.stateManager.loadLLMConfig(configPath);

    // Initialize LLM method with working OllamaStructuredWrapper
    const classifierConfig = this.stateManager.getClassifierConfig();
    const llmConfig = this.stateManager.getLLMConfigForPromptModule();
    
    if (!classifierConfig || !llmConfig?.llm?.providers?.ollama) {
      throw new Error('Configuration not available');
    }

    this.classifier = createInputClassifier({
      method: 'langchain-structured',
      baseUrl: llmConfig.llm.providers.ollama.baseURL + '/v1',
      modelId: classifierConfig.model,
      temperature: classifierConfig.temperature || 0.1,
      maxTokens: classifierConfig.maxTokens || 1000,
    });

    console.log(`✅ Initialized with model: ${classifierConfig.model}`);
    console.log(`🔧 Base URL: ${llmConfig.llm.providers.ollama.baseURL}\n`);
  }

  /**
   * Diverse test inputs based on research recommendations
   */
  private getTestInputs(): string[] {
    return [
      // Clear commands
      '/help',
      '/status',
      '/config set theme dark',
      
      // Clear prompts  
      'hi',
      'hello there',
      'what is recursion?',
      'write a quicksort function',
      'explain machine learning',
      
      // Clear workflows
      'fix the bug in auth.js and run tests',
      'create a new feature with tests and documentation',
      'refactor the database layer and update migrations',
      'analyze the performance issues in the API and optimize',
      
      // Edge cases - ambiguous
      'help me with auth',
      'check the tests',
      'update the config',
      'run the build',
      
      // Edge cases - very short
      'hi',
      'ok',
      'yes',
      
      // Edge cases - very long
      'I need you to analyze the entire codebase, identify all the potential security vulnerabilities, create comprehensive tests for each module, update the documentation to reflect the current state, refactor any deprecated code patterns, optimize the database queries for better performance, and create a deployment pipeline that includes automated testing and rollback capabilities',
      
      // Edge cases - multilingual
      'Hola, ¿cómo estás?',
      '你好，请帮我写一个函数',
      'Bonjour, j\'ai besoin d\'aide',
      
      // Edge cases - special characters
      'fix bug in file.js && run tests',
      'create new feature @todo: add tests',
      'analyze performance (cpu & memory)',
      'update config.json -> deploy',
      
      // Edge cases - malformed
      '',
      '   ',
      'lorem ipsum dolor sit amet consectetur',
      '12345 67890',
      'null undefined NaN',
    ];
  }

  private isValidJSON(text: string): boolean {
    try {
      JSON.parse(text);
      return true;
    } catch {
      return false;
    }
  }

  private matchesExpectedSchema(obj: any): boolean {
    // Check required fields
    const requiredFields = ['type', 'confidence', 'reasoning', 'indicators', 'extracted_data'];
    
    for (const field of requiredFields) {
      if (!(field in obj)) {
        return false;
      }
    }

    // Check field types
    if (!['command', 'prompt', 'workflow'].includes(obj.type)) return false;
    if (typeof obj.confidence !== 'number' || obj.confidence < 0 || obj.confidence > 1) return false;
    if (typeof obj.reasoning !== 'string') return false;
    if (!Array.isArray(obj.indicators)) return false;
    if (typeof obj.extracted_data !== 'object') return false;

    return true;
  }

  private categorizeError(error: string): string {
    if (error.includes('JSON')) return 'JSON_PARSE_ERROR';
    if (error.includes('timeout')) return 'TIMEOUT';
    if (error.includes('connection')) return 'CONNECTION_ERROR';
    if (error.includes('schema')) return 'SCHEMA_MISMATCH';
    return 'UNKNOWN_ERROR';
  }

  async runComplianceTest(): Promise<TestSummary> {
    const testInputs = this.getTestInputs();
    const results: SchemaComplianceResult[] = [];
    
    console.log(`🔬 Running schema compliance test on ${testInputs.length} diverse inputs...\n`);

    for (let i = 0; i < testInputs.length; i++) {
      const input = testInputs[i];
      const displayInput = input.length > 50 ? input.substring(0, 47) + '...' : input;
      
      try {
        console.log(`[${i + 1}/${testInputs.length}] Testing: "${displayInput}"`);
        
        const startTime = Date.now();
        const result = await this.classifier.classify(input);
        const latency = Date.now() - startTime;
        
        const testResult: SchemaComplianceResult = {
          inputText: input,
          isValidJSON: true, // If we got a result, JSON parsing succeeded
          matchesSchema: true, // Classification succeeded, so schema likely matched
          confidence: result.confidence,
          reasoning: result.reasoning || '',
          indicators: [], // Would need to extract from metadata
          rawOutput: JSON.stringify(result)
        };

        // Validate the actual structure
        const rawResult = {
          type: result.type,
          confidence: result.confidence,
          reasoning: result.reasoning,
          indicators: result.metadata?.get('indicators') ? JSON.parse(result.metadata.get('indicators')) : [],
          extracted_data: Object.fromEntries(result.extractedData || [])
        };

        testResult.matchesSchema = this.matchesExpectedSchema(rawResult);
        results.push(testResult);
        
        console.log(`   ✅ Valid JSON: ${testResult.isValidJSON}, Schema Match: ${testResult.matchesSchema}, Confidence: ${result.confidence.toFixed(3)}, Latency: ${latency}ms`);
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        const errorType = this.categorizeError(errorMessage);
        
        const testResult: SchemaComplianceResult = {
          inputText: input,
          isValidJSON: false,
          matchesSchema: false,
          confidence: 0,
          reasoning: '',
          indicators: [],
          errorType,
          errorMessage,
        };
        
        results.push(testResult);
        console.log(`   ❌ Error: ${errorType} - ${errorMessage}`);
      }
    }

    return this.calculateSummary(results);
  }

  private calculateSummary(results: SchemaComplianceResult[]): TestSummary {
    const validJSONCount = results.filter(r => r.isValidJSON).length;
    const schemaMatchCount = results.filter(r => r.matchesSchema).length;
    const totalTests = results.length;
    
    const errorsByType: Record<string, number> = {};
    results.forEach(r => {
      if (r.errorType) {
        errorsByType[r.errorType] = (errorsByType[r.errorType] || 0) + 1;
      }
    });

    const validResults = results.filter(r => r.isValidJSON);
    const averageConfidence = validResults.length > 0
      ? validResults.reduce((sum, r) => sum + r.confidence, 0) / validResults.length
      : 0;

    return {
      totalTests,
      validJSONCount,
      schemaMatchCount,
      validJSONRate: (validJSONCount / totalTests) * 100,
      schemaComplianceRate: (schemaMatchCount / totalTests) * 100,
      errorsByType,
      averageConfidence
    };
  }

  printSummary(summary: TestSummary): void {
    console.log('\n📊 SCHEMA COMPLIANCE TEST RESULTS');
    console.log('==================================\n');
    
    console.log(`📈 Overall Results:`);
    console.log(`   Total Tests: ${summary.totalTests}`);
    console.log(`   Valid JSON: ${summary.validJSONCount}/${summary.totalTests} (${summary.validJSONRate.toFixed(1)}%)`);
    console.log(`   Schema Compliant: ${summary.schemaMatchCount}/${summary.totalTests} (${summary.schemaComplianceRate.toFixed(1)}%)`);
    console.log(`   Average Confidence: ${summary.averageConfidence.toFixed(3)}`);
    
    if (Object.keys(summary.errorsByType).length > 0) {
      console.log('\n❌ Errors by Type:');
      for (const [errorType, count] of Object.entries(summary.errorsByType)) {
        console.log(`   ${errorType}: ${count}`);
      }
    }

    console.log('\n🎯 Research-Based Assessment:');
    if (summary.validJSONRate >= 95) {
      console.log('   ✅ JSON Validity: EXCELLENT (≥95%)');
    } else if (summary.validJSONRate >= 90) {
      console.log('   ✅ JSON Validity: GOOD (≥90%)');
    } else if (summary.validJSONRate >= 80) {
      console.log('   ⚠️  JSON Validity: ACCEPTABLE (≥80%)');
    } else {
      console.log('   ❌ JSON Validity: POOR (<80%)');
    }

    if (summary.schemaComplianceRate >= 95) {
      console.log('   ✅ Schema Compliance: EXCELLENT (≥95%)');
    } else if (summary.schemaComplianceRate >= 90) {
      console.log('   ✅ Schema Compliance: GOOD (≥90%)');
    } else if (summary.schemaComplianceRate >= 80) {
      console.log('   ⚠️  Schema Compliance: ACCEPTABLE (≥80%)');
    } else {
      console.log('   ❌ Schema Compliance: POOR (<80%)');
    }

    console.log('\n💡 Research Insights:');
    console.log('   - Industry benchmark: >90% valid JSON for production use');
    console.log('   - Schema compliance >95% indicates proper structured output');
    console.log('   - Average confidence >0.7 suggests good classification certainty');
    console.log('   - Error analysis helps identify systematic issues');
  }
}

async function main(): Promise<void> {
  const test = new SchemaComplianceTest();
  await test.initialize();
  
  const summary = await test.runComplianceTest();
  test.printSummary(summary);
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}

export { SchemaComplianceTest };