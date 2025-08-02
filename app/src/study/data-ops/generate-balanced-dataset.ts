#!/usr/bin/env node

/**
 * Balanced Dataset Generator
 * 
 * Generates balanced datasets with equal numbers of command/prompt/workflow samples
 * Commands are easy to generate, prompts from PersonaChat, workflows from SGD
 */

import { readFile, writeFile } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

interface TestCase {
  id: number;
  input: string;
  expected: 'command' | 'prompt' | 'workflow';
  source: string;
  complexity: 'simple' | 'medium' | 'complex';
}

interface BalancedDataset {
  metadata: {
    created: string;
    totalSamples: number;
    samplesPerCategory: number;
    distribution: {
      command: number;
      prompt: number;
      workflow: number;
    };
    sources: {
      [key: string]: number;
    };
  };
  samples: TestCase[];
}

class BalancedDatasetGenerator {
  private dataDir = join(__dirname, 'datasets', 'prompt-workflow');
  private samplesPerCategory: number;

  constructor(samplesPerCategory: number) {
    this.samplesPerCategory = samplesPerCategory;
  }

  async initialize(): Promise<void> {
    console.log('🔄 BALANCED DATASET GENERATION');
    console.log('==============================\n');
    console.log(`Generating ${this.samplesPerCategory} samples per category\n`);
    
    // Check if datasets exist
    const personaChatPath = join(this.dataDir, 'personachat_self_original.json');
    const sgdPath = join(this.dataDir, 'sgd_dev_001.json');
    
    if (!existsSync(personaChatPath)) {
      console.error('❌ PersonaChat dataset not found. Run:');
      console.error('   bun run study:download-pw');
      process.exit(1);
    }
    
    if (!existsSync(sgdPath)) {
      console.error('❌ SGD dataset not found. Run:');
      console.error('   bun run study:download-pw');
      process.exit(1);
    }
    
    console.log('✅ Required datasets found');
  }

  generateCommandSamples(): TestCase[] {
    console.log(`📊 Generating ${this.samplesPerCategory} COMMAND samples...`);
    
    // Base command words
    const baseCommands = [
      'help', 'config', 'settings', 'status', 'info', 'version', 'about',
      'quit', 'exit', 'list', 'show', 'display', 'view', 'clear', 'reset',
      'restart', 'reload', 'refresh', 'save', 'load', 'open', 'close',
      'start', 'stop', 'pause', 'resume', 'search', 'find', 'connect',
      'disconnect', 'login', 'logout', 'install', 'uninstall', 'update',
      'upgrade', 'sync', 'backup', 'restore', 'delete', 'remove', 'add',
      'create', 'edit', 'modify', 'copy', 'move', 'rename', 'chmod',
      'run', 'execute', 'build', 'compile', 'test', 'debug', 'profile',
      'monitor', 'log', 'trace', 'dump', 'export', 'import', 'convert'
    ];
    
    const samples: TestCase[] = [];
    let sampleId = 1;
    
    for (let i = 0; i < this.samplesPerCategory; i++) {
      // Pick a base command (cycle through if we need more than available)
      const baseCommand = baseCommands[i % baseCommands.length];
      
      // Add variation for uniqueness
      let command = baseCommand;
      if (i >= baseCommands.length) {
        const suffix = Math.floor(i / baseCommands.length);
        command = `${baseCommand}${suffix}`;
      }
      
      samples.push({
        id: sampleId++,
        input: `/${command}`,
        expected: 'command',
        source: 'Generated',
        complexity: 'simple'
      });
    }
    
    console.log(`✅ Generated ${samples.length} COMMAND samples`);
    return samples;
  }

  async extractPromptSamples(): Promise<TestCase[]> {
    console.log(`📊 Extracting ${this.samplesPerCategory} PROMPT samples from PersonaChat...`);
    
    const filePath = join(this.dataDir, 'personachat_self_original.json');
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    const samples: TestCase[] = [];
    let sampleId = this.samplesPerCategory + 1; // Start after commands
    
    // Use both train and validation data
    const allConversations = [...data.train, ...data.valid];
    console.log(`   Processing ${allConversations.length} conversations...`);
    
    let extracted = 0;
    for (const conversation of allConversations) {
      if (extracted >= this.samplesPerCategory) break;
      
      const utterances = conversation.utterances || [];
      
      // Extract user utterances (every other turn, starting from 0)
      for (let i = 0; i < utterances.length && extracted < this.samplesPerCategory; i += 2) {
        const userUtterance = utterances[i];
        if (userUtterance && userUtterance.history && userUtterance.history.length > 0) {
          const input = userUtterance.history[userUtterance.history.length - 1];
          
          // Skip very short utterances
          if (input.length < 8) continue;
          
          // Determine complexity
          let complexity: 'simple' | 'medium' | 'complex' = 'simple';
          if (input.length > 40) complexity = 'medium';
          if (input.length > 80 || input.includes('?') && input.includes(',')) complexity = 'complex';
          
          samples.push({
            id: sampleId++,
            input: input,
            expected: 'prompt',
            source: 'PersonaChat',
            complexity
          });
          
          extracted++;
        }
      }
    }
    
    console.log(`✅ Extracted ${samples.length} PROMPT samples from PersonaChat`);
    return samples;
  }

  async extractWorkflowSamples(): Promise<TestCase[]> {
    console.log(`📊 Extracting ${this.samplesPerCategory} WORKFLOW samples from SGD...`);
    
    const filePath = join(this.dataDir, 'sgd_dev_001.json');
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    const samples: TestCase[] = [];
    let sampleId = (this.samplesPerCategory * 2) + 1; // Start after commands and prompts
    
    console.log(`   Processing ${data.length} dialogues...`);
    
    let extracted = 0;
    
    // First pass: extract all available samples
    const allUtterances: string[] = [];
    for (const dialogue of data) {
      const turns = dialogue.turns || [];
      for (const turn of turns) {
        if (turn.speaker === 'USER' && turn.utterance) {
          const input = turn.utterance;
          if (input.length >= 15) {
            allUtterances.push(input);
          }
        }
      }
    }
    
    // If we don't have enough, duplicate with variations
    while (allUtterances.length < this.samplesPerCategory) {
      const originalLength = allUtterances.length;
      for (let i = 0; i < originalLength && allUtterances.length < this.samplesPerCategory; i++) {
        // Add slight variations to create more samples
        const original = allUtterances[i];
        const variations = [
          `Please ${original.toLowerCase()}`,
          `Can you ${original.toLowerCase()}?`,
          `I need to ${original.toLowerCase()}`,
          `Help me ${original.toLowerCase()}`
        ];
        
        for (const variation of variations) {
          if (allUtterances.length < this.samplesPerCategory) {
            allUtterances.push(variation);
          }
        }
      }
    }
    
    // Take exactly the number we need
    for (let i = 0; i < this.samplesPerCategory; i++) {
      const input = allUtterances[i];
      
      // Determine complexity
      let complexity: 'simple' | 'medium' | 'complex' = 'medium'; // Workflows are generally medium+
      
      const hasBooking = /book|reserve|schedule|appointment/i.test(input);
      const hasMultipleRequirements = (input.match(/and|also|plus|,/g) || []).length >= 2;
      const isLong = input.length > 80;
      
      if (hasBooking || hasMultipleRequirements || isLong) {
        complexity = 'complex';
      } else if (input.length < 40) {
        complexity = 'simple';
      }
      
      samples.push({
        id: sampleId++,
        input: input,
        expected: 'workflow',
        source: i < 776 ? 'SGD' : 'SGD_Generated',
        complexity
      });
    }
    
    console.log(`✅ Generated ${samples.length} WORKFLOW samples`);
    return samples;
  }

  mixSamples(commandSamples: TestCase[], promptSamples: TestCase[], workflowSamples: TestCase[]): TestCase[] {
    console.log('🔄 Mixing samples in sequence...');
    
    const mixed: TestCase[] = [];
    
    // Mix in round-robin fashion: command, prompt, workflow, command, prompt, workflow...
    for (let i = 0; i < this.samplesPerCategory; i++) {
      mixed.push(commandSamples[i]);
      mixed.push(promptSamples[i]);
      mixed.push(workflowSamples[i]);
    }
    
    console.log(`✅ Mixed ${mixed.length} samples in sequence`);
    return mixed;
  }

  async generateBalancedDataset(): Promise<void> {
    console.log('\n🔄 Creating balanced dataset...');
    
    // Generate all samples
    const commandSamples = this.generateCommandSamples();
    const promptSamples = await this.extractPromptSamples();
    const workflowSamples = await this.extractWorkflowSamples();
    
    // Mix samples in sequence
    const mixedSamples = this.mixSamples(commandSamples, promptSamples, workflowSamples);
    
    // Create metadata
    const metadata = {
      created: new Date().toISOString(),
      totalSamples: mixedSamples.length,
      samplesPerCategory: this.samplesPerCategory,
      distribution: {
        command: commandSamples.length,
        prompt: promptSamples.length,
        workflow: workflowSamples.length
      },
      sources: {
        Generated: commandSamples.length,
        PersonaChat: promptSamples.filter(s => s.source === 'PersonaChat').length,
        SGD: workflowSamples.filter(s => s.source === 'SGD').length,
        SGD_Generated: workflowSamples.filter(s => s.source === 'SGD_Generated').length
      }
    };
    
    // Create final dataset
    const balancedDataset: BalancedDataset = {
      metadata,
      samples: mixedSamples
    };
    
    // Save to file
    const outputPath = join(__dirname, 'datasets', `balanced-${this.samplesPerCategory}x3.json`);
    await writeFile(outputPath, JSON.stringify(balancedDataset, null, 2));
    
    console.log(`✅ Balanced dataset saved to: ${outputPath}`);
    console.log('\n📊 DATASET SUMMARY');
    console.log('==================');
    console.log(`Total samples: ${metadata.totalSamples}`);
    console.log(`Commands: ${metadata.distribution.command}`);
    console.log(`Prompts: ${metadata.distribution.prompt}`);
    console.log(`Workflows: ${metadata.distribution.workflow}`);
    
    console.log('\n📋 SOURCES');
    console.log('===========');
    for (const [source, count] of Object.entries(metadata.sources)) {
      console.log(`${source}: ${count} samples`);
    }
    
    console.log('\n🎯 READY FOR BALANCED CLASSIFIER TESTING');
    console.log('Each category has exactly the same number of samples for fair evaluation.');
  }

  async run(): Promise<void> {
    await this.initialize();
    await this.generateBalancedDataset();
  }
}

// Parse command line arguments
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const samplesPerCategory = args[0] ? parseInt(args[0]) : 700;
  
  if (isNaN(samplesPerCategory) || samplesPerCategory <= 0) {
    console.error('❌ Invalid number of samples. Usage:');
    console.error('   bun run src/study/generate-balanced-dataset.ts [samples_per_category]');
    console.error('   Example: bun run src/study/generate-balanced-dataset.ts 700');
    process.exit(1);
  }
  
  const generator = new BalancedDatasetGenerator(samplesPerCategory);
  await generator.run();
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}