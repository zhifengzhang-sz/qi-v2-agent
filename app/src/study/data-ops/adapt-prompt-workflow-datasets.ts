#!/usr/bin/env node

/**
 * Adapt Prompt/Workflow Datasets for 3-Type Classification
 * 
 * Converts PersonaChat (prompts) and SGD (workflows) to our command/prompt/workflow format
 * for testing the classifier module with proper data instead of artificial mappings.
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

interface AdaptedDataset {
  metadata: {
    created: string;
    totalSamples: number;
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

class DatasetAdapter {
  private dataDir = join(__dirname, 'datasets', 'prompt-workflow');
  private outputPath = join(__dirname, 'datasets', 'adapted-prompt-workflow.json');

  async initialize(): Promise<void> {
    console.log('🔄 PROMPT/WORKFLOW DATASET ADAPTATION');
    console.log('====================================\n');
    
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

  async adaptPersonaChat(): Promise<TestCase[]> {
    console.log('📊 Adapting PersonaChat for PROMPT examples...');
    
    const filePath = join(this.dataDir, 'personachat_self_original.json');
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    const samples: TestCase[] = [];
    let sampleId = 1;
    
    // Use validation set for manageable size
    const validationData = data.valid;
    console.log(`   Processing ${validationData.length} conversations...`);
    
    for (const conversation of validationData) {
      // Extract personality and utterances
      const personality = conversation.personality || [];
      const utterances = conversation.utterances || [];
      
      // Create samples from user utterances (every other turn, starting from 0)
      for (let i = 0; i < utterances.length; i += 2) {
        const userUtterance = utterances[i];
        if (userUtterance && userUtterance.history && userUtterance.history.length > 0) {
          const input = userUtterance.history[userUtterance.history.length - 1];
          
          // Skip very short utterances
          if (input.length < 10) continue;
          
          // Determine complexity based on length and content
          let complexity: 'simple' | 'medium' | 'complex' = 'simple';
          if (input.length > 50) complexity = 'medium';
          if (input.length > 100 || input.includes('?') && input.includes(',')) complexity = 'complex';
          
          samples.push({
            id: sampleId++,
            input: input,
            expected: 'prompt',
            source: 'PersonaChat',
            complexity
          });
          
          // Limit to 2000 samples for manageable testing
          if (samples.length >= 2000) break;
        }
      }
      
      if (samples.length >= 2000) break;
    }
    
    console.log(`✅ Extracted ${samples.length} PROMPT samples from PersonaChat`);
    return samples;
  }

  async adaptSGD(): Promise<TestCase[]> {
    console.log('📊 Adapting SGD for WORKFLOW examples...');
    
    const filePath = join(this.dataDir, 'sgd_dev_001.json');
    const content = await readFile(filePath, 'utf-8');
    const data = JSON.parse(content);
    
    const samples: TestCase[] = [];
    let sampleId = 3000; // Start after PersonaChat IDs
    
    console.log(`   Processing ${data.length} dialogues...`);
    
    for (const dialogue of data) {
      const turns = dialogue.turns || [];
      
      // Extract user utterances (turns with speaker === 'USER')
      for (const turn of turns) {
        if (turn.speaker === 'USER' && turn.utterance) {
          const input = turn.utterance;
          
          // Skip very short utterances
          if (input.length < 15) continue;
          
          // Determine complexity based on actions and length
          let complexity: 'simple' | 'medium' | 'complex' = 'medium'; // Workflows are generally medium+
          
          // Check if this is a complex workflow (multiple actions, booking, etc.)
          const hasBooking = /book|reserve|schedule|appointment/i.test(input);
          const hasMultipleRequirements = (input.match(/and|also|plus|,/g) || []).length >= 2;
          const isLong = input.length > 80;
          
          if (hasBooking || hasMultipleRequirements || isLong) {
            complexity = 'complex';
          }
          
          samples.push({
            id: sampleId++,
            input: input,
            expected: 'workflow',
            source: 'SGD',
            complexity
          });
        }
      }
    }
    
    console.log(`✅ Extracted ${samples.length} WORKFLOW samples from SGD`);
    return samples;
  }

  generateCommandSamples(): TestCase[] {
    console.log('📊 Generating COMMAND examples...');
    
    const commandSamples = [
      // Help commands (only slash commands)
      '/help', '/h', '/?',
      
      // Configuration commands  
      '/config', '/settings', '/set', '/configure', '/setup',
      
      // System commands
      '/status', '/info', '/version', '/about', '/quit', '/exit',
      
      // List commands
      '/list', '/ls', '/show', '/display', '/view',
      
      // Clear/reset commands
      '/clear', '/reset', '/restart', '/reload', '/refresh'
    ];
    
    const samples: TestCase[] = [];
    let sampleId = 5000; // Start after workflow IDs
    
    for (const cmd of commandSamples) {
      samples.push({
        id: sampleId++,
        input: cmd,
        expected: 'command',
        source: 'Generated',
        complexity: 'simple'
      });
    }
    
    console.log(`✅ Generated ${samples.length} COMMAND samples`);
    return samples;
  }

  async createAdaptedDataset(): Promise<void> {
    console.log('\n🔄 Creating adapted dataset...');
    
    // Adapt all datasets
    const promptSamples = await this.adaptPersonaChat();
    const workflowSamples = await this.adaptSGD();
    const commandSamples = this.generateCommandSamples();
    
    // Combine all samples
    const allSamples = [...promptSamples, ...workflowSamples, ...commandSamples];
    
    // Create metadata
    const metadata = {
      created: new Date().toISOString(),
      totalSamples: allSamples.length,
      distribution: {
        command: commandSamples.length,
        prompt: promptSamples.length,
        workflow: workflowSamples.length
      },
      sources: {
        PersonaChat: promptSamples.length,
        SGD: workflowSamples.length,
        Generated: commandSamples.length
      }
    };
    
    // Create final dataset
    const adaptedDataset: AdaptedDataset = {
      metadata,
      samples: allSamples
    };
    
    // Save to file
    await writeFile(this.outputPath, JSON.stringify(adaptedDataset, null, 2));
    
    console.log(`✅ Adapted dataset saved to: ${this.outputPath}`);
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
    
    console.log('\n🎯 READY FOR CLASSIFIER TESTING');
    console.log('This dataset can now be used to properly test our 3-type classification system.');
  }

  async run(): Promise<void> {
    await this.initialize();
    await this.createAdaptedDataset();
  }
}

// Execute if run directly
if (import.meta.main) {
  const adapter = new DatasetAdapter();
  adapter.run().catch(console.error);
}