/**
 * File Operations Sub-Agent - Tool-Specialized Implementation
 *
 * Specializes in file operations by coordinating Read, Write, Edit, and Glob tools.
 * Follows the v-0.10.0 roadmap specification exactly without creating new interfaces.
 */

import type { QiError, Result } from '@qi/base';
import { failure, success } from '@qi/base';
import { BaseSubAgent } from '../core/BaseSubAgent.js';
import type {
  SubAgentArtifact,
  SubAgentCapability,
  SubAgentConfig,
  SubAgentProgress,
  SubAgentTask,
} from '../core/types.js';

/**
 * Creates QiCore-compatible error for file operations
 */
function createFileOpsError(
  code: string,
  message: string,
  context?: Record<string, unknown>
): QiError {
  return {
    code,
    message,
    category: 'SYSTEM',
    context: context || {},
  } as QiError;
}

export class FileOpsSubAgent extends BaseSubAgent {
  public readonly capabilities: SubAgentCapability[] = [
    {
      type: 'file_operations',
      name: 'file_reader',
      description: 'Read files and analyze content',
      confidence: 0.95,
      domains: ['filesystem', 'content_analysis'],
      toolRequirements: ['Read', 'Glob'],
      workflowPatterns: ['analytical', 'problem-solving'],
    },
    {
      type: 'file_operations',
      name: 'file_writer',
      description: 'Create and modify files',
      confidence: 0.9,
      domains: ['filesystem', 'content_creation'],
      toolRequirements: ['Write', 'Edit'],
      workflowPatterns: ['creative', 'problem-solving'],
    },
    {
      type: 'file_operations',
      name: 'file_searcher',
      description: 'Search for files and patterns',
      confidence: 0.85,
      domains: ['filesystem', 'search'],
      toolRequirements: ['Glob', 'Grep'],
      workflowPatterns: ['analytical', 'general'],
    },
  ];

  constructor() {
    super('file-ops-agent', 'File Operations Agent', '1.0.0');
  }

  protected async onInitialize(config: SubAgentConfig): Promise<Result<void, QiError>> {
    try {
      // Validate working directory if specified
      if (config.workingDirectory) {
        this.logger.info('File operations sub-agent initialized', {
          workingDirectory: config.workingDirectory,
        });
      }

      return success(undefined);
    } catch (error) {
      return failure(
        createFileOpsError(
          'FILE_OPS_INIT_FAILED',
          'Failed to initialize file operations sub-agent',
          {
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  protected async onCleanup(): Promise<Result<void, QiError>> {
    // No specific cleanup needed for file operations
    return success(undefined);
  }

  protected async canHandleCustom(task: SubAgentTask): Promise<Result<boolean, QiError>> {
    try {
      // Check if task involves file operations
      const description = task.description.toLowerCase();
      const fileOperationKeywords = [
        'read',
        'write',
        'edit',
        'create',
        'modify',
        'delete',
        'find',
        'search',
        'glob',
        'file',
        'directory',
      ];

      const hasFileOperation = fileOperationKeywords.some((keyword) =>
        description.includes(keyword)
      );

      return success(hasFileOperation);
    } catch (error) {
      return failure(
        createFileOpsError(
          'FILE_OPS_CAN_HANDLE_CHECK_FAILED',
          'Failed to check custom file handling capability',
          {
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error),
          }
        )
      );
    }
  }

  protected async *executeTask(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const taskType = task.type;
    const input = task.input as any;

    switch (taskType) {
      case 'read_file':
        yield* this.executeReadFile(task, input);
        break;
      case 'write_file':
        yield* this.executeWriteFile(task, input);
        break;
      case 'edit_file':
        yield* this.executeEditFile(task, input);
        break;
      case 'search_files':
        yield* this.executeSearchFiles(task, input);
        break;
      case 'file_analysis':
        yield* this.executeFileAnalysis(task, input);
        break;
      default:
        // Try to infer operation from description
        yield* this.executeInferredOperation(task);
    }
  }

  private async *executeReadFile(
    task: SubAgentTask,
    input: { filePath: string; limit?: number; offset?: number }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing to read file: ${input.filePath}`,
    };

    // Execute Read tool
    const readResult = await this.executeToolSafely('Read', {
      file_path: input.filePath,
      limit: input.limit,
      offset: input.offset,
    });

    if (readResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Failed to read file: ${readResult.error.message}`,
        intermediateResults: { error: readResult.error },
      };
      return;
    }

    yield {
      taskId: task.id,
      stage: 'reading',
      progress: 0.7,
      message: 'File read successfully',
    };

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `File ${input.filePath} read successfully`,
      intermediateResults: {
        toolUsed: 'Read',
        filePath: input.filePath,
        content: readResult.value,
      },
    };
  }

  private async *executeWriteFile(
    task: SubAgentTask,
    input: { filePath: string; content: string; overwrite?: boolean }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing to write file: ${input.filePath}`,
    };

    // Check if file exists first if not overwriting
    if (!input.overwrite) {
      const readResult = await this.executeToolSafely('Read', {
        file_path: input.filePath,
      });

      if (readResult.tag === 'success') {
        yield {
          taskId: task.id,
          stage: 'failed',
          progress: 0,
          message: `File already exists and overwrite is disabled: ${input.filePath}`,
        };
        return;
      }
    }

    yield {
      taskId: task.id,
      stage: 'writing',
      progress: 0.5,
      message: 'Writing file content',
    };

    // Execute Write tool
    const writeResult = await this.executeToolSafely('Write', {
      file_path: input.filePath,
      content: input.content,
    });

    if (writeResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Failed to write file: ${writeResult.error.message}`,
        intermediateResults: { error: writeResult.error },
      };
      return;
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `File ${input.filePath} written successfully`,
      intermediateResults: {
        toolUsed: 'Write',
        filePath: input.filePath,
        bytesWritten: input.content.length,
      },
    };
  }

  private async *executeEditFile(
    task: SubAgentTask,
    input: { filePath: string; oldString: string; newString: string; replaceAll?: boolean }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing to edit file: ${input.filePath}`,
    };

    // First read the file to verify it exists
    const readResult = await this.executeToolSafely('Read', {
      file_path: input.filePath,
    });

    if (readResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Cannot edit file - file not found: ${input.filePath}`,
      };
      return;
    }

    yield {
      taskId: task.id,
      stage: 'editing',
      progress: 0.5,
      message: 'Applying file edits',
    };

    // Execute Edit tool
    const editResult = await this.executeToolSafely('Edit', {
      file_path: input.filePath,
      old_string: input.oldString,
      new_string: input.newString,
      replace_all: input.replaceAll || false,
    });

    if (editResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Failed to edit file: ${editResult.error.message}`,
        intermediateResults: { error: editResult.error },
      };
      return;
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `File ${input.filePath} edited successfully`,
      intermediateResults: {
        toolUsed: 'Edit',
        filePath: input.filePath,
        replacements: input.replaceAll ? 'all' : 'first',
      },
    };
  }

  private async *executeSearchFiles(
    task: SubAgentTask,
    input: { pattern: string; path?: string; fileType?: string }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'searching',
      progress: 0.3,
      message: `Searching for files matching pattern: ${input.pattern}`,
    };

    // Execute Glob tool
    const globResult = await this.executeToolSafely('Glob', {
      pattern: input.pattern,
      path: input.path,
    });

    if (globResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `File search failed: ${globResult.error.message}`,
        intermediateResults: { error: globResult.error },
      };
      return;
    }

    const files = globResult.value as string[];

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Found ${files.length} files matching pattern`,
      intermediateResults: {
        toolUsed: 'Glob',
        pattern: input.pattern,
        filesFound: files,
        count: files.length,
      },
    };
  }

  private async *executeFileAnalysis(
    task: SubAgentTask,
    input: { filePaths: string[] }
  ): AsyncGenerator<SubAgentProgress> {
    const totalFiles = input.filePaths.length;
    const analysis: any[] = [];

    for (let i = 0; i < totalFiles; i++) {
      const filePath = input.filePaths[i];
      const progress = (i + 1) / totalFiles;

      yield {
        taskId: task.id,
        stage: 'analyzing',
        progress: progress * 0.9, // Reserve 0.1 for completion
        message: `Analyzing file ${i + 1} of ${totalFiles}: ${filePath}`,
      };

      // Read each file
      const readResult = await this.executeToolSafely('Read', {
        file_path: filePath,
      });

      if (readResult.tag === 'success') {
        const content = readResult.value as string;
        analysis.push({
          filePath,
          size: content.length,
          lines: content.split('\n').length,
          extension: filePath.split('.').pop(),
          readable: true,
        });
      } else {
        analysis.push({
          filePath,
          error: readResult.error.message,
          readable: false,
        });
      }
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Analysis completed for ${totalFiles} files`,
      intermediateResults: {
        toolUsed: 'Read',
        totalFiles,
        analysis,
        successfulReads: analysis.filter((a) => a.readable).length,
      },
    };
  }

  private async *executeInferredOperation(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const description = task.description.toLowerCase();

    yield {
      taskId: task.id,
      stage: 'inferring',
      progress: 0.1,
      message: 'Inferring file operation from task description',
    };

    // Simple inference logic based on description keywords
    if (description.includes('read') && description.includes('file')) {
      yield* this.executeReadFile(task, task.input as any);
    } else if (description.includes('write') || description.includes('create')) {
      yield* this.executeWriteFile(task, task.input as any);
    } else if (description.includes('edit') || description.includes('modify')) {
      yield* this.executeEditFile(task, task.input as any);
    } else if (description.includes('find') || description.includes('search')) {
      yield* this.executeSearchFiles(task, task.input as any);
    } else {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Could not infer file operation from description: ${task.description}`,
      };
    }
  }

  protected async collectArtifacts(task: SubAgentTask): Promise<SubAgentArtifact[]> {
    const artifacts: SubAgentArtifact[] = [];

    // If task involved file creation or modification, include the file as an artifact
    if (task.type === 'write_file' || task.type === 'edit_file') {
      const input = task.input as any;
      if (input.filePath) {
        artifacts.push({
          type: 'file',
          name: input.filePath.split('/').pop() || 'file',
          path: input.filePath,
          metadata: {
            operation: task.type,
            timestamp: new Date().toISOString(),
          },
        });
      }
    }

    return artifacts;
  }

  protected generateRecommendations(task: SubAgentTask, _output: unknown): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on task type and results
    if (task.type === 'file_analysis') {
      recommendations.push('Consider implementing file caching for frequently analyzed files');
      recommendations.push('Monitor file size growth for performance optimization');
    } else if (task.type === 'write_file') {
      recommendations.push('Consider implementing backup strategy for modified files');
      recommendations.push('Add file validation checks before writing');
    }

    return recommendations;
  }
}
