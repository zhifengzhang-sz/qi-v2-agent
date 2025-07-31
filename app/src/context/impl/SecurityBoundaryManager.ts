/**
 * Security Boundary Manager Implementation
 * 
 * Enforces security boundaries and access restrictions for isolated contexts
 */

import type { 
  ISecurityBoundaryManager,
  IsolatedContext 
} from '../abstractions/index.js';

/**
 * Security boundary manager for context isolation
 */
export class SecurityBoundaryManager implements ISecurityBoundaryManager {
  private contextRegistry = new Map<string, IsolatedContext>();
  private violationCounts = new Map<string, number>();
  private accessLog: Array<{
    contextId: string;
    operation: string;
    allowed: boolean;
    timestamp: Date;
    reason?: string;
  }> = [];

  registerContext(contextId: string, context: IsolatedContext): void {
    this.contextRegistry.set(contextId, context);
    this.violationCounts.set(contextId, 0);
  }

  unregisterContext(contextId: string): void {
    this.contextRegistry.delete(contextId);
    this.violationCounts.delete(contextId);
    
    // Clean up access log entries older than 1 hour
    const cutoff = new Date(Date.now() - 3600000);
    this.accessLog = this.accessLog.filter(entry => 
      entry.contextId !== contextId && entry.timestamp > cutoff
    );
  }

  async validateAccess(contextId: string, operation: string): Promise<boolean> {
    const context = this.contextRegistry.get(contextId);
    if (!context) {
      this.logAccess(contextId, operation, false, 'Context not found');
      return false;
    }

    // Check if context has expired
    if (new Date() > context.expiresAt) {
      this.logAccess(contextId, operation, false, 'Context expired');
      return false;
    }

    // Check allowed operations
    if (!context.allowedOperations.includes(operation)) {
      this.incrementViolation(contextId);
      this.logAccess(contextId, operation, false, 'Operation not allowed');
      return false;
    }

    // Validate specific operation types
    const validationResult = await this.validateSpecificOperation(context, operation);
    this.logAccess(contextId, operation, validationResult.allowed, validationResult.reason);
    
    if (!validationResult.allowed) {
      this.incrementViolation(contextId);
    }

    return validationResult.allowed;
  }

  enforcePathRestrictions(contextId: string, path: string): boolean {
    const context = this.contextRegistry.get(contextId);
    if (!context) {
      return false;
    }

    // Normalize path
    const normalizedPath = this.normalizePath(path);
    
    // Check if path is in allowed paths
    const isAllowed = context.allowedPaths.some(allowedPath => {
      const normalizedAllowed = this.normalizePath(allowedPath);
      return normalizedPath.startsWith(normalizedAllowed);
    });

    if (!isAllowed) {
      this.incrementViolation(contextId);
      this.logAccess(contextId, `path:${path}`, false, 'Path not in allowed paths');
    }

    return isAllowed;
  }

  enforceToolRestrictions(contextId: string, tool: string): boolean {
    const context = this.contextRegistry.get(contextId);
    if (!context) {
      return false;
    }

    // Check boundaries for tool restrictions
    const toolRestricted = context.boundaries.some(boundary => 
      boundary.startsWith('tool:') && boundary.includes(tool)
    );

    if (toolRestricted) {
      this.incrementViolation(contextId);
      this.logAccess(contextId, `tool:${tool}`, false, 'Tool restricted by boundaries');
      return false;
    }

    return true;
  }

  enforceCommandRestrictions(contextId: string, command: string): boolean {
    const context = this.contextRegistry.get(contextId);
    if (!context) {
      return false;
    }

    // Check boundaries for command restrictions
    const commandRestricted = context.boundaries.some(boundary => 
      boundary.startsWith('command:') && boundary.includes(command)
    );

    if (commandRestricted) {
      this.incrementViolation(contextId);
      this.logAccess(contextId, `command:${command}`, false, 'Command restricted by boundaries');
      return false;
    }

    return true;
  }

  getViolationCount(contextId: string): number {
    return this.violationCounts.get(contextId) || 0;
  }

  // Private helper methods

  private async validateSpecificOperation(
    context: IsolatedContext, 
    operation: string
  ): Promise<{ allowed: boolean; reason?: string }> {
    // File system operations
    if (operation.startsWith('fs:')) {
      const path = operation.substring(3);
      const allowed = this.enforcePathRestrictions(context.id, path);
      return { allowed, reason: allowed ? undefined : 'Path access denied' };
    }

    // Tool operations
    if (operation.startsWith('tool:')) {
      const tool = operation.substring(5);
      const allowed = this.enforceToolRestrictions(context.id, tool);
      return { allowed, reason: allowed ? undefined : 'Tool access denied' };
    }

    // Command operations
    if (operation.startsWith('command:')) {
      const command = operation.substring(8);
      const allowed = this.enforceCommandRestrictions(context.id, command);
      return { allowed, reason: allowed ? undefined : 'Command access denied' };
    }

    // Network operations
    if (operation.startsWith('network:')) {
      // Check if network access is allowed
      const networkAllowed = context.boundaries.includes('network:allowed');
      return { 
        allowed: networkAllowed, 
        reason: networkAllowed ? undefined : 'Network access denied' 
      };
    }

    // System operations
    if (operation.startsWith('system:')) {
      const systemAllowed = context.boundaries.includes('system:allowed');
      return { 
        allowed: systemAllowed, 
        reason: systemAllowed ? undefined : 'System access denied' 
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

  private logAccess(
    contextId: string, 
    operation: string, 
    allowed: boolean, 
    reason?: string
  ): void {
    this.accessLog.push({
      contextId,
      operation,
      allowed,
      timestamp: new Date(),
      reason
    });

    // Keep only last 1000 entries
    if (this.accessLog.length > 1000) {
      this.accessLog = this.accessLog.slice(-1000);
    }
  }

  // Public access to logs for debugging/auditing
  getAccessLog(contextId?: string): readonly typeof this.accessLog {
    if (contextId) {
      return this.accessLog.filter(entry => entry.contextId === contextId);
    }
    return [...this.accessLog];
  }
}