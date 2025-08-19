/**
 * @qi/tools - Permission Manager
 *
 * Role-based permission system with fine-grained access control for tools.
 * Implements Claude Code's security patterns with QiCore Result<T> integration.
 */

import {
  create,
  failure,
  match,
  type QiError,
  type Result,
  success,
  validationError,
} from '@qi/base';
import { createQiLogger } from '../../utils/QiCoreLogger.js';
import type { PermissionResult, ToolContext, ToolPermissions } from '../core/interfaces/ITool.js';

/**
 * User role definitions
 */
export enum UserRole {
  ADMIN = 'admin',
  DEVELOPER = 'developer',
  OPERATOR = 'operator',
  READONLY = 'readonly',
  GUEST = 'guest',
}

/**
 * Permission action types
 */
export enum PermissionAction {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  DELETE = 'delete',
  ADMIN = 'admin',
}

/**
 * Resource types for permission checks
 */
export enum ResourceType {
  FILE = 'file',
  DIRECTORY = 'directory',
  SYSTEM = 'system',
  NETWORK = 'network',
  DATABASE = 'database',
  ENVIRONMENT = 'environment',
}

/**
 * Permission rule definition
 */
interface PermissionRule {
  readonly role: UserRole;
  readonly resource: ResourceType;
  readonly action: PermissionAction;
  readonly pathPattern?: string; // Glob pattern for path-based permissions
  readonly conditions?: PermissionCondition[];
}

/**
 * Dynamic permission condition
 */
interface PermissionCondition {
  readonly type: 'time_range' | 'ip_whitelist' | 'resource_size' | 'custom';
  readonly parameters: Record<string, any>;
  readonly evaluate: (context: ToolContext, resource: string) => boolean;
}

/**
 * Permission audit log entry
 */
interface PermissionAuditEntry {
  readonly timestamp: number;
  readonly userId?: string;
  readonly sessionId: string;
  readonly toolName: string;
  readonly resource: string;
  readonly action: PermissionAction;
  readonly allowed: boolean;
  readonly reason?: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

/**
 * Permission error with enhanced context
 */
interface PermissionError extends QiError {
  context: {
    userId?: string;
    sessionId?: string;
    toolName?: string;
    resource?: string;
    action?: string;
    requiredRole?: string;
    currentRole?: string;
  };
}

const permissionError = (
  code: string,
  message: string,
  category: 'VALIDATION' | 'SYSTEM' | 'NETWORK' | 'BUSINESS',
  context: PermissionError['context'] = {}
): PermissionError => create(code, message, category, context) as PermissionError;

/**
 * Default permission rules by role
 */
const DEFAULT_PERMISSION_RULES: PermissionRule[] = [
  // Admin - Full access
  { role: UserRole.ADMIN, resource: ResourceType.FILE, action: PermissionAction.READ },
  { role: UserRole.ADMIN, resource: ResourceType.FILE, action: PermissionAction.WRITE },
  { role: UserRole.ADMIN, resource: ResourceType.FILE, action: PermissionAction.DELETE },
  { role: UserRole.ADMIN, resource: ResourceType.SYSTEM, action: PermissionAction.EXECUTE },
  { role: UserRole.ADMIN, resource: ResourceType.NETWORK, action: PermissionAction.EXECUTE },
  { role: UserRole.ADMIN, resource: ResourceType.ENVIRONMENT, action: PermissionAction.READ },
  { role: UserRole.ADMIN, resource: ResourceType.ENVIRONMENT, action: PermissionAction.WRITE },

  // Developer - Development access
  { role: UserRole.DEVELOPER, resource: ResourceType.FILE, action: PermissionAction.READ },
  { role: UserRole.DEVELOPER, resource: ResourceType.FILE, action: PermissionAction.WRITE },
  { role: UserRole.DEVELOPER, resource: ResourceType.SYSTEM, action: PermissionAction.EXECUTE },
  { role: UserRole.DEVELOPER, resource: ResourceType.ENVIRONMENT, action: PermissionAction.READ },

  // Operator - Operational access
  { role: UserRole.OPERATOR, resource: ResourceType.FILE, action: PermissionAction.READ },
  { role: UserRole.OPERATOR, resource: ResourceType.SYSTEM, action: PermissionAction.EXECUTE },
  { role: UserRole.OPERATOR, resource: ResourceType.ENVIRONMENT, action: PermissionAction.READ },

  // ReadOnly - Read-only access
  { role: UserRole.READONLY, resource: ResourceType.FILE, action: PermissionAction.READ },
  { role: UserRole.READONLY, resource: ResourceType.ENVIRONMENT, action: PermissionAction.READ },

  // Guest - Minimal access
  {
    role: UserRole.GUEST,
    resource: ResourceType.FILE,
    action: PermissionAction.READ,
    pathPattern: '/tmp/**',
  },
];

/**
 * Permission Manager with Role-Based Access Control
 */
export class PermissionManager {
  private rules: PermissionRule[] = [];
  private auditLog: PermissionAuditEntry[] = [];
  private userRoles = new Map<string, UserRole>();
  private sessionRoles = new Map<string, UserRole>();
  private logger: any;

  // Security settings
  private readonly maxAuditLogSize = 10000;
  private readonly enableAuditLogging = true;
  private readonly defaultRole = UserRole.GUEST;

  constructor() {
    this.rules = [...DEFAULT_PERMISSION_RULES];

    this.logger = createQiLogger({
      name: 'PermissionManager',
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      pretty: process.env.NODE_ENV === 'development',
    });
  }

  /**
   * Check if a tool execution is permitted
   */
  async checkToolPermission(
    toolName: string,
    action: PermissionAction,
    resource: string,
    context: ToolContext
  ): Promise<Result<PermissionResult, QiError>> {
    const startTime = Date.now();

    try {
      // Get user role
      const role = this.getUserRole(context);

      // Determine resource type
      const resourceType = this.determineResourceType(toolName, resource);

      // Find matching rules
      const applicableRules = this.findApplicableRules(role, resourceType, action, resource);

      if (applicableRules.length === 0) {
        const result: PermissionResult = {
          allowed: false,
          reason: `No permission rule found for role '${role}' to '${action}' on '${resourceType}' resource`,
          requiredLevel: this.getRequiredRole(resourceType, action),
        };

        await this.logPermissionCheck(toolName, action, resource, context, result, startTime);
        return success(result);
      }

      // Evaluate conditions
      for (const rule of applicableRules) {
        if (rule.conditions) {
          const conditionResult = await this.evaluateConditions(rule.conditions, context, resource);
          const conditionPassed = match(
            (passed: boolean) => passed,
            (error: QiError) => {
              // Log condition failure and deny permission
              this.logPermissionCheck(
                toolName,
                action,
                resource,
                context,
                {
                  allowed: false,
                  reason: `Permission condition failed: ${error.message}`,
                },
                startTime
              );
              return false;
            },
            conditionResult
          );

          if (!conditionPassed) {
            const result: PermissionResult = {
              allowed: false,
              reason: 'Permission conditions not met',
            };

            await this.logPermissionCheck(toolName, action, resource, context, result, startTime);
            return success(result);
          }
        }
      }

      // Permission granted
      const result: PermissionResult = {
        allowed: true,
      };

      await this.logPermissionCheck(toolName, action, resource, context, result, startTime);
      return success(result);
    } catch (error) {
      return failure(
        permissionError(
          'PERMISSION_CHECK_FAILED',
          `Permission check failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          {
            toolName,
            resource,
            action,
            sessionId: context.sessionId,
          }
        )
      );
    }
  }

  /**
   * Create tool context with proper permissions
   */
  createToolContext(
    sessionId: string,
    userId?: string,
    currentDirectory: string = process.cwd(),
    environment: ReadonlyMap<string, string> = new Map(),
    metadata: ReadonlyMap<string, unknown> = new Map()
  ): Result<ToolContext, QiError> {
    const role = userId ? this.getUserRole({ sessionId, userId }) : this.getSessionRole(sessionId);
    const permissions = this.createPermissionsForRole(role);

    const context: ToolContext = {
      sessionId,
      userId,
      currentDirectory,
      environment,
      permissions,
      metadata,
    };

    return success(context);
  }

  /**
   * Set user role
   */
  setUserRole(userId: string, role: UserRole): Result<void, QiError> {
    if (!Object.values(UserRole).includes(role)) {
      return failure(
        permissionError('INVALID_ROLE', `Invalid user role: ${role}`, 'VALIDATION', {
          userId,
          currentRole: role,
        })
      );
    }

    this.userRoles.set(userId, role);

    this.logger.info('User role updated', {
      component: 'PermissionManager',
      method: 'setUserRole',
      userId,
      role,
    });

    return success(undefined);
  }

  /**
   * Set session role (for anonymous sessions)
   */
  setSessionRole(sessionId: string, role: UserRole): Result<void, QiError> {
    if (!Object.values(UserRole).includes(role)) {
      return failure(
        permissionError('INVALID_ROLE', `Invalid session role: ${role}`, 'VALIDATION', {
          sessionId,
          currentRole: role,
        })
      );
    }

    this.sessionRoles.set(sessionId, role);

    this.logger.info('Session role updated', {
      component: 'PermissionManager',
      method: 'setSessionRole',
      sessionId,
      role,
    });

    return success(undefined);
  }

  /**
   * Add custom permission rule
   */
  addPermissionRule(rule: PermissionRule): Result<void, QiError> {
    // Validate rule
    if (!Object.values(UserRole).includes(rule.role)) {
      return failure(
        permissionError(
          'INVALID_RULE',
          `Invalid role in permission rule: ${rule.role}`,
          'VALIDATION'
        )
      );
    }

    this.rules.push(rule);

    this.logger.info('Permission rule added', {
      component: 'PermissionManager',
      method: 'addPermissionRule',
      rule,
    });

    return success(undefined);
  }

  /**
   * Remove permission rule
   */
  removePermissionRule(
    role: UserRole,
    resource: ResourceType,
    action: PermissionAction,
    pathPattern?: string
  ): Result<number, QiError> {
    const initialLength = this.rules.length;

    this.rules = this.rules.filter(
      (rule) =>
        !(
          rule.role === role &&
          rule.resource === resource &&
          rule.action === action &&
          rule.pathPattern === pathPattern
        )
    );

    const removedCount = initialLength - this.rules.length;

    this.logger.info('Permission rules removed', {
      component: 'PermissionManager',
      method: 'removePermissionRule',
      role,
      resource,
      action,
      pathPattern,
      removedCount,
    });

    return success(removedCount);
  }

  /**
   * Get permission audit log
   */
  getAuditLog(limit?: number): readonly PermissionAuditEntry[] {
    const entries = limit ? this.auditLog.slice(-limit) : this.auditLog;
    return entries.slice(); // Return copy
  }

  /**
   * Clear audit log
   */
  clearAuditLog(): Result<number, QiError> {
    const count = this.auditLog.length;
    this.auditLog = [];
    return success(count);
  }

  /**
   * Get permission statistics
   */
  getPermissionStats(): {
    totalRules: number;
    activeUsers: number;
    activeSessions: number;
    auditLogSize: number;
    recentDenials: number;
  } {
    const recentDenials = this.auditLog.filter(
      (entry) => !entry.allowed && Date.now() - entry.timestamp < 3600000
    ).length; // Last hour

    return {
      totalRules: this.rules.length,
      activeUsers: this.userRoles.size,
      activeSessions: this.sessionRoles.size,
      auditLogSize: this.auditLog.length,
      recentDenials,
    };
  }

  // Private helper methods

  private getUserRole(context: { sessionId: string; userId?: string }): UserRole {
    if (context.userId) {
      return this.userRoles.get(context.userId) || this.defaultRole;
    }
    return this.sessionRoles.get(context.sessionId) || this.defaultRole;
  }

  private getSessionRole(sessionId: string): UserRole {
    return this.sessionRoles.get(sessionId) || this.defaultRole;
  }

  private createPermissionsForRole(role: UserRole): ToolPermissions {
    const canRead = this.hasPermission(role, ResourceType.FILE, PermissionAction.READ);
    const canWrite = this.hasPermission(role, ResourceType.FILE, PermissionAction.WRITE);
    const canExecute = this.hasPermission(role, ResourceType.SYSTEM, PermissionAction.EXECUTE);
    const canNetwork = this.hasPermission(role, ResourceType.NETWORK, PermissionAction.EXECUTE);
    const canSystem =
      canExecute || this.hasPermission(role, ResourceType.SYSTEM, PermissionAction.ADMIN);

    return {
      readFiles: canRead,
      writeFiles: canWrite,
      executeCommands: canExecute,
      networkAccess: canNetwork,
      systemAccess: canSystem,
      manageProcesses: canExecute, // Process management requires execute permission
      allowedPaths: this.getAllowedPaths(role),
      deniedPaths: this.getDeniedPaths(role),
    };
  }

  private hasPermission(role: UserRole, resource: ResourceType, action: PermissionAction): boolean {
    return this.rules.some(
      (rule) => rule.role === role && rule.resource === resource && rule.action === action
    );
  }

  private getAllowedPaths(role: UserRole): string[] | undefined {
    const pathRules = this.rules.filter(
      (rule) => rule.role === role && rule.resource === ResourceType.FILE && rule.pathPattern
    );

    return pathRules.length > 0
      ? pathRules.map((rule) => rule.pathPattern!).filter(Boolean)
      : undefined;
  }

  private getDeniedPaths(_role: UserRole): string[] | undefined {
    // Implement denied path logic based on security requirements
    const sensitivePaths = ['/etc', '/sys', '/proc', '/root', '/boot', '/dev'];

    return sensitivePaths;
  }

  private determineResourceType(toolName: string, resource: string): ResourceType {
    // Map tool names and resources to resource types
    const fileTools = ['ReadTool', 'WriteTool', 'EditTool', 'MultiEditTool', 'LSTool'];
    const systemTools = ['BashTool', 'ProcessManager'];
    const networkTools = ['HttpTool', 'FetchTool'];

    if (fileTools.includes(toolName)) return ResourceType.FILE;
    if (systemTools.includes(toolName)) return ResourceType.SYSTEM;
    if (networkTools.includes(toolName)) return ResourceType.NETWORK;

    // Resource-based detection
    if (resource.startsWith('/') || resource.includes('\\')) return ResourceType.FILE;
    if (resource.startsWith('http')) return ResourceType.NETWORK;

    return ResourceType.SYSTEM; // Default
  }

  private findApplicableRules(
    role: UserRole,
    resourceType: ResourceType,
    action: PermissionAction,
    resource: string
  ): PermissionRule[] {
    return this.rules.filter((rule) => {
      if (rule.role !== role || rule.resource !== resourceType || rule.action !== action) {
        return false;
      }

      // Check path pattern if specified
      if (rule.pathPattern) {
        return this.matchesPathPattern(resource, rule.pathPattern);
      }

      return true;
    });
  }

  private matchesPathPattern(path: string, pattern: string): boolean {
    // Improved glob pattern matching with proper ** handling
    // Use placeholders to avoid conflicts between ** and * replacements
    const regexPattern = pattern
      .replace(/\*\*/g, '__DOUBLE_STAR__') // Placeholder for **
      .replace(/\*/g, '[^/]*') // Single * becomes [^/]*
      .replace(/__DOUBLE_STAR__/g, '.*') // ** becomes .*
      .replace(/\?/g, '.'); // ? becomes .

    const regex = new RegExp(`^${regexPattern}$`);
    return regex.test(path);
  }

  private async evaluateConditions(
    conditions: PermissionCondition[],
    context: ToolContext,
    resource: string
  ): Promise<Result<boolean, QiError>> {
    for (const condition of conditions) {
      try {
        if (!condition.evaluate(context, resource)) {
          return success(false);
        }
      } catch (error) {
        return failure(
          permissionError(
            'CONDITION_EVALUATION_FAILED',
            `Permission condition evaluation failed: ${error instanceof Error ? error.message : String(error)}`,
            'SYSTEM'
          )
        );
      }
    }

    return success(true);
  }

  private getRequiredRole(resourceType: ResourceType, action: PermissionAction): string {
    // Return minimum role required for this resource/action combination
    const roleHierarchy = [
      UserRole.GUEST,
      UserRole.READONLY,
      UserRole.OPERATOR,
      UserRole.DEVELOPER,
      UserRole.ADMIN,
    ];

    for (const role of roleHierarchy) {
      if (this.hasPermission(role, resourceType, action)) {
        return role;
      }
    }

    return UserRole.ADMIN; // Fallback to highest privilege
  }

  private async logPermissionCheck(
    toolName: string,
    action: PermissionAction,
    resource: string,
    context: ToolContext,
    result: PermissionResult,
    startTime: number
  ): Promise<void> {
    if (!this.enableAuditLogging) return;

    const entry: PermissionAuditEntry = {
      timestamp: Date.now(),
      userId: context.userId,
      sessionId: context.sessionId,
      toolName,
      resource,
      action,
      allowed: result.allowed,
      reason: result.reason,
      // Additional context could be added here (IP, user agent, etc.)
    };

    this.auditLog.push(entry);

    // Trim log if it gets too large
    if (this.auditLog.length > this.maxAuditLogSize) {
      this.auditLog = this.auditLog.slice(-this.maxAuditLogSize / 2);
    }

    // Log significant events
    if (!result.allowed || process.env.NODE_ENV === 'development') {
      this.logger.info('Permission check completed', {
        component: 'PermissionManager',
        method: 'checkToolPermission',
        toolName,
        action,
        resource,
        allowed: result.allowed,
        reason: result.reason,
        userId: context.userId,
        sessionId: context.sessionId,
        duration: Date.now() - startTime,
      });
    }
  }
}
