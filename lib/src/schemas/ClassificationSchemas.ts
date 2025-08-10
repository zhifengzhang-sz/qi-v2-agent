/**
 * Classification Schema Registry
 *
 * Centralized collection of Zod schemas for different classification tasks.
 * Schemas are defined once and reused across different classifiers.
 */

import { z } from 'zod';

/**
 * Three-type input classification schema
 * Used for command/prompt/workflow classification
 */
export const ThreeTypeSchema = z.object({
  type: z
    .enum(['command', 'prompt', 'workflow'])
    .describe(
      'command: System commands starting with "/", ' +
        'prompt: Single-step conversational requests or questions, ' +
        'workflow: Multi-step tasks requiring file operations or orchestration'
    ),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  reasoning: z.string().max(200).describe('Brief explanation of the classification'),
});

/**
 * Sentiment analysis schema
 */
export const SentimentSchema = z.object({
  sentiment: z.enum(['positive', 'negative', 'neutral']).describe('Overall sentiment of the text'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  intensity: z.number().min(0).max(1).describe('Intensity of the sentiment from 0.0 to 1.0'),
});

/**
 * Intent detection schema
 */
export const IntentSchema = z.object({
  intent: z.string().describe('The identified intent or purpose'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  entities: z
    .array(
      z.object({
        name: z.string().describe('Entity name or type'),
        value: z.string().describe('Entity value'),
        start: z.number().optional().describe('Start position in text'),
        end: z.number().optional().describe('End position in text'),
      })
    )
    .describe('Extracted entities from the input'),
});

/**
 * Topic classification schema
 */
export const TopicSchema = z.object({
  topic: z.string().describe('Primary topic or category'),
  confidence: z.number().min(0).max(1).describe('Confidence score from 0.0 to 1.0'),
  subtopics: z.array(z.string()).describe('Related subtopics or categories'),
});

/**
 * Registry of all available classification schemas
 */
export const ClassificationSchemas = {
  threeType: ThreeTypeSchema,
  sentiment: SentimentSchema,
  intent: IntentSchema,
  topic: TopicSchema,
} as const;

/**
 * Type definitions for schema inference
 */
export type ThreeTypeResult = z.infer<typeof ThreeTypeSchema>;
export type SentimentResult = z.infer<typeof SentimentSchema>;
export type IntentResult = z.infer<typeof IntentSchema>;
export type TopicResult = z.infer<typeof TopicSchema>;

export type SchemaKey = keyof typeof ClassificationSchemas;
export type SchemaResult<K extends SchemaKey> = z.infer<(typeof ClassificationSchemas)[K]>;
