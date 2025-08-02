#!/usr/bin/env node

/**
 * Dataset Download Script
 * 
 * Downloads and prepares multiple classification datasets for testing:
 * - CLINC150: 150 intent classes, 22,500 samples
 * - Banking Intent: 3 categories banking dataset  
 * - SNIPS: 7 intent classes (via DeepPavlov if available)
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { existsSync } from 'node:fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const dataDir = join(__dirname, 'datasets');

interface DatasetInfo {
  name: string;
  url: string;
  filename: string;
  description: string;
  format: 'json' | 'csv';
  size: string;
}

const datasets: DatasetInfo[] = [
  {
    name: 'CLINC150',
    url: 'https://raw.githubusercontent.com/clinc/oos-eval/master/data/data_full.json',
    filename: 'clinc150_full.json',
    description: '150 intent classes, 22,500 samples total',
    format: 'json',
    size: '22,500 samples'
  },
  {
    name: 'CLINC150_Small',
    url: 'https://raw.githubusercontent.com/clinc/oos-eval/master/data/data_small.json',
    filename: 'clinc150_small.json', 
    description: '150 intent classes, smaller version',
    format: 'json',
    size: '11,250 samples'
  },
  {
    name: 'Banking_Intent',
    url: 'https://raw.githubusercontent.com/GiteshJ/Text-Intent-Classification/master/dataset.csv',
    filename: 'banking_intent.csv',
    description: '3 categories: transaction, account, payment issues',
    format: 'csv',
    size: '~500 samples'
  }
];

async function downloadDataset(dataset: DatasetInfo): Promise<boolean> {
  try {
    console.log(`📥 Downloading ${dataset.name}...`);
    console.log(`   Source: ${dataset.url}`);
    console.log(`   Size: ${dataset.size}`);
    
    const response = await fetch(dataset.url);
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }
    
    const content = await response.text();
    const filepath = join(dataDir, dataset.filename);
    
    await writeFile(filepath, content, 'utf-8');
    
    console.log(`✅ Downloaded: ${dataset.filename}`);
    console.log(`   Location: ${filepath}`);
    
    // Validate the downloaded content
    if (dataset.format === 'json') {
      try {
        const parsed = JSON.parse(content);
        const sampleCount = Array.isArray(parsed) ? parsed.length : Object.keys(parsed).length;
        console.log(`   Samples: ${sampleCount.toLocaleString()}`);
      } catch (e) {
        console.log(`   Note: JSON structure validation failed, but file saved`);
      }
    } else if (dataset.format === 'csv') {
      const lines = content.split('\n').filter(line => line.trim());
      console.log(`   Lines: ${lines.length.toLocaleString()}`);
    }
    
    return true;
  } catch (error) {
    console.error(`❌ Failed to download ${dataset.name}:`);
    console.error(`   Error: ${error instanceof Error ? error.message : error}`);
    return false;
  }
}

async function createDatasetIndex(): Promise<void> {
  const indexData = {
    generated: new Date().toISOString(),
    description: "Downloaded datasets for command/prompt/workflow classification testing",
    datasets: datasets.map(d => ({
      name: d.name,
      filename: d.filename,
      description: d.description,
      format: d.format,
      size: d.size,
      downloaded: existsSync(join(dataDir, d.filename))
    }))
  };
  
  const indexPath = join(dataDir, 'index.json');
  await writeFile(indexPath, JSON.stringify(indexData, null, 2));
  console.log(`📋 Created dataset index: ${indexPath}`);
}

async function downloadAllDatasets(): Promise<void> {
  console.log('🚀 Dataset Download Script');
  console.log('==========================\n');
  
  // Create datasets directory
  if (!existsSync(dataDir)) {
    await mkdir(dataDir, { recursive: true });
    console.log(`📁 Created directory: ${dataDir}\n`);
  }
  
  let successCount = 0;
  let totalCount = datasets.length;
  
  for (const dataset of datasets) {
    const success = await downloadDataset(dataset);
    if (success) successCount++;
    console.log(); // Empty line for readability
  }
  
  // Create index file
  await createDatasetIndex();
  
  console.log('\n📊 Download Summary');
  console.log('==================');
  console.log(`✅ Successfully downloaded: ${successCount}/${totalCount} datasets`);
  console.log(`📁 Location: ${dataDir}`);
  
  if (successCount < totalCount) {
    console.log(`⚠️  ${totalCount - successCount} datasets failed to download`);
    console.log('   Check network connection and URLs');
  }
  
  console.log('\n🎯 Next Steps:');
  console.log('1. Run the data adapter to convert to command/prompt/workflow format');
  console.log('2. Use the comprehensive test runner for model evaluation');
  console.log('\nFiles downloaded:');
  datasets.forEach(d => {
    const exists = existsSync(join(dataDir, d.filename));
    console.log(`   ${exists ? '✅' : '❌'} ${d.filename}`);
  });
}

// Execute if run directly
if (import.meta.main) {
  downloadAllDatasets().catch(console.error);
}

export { downloadAllDatasets, datasets, dataDir };