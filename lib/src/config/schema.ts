import { z } from 'zod';

export const ServerConfigSchema = z.object({
  transport: z.enum(['stdio', 'sse', 'http']),
  command: z.string().optional(),
  args: z.array(z.string()).optional(),
  url: z.string().url().optional(),
  env: z.record(z.string()).optional(),
});

export const ModelConfigSchema = z.object({
  name: z.string().default('deepseek-r1'),
  temperature: z.number().min(0).max(2).default(0.1),
  baseUrl: z.string().url().optional().default('http://localhost:11434'),
  thinkingEnabled: z.boolean().optional().default(true),
  maxTokens: z.number().min(1).max(100000).optional().default(4000),
  topP: z.number().min(0).max(1).optional().default(0.9),
});

export const MemoryConfigSchema = z.object({
  enabled: z.boolean().default(true),
  type: z.enum(['memory', 'file', 'redis']).default('memory'),
  config: z.record(z.unknown()).optional(),
});

export const UIConfigSchema = z.object({
  theme: z.enum(['light', 'dark']).default('dark'),
  showTimestamps: z.boolean().default(true),
  progressIndicators: z.boolean().default(true),
});

export const QiConfigSchema = z.object({
  model: ModelConfigSchema,
  mcp: z.object({
    servers: z.record(ServerConfigSchema),
  }),
  memory: MemoryConfigSchema,
  ui: UIConfigSchema,
});

export type QiConfig = z.infer<typeof QiConfigSchema>;
export type ServerConfig = z.infer<typeof ServerConfigSchema>;
export type ModelConfig = z.infer<typeof ModelConfigSchema>;
export type MemoryConfig = z.infer<typeof MemoryConfigSchema>;
export type UIConfig = z.infer<typeof UIConfigSchema>;