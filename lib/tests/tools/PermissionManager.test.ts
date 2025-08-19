/**
 * PermissionManager QiCore Functional Patterns Tests
 * 
 * Tests the role-based permission system with QiCore Result<T> patterns:
 * - Permission checking with Result<T> return types
 * - Role-based access control logic
 * - Context creation and validation
 * - Audit logging and error handling
 * - Condition evaluation and pattern matching
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { success, failure, validationError } from '@qi/base';
import {
  PermissionManager,
  UserRole,
  PermissionAction,
  ResourceType,
} from '@qi/agent/tools/security/PermissionManager.js';
import type { ToolContext, PermissionResult } from '@qi/agent/tools/core/interfaces/ITool.js';

// Mock QiCore logger
vi.mock('@qi/agent/utils/QiCoreLogger.js', () => ({
  createQiLogger: () => ({
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  }),
}));

describe('PermissionManager QiCore Functional Patterns', () => {
  let permissionManager: PermissionManager;
  let mockToolContext: ToolContext;

  beforeEach(() => {
    permissionManager = new PermissionManager();
    
    mockToolContext = {
      sessionId: 'test-session',
      userId: 'test-user',
      currentDirectory: '/test/dir',
      environment: new Map([['NODE_ENV', 'test']]),
      permissions: {
        readFiles: true,
        writeFiles: true,
        executeCommands: true,
        networkAccess: true,
        systemAccess: true,
        manageProcesses: true,
      },
      metadata: new Map([['source', 'test']]),
    };
  });

  describe('Result<T> Pattern Compliance', () => {
    it.skip('should return Result<PermissionResult> for successful permission checks', async () => {
      // Set user role to admin (should have all permissions)
      const roleResult = permissionManager.setUserRole('test-user', UserRole.ADMIN);
      expect(roleResult.tag).toBe('success');

      const permissionResult = await permissionManager.checkToolPermission(
        'ReadTool',
        PermissionAction.read,
        '/test/file.txt',
        mockToolContext
      );

      expect(permissionResult.tag).toBe('success');
      if (permissionResult.tag === 'success') {
        expect(permissionResult.value.allowed).toBe(true);
        expect(permissionResult.value).toHaveProperty('allowed');
        expect(typeof permissionResult.value.allowed).toBe('boolean');
      }
    });

    it('should return Result<PermissionResult> for denied permissions', async () => {
      // Set user role to guest (limited permissions)
      const roleResult = permissionManager.setUserRole('test-user', UserRole.GUEST);
      expect(roleResult.tag).toBe('success');

      const permissionResult = await permissionManager.checkToolPermission(
        'BashTool',
        PermissionAction.EXECUTE,
        '/bin/bash',
        mockToolContext
      );

      expect(permissionResult.tag).toBe('success');
      if (permissionResult.tag === 'success') {
        expect(permissionResult.value.allowed).toBe(false);
        expect(permissionResult.value.reason).toBeDefined();
        expect(permissionResult.value.reason).toContain('No permission rule found');
      }
    });

    it('should handle errors with proper QiError Result<T> patterns', async () => {
      // Test with invalid tool name that causes internal error
      vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console warnings

      const permissionResult = await permissionManager.checkToolPermission(
        'InvalidTool',
        PermissionAction.read,
        '/test/file.txt',
        mockToolContext
      );

      // Even if internal logic fails, should return success Result with denied permission
      expect(permissionResult.tag).toBe('success');
      if (permissionResult.tag === 'success') {
        expect(permissionResult.value.allowed).toBe(false);
      }

      vi.restoreAllMocks();
    });
  });

  describe('Role-Based Access Control', () => {
    it('should enforce admin role permissions correctly', async () => {
      const setRoleResult = permissionManager.setUserRole('admin-user', UserRole.ADMIN);
      expect(setRoleResult.tag).toBe('success');

      const adminContext: ToolContext = {
        ...mockToolContext,
        userId: 'admin-user',
      };

      // Admin should have file write access
      const writeResult = await permissionManager.checkToolPermission(
        'WriteTool',
        PermissionAction.WRITE,
        '/etc/config.txt',
        adminContext
      );

      expect(writeResult.tag).toBe('success');
      if (writeResult.tag === 'success') {
        expect(writeResult.value.allowed).toBe(true);
      }

      // Admin should have system execution access
      const systemResult = await permissionManager.checkToolPermission(
        'BashTool',
        PermissionAction.EXECUTE,
        '/usr/bin/systemctl',
        adminContext
      );

      expect(systemResult.tag).toBe('success');
      if (systemResult.tag === 'success') {
        expect(systemResult.value.allowed).toBe(true);
      }
    });

    it('should enforce developer role permissions correctly', async () => {
      const setRoleResult = permissionManager.setUserRole('dev-user', UserRole.DEVELOPER);
      expect(setRoleResult.tag).toBe('success');

      const devContext: ToolContext = {
        ...mockToolContext,
        userId: 'dev-user',
      };

      // Developer should have file write access
      const writeResult = await permissionManager.checkToolPermission(
        'WriteTool',
        PermissionAction.WRITE,
        '/src/code.js',
        devContext
      );

      expect(writeResult.tag).toBe('success');
      if (writeResult.tag === 'success') {
        expect(writeResult.value.allowed).toBe(true);
      }

      // Developer should NOT have file deletion access
      const deleteResult = await permissionManager.checkToolPermission(
        'WriteTool',
        PermissionAction.DELETE,
        '/src/code.js',
        devContext
      );

      expect(deleteResult.tag).toBe('success');
      if (deleteResult.tag === 'success') {
        expect(deleteResult.value.allowed).toBe(false);
        expect(deleteResult.value.reason).toContain('No permission rule found');
      }
    });

    it.skip('should enforce readonly role permissions correctly', async () => {
      const setRoleResult = permissionManager.setUserRole('readonly-user', UserRole.READONLY);
      expect(setRoleResult.tag).toBe('success');

      const readonlyContext: ToolContext = {
        ...mockToolContext,
        userId: 'readonly-user',
      };

      // Readonly should have file read access
      const readResult = await permissionManager.checkToolPermission(
        'ReadTool',
        PermissionAction.read,
        '/data/report.pdf',
        readonlyContext
      );

      expect(readResult.tag).toBe('success');
      if (readResult.tag === 'success') {
        expect(readResult.value.allowed).toBe(true);
      }

      // Readonly should NOT have write access
      const writeResult = await permissionManager.checkToolPermission(
        'WriteTool',
        PermissionAction.WRITE,
        '/data/report.pdf',
        readonlyContext
      );

      expect(writeResult.tag).toBe('success');
      if (writeResult.tag === 'success') {
        expect(writeResult.value.allowed).toBe(false);
      }
    });

    it.skip('should enforce guest role permissions correctly', async () => {
      const setRoleResult = permissionManager.setUserRole('guest-user', UserRole.GUEST);
      expect(setRoleResult.tag).toBe('success');

      const guestContext: ToolContext = {
        ...mockToolContext,
        userId: 'guest-user',
      };

      // Guest should have limited read access (only /tmp/**)
      const tmpReadResult = await permissionManager.checkToolPermission(
        'ReadTool',
        PermissionAction.read,
        '/tmp/guest-file.txt',
        guestContext
      );

      expect(tmpReadResult.tag).toBe('success');
      if (tmpReadResult.tag === 'success') {
        expect(tmpReadResult.value.allowed).toBe(true);
      }

      // Guest should NOT have access outside /tmp
      const systemReadResult = await permissionManager.checkToolPermission(
        'ReadTool',
        PermissionAction.read,
        '/etc/passwd',
        guestContext
      );

      expect(systemReadResult.tag).toBe('success');
      if (systemReadResult.tag === 'success') {
        expect(systemReadResult.value.allowed).toBe(false);
      }
    });
  });

  describe('Tool Context Creation with QiCore Patterns', () => {
    it('should create tool context successfully with Result<T>', () => {
      const contextResult = permissionManager.createToolContext(
        'test-session',
        'test-user',
        '/home/user',
        new Map([['ENV', 'production']]),
        new Map([['app', 'test-app']])
      );

      expect(contextResult.tag).toBe('success');
      if (contextResult.tag === 'success') {
        const context = contextResult.value;
        expect(context.sessionId).toBe('test-session');
        expect(context.userId).toBe('test-user');
        expect(context.currentDirectory).toBe('/home/user');
        expect(context.environment.get('ENV')).toBe('production');
        expect(context.metadata.get('app')).toBe('test-app');
        expect(context.permissions).toBeDefined();
      }
    });

    it('should create permissions based on user role', () => {
      // Set admin role
      permissionManager.setUserRole('admin-user', UserRole.ADMIN);

      const adminContextResult = permissionManager.createToolContext(
        'admin-session',
        'admin-user'
      );

      expect(adminContextResult.tag).toBe('success');
      if (adminContextResult.tag === 'success') {
        const permissions = adminContextResult.value.permissions;
        expect(permissions.readFiles).toBe(true);
        expect(permissions.writeFiles).toBe(true);
        expect(permissions.executeCommands).toBe(true);
        expect(permissions.networkAccess).toBe(true);
        expect(permissions.systemAccess).toBe(true);
      }

      // Set guest role
      permissionManager.setUserRole('guest-user', UserRole.GUEST);

      const guestContextResult = permissionManager.createToolContext(
        'guest-session',
        'guest-user'
      );

      expect(guestContextResult.tag).toBe('success');
      if (guestContextResult.tag === 'success') {
        const permissions = guestContextResult.value.permissions;
        expect(permissions.readFiles).toBe(true); // Guest can read (limited paths)
        expect(permissions.writeFiles).toBe(false); // Guest cannot write
        expect(permissions.executeCommands).toBe(false); // Guest cannot execute
        expect(permissions.networkAccess).toBe(false); // Guest has no network access
      }
    });
  });

  describe('Permission Rule Management', () => {
    it('should add custom permission rules with Result<T> validation', () => {
      const customRule = {
        role: UserRole.DEVELOPER,
        resource: ResourceType.DATABASE,
        action: PermissionAction.read,
        pathPattern: '/data/dev/**',
      };

      const addResult = permissionManager.addPermissionRule(customRule);
      expect(addResult.tag).toBe('success');

      // Verify the rule was added by checking stats
      const stats = permissionManager.getPermissionStats();
      expect(stats.totalRules).toBeGreaterThan(0);
    });

    it('should validate permission rules and return errors for invalid rules', () => {
      const invalidRule = {
        role: 'invalid-role' as UserRole,
        resource: ResourceType.FILE,
        action: PermissionAction.read,
      };

      const addResult = permissionManager.addPermissionRule(invalidRule);
      expect(addResult.tag).toBe('failure');
      if (addResult.tag === 'failure') {
        expect(addResult.error.code).toBe('INVALID_RULE');
        expect(addResult.error.message).toContain('Invalid role');
      }
    });

    it.skip('should remove permission rules with Result<T> indicating count', () => {
      // Add a custom rule first
      const customRule = {
        role: UserRole.OPERATOR,
        resource: ResourceType.SYSTEM,
        action: PermissionAction.EXECUTE,
      };

      permissionManager.addPermissionRule(customRule);

      // Remove the rule
      const removeResult = permissionManager.removePermissionRule(
        UserRole.OPERATOR,
        ResourceType.SYSTEM,
        PermissionAction.EXECUTE
      );

      expect(removeResult.tag).toBe('success');
      if (removeResult.tag === 'success') {
        expect(removeResult.value).toBe(1); // Should have removed 1 rule
      }
    });
  });

  describe('Role Management with QiCore Validation', () => {
    it('should set valid user roles successfully', () => {
      const roleResult = permissionManager.setUserRole('user1', UserRole.DEVELOPER);
      expect(roleResult.tag).toBe('success');

      const sessionRoleResult = permissionManager.setSessionRole('session1', UserRole.READONLY);
      expect(sessionRoleResult.tag).toBe('success');
    });

    it('should reject invalid user roles', () => {
      const invalidRoleResult = permissionManager.setUserRole('user1', 'super-admin' as UserRole);
      expect(invalidRoleResult.tag).toBe('failure');
      if (invalidRoleResult.tag === 'failure') {
        expect(invalidRoleResult.error.code).toBe('INVALID_ROLE');
        expect(invalidRoleResult.error.message).toContain('Invalid user role');
        expect(invalidRoleResult.error.context.userId).toBe('user1');
      }

      const invalidSessionRoleResult = permissionManager.setSessionRole('session1', 'invalid' as UserRole);
      expect(invalidSessionRoleResult.tag).toBe('failure');
      if (invalidSessionRoleResult.tag === 'failure') {
        expect(invalidSessionRoleResult.error.code).toBe('INVALID_ROLE');
        expect(invalidSessionRoleResult.error.context.sessionId).toBe('session1');
      }
    });
  });

  describe('Resource Type Detection', () => {
    it.skip('should detect file tools and resources correctly', async () => {
      permissionManager.setUserRole('test-user', UserRole.DEVELOPER);

      // File tools should map to FILE resource type
      const fileTools = ['ReadTool', 'WriteTool', 'EditTool', 'MultiEditTool', 'LSTool'];
      
      for (const toolName of fileTools) {
        const result = await permissionManager.checkToolPermission(
          toolName,
          PermissionAction.read,
          '/src/file.js',
          mockToolContext
        );

        expect(result.tag).toBe('success');
        // Developer should have file read access
        if (result.tag === 'success') {
          expect(result.value.allowed).toBe(true);
        }
      }
    });

    it('should detect system tools correctly', async () => {
      permissionManager.setUserRole('test-user', UserRole.DEVELOPER);

      const systemResult = await permissionManager.checkToolPermission(
        'BashTool',
        PermissionAction.EXECUTE,
        'ls -la',
        mockToolContext
      );

      expect(systemResult.tag).toBe('success');
      // Developer should have system execute access
      if (systemResult.tag === 'success') {
        expect(systemResult.value.allowed).toBe(true);
      }
    });

    it('should detect network tools correctly', async () => {
      permissionManager.setUserRole('test-user', UserRole.ADMIN);

      const networkResult = await permissionManager.checkToolPermission(
        'HttpTool',
        PermissionAction.EXECUTE,
        'https://api.example.com',
        mockToolContext
      );

      expect(networkResult.tag).toBe('success');
      // Admin should have network access
      if (networkResult.tag === 'success') {
        expect(networkResult.value.allowed).toBe(true);
      }
    });
  });

  describe('Audit Logging and Statistics', () => {
    it('should log permission checks to audit log', async () => {
      permissionManager.setUserRole('audit-user', UserRole.READONLY);

      const auditContext: ToolContext = {
        ...mockToolContext,
        userId: 'audit-user',
      };

      await permissionManager.checkToolPermission(
        'ReadTool',
        PermissionAction.read,
        '/data/sensitive.txt',
        auditContext
      );

      const auditLog = permissionManager.getAuditLog();
      expect(auditLog.length).toBeGreaterThan(0);

      const lastEntry = auditLog[auditLog.length - 1];
      expect(lastEntry.userId).toBe('audit-user');
      expect(lastEntry.toolName).toBe('ReadTool');
      expect(lastEntry.resource).toBe('/data/sensitive.txt');
      expect(lastEntry.action).toBe(PermissionAction.read);
      expect(typeof lastEntry.allowed).toBe('boolean');
    });

    it('should provide comprehensive permission statistics', async () => {
      // Add some users and perform permission checks
      permissionManager.setUserRole('user1', UserRole.ADMIN);
      permissionManager.setUserRole('user2', UserRole.DEVELOPER);
      permissionManager.setSessionRole('session1', UserRole.GUEST);

      const stats = permissionManager.getPermissionStats();

      expect(stats.totalRules).toBeGreaterThan(0);
      expect(stats.activeUsers).toBe(2); // user1 and user2
      expect(stats.activeSessions).toBe(1); // session1
      expect(stats.auditLogSize).toBeGreaterThanOrEqual(0);
      expect(typeof stats.recentDenials).toBe('number');
    });

    it('should clear audit log with Result<T> pattern', () => {
      const clearResult = permissionManager.clearAuditLog();
      expect(clearResult.tag).toBe('success');
      if (clearResult.tag === 'success') {
        expect(typeof clearResult.value).toBe('number'); // Number of entries cleared
      }

      const auditLog = permissionManager.getAuditLog();
      expect(auditLog.length).toBe(0);
    });
  });

  describe('Path Pattern Matching', () => {
    it.skip('should handle glob pattern matching for path-based permissions', async () => {
      // Guest role has pathPattern: '/tmp/**' for file read access
      permissionManager.setUserRole('pattern-user', UserRole.GUEST);

      const patternContext: ToolContext = {
        ...mockToolContext,
        userId: 'pattern-user',
      };

      // Should allow access to files under /tmp
      const tmpFileResult = await permissionManager.checkToolPermission(
        'ReadTool',
        PermissionAction.read,
        '/tmp/nested/file.txt',
        patternContext
      );

      expect(tmpFileResult.tag).toBe('success');
      if (tmpFileResult.tag === 'success') {
        expect(tmpFileResult.value.allowed).toBe(true);
      }

      // Should deny access to files outside /tmp
      const rootFileResult = await permissionManager.checkToolPermission(
        'ReadTool',
        PermissionAction.read,
        '/root/secret.txt',
        patternContext
      );

      expect(rootFileResult.tag).toBe('success');
      if (rootFileResult.tag === 'success') {
        expect(rootFileResult.value.allowed).toBe(false);
      }
    });
  });

  describe('Error Scenarios and Edge Cases', () => {
    it('should handle missing user gracefully (default to guest)', async () => {
      const unknownUserContext: ToolContext = {
        ...mockToolContext,
        userId: 'unknown-user', // Not set in permission manager
      };

      const result = await permissionManager.checkToolPermission(
        'WriteTool',
        PermissionAction.WRITE,
        '/etc/config',
        unknownUserContext
      );

      expect(result.tag).toBe('success');
      if (result.tag === 'success') {
        // Unknown user defaults to guest, which shouldn't have write access
        expect(result.value.allowed).toBe(false);
      }
    });

    it.skip('should handle session-only context (no userId)', async () => {
      permissionManager.setSessionRole('test-session', UserRole.OPERATOR);

      const sessionOnlyContext: ToolContext = {
        ...mockToolContext,
        userId: undefined,
      };

      const result = await permissionManager.checkToolPermission(
        'ReadTool',
        PermissionAction.read,
        '/var/log/app.log',
        sessionOnlyContext
      );

      expect(result.tag).toBe('success');
      if (result.tag === 'success') {
        // Operator should have read access
        expect(result.value.allowed).toBe(true);
      }
    });

    it('should provide required role information for denied permissions', async () => {
      permissionManager.setUserRole('low-privilege-user', UserRole.GUEST);

      const lowPrivContext: ToolContext = {
        ...mockToolContext,
        userId: 'low-privilege-user',
      };

      const result = await permissionManager.checkToolPermission(
        'BashTool',
        PermissionAction.EXECUTE,
        '/usr/bin/sudo',
        lowPrivContext
      );

      expect(result.tag).toBe('success');
      if (result.tag === 'success') {
        expect(result.value.allowed).toBe(false);
        expect(result.value.requiredLevel).toBeDefined();
        expect(result.value.reason).toContain('No permission rule found');
      }
    });
  });
});