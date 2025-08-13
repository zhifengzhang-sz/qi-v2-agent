# Security Framework and Protection Mechanisms

Claude Code implements a comprehensive 6-layer security architecture designed to protect against various threats while maintaining functionality and performance.

## Security Architecture Overview

The multi-layered security model provides defense in depth through overlapping protection mechanisms:

```
┌─────────────────────────────────────────────────────────────────┐
│                 Claude Code 6-Layer Security Architecture      │
├─────────────────────────────────────────────────────────────────┤
│                        Layer 1: Input Validation              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Zod Schema  │  │ Type Safety │  │ Parameter           │      │
│  │ Validation  │  │ Enforcement │  │ Sanitization        │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                        Layer 2: Permission Control            │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Role-Based  │  │ Tool-Level  │  │ Resource Access     │      │
│  │ Access      │  │ Permissions │  │ Controls            │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                        Layer 3: Execution Isolation           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Sandbox     │  │ Write       │  │ Network Domain      │      │
│  │ Environment │  │ Restrictions│  │ Whitelist           │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                        Layer 4: Execution Monitoring          │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │AbortController│ │ Timeout     │  │ Resource Limits     │      │
│  │ Interruption │  │ Prevention  │  │ Memory/CPU          │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                        Layer 5: Error Recovery               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Exception   │  │ Error       │  │ Automatic Retry     │      │
│  │ Handling    │  │ Classification│  │ & Degradation       │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                        Layer 6: Audit & Compliance           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Operation   │  │ Security    │  │ Compliance          │      │
│  │ Logging     │  │ Events      │  │ Reporting           │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Layer 1: Input Validation and Sanitization

### 1.1 Zod Schema Validation

All tool inputs undergo rigorous schema validation before execution:

```typescript
import { z } from 'zod';

// Example: File Path Validation Schema
const filePathSchema = z.object({
  file_path: z.string()
    .min(1, "File path cannot be empty")
    .refine(path => path.isAbsolute(), {
      message: "Absolute path required for security"
    })
    .refine(path => !path.includes('..'), {
      message: "Path traversal attempts blocked"
    })
    .refine(path => !BLOCKED_PATHS.some(blocked => path.startsWith(blocked)), {
      message: "Access to system directories denied"
    }),
  
  limit: z.number()
    .int()
    .min(1)
    .max(10000)
    .optional(),
    
  offset: z.number()
    .int()
    .min(0)
    .optional()
});

// Command Execution Schema with Security Constraints
const bashCommandSchema = z.object({
  command: z.string()
    .min(1)
    .max(10000)
    .refine(cmd => !DANGEROUS_COMMANDS.some(danger => cmd.includes(danger)), {
      message: "Dangerous command detected"
    })
    .refine(cmd => !hasCodeInjectionPatterns(cmd), {
      message: "Code injection attempt blocked"
    }),
    
  timeout: z.number()
    .int()
    .min(1000)
    .max(600000)
    .default(120000),
    
  run_in_background: z.boolean().optional()
});
```

### 1.2 Parameter Sanitization

```javascript
class InputSanitizer {
  static sanitizeFilePath(path) {
    // Normalize path separators
    path = path.replace(/\\/g, '/');
    
    // Remove dangerous sequences
    path = path.replace(/\.\.+/g, '');
    
    // Validate against whitelist patterns
    if (!this.isAllowedPath(path)) {
      throw new SecurityError('Path access denied');
    }
    
    return path;
  }
  
  static sanitizeCommand(command) {
    // Remove dangerous injection patterns
    const cleaned = command
      .replace(/[;&|`$(){}]/g, '') // Shell metacharacters
      .replace(/\$\([^)]*\)/g, '') // Command substitution
      .replace(/`[^`]*`/g, '');    // Backtick execution
    
    // Verify command is still functional after sanitization
    if (cleaned.length === 0) {
      throw new SecurityError('Command sanitization removed all content');
    }
    
    return cleaned;
  }
  
  static detectMaliciousContent(content) {
    const maliciousPatterns = [
      /eval\s*\(/i,                // JavaScript eval
      /<script.*?>.*?<\/script>/i,  // Script tags
      /javascript:/i,               // JavaScript URLs
      /on\w+\s*=/i,                // Event handlers
      /\$\{.*?\}/,                 // Template injection
      /<%.*?%>/,                   // Server-side includes
    ];
    
    return maliciousPatterns.some(pattern => pattern.test(content));
  }
}
```

## Layer 2: Permission Control System

### 2.1 Role-Based Access Control

```typescript
enum UserRole {
  VIEWER = 'viewer',
  EDITOR = 'editor',
  ADMIN = 'admin'
}

enum ToolPermission {
  READ = 'read',
  WRITE = 'write',
  EXECUTE = 'execute',
  NETWORK = 'network',
  SYSTEM = 'system'
}

interface PermissionMatrix {
  [UserRole.VIEWER]: ToolPermission[];
  [UserRole.EDITOR]: ToolPermission[];
  [UserRole.ADMIN]: ToolPermission[];
}

const PERMISSION_MATRIX: PermissionMatrix = {
  [UserRole.VIEWER]: [
    ToolPermission.READ
  ],
  [UserRole.EDITOR]: [
    ToolPermission.READ,
    ToolPermission.WRITE,
    ToolPermission.NETWORK
  ],
  [UserRole.ADMIN]: [
    ToolPermission.READ,
    ToolPermission.WRITE,
    ToolPermission.EXECUTE,
    ToolPermission.NETWORK,
    ToolPermission.SYSTEM
  ]
};
```

### 2.2 Tool-Level Permission Checks

```javascript
class PermissionGateway {
  async checkToolPermissions(toolName, params, context) {
    const tool = await this.resolveTool(toolName);
    const userRole = context.user.role;
    
    // Built-in tool permission check
    const toolCheck = await tool.checkPermissions(params, context);
    if (toolCheck?.behavior === 'deny') {
      this.logSecurityEvent('PERMISSION_DENIED', {
        tool: toolName,
        user: context.user.id,
        reason: toolCheck.denialReason
      });
      return toolCheck;
    }
    
    // System-level permission enforcement
    const requiredPermissions = this.getRequiredPermissions(toolName, params);
    const userPermissions = PERMISSION_MATRIX[userRole];
    
    const hasPermission = requiredPermissions.every(
      required => userPermissions.includes(required)
    );
    
    if (!hasPermission) {
      return {
        behavior: 'deny',
        denialReason: `Insufficient permissions for ${toolName}`
      };
    }
    
    // Context-specific checks
    return this.performContextualChecks(toolName, params, context);
  }
  
  getRequiredPermissions(toolName, params) {
    const permissionMap = {
      'read': [ToolPermission.READ],
      'write': [ToolPermission.WRITE],
      'edit': [ToolPermission.WRITE],
      'multiedit': [ToolPermission.WRITE],
      'bash': [ToolPermission.EXECUTE],
      'webfetch': [ToolPermission.NETWORK],
      'websearch': [ToolPermission.NETWORK],
    };
    
    return permissionMap[toolName] || [ToolPermission.READ];
  }
}
```

### 2.3 Resource Access Controls

```javascript
class ResourceAccessController {
  constructor() {
    this.allowedPaths = new Set([
      '/home/user/projects',
      '/tmp/claude-code',
      '/var/log/claude-code'
    ]);
    
    this.blockedPaths = new Set([
      '/etc',
      '/usr/bin',
      '/root',
      '/var/lib',
      '/sys',
      '/proc'
    ]);
    
    this.allowedDomains = new Set([
      'github.com',
      'api.example.com',
      'docs.anthropic.com'
    ]);
  }
  
  validateFileAccess(filePath, accessType) {
    // Check blocked paths
    if (this.blockedPaths.some(blocked => filePath.startsWith(blocked))) {
      throw new SecurityError(`Access denied to system path: ${filePath}`);
    }
    
    // Check allowed paths
    const isAllowed = this.allowedPaths.some(allowed => 
      filePath.startsWith(allowed)
    );
    
    if (!isAllowed && accessType === 'write') {
      throw new SecurityError(`Write access denied to path: ${filePath}`);
    }
    
    return true;
  }
  
  validateNetworkAccess(url) {
    const parsedUrl = new URL(url);
    
    // Domain whitelist check
    if (!this.allowedDomains.has(parsedUrl.hostname)) {
      throw new SecurityError(`Network access denied to domain: ${parsedUrl.hostname}`);
    }
    
    // Protocol validation
    if (!['http:', 'https:'].includes(parsedUrl.protocol)) {
      throw new SecurityError(`Unsupported protocol: ${parsedUrl.protocol}`);
    }
    
    return true;
  }
}
```

## Layer 3: Execution Isolation

### 3.1 Sandbox Environment

```javascript
class ExecutionSandbox {
  constructor() {
    this.isolationLevel = 'strict';
    this.resourceLimits = {
      memory: 512 * 1024 * 1024,  // 512MB
      timeout: 120000,             // 2 minutes
      fileDescriptors: 100,
      networkConnections: 10
    };
  }
  
  async createIsolatedEnvironment(toolName) {
    const environment = {
      workingDirectory: await this.createTempDirectory(),
      environmentVariables: this.getSafeEnvironmentVariables(),
      resourceMonitor: new ResourceMonitor(this.resourceLimits),
      abortController: new AbortController()
    };
    
    // Set up resource monitoring
    environment.resourceMonitor.on('limit_exceeded', (resource) => {
      this.handleResourceLimitExceeded(resource, environment);
    });
    
    return environment;
  }
  
  getSafeEnvironmentVariables() {
    // Only expose safe environment variables
    const allowedVars = ['PATH', 'HOME', 'TMPDIR', 'LANG'];
    const safeEnv = {};
    
    for (const key of allowedVars) {
      if (process.env[key]) {
        safeEnv[key] = process.env[key];
      }
    }
    
    return safeEnv;
  }
  
  async handleResourceLimitExceeded(resource, environment) {
    this.logSecurityEvent('RESOURCE_LIMIT_EXCEEDED', {
      resource,
      environment: environment.workingDirectory
    });
    
    // Abort execution
    environment.abortController.abort();
    
    // Cleanup resources
    await this.cleanupEnvironment(environment);
  }
}
```

### 3.2 Network Isolation

```javascript
class NetworkIsolationManager {
  constructor() {
    this.allowedEndpoints = new Map([
      ['api.anthropic.com', { protocols: ['https'], ports: [443] }],
      ['github.com', { protocols: ['https'], ports: [443] }],
      ['localhost', { protocols: ['http', 'https'], ports: [3000, 8000, 8080] }]
    ]);
  }
  
  async createNetworkProxy(targetUrl) {
    const url = new URL(targetUrl);
    
    // Validate against whitelist
    const allowedConfig = this.allowedEndpoints.get(url.hostname);
    if (!allowedConfig) {
      throw new SecurityError(`Network access denied to ${url.hostname}`);
    }
    
    // Protocol validation
    if (!allowedConfig.protocols.includes(url.protocol.slice(0, -1))) {
      throw new SecurityError(`Protocol ${url.protocol} not allowed for ${url.hostname}`);
    }
    
    // Port validation
    const port = parseInt(url.port) || (url.protocol === 'https:' ? 443 : 80);
    if (!allowedConfig.ports.includes(port)) {
      throw new SecurityError(`Port ${port} not allowed for ${url.hostname}`);
    }
    
    return this.createSecureProxy(url);
  }
  
  createSecureProxy(url) {
    return {
      url: url.toString(),
      headers: this.getSafeHeaders(),
      timeout: 30000,
      maxRedirects: 3,
      maxResponseSize: 10 * 1024 * 1024 // 10MB
    };
  }
}
```

## Layer 4: Execution Monitoring

### 4.1 Real-time Resource Monitoring

```javascript
class ResourceMonitor extends EventEmitter {
  constructor(limits) {
    super();
    this.limits = limits;
    this.currentUsage = {
      memory: 0,
      cpu: 0,
      fileDescriptors: 0,
      networkConnections: 0
    };
    
    this.monitoringInterval = setInterval(() => {
      this.checkResourceUsage();
    }, 1000);
  }
  
  checkResourceUsage() {
    const memoryUsage = process.memoryUsage();
    this.currentUsage.memory = memoryUsage.heapUsed;
    
    // Check memory limits
    if (this.currentUsage.memory > this.limits.memory) {
      this.emit('limit_exceeded', {
        resource: 'memory',
        current: this.currentUsage.memory,
        limit: this.limits.memory
      });
    }
    
    // Monitor file descriptor usage
    this.currentUsage.fileDescriptors = this.getOpenFileDescriptors();
    if (this.currentUsage.fileDescriptors > this.limits.fileDescriptors) {
      this.emit('limit_exceeded', {
        resource: 'file_descriptors',
        current: this.currentUsage.fileDescriptors,
        limit: this.limits.fileDescriptors
      });
    }
  }
  
  getOpenFileDescriptors() {
    try {
      return require('fs').readdirSync('/proc/self/fd').length;
    } catch (error) {
      return 0; // Fallback for non-Linux systems
    }
  }
}
```

### 4.2 Timeout and Interruption Control

```javascript
class ExecutionController {
  async executeWithTimeout(operation, timeoutMs = 120000) {
    const abortController = new AbortController();
    const timeoutId = setTimeout(() => {
      abortController.abort('Execution timeout');
    }, timeoutMs);
    
    try {
      const result = await Promise.race([
        operation({ signal: abortController.signal }),
        this.createTimeoutPromise(timeoutMs)
      ]);
      
      clearTimeout(timeoutId);
      return result;
      
    } catch (error) {
      clearTimeout(timeoutId);
      
      if (error.name === 'AbortError') {
        this.logSecurityEvent('EXECUTION_TIMEOUT', {
          operation: operation.name,
          timeout: timeoutMs
        });
        
        throw new TimeoutError(`Operation timed out after ${timeoutMs}ms`);
      }
      
      throw error;
    }
  }
  
  createTimeoutPromise(timeoutMs) {
    return new Promise((_, reject) => {
      setTimeout(() => {
        reject(new Error(`Operation timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });
  }
}
```

## Layer 5: Error Recovery and Handling

### 5.1 Exception Handling Framework

```javascript
class SecurityErrorHandler {
  constructor() {
    this.errorClassifications = {
      'SecurityError': 'critical',
      'TimeoutError': 'warning',
      'ValidationError': 'error',
      'ResourceError': 'warning',
      'PermissionError': 'critical'
    };
    
    this.recoveryStrategies = new Map([
      ['critical', this.criticalErrorRecovery],
      ['error', this.standardErrorRecovery],
      ['warning', this.warningRecovery]
    ]);
  }
  
  async handleError(error, context) {
    const classification = this.classifyError(error);
    const recovery = this.recoveryStrategies.get(classification);
    
    // Log security event
    this.logSecurityEvent('ERROR_HANDLED', {
      type: error.constructor.name,
      message: error.message,
      classification,
      context: this.sanitizeContext(context)
    });
    
    // Execute recovery strategy
    return await recovery.call(this, error, context);
  }
  
  async criticalErrorRecovery(error, context) {
    // Immediately halt all operations
    await this.emergencyShutdown(context);
    
    // Notify administrators
    await this.notifySecurityTeam(error, context);
    
    // Return safe error response
    return {
      success: false,
      error: 'A security error occurred. Operations have been halted.',
      shouldTerminate: true
    };
  }
  
  async standardErrorRecovery(error, context) {
    // Attempt graceful recovery
    const fallbackResult = await this.attemptFallback(context);
    
    if (fallbackResult) {
      return fallbackResult;
    }
    
    // Return error with retry suggestion
    return {
      success: false,
      error: error.message,
      canRetry: this.isRetryable(error)
    };
  }
}
```

### 5.2 Automatic Retry and Degradation

```javascript
class RetryManager {
  constructor() {
    this.maxRetries = 3;
    this.baseDelay = 1000;
    this.maxDelay = 10000;
    this.backoffMultiplier = 2;
  }
  
  async executeWithRetry(operation, context) {
    let lastError;
    
    for (let attempt = 0; attempt <= this.maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        lastError = error;
        
        // Don't retry security errors
        if (error instanceof SecurityError) {
          throw error;
        }
        
        // Don't retry on last attempt
        if (attempt === this.maxRetries) {
          break;
        }
        
        // Calculate delay with exponential backoff
        const delay = Math.min(
          this.baseDelay * Math.pow(this.backoffMultiplier, attempt),
          this.maxDelay
        );
        
        await this.delay(delay);
      }
    }
    
    // All retries failed - attempt degraded operation
    return this.attemptDegradedOperation(lastError, context);
  }
  
  async attemptDegradedOperation(error, context) {
    // Try to provide partial functionality
    const degradedStrategies = [
      this.tryReadOnlyMode,
      this.tryCachedResult,
      this.tryMinimalFunctionality
    ];
    
    for (const strategy of degradedStrategies) {
      try {
        const result = await strategy(error, context);
        if (result) {
          return {
            ...result,
            degraded: true,
            originalError: error.message
          };
        }
      } catch (degradedError) {
        // Continue to next strategy
      }
    }
    
    throw lastError;
  }
}
```

## Layer 6: Audit and Compliance

### 6.1 Comprehensive Logging System

```javascript
class SecurityAuditLogger {
  constructor() {
    this.logLevels = ['DEBUG', 'INFO', 'WARN', 'ERROR', 'CRITICAL'];
    this.sensitiveFields = ['password', 'token', 'key', 'secret'];
  }
  
  logSecurityEvent(eventType, details) {
    const auditEntry = {
      timestamp: new Date().toISOString(),
      eventType,
      sessionId: details.sessionId,
      userId: details.userId,
      toolName: details.toolName,
      action: details.action,
      result: details.result,
      ipAddress: this.hashIP(details.ipAddress),
      userAgent: details.userAgent,
      details: this.sanitizeLogData(details)
    };
    
    // Store in secure audit log
    this.writeToAuditLog(auditEntry);
    
    // Send real-time alerts for critical events
    if (this.isCriticalEvent(eventType)) {
      this.sendSecurityAlert(auditEntry);
    }
  }
  
  sanitizeLogData(data) {
    const sanitized = { ...data };
    
    // Remove or hash sensitive information
    this.sensitiveFields.forEach(field => {
      if (sanitized[field]) {
        sanitized[field] = this.hashSensitiveData(sanitized[field]);
      }
    });
    
    // Truncate large data
    Object.keys(sanitized).forEach(key => {
      if (typeof sanitized[key] === 'string' && sanitized[key].length > 1000) {
        sanitized[key] = sanitized[key].substring(0, 1000) + '... [truncated]';
      }
    });
    
    return sanitized;
  }
  
  isCriticalEvent(eventType) {
    const criticalEvents = [
      'PERMISSION_DENIED',
      'SECURITY_VIOLATION',
      'INJECTION_ATTEMPT',
      'RESOURCE_LIMIT_EXCEEDED',
      'AUTHENTICATION_FAILURE'
    ];
    
    return criticalEvents.includes(eventType);
  }
}
```

### 6.2 Compliance Monitoring

```javascript
class ComplianceMonitor {
  constructor() {
    this.complianceRules = {
      dataRetention: 90, // days
      maxFailedAttempts: 5,
      sessionTimeout: 3600000, // 1 hour
      auditLogIntegrity: true
    };
  }
  
  async performComplianceCheck() {
    const results = {
      timestamp: new Date().toISOString(),
      checks: []
    };
    
    // Data retention compliance
    results.checks.push(
      await this.checkDataRetention()
    );
    
    // Access pattern analysis
    results.checks.push(
      await this.analyzeAccessPatterns()
    );
    
    // Audit log integrity
    results.checks.push(
      await this.verifyAuditLogIntegrity()
    );
    
    // Generate compliance report
    return this.generateComplianceReport(results);
  }
  
  async checkDataRetention() {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - this.complianceRules.dataRetention);
    
    const oldRecords = await this.findRecordsOlderThan(cutoffDate);
    
    if (oldRecords.length > 0) {
      await this.scheduleDataCleanup(oldRecords);
    }
    
    return {
      check: 'data_retention',
      status: 'compliant',
      details: `${oldRecords.length} records scheduled for cleanup`
    };
  }
}
```

This comprehensive security framework ensures Claude Code operates safely while providing enterprise-grade protection against various security threats and compliance requirements.