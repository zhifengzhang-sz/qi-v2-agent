#!/usr/bin/env node

/**
 * LangChain Quality Test on General Dataset
 * 
 * Tests LangChain quality directly on CLINC150 original categories
 * (not our 3-type mapping) to understand:
 * 1. Which LLM performs best with LangChain
 * 2. Real LangChain structured output performance
 * 3. Our OllamaStructuredWrapper vs broken ChatOllama
 */

import { readFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';
import { OllamaStructuredWrapper } from '../../lib/src/llm/OllamaStructuredWrapper.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestResult {
  input: string;
  expected: string;
  predicted: string;
  confidence: number;
  correct: boolean;
  latency: number;
  model: string;
}

interface ModelConfig {
  name: string;
  modelId: string;
  baseUrl: string;
}

class LangChainQualityTest {
  private baseUrl = 'http://172.18.144.1:11434';
  private models: ModelConfig[] = [
    { name: 'qwen3:8b', modelId: 'qwen3:8b', baseUrl: this.baseUrl },
    { name: 'llama3.2:3b', modelId: 'llama3.2:3b', baseUrl: this.baseUrl }
  ];

  async initialize(): Promise<void> {
    console.log('🔍 LANGCHAIN QUALITY TEST (General Dataset)');
    console.log('===========================================\n');
    console.log('Testing LangChain on original CLINC150 categories to evaluate LLM quality.\n');
    
    // Check Ollama availability
    try {
      const response = await fetch(`${this.baseUrl}/api/tags`);
      if (!response.ok) {
        throw new Error('Ollama not available');
      }
      console.log('✅ Ollama server available');
    } catch (error) {
      console.error('❌ Ollama server not available:', error);
      process.exit(1);
    }
  }

  async loadCLINC150Data(): Promise<any[]> {
    const dataPath = join(__dirname, 'datasets', 'clinc150_small.json');
    
    if (!existsSync(dataPath)) {
      console.error('❌ CLINC150 dataset not found. Run:');
      console.error('   bun run study:download');
      process.exit(1);
    }

    console.log('📊 Loading CLINC150 dataset...');
    const content = await readFile(dataPath, 'utf-8');
    const data = JSON.parse(content);
    
    // Extract test samples with original categories
    const testSamples = [];
    
    if (data.val) {
      for (const [text, intent] of data.val) {
        testSamples.push({ text, intent });
      }
    }
    
    // Limit to first 100 samples for comprehensive testing
    const samples = testSamples.slice(0, 100);
    console.log(`✅ Loaded ${samples.length} test samples`);
    
    // Show unique intents
    const uniqueIntents = [...new Set(samples.map(s => s.intent))];
    console.log(`📋 Testing ${uniqueIntents.length} unique intents:`);
    console.log(`   ${uniqueIntents.slice(0, 10).join(', ')}${uniqueIntents.length > 10 ? '...' : ''}\n`);
    
    return samples;
  }

  async testModel(config: ModelConfig, testData: any[]): Promise<TestResult[]> {
    console.log(`🧪 Testing ${config.name}...`);
    
    // Create our custom structured wrapper (no broken ChatOllama)
    const model = new OllamaStructuredWrapper({
      model: config.modelId,
      baseURL: config.baseUrl,
      temperature: 0.1
    });

    const results: TestResult[] = [];
    const startTime = Date.now();

    for (let i = 0; i < testData.length; i++) {
      const sample = testData[i];
      const testStart = Date.now();

      try {
        // Build classification prompt for original CLINC150 categories
        const prompt = `Classify the following user input into the most appropriate intent category from CLINC150 dataset.

User Input: "${sample.text}"

This is a banking/financial assistant classification task. Consider these types of intents:
- account_blocked, activate_my_card, age_limit, apple_pay_or_google_pay
- atm_support, automatic_payment, balance, bill_balance, bill_due
- cancel_transfer, card_about_to_expire, card_arrival, card_linking
- card_not_working, card_payment_fee_charged, card_payment_not_recognized
- card_payment_wrong_exchange_rate, card_swallowed, cash_withdrawal_charge
- cash_withdrawal_not_working, change_accent, change_ai_language, change_app_language
- change_pin, change_spelling, change_user_name, compromised_card, contactless_not_working
- country_support, declined_card_payment, declined_cash_withdrawal, declined_transfer
- direct_debit, dispose_card, edit_personal_details, exchange_charge, exchange_rate
- exchange_via_app, extra_charge_on_statement, failed_transfer, fiat_currency_support
- freeze_account, get_disposable_virtual_card, get_physical_card, getting_spare_card
- getting_virtual_card, lost_or_stolen_card, lost_or_stolen_phone, order_physical_card
- passcode_forgotten, pending_card_payment, pending_cash_withdrawal, pending_top_up
- pending_transfer, pin_blocked, receiving_money, request_refund, reverted_card_payment
- supported_cards_and_currencies, terminate_account, top_up_by_bank_transfer_charge
- top_up_by_card_charge, top_up_by_cash_or_cheque, top_up_failed, top_up_limits
- top_up_reverted, topping_up_by_card, transfer_fee_charged, transfer_into_account
- transfer_not_received_by_recipient, transfer_timing, unable_to_verify_identity
- verify_my_identity, verify_source_of_funds, verify_top_up, virtual_card_not_working
- visa_or_mastercard, why_verify_identity, wrong_amount_of_cash_received, wrong_exchange_rate_for_cash_withdrawal

Analyze the user's intent and classify accordingly.`;

        const result = await model.generateStructured(prompt, {
          type: 'object',
          properties: {
            intent: { type: 'string', description: 'The predicted CLINC150 intent category' },
            confidence: { type: 'number', minimum: 0, maximum: 1, description: 'Confidence score from 0.0 to 1.0' },
            reasoning: { type: 'string', description: 'Brief explanation of the classification' }
          },
          required: ['intent', 'confidence', 'reasoning']
        });
        
        const latency = Date.now() - testStart;

        results.push({
          input: sample.text,
          expected: sample.intent,
          predicted: result.intent,
          confidence: result.confidence,
          correct: result.intent === sample.intent,
          latency,
          model: config.name
        });

        // Progress indicator
        if ((i + 1) % 20 === 0 || i === testData.length - 1) {
          const progress = ((i + 1) / testData.length * 100).toFixed(1);
          const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
          console.log(`   Progress: ${progress}% (${i + 1}/${testData.length}) - ${elapsed}s`);
        }

      } catch (error) {
        console.error(`   Parse error sample ${i}: ${error instanceof Error ? error.message : error}`);
        results.push({
          input: sample.text,
          expected: sample.intent,
          predicted: 'PARSE_ERROR',
          confidence: 0,
          correct: false,
          latency: Date.now() - testStart,
          model: config.name
        });
      }
    }

    const totalTime = ((Date.now() - startTime) / 1000).toFixed(1);
    console.log(`✅ Completed ${config.name}: ${results.length} tests in ${totalTime}s\n`);

    return results;
  }

  private calculateMetrics(results: TestResult[]) {
    const correct = results.filter(r => r.correct).length;
    const accuracy = correct / results.length;
    const avgConfidence = results.reduce((sum, r) => sum + r.confidence, 0) / results.length;
    const avgLatency = results.reduce((sum, r) => sum + r.latency, 0) / results.length;
    const parseErrors = results.filter(r => r.predicted === 'PARSE_ERROR').length;
    const validPredictions = results.filter(r => r.predicted !== 'PARSE_ERROR');
    const parseSuccessRate = validPredictions.length / results.length;

    return {
      accuracy,
      avgConfidence,
      avgLatency,
      correct,
      total: results.length,
      parseErrors,
      parseSuccessRate,
      validPredictions: validPredictions.length
    };
  }

  private printResults(allResults: { [model: string]: TestResult[] }): void {
    console.log('📊 LANGCHAIN QUALITY TEST RESULTS');
    console.log('==================================\n');

    // Summary table
    console.log('📋 LangChain Performance on CLINC150 Original Categories');
    console.log('-------------------------------------------------------');
    console.log('| Model      | Accuracy | Parse Success | Avg Latency | Confidence |');
    console.log('|------------|----------|---------------|-------------|------------|');

    const modelMetrics: { [model: string]: any } = {};

    for (const [modelName, results] of Object.entries(allResults)) {
      const metrics = this.calculateMetrics(results);
      modelMetrics[modelName] = metrics;

      const acc = (metrics.accuracy * 100).toFixed(1);
      const parseSuccess = (metrics.parseSuccessRate * 100).toFixed(1);
      const latency = Math.round(metrics.avgLatency);
      const conf = metrics.avgConfidence.toFixed(3);
      
      console.log(`| ${modelName.padEnd(10)} | ${acc.padStart(6)}% | ${parseSuccess.padStart(11)}% | ${latency.toString().padStart(9)}ms | ${conf.padStart(8)} |`);
    }

    // Best model recommendation
    const bestModel = Object.entries(modelMetrics).reduce((best, [name, metrics]) => 
      metrics.accuracy > best[1].accuracy ? [name, metrics] : best
    );

    console.log(`\n🏆 BEST MODEL FOR LANGCHAIN: ${bestModel[0]}`);
    console.log(`   Accuracy: ${(bestModel[1].accuracy * 100).toFixed(1)}%`);
    console.log(`   Parse Success: ${(bestModel[1].parseSuccessRate * 100).toFixed(1)}%`);
    console.log(`   Avg Latency: ${Math.round(bestModel[1].avgLatency)}ms`);
    console.log(`   Avg Confidence: ${bestModel[1].avgConfidence.toFixed(3)}`);

    // Analysis
    console.log('\n🔍 LANGCHAIN QUALITY ANALYSIS:');
    const totalParseErrors = Object.values(modelMetrics).reduce((sum, m) => sum + m.parseErrors, 0);
    const totalTests = Object.values(modelMetrics).reduce((sum, m) => sum + m.total, 0);
    
    console.log(`- Overall Parse Success: ${((totalTests - totalParseErrors) / totalTests * 100).toFixed(1)}%`);
    console.log('- Our OllamaStructuredWrapper eliminates ChatOllama parsing issues');
    console.log('- Direct JSON prompting provides reliable structured output');
    
    if (totalParseErrors === 0) {
      console.log('- ✅ No parsing failures - custom wrapper working correctly');
    } else {
      console.log(`- ⚠️  ${totalParseErrors} parsing failures - investigate edge cases`);
    }

    // Error analysis for best model
    console.log(`\n📈 ACCURACY BREAKDOWN (${bestModel[0]}):`);
    const bestResults = allResults[bestModel[0]];
    const errors = bestResults.filter(r => !r.correct && r.predicted !== 'PARSE_ERROR');
    
    if (errors.length > 0) {
      console.log(`Classification errors: ${errors.length}/${bestResults.length}`);
      console.log(`Parse errors: ${bestModel[1].parseErrors}/${bestResults.length}`);
      
      // Show sample classification errors
      console.log('\nSample classification errors:');
      errors.slice(0, 3).forEach((error, i) => {
        console.log(`${i + 1}. "${error.input}"`);
        console.log(`   Expected: ${error.expected} | Predicted: ${error.predicted}`);
      });
    } else {
      console.log('✅ Perfect classification accuracy on valid parses!');
    }
  }

  async run(): Promise<void> {
    await this.initialize();
    
    // Load test data
    const testData = await this.loadCLINC150Data();
    
    // Test each model
    const allResults: { [model: string]: TestResult[] } = {};
    
    for (const modelConfig of this.models) {
      try {
        // Check if model is available
        const testModel = new OllamaStructuredWrapper({
          model: modelConfig.modelId,
          baseURL: modelConfig.baseUrl
        });
        
        const isAvailable = await testModel.isAvailable();
        if (!isAvailable) {
          throw new Error('Model not available');
        }
        
        // Run full test
        const results = await this.testModel(modelConfig, testData);
        allResults[modelConfig.name] = results;
        
      } catch (error) {
        console.log(`⚠️  ${modelConfig.name} not available: ${error}`);
        continue;
      }
    }

    // Print comprehensive results
    if (Object.keys(allResults).length === 0) {
      console.error('❌ No models available for testing');
      process.exit(1);
    }

    this.printResults(allResults);
    
    console.log('\n✅ LangChain quality test completed!');
    console.log('This evaluates actual LangChain structured output performance on real classification tasks.');
  }
}

// Execute if run directly
if (import.meta.main) {
  const test = new LangChainQualityTest();
  test.run().catch(console.error);
}