/**
 * Git Sub-Agent - Tool-Specialized Implementation
 *
 * Specializes in Git operations by coordinating with the Bash tool for git commands.
 * Follows the v-0.10.0 roadmap specification exactly without creating new interfaces.
 */

import type { Result } from '@qi/base';
import { failure, success } from '@qi/base';
import type { QiError } from '@qi/core';
import { BaseSubAgent } from '../core/BaseSubAgent.js';
import type {
  SubAgentArtifact,
  SubAgentCapability,
  SubAgentConfig,
  SubAgentProgress,
  SubAgentTask,
} from '../core/types.js';

/**
 * Creates QiCore-compatible error for git operations
 */
function createGitError(code: string, message: string, context?: Record<string, unknown>): QiError {
  return {
    code,
    message,
    category: 'SYSTEM',
    context: context || {},
  } as QiError;
}

export class GitSubAgent extends BaseSubAgent {
  public readonly capabilities: SubAgentCapability[] = [
    {
      type: 'custom',
      name: 'git_status_checker',
      description: 'Check git repository status and changes',
      confidence: 0.95,
      domains: ['git', 'version_control', 'status'],
      toolRequirements: ['Bash'],
      workflowPatterns: ['analytical', 'general'],
    },
    {
      type: 'custom',
      name: 'git_committer',
      description: 'Create git commits with proper messages and staging',
      confidence: 0.9,
      domains: ['git', 'version_control', 'commits'],
      toolRequirements: ['Bash'],
      workflowPatterns: ['creative', 'problem-solving'],
    },
    {
      type: 'custom',
      name: 'git_branch_manager',
      description: 'Manage git branches, merging, and repository structure',
      confidence: 0.85,
      domains: ['git', 'version_control', 'branching'],
      toolRequirements: ['Bash'],
      workflowPatterns: ['analytical', 'problem-solving'],
    },
    {
      type: 'custom',
      name: 'git_history_analyzer',
      description: 'Analyze git history, logs, and repository information',
      confidence: 0.8,
      domains: ['git', 'version_control', 'analysis'],
      toolRequirements: ['Bash'],
      workflowPatterns: ['analytical', 'research'],
    },
  ];

  constructor() {
    super('git-agent', 'Git Operations Agent', '1.0.0');
  }

  protected async onInitialize(config: SubAgentConfig): Promise<Result<void, QiError>> {
    try {
      // Verify git is available
      const gitVersionResult = await this.executeToolSafely('Bash', {
        command: 'git --version',
        description: 'Check git availability',
      });

      if (gitVersionResult.tag === 'failure') {
        return failure(
          createGitError('GIT_NOT_AVAILABLE', 'Git command not available on system', {
            error: gitVersionResult.error.message,
          })
        );
      }

      this.logger.info('Git operations sub-agent initialized', {
        gitVersion: (gitVersionResult.value as string).trim(),
        workingDirectory: config.workingDirectory,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        createGitError('GIT_INIT_FAILED', 'Failed to initialize git sub-agent', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  protected async onCleanup(): Promise<Result<void, QiError>> {
    // No specific cleanup needed for git operations
    return success(undefined);
  }

  protected async canHandleCustom(task: SubAgentTask): Promise<Result<boolean, QiError>> {
    try {
      // Check if task involves git operations
      const description = task.description.toLowerCase();
      const gitKeywords = [
        'git',
        'commit',
        'branch',
        'merge',
        'push',
        'pull',
        'clone',
        'status',
        'log',
        'diff',
        'checkout',
        'repository',
        'version control',
      ];

      const hasGitOperation = gitKeywords.some((keyword) => description.includes(keyword));

      return success(hasGitOperation);
    } catch (error) {
      return failure(
        createGitError('GIT_CAN_HANDLE_CHECK_FAILED', 'Failed to check custom git capability', {
          taskId: task.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  protected async *executeTask(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const taskType = task.type;
    const input = task.input as any;

    switch (taskType) {
      case 'git_status':
        yield* this.executeGitStatus(task, input);
        break;
      case 'git_commit':
        yield* this.executeGitCommit(task, input);
        break;
      case 'git_branch':
        yield* this.executeGitBranch(task, input);
        break;
      case 'git_log':
        yield* this.executeGitLog(task, input);
        break;
      case 'git_diff':
        yield* this.executeGitDiff(task, input);
        break;
      case 'git_workflow':
        yield* this.executeGitWorkflow(task, input);
        break;
      default:
        // Try to infer git operation from description
        yield* this.executeInferredGitOperation(task);
    }
  }

  private async *executeGitStatus(
    task: SubAgentTask,
    input: { showUntracked?: boolean; porcelain?: boolean; path?: string }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: 'Preparing to check git status',
    };

    // Build git status command
    let command = 'git status';

    if (input.porcelain) {
      command += ' --porcelain';
    }

    if (input.showUntracked === false) {
      command += ' --untracked-files=no';
    }

    if (input.path) {
      command += ` -- "${input.path}"`;
    }

    yield {
      taskId: task.id,
      stage: 'checking_status',
      progress: 0.5,
      message: 'Checking git repository status',
    };

    const statusResult = await this.executeToolSafely('Bash', {
      command,
      description: 'Get git repository status',
    });

    if (statusResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Git status failed: ${statusResult.error.message}`,
        intermediateResults: { error: statusResult.error },
      };
      return;
    }

    const statusOutput = statusResult.value as string;
    const parsedStatus = this.parseGitStatus(statusOutput, input.porcelain);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: 'Git status check completed',
      intermediateResults: {
        toolUsed: 'Bash',
        command,
        rawOutput: statusOutput,
        parsedStatus,
        hasChanges: parsedStatus.modified.length > 0 || parsedStatus.staged.length > 0,
      },
    };
  }

  private async *executeGitCommit(
    task: SubAgentTask,
    input: {
      message: string;
      files?: string[];
      addAll?: boolean;
      amend?: boolean;
      author?: string;
    }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: 'Preparing git commit operation',
    };

    // Stage files if specified
    if (input.files && input.files.length > 0) {
      yield {
        taskId: task.id,
        stage: 'staging',
        progress: 0.3,
        message: `Staging ${input.files.length} files`,
      };

      const addCommand = `git add ${input.files.map((f) => `"${f}"`).join(' ')}`;
      const addResult = await this.executeToolSafely('Bash', {
        command: addCommand,
        description: 'Stage specified files',
      });

      if (addResult.tag === 'failure') {
        yield {
          taskId: task.id,
          stage: 'failed',
          progress: 0,
          message: `Failed to stage files: ${addResult.error.message}`,
        };
        return;
      }
    } else if (input.addAll) {
      yield {
        taskId: task.id,
        stage: 'staging',
        progress: 0.3,
        message: 'Staging all changes',
      };

      const addAllResult = await this.executeToolSafely('Bash', {
        command: 'git add -A',
        description: 'Stage all changes',
      });

      if (addAllResult.tag === 'failure') {
        yield {
          taskId: task.id,
          stage: 'failed',
          progress: 0,
          message: `Failed to stage all changes: ${addAllResult.error.message}`,
        };
        return;
      }
    }

    yield {
      taskId: task.id,
      stage: 'committing',
      progress: 0.7,
      message: 'Creating git commit',
    };

    // Build commit command
    let commitCommand = `git commit -m "${input.message.replace(/"/g, '\\"')}"`;

    if (input.amend) {
      commitCommand += ' --amend';
    }

    if (input.author) {
      commitCommand += ` --author "${input.author}"`;
    }

    const commitResult = await this.executeToolSafely('Bash', {
      command: commitCommand,
      description: 'Create git commit',
    });

    if (commitResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Git commit failed: ${commitResult.error.message}`,
        intermediateResults: { error: commitResult.error },
      };
      return;
    }

    const commitOutput = commitResult.value as string;
    const commitInfo = this.parseCommitOutput(commitOutput);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Git commit created successfully: ${commitInfo.hash || 'unknown'}`,
      intermediateResults: {
        toolUsed: 'Bash',
        message: input.message,
        commitInfo,
        filesStaged: input.files?.length || 0,
        rawOutput: commitOutput,
      },
    };
  }

  private async *executeGitBranch(
    task: SubAgentTask,
    input: {
      action: 'list' | 'create' | 'delete' | 'switch' | 'merge';
      branchName?: string;
      remote?: boolean;
      force?: boolean;
    }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: `Preparing git branch ${input.action} operation`,
    };

    let command = 'git branch';
    let progressMessage = '';

    switch (input.action) {
      case 'list':
        if (input.remote) {
          command += ' -r';
        }
        command += ' -v';
        progressMessage = 'Listing git branches';
        break;

      case 'create':
        if (!input.branchName) {
          yield {
            taskId: task.id,
            stage: 'failed',
            progress: 0,
            message: 'Branch name is required for create operation',
          };
          return;
        }
        command = `git checkout -b "${input.branchName}"`;
        progressMessage = `Creating and switching to branch: ${input.branchName}`;
        break;

      case 'switch':
        if (!input.branchName) {
          yield {
            taskId: task.id,
            stage: 'failed',
            progress: 0,
            message: 'Branch name is required for switch operation',
          };
          return;
        }
        command = `git checkout "${input.branchName}"`;
        progressMessage = `Switching to branch: ${input.branchName}`;
        break;

      case 'delete':
        if (!input.branchName) {
          yield {
            taskId: task.id,
            stage: 'failed',
            progress: 0,
            message: 'Branch name is required for delete operation',
          };
          return;
        }
        command = `git branch ${input.force ? '-D' : '-d'} "${input.branchName}"`;
        progressMessage = `Deleting branch: ${input.branchName}`;
        break;

      default:
        yield {
          taskId: task.id,
          stage: 'failed',
          progress: 0,
          message: `Unknown branch action: ${input.action}`,
        };
        return;
    }

    yield {
      taskId: task.id,
      stage: 'executing',
      progress: 0.5,
      message: progressMessage,
    };

    const branchResult = await this.executeToolSafely('Bash', {
      command,
      description: `Git branch ${input.action} operation`,
    });

    if (branchResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Git branch operation failed: ${branchResult.error.message}`,
        intermediateResults: { error: branchResult.error },
      };
      return;
    }

    const branchOutput = branchResult.value as string;
    const parsedOutput =
      input.action === 'list' ? this.parseBranchList(branchOutput) : { output: branchOutput };

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Git branch ${input.action} completed successfully`,
      intermediateResults: {
        toolUsed: 'Bash',
        action: input.action,
        branchName: input.branchName,
        command,
        result: parsedOutput,
        rawOutput: branchOutput,
      },
    };
  }

  private async *executeGitLog(
    task: SubAgentTask,
    input: {
      maxCount?: number;
      format?: 'oneline' | 'short' | 'full' | 'fuller';
      since?: string;
      until?: string;
      author?: string;
      path?: string;
    }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: 'Preparing to retrieve git log',
    };

    // Build git log command
    let command = 'git log';

    if (input.maxCount) {
      command += ` -n ${input.maxCount}`;
    }

    if (input.format) {
      command += ` --format=${input.format}`;
    }

    if (input.since) {
      command += ` --since="${input.since}"`;
    }

    if (input.until) {
      command += ` --until="${input.until}"`;
    }

    if (input.author) {
      command += ` --author="${input.author}"`;
    }

    if (input.path) {
      command += ` -- "${input.path}"`;
    }

    yield {
      taskId: task.id,
      stage: 'retrieving',
      progress: 0.5,
      message: 'Retrieving git commit history',
    };

    const logResult = await this.executeToolSafely('Bash', {
      command,
      description: 'Get git commit log',
    });

    if (logResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Git log failed: ${logResult.error.message}`,
        intermediateResults: { error: logResult.error },
      };
      return;
    }

    const logOutput = logResult.value as string;
    const commits = this.parseGitLog(logOutput, input.format);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Git log retrieved: ${commits.length} commits`,
      intermediateResults: {
        toolUsed: 'Bash',
        command,
        commits,
        totalCommits: commits.length,
        rawOutput: logOutput.substring(0, 500) + (logOutput.length > 500 ? '...' : ''),
      },
    };
  }

  private async *executeGitDiff(
    task: SubAgentTask,
    input: {
      staged?: boolean;
      commitHash?: string;
      file?: string;
      stats?: boolean;
    }
  ): AsyncGenerator<SubAgentProgress> {
    yield {
      taskId: task.id,
      stage: 'preparing',
      progress: 0.1,
      message: 'Preparing to get git diff',
    };

    let command = 'git diff';

    if (input.staged) {
      command += ' --staged';
    }

    if (input.stats) {
      command += ' --stat';
    }

    if (input.commitHash) {
      command += ` ${input.commitHash}`;
    }

    if (input.file) {
      command += ` -- "${input.file}"`;
    }

    yield {
      taskId: task.id,
      stage: 'diffing',
      progress: 0.5,
      message: 'Getting git diff',
    };

    const diffResult = await this.executeToolSafely('Bash', {
      command,
      description: 'Get git diff',
    });

    if (diffResult.tag === 'failure') {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Git diff failed: ${diffResult.error.message}`,
        intermediateResults: { error: diffResult.error },
      };
      return;
    }

    const diffOutput = diffResult.value as string;
    const diffStats = this.parseDiffStats(diffOutput);

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: 'Git diff completed',
      intermediateResults: {
        toolUsed: 'Bash',
        command,
        diffOutput,
        stats: diffStats,
        hasDiff: diffOutput.trim().length > 0,
      },
    };
  }

  private async *executeGitWorkflow(
    task: SubAgentTask,
    input: {
      workflow: 'feature' | 'hotfix' | 'release';
      branchName: string;
      baseBranch?: string;
      commitMessage?: string;
    }
  ): AsyncGenerator<SubAgentProgress> {
    const steps = this.getWorkflowSteps(input.workflow);

    for (let i = 0; i < steps.length; i++) {
      const step = steps[i];
      const progress = (i + 1) / steps.length;

      yield {
        taskId: task.id,
        stage: 'workflow',
        progress: progress * 0.9,
        message: `Executing workflow step ${i + 1}/${steps.length}: ${step.description}`,
      };

      const stepResult = await this.executeToolSafely('Bash', {
        command: step.command,
        description: step.description,
      });

      if (stepResult.tag === 'failure') {
        yield {
          taskId: task.id,
          stage: 'failed',
          progress: 0,
          message: `Workflow step failed: ${stepResult.error.message}`,
          intermediateResults: {
            failedStep: step,
            stepIndex: i,
            error: stepResult.error,
          },
        };
        return;
      }
    }

    yield {
      taskId: task.id,
      stage: 'completed',
      progress: 1.0,
      message: `Git ${input.workflow} workflow completed successfully`,
      intermediateResults: {
        toolUsed: 'Bash',
        workflow: input.workflow,
        branchName: input.branchName,
        stepsExecuted: steps.length,
      },
    };
  }

  private async *executeInferredGitOperation(task: SubAgentTask): AsyncGenerator<SubAgentProgress> {
    const description = task.description.toLowerCase();

    yield {
      taskId: task.id,
      stage: 'inferring',
      progress: 0.1,
      message: 'Inferring git operation from task description',
    };

    // Simple inference logic based on description keywords
    if (description.includes('status') || description.includes('check')) {
      yield* this.executeGitStatus(task, task.input as any);
    } else if (description.includes('commit')) {
      yield* this.executeGitCommit(task, task.input as any);
    } else if (description.includes('branch')) {
      yield* this.executeGitBranch(task, { action: 'list', ...(task.input as any) });
    } else if (description.includes('log') || description.includes('history')) {
      yield* this.executeGitLog(task, task.input as any);
    } else if (description.includes('diff')) {
      yield* this.executeGitDiff(task, task.input as any);
    } else {
      yield {
        taskId: task.id,
        stage: 'failed',
        progress: 0,
        message: `Could not infer git operation from description: ${task.description}`,
      };
    }
  }

  // Helper methods

  private parseGitStatus(output: string, porcelain?: boolean): any {
    if (porcelain) {
      // Parse porcelain format
      const lines = output.split('\n').filter((line) => line.trim());
      return {
        staged: lines.filter((line) => line.charAt(0) !== ' ' && line.charAt(0) !== '?'),
        modified: lines.filter((line) => line.charAt(1) !== ' ' && line.charAt(1) !== '?'),
        untracked: lines.filter((line) => line.startsWith('??')),
      };
    }

    // Parse regular format
    return {
      raw: output,
      hasChanges:
        output.includes('Changes to be committed') ||
        output.includes('Changes not staged') ||
        output.includes('Untracked files'),
      staged: [],
      modified: [],
      untracked: [],
    };
  }

  private parseCommitOutput(output: string): any {
    const hashMatch = output.match(/\[[\w-]+ ([a-f0-9]+)\]/);
    return {
      hash: hashMatch ? hashMatch[1] : null,
      output: output.trim(),
    };
  }

  private parseBranchList(output: string): any {
    const lines = output.split('\n').filter((line) => line.trim());
    const branches = lines.map((line) => ({
      name: line.replace(/^\*?\s+/, '').split(/\s+/)[0],
      current: line.startsWith('*'),
      hash: line.match(/[a-f0-9]{7,}/)?.[0] || null,
    }));

    return {
      branches,
      currentBranch: branches.find((b) => b.current)?.name || null,
      totalBranches: branches.length,
    };
  }

  private parseGitLog(output: string, format?: string): any[] {
    if (!output.trim()) return [];

    if (format === 'oneline') {
      return output
        .split('\n')
        .filter((line) => line.trim())
        .map((line) => {
          const parts = line.split(' ');
          return {
            hash: parts[0],
            message: parts.slice(1).join(' '),
          };
        });
    }

    // Simple parsing for other formats
    const commits = output.split('commit ').filter((section) => section.trim());
    return commits.map((section) => {
      const lines = section.split('\n');
      return {
        hash: lines[0]?.trim() || null,
        message:
          lines
            .find((line) => line.trim() && !line.includes('Author:') && !line.includes('Date:'))
            ?.trim() || '',
        raw: section.trim(),
      };
    });
  }

  private parseDiffStats(output: string): any {
    const lines = output.split('\n');
    const statsLine = lines.find((line) => line.includes('file') && line.includes('changed'));

    if (!statsLine) {
      return { hasStats: false };
    }

    const fileMatch = statsLine.match(/(\d+) files? changed/);
    const insertionMatch = statsLine.match(/(\d+) insertions?\(\+\)/);
    const deletionMatch = statsLine.match(/(\d+) deletions?\(-\)/);

    return {
      hasStats: true,
      filesChanged: fileMatch ? parseInt(fileMatch[1]) : 0,
      insertions: insertionMatch ? parseInt(insertionMatch[1]) : 0,
      deletions: deletionMatch ? parseInt(deletionMatch[1]) : 0,
    };
  }

  private getWorkflowSteps(workflow: string): Array<{ command: string; description: string }> {
    switch (workflow) {
      case 'feature':
        return [
          { command: 'git checkout main', description: 'Switch to main branch' },
          { command: 'git pull origin main', description: 'Pull latest changes' },
          { command: 'git checkout -b feature-branch', description: 'Create feature branch' },
        ];
      case 'hotfix':
        return [
          { command: 'git checkout main', description: 'Switch to main branch' },
          { command: 'git pull origin main', description: 'Pull latest changes' },
          { command: 'git checkout -b hotfix-branch', description: 'Create hotfix branch' },
        ];
      case 'release':
        return [
          { command: 'git checkout develop', description: 'Switch to develop branch' },
          { command: 'git pull origin develop', description: 'Pull latest changes' },
          { command: 'git checkout -b release-branch', description: 'Create release branch' },
        ];
      default:
        return [];
    }
  }

  protected async collectArtifacts(task: SubAgentTask): Promise<SubAgentArtifact[]> {
    const artifacts: SubAgentArtifact[] = [];

    // Generate git operation report as artifact
    artifacts.push({
      type: 'report',
      name: 'git_operation_report.md',
      content: this.generateGitReport(task),
      metadata: {
        taskId: task.id,
        operationType: task.type,
        timestamp: new Date().toISOString(),
      },
    });

    return artifacts;
  }

  protected generateRecommendations(task: SubAgentTask, output: unknown): string[] {
    const recommendations: string[] = [];

    // Generate recommendations based on git operation type
    if (task.type === 'git_commit') {
      recommendations.push('Follow conventional commit message format for better history');
      recommendations.push('Consider running tests before committing changes');
    } else if (task.type === 'git_branch') {
      recommendations.push('Use descriptive branch names that reflect the feature or fix');
      recommendations.push('Regularly sync feature branches with main branch');
    } else if (task.type === 'git_status') {
      recommendations.push('Review changes carefully before staging and committing');
      recommendations.push('Consider using .gitignore for files that should not be tracked');
    }

    recommendations.push('Maintain clean git history with meaningful commit messages');
    recommendations.push('Use git hooks for automated testing and code quality checks');

    return recommendations;
  }

  private generateGitReport(task: SubAgentTask): string {
    return `# Git Operation Report

## Task: ${task.description}

## Operation Type: ${task.type}

## Parameters:
${JSON.stringify(task.input, null, 2)}

## Generated: ${new Date().toISOString()}
`;
  }
}
