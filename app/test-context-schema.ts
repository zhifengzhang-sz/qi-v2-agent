#!/usr/bin/env bun

import { globalSchemaRegistry } from '../lib/src/classifier/schema-registry.ts';

console.log('🧪 Testing Context-Aware Schema Registration');

// Test getting the schema
const contextSchema = globalSchemaRegistry.getSchema('context_aware');
if (contextSchema.tag === 'success') {
  console.log('✅ Context-Aware schema registered successfully');
  console.log('Schema name:', contextSchema.value.metadata.name);
  console.log('Description:', contextSchema.value.metadata.description);
  console.log('Recommended for:', contextSchema.value.metadata.recommended_for);
  console.log('Baseline accuracy estimate:', contextSchema.value.metadata.performance_profile.baseline_accuracy_estimate);
} else {
  console.log('❌ Failed to get context-aware schema:', contextSchema);
}

// List all available schemas
console.log('\n📋 All available schemas:');
const allSchemas = globalSchemaRegistry.listSchemas();
allSchemas.forEach(schema => {
  console.log(`- ${schema.metadata.name} (${schema.metadata.complexity})`);
});

// Test schema validation
console.log('\n🔍 Testing schema validation:');
try {
  const sampleData = {
    type: 'workflow',
    confidence: 0.85,
    reasoning: 'Multi-step task with coordination requirements',
    conversation_context: 'task_request',
    step_count: 3,
    requires_coordination: true
  };
  
  const validated = contextSchema.value.schema.parse(sampleData);
  console.log('✅ Schema validation successful:', validated);
} catch (error) {
  console.log('❌ Schema validation failed:', error);
}