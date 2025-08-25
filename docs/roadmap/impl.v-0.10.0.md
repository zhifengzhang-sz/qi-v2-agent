# qi-v2-agent v-0.10.0 Implementation Guide
## QiCore Foundation & Basic Agent Structure

**Document Version**: 1.0  
**Date**: 2025-01-23  
**Status**: Implementation Specification  
**Classification**: Technical Foundation  

## Executive Summary

This document provides the foundational implementation for qi-v2-agent v-0.10.0, focusing on proper QiCore integration patterns, error handling architecture, and basic agent structure. This serves as the critical foundation that all subsequent v-0.10.x implementations will build upon.

## Prerequisites

- ✅ v-0.8.x: Enhanced State Manager, Context Manager, Model Manager, MCP Client
- ✅ v-0.9.x: Enhanced Workflow System with intelligent pattern selection
- ✅ QiCore knowledge: Result<T> patterns, error handling, functional composition

## Architecture Overview

### QiCore Integration Strategy

**Core Philosophy**: Every operation returns `Result<T, QiError>` - no exceptions thrown, only structured error handling.

```typescript
// Foundation Pattern: All operations return Result<T, QiError>
type AgentOperation<T> = Promise<Result<T, QiError>>;

// Success and failure creation
import { success, failure } from '@qi/base';

// Functional composition with flatMap/map
import { flatMap, map, match } from '@qi/base';

// Error creation utilities
import { systemError, validationError, networkError, businessError } from '@qi/base';
```

### Error Handling Architecture

Based on Claude Code's comprehensive error system, we implement structured error categories:

```typescript
// lib/src/agent/errors/AgentErrorSystem.ts
export enum AgentErrorCategory {
  SYSTEM = 'SYSTEM',
  VALIDATION = 'VALIDATION', 
  NETWORK = 'NETWORK',
  BUSINESS = 'BUSINESS',
  RESOURCE = 'RESOURCE',
  SECURITY = 'SECURITY',
  COORDINATION = 'COORDINATION',
  LEARNING = 'LEARNING'
}

export interface AgentErrorContext {
  category: AgentErrorCategory;
  operation: string;
  componentId: string;
  timestamp: string;
  recoverable: boolean;
  retryable: boolean;
  metadata?: Record<string, unknown>;
}

// Error creation utilities for agent operations
export const createAgentError = {
  system: (message: string, context: Partial<AgentErrorContext> = {}): QiError =>
    systemError(message, {
      category: AgentErrorCategory.SYSTEM,
      operation: context.operation || 'unknown',
      componentId: context.componentId || 'agent',
      timestamp: new Date().toISOString(),
      recoverable: context.recoverable ?? false,
      retryable: context.retryable ?? false,
      ...context.metadata
    }),
    
  validation: (message: string, context: Partial<AgentErrorContext> = {}): QiError =>
    validationError(message, {
      category: AgentErrorCategory.VALIDATION,
      operation: context.operation || 'validation',
      componentId: context.componentId || 'agent',
      timestamp: new Date().toISOString(),
      recoverable: context.recoverable ?? true,
      retryable: context.retryable ?? false,
      ...context.metadata
    }),
    
  network: (message: string, context: Partial<AgentErrorContext> = {}): QiError =>
    networkError(message, {
      category: AgentErrorCategory.NETWORK,
      operation: context.operation || 'network',
      componentId: context.componentId || 'agent',
      timestamp: new Date().toISOString(),
      recoverable: context.recoverable ?? true,
      retryable: context.retryable ?? true,
      ...context.metadata
    }),
    
  business: (message: string, context: Partial<AgentErrorContext> = {}): QiError =>
    businessError(message, {
      category: AgentErrorCategory.BUSINESS,
      operation: context.operation || 'business-logic',
      componentId: context.componentId || 'agent',
      timestamp: new Date().toISOString(),
      recoverable: context.recoverable ?? true,
      retryable: context.retryable ?? false,
      ...context.metadata
    })
};
```

## Module 1: Agent Configuration System

### QiCore-Based Configuration

```typescript
// lib/src/agent/config/AgentConfiguration.ts
import { ConfigBuilder, type ValidatedConfig } from '@qi/core';
import { success, failure, type Result, flatMap } from '@qi/base';
import { z } from 'zod';
import { createAgentError } from '../errors/AgentErrorSystem';

// Configuration schema with comprehensive validation
const AgentConfigurationSchema = z.object({
  agentId: z.string().min(1, 'Agent ID is required'),
  name: z.string().min(1, 'Agent name is required'),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, 'Version must follow semver format'),
  
  // Capabilities configuration
  capabilities: z.object({
    decisionMaking: z.boolean().default(true),
    multiAgent: z.boolean().default(false),
    goalManagement: z.boolean().default(false),
    learning: z.boolean().default(false),
    advancedReasoning: z.boolean().default(false)
  }),
  
  // Performance configuration
  performance: z.object({
    maxConcurrentOperations: z.number().min(1).max(10).default(3),
    operationTimeoutMs: z.number().min(1000).max(300000).default(30000),
    memoryLimitMB: z.number().min(64).max(4096).default(512),
    maxRetryAttempts: z.number().min(0).max(5).default(3)
  }),
  
  // Logging configuration
  logging: z.object({
    level: z.enum(['debug', 'info', 'warn', 'error']).default('info'),
    enableStructuredLogging: z.boolean().default(true),
    enablePerformanceLogging: z.boolean().default(true),
    logToFile: z.boolean().default(false),
    logFilePath: z.string().optional()
  }),
  
  // Integration configuration
  integrations: z.object({
    mcpEnabled: z.boolean().default(true),
    mcpServers: z.array(z.string()).default([]),
    workflowSystemEnabled: z.boolean().default(true),
    memorySystemEnabled: z.boolean().default(true)
  }),
  
  // Security configuration
  security: z.object({
    enableSandboxing: z.boolean().default(true),
    maxResourceUsage: z.object({
      cpuPercent: z.number().min(1).max(100).default(50),
      memoryMB: z.number().min(64).max(2048).default(256)
    }),
    allowedOperations: z.array(z.string()).default([
      'read', 'write', 'edit', 'bash', 'webfetch'
    ])
  })
});

export type AgentConfiguration = z.infer<typeof AgentConfigurationSchema>;

// Configuration manager with proper QiCore patterns
export class AgentConfigurationManager {
  constructor(private configPath?: string) {}

  async loadConfiguration(): Promise<Result<AgentConfiguration, QiError>> {
    try {
      // Build configuration using QiCore ConfigBuilder
      const configResult = await (this.configPath 
        ? this.loadFromFile()
        : this.loadFromEnvironment()
      );
      
      return flatMap(
        (config: ValidatedConfig<AgentConfiguration>) => {
          // Validate configuration using Zod schema
          const validation = AgentConfigurationSchema.safeParse(config);
          
          if (!validation.success) {
            return failure(createAgentError.validation(
              `Configuration validation failed: ${validation.error.message}`,
              { 
                operation: 'loadConfiguration',
                componentId: 'AgentConfigurationManager',
                metadata: { 
                  validationErrors: validation.error.errors,
                  configPath: this.configPath 
                }
              }
            ));
          }
          
          return success(validation.data);
        },
        configResult
      );
      
    } catch (error) {
      return failure(createAgentError.system(
        `Failed to load agent configuration: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'loadConfiguration',
          componentId: 'AgentConfigurationManager',
          recoverable: true,
          retryable: true,
          metadata: { 
            configPath: this.configPath,
            originalError: error instanceof Error ? error.stack : String(error)
          }
        }
      ));
    }
  }

  private async loadFromFile(): Promise<Result<ValidatedConfig<AgentConfiguration>, QiError>> {
    if (!this.configPath) {
      return failure(createAgentError.validation(
        'Configuration file path is required',
        { 
          operation: 'loadFromFile',
          componentId: 'AgentConfigurationManager'
        }
      ));
    }

    return await ConfigBuilder
      .fromYamlFile(this.configPath)
      .then(builder => flatMap(
        b => b.merge(ConfigBuilder.fromEnv('AGENT_')).build(),
        builder
      ));
  }

  private async loadFromEnvironment(): Promise<Result<ValidatedConfig<AgentConfiguration>, QiError>> {
    return await ConfigBuilder
      .fromEnv('AGENT_')
      .then(builder => flatMap(
        b => b.build(),
        builder
      ));
  }

  // Create default configuration template
  static createDefaultConfiguration(): AgentConfiguration {
    return {
      agentId: `agent-${Date.now()}`,
      name: 'qi-agent',
      version: '0.10.0',
      capabilities: {
        decisionMaking: true,
        multiAgent: false,
        goalManagement: false,
        learning: false,
        advancedReasoning: false
      },
      performance: {
        maxConcurrentOperations: 3,
        operationTimeoutMs: 30000,
        memoryLimitMB: 512,
        maxRetryAttempts: 3
      },
      logging: {
        level: 'info',
        enableStructuredLogging: true,
        enablePerformanceLogging: true,
        logToFile: false
      },
      integrations: {
        mcpEnabled: true,
        mcpServers: [],
        workflowSystemEnabled: true,
        memorySystemEnabled: true
      },
      security: {
        enableSandboxing: true,
        maxResourceUsage: {
          cpuPercent: 50,
          memoryMB: 256
        },
        allowedOperations: ['read', 'write', 'edit', 'bash', 'webfetch']
      }
    };
  }

  // Configuration validation utilities
  async validateConfiguration(config: unknown): Promise<Result<AgentConfiguration, QiError>> {
    const validation = AgentConfigurationSchema.safeParse(config);
    
    if (!validation.success) {
      return failure(createAgentError.validation(
        `Configuration validation failed: ${validation.error.message}`,
        {
          operation: 'validateConfiguration',
          componentId: 'AgentConfigurationManager',
          metadata: { 
            validationErrors: validation.error.errors 
          }
        }
      ));
    }
    
    return success(validation.data);
  }
}
```

## Module 2: QiCore Logger Integration

### Structured Logging with Error Recovery

```typescript
// lib/src/agent/logging/AgentLogger.ts
import { createLogger, type Logger } from '@qi/core';
import { success, failure, type Result, match } from '@qi/base';
import { createAgentError } from '../errors/AgentErrorSystem';
import type { AgentConfiguration } from '../config/AgentConfiguration';

// Enhanced logging metadata for agent operations
export interface AgentLogMetadata {
  agentId: string;
  operation: string;
  component: string;
  timestamp: string;
  executionId?: string;
  performanceMs?: number;
  memoryUsageMB?: number;
  errorCategory?: string;
  [key: string]: unknown;
}

// Metadata builder for fluent log context construction
export class AgentLogMetadataBuilder {
  private metadata: Partial<AgentLogMetadata> = {};

  constructor(agentId: string, component: string) {
    this.metadata = {
      agentId,
      component,
      timestamp: new Date().toISOString()
    };
  }

  operation(operation: string): this {
    this.metadata.operation = operation;
    return this;
  }

  execution(executionId: string): this {
    this.metadata.executionId = executionId;
    return this;
  }

  performance(durationMs: number, memoryMB?: number): this {
    this.metadata.performanceMs = durationMs;
    if (memoryMB) {
      this.metadata.memoryUsageMB = memoryMB;
    }
    return this;
  }

  error(category: string): this {
    this.metadata.errorCategory = category;
    return this;
  }

  custom(key: string, value: unknown): this {
    this.metadata[key] = value;
    return this;
  }

  build(): AgentLogMetadata {
    if (!this.metadata.operation) {
      this.metadata.operation = 'unknown';
    }
    return this.metadata as AgentLogMetadata;
  }
}

// QiCore Logger wrapper with graceful fallback
export class AgentLogger {
  private logger: Logger | null = null;
  private fallbackEnabled = true;
  private readonly agentId: string;
  private readonly componentId: string;

  constructor(agentId: string, componentId: string) {
    this.agentId = agentId;
    this.componentId = componentId;
  }

  // Initialize logger with QiCore, fallback to console on failure
  async initialize(config: AgentConfiguration): Promise<Result<void, QiError>> {
    const loggerResult = createLogger({
      name: `qi-agent-${this.agentId}`,
      level: config.logging.level,
      pretty: !config.logging.enableStructuredLogging,
      destination: config.logging.logToFile && config.logging.logFilePath 
        ? config.logging.logFilePath 
        : undefined
    });

    return match(
      (logger: Logger) => {
        this.logger = logger;
        this.logInfo('Logger initialized successfully', 
          this.createMetadata().operation('initialize').build()
        );
        return success(undefined);
      },
      (error) => {
        // Fallback to console logging
        this.fallbackEnabled = true;
        console.warn(`Failed to initialize QiCore logger, falling back to console: ${error.message}`);
        return success(undefined); // Don't fail agent initialization due to logging issues
      },
      loggerResult
    );
  }

  // Structured logging methods with metadata
  logDebug(message: string, metadata?: AgentLogMetadata): void {
    this.log('debug', message, metadata);
  }

  logInfo(message: string, metadata?: AgentLogMetadata): void {
    this.log('info', message, metadata);
  }

  logWarn(message: string, metadata?: AgentLogMetadata): void {
    this.log('warn', message, metadata);
  }

  logError(message: string, metadata?: AgentLogMetadata): void {
    this.log('error', message, metadata);
  }

  // Performance logging utility
  logPerformance(operation: string, durationMs: number, success: boolean, metadata?: Partial<AgentLogMetadata>): void {
    const perfMetadata = this.createMetadata()
      .operation(operation)
      .performance(durationMs)
      .custom('success', success)
      .custom('performanceCategory', this.categorizePerformance(durationMs))
      .build();

    // Merge additional metadata
    const finalMetadata = { ...perfMetadata, ...metadata };

    this.log(
      success && durationMs < 5000 ? 'info' : 'warn',
      `Operation ${operation} completed in ${durationMs}ms`,
      finalMetadata
    );
  }

  // Error logging with structured error information
  logAgentError(error: QiError, additionalContext?: Record<string, unknown>): void {
    const errorMetadata = this.createMetadata()
      .operation('error-handling')
      .error(error.category || 'unknown')
      .custom('errorCode', error.code)
      .custom('errorMessage', error.message)
      .custom('errorContext', error.context)
      .custom('additionalContext', additionalContext)
      .build();

    this.logError(`Agent error: ${error.message}`, errorMetadata);
  }

  // Create metadata builder for this logger instance
  createMetadata(): AgentLogMetadataBuilder {
    return new AgentLogMetadataBuilder(this.agentId, this.componentId);
  }

  // Core logging implementation with fallback
  private log(level: 'debug' | 'info' | 'warn' | 'error', message: string, metadata?: AgentLogMetadata): void {
    if (this.logger) {
      try {
        // Use QiCore logger with structured metadata
        this.logger[level](metadata ? { ...metadata, message } : message);
      } catch (error) {
        // Fallback to console if QiCore logger fails
        this.fallbackLog(level, message, metadata, error);
      }
    } else if (this.fallbackEnabled) {
      this.fallbackLog(level, message, metadata);
    }
  }

  private fallbackLog(level: string, message: string, metadata?: AgentLogMetadata, originalError?: unknown): void {
    const timestamp = new Date().toISOString();
    const logEntry = {
      timestamp,
      level: level.toUpperCase(),
      agentId: this.agentId,
      component: this.componentId,
      message,
      ...(metadata && { metadata }),
      ...(originalError && { loggerError: originalError instanceof Error ? originalError.message : String(originalError) })
    };

    console.log(JSON.stringify(logEntry, null, 2));
  }

  private categorizePerformance(durationMs: number): string {
    if (durationMs < 100) return 'fast';
    if (durationMs < 1000) return 'normal';
    if (durationMs < 5000) return 'slow';
    return 'very-slow';
  }
}
```

## Module 3: Basic Agent Abstractions

### Core Agent Interface

```typescript
// lib/src/agent/abstractions/IAgent.ts
import type { Result } from '@qi/base';
import type { QiError } from '@qi/base';
import type { AgentConfiguration } from '../config/AgentConfiguration';

// Basic agent context for all operations
export interface AgentContext {
  agentId: string;
  executionId: string;
  startTime: Date;
  configuration: AgentConfiguration;
  metadata: Record<string, unknown>;
}

// Agent initialization result
export interface AgentInitializationResult {
  agentId: string;
  version: string;
  capabilities: string[];
  status: 'initialized' | 'initializing' | 'failed';
  initializationTime: number;
}

// Agent operation result base interface
export interface AgentOperationResult<T = unknown> {
  success: boolean;
  result?: T;
  executionTime: number;
  resourceUsage?: {
    memoryMB: number;
    cpuPercent: number;
  };
  metadata: Record<string, unknown>;
}

// Core agent interface
export interface IAgent {
  // Agent lifecycle
  initialize(config: AgentConfiguration): Promise<Result<AgentInitializationResult, QiError>>;
  shutdown(): Promise<Result<void, QiError>>;
  isInitialized(): boolean;
  
  // Agent information
  getId(): string;
  getConfiguration(): AgentConfiguration;
  getCapabilities(): string[];
  
  // Basic operations
  executeOperation<T>(
    operation: string,
    params: Record<string, unknown>,
    context?: Partial<AgentContext>
  ): Promise<Result<AgentOperationResult<T>, QiError>>;
  
  // Health and monitoring
  getHealth(): Promise<Result<AgentHealthStatus, QiError>>;
  getMetrics(): Promise<Result<AgentMetrics, QiError>>;
}

// Agent health status
export interface AgentHealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy';
  checks: HealthCheck[];
  lastChecked: Date;
}

export interface HealthCheck {
  name: string;
  status: 'pass' | 'fail' | 'warn';
  message?: string;
  duration: number;
}

// Agent metrics
export interface AgentMetrics {
  operationsCount: number;
  successRate: number;
  averageExecutionTime: number;
  memoryUsage: number;
  uptime: number;
  lastActivity: Date;
}
```

### Base Agent Implementation

```typescript
// lib/src/agent/impl/BaseAgent.ts
import { success, failure, flatMap, match } from '@qi/base';
import { createAgentError } from '../errors/AgentErrorSystem';
import { AgentLogger } from '../logging/AgentLogger';
import { AgentConfigurationManager } from '../config/AgentConfiguration';
import type { 
  IAgent, 
  AgentContext, 
  AgentInitializationResult,
  AgentOperationResult,
  AgentHealthStatus,
  AgentMetrics,
  HealthCheck
} from '../abstractions/IAgent';
import type { AgentConfiguration } from '../config/AgentConfiguration';
import type { Result, QiError } from '@qi/base';

export abstract class BaseAgent implements IAgent {
  protected agentId: string;
  protected configuration: AgentConfiguration | null = null;
  protected logger: AgentLogger;
  protected initialized = false;
  protected startTime: Date | null = null;
  protected operationCount = 0;
  protected successCount = 0;
  protected totalExecutionTime = 0;

  constructor(agentId?: string) {
    this.agentId = agentId || `agent-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    this.logger = new AgentLogger(this.agentId, this.constructor.name);
  }

  async initialize(config: AgentConfiguration): Promise<Result<AgentInitializationResult, QiError>> {
    const startTime = Date.now();
    
    try {
      // Store configuration
      this.configuration = config;
      
      // Initialize logger
      const loggerResult = await this.logger.initialize(config);
      if (loggerResult.tag === 'failure') {
        return failure(createAgentError.system(
          `Failed to initialize logger: ${loggerResult.error.message}`,
          {
            operation: 'initialize',
            componentId: this.constructor.name,
            recoverable: false
          }
        ));
      }

      this.logger.logInfo('Starting agent initialization', 
        this.logger.createMetadata().operation('initialize').build()
      );

      // Validate configuration
      const configManager = new AgentConfigurationManager();
      const validationResult = await configManager.validateConfiguration(config);
      if (validationResult.tag === 'failure') {
        return failure(validationResult.error);
      }

      // Perform agent-specific initialization
      const specificInitResult = await this.performSpecificInitialization(config);
      if (specificInitResult.tag === 'failure') {
        return failure(specificInitResult.error);
      }

      // Mark as initialized
      this.initialized = true;
      this.startTime = new Date();
      
      const initializationTime = Date.now() - startTime;
      const result: AgentInitializationResult = {
        agentId: this.agentId,
        version: config.version,
        capabilities: this.getCapabilities(),
        status: 'initialized',
        initializationTime
      };

      this.logger.logInfo('Agent initialization completed successfully', 
        this.logger.createMetadata()
          .operation('initialize')
          .performance(initializationTime)
          .custom('capabilities', this.getCapabilities())
          .build()
      );

      return success(result);

    } catch (error) {
      const initializationTime = Date.now() - startTime;
      
      this.logger.logError('Agent initialization failed', 
        this.logger.createMetadata()
          .operation('initialize')
          .performance(initializationTime)
          .custom('error', error instanceof Error ? error.message : String(error))
          .build()
      );

      return failure(createAgentError.system(
        `Agent initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'initialize',
          componentId: this.constructor.name,
          recoverable: false,
          metadata: {
            initializationTime,
            originalError: error instanceof Error ? error.stack : String(error)
          }
        }
      ));
    }
  }

  async shutdown(): Promise<Result<void, QiError>> {
    if (!this.initialized) {
      return failure(createAgentError.validation(
        'Cannot shutdown agent that is not initialized',
        {
          operation: 'shutdown',
          componentId: this.constructor.name
        }
      ));
    }

    try {
      this.logger.logInfo('Starting agent shutdown', 
        this.logger.createMetadata().operation('shutdown').build()
      );

      // Perform agent-specific cleanup
      const cleanupResult = await this.performSpecificCleanup();
      if (cleanupResult.tag === 'failure') {
        this.logger.logError('Agent-specific cleanup failed', 
          this.logger.createMetadata()
            .operation('shutdown')
            .custom('error', cleanupResult.error.message)
            .build()
        );
        // Continue with shutdown even if specific cleanup fails
      }

      // Mark as not initialized
      this.initialized = false;
      
      this.logger.logInfo('Agent shutdown completed', 
        this.logger.createMetadata().operation('shutdown').build()
      );

      return success(undefined);

    } catch (error) {
      return failure(createAgentError.system(
        `Agent shutdown failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'shutdown',
          componentId: this.constructor.name,
          metadata: {
            originalError: error instanceof Error ? error.stack : String(error)
          }
        }
      ));
    }
  }

  isInitialized(): boolean {
    return this.initialized;
  }

  getId(): string {
    return this.agentId;
  }

  getConfiguration(): AgentConfiguration {
    if (!this.configuration) {
      throw new Error('Agent not initialized - configuration not available');
    }
    return this.configuration;
  }

  abstract getCapabilities(): string[];

  async executeOperation<T>(
    operation: string,
    params: Record<string, unknown>,
    context?: Partial<AgentContext>
  ): Promise<Result<AgentOperationResult<T>, QiError>> {
    if (!this.initialized || !this.configuration) {
      return failure(createAgentError.validation(
        'Agent must be initialized before executing operations',
        {
          operation: 'executeOperation',
          componentId: this.constructor.name
        }
      ));
    }

    const startTime = Date.now();
    const executionId = `exec-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    
    // Create full context
    const fullContext: AgentContext = {
      agentId: this.agentId,
      executionId,
      startTime: new Date(startTime),
      configuration: this.configuration,
      metadata: {},
      ...context
    };

    this.operationCount++;

    try {
      this.logger.logDebug(`Executing operation: ${operation}`, 
        this.logger.createMetadata()
          .operation(operation)
          .execution(executionId)
          .custom('params', params)
          .build()
      );

      // Execute the specific operation
      const operationResult = await this.performOperation<T>(operation, params, fullContext);

      const executionTime = Date.now() - startTime;
      this.totalExecutionTime += executionTime;

      return match(
        (result: T) => {
          this.successCount++;
          
          const operationResult: AgentOperationResult<T> = {
            success: true,
            result,
            executionTime,
            resourceUsage: this.getCurrentResourceUsage(),
            metadata: {
              executionId,
              operation,
              agentId: this.agentId
            }
          };

          this.logger.logPerformance(operation, executionTime, true, {
            executionId,
            resultType: typeof result
          });

          return success(operationResult);
        },
        (error: QiError) => {
          const operationResult: AgentOperationResult<T> = {
            success: false,
            executionTime,
            resourceUsage: this.getCurrentResourceUsage(),
            metadata: {
              executionId,
              operation,
              agentId: this.agentId,
              error: {
                code: error.code,
                message: error.message,
                category: error.category
              }
            }
          };

          this.logger.logPerformance(operation, executionTime, false, {
            executionId,
            errorCode: error.code,
            errorCategory: error.category
          });

          return success(operationResult);
        },
        operationResult
      );

    } catch (error) {
      const executionTime = Date.now() - startTime;
      
      const operationResult: AgentOperationResult<T> = {
        success: false,
        executionTime,
        resourceUsage: this.getCurrentResourceUsage(),
        metadata: {
          executionId,
          operation,
          agentId: this.agentId,
          unexpectedError: error instanceof Error ? error.message : String(error)
        }
      };

      this.logger.logError(`Unexpected error in operation ${operation}`, 
        this.logger.createMetadata()
          .operation(operation)
          .execution(executionId)
          .performance(executionTime)
          .error('SYSTEM')
          .custom('unexpectedError', error instanceof Error ? error.message : String(error))
          .build()
      );

      return success(operationResult);
    }
  }

  async getHealth(): Promise<Result<AgentHealthStatus, QiError>> {
    try {
      const checks: HealthCheck[] = [];
      
      // Basic initialization check
      checks.push({
        name: 'initialization',
        status: this.initialized ? 'pass' : 'fail',
        message: this.initialized ? 'Agent is initialized' : 'Agent not initialized',
        duration: 0
      });

      // Configuration check
      checks.push({
        name: 'configuration',
        status: this.configuration ? 'pass' : 'fail',
        message: this.configuration ? 'Configuration loaded' : 'No configuration',
        duration: 0
      });

      // Performance check
      const avgExecutionTime = this.operationCount > 0 ? this.totalExecutionTime / this.operationCount : 0;
      checks.push({
        name: 'performance',
        status: avgExecutionTime < 5000 ? 'pass' : avgExecutionTime < 10000 ? 'warn' : 'fail',
        message: `Average execution time: ${avgExecutionTime.toFixed(2)}ms`,
        duration: avgExecutionTime
      });

      // Add agent-specific health checks
      const specificChecks = await this.performSpecificHealthChecks();
      checks.push(...specificChecks);

      // Determine overall status
      const failCount = checks.filter(c => c.status === 'fail').length;
      const warnCount = checks.filter(c => c.status === 'warn').length;
      
      const status = failCount > 0 ? 'unhealthy' : warnCount > 0 ? 'degraded' : 'healthy';

      return success({
        status,
        checks,
        lastChecked: new Date()
      });

    } catch (error) {
      return failure(createAgentError.system(
        `Failed to get health status: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'getHealth',
          componentId: this.constructor.name
        }
      ));
    }
  }

  async getMetrics(): Promise<Result<AgentMetrics, QiError>> {
    try {
      const uptime = this.startTime ? Date.now() - this.startTime.getTime() : 0;
      const successRate = this.operationCount > 0 ? (this.successCount / this.operationCount) * 100 : 0;
      const averageExecutionTime = this.operationCount > 0 ? this.totalExecutionTime / this.operationCount : 0;

      return success({
        operationsCount: this.operationCount,
        successRate,
        averageExecutionTime,
        memoryUsage: this.getCurrentResourceUsage()?.memoryMB || 0,
        uptime,
        lastActivity: new Date()
      });

    } catch (error) {
      return failure(createAgentError.system(
        `Failed to get metrics: ${error instanceof Error ? error.message : 'Unknown error'}`,
        {
          operation: 'getMetrics',
          componentId: this.constructor.name
        }
      ));
    }
  }

  // Abstract methods for agent-specific implementation
  protected abstract performSpecificInitialization(config: AgentConfiguration): Promise<Result<void, QiError>>;
  protected abstract performSpecificCleanup(): Promise<Result<void, QiError>>;
  protected abstract performOperation<T>(
    operation: string,
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<Result<T, QiError>>;
  protected abstract performSpecificHealthChecks(): Promise<HealthCheck[]>;

  // Utility methods
  protected getCurrentResourceUsage(): { memoryMB: number; cpuPercent: number } | undefined {
    try {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const memUsage = process.memoryUsage();
        return {
          memoryMB: Math.round(memUsage.heapUsed / 1024 / 1024),
          cpuPercent: 0 // CPU usage would require additional monitoring
        };
      }
    } catch {
      // Ignore errors in resource usage calculation
    }
    return undefined;
  }
}
```

## Module 4: Foundation Testing Patterns

### Result<T> Testing Utilities

```typescript
// lib/src/agent/testing/AgentTestUtils.ts
import { match, type Result, type QiError } from '@qi/base';
import { expect } from 'vitest';

// Test utilities for Result<T> patterns
export class AgentTestUtils {
  // Assert that a Result<T> is successful and extract the value
  static expectSuccess<T>(result: Result<T, QiError>): T {
    return match(
      (value: T) => {
        expect(result.tag).toBe('success');
        return value;
      },
      (error: QiError) => {
        throw new Error(`Expected success but got failure: ${error.message}`);
      },
      result
    );
  }

  // Assert that a Result<T> is a failure and extract the error
  static expectFailure<T>(result: Result<T, QiError>): QiError {
    return match(
      (value: T) => {
        throw new Error(`Expected failure but got success: ${JSON.stringify(value)}`);
      },
      (error: QiError) => {
        expect(result.tag).toBe('failure');
        return error;
      },
      result
    );
  }

  // Assert error category
  static expectErrorCategory<T>(result: Result<T, QiError>, expectedCategory: string): QiError {
    const error = this.expectFailure(result);
    expect(error.category).toBe(expectedCategory);
    return error;
  }

  // Create mock agent configuration for testing
  static createMockAgentConfiguration(overrides?: Partial<AgentConfiguration>): AgentConfiguration {
    return {
      agentId: 'test-agent',
      name: 'Test Agent',
      version: '0.10.0',
      capabilities: {
        decisionMaking: true,
        multiAgent: false,
        goalManagement: false,
        learning: false,
        advancedReasoning: false
      },
      performance: {
        maxConcurrentOperations: 3,
        operationTimeoutMs: 5000,
        memoryLimitMB: 128,
        maxRetryAttempts: 2
      },
      logging: {
        level: 'error', // Reduce logging noise in tests
        enableStructuredLogging: false,
        enablePerformanceLogging: false,
        logToFile: false
      },
      integrations: {
        mcpEnabled: false,
        mcpServers: [],
        workflowSystemEnabled: false,
        memorySystemEnabled: false
      },
      security: {
        enableSandboxing: false,
        maxResourceUsage: {
          cpuPercent: 25,
          memoryMB: 64
        },
        allowedOperations: ['test']
      },
      ...overrides
    };
  }
}

// Test implementation of BaseAgent for testing
export class TestAgent extends BaseAgent {
  private initializationDelay: number;
  private shouldFailInitialization: boolean;
  private operationResults: Map<string, Result<unknown, QiError>>;

  constructor(agentId?: string, options?: {
    initializationDelay?: number;
    shouldFailInitialization?: boolean;
  }) {
    super(agentId);
    this.initializationDelay = options?.initializationDelay || 0;
    this.shouldFailInitialization = options?.shouldFailInitialization || false;
    this.operationResults = new Map();
  }

  getCapabilities(): string[] {
    return ['test-operation', 'slow-operation', 'failing-operation'];
  }

  // Set predefined result for an operation (for testing)
  setOperationResult<T>(operation: string, result: Result<T, QiError>): void {
    this.operationResults.set(operation, result);
  }

  protected async performSpecificInitialization(config: AgentConfiguration): Promise<Result<void, QiError>> {
    if (this.initializationDelay > 0) {
      await new Promise(resolve => setTimeout(resolve, this.initializationDelay));
    }

    if (this.shouldFailInitialization) {
      return failure(createAgentError.system(
        'Test initialization failure',
        {
          operation: 'performSpecificInitialization',
          componentId: 'TestAgent',
          recoverable: false
        }
      ));
    }

    return success(undefined);
  }

  protected async performSpecificCleanup(): Promise<Result<void, QiError>> {
    // Clear operation results
    this.operationResults.clear();
    return success(undefined);
  }

  protected async performOperation<T>(
    operation: string,
    params: Record<string, unknown>,
    context: AgentContext
  ): Promise<Result<T, QiError>> {
    // Check for predefined result
    if (this.operationResults.has(operation)) {
      return this.operationResults.get(operation)! as Result<T, QiError>;
    }

    // Handle standard test operations
    switch (operation) {
      case 'test-operation':
        return success({ operation, params, context } as T);
      
      case 'slow-operation':
        await new Promise(resolve => setTimeout(resolve, 1000));
        return success({ operation: 'slow-operation', duration: '1000ms' } as T);
      
      case 'failing-operation':
        return failure(createAgentError.business(
          'Test operation failure',
          {
            operation,
            componentId: 'TestAgent',
            metadata: { params }
          }
        ));
      
      default:
        return failure(createAgentError.validation(
          `Unknown operation: ${operation}`,
          {
            operation,
            componentId: 'TestAgent',
            metadata: { supportedOperations: this.getCapabilities() }
          }
        ));
    }
  }

  protected async performSpecificHealthChecks(): Promise<HealthCheck[]> {
    return [
      {
        name: 'test-capability',
        status: 'pass',
        message: 'Test agent is functioning normally',
        duration: 5
      }
    ];
  }
}
```

## Installation Dependencies

```bash
# Core QiCore dependencies (should already be installed from v-0.8.x)
npm install @qi/base@latest
npm install @qi/core@latest

# Configuration and validation
npm install zod@^3.22.4

# Testing utilities  
npm install --save-dev vitest@^1.0.0
npm install --save-dev @types/node@^20.0.0
```

## Testing Implementation

```typescript
// lib/src/agent/__tests__/BaseAgent.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AgentTestUtils, TestAgent } from '../testing/AgentTestUtils';
import { AgentConfigurationManager } from '../config/AgentConfiguration';

describe('BaseAgent', () => {
  let agent: TestAgent;
  let config: AgentConfiguration;

  beforeEach(() => {
    agent = new TestAgent('test-agent-001');
    config = AgentTestUtils.createMockAgentConfiguration();
  });

  describe('initialization', () => {
    it('should initialize successfully with valid configuration', async () => {
      const result = await agent.initialize(config);
      const initResult = AgentTestUtils.expectSuccess(result);
      
      expect(initResult.agentId).toBe('test-agent-001');
      expect(initResult.status).toBe('initialized');
      expect(initResult.capabilities).toContain('test-operation');
      expect(agent.isInitialized()).toBe(true);
    });

    it('should fail initialization with invalid configuration', async () => {
      const invalidConfig = { ...config, agentId: '' }; // Invalid empty agentId
      
      const result = await agent.initialize(invalidConfig as AgentConfiguration);
      const error = AgentTestUtils.expectFailure(result);
      
      expect(error.category).toBe('VALIDATION');
      expect(agent.isInitialized()).toBe(false);
    });

    it('should handle initialization delays', async () => {
      const slowAgent = new TestAgent('slow-agent', { initializationDelay: 100 });
      const startTime = Date.now();
      
      const result = await slowAgent.initialize(config);
      const initResult = AgentTestUtils.expectSuccess(result);
      
      const duration = Date.now() - startTime;
      expect(duration).toBeGreaterThanOrEqual(100);
      expect(initResult.initializationTime).toBeGreaterThanOrEqual(100);
    });
  });

  describe('operations', () => {
    beforeEach(async () => {
      await agent.initialize(config);
    });

    it('should execute test operation successfully', async () => {
      const result = await agent.executeOperation('test-operation', { param1: 'value1' });
      const opResult = AgentTestUtils.expectSuccess(result);
      
      expect(opResult.success).toBe(true);
      expect(opResult.result).toMatchObject({
        operation: 'test-operation',
        params: { param1: 'value1' }
      });
      expect(opResult.executionTime).toBeGreaterThan(0);
    });

    it('should handle failing operations gracefully', async () => {
      const result = await agent.executeOperation('failing-operation', {});
      const opResult = AgentTestUtils.expectSuccess(result);
      
      expect(opResult.success).toBe(false);
      expect(opResult.metadata.error).toMatchObject({
        category: 'BUSINESS',
        message: expect.stringContaining('Test operation failure')
      });
    });

    it('should track performance metrics', async () => {
      // Execute several operations
      await agent.executeOperation('test-operation', {});
      await agent.executeOperation('test-operation', {});
      await agent.executeOperation('failing-operation', {});

      const metricsResult = await agent.getMetrics();
      const metrics = AgentTestUtils.expectSuccess(metricsResult);
      
      expect(metrics.operationsCount).toBe(3);
      expect(metrics.successRate).toBeCloseTo(66.67, 1); // 2 success, 1 failure
      expect(metrics.averageExecutionTime).toBeGreaterThan(0);
    });
  });

  describe('health monitoring', () => {
    beforeEach(async () => {
      await agent.initialize(config);
    });

    it('should report healthy status for initialized agent', async () => {
      const healthResult = await agent.getHealth();
      const health = AgentTestUtils.expectSuccess(healthResult);
      
      expect(health.status).toBe('healthy');
      expect(health.checks).toContainEqual({
        name: 'initialization',
        status: 'pass',
        message: 'Agent is initialized',
        duration: 0
      });
    });

    it('should report unhealthy status for uninitialized agent', async () => {
      const uninitializedAgent = new TestAgent();
      
      const healthResult = await uninitializedAgent.getHealth();
      const health = AgentTestUtils.expectSuccess(healthResult);
      
      expect(health.status).toBe('unhealthy');
      const initCheck = health.checks.find(c => c.name === 'initialization');
      expect(initCheck?.status).toBe('fail');
    });
  });
});

describe('AgentConfigurationManager', () => {
  let configManager: AgentConfigurationManager;

  beforeEach(() => {
    configManager = new AgentConfigurationManager();
  });

  it('should validate valid configuration', async () => {
    const validConfig = AgentTestUtils.createMockAgentConfiguration();
    
    const result = await configManager.validateConfiguration(validConfig);
    const config = AgentTestUtils.expectSuccess(result);
    
    expect(config.agentId).toBe(validConfig.agentId);
    expect(config.version).toMatch(/^\d+\.\d+\.\d+$/);
  });

  it('should reject invalid configuration', async () => {
    const invalidConfig = {
      agentId: '',
      name: 'test',
      version: 'invalid-version'
    };
    
    const result = await configManager.validateConfiguration(invalidConfig);
    const error = AgentTestUtils.expectFailure(result);
    
    expect(error.category).toBe('VALIDATION');
    expect(error.message).toContain('validation failed');
  });

  it('should create default configuration', () => {
    const defaultConfig = AgentConfigurationManager.createDefaultConfiguration();
    
    expect(defaultConfig.agentId).toMatch(/^agent-\d+$/);
    expect(defaultConfig.name).toBe('qi-agent');
    expect(defaultConfig.version).toBe('0.10.0');
    expect(defaultConfig.capabilities.decisionMaking).toBe(true);
  });
});
```

## Performance Targets

### v-0.10.0 Foundation Performance Goals
- **Agent Initialization**: <500ms for basic configuration
- **Operation Execution**: <100ms average for simple operations
- **Error Handling Overhead**: <10ms additional processing time
- **Memory Usage**: <50MB base memory footprint
- **Configuration Loading**: <200ms for YAML/environment configuration

## Success Criteria

### Foundation Targets
- ✅ QiCore Result<T> patterns implemented throughout
- ✅ Comprehensive error handling with structured categories
- ✅ Agent configuration system with validation
- ✅ Structured logging with performance monitoring
- ✅ Base agent abstractions with health monitoring
- ✅ Complete testing framework with utilities

### Quality Targets
- ✅ Zero exceptions thrown (all operations return Result<T>)
- ✅ Comprehensive error recovery strategies
- ✅ Performance monitoring and metrics collection
- ✅ Production-ready logging and observability
- ✅ 100% test coverage for foundation components

---

**Next Steps**: This foundation enables the implementation of impl.v-0.10.1.md (Basic Decision Engine) with proper error handling, configuration management, and monitoring capabilities.