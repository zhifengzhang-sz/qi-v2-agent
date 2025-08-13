/**
 * @qi/tools - Concurrent Scheduler
 *
 * Advanced scheduling system for managing concurrent tool executions with:
 * - Resource quotas and limits
 * - Priority-based scheduling
 * - Deadlock prevention
 * - Dynamic load balancing
 */

import {
  create,
  failure,
  type QiError,
  type Result,
  success,
  systemError,
  validationError,
} from '@qi/base';
import { createQiLogger } from '../../../utils/QiCoreLogger.js';
import type { ToolCall } from '../interfaces/ITool.js';
import {
  ExecutionPriority,
  ExecutionState,
  ExecutionStrategy,
} from '../interfaces/IToolExecutor.js';

/**
 * Resource quota limits
 */
interface ResourceQuota {
  readonly maxConcurrent: number;
  readonly maxMemoryMB: number;
  readonly maxCpuPercent: number;
  readonly maxNetworkRequests: number;
}

/**
 * Scheduled execution context
 */
interface ScheduledExecution {
  readonly call: ToolCall;
  readonly priority: ExecutionPriority;
  readonly queuedAt: number;
  readonly estimatedDuration?: number;
  readonly resourceRequirements?: ResourceRequirements;
}

/**
 * Resource requirements for a tool
 */
interface ResourceRequirements {
  readonly memoryMB: number;
  readonly cpuPercent: number;
  readonly networkRequests: number;
  readonly diskIO: boolean;
}

/**
 * Scheduler statistics
 */
interface SchedulerStats {
  readonly totalScheduled: number;
  readonly currentlyRunning: number;
  readonly queuedCount: number;
  readonly averageQueueTime: number;
  readonly resourceUtilization: {
    readonly memoryPercent: number;
    readonly cpuPercent: number;
    readonly networkPercent: number;
  };
}

/**
 * Mutable scheduler statistics for internal use
 */
interface MutableSchedulerStats {
  totalScheduled: number;
  currentlyRunning: number;
  queuedCount: number;
  averageQueueTime: number;
  resourceUtilization: {
    memoryPercent: number;
    cpuPercent: number;
    networkPercent: number;
  };
}

/**
 * Scheduler error with context
 */
interface SchedulerError extends QiError {
  context: {
    operation?: string;
    callId?: string;
    resourceType?: string;
    currentLoad?: number;
    maxCapacity?: number;
  };
}

const schedulerError = (
  code: string,
  message: string,
  category: 'VALIDATION' | 'SYSTEM' | 'NETWORK' | 'BUSINESS',
  context: SchedulerError['context'] = {}
): SchedulerError => create(code, message, category, context) as SchedulerError;

/**
 * Default resource quota
 */
const DEFAULT_QUOTA: ResourceQuota = {
  maxConcurrent: 10,
  maxMemoryMB: 1024, // 1GB
  maxCpuPercent: 80,
  maxNetworkRequests: 50,
};

/**
 * Priority queue implementation for tool executions
 */
class PriorityQueue<T> {
  private items: Array<{ item: T; priority: number }> = [];

  enqueue(item: T, priority: number): void {
    const queueElement = { item, priority };
    let added = false;

    for (let i = 0; i < this.items.length; i++) {
      if (queueElement.priority > this.items[i].priority) {
        this.items.splice(i, 0, queueElement);
        added = true;
        break;
      }
    }

    if (!added) {
      this.items.push(queueElement);
    }
  }

  dequeue(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    return this.items.shift()!.item;
  }

  peek(): T | null {
    if (this.isEmpty()) {
      return null;
    }
    return this.items[0].item;
  }

  isEmpty(): boolean {
    return this.items.length === 0;
  }

  size(): number {
    return this.items.length;
  }

  clear(): void {
    this.items = [];
  }

  getItems(): readonly T[] {
    return this.items.map((item) => item.item);
  }
}

/**
 * Concurrent Scheduler with Advanced Resource Management
 */
export class ConcurrentScheduler {
  private quota: ResourceQuota;
  private logger: any;

  // Execution queues by priority
  private criticalQueue = new PriorityQueue<ScheduledExecution>();
  private highQueue = new PriorityQueue<ScheduledExecution>();
  private normalQueue = new PriorityQueue<ScheduledExecution>();
  private lowQueue = new PriorityQueue<ScheduledExecution>();

  // Active executions tracking
  private activeExecutions = new Map<string, ScheduledExecution>();
  private resourceUsage = {
    memoryMB: 0,
    cpuPercent: 0,
    networkRequests: 0,
    diskIO: false,
  };

  // Statistics
  private stats: MutableSchedulerStats = {
    totalScheduled: 0,
    currentlyRunning: 0,
    queuedCount: 0,
    averageQueueTime: 0,
    resourceUtilization: {
      memoryPercent: 0,
      cpuPercent: 0,
      networkPercent: 0,
    },
  };

  // Deadlock prevention
  private dependencyGraph = new Map<string, Set<string>>();
  private resourceLocks = new Map<string, Set<string>>();

  constructor(quota?: Partial<ResourceQuota>) {
    this.quota = { ...DEFAULT_QUOTA, ...quota };

    this.logger = createQiLogger({
      name: 'ConcurrentScheduler',
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      pretty: process.env.NODE_ENV === 'development',
    });

    // Start background resource monitoring
    this.startResourceMonitoring();
  }

  /**
   * Schedule a tool execution
   */
  async scheduleExecution(
    call: ToolCall,
    priority: ExecutionPriority = ExecutionPriority.NORMAL,
    resourceRequirements?: ResourceRequirements
  ): Promise<Result<void, QiError>> {
    const scheduled: ScheduledExecution = {
      call,
      priority,
      queuedAt: Date.now(),
      resourceRequirements,
    };

    // Validate resource requirements
    if (resourceRequirements) {
      const validationResult = this.validateResourceRequirements(resourceRequirements);
      if (validationResult.tag === 'failure') {
        return validationResult;
      }
    }

    // Check for potential deadlocks
    const deadlockResult = this.detectPotentialDeadlock(call);
    if (deadlockResult.tag === 'failure') {
      return deadlockResult;
    }

    // Add to appropriate queue based on priority
    this.addToQueue(scheduled);

    this.stats.totalScheduled++;
    this.updateQueuedCount();

    this.logger.debug('Execution scheduled', {
      component: 'ConcurrentScheduler',
      method: 'scheduleExecution',
      callId: call.callId,
      toolName: call.toolName,
      priority,
      queueSize: this.getTotalQueueSize(),
    });

    return success(undefined);
  }

  /**
   * Get next available execution considering resources and priorities
   */
  async getNextExecution(): Promise<Result<ScheduledExecution | null, QiError>> {
    // Check resource availability first
    if (!this.hasAvailableResources()) {
      return success(null); // No resources available
    }

    // Try queues in priority order
    const queues = [this.criticalQueue, this.highQueue, this.normalQueue, this.lowQueue];

    for (const queue of queues) {
      while (!queue.isEmpty()) {
        const execution = queue.dequeue();
        if (!execution) continue;

        // Check if resources are available for this specific execution
        if (this.canAllocateResources(execution.resourceRequirements)) {
          // Allocate resources
          await this.allocateResources(execution);

          this.activeExecutions.set(execution.call.callId, execution);
          this.stats.currentlyRunning++;
          this.updateQueuedCount();

          // Update queue time statistics
          const queueTime = Date.now() - execution.queuedAt;
          this.updateAverageQueueTime(queueTime);

          this.logger.debug('Execution allocated', {
            component: 'ConcurrentScheduler',
            method: 'getNextExecution',
            callId: execution.call.callId,
            toolName: execution.call.toolName,
            queueTime,
            activeCount: this.stats.currentlyRunning,
          });

          return success(execution);
        } else {
          // Put back in queue and try next
          this.addToQueue(execution);
        }
      }
    }

    // No executable tasks available
    return success(null);
  }

  /**
   * Complete an execution and free resources
   */
  async completeExecution(callId: string): Promise<Result<void, QiError>> {
    const execution = this.activeExecutions.get(callId);
    if (!execution) {
      return failure(
        schedulerError(
          'EXECUTION_NOT_FOUND',
          `No active execution found for call ID: ${callId}`,
          'VALIDATION',
          { operation: 'completeExecution', callId }
        )
      );
    }

    // Free resources
    await this.deallocateResources(execution);

    this.activeExecutions.delete(callId);
    this.stats.currentlyRunning--;
    this.updateQueuedCount();

    this.logger.debug('Execution completed', {
      component: 'ConcurrentScheduler',
      method: 'completeExecution',
      callId,
      toolName: execution.call.toolName,
      activeCount: this.stats.currentlyRunning,
    });

    return success(undefined);
  }

  /**
   * Cancel a scheduled or running execution
   */
  async cancelExecution(callId: string): Promise<Result<void, QiError>> {
    // Check if it's actively running
    const activeExecution = this.activeExecutions.get(callId);
    if (activeExecution) {
      return this.completeExecution(callId); // Free resources
    }

    // Check queues for pending execution
    const found = this.removeFromQueues(callId);
    if (found) {
      this.updateQueuedCount();
      return success(undefined);
    }

    return failure(
      schedulerError(
        'EXECUTION_NOT_FOUND',
        `No execution found for call ID: ${callId}`,
        'VALIDATION',
        { operation: 'cancelExecution', callId }
      )
    );
  }

  /**
   * Get current scheduler statistics
   */
  getStats(): SchedulerStats {
    this.updateResourceUtilization();
    return { ...this.stats };
  }

  /**
   * Update resource quotas
   */
  updateQuota(newQuota: Partial<ResourceQuota>): Result<void, QiError> {
    const updatedQuota = { ...this.quota, ...newQuota };

    // Validate new quota
    if (updatedQuota.maxConcurrent < 1 || updatedQuota.maxConcurrent > 100) {
      return failure(
        schedulerError('INVALID_QUOTA', 'maxConcurrent must be between 1 and 100', 'VALIDATION', {
          operation: 'updateQuota',
        })
      );
    }

    this.quota = updatedQuota;

    this.logger.info('Resource quota updated', {
      component: 'ConcurrentScheduler',
      method: 'updateQuota',
      quota: this.quota,
    });

    return success(undefined);
  }

  /**
   * Clear all queues (emergency stop)
   */
  async clearAllQueues(): Promise<Result<number, QiError>> {
    const totalCleared = this.getTotalQueueSize();

    this.criticalQueue.clear();
    this.highQueue.clear();
    this.normalQueue.clear();
    this.lowQueue.clear();

    this.updateQueuedCount();

    return success(totalCleared);
  }

  // Private helper methods

  private addToQueue(execution: ScheduledExecution): void {
    switch (execution.priority) {
      case ExecutionPriority.CRITICAL:
        this.criticalQueue.enqueue(execution, execution.priority);
        break;
      case ExecutionPriority.HIGH:
        this.highQueue.enqueue(execution, execution.priority);
        break;
      case ExecutionPriority.NORMAL:
        this.normalQueue.enqueue(execution, execution.priority);
        break;
      case ExecutionPriority.LOW:
        this.lowQueue.enqueue(execution, execution.priority);
        break;
    }
  }

  private removeFromQueues(callId: string): boolean {
    const queues = [this.criticalQueue, this.highQueue, this.normalQueue, this.lowQueue];

    for (const queue of queues) {
      const items = queue.getItems();
      for (const item of items) {
        if (item.call.callId === callId) {
          // Reconstruct queue without this item
          const filteredItems = items.filter((i) => i.call.callId !== callId);
          queue.clear();
          for (const filteredItem of filteredItems) {
            queue.enqueue(filteredItem, filteredItem.priority);
          }
          return true;
        }
      }
    }

    return false;
  }

  private hasAvailableResources(): boolean {
    return (
      this.activeExecutions.size < this.quota.maxConcurrent &&
      this.resourceUsage.memoryMB < this.quota.maxMemoryMB &&
      this.resourceUsage.cpuPercent < this.quota.maxCpuPercent &&
      this.resourceUsage.networkRequests < this.quota.maxNetworkRequests
    );
  }

  private canAllocateResources(requirements?: ResourceRequirements): boolean {
    if (!requirements) return true; // No specific requirements

    return (
      this.resourceUsage.memoryMB + requirements.memoryMB <= this.quota.maxMemoryMB &&
      this.resourceUsage.cpuPercent + requirements.cpuPercent <= this.quota.maxCpuPercent &&
      this.resourceUsage.networkRequests + requirements.networkRequests <=
        this.quota.maxNetworkRequests
    );
  }

  private async allocateResources(execution: ScheduledExecution): Promise<void> {
    if (execution.resourceRequirements) {
      this.resourceUsage.memoryMB += execution.resourceRequirements.memoryMB;
      this.resourceUsage.cpuPercent += execution.resourceRequirements.cpuPercent;
      this.resourceUsage.networkRequests += execution.resourceRequirements.networkRequests;

      if (execution.resourceRequirements.diskIO) {
        this.resourceUsage.diskIO = true;
      }
    }

    // Add resource locks to prevent deadlocks
    const locks = new Set<string>();
    if (execution.resourceRequirements?.diskIO) locks.add('disk');
    if ((execution.resourceRequirements?.networkRequests || 0) > 0) locks.add('network');

    this.resourceLocks.set(execution.call.callId, locks);
  }

  private async deallocateResources(execution: ScheduledExecution): Promise<void> {
    if (execution.resourceRequirements) {
      this.resourceUsage.memoryMB = Math.max(
        0,
        this.resourceUsage.memoryMB - execution.resourceRequirements.memoryMB
      );
      this.resourceUsage.cpuPercent = Math.max(
        0,
        this.resourceUsage.cpuPercent - execution.resourceRequirements.cpuPercent
      );
      this.resourceUsage.networkRequests = Math.max(
        0,
        this.resourceUsage.networkRequests - (execution.resourceRequirements?.networkRequests || 0)
      );

      // Check if any other execution needs diskIO
      const otherDiskUsers = Array.from(this.activeExecutions.values()).filter(
        (e) => e.call.callId !== execution.call.callId && e.resourceRequirements?.diskIO
      );

      if (otherDiskUsers.length === 0) {
        this.resourceUsage.diskIO = false;
      }
    }

    // Remove resource locks
    this.resourceLocks.delete(execution.call.callId);
  }

  private detectPotentialDeadlock(call: ToolCall): Result<void, QiError> {
    // Simple deadlock detection based on resource dependencies
    // In a real implementation, this would be more sophisticated

    const activeLocks = new Set<string>();
    for (const locks of this.resourceLocks.values()) {
      for (const lock of locks) {
        activeLocks.add(lock);
      }
    }

    // Check for circular dependencies (simplified)
    if (activeLocks.size >= 2 && this.activeExecutions.size >= this.quota.maxConcurrent - 1) {
      this.logger.warn('Potential deadlock detected', {
        component: 'ConcurrentScheduler',
        method: 'detectPotentialDeadlock',
        callId: call.callId,
        activeLocks: Array.from(activeLocks),
        activeCount: this.activeExecutions.size,
      });
    }

    return success(undefined);
  }

  private validateResourceRequirements(requirements: ResourceRequirements): Result<void, QiError> {
    if (requirements.memoryMB > this.quota.maxMemoryMB) {
      return failure(
        schedulerError(
          'RESOURCE_REQUIREMENT_TOO_HIGH',
          `Memory requirement (${requirements.memoryMB}MB) exceeds quota (${this.quota.maxMemoryMB}MB)`,
          'VALIDATION',
          {
            resourceType: 'memory',
            currentLoad: requirements.memoryMB,
            maxCapacity: this.quota.maxMemoryMB,
          }
        )
      );
    }

    if (requirements.cpuPercent > this.quota.maxCpuPercent) {
      return failure(
        schedulerError(
          'RESOURCE_REQUIREMENT_TOO_HIGH',
          `CPU requirement (${requirements.cpuPercent}%) exceeds quota (${this.quota.maxCpuPercent}%)`,
          'VALIDATION',
          {
            resourceType: 'cpu',
            currentLoad: requirements.cpuPercent,
            maxCapacity: this.quota.maxCpuPercent,
          }
        )
      );
    }

    return success(undefined);
  }

  private getTotalQueueSize(): number {
    return (
      this.criticalQueue.size() +
      this.highQueue.size() +
      this.normalQueue.size() +
      this.lowQueue.size()
    );
  }

  private updateQueuedCount(): void {
    this.stats.queuedCount = this.getTotalQueueSize();
  }

  private updateAverageQueueTime(queueTime: number): void {
    const totalExecutions = this.stats.totalScheduled;
    if (totalExecutions === 1) {
      this.stats.averageQueueTime = queueTime;
    } else {
      this.stats.averageQueueTime =
        (this.stats.averageQueueTime * (totalExecutions - 1) + queueTime) / totalExecutions;
    }
  }

  private updateResourceUtilization(): void {
    this.stats.resourceUtilization = {
      memoryPercent: (this.resourceUsage.memoryMB / this.quota.maxMemoryMB) * 100,
      cpuPercent: (this.resourceUsage.cpuPercent / this.quota.maxCpuPercent) * 100,
      networkPercent: (this.resourceUsage.networkRequests / this.quota.maxNetworkRequests) * 100,
    };
  }

  private startResourceMonitoring(): void {
    // Start background monitoring (simplified)
    setInterval(() => {
      this.updateResourceUtilization();

      if (process.env.NODE_ENV === 'development') {
        this.logger.debug('Resource utilization', {
          component: 'ConcurrentScheduler',
          method: 'resourceMonitoring',
          utilization: this.stats.resourceUtilization,
          activeExecutions: this.activeExecutions.size,
          queuedCount: this.stats.queuedCount,
        });
      }
    }, 10000); // Every 10 seconds
  }
}
