/**
 * Sub-Agent Registry Implementation
 *
 * Manages the registration, discovery, and selection of sub-agents based on their capabilities.
 * Uses QiCore Result<T, QiError> patterns for consistent error handling.
 */

import type { Result } from '@qi/base';
import { failure, match, success } from '@qi/base';
import type { QiError } from '@qi/core';
import { createQiLogger, type SimpleLogger } from '../../../utils/QiCoreLogger.js';
import type { ISubAgent, ISubAgentRegistry, SubAgentCapability, SubAgentTask } from './types.js';

/**
 * Creates QiCore-compatible error for registry operations
 */
function createRegistryError(
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

export class SubAgentRegistry implements ISubAgentRegistry {
  private agents: Map<string, ISubAgent> = new Map();
  private capabilityIndex: Map<string, Set<string>> = new Map(); // capability type -> agent IDs
  private logger: SimpleLogger;

  constructor() {
    this.logger = createQiLogger({ name: 'SubAgentRegistry' });
    this.logger.info('Sub-agent registry initialized');
  }

  /**
   * Register a sub-agent in the registry
   */
  async register(subAgent: ISubAgent): Promise<Result<void, QiError>> {
    try {
      // Check if agent is already registered
      if (this.agents.has(subAgent.id)) {
        return failure(
          createRegistryError(
            'SUB_AGENT_ALREADY_REGISTERED',
            'Sub-agent with this ID is already registered',
            { subAgentId: subAgent.id, name: subAgent.name }
          )
        );
      }

      // Validate sub-agent health before registration
      const healthResult = await subAgent.getHealth();
      const healthCheck = match(
        (health) => {
          if (health.status === 'unhealthy') {
            throw createRegistryError(
              'SUB_AGENT_UNHEALTHY',
              'Cannot register unhealthy sub-agent',
              {
                subAgentId: subAgent.id,
                status: health.status,
                issues: health.issues,
              }
            );
          }
          return health;
        },
        (error) => {
          throw error;
        },
        healthResult
      );

      // Register the agent
      this.agents.set(subAgent.id, subAgent);

      // Update capability index
      for (const capability of subAgent.capabilities) {
        if (!this.capabilityIndex.has(capability.type)) {
          this.capabilityIndex.set(capability.type, new Set());
        }
        this.capabilityIndex.get(capability.type)!.add(subAgent.id);
      }

      this.logger.info('Sub-agent registered successfully', {
        subAgentId: subAgent.id,
        name: subAgent.name,
        version: subAgent.version,
        capabilities: subAgent.capabilities.map((c) => c.type),
        totalRegistered: this.agents.size,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        createRegistryError('SUB_AGENT_REGISTRATION_FAILED', 'Failed to register sub-agent', {
          subAgentId: subAgent.id,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Unregister a sub-agent from the registry
   */
  async unregister(subAgentId: string): Promise<Result<void, QiError>> {
    try {
      const subAgent = this.agents.get(subAgentId);
      if (!subAgent) {
        return failure(
          createRegistryError('SUB_AGENT_NOT_FOUND', 'Sub-agent not found in registry', {
            subAgentId,
          })
        );
      }

      // Remove from capability index
      for (const capability of subAgent.capabilities) {
        const agentSet = this.capabilityIndex.get(capability.type);
        if (agentSet) {
          agentSet.delete(subAgentId);
          if (agentSet.size === 0) {
            this.capabilityIndex.delete(capability.type);
          }
        }
      }

      // Cleanup the sub-agent
      const cleanupResult = await subAgent.cleanup();
      match(
        () => this.logger.debug('Sub-agent cleaned up successfully', { subAgentId }),
        (error) =>
          this.logger.warn('Sub-agent cleanup failed during unregistration', {
            subAgentId,
            error: error.message,
          }),
        cleanupResult
      );

      // Remove from registry
      this.agents.delete(subAgentId);

      this.logger.info('Sub-agent unregistered successfully', {
        subAgentId,
        name: subAgent.name,
        totalRegistered: this.agents.size,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        createRegistryError('SUB_AGENT_UNREGISTRATION_FAILED', 'Failed to unregister sub-agent', {
          subAgentId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Find sub-agents capable of handling a task
   */
  async findCapable(task: SubAgentTask): Promise<Result<ISubAgent[], QiError>> {
    try {
      const capableAgents: Array<{ agent: ISubAgent; score: number }> = [];

      // Get candidate agents based on task type
      const candidateIds = this.getCandidateAgentIds(task.type);

      if (candidateIds.length === 0) {
        this.logger.debug('No candidate agents found for task type', {
          taskType: task.type,
          taskId: task.id,
        });
        return success([]);
      }

      // Test each candidate agent's capability
      for (const agentId of candidateIds) {
        const agent = this.agents.get(agentId);
        if (!agent) continue; // Agent might have been unregistered

        try {
          const canHandleResult = await agent.canHandle(task);
          const score = match(
            (canHandle) => {
              if (!canHandle) return 0;

              // Calculate capability score
              const matchingCapability = this.findBestMatchingCapability(agent, task);
              return matchingCapability ? matchingCapability.confidence : 0.5;
            },
            (error) => {
              this.logger.warn('Error checking agent capability', {
                agentId,
                taskId: task.id,
                error: error.message,
              });
              return 0;
            },
            canHandleResult
          );

          if (score > 0) {
            capableAgents.push({ agent, score });
          }
        } catch (error) {
          this.logger.warn('Exception during capability check', {
            agentId,
            taskId: task.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      }

      // Sort by capability score (highest first)
      capableAgents.sort((a, b) => b.score - a.score);

      const result = capableAgents.map((item) => item.agent);

      this.logger.info('Found capable sub-agents for task', {
        taskId: task.id,
        taskType: task.type,
        candidatesFound: result.length,
        topScore: capableAgents.length > 0 ? capableAgents[0].score : 0,
      });

      return success(result);
    } catch (error) {
      return failure(
        createRegistryError('SUB_AGENT_SEARCH_FAILED', 'Failed to find capable sub-agents', {
          taskId: task.id,
          taskType: task.type,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get all registered sub-agents
   */
  async getAll(): Promise<Result<ISubAgent[], QiError>> {
    try {
      const agents = Array.from(this.agents.values());

      this.logger.debug('Retrieved all registered sub-agents', {
        totalCount: agents.length,
      });

      return success(agents);
    } catch (error) {
      return failure(
        createRegistryError('SUB_AGENT_GET_ALL_FAILED', 'Failed to get all sub-agents', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get a specific sub-agent by ID
   */
  async getById(subAgentId: string): Promise<Result<ISubAgent | null, QiError>> {
    try {
      const agent = this.agents.get(subAgentId) || null;

      this.logger.debug('Retrieved sub-agent by ID', {
        subAgentId,
        found: !!agent,
        name: agent?.name,
      });

      return success(agent);
    } catch (error) {
      return failure(
        createRegistryError('SUB_AGENT_GET_BY_ID_FAILED', 'Failed to get sub-agent by ID', {
          subAgentId,
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }

  /**
   * Get registry statistics
   */
  getStats() {
    const capabilityStats = new Map<string, number>();

    for (const [capabilityType, agentIds] of this.capabilityIndex) {
      capabilityStats.set(capabilityType, agentIds.size);
    }

    return {
      totalAgents: this.agents.size,
      totalCapabilityTypes: this.capabilityIndex.size,
      capabilityCounts: Object.fromEntries(capabilityStats),
      registeredAgents: Array.from(this.agents.keys()),
    };
  }

  // Helper methods

  private getCandidateAgentIds(taskType: string): string[] {
    const candidateIds = new Set<string>();

    // Direct capability type match
    const directMatch = this.capabilityIndex.get(taskType);
    if (directMatch) {
      for (const agentId of directMatch) {
        candidateIds.add(agentId);
      }
    }

    // Fuzzy matching for related capabilities
    for (const [capabilityType, agentIds] of this.capabilityIndex) {
      if (this.isCapabilityRelated(taskType, capabilityType)) {
        for (const agentId of agentIds) {
          candidateIds.add(agentId);
        }
      }
    }

    return Array.from(candidateIds);
  }

  private isCapabilityRelated(taskType: string, capabilityType: string): boolean {
    // Simple fuzzy matching - could be enhanced with more sophisticated algorithms
    const taskWords = taskType.toLowerCase().split(/[_\s]+/);
    const capabilityWords = capabilityType.toLowerCase().split(/[_\s]+/);

    // Check for word overlap
    const overlap = taskWords.some((word) =>
      capabilityWords.some((capWord) => word.includes(capWord) || capWord.includes(word))
    );

    return overlap;
  }

  private findBestMatchingCapability(
    agent: ISubAgent,
    task: SubAgentTask
  ): SubAgentCapability | null {
    let bestCapability: SubAgentCapability | null = null;
    let bestScore = 0;

    for (const capability of agent.capabilities) {
      let score = 0;

      // Exact type match
      if (capability.type === task.type) {
        score += 1.0;
      }

      // Domain relevance (if task has context about domains)
      if (capability.domains) {
        const taskDescription = task.description.toLowerCase();
        for (const domain of capability.domains) {
          if (taskDescription.includes(domain.toLowerCase())) {
            score += 0.3;
          }
        }
      }

      // Workflow pattern compatibility
      if (capability.workflowPatterns && task.context.workflowId) {
        // Would need workflow context to properly evaluate
        score += 0.2;
      }

      // Factor in capability confidence
      score *= capability.confidence;

      if (score > bestScore) {
        bestScore = score;
        bestCapability = capability;
      }
    }

    return bestCapability;
  }

  /**
   * Cleanup the registry
   */
  async cleanup(): Promise<Result<void, QiError>> {
    try {
      this.logger.info('Starting registry cleanup', { totalAgents: this.agents.size });

      // Cleanup all registered agents
      const cleanupPromises = Array.from(this.agents.values()).map(async (agent) => {
        try {
          const cleanupResult = await agent.cleanup();
          match(
            () => this.logger.debug('Agent cleanup successful', { agentId: agent.id }),
            (error) =>
              this.logger.warn('Agent cleanup failed', {
                agentId: agent.id,
                error: error.message,
              }),
            cleanupResult
          );
        } catch (error) {
          this.logger.warn('Exception during agent cleanup', {
            agentId: agent.id,
            error: error instanceof Error ? error.message : String(error),
          });
        }
      });

      await Promise.allSettled(cleanupPromises);

      // Clear all registrations
      this.agents.clear();
      this.capabilityIndex.clear();

      this.logger.info('Registry cleanup completed');
      return success(undefined);
    } catch (error) {
      return failure(
        createRegistryError('REGISTRY_CLEANUP_FAILED', 'Failed to cleanup registry', {
          error: error instanceof Error ? error.message : String(error),
        })
      );
    }
  }
}
