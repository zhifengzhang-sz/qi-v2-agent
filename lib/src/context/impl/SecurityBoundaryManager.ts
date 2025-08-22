/**
 * Security Boundary Manager Implementation
 *
 * Enforces security boundaries and access restrictions for isolated contexts
 */

import {
  create,
  failure,
  flatMap,
  fromAsyncTryCatch,
  map,
  match,
  type QiError,
  type Result,
  success,
} from '@qi/base';
import type {
  ContextAccessAudit,
  ISecurityBoundaryManager,
  IsolatedContext,
} from '../abstractions/index.js';

/**
 * Security-specific error factories using QiCore patterns
 */
const securityError = {
  contextNotFound: (contextId: string): QiError =>
    create('CONTEXT_NOT_FOUND', `Security context not found: ${contextId}`, 'AUTHORIZATION', {
      contextId,
    }),

  contextExists: (contextId: string): QiError =>
    create('CONTEXT_EXISTS', `Security context already exists: ${contextId}`, 'VALIDATION', {
      contextId,
    }),

  accessDenied: (contextId: string, operation: string): QiError =>
    create(
      'ACCESS_DENIED',
      `Access denied for context ${contextId}, operation: ${operation}`,
      'AUTHORIZATION',
      { contextId, operation }
    ),

  pathRestricted: (contextId: string, path: string): QiError =>
    create(
      'PATH_RESTRICTED',
      `Path access denied for context ${contextId}: ${path}`,
      'AUTHORIZATION',
      { contextId, path }
    ),

  toolRestricted: (contextId: string, tool: string): QiError =>
    create(
      'TOOL_RESTRICTED',
      `Tool access denied for context ${contextId}: ${tool}`,
      'AUTHORIZATION',
      { contextId, tool }
    ),

  commandRestricted: (contextId: string, command: string): QiError =>
    create(
      'COMMAND_RESTRICTED',
      `Command access denied for context ${contextId}: ${command}`,
      'AUTHORIZATION',
      { contextId, command }
    ),

  invalidContext: (reason: string): QiError =>
    create('INVALID_CONTEXT', `Invalid security context: ${reason}`, 'VALIDATION', { reason }),

  systemFailure: (operation: string, cause: string): QiError =>
    create(
      'SECURITY_SYSTEM_FAILURE',
      `Security system failure during ${operation}: ${cause}`,
      'SYSTEM',
      { operation, cause }
    ),
};

/**
 * Security boundary manager for context isolation
 */
export class SecurityBoundaryManager implements ISecurityBoundaryManager {
  private readonly contextRegistry = new Map<string, IsolatedContext>();
  private readonly violationCounts = new Map<string, number>();
  private readonly accessLog: Array<{
    contextId: string;
    operation: string;
    allowed: boolean;
    timestamp: Date;
    reason?: string;
  }> = [];
  // Logger functionality replaced with console for simplicity

  /**
   * Register a security context
   * @param contextId - Unique identifier for the context
   * @param context - Security context configuration
   * @returns Result<void> - Success or validation/system error
   */
  registerContext(contextId: string, context: IsolatedContext): Result<void> {
    // Input validation using QiCore patterns
    const validateInputs = (): Result<void> => {
      if (!contextId || typeof contextId !== 'string') {
        return failure(securityError.invalidContext('contextId must be a non-empty string'));
      }
      if (!context || typeof context !== 'object') {
        return failure(securityError.invalidContext('context must be a valid object'));
      }
      return success(undefined);
    };

    // Check for existing context
    const checkExisting = (): Result<void> => {
      if (this.contextRegistry.has(contextId)) {
        return failure(securityError.contextExists(contextId));
      }
      return success(undefined);
    };

    // Register the context using QiCore error handling
    const doRegister = (): Result<void> => {
      this.contextRegistry.set(contextId, context);
      this.violationCounts.set(contextId, 0);
      console.info(`Security context registered: ${contextId}`);
      return success(undefined);
    };

    // Functional composition chain
    return flatMap(() => flatMap(() => doRegister(), checkExisting()), validateInputs());
  }

  /**
   * Unregister a security context
   * @param contextId - Context identifier to remove
   * @returns Result<void> - Success or validation error if context not found
   */
  unregisterContext(contextId: string): Result<void> {
    const validateInput = (): Result<void> => {
      if (!contextId || typeof contextId !== 'string') {
        return failure(securityError.invalidContext('contextId must be a non-empty string'));
      }
      return success(undefined);
    };

    const checkExists = (): Result<void> => {
      if (!this.contextRegistry.has(contextId)) {
        return failure(securityError.contextNotFound(contextId));
      }
      return success(undefined);
    };

    const doUnregister = (): Result<void> => {
      // Map and Array operations are guaranteed not to throw - no try/catch needed
      this.contextRegistry.delete(contextId);
      this.violationCounts.delete(contextId);

      // Clean up access log entries older than 1 hour
      const cutoff = new Date(Date.now() - 3600000);
      this.accessLog.splice(
        0,
        this.accessLog.length,
        ...this.accessLog.filter(
          (entry) => entry.contextId !== contextId && entry.timestamp > cutoff
        )
      );

      console.info(`Security context unregistered: ${contextId}`);
      return success(undefined);
    };

    return flatMap(() => flatMap(() => doUnregister(), checkExists()), validateInput());
  }

  /**
   * Validate access for a specific operation
   * @param contextId - Context identifier
   * @param operation - Operation to validate
   * @returns Promise<Result<boolean>> - True if access granted, false if denied, or error
   */
  async validateAccess(contextId: string, operation: string): Promise<Result<boolean>> {
    // Get context with validation
    const getContext = (): Result<IsolatedContext> => {
      const context = this.contextRegistry.get(contextId);
      if (!context) {
        return failure(securityError.contextNotFound(contextId));
      }
      return success(context);
    };

    // Check context expiration
    const checkExpiration = (context: IsolatedContext): Result<IsolatedContext> => {
      if (new Date() > context.expiresAt) {
        this.logAccess(contextId, operation, false, 'Context expired');
        return success(context); // Continue with expired context to return false
      }
      return success(context);
    };

    // Check allowed operations
    const checkAllowedOperations = (context: IsolatedContext): Result<boolean> => {
      if (!context.allowedOperations.includes(operation)) {
        this.incrementViolation(contextId);
        this.logAccess(contextId, operation, false, 'Operation not allowed');
        return success(false);
      }
      return success(true);
    };

    // Validate specific operation with async handling
    const validateSpecificOperation = async (
      context: IsolatedContext
    ): Promise<Result<boolean>> => {
      return fromAsyncTryCatch(
        async () => {
          const validationResult = await this.validateSpecificOperation(context, operation);
          this.logAccess(contextId, operation, validationResult.allowed, validationResult.reason);

          if (!validationResult.allowed) {
            this.incrementViolation(contextId);
          }

          return validationResult.allowed;
        },
        (error) => securityError.systemFailure('operation validation', String(error))
      );
    };

    // Handle expired context case
    const handleValidation = async (context: IsolatedContext): Promise<Result<boolean>> => {
      if (new Date() > context.expiresAt) {
        return success(false);
      }

      const allowedCheck = checkAllowedOperations(context);
      return match(
        (allowed) =>
          allowed ? validateSpecificOperation(context) : Promise.resolve(success(false)),
        (error) => Promise.resolve(failure(error)),
        allowedCheck
      );
    };

    const contextResult = getContext();
    return match(
      (context) =>
        match(
          (checkedContext) => handleValidation(checkedContext),
          (error) => Promise.resolve(failure(error)),
          checkExpiration(context)
        ),
      (error) => Promise.resolve(failure(error)),
      contextResult
    );
  }

  /**
   * Enforce path access restrictions
   * @param contextId - Context identifier
   * @param path - Path to validate
   * @returns Result<boolean> - True if path allowed, false if restricted, or error
   */
  enforcePathRestrictions(contextId: string, path: string): Result<boolean> {
    const getContext = (): Result<IsolatedContext> => {
      const context = this.contextRegistry.get(contextId);
      return context ? success(context) : failure(securityError.contextNotFound(contextId));
    };

    const validatePath = (context: IsolatedContext): Result<boolean> => {
      // String operations are guaranteed not to throw - no try/catch needed
      const normalizedPath = this.normalizePath(path);

      // Check if path is in allowed paths
      const isAllowed = context.allowedPaths.some((allowedPath) => {
        const normalizedAllowed = this.normalizePath(allowedPath);
        return normalizedPath.startsWith(normalizedAllowed);
      });

      if (!isAllowed) {
        this.incrementViolation(contextId);
        this.logAccess(contextId, `path:${path}`, false, 'Path not in allowed paths');
        console.warn(`Path restricted for context ${contextId}: ${path}`);
        return success(false);
      }

      return success(true);
    };

    return flatMap(validatePath, getContext());
  }

  /**
   * Enforce tool access restrictions
   * @param contextId - Context identifier
   * @param tool - Tool name to validate
   * @returns Result<boolean> - True if tool allowed, false if restricted, or error
   */
  enforceToolRestrictions(contextId: string, tool: string): Result<boolean> {
    const getContext = (): Result<IsolatedContext> => {
      const context = this.contextRegistry.get(contextId);
      return context ? success(context) : failure(securityError.contextNotFound(contextId));
    };

    const validateTool = (context: IsolatedContext): Result<boolean> => {
      // Array operations are guaranteed not to throw - no try/catch needed
      const toolRestricted = context.boundaries.some(
        (boundary) => boundary.startsWith('tool:') && boundary.includes(tool)
      );

      if (toolRestricted) {
        this.incrementViolation(contextId);
        this.logAccess(contextId, `tool:${tool}`, false, 'Tool restricted by boundaries');
        console.warn(`Tool restricted for context ${contextId}: ${tool}`);
        return success(false);
      }

      return success(true);
    };

    return flatMap(validateTool, getContext());
  }

  /**
   * Enforce command access restrictions
   * @param contextId - Context identifier
   * @param command - Command name to validate
   * @returns Result<boolean> - True if command allowed, false if restricted, or error
   */
  enforceCommandRestrictions(contextId: string, command: string): Result<boolean> {
    const getContext = (): Result<IsolatedContext> => {
      const context = this.contextRegistry.get(contextId);
      return context ? success(context) : failure(securityError.contextNotFound(contextId));
    };

    const validateCommand = (context: IsolatedContext): Result<boolean> => {
      // Array operations are guaranteed not to throw - no try/catch needed
      const commandRestricted = context.boundaries.some(
        (boundary) => boundary.startsWith('command:') && boundary.includes(command)
      );

      if (commandRestricted) {
        this.incrementViolation(contextId);
        this.logAccess(contextId, `command:${command}`, false, 'Command restricted by boundaries');
        console.warn(`Command restricted for context ${contextId}: ${command}`);
        return success(false);
      }

      return success(true);
    };

    return flatMap(validateCommand, getContext());
  }

  /**
   * Get violation count for a context
   * @param contextId - Context identifier
   * @returns Result<number> - Violation count or error if context not found
   */
  getViolationCount(contextId: string): Result<number> {
    // Map operations are guaranteed not to throw - no try/catch needed
    const count = this.violationCounts.get(contextId);
    if (count === undefined && !this.contextRegistry.has(contextId)) {
      return failure(securityError.contextNotFound(contextId));
    }
    return success(count || 0);
  }

  /**
   * Get access log entries
   * @param contextId - Optional context identifier to filter logs
   * @returns Result<readonly ContextAccessAudit[]> - Access log entries or error
   */
  getAccessLog(contextId?: string): Result<readonly ContextAccessAudit[]> {
    // Array operations are guaranteed not to throw - no try/catch needed
    if (contextId) {
      const filteredLog = this.accessLog.filter((entry) => entry.contextId === contextId);
      return success(filteredLog);
    }
    return success([...this.accessLog]);
  }

  // Private helper methods

  private async validateSpecificOperation(
    context: IsolatedContext,
    operation: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // File system operations
    if (operation.startsWith('fs:')) {
      const path = operation.substring(3);
      const result = this.enforcePathRestrictions(context.id, path);
      return match(
        (allowed) => ({ allowed, reason: allowed ? undefined : 'Path access denied' }),
        () => ({ allowed: false, reason: 'Path validation error' }),
        result
      );
    }

    // Tool operations
    if (operation.startsWith('tool:')) {
      const tool = operation.substring(5);
      const result = this.enforceToolRestrictions(context.id, tool);
      return match(
        (allowed) => ({ allowed, reason: allowed ? undefined : 'Tool access denied' }),
        () => ({ allowed: false, reason: 'Tool validation error' }),
        result
      );
    }

    // Command operations
    if (operation.startsWith('command:')) {
      const command = operation.substring(8);
      const result = this.enforceCommandRestrictions(context.id, command);
      return match(
        (allowed) => ({ allowed, reason: allowed ? undefined : 'Command access denied' }),
        () => ({ allowed: false, reason: 'Command validation error' }),
        result
      );
    }

    // Network operations
    if (operation.startsWith('network:')) {
      // Check if network access is allowed
      const networkAllowed = context.boundaries.includes('network:allowed');
      return {
        allowed: networkAllowed,
        reason: networkAllowed ? undefined : 'Network access denied',
      };
    }

    // System operations
    if (operation.startsWith('system:')) {
      const systemAllowed = context.boundaries.includes('system:allowed');
      return {
        allowed: systemAllowed,
        reason: systemAllowed ? undefined : 'System access denied',
      };
    }

    // Default: allow if not explicitly restricted
    return { allowed: true };
  }

  private normalizePath(path: string): string {
    // Basic path normalization - resolve relative paths, remove trailing slashes
    return path.replace(/\/+/g, '/').replace(/\/$/, '') || '/';
  }

  private incrementViolation(contextId: string): void {
    const current = this.violationCounts.get(contextId) || 0;
    this.violationCounts.set(contextId, current + 1);
  }

  private logAccess(contextId: string, operation: string, allowed: boolean, reason?: string): void {
    this.accessLog.push({
      contextId,
      operation,
      allowed,
      timestamp: new Date(),
      reason,
    });

    // Keep only last 1000 entries
    if (this.accessLog.length > 1000) {
      this.accessLog.splice(0, this.accessLog.length - 1000);
    }
  }
}
