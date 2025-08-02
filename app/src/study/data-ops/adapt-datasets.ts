#!/usr/bin/env node

/**
 * Dataset Adapter Script
 * 
 * Converts downloaded datasets to command/prompt/workflow classification format.
 * Maps existing intent categories to our three-type system with intelligent rules.
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { existsSync } from 'node:fs';
import { dataDir } from './download-datasets.js';

interface TestCase {
  id: number;
  text: string;
  expected: 'command' | 'prompt' | 'workflow';
  source: string;
  original_intent?: string;
  complexity: 'low' | 'medium' | 'high';
  confidence: number;
}

interface AdaptedDataset {
  metadata: {
    name: string;
    version: string;
    generated: string;
    total_samples: number;
    categories: string[];
    sources: string[];
    distribution: Record<string, number>;
  };
  test_cases: TestCase[];
}

// Mapping rules for CLINC150 intents to our three categories
const intentMapping: Record<string, { category: 'command' | 'prompt' | 'workflow'; confidence: number }> = {
  // COMMAND-like intents (system functions, direct actions)
  'alarm': { category: 'command', confidence: 0.9 },
  'timer': { category: 'command', confidence: 0.9 },
  'reminder': { category: 'command', confidence: 0.9 },
  'calendar': { category: 'command', confidence: 0.8 },
  'calendar_update': { category: 'command', confidence: 0.8 },
  'calendar_remove': { category: 'command', confidence: 0.8 },
  'datetime': { category: 'command', confidence: 0.8 },
  'play_music': { category: 'command', confidence: 0.9 },
  'music_volume': { category: 'command', confidence: 0.9 },
  'next_song': { category: 'command', confidence: 0.9 },
  'previous_song': { category: 'command', confidence: 0.9 },
  'pause_music': { category: 'command', confidence: 0.9 },
  'smart_home': { category: 'command', confidence: 0.8 },
  'audio_volume_up': { category: 'command', confidence: 0.9 },
  'audio_volume_down': { category: 'command', confidence: 0.9 },
  'audio_volume_mute': { category: 'command', confidence: 0.9 },
  
  // PROMPT-like intents (questions, information requests, simple tasks)
  'weather': { category: 'prompt', confidence: 0.9 },
  'definition': { category: 'prompt', confidence: 0.9 },
  'translate': { category: 'prompt', confidence: 0.8 },
  'spelling': { category: 'prompt', confidence: 0.8 },
  'math': { category: 'prompt', confidence: 0.8 },
  'exchange_rate': { category: 'prompt', confidence: 0.8 },
  'currency_exchange': { category: 'prompt', confidence: 0.8 },
  'distance': { category: 'prompt', confidence: 0.8 },
  'measurement_conversion': { category: 'prompt', confidence: 0.8 },
  'time': { category: 'prompt', confidence: 0.8 },
  'timezone': { category: 'prompt', confidence: 0.8 },
  'date': { category: 'prompt', confidence: 0.8 },
  'factoid': { category: 'prompt', confidence: 0.9 },
  'what_is_your_name': { category: 'prompt', confidence: 0.9 },
  'what_can_i_ask_you': { category: 'prompt', confidence: 0.9 },
  'what_are_your_hobbies': { category: 'prompt', confidence: 0.9 },
  'goodbye': { category: 'prompt', confidence: 0.9 },
  'greeting': { category: 'prompt', confidence: 0.9 },
  'how_old_are_you': { category: 'prompt', confidence: 0.9 },
  'thank_you': { category: 'prompt', confidence: 0.9 },
  'yes': { category: 'prompt', confidence: 0.8 },
  'no': { category: 'prompt', confidence: 0.8 },
  'maybe': { category: 'prompt', confidence: 0.8 },
  
  // WORKFLOW-like intents (complex, multi-step, planning tasks)
  'restaurant_reservation': { category: 'workflow', confidence: 0.9 },
  'restaurant_reviews': { category: 'workflow', confidence: 0.7 },
  'book_flight': { category: 'workflow', confidence: 0.9 },
  'book_hotel': { category: 'workflow', confidence: 0.9 },
  'travel_suggestion': { category: 'workflow', confidence: 0.8 },
  'travel_alert': { category: 'workflow', confidence: 0.8 },
  'travel_notification': { category: 'workflow', confidence: 0.8 },
  'shopping_list': { category: 'workflow', confidence: 0.8 },
  'shopping_list_update': { category: 'workflow', confidence: 0.8 },
  'order': { category: 'workflow', confidence: 0.8 },
  'order_status': { category: 'workflow', confidence: 0.7 },
  'order_checks': { category: 'workflow', confidence: 0.7 },
  'credit_score': { category: 'workflow', confidence: 0.8 },
  'credit_limit': { category: 'workflow', confidence: 0.8 },
  'credit_limit_change': { category: 'workflow', confidence: 0.8 },
  'account_blocked': { category: 'workflow', confidence: 0.8 },
  'pin_change': { category: 'workflow', confidence: 0.8 },
  'report_fraud': { category: 'workflow', confidence: 0.9 },
  'report_lost_card': { category: 'workflow', confidence: 0.9 },
  'transfer': { category: 'workflow', confidence: 0.9 },
  'transactions': { category: 'workflow', confidence: 0.8 },
  'balance': { category: 'workflow', confidence: 0.7 },
  'spending_history': { category: 'workflow', confidence: 0.8 },
  'bill_balance': { category: 'workflow', confidence: 0.8 },
  'bill_due': { category: 'workflow', confidence: 0.8 },
  'pay_bill': { category: 'workflow', confidence: 0.9 },
  'cancel': { category: 'workflow', confidence: 0.8 },
  'cancel_reservation': { category: 'workflow', confidence: 0.9 },
  'change_ai_name': { category: 'workflow', confidence: 0.8 },
  'sync_device': { category: 'workflow', confidence: 0.8 },
  'plug_type': { category: 'workflow', confidence: 0.7 },
  'roll_dice': { category: 'workflow', confidence: 0.6 },
  'flip_coin': { category: 'workflow', confidence: 0.6 },
  'find_phone': { category: 'workflow', confidence: 0.8 },
  'gas': { category: 'workflow', confidence: 0.8 },
  'gas_type': { category: 'workflow', confidence: 0.8 },
  'insurance': { category: 'workflow', confidence: 0.8 },
  'insurance_change': { category: 'workflow', confidence: 0.8 },
  'mpg': { category: 'workflow', confidence: 0.7 },
  'oil_change_how': { category: 'workflow', confidence: 0.8 },
  'oil_change_when': { category: 'workflow', confidence: 0.8 },
  'schedule_maintenance': { category: 'workflow', confidence: 0.9 },
  'tire_change': { category: 'workflow', confidence: 0.8 },
  'tire_pressure': { category: 'workflow', confidence: 0.8 },
  'todo_list': { category: 'workflow', confidence: 0.8 },
  'todo_list_update': { category: 'workflow', confidence: 0.8 },
  'update_playlist': { category: 'workflow', confidence: 0.8 },
};

function categorizeComplexity(text: string, intent?: string): 'low' | 'medium' | 'high' {
  const length = text.length;
  const wordCount = text.split(/\s+/).length;
  
  // High complexity indicators
  if (wordCount > 15 || length > 100) return 'high';
  if (text.includes('and') && text.includes('then')) return 'high';
  if (intent?.includes('book_') || intent?.includes('schedule_') || intent?.includes('report_')) return 'high';
  
  // Medium complexity indicators  
  if (wordCount > 8 || length > 50) return 'medium';
  if (intent?.includes('update_') || intent?.includes('change_') || intent?.includes('transfer')) return 'medium';
  
  return 'low';
}

async function adaptCLINC150(): Promise<TestCase[]> {
  const filepath = join(dataDir, 'clinc150_small.json');
  if (!existsSync(filepath)) {
    console.log(`⚠️  CLINC150 dataset not found: ${filepath}`);
    return [];
  }
  
  console.log('🔄 Adapting CLINC150 dataset...');
  const content = await readFile(filepath, 'utf-8');
  const data = JSON.parse(content);
  
  const adapted: TestCase[] = [];
  let id = 1;
  
  // Process all samples (train, validation, test)
  for (const [split, samples] of Object.entries(data)) {
    if (!Array.isArray(samples)) continue;
    
    console.log(`   Processing ${split}: ${samples.length} samples`);
    
    for (const [text, intent] of samples) {
      if (typeof text !== 'string' || typeof intent !== 'string') continue;
      
      const mapping = intentMapping[intent];
      if (!mapping) {
        // Default mapping for unmapped intents
        const defaultCategory = text.length < 20 ? 'prompt' : 'workflow';
        adapted.push({
          id: id++,
          text: text.trim(),
          expected: defaultCategory,
          source: 'clinc150',
          original_intent: intent,
          complexity: categorizeComplexity(text, intent),
          confidence: 0.5 // Low confidence for unmapped
        });
      } else {
        adapted.push({
          id: id++,
          text: text.trim(),
          expected: mapping.category,
          source: 'clinc150',
          original_intent: intent,
          complexity: categorizeComplexity(text, intent),
          confidence: mapping.confidence
        });
      }
    }
  }
  
  console.log(`✅ Adapted ${adapted.length} samples from CLINC150`);
  return adapted;
}

async function adaptBankingDataset(): Promise<TestCase[]> {
  const filepath = join(dataDir, 'banking_intent.csv');
  if (!existsSync(filepath)) {
    console.log(`⚠️  Banking dataset not found: ${filepath}`);
    return [];
  }
  
  console.log('🔄 Adapting Banking Intent dataset...');
  const content = await readFile(filepath, 'utf-8');
  const lines = content.split('\n').filter(line => line.trim());
  
  const adapted: TestCase[] = [];
  let id = 10000; // Different ID range
  
  // Skip header if present
  const startIndex = lines[0].toLowerCase().includes('text') ? 1 : 0;
  
  for (let i = startIndex; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;
    
    // Parse CSV line (simple parsing, assuming no commas in text)
    const parts = line.split(',');
    if (parts.length < 2) continue;
    
    const text = parts[0].replace(/"/g, '').trim();
    const label = parts[1].trim();
    
    // Map banking categories to our system
    let category: 'command' | 'prompt' | 'workflow';
    let confidence: number;
    
    if (text.toLowerCase().includes('help') || text.toLowerCase().includes('how')) {
      category = 'prompt';
      confidence = 0.8;
    } else if (text.toLowerCase().includes('update') || text.toLowerCase().includes('change')) {
      category = 'workflow';
      confidence = 0.8;
    } else {
      // Most banking queries are workflow-like (multi-step processes)
      category = 'workflow';
      confidence = 0.7;
    }
    
    adapted.push({
      id: id++,
      text: text.toLowerCase(), // Normalize case
      expected: category,
      source: 'banking_intent',
      original_intent: `banking_${label}`,
      complexity: categorizeComplexity(text),
      confidence
    });
  }
  
  console.log(`✅ Adapted ${adapted.length} samples from Banking Intent`);
  return adapted;
}

function addSyntheticSamples(): TestCase[] {
  console.log('🔄 Adding synthetic command/prompt/workflow samples...');
  
  const synthetic: TestCase[] = [
    // COMMAND samples
    { id: 20001, text: '/help', expected: 'command', source: 'synthetic', complexity: 'low', confidence: 1.0 },
    { id: 20002, text: '/status', expected: 'command', source: 'synthetic', complexity: 'low', confidence: 1.0 },
    { id: 20003, text: '/config show', expected: 'command', source: 'synthetic', complexity: 'low', confidence: 1.0 },
    { id: 20004, text: '/exit', expected: 'command', source: 'synthetic', complexity: 'low', confidence: 1.0 },
    { id: 20005, text: '/model list', expected: 'command', source: 'synthetic', complexity: 'low', confidence: 1.0 },
    { id: 20006, text: '/clear history', expected: 'command', source: 'synthetic', complexity: 'low', confidence: 1.0 },
    { id: 20007, text: '/save session', expected: 'command', source: 'synthetic', complexity: 'medium', confidence: 0.9 },
    { id: 20008, text: '/load previous', expected: 'command', source: 'synthetic', complexity: 'medium', confidence: 0.9 },
    
    // PROMPT samples  
    { id: 20101, text: 'hi', expected: 'prompt', source: 'synthetic', complexity: 'low', confidence: 1.0 },
    { id: 20102, text: 'what is recursion?', expected: 'prompt', source: 'synthetic', complexity: 'low', confidence: 0.9 },
    { id: 20103, text: 'explain quicksort algorithm', expected: 'prompt', source: 'synthetic', complexity: 'medium', confidence: 0.9 },
    { id: 20104, text: 'write a function to reverse a string', expected: 'prompt', source: 'synthetic', complexity: 'medium', confidence: 0.8 },
    { id: 20105, text: 'how do I use TypeScript interfaces?', expected: 'prompt', source: 'synthetic', complexity: 'medium', confidence: 0.9 },
    { id: 20106, text: 'can you help me understand closures?', expected: 'prompt', source: 'synthetic', complexity: 'medium', confidence: 0.9 },
    { id: 20107, text: 'thanks for the help', expected: 'prompt', source: 'synthetic', complexity: 'low', confidence: 1.0 },
    { id: 20108, text: 'generate a random password', expected: 'prompt', source: 'synthetic', complexity: 'medium', confidence: 0.7 },
    
    // WORKFLOW samples
    { id: 20201, text: 'fix the bug in auth.ts and run tests', expected: 'workflow', source: 'synthetic', complexity: 'high', confidence: 0.9 },
    { id: 20202, text: 'implement OAuth authentication with tests and documentation', expected: 'workflow', source: 'synthetic', complexity: 'high', confidence: 0.9 },
    { id: 20203, text: 'refactor the database layer and update the API endpoints', expected: 'workflow', source: 'synthetic', complexity: 'high', confidence: 0.9 },
    { id: 20204, text: 'create a new React component and add it to the main page', expected: 'workflow', source: 'synthetic', complexity: 'high', confidence: 0.8 },
    { id: 20205, text: 'debug the memory leak in server.js and deploy the fix', expected: 'workflow', source: 'synthetic', complexity: 'high', confidence: 0.9 },
    { id: 20206, text: 'analyze the performance issues and optimize the slow queries', expected: 'workflow', source: 'synthetic', complexity: 'high', confidence: 0.8 },
    { id: 20207, text: 'set up CI/CD pipeline and configure automated testing', expected: 'workflow', source: 'synthetic', complexity: 'high', confidence: 0.9 },
    { id: 20208, text: 'migrate the database schema and update all related code', expected: 'workflow', source: 'synthetic', complexity: 'high', confidence: 0.9 },
  ];
  
  console.log(`✅ Added ${synthetic.length} synthetic samples`);
  return synthetic;
}

function calculateDistribution(testCases: TestCase[]): Record<string, number> {
  const dist = { command: 0, prompt: 0, workflow: 0 };
  for (const tc of testCases) {
    dist[tc.expected]++;
  }
  return dist;
}

async function createAdaptedDataset(): Promise<void> {
  console.log('🚀 Dataset Adaptation Script');
  console.log('============================\n');
  
  // Collect all adapted samples
  const allSamples: TestCase[] = [];
  
  // Add samples from different sources
  allSamples.push(...await adaptCLINC150());
  allSamples.push(...await adaptBankingDataset());
  allSamples.push(...addSyntheticSamples());
  
  // Create the final dataset
  const adaptedDataset: AdaptedDataset = {
    metadata: {
      name: 'Command-Prompt-Workflow Classification Dataset',
      version: '1.0',
      generated: new Date().toISOString(),
      total_samples: allSamples.length,
      categories: ['command', 'prompt', 'workflow'],
      sources: [...new Set(allSamples.map(s => s.source))],
      distribution: calculateDistribution(allSamples)
    },
    test_cases: allSamples
  };
  
  // Save the dataset
  const outputPath = join(dataDir, 'command_prompt_workflow_dataset.json');
  await writeFile(outputPath, JSON.stringify(adaptedDataset, null, 2));
  
  console.log('\n📊 Dataset Adaptation Complete');
  console.log('==============================');
  console.log(`📁 Output: ${outputPath}`);
  console.log(`📈 Total samples: ${adaptedDataset.metadata.total_samples.toLocaleString()}`);
  console.log(`📋 Sources: ${adaptedDataset.metadata.sources.join(', ')}`);
  console.log('\n📊 Distribution:');
  for (const [category, count] of Object.entries(adaptedDataset.metadata.distribution)) {
    const percentage = ((count / adaptedDataset.metadata.total_samples) * 100).toFixed(1);
    console.log(`   ${category}: ${count.toLocaleString()} (${percentage}%)`);
  }
  
  console.log('\n🎯 Dataset Ready for Testing!');
  console.log('Use the comprehensive test runner to evaluate your models.');
}

// Execute if run directly
if (import.meta.main) {
  createAdaptedDataset().catch(console.error);
}

export { createAdaptedDataset, TestCase, AdaptedDataset };