/**
 * Project Structure Scanner Tool
 *
 * Discovers and analyzes project structure for context awareness.
 * Used for project discovery and memory file detection.
 */

import { existsSync, readdirSync, statSync } from 'node:fs';
import { basename, join, relative } from 'node:path';

/**
 * Project context information
 */
export interface ProjectContext {
  readonly root: string;
  readonly structure: readonly string[];
  readonly memoryFiles: readonly string[];
  readonly configFiles: readonly string[];
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Project structure scanner configuration
 */
export interface ProjectScannerConfig {
  readonly maxDepth: number;
  readonly includeHidden: boolean;
  readonly memoryFileNames: readonly string[];
  readonly configFilePatterns: readonly string[];
  readonly excludePatterns: readonly string[];
  readonly maxFiles: number;
}

/**
 * Default configuration for project scanner
 */
const DEFAULT_CONFIG: ProjectScannerConfig = {
  maxDepth: 5,
  includeHidden: false,
  memoryFileNames: ['CLAUDE.md', 'README.md', '.claude.md', 'docs/memory.md'],
  configFilePatterns: [
    'package.json',
    'tsconfig.json',
    'vite.config.*',
    'vitest.config.*',
    'biome.json',
    '.env*',
    'docker-compose.*',
    'Dockerfile',
    'pyproject.toml',
    'Cargo.toml',
    'go.mod',
  ],
  excludePatterns: [
    'node_modules',
    '.git',
    'dist',
    'build',
    '.next',
    '.nuxt',
    'coverage',
    '.cache',
    '__pycache__',
    'target',
    'vendor',
  ],
  maxFiles: 1000,
};

import type { Tool } from '../index.js';

/**
 * Project Structure Scanner Tool
 *
 * Provides project discovery and structure analysis.
 */
export class ProjectStructureScanner implements Tool<string, ProjectContext | null> {
  readonly name = 'ProjectStructureScanner';
  readonly description = 'Discovers and analyzes project structure for context awareness';
  readonly version = '1.0.0';
  private config: ProjectScannerConfig;

  constructor(config: Partial<ProjectScannerConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Tool interface implementation
   */
  async execute(input: string): Promise<ProjectContext | null> {
    const projectRoot = await this.findProjectRoot(input);
    return projectRoot ? this.discoverProjectContext(projectRoot) : null;
  }

  /**
   * Find the project root starting from a given directory
   */
  async findProjectRoot(startPath: string): Promise<string | null> {
    let currentPath = startPath;
    let depth = 0;

    while (depth < this.config.maxDepth) {
      // Check for common project indicators
      if (this.hasProjectIndicators(currentPath)) {
        return currentPath;
      }

      // Move up one level
      const parentPath = join(currentPath, '..');
      if (parentPath === currentPath) {
        // Reached filesystem root
        break;
      }

      currentPath = parentPath;
      depth++;
    }

    return null;
  }

  /**
   * Discover project context from a root directory
   */
  async discoverProjectContext(rootPath: string): Promise<ProjectContext | null> {
    if (!existsSync(rootPath)) {
      return null;
    }

    try {
      const structure = await this.scanStructure(rootPath);
      const memoryFiles = this.findMemoryFiles(structure, rootPath);
      const configFiles = this.findConfigFiles(structure, rootPath);

      const metadata = new Map<string, unknown>();
      metadata.set('scannedAt', new Date().toISOString());
      metadata.set('totalFiles', structure.length);
      metadata.set('projectType', this.detectProjectType(configFiles));

      return {
        root: rootPath,
        structure,
        memoryFiles,
        configFiles,
        metadata,
      };
    } catch (error) {
      console.warn('Failed to discover project context:', error);
      return null;
    }
  }

  /**
   * Scan directory structure recursively
   */
  private async scanStructure(rootPath: string, currentDepth = 0): Promise<string[]> {
    const results: string[] = [];

    if (currentDepth >= this.config.maxDepth || results.length >= this.config.maxFiles) {
      return results;
    }

    try {
      const entries = readdirSync(rootPath);

      for (const entry of entries) {
        // Skip hidden files unless configured to include them
        if (!this.config.includeHidden && entry.startsWith('.')) {
          continue;
        }

        const fullPath = join(rootPath, entry);
        const relativePath = relative(rootPath, fullPath);

        // Skip excluded patterns
        if (this.shouldExclude(relativePath)) {
          continue;
        }

        try {
          const stats = statSync(fullPath);

          if (stats.isFile()) {
            results.push(relativePath);
          } else if (stats.isDirectory()) {
            // Add directory itself
            results.push(`${relativePath}/`);

            // Recursively scan subdirectory
            const subResults = await this.scanStructure(fullPath, currentDepth + 1);
            for (const subPath of subResults) {
              results.push(join(relativePath, subPath));

              if (results.length >= this.config.maxFiles) {
                break;
              }
            }
          }

          if (results.length >= this.config.maxFiles) {
            break;
          }
        } catch (_statError) {}
      }
    } catch (readError) {
      // Skip directories that can't be read
      console.warn(`Failed to read directory ${rootPath}:`, readError);
    }

    return results;
  }

  /**
   * Check if a directory has project indicators
   */
  private hasProjectIndicators(dirPath: string): boolean {
    const indicators = [
      'package.json',
      'pyproject.toml',
      'Cargo.toml',
      'go.mod',
      'composer.json',
      'pom.xml',
      'build.gradle',
      'CMakeLists.txt',
      'Makefile',
      '.git',
    ];

    return indicators.some((indicator) => existsSync(join(dirPath, indicator)));
  }

  /**
   * Find memory files in the project structure
   */
  private findMemoryFiles(structure: string[], _rootPath: string): string[] {
    const memoryFiles: string[] = [];

    for (const filePath of structure) {
      const fileName = basename(filePath);

      // Check exact matches
      if (this.config.memoryFileNames.includes(fileName)) {
        memoryFiles.push(filePath);
        continue;
      }

      // Check pattern matches
      for (const pattern of this.config.memoryFileNames) {
        if (this.matchesPattern(fileName, pattern)) {
          memoryFiles.push(filePath);
          break;
        }
      }
    }

    return memoryFiles;
  }

  /**
   * Find configuration files in the project structure
   */
  private findConfigFiles(structure: string[], _rootPath: string): string[] {
    const configFiles: string[] = [];

    for (const filePath of structure) {
      const fileName = basename(filePath);

      for (const pattern of this.config.configFilePatterns) {
        if (this.matchesPattern(fileName, pattern)) {
          configFiles.push(filePath);
          break;
        }
      }
    }

    return configFiles;
  }

  /**
   * Detect project type based on configuration files
   */
  private detectProjectType(configFiles: string[]): string {
    const typeIndicators = [
      { pattern: 'package.json', type: 'javascript/typescript' },
      { pattern: 'pyproject.toml', type: 'python' },
      { pattern: 'Cargo.toml', type: 'rust' },
      { pattern: 'go.mod', type: 'go' },
      { pattern: 'composer.json', type: 'php' },
      { pattern: 'pom.xml', type: 'java/maven' },
      { pattern: 'build.gradle', type: 'java/gradle' },
    ];

    for (const configFile of configFiles) {
      const fileName = basename(configFile);
      for (const indicator of typeIndicators) {
        if (this.matchesPattern(fileName, indicator.pattern)) {
          return indicator.type;
        }
      }
    }

    return 'unknown';
  }

  /**
   * Check if a file path should be excluded based on patterns
   */
  private shouldExclude(relativePath: string): boolean {
    const normalizedPath = relativePath.replace(/\\/g, '/');

    return this.config.excludePatterns.some((pattern) => {
      if (pattern.includes('*')) {
        const regexPattern = pattern.replace(/\*/g, '.*');
        return new RegExp(regexPattern).test(normalizedPath);
      }

      return normalizedPath.includes(pattern) || normalizedPath.startsWith(pattern);
    });
  }

  /**
   * Simple pattern matching with wildcards
   */
  private matchesPattern(fileName: string, pattern: string): boolean {
    if (!pattern.includes('*')) {
      return fileName === pattern;
    }

    const regexPattern = pattern.replace(/\./g, '\\.').replace(/\*/g, '.*');

    return new RegExp(`^${regexPattern}$`).test(fileName);
  }
}
