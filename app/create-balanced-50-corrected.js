#!/usr/bin/env node
/**
 * Create a corrected 50-sample dataset from the large dataset
 */

import { readFileSync, writeFileSync } from 'fs';

// Read the large dataset
const largeDataset = JSON.parse(readFileSync('./src/study/data-ops/datasets/balanced-100x3.json', 'utf8'));

// Take first 50 samples (mix of commands, prompts, workflows based on interleaved pattern)
const selectedSamples = largeDataset.samples.slice(0, 50);

// Apply corrections based on our analysis
const corrections = [
  // Fix obvious conversational prompts mislabeled as workflows
  { pattern: /Yes, thanks\. What's their phone number\?/, from: 'workflow', to: 'prompt' },
  { pattern: /What's their address\? Do they have vegetarian options/, from: 'workflow', to: 'prompt' },  
  { pattern: /Thanks very much\./, from: 'workflow', to: 'prompt' },
  { pattern: /No, that's all\. Thanks\./, from: 'workflow', to: 'prompt' },
  { pattern: /^Thank you/, from: 'workflow', to: 'prompt' },
  { pattern: /^You're welcome/, from: 'workflow', to: 'prompt' },
  { pattern: /^Great, thank you/, from: 'workflow', to: 'prompt' },
  { pattern: /^Perfect, thanks/, from: 'workflow', to: 'prompt' },
  { pattern: /sounds good/i, from: 'workflow', to: 'prompt' },
];

const correctedSamples = selectedSamples.map(sample => {
  let correctedSample = { ...sample };
  
  // Apply corrections
  for (const correction of corrections) {
    if (correction.pattern.test(sample.input) && sample.expected === correction.from) {
      correctedSample.expected = correction.to;
      correctedSample.correction = `${correction.from}→${correction.to}: conversation/gratitude pattern`;
      break;
    }
  }
  
  return correctedSample;
});

// Count categories after corrections
const distribution = {
  command: correctedSamples.filter(s => s.expected === 'command').length,
  prompt: correctedSamples.filter(s => s.expected === 'prompt').length,
  workflow: correctedSamples.filter(s => s.expected === 'workflow').length,
};

// Create corrected dataset
const correctedDataset = {
  metadata: {
    created: new Date().toISOString(),
    version: "corrected-50-v1",
    totalSamples: 50,
    originalSource: "balanced-100x3.json (first 50 samples)",
    distribution,
    corrections: {
      applied: corrections.length,
      criteria: "workflow = requires multiple coordinated steps; prompt = single response/conversation"
    }
  },
  samples: correctedSamples
};

// Write corrected dataset
writeFileSync('./src/study/data-ops/datasets/balanced-50-corrected.json', JSON.stringify(correctedDataset, null, 2));

console.log('Created balanced-50-corrected.json with:');
console.log(`- Commands: ${distribution.command}`);
console.log(`- Prompts: ${distribution.prompt}`);
console.log(`- Workflows: ${distribution.workflow}`);
console.log(`- Total: ${correctedSamples.length}`);

const correctedCount = correctedSamples.filter(s => s.correction).length;
console.log(`- Corrections applied: ${correctedCount}`);