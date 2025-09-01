/**
 * @qi/tools - Bash Tool
 *
 * Secure command execution with sandboxing and comprehensive safety features.
 * Adapts Claude Code's bash execution patterns with QiCore Result<T> integration.
 */

import { spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import {
  failure,
  fromAsyncTryCatch,
  type QiError,
  type Result,
  success,
  systemError,
  validationError,
} from '@qi/base';
import { z } from 'zod';
import type { PermissionResult, ToolContext } from '../../core/interfaces/ITool.js';
import { BaseFileTool } from '../file/BaseTool.js';

/**
 * Bash tool input schema
 */
const bashToolInputSchema = z.object({
  command: z.string().min(1, 'Command cannot be empty'),
  working_directory: z.string().optional().describe('Working directory for command execution'),
  timeout: z.number().int().positive().max(600000).optional().default(30000), // Max 10 minutes
  capture_output: z.boolean().optional().default(true),
  environment: z.record(z.string()).optional().describe('Environment variables'),
  input: z.string().optional().describe('Input to send to command stdin'),
  run_in_background: z.boolean().optional().default(false),
});

type BashToolInput = z.infer<typeof bashToolInputSchema>;

/**
 * Bash tool output
 */
interface BashToolOutput {
  stdout: string;
  stderr: string;
  exit_code: number;
  execution_time_ms: number;
  command_executed: string;
  working_directory: string;
  process_id?: number;
  background_job?: boolean;
  truncated?: boolean;
}

/**
 * Command execution context
 */
interface ExecutionContext {
  command: string;
  args: string[];
  workingDirectory: string;
  environment: Record<string, string>;
  timeout: number;
  input?: string;
}

/**
 * Security policy for command execution
 */
interface CommandSecurityPolicy {
  allowedCommands: string[];
  deniedCommands: string[];
  allowedPaths: string[];
  deniedPaths: string[];
  maxOutputSize: number;
  maxExecutionTime: number;
}

/**
 * Default security policy
 */
const DEFAULT_SECURITY_POLICY: CommandSecurityPolicy = {
  allowedCommands: [
    // File operations
    'ls',
    'cat',
    'head',
    'tail',
    'find',
    'grep',
    'awk',
    'sed',
    // Development tools
    'git',
    'npm',
    'yarn',
    'bun',
    'node',
    'python',
    'python3',
    'cargo',
    'rustc',
    'go',
    'javac',
    'java',
    'gcc',
    'make',
    // Text processing
    'wc',
    'sort',
    'uniq',
    'cut',
    'tr',
    'diff',
    'patch',
    // Archive tools
    'tar',
    'gzip',
    'gunzip',
    'zip',
    'unzip',
    // System info
    'pwd',
    'whoami',
    'id',
    'env',
    'date',
    'uptime',
    'df',
    'du',
    // Network (safe subset)
    'curl',
    'wget',
    'ping',
  ],
  deniedCommands: [
    // System modification
    'rm',
    'rmdir',
    'mv',
    'cp',
    'chmod',
    'chown',
    'chgrp',
    'sudo',
    'su',
    'passwd',
    'usermod',
    'userdel',
    'useradd',
    // Network/security
    'ssh',
    'scp',
    'rsync',
    'netcat',
    'nc',
    'nmap',
    'telnet',
    // System control
    'systemctl',
    'service',
    'mount',
    'umount',
    'fdisk',
    'kill',
    'killall',
    'pkill',
    'reboot',
    'shutdown',
    'halt',
    // Package managers
    'apt',
    'yum',
    'dnf',
    'pacman',
    'brew',
  ],
  allowedPaths: ['/tmp', '/var/tmp', '/home', '/Users'],
  deniedPaths: ['/etc', '/sys', '/proc', '/root', '/boot', '/dev'],
  maxOutputSize: 10 * 1024 * 1024, // 10MB
  maxExecutionTime: 300000, // 5 minutes
};

/**
 * Bash Tool - Secure command execution
 */
export class BashTool extends BaseFileTool<BashToolInput, BashToolOutput> {
  readonly name = 'BashTool';
  readonly description =
    'Secure command execution with sandboxing, output capture, and comprehensive safety features';
  readonly version = '1.0.0';
  readonly inputSchema = bashToolInputSchema;
  readonly isReadOnly = false; // Commands can modify system
  readonly isConcurrencySafe = false; // Commands may have side effects

  private securityPolicy: CommandSecurityPolicy;
  private backgroundJobs = new Map<number, { command: string; startTime: number }>();

  constructor(securityPolicy?: Partial<CommandSecurityPolicy>) {
    super();
    this.securityPolicy = { ...DEFAULT_SECURITY_POLICY, ...securityPolicy };
  }

  /**
   * Execute bash command with security and sandboxing
   */
  async executeImpl(
    input: BashToolInput,
    context: ToolContext
  ): Promise<Result<BashToolOutput, QiError>> {
    const startTime = Date.now();
    const {
      command,
      working_directory,
      timeout,
      capture_output,
      environment,
      input: stdin,
      run_in_background,
    } = input;

    // Parse and validate command
    const executionContext = this.parseCommand(command, {
      workingDirectory: working_directory || context.currentDirectory || process.cwd(),
      environment: { ...Object.fromEntries(context.environment), ...environment },
      timeout: Math.min(timeout!, this.securityPolicy.maxExecutionTime),
      input: stdin,
    });

    // Security validation
    const securityResult = await this.validateCommandSecurity(executionContext, context);
    if (securityResult.tag === 'failure') {
      return securityResult;
    }

    // Execute command
    if (run_in_background) {
      return this.executeInBackground(executionContext, startTime);
    } else {
      return this.executeSynchronously(executionContext, capture_output!, startTime);
    }
  }

  /**
   * Enhanced validation for command security
   */
  validate(input: BashToolInput): Result<void, QiError> {
    // Basic command validation
    if (input.command.trim().length === 0) {
      return failure(validationError('Command cannot be empty or whitespace only'));
    }

    // Check for dangerous patterns
    const dangerousPatterns = [
      /rm\s+-rf?\s+\//, // rm -rf /
      />\s*\/dev\/sd[a-z]/, // Write to disk devices
      /mkfs/, // Format filesystem
      /dd\s+if=.*of=\/dev/, // Direct disk writes
      /:\(\)\{\s*:\|:&\s*\};:/, // Fork bomb
    ];

    for (const pattern of dangerousPatterns) {
      if (pattern.test(input.command)) {
        return failure(validationError('Command contains potentially dangerous patterns'));
      }
    }

    // Validate working directory if specified
    if (input.working_directory) {
      if (!path.isAbsolute(input.working_directory)) {
        return failure(validationError('Working directory must be absolute path'));
      }

      // Check against denied paths
      for (const deniedPath of this.securityPolicy.deniedPaths) {
        if (input.working_directory.startsWith(deniedPath)) {
          return failure(validationError(`Working directory in restricted path: ${deniedPath}`));
        }
      }
    }

    // Validate timeout
    if (input.timeout && input.timeout > this.securityPolicy.maxExecutionTime) {
      return failure(
        validationError(
          `Timeout exceeds maximum allowed: ${this.securityPolicy.maxExecutionTime}ms`
        )
      );
    }

    return success(undefined);
  }

  /**
   * Enhanced permission check for command execution
   */
  checkPermissions(input: BashToolInput, context: ToolContext): Result<PermissionResult, QiError> {
    // Call base permission check
    const baseResult = super.checkPermissions(input, context);
    if (baseResult.tag === 'failure' || !baseResult.value.allowed) {
      return baseResult;
    }

    // Check system execution permission
    if (!context.permissions.executeCommands) {
      return success({
        allowed: false,
        reason: 'Command execution permission not granted',
      });
    }

    // Parse command to get the base command
    const commandParts = input.command.trim().split(/\s+/);
    const baseCommand = path.basename(commandParts[0]);

    // Check against denied commands
    if (this.securityPolicy.deniedCommands.includes(baseCommand)) {
      return success({
        allowed: false,
        reason: `Command '${baseCommand}' is not allowed by security policy`,
      });
    }

    // Check against allowed commands (if allowlist is enforced)
    if (
      this.securityPolicy.allowedCommands.length > 0 &&
      !this.securityPolicy.allowedCommands.includes(baseCommand)
    ) {
      return success({
        allowed: false,
        reason: `Command '${baseCommand}' is not in the allowed commands list`,
      });
    }

    return success({ allowed: true });
  }

  // Private helper methods

  private parseCommand(
    command: string,
    options: {
      workingDirectory: string;
      environment: Record<string, string>;
      timeout: number;
      input?: string;
    }
  ): ExecutionContext {
    // Simple command parsing - in production, use a proper shell parser
    const trimmedCommand = command.trim();
    const args = trimmedCommand.split(/\s+/);
    const cmd = args.shift() || '';

    return {
      command: cmd,
      args,
      workingDirectory: options.workingDirectory,
      environment: options.environment,
      timeout: options.timeout,
      input: options.input,
    };
  }

  private async validateCommandSecurity(
    context: ExecutionContext,
    _toolContext: ToolContext
  ): Promise<Result<void, QiError>> {
    // Validate working directory exists and is accessible
    return fromAsyncTryCatch(
      async () => {
        const stats = await fs.stat(context.workingDirectory);
        if (!stats.isDirectory()) {
          throw new Error(`Working directory is not a directory: ${context.workingDirectory}`);
        }

        // Check path restrictions
        for (const deniedPath of this.securityPolicy.deniedPaths) {
          if (context.workingDirectory.startsWith(deniedPath)) {
            throw new Error(`Working directory in restricted path: ${deniedPath}`);
          }
        }

        return undefined;
      },
      (error) =>
        systemError(
          `Working directory validation failed: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  private async executeSynchronously(
    context: ExecutionContext,
    captureOutput: boolean,
    startTime: number
  ): Promise<Result<BashToolOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        return new Promise<BashToolOutput>((resolve, reject) => {
          const child = spawn(context.command, context.args, {
            cwd: context.workingDirectory,
            env: context.environment,
            stdio: captureOutput ? 'pipe' : 'inherit',
            timeout: context.timeout,
          });

          let stdout = '';
          let stderr = '';
          let truncated = false;

          if (captureOutput && child.stdout) {
            child.stdout.on('data', (data: Buffer) => {
              const chunk = data.toString();
              if (stdout.length + chunk.length > this.securityPolicy.maxOutputSize) {
                truncated = true;
                stdout += chunk.substring(0, this.securityPolicy.maxOutputSize - stdout.length);
              } else {
                stdout += chunk;
              }
            });
          }

          if (captureOutput && child.stderr) {
            child.stderr.on('data', (data: Buffer) => {
              const chunk = data.toString();
              if (stderr.length + chunk.length > this.securityPolicy.maxOutputSize) {
                truncated = true;
                stderr += chunk.substring(0, this.securityPolicy.maxOutputSize - stderr.length);
              } else {
                stderr += chunk;
              }
            });
          }

          // Send input if provided
          if (context.input && child.stdin) {
            child.stdin.write(context.input);
            child.stdin.end();
          }

          child.on('close', (code, signal) => {
            const executionTime = Date.now() - startTime;

            resolve({
              stdout,
              stderr,
              exit_code: code || (signal ? 128 : 0),
              execution_time_ms: executionTime,
              command_executed: `${context.command} ${context.args.join(' ')}`.trim(),
              working_directory: context.workingDirectory,
              process_id: child.pid,
              background_job: false,
              truncated,
            });
          });

          child.on('error', (error) => {
            reject(error);
          });

          // Handle timeout
          setTimeout(() => {
            if (!child.killed) {
              child.kill('SIGTERM');
              setTimeout(() => {
                if (!child.killed) {
                  child.kill('SIGKILL');
                }
              }, 5000); // Give 5 seconds for graceful shutdown
            }
          }, context.timeout);
        });
      },
      (error) =>
        systemError(
          `Command execution failed: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  private async executeInBackground(
    context: ExecutionContext,
    startTime: number
  ): Promise<Result<BashToolOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const child = spawn(context.command, context.args, {
          cwd: context.workingDirectory,
          env: context.environment,
          stdio: 'ignore',
          detached: true,
        });

        child.unref(); // Allow parent to exit without waiting

        if (child.pid) {
          this.backgroundJobs.set(child.pid, {
            command: `${context.command} ${context.args.join(' ')}`.trim(),
            startTime,
          });

          // Clean up job tracking after timeout
          setTimeout(() => {
            this.backgroundJobs.delete(child.pid!);
          }, context.timeout);
        }

        const executionTime = Date.now() - startTime;

        return {
          stdout: '',
          stderr: '',
          exit_code: 0, // Background job started successfully
          execution_time_ms: executionTime,
          command_executed: `${context.command} ${context.args.join(' ')}`.trim(),
          working_directory: context.workingDirectory,
          process_id: child.pid,
          background_job: true,
        };
      },
      (error) =>
        systemError(
          `Background command execution failed: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  /**
   * Get status of background jobs
   */
  getBackgroundJobs(): Array<{ pid: number; command: string; duration: number }> {
    const now = Date.now();
    return Array.from(this.backgroundJobs.entries()).map(([pid, job]) => ({
      pid,
      command: job.command,
      duration: now - job.startTime,
    }));
  }

  /**
   * Update security policy
   */
  updateSecurityPolicy(policy: Partial<CommandSecurityPolicy>): Result<void, QiError> {
    this.securityPolicy = { ...this.securityPolicy, ...policy };
    return success(undefined);
  }
}
