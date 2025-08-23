import { defineConfig } from 'vitest/config';
import tsconfigPaths from 'vite-tsconfig-paths';
import { resolve } from 'path';

export default defineConfig({
  plugins: [tsconfigPaths()],
  resolve: {
    alias: {
      '@qi/base': resolve(__dirname, '../../qi-v2-qicore/typescript/dist/base'),
      '@qi/core': resolve(__dirname, '../../qi-v2-qicore/typescript/dist/core'),
      '@qi/agent': resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'node',
    include: ['tests/**/*.{test,spec}.{js,ts}'],
    exclude: ['node_modules', 'dist', '.git', '**/*.d.ts'],
    coverage: {
      provider: 'istanbul',
      reporter: ['text', 'json', 'html'],
      reportsDirectory: './coverage',
      include: ['src/**/*.{ts,tsx}'],
      exclude: [
        'node_modules/',
        'dist/',
        '**/*.d.ts',
        '**/*.config.{js,ts}',
        '**/index.ts', // Re-export files
        '**/__mocks__/**',
        'src/**/*.mock.{ts,js}',
      ],
      thresholds: {
        global: {
          branches: 60,
          functions: 70,
          lines: 70,
          statements: 70,
        },
        // Higher standards for infrastructure components
        'src/cli/**/*': { functions: 80, lines: 75 },
        'src/mcp/**/*': { functions: 80, lines: 75 },
        'src/utils/**/*': { functions: 85, lines: 80 },
        // Core components should have good coverage
        'src/agent/**/*': { functions: 75, lines: 70 },
        'src/state/**/*': { functions: 75, lines: 70 },
      },
    },
    testTimeout: 10000,
    hookTimeout: 10000,
  },
});