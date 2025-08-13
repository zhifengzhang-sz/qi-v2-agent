/**
 * Simple Project Structure Scanner
 *
 * Placeholder implementation for scanning project structure
 */

import * as fs from 'node:fs/promises';
import * as path from 'node:path';

export interface ProjectStructure {
  files: string[];
  directories: string[];
  totalFiles: number;
  totalDirectories: number;
}

export class ProjectStructureScanner {
  readonly name = 'project-structure-scanner';
  readonly description = 'Scans and analyzes project structure';
  readonly version = '1.0.0';

  async execute(projectPath: string): Promise<ProjectStructure> {
    return this.scanProject(projectPath);
  }

  async scanProject(projectPath: string, maxDepth: number = 3): Promise<ProjectStructure> {
    const files: string[] = [];
    const directories: string[] = [];

    try {
      await this.scanDirectory(projectPath, projectPath, files, directories, 0, maxDepth);
    } catch (error) {
      // Return empty structure on error
    }

    return {
      files,
      directories,
      totalFiles: files.length,
      totalDirectories: directories.length,
    };
  }

  private async scanDirectory(
    currentPath: string,
    basePath: string,
    files: string[],
    directories: string[],
    depth: number,
    maxDepth: number
  ): Promise<void> {
    if (depth >= maxDepth) return;

    try {
      const entries = await fs.readdir(currentPath, { withFileTypes: true });

      for (const entry of entries) {
        // Skip hidden files and node_modules
        if (entry.name.startsWith('.') || entry.name === 'node_modules') {
          continue;
        }

        const fullPath = path.join(currentPath, entry.name);
        const relativePath = path.relative(basePath, fullPath);

        if (entry.isDirectory()) {
          directories.push(relativePath);
          await this.scanDirectory(fullPath, basePath, files, directories, depth + 1, maxDepth);
        } else if (entry.isFile()) {
          files.push(relativePath);
        }
      }
    } catch (error) {
      // Skip directories that can't be read
    }
  }

  validate?(input: string): boolean {
    return typeof input === 'string' && input.length > 0;
  }

  async cleanup?(): Promise<void> {
    // No cleanup needed
  }
}
