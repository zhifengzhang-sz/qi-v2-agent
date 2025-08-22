/**
 * File Discovery Service
 * 
 * Uses main assistant's native Claude Code tools (Read, LS, Glob) to discover
 * and read files for QiCore analysis. This solves the qicore-specialist file 
 * access limitation by having the main assistant handle all file operations.
 */

import { readFile, stat } from 'node:fs/promises';
import { dirname, extname, join, relative } from 'node:path';
import {
  create,
  failure,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '../utils/result';
import type {
  AnalysisConfig,
  AnalysisTarget,
  FileContent,
  IFileDiscoveryService,
  ModuleType,
} from '../types/index';

// Error factory for file discovery operations
const discoveryError = {
  fileNotFound: (path: string): QiError =>
    create('FILE_NOT_FOUND', `File not found: ${path}`, 'SYSTEM', { path }),
  
  directoryNotFound: (path: string): QiError =>
    create('DIRECTORY_NOT_FOUND', `Directory not found: ${path}`, 'SYSTEM', { path }),
  
  readPermissionDenied: (path: string): QiError =>
    create('READ_PERMISSION_DENIED', `Cannot read file: ${path}`, 'SYSTEM', { path }),
  
  invalidPattern: (pattern: string): QiError =>
    create('INVALID_PATTERN', `Invalid file pattern: ${pattern}`, 'VALIDATION', { pattern }),
  
  discoveryFailed: (targetPath: string, cause: string): QiError =>
    create('DISCOVERY_FAILED', `File discovery failed for ${targetPath}: ${cause}`, 'SYSTEM', { 
      targetPath, 
      cause 
    }),
};

export class FileDiscoveryService implements IFileDiscoveryService {
  private readonly workingDirectory: string;

  constructor(workingDirectory: string = process.cwd()) {
    this.workingDirectory = workingDirectory;
  }

  /**
   * Discover modules based on target path and configuration patterns
   * Uses glob patterns to find files matching EXTERNAL and INTERNAL module criteria
   */
  async discoverModules(targetPath: string, config: AnalysisConfig): Promise<AnalysisTarget[]> {
    return fromAsyncTryCatch(
      async () => {
        // Validate target path exists
        const pathExists = await this.validateFileExists(targetPath);
        if (!pathExists) {
          throw discoveryError.directoryNotFound(targetPath);
        }

        const targets: AnalysisTarget[] = [];
        
        // Discover EXTERNAL modules
        for (const pattern of config.targetPatterns.external) {
          const externalTargets = await this.discoverByPattern(
            targetPath, 
            pattern, 
            'EXTERNAL'
          );
          targets.push(...externalTargets);
        }

        // Discover INTERNAL modules  
        for (const pattern of config.targetPatterns.internal) {
          const internalTargets = await this.discoverByPattern(
            targetPath,
            pattern,
            'INTERNAL'
          );
          targets.push(...internalTargets);
        }

        // Remove duplicates and sort by module type then path
        const uniqueTargets = this.deduplicateTargets(targets);
        return this.sortTargets(uniqueTargets);
      },
      (error) => discoveryError.discoveryFailed(targetPath, String(error))
    ).then(result => match(
      (targets) => targets,
      (error) => { throw error; },
      result
    ));
  }

  /**
   * Read file contents using main assistant's Read tool capabilities
   */
  async readFileContents(filePath: string): Promise<FileContent> {
    return fromAsyncTryCatch(
      async () => {
        // Use Node.js fs directly since main assistant has file access
        const content = await readFile(filePath, 'utf-8');
        const stats = await stat(filePath);
        
        return {
          filePath,
          content,
          lineCount: content.split('\n').length,
          encoding: 'utf-8',
        } satisfies FileContent;
      },
      (error) => {
        if (error && typeof error === 'object' && 'code' in error) {
          const nodeError = error as NodeJS.ErrnoException;
          switch (nodeError.code) {
            case 'ENOENT':
              return discoveryError.fileNotFound(filePath);
            case 'EACCES':
            case 'EPERM':
              return discoveryError.readPermissionDenied(filePath);
            default:
              return create(
                'FILE_READ_ERROR',
                `Failed to read file ${filePath}: ${nodeError.message}`,
                'SYSTEM',
                { filePath, code: nodeError.code }
              );
          }
        }
        return create(
          'FILE_READ_ERROR',
          `Failed to read file ${filePath}: ${String(error)}`,
          'SYSTEM',
          { filePath }
        );
      }
    ).then(result => match(
      (content) => content,
      (error) => { throw error; },
      result
    ));
  }

  /**
   * Validate file exists using main assistant's file system access
   */
  async validateFileExists(filePath: string): Promise<boolean> {
    return fromAsyncTryCatch(
      async () => {
        await stat(filePath);
        return true;
      },
      () => false
    ).then(result => match(
      (exists) => exists,
      () => false,
      result
    ));
  }

  /**
   * Detect module type based on file path patterns
   * EXTERNAL: index.ts, abstractions/, public APIs
   * INTERNAL: impl/, persistence/, internal implementations
   */
  detectModuleType(filePath: string): ModuleType {
    const relativePath = relative(this.workingDirectory, filePath);
    
    // INTERNAL patterns
    if (relativePath.includes('/impl/') || 
        relativePath.includes('/persistence/') ||
        relativePath.endsWith('.internal.ts') ||
        relativePath.includes('/.internal/')) {
      return 'INTERNAL';
    }
    
    // EXTERNAL patterns (default for public APIs)
    if (relativePath.endsWith('/index.ts') ||
        relativePath.includes('/abstractions/') ||
        relativePath.includes('/interfaces/') ||
        relativePath.endsWith('.public.ts')) {
      return 'EXTERNAL';
    }
    
    // Default to EXTERNAL for public-facing files
    return 'EXTERNAL';
  }

  // Private helper methods

  private async discoverByPattern(
    basePath: string, 
    pattern: string, 
    moduleType: ModuleType
  ): Promise<AnalysisTarget[]> {
    return fromAsyncTryCatch(
      async () => {
        const { glob } = await import('glob');
        
        // Construct full pattern path
        const fullPattern = join(basePath, pattern);
        const files = await glob(fullPattern, { 
          ignore: ['**/node_modules/**', '**/dist/**', '**/.git/**'],
          absolute: true 
        });

        const targets: AnalysisTarget[] = [];
        
        for (const filePath of files) {
          // Validate it's a TypeScript file
          if (extname(filePath) !== '.ts') continue;
          
          try {
            const stats = await stat(filePath);
            const detectedType = this.detectModuleType(filePath);
            
            // Only include if detected type matches requested type
            if (detectedType === moduleType) {
              targets.push({
                filePath,
                moduleType,
                moduleName: this.extractModuleName(filePath),
                exists: true,
                size: stats.size,
                lastModified: stats.mtime,
              });
            }
          } catch {
            // File exists but not accessible - still include as target
            targets.push({
              filePath,
              moduleType,
              moduleName: this.extractModuleName(filePath),
              exists: false,
            });
          }
        }
        
        return targets;
      },
      (error) => {
        console.warn(`Pattern discovery failed for ${pattern}:`, error);
        return [] as AnalysisTarget[];
      }
    ).then(result => match(
      (targets) => targets,
      () => [] as AnalysisTarget[],
      result
    ));
  }

  private extractModuleName(filePath: string): string {
    const relativePath = relative(this.workingDirectory, filePath);
    const parts = relativePath.split('/');
    
    // Extract meaningful module name from path
    if (parts.includes('lib') && parts.includes('src')) {
      const srcIndex = parts.indexOf('src');
      if (srcIndex + 1 < parts.length) {
        return parts[srcIndex + 1]; // e.g., 'context', 'state', 'messaging'
      }
    }
    
    // Fallback to directory name or filename
    const fileName = parts[parts.length - 1];
    return fileName.replace(/\.ts$/, '');
  }

  private deduplicateTargets(targets: AnalysisTarget[]): AnalysisTarget[] {
    const seen = new Set<string>();
    return targets.filter(target => {
      if (seen.has(target.filePath)) {
        return false;
      }
      seen.add(target.filePath);
      return true;
    });
  }

  private sortTargets(targets: AnalysisTarget[]): AnalysisTarget[] {
    return targets.sort((a, b) => {
      // Sort by module type first (EXTERNAL before INTERNAL)
      if (a.moduleType !== b.moduleType) {
        return a.moduleType === 'EXTERNAL' ? -1 : 1;
      }
      
      // Then by module name
      if (a.moduleName !== b.moduleName) {
        return a.moduleName.localeCompare(b.moduleName);
      }
      
      // Finally by file path
      return a.filePath.localeCompare(b.filePath);
    });
  }
}