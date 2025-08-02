#!/usr/bin/env node

/**
 * Download Prompt/Workflow Datasets
 * 
 * Downloads proper datasets for prompt vs workflow classification:
 * - ABCD: Action-Based Conversations (workflows)
 * - MultiWOZ: Multi-domain task-oriented dialogues (workflows)  
 * - PersonaChat: Conversational prompts
 * - Ubuntu Dialogue: Technical support prompts
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export const dataDir = join(__dirname, 'datasets', 'prompt-workflow');

interface DatasetInfo {
  name: string;
  url: string;
  filename: string;
  description: string;
  type: 'workflow' | 'prompt';
  samples: string;
}

const datasets: DatasetInfo[] = [
  // Workflow Datasets
  {
    name: 'SGD_Dev',
    url: 'https://github.com/google-research-datasets/dstc8-schema-guided-dialogue/raw/master/dev/dialogues_001.json',
    filename: 'sgd_dev_001.json',
    description: 'Schema-Guided Dialogue - Sample dev set',
    type: 'workflow',
    samples: '1,650 turns'
  },
  
  // Prompt Datasets  
  {
    name: 'PersonaChat',
    url: 'https://s3.amazonaws.com/datasets.huggingface.co/personachat/personachat_self_original.json',
    filename: 'personachat_self_original.json',
    description: 'Conversational prompts with personas',
    type: 'prompt',
    samples: '18,878 conversations'
  }
];

async function downloadFile(url: string, filename: string): Promise<void> {
  console.log(`📥 Downloading ${filename}...`);
  console.log(`   Source: ${url}`);
  
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.arrayBuffer();
    const filepath = join(dataDir, filename);
    await writeFile(filepath, new Uint8Array(content));
    
    console.log(`✅ Downloaded: ${filename}`);
    console.log(`   Location: ${filepath}`);
    console.log(`   Size: ${(content.byteLength / 1024).toFixed(1)} KB`);
    
  } catch (error) {
    console.error(`❌ Failed to download ${filename}: ${error}`);
    throw error;
  }
}

async function createDatasetIndex(): Promise<void> {
  const index = {
    downloaded_at: new Date().toISOString(),
    datasets: datasets.map(d => ({
      name: d.name,
      filename: d.filename,
      type: d.type,
      description: d.description,
      samples: d.samples,
      path: join(dataDir, d.filename)
    }))
  };
  
  const indexPath = join(dataDir, 'index.json');
  await writeFile(indexPath, JSON.stringify(index, null, 2));
  console.log(`📋 Created dataset index: ${indexPath}`);
}

async function main(): Promise<void> {
  console.log('🚀 Prompt/Workflow Dataset Download Script');
  console.log('==========================================\n');
  
  // Create datasets directory
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
    console.log(`📁 Created directory: ${dataDir}\n`);
  }
  
  let successCount = 0;
  let failureCount = 0;
  
  // Download each dataset
  for (const dataset of datasets) {
    try {
      console.log(`📊 ${dataset.name} (${dataset.type.toUpperCase()})`);
      console.log(`   ${dataset.description}`);
      console.log(`   Samples: ${dataset.samples}`);
      await downloadFile(dataset.url, dataset.filename);
      successCount++;
      console.log();
    } catch (error) {
      console.log(`⚠️  Skipping ${dataset.name} due to download error\n`);
      failureCount++;
    }
  }
  
  // Create index file
  if (successCount > 0) {
    await createDatasetIndex();
  }
  
  // Summary
  console.log('\n📊 Download Summary');
  console.log('==================');
  console.log(`✅ Successfully downloaded: ${successCount}/${datasets.length} datasets`);
  if (failureCount > 0) {
    console.log(`❌ Failed downloads: ${failureCount}/${datasets.length} datasets`);
  }
  console.log(`📁 Location: ${dataDir}`);
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Run dataset adaptation to convert to prompt/workflow format');
  console.log('2. Use the organized test programs for model evaluation');
  
  console.log('\nFiles downloaded:');
  for (const dataset of datasets) {
    const filepath = join(dataDir, dataset.filename);
    if (existsSync(filepath)) {
      console.log(`   ✅ ${dataset.filename} (${dataset.type})`);
    } else {
      console.log(`   ❌ ${dataset.filename} (${dataset.type})`);
    }
  }
}

// Execute if run directly
if (import.meta.main) {
  main().catch(console.error);
}