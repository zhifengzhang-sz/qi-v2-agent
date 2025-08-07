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
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.ts', // Re-export files
      ],
      thresholds: {
        global: {
          branches: 80,
          functions: 80,
          lines: 80,
          statements: 80,
        },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
  resolve: {
    alias: [
      { find: '@qi/agent/core/interfaces', replacement: resolve(__dirname, './src/core/interfaces.ts') },
      { find: '@qi/agent/impl/memory-provider', replacement: resolve(__dirname, './src/impl/memory-provider.ts') },
      { find: '@qi/agent/impl', replacement: resolve(__dirname, './src/impl') },
      { find: '@qi/agent/core', replacement: resolve(__dirname, './src/core') },
      { find: '@qi/agent', replacement: resolve(__dirname, './src/index.ts') },
      { find: '@qi/lib', replacement: resolve(__dirname, './src') },
      { find: '@', replacement: resolve(__dirname, './src') },
    ],
  },
});