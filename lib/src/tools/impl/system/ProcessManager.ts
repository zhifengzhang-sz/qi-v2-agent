/**
 * @qi/tools - Process Manager Tool
 *
 * Advanced process management with monitoring, signal handling, and resource tracking.
 * Provides secure process lifecycle management with comprehensive safety features.
 */

import { type ChildProcess, exec, spawn } from 'node:child_process';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
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
 * Process manager input schema
 */
const processManagerInputSchema = z.object({
  action: z.enum(['list', 'start', 'stop', 'kill', 'monitor', 'cleanup']),

  // For start action
  command: z.string().optional().describe('Command to start new process'),
  args: z.array(z.string()).optional().default([]).describe('Command arguments'),
  working_directory: z.string().optional().describe('Working directory for new process'),
  environment: z.record(z.string()).optional().describe('Environment variables'),
  detached: z.boolean().optional().default(false).describe('Run as detached process'),

  // For stop/kill/monitor actions
  process_id: z.number().int().positive().optional().describe('Process ID to target'),
  process_name: z.string().optional().describe('Process name pattern to target'),
  signal: z
    .enum(['SIGTERM', 'SIGKILL', 'SIGINT', 'SIGUSR1', 'SIGUSR2'])
    .optional()
    .default('SIGTERM'),

  // For list action
  filter: z.string().optional().describe('Filter processes by name pattern'),
  include_system: z.boolean().optional().default(false).describe('Include system processes'),

  // For monitor action
  duration: z
    .number()
    .int()
    .positive()
    .max(300)
    .optional()
    .default(30)
    .describe('Monitoring duration in seconds'),
  interval: z
    .number()
    .int()
    .positive()
    .max(10)
    .optional()
    .default(1)
    .describe('Monitoring interval in seconds'),
});

type ProcessManagerInput = z.infer<typeof processManagerInputSchema>;

/**
 * Process information
 */
interface ProcessInfo {
  pid: number;
  ppid: number;
  name: string;
  command: string;
  cpu: number;
  memory: number;
  startTime: string;
  status: string;
  user?: string;
}

/**
 * Process monitoring data
 */
interface ProcessMonitorData {
  pid: number;
  samples: Array<{
    timestamp: number;
    cpu: number;
    memory: number;
    status: string;
  }>;
  averageCpu: number;
  averageMemory: number;
  peakCpu: number;
  peakMemory: number;
}

/**
 * Process manager output
 */
interface ProcessManagerOutput {
  action: string;
  success: boolean;
  data?: {
    processes?: ProcessInfo[];
    process?: ProcessInfo;
    monitoring?: ProcessMonitorData;
    started?: { pid: number; command: string };
    stopped?: { pid: number; signal: string };
    cleaned?: { count: number; pids: number[] };
  };
  message?: string;
  timestamp: number;
}

/**
 * Process Manager Tool - Advanced Process Lifecycle Management
 */
export class ProcessManager extends BaseFileTool<ProcessManagerInput, ProcessManagerOutput> {
  readonly name = 'ProcessManager';
  readonly description =
    'Advanced process management with monitoring, signal handling, and resource tracking';
  readonly version = '1.0.0';
  readonly inputSchema = processManagerInputSchema;
  readonly isReadOnly = false; // Can start/stop processes
  readonly isConcurrencySafe = false; // Process operations may have system-wide effects

  private managedProcesses = new Map<
    number,
    { process: ChildProcess; command: string; startTime: number }
  >();
  private monitoringIntervals = new Map<number, NodeJS.Timeout>();

  constructor() {
    super();
  }

  /**
   * Execute process management action
   */
  async executeImpl(
    input: ProcessManagerInput,
    context: ToolContext
  ): Promise<Result<ProcessManagerOutput, QiError>> {
    const startTime = Date.now();

    try {
      switch (input.action) {
        case 'list':
          return await this.listProcesses(input, startTime);
        case 'start':
          return await this.startProcess(input, context, startTime);
        case 'stop':
          return await this.stopProcess(input, startTime);
        case 'kill':
          return await this.killProcess(input, startTime);
        case 'monitor':
          return await this.monitorProcess(input, startTime);
        case 'cleanup':
          return await this.cleanupProcesses(input, startTime);
        default:
          return failure(validationError(`Unknown action: ${input.action}`));
      }
    } catch (error) {
      return failure(
        systemError(
          `Process manager operation failed: ${error instanceof Error ? error.message : String(error)}`
        )
      );
    }
  }

  /**
   * Enhanced validation for process management operations
   */
  validate(input: ProcessManagerInput): Result<void, QiError> {
    // Action-specific validation
    switch (input.action) {
      case 'start':
        if (!input.command) {
          return failure(validationError('Command is required for start action'));
        }
        if (input.command.trim().length === 0) {
          return failure(validationError('Command cannot be empty'));
        }
        break;

      case 'stop':
      case 'kill':
      case 'monitor':
        if (!input.process_id && !input.process_name) {
          return failure(
            validationError(`${input.action} action requires either process_id or process_name`)
          );
        }
        break;

      case 'list':
      case 'cleanup':
        // No additional validation required
        break;
    }

    // Security validation for dangerous commands
    if (input.command) {
      const dangerousPatterns = [
        /rm\s+-rf?\s+\//, // rm -rf /
        /mkfs/, // Format filesystem
        /dd\s+if=.*of=\/dev/, // Direct disk writes
        /:(){ :|:& };:/, // Fork bomb
        /shutdown|reboot|halt/, // System control
      ];

      for (const pattern of dangerousPatterns) {
        if (pattern.test(input.command)) {
          return failure(validationError('Command contains potentially dangerous patterns'));
        }
      }
    }

    return success(undefined);
  }

  /**
   * Enhanced permission check for process management
   */
  checkPermissions(
    input: ProcessManagerInput,
    context: ToolContext
  ): Result<PermissionResult, QiError> {
    // Call base permission check
    const baseResult = super.checkPermissions(input, context);
    if (baseResult.tag === 'failure' || !baseResult.value.allowed) {
      return baseResult;
    }

    // Check process management permission
    if (!context.permissions.manageProcesses) {
      return success({
        allowed: false,
        reason: 'Process management permission not granted',
      });
    }

    // Additional checks for dangerous operations
    if (input.action === 'kill' || (input.action === 'stop' && input.signal === 'SIGKILL')) {
      if (!context.permissions.executeCommands) {
        return success({
          allowed: false,
          reason: 'Kill operations require command execution permission',
        });
      }
    }

    return success({ allowed: true });
  }

  // Private implementation methods

  private async listProcesses(
    input: ProcessManagerInput,
    startTime: number
  ): Promise<Result<ProcessManagerOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        let processes: ProcessInfo[] = [];

        if (process.platform === 'win32') {
          processes = await this.listProcessesWindows(input.filter, input.include_system);
        } else {
          processes = await this.listProcessesUnix(input.filter, input.include_system);
        }

        return {
          action: 'list',
          success: true,
          data: { processes },
          timestamp: startTime,
        };
      },
      (error) =>
        systemError(
          `Failed to list processes: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  private async listProcessesUnix(filter?: string, includeSystem = false): Promise<ProcessInfo[]> {
    return new Promise((resolve, reject) => {
      const psCommand = includeSystem
        ? 'ps -eo pid,ppid,comm,cmd,%cpu,%mem,lstart,stat,user --no-headers'
        : 'ps -eo pid,ppid,comm,cmd,%cpu,%mem,lstart,stat --no-headers';

      exec(psCommand, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const processes: ProcessInfo[] = [];
        const lines = stdout.trim().split('\n');

        for (const line of lines) {
          const parts = line.trim().split(/\s+/);
          if (parts.length < 8) continue;

          const pid = parseInt(parts[0]);
          const ppid = parseInt(parts[1]);
          const name = parts[2];
          const command = parts.slice(3, -5).join(' ');
          const cpu = parseFloat(parts[parts.length - 5]);
          const memory = parseFloat(parts[parts.length - 4]);
          const startTime = parts[parts.length - 3];
          const status = parts[parts.length - 2];
          const user = includeSystem ? parts[parts.length - 1] : undefined;

          if (filter && !name.includes(filter) && !command.includes(filter)) {
            continue;
          }

          processes.push({
            pid,
            ppid,
            name,
            command,
            cpu,
            memory,
            startTime,
            status,
            user,
          });
        }

        resolve(processes);
      });
    });
  }

  private async listProcessesWindows(
    filter?: string,
    includeSystem = false
  ): Promise<ProcessInfo[]> {
    return new Promise((resolve, reject) => {
      const wmicCommand =
        'wmic process get ProcessId,ParentProcessId,Name,CommandLine,PageFileUsage,CreationDate,Status /format:csv';

      exec(wmicCommand, (error, stdout) => {
        if (error) {
          reject(error);
          return;
        }

        const processes: ProcessInfo[] = [];
        const lines = stdout.trim().split('\n').slice(1); // Skip header

        for (const line of lines) {
          const parts = line.split(',');
          if (parts.length < 7) continue;

          const pid = parseInt(parts[5]) || 0;
          const ppid = parseInt(parts[4]) || 0;
          const name = parts[3] || 'unknown';
          const command = parts[1] || '';
          const memory = parseInt(parts[6]) || 0;

          if (filter && !name.includes(filter) && !command.includes(filter)) {
            continue;
          }

          processes.push({
            pid,
            ppid,
            name,
            command,
            cpu: 0, // Windows doesn't provide real-time CPU via wmic
            memory: memory / 1024, // Convert to MB
            startTime: parts[2] || '',
            status: parts[7] || 'unknown',
          });
        }

        resolve(processes);
      });
    });
  }

  private async startProcess(
    input: ProcessManagerInput,
    context: ToolContext,
    startTime: number
  ): Promise<Result<ProcessManagerOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const child = spawn(input.command!, input.args || [], {
          cwd: input.working_directory || context.currentDirectory || process.cwd(),
          env: { ...process.env, ...input.environment },
          detached: input.detached,
          stdio: input.detached ? 'ignore' : 'pipe',
        });

        if (input.detached) {
          child.unref();
        }

        if (child.pid) {
          this.managedProcesses.set(child.pid, {
            process: child,
            command: `${input.command} ${(input.args || []).join(' ')}`.trim(),
            startTime: Date.now(),
          });
        }

        return {
          action: 'start',
          success: true,
          data: {
            started: {
              pid: child.pid || 0,
              command: `${input.command} ${(input.args || []).join(' ')}`.trim(),
            },
          },
          message: `Process started with PID ${child.pid}`,
          timestamp: startTime,
        };
      },
      (error) =>
        systemError(
          `Failed to start process: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  private async stopProcess(
    input: ProcessManagerInput,
    startTime: number
  ): Promise<Result<ProcessManagerOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const pid = input.process_id;
        if (!pid) {
          throw new Error('Process ID is required for stop action');
        }

        // Check if we manage this process
        const managedProcess = this.managedProcesses.get(pid);
        if (managedProcess) {
          managedProcess.process.kill(input.signal);
          this.managedProcesses.delete(pid);
        } else {
          // Try to signal external process
          process.kill(pid, input.signal);
        }

        return {
          action: 'stop',
          success: true,
          data: {
            stopped: {
              pid,
              signal: input.signal!,
            },
          },
          message: `Process ${pid} stopped with signal ${input.signal}`,
          timestamp: startTime,
        };
      },
      (error) =>
        systemError(
          `Failed to stop process: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  private async killProcess(
    input: ProcessManagerInput,
    startTime: number
  ): Promise<Result<ProcessManagerOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const pid = input.process_id;
        if (!pid) {
          throw new Error('Process ID is required for kill action');
        }

        // Force kill with SIGKILL
        const managedProcess = this.managedProcesses.get(pid);
        if (managedProcess) {
          managedProcess.process.kill('SIGKILL');
          this.managedProcesses.delete(pid);
        } else {
          process.kill(pid, 'SIGKILL');
        }

        return {
          action: 'kill',
          success: true,
          data: {
            stopped: {
              pid,
              signal: 'SIGKILL',
            },
          },
          message: `Process ${pid} forcibly terminated`,
          timestamp: startTime,
        };
      },
      (error) =>
        systemError(
          `Failed to kill process: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  private async monitorProcess(
    input: ProcessManagerInput,
    startTime: number
  ): Promise<Result<ProcessManagerOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const pid = input.process_id;
        if (!pid) {
          throw new Error('Process ID is required for monitor action');
        }

        const duration = (input.duration || 30) * 1000;
        const interval = (input.interval || 1) * 1000;

        const monitorData: ProcessMonitorData = {
          pid,
          samples: [],
          averageCpu: 0,
          averageMemory: 0,
          peakCpu: 0,
          peakMemory: 0,
        };

        return new Promise<ProcessManagerOutput>((resolve) => {
          const startMonitoring = Date.now();

          const monitor = setInterval(async () => {
            try {
              const processInfo = await this.getProcessInfo(pid);
              if (processInfo) {
                const sample = {
                  timestamp: Date.now(),
                  cpu: processInfo.cpu,
                  memory: processInfo.memory,
                  status: processInfo.status,
                };

                monitorData.samples.push(sample);
                monitorData.peakCpu = Math.max(monitorData.peakCpu, sample.cpu);
                monitorData.peakMemory = Math.max(monitorData.peakMemory, sample.memory);
              }

              if (Date.now() - startMonitoring >= duration) {
                clearInterval(monitor);
                this.monitoringIntervals.delete(pid);

                // Calculate averages
                if (monitorData.samples.length > 0) {
                  monitorData.averageCpu =
                    monitorData.samples.reduce((sum, s) => sum + s.cpu, 0) /
                    monitorData.samples.length;
                  monitorData.averageMemory =
                    monitorData.samples.reduce((sum, s) => sum + s.memory, 0) /
                    monitorData.samples.length;
                }

                resolve({
                  action: 'monitor',
                  success: true,
                  data: { monitoring: monitorData },
                  message: `Monitored process ${pid} for ${duration / 1000} seconds`,
                  timestamp: startTime,
                });
              }
            } catch (error) {
              clearInterval(monitor);
              this.monitoringIntervals.delete(pid);
              resolve({
                action: 'monitor',
                success: false,
                message: `Monitoring failed: ${error instanceof Error ? error.message : String(error)}`,
                timestamp: startTime,
              });
            }
          }, interval);

          this.monitoringIntervals.set(pid, monitor);
        });
      },
      (error) =>
        systemError(
          `Failed to monitor process: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  private async cleanupProcesses(
    input: ProcessManagerInput,
    startTime: number
  ): Promise<Result<ProcessManagerOutput, QiError>> {
    return fromAsyncTryCatch(
      async () => {
        const cleanedPids: number[] = [];

        // Cleanup managed processes
        for (const [pid, managed] of this.managedProcesses.entries()) {
          try {
            if (!managed.process.killed) {
              managed.process.kill('SIGTERM');
              cleanedPids.push(pid);
            }
          } catch {
            // Process might already be dead
          }
        }

        this.managedProcesses.clear();

        // Cleanup monitoring intervals
        for (const [pid, interval] of this.monitoringIntervals.entries()) {
          clearInterval(interval);
        }
        this.monitoringIntervals.clear();

        return {
          action: 'cleanup',
          success: true,
          data: {
            cleaned: {
              count: cleanedPids.length,
              pids: cleanedPids,
            },
          },
          message: `Cleaned up ${cleanedPids.length} managed processes`,
          timestamp: startTime,
        };
      },
      (error) =>
        systemError(
          `Failed to cleanup processes: ${error instanceof Error ? error.message : String(error)}`
        )
    );
  }

  private async getProcessInfo(pid: number): Promise<ProcessInfo | null> {
    return new Promise((resolve) => {
      const psCommand =
        process.platform === 'win32'
          ? `wmic process where processid=${pid} get ProcessId,Name,CommandLine,PageFileUsage /format:csv`
          : `ps -p ${pid} -o pid,ppid,comm,cmd,%cpu,%mem,lstart,stat --no-headers`;

      exec(psCommand, (error, stdout) => {
        if (error || !stdout.trim()) {
          resolve(null);
          return;
        }

        try {
          if (process.platform === 'win32') {
            const lines = stdout.trim().split('\n');
            const data = lines[1]?.split(',');
            if (data && data.length >= 4) {
              resolve({
                pid,
                ppid: 0,
                name: data[2] || 'unknown',
                command: data[1] || '',
                cpu: 0,
                memory: parseInt(data[3]) / 1024 || 0,
                startTime: '',
                status: 'running',
              });
            } else {
              resolve(null);
            }
          } else {
            const parts = stdout.trim().split(/\s+/);
            if (parts.length >= 8) {
              resolve({
                pid: parseInt(parts[0]),
                ppid: parseInt(parts[1]),
                name: parts[2],
                command: parts.slice(3, -4).join(' '),
                cpu: parseFloat(parts[parts.length - 4]),
                memory: parseFloat(parts[parts.length - 3]),
                startTime: parts[parts.length - 2],
                status: parts[parts.length - 1],
              });
            } else {
              resolve(null);
            }
          }
        } catch {
          resolve(null);
        }
      });
    });
  }

  /**
   * Get status of managed processes
   */
  getManagedProcesses(): Array<{
    pid: number;
    command: string;
    startTime: number;
    running: boolean;
  }> {
    return Array.from(this.managedProcesses.entries()).map(([pid, managed]) => ({
      pid,
      command: managed.command,
      startTime: managed.startTime,
      running: !managed.process.killed,
    }));
  }

  /**
   * Get active monitoring sessions
   */
  getActiveMonitoring(): number[] {
    return Array.from(this.monitoringIntervals.keys());
  }
}
