import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git', '**/*.d.ts'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: [
      { find: '@qi/agent/config', replacement: resolve(__dirname, '../lib/src/config') },
      { find: '@qi/agent/mcp', replacement: resolve(__dirname, '../lib/src/mcp') },
      { find: '@qi/agent/llm', replacement: resolve(__dirname, '../lib/src/llm') },
      { find: '@qi/agent/agent', replacement: resolve(__dirname, '../lib/src/agent') },
      { find: '@qi/agent/utils', replacement: resolve(__dirname, '../lib/src/utils') },
      { find: '@qi/agent', replacement: resolve(__dirname, '../lib/src/index.ts') },
      { find: '@', replacement: resolve(__dirname, './src') },
      { find: '@/cli', replacement: resolve(__dirname, './src/cli') },
      { find: '@/ui', replacement: resolve(__dirname, './src/ui') },
      { find: '@/workflows', replacement: resolve(__dirname, './src/workflows') },
    ],
  },
});