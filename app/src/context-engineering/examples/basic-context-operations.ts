/**
 * Basic Context Engineering Operations Example
 *
 * Demonstrates fundamental context engineering patterns:
 * - Write Strategy: External memory management
 * - Select Strategy: Intelligent context retrieval
 * - Compress Strategy: Information density optimization
 * - Isolate Strategy: Selective context exposure
 */

import type { QiError, Result } from '@qi/base';
import { failure, match, success } from '@qi/base';
import { z } from 'zod';

// Import our context engineering schemas (would be from actual implementation)
const ContextSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['conversation', 'task', 'workflow']),
  content: z.record(z.unknown()),
  metadata: z.object({
    priority: z.number().min(0).max(10).default(5),
    relevanceScore: z.number().min(0).max(1).default(0),
    tags: z.array(z.string()).default([]),
    createdAt: z.date().default(() => new Date()),
    lastAccessed: z.date().default(() => new Date()),
  }),
});

type Context = z.infer<typeof ContextSchema>;

// Mock implementations for demonstration
class MockWriteStrategy {
  private storage = new Map<string, Context>();

  async storeInMemory(context: Context): Promise<Result<string, QiError>> {
    try {
      const ref = `memory:${context.id}`;
      this.storage.set(ref, context);
      console.log(`📝 Stored context ${context.id} in memory`);
      return success(ref);
    } catch (error) {
      return failure({
        code: 'STORE_ERROR',
        message: `Failed to store context: ${error}`,
        category: 'SYSTEM' as const,
      });
    }
  }

  async retrieveFromMemory(ref: string): Promise<Result<Context, QiError>> {
    const context = this.storage.get(ref);
    if (!context) {
      return failure({
        code: 'NOT_FOUND',
        message: `Context not found: ${ref}`,
        category: 'BUSINESS' as const,
      });
    }

    console.log(`📖 Retrieved context ${context.id} from memory`);
    return success(context);
  }
}

class MockSelectStrategy {
  async selectByRelevance(
    contexts: Context[],
    query: string,
    limit: number
  ): Promise<Result<Context[], QiError>> {
    try {
      // Simple relevance scoring based on content matching
      const scored = contexts.map((context) => ({
        context,
        score: this.calculateRelevance(context, query),
      }));

      // Sort by score and take top N
      scored.sort((a, b) => b.score - a.score);
      const selected = scored.slice(0, limit).map((s) => s.context);

      console.log(`🎯 Selected ${selected.length} contexts for query: "${query}"`);
      return success(selected);
    } catch (error) {
      return failure({
        code: 'SELECTION_ERROR',
        message: `Failed to select contexts: ${error}`,
        category: 'SYSTEM' as const,
      });
    }
  }

  private calculateRelevance(context: Context, query: string): number {
    const contentText = JSON.stringify(context.content).toLowerCase();
    const queryText = query.toLowerCase();

    // Simple keyword matching
    const queryWords = queryText.split(/\s+/);
    const matches = queryWords.filter((word) => contentText.includes(word)).length;

    return matches / queryWords.length;
  }
}

class MockCompressStrategy {
  async compressLossless(context: Context): Promise<Result<CompressedContext, QiError>> {
    try {
      const originalSize = JSON.stringify(context).length;

      // Mock compression - remove unnecessary whitespace
      const compressed = JSON.stringify(context);
      const compressedSize = compressed.length;
      const ratio = compressedSize / originalSize;

      const result: CompressedContext = {
        contextId: context.id,
        algorithm: 'mock-lossless',
        data: btoa(compressed),
        originalSize,
        compressedSize,
        compressionRatio: ratio,
      };

      console.log(
        `🗜️ Compressed context ${context.id}: ${originalSize} → ${compressedSize} bytes (${(ratio * 100).toFixed(1)}%)`
      );
      return success(result);
    } catch (error) {
      return failure({
        code: 'COMPRESSION_ERROR',
        message: `Failed to compress context: ${error}`,
        category: 'SYSTEM' as const,
      });
    }
  }

  async decompress(compressed: CompressedContext): Promise<Result<Context, QiError>> {
    try {
      const decompressed = JSON.parse(atob(compressed.data));
      const validation = ContextSchema.safeParse(decompressed);

      if (!validation.success) {
        return failure({
          code: 'DECOMPRESSION_ERROR',
          message: 'Decompressed data is invalid',
          category: 'VALIDATION' as const,
        });
      }

      console.log(`📦 Decompressed context ${compressed.contextId}`);
      return success(validation.data);
    } catch (error) {
      return failure({
        code: 'DECOMPRESSION_ERROR',
        message: `Failed to decompress context: ${error}`,
        category: 'SYSTEM' as const,
      });
    }
  }
}

class MockIsolateStrategy {
  async exposeFields(
    context: Context,
    fields: string[]
  ): Promise<Result<Partial<Context>, QiError>> {
    try {
      const exposed: Partial<Context> = {
        id: context.id,
        type: context.type,
      };

      // Only expose requested fields
      for (const field of fields) {
        if (field in context) {
          (exposed as any)[field] = (context as any)[field];
        }
      }

      console.log(`🔒 Exposed fields [${fields.join(', ')}] for context ${context.id}`);
      return success(exposed);
    } catch (error) {
      return failure({
        code: 'ISOLATION_ERROR',
        message: `Failed to expose fields: ${error}`,
        category: 'SYSTEM' as const,
      });
    }
  }
}

// Supporting types
interface CompressedContext {
  contextId: string;
  algorithm: string;
  data: string;
  originalSize: number;
  compressedSize: number;
  compressionRatio: number;
}

// Example usage demonstrating all four strategies
export async function demonstrateContextEngineering(): Promise<void> {
  console.log('🚀 Starting Context Engineering Demonstration\n');

  // Initialize strategies
  const writeStrategy = new MockWriteStrategy();
  const selectStrategy = new MockSelectStrategy();
  const compressStrategy = new MockCompressStrategy();
  const isolateStrategy = new MockIsolateStrategy();

  // Create sample contexts
  const contexts: Context[] = [
    {
      id: crypto.randomUUID(),
      type: 'conversation',
      content: {
        messages: [
          { role: 'user', content: 'How do I implement context engineering?' },
          { role: 'assistant', content: 'Context engineering involves four key strategies...' },
        ],
      },
      metadata: {
        priority: 8,
        relevanceScore: 0.9,
        tags: ['context-engineering', 'conversation'],
        createdAt: new Date(),
        lastAccessed: new Date(),
      },
    },
    {
      id: crypto.randomUUID(),
      type: 'task',
      content: {
        title: 'Implement Write Strategy',
        description: 'Create external memory management system',
        status: 'in-progress',
      },
      metadata: {
        priority: 6,
        relevanceScore: 0.7,
        tags: ['task', 'implementation'],
        createdAt: new Date(),
        lastAccessed: new Date(),
      },
    },
    {
      id: crypto.randomUUID(),
      type: 'workflow',
      content: {
        name: 'Context Processing Pipeline',
        steps: ['validate', 'store', 'index', 'compress'],
      },
      metadata: {
        priority: 7,
        relevanceScore: 0.8,
        tags: ['workflow', 'pipeline'],
        createdAt: new Date(),
        lastAccessed: new Date(),
      },
    },
  ];

  // WRITE STRATEGY: Store contexts in external memory
  console.log('📝 WRITE STRATEGY - External Memory Management');
  console.log('='.repeat(50));

  const storageRefs: string[] = [];
  for (const context of contexts) {
    const storeResult = await writeStrategy.storeInMemory(context);
    match(
      (ref) => storageRefs.push(ref),
      (error) => console.error(`❌ Storage failed: ${error.message}`),
      storeResult
    );
  }
  console.log('');

  // SELECT STRATEGY: Intelligent context retrieval
  console.log('🎯 SELECT STRATEGY - Intelligent Retrieval');
  console.log('='.repeat(50));

  const query = 'context engineering implementation';
  const selectResult = await selectStrategy.selectByRelevance(contexts, query, 2);

  match(
    (selected) => {
      console.log(`Found ${selected.length} relevant contexts:`);
      selected.forEach((ctx, i) => {
        console.log(`  ${i + 1}. ${ctx.type}: ${JSON.stringify(ctx.content).substring(0, 100)}...`);
      });
    },
    (error) => console.error(`❌ Selection failed: ${error.message}`),
    selectResult
  );
  console.log('');

  // COMPRESS STRATEGY: Information density optimization
  console.log('🗜️ COMPRESS STRATEGY - Information Density Optimization');
  console.log('='.repeat(60));

  const largestContext = contexts.reduce((largest, current) =>
    JSON.stringify(current).length > JSON.stringify(largest).length ? current : largest
  );

  const compressResult = await compressStrategy.compressLossless(largestContext);
  match(
    async (compressed) => {
      console.log(`Compression successful!`);

      // Demonstrate decompression
      const decompressResult = await compressStrategy.decompress(compressed);
      match(
        (decompressed) => console.log(`✅ Decompression verified - context intact`),
        (error) => console.error(`❌ Decompression failed: ${error.message}`),
        decompressResult
      );
    },
    (error) => console.error(`❌ Compression failed: ${error.message}`),
    compressResult
  );
  console.log('');

  // ISOLATE STRATEGY: Selective context exposure
  console.log('🔒 ISOLATE STRATEGY - Selective Context Exposure');
  console.log('='.repeat(50));

  const sensitiveContext = contexts[0];
  const exposedFields = ['id', 'type', 'metadata'];

  const isolateResult = await isolateStrategy.exposeFields(sensitiveContext, exposedFields);
  match(
    (exposed) => {
      console.log('Exposed context (sensitive content hidden):');
      console.log(JSON.stringify(exposed, null, 2));
    },
    (error) => console.error(`❌ Isolation failed: ${error.message}`),
    isolateResult
  );
  console.log('');

  // DEMONSTRATION: Context retrieval from storage
  console.log('📖 RETRIEVAL DEMONSTRATION - Accessing Stored Contexts');
  console.log('='.repeat(55));

  if (storageRefs.length > 0) {
    const retrieveResult = await writeStrategy.retrieveFromMemory(storageRefs[0]);
    match(
      (retrieved) => {
        console.log(`Successfully retrieved context: ${retrieved.id}`);
        console.log(`Type: ${retrieved.type}`);
        console.log(`Priority: ${retrieved.metadata.priority}`);
        console.log(`Tags: ${retrieved.metadata.tags.join(', ')}`);
      },
      (error) => console.error(`❌ Retrieval failed: ${error.message}`),
      retrieveResult
    );
  }

  console.log('\n🎉 Context Engineering Demonstration Complete!\n');
  console.log('Key Takeaways:');
  console.log('• Write Strategy: External memory frees up prompt space');
  console.log('• Select Strategy: Intelligent selection improves relevance');
  console.log('• Compress Strategy: Reduces storage and transfer costs');
  console.log('• Isolate Strategy: Protects sensitive information');
}

// Run the demonstration if this file is executed directly
if (import.meta.main) {
  await demonstrateContextEngineering();
}
