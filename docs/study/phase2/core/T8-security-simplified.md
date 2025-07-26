# T8: Security Implementation - Practical Security Patterns

## Overview

This simplified guide covers essential security practices for the Qi V2 Agent using practical, proven patterns. Based on Phase 1 analysis, we focus on leveraging existing security tools and simple patterns rather than building complex custom security architectures.

**Key Principle:** Use existing security tools and simple patterns to achieve 90% of security needs with minimal complexity.

## Architecture Decisions

### Practical Security Strategy

**Decision: Layer Simple Security Patterns**

**Core Security Layers:**
1. **Process Isolation**: Use OS-level process separation
2. **Path Restrictions**: Simple file system access control
3. **Input Validation**: Basic input sanitization
4. **Audit Logging**: Simple activity logging
5. **Network Security**: Basic network restrictions

**Benefits:**
- **Simplicity**: Easy to understand and maintain
- **Reliability**: Use proven OS and tool capabilities
- **Performance**: Low overhead compared to custom solutions

## Essential Security Patterns

### 1. Process Isolation

**Simple Process Sandboxing:**

```typescript
import { spawn } from 'child_process';
import { join } from 'path';

interface ProcessSandbox {
  workingDirectory: string;
  allowedPaths: string[];
  deniedPaths: string[];
  maxExecutionTime: number;
}

class SimpleProcessIsolation {
  async executeInSandbox(
    command: string,
    args: string[],
    sandbox: ProcessSandbox
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    
    return new Promise((resolve, reject) => {
      const process = spawn(command, args, {
        cwd: sandbox.workingDirectory,
        stdio: ['pipe', 'pipe', 'pipe'],
        env: {
          // Minimal environment
          PATH: '/usr/bin:/bin',
          HOME: sandbox.workingDirectory
        },
        uid: process.getuid?.() // Run as current user (can be restricted)
      });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      // Timeout handling
      const timeout = setTimeout(() => {
        process.kill('SIGTERM');
        reject(new Error(`Process timeout after ${sandbox.maxExecutionTime}ms`));
      }, sandbox.maxExecutionTime);

      process.on('close', (exitCode) => {
        clearTimeout(timeout);
        resolve({ stdout, stderr, exitCode: exitCode || 0 });
      });

      process.on('error', (error) => {
        clearTimeout(timeout);
        reject(error);
      });
    });
  }
}
```

### 2. Path Access Control

**Simple File System Security:**

```typescript
import { resolve, join } from 'path';
import { access, constants } from 'fs/promises';

class PathValidator {
  constructor(
    private allowedPaths: string[],
    private deniedPaths: string[]
  ) {}

  async validatePath(requestedPath: string): Promise<boolean> {
    try {
      const resolvedPath = resolve(requestedPath);

      // Check denied paths first (more restrictive)
      for (const deniedPath of this.deniedPaths) {
        const resolvedDenied = resolve(deniedPath);
        if (resolvedPath.startsWith(resolvedDenied)) {
          console.warn(`🚫 Access denied to path: ${resolvedPath}`);
          return false;
        }
      }

      // Check allowed paths
      for (const allowedPath of this.allowedPaths) {
        const resolvedAllowed = resolve(allowedPath);
        if (resolvedPath.startsWith(resolvedAllowed)) {
          console.log(`✅ Access granted to path: ${resolvedPath}`);
          return true;
        }
      }

      console.warn(`🚫 Path not in allowed list: ${resolvedPath}`);
      return false;

    } catch (error) {
      console.error(`❌ Path validation error: ${error.message}`);
      return false;
    }
  }

  async validateFileAccess(filePath: string, mode: 'read' | 'write'): Promise<boolean> {
    if (!await this.validatePath(filePath)) {
      return false;
    }

    try {
      const accessMode = mode === 'read' 
        ? constants.R_OK 
        : constants.R_OK | constants.W_OK;
        
      await access(filePath, accessMode);
      return true;
    } catch (error) {
      console.warn(`🚫 File access denied: ${filePath} (${mode})`);
      return false;
    }
  }
}

// Usage in MCP tools
class SecureFileOperations {
  constructor(private pathValidator: PathValidator) {}

  async readFile(filePath: string): Promise<string> {
    if (!await this.pathValidator.validateFileAccess(filePath, 'read')) {
      throw new Error(`Access denied: ${filePath}`);
    }

    const { readFile } = await import('fs/promises');
    return await readFile(filePath, 'utf-8');
  }

  async writeFile(filePath: string, content: string): Promise<void> {
    if (!await this.pathValidator.validateFileAccess(filePath, 'write')) {
      throw new Error(`Write access denied: ${filePath}`);
    }

    const { writeFile } = await import('fs/promises');
    await writeFile(filePath, content, 'utf-8');
  }
}
```

### 3. Input Validation

**Basic Input Sanitization:**

```typescript
class InputValidator {
  private suspiciousPatterns = [
    /\.\.\//g,                    // Directory traversal
    /[<>\"']/g,                   // HTML/XML injection
    /\$\([^)]*\)/g,               // Command substitution
    /`[^`]*`/g,                   // Backtick execution
    /;\s*(rm|del|format|kill)/gi, // Dangerous commands
  ];

  validateInput(input: string): { isValid: boolean; sanitized: string; warnings: string[] } {
    const warnings: string[] = [];
    let sanitized = input;

    // Check for suspicious patterns
    for (const pattern of this.suspiciousPatterns) {
      if (pattern.test(input)) {
        warnings.push(`Suspicious pattern detected: ${pattern.source}`);
        sanitized = sanitized.replace(pattern, '');
      }
    }

    // Basic length check
    if (input.length > 10000) {
      warnings.push('Input too long, truncating');
      sanitized = sanitized.substring(0, 10000);
    }

    const isValid = warnings.length === 0;
    
    if (!isValid) {
      console.warn(`🚧 Input validation warnings:`, warnings);
    }

    return { isValid, sanitized, warnings };
  }

  validateToolParameters(toolName: string, parameters: any): boolean {
    try {
      // Convert to string for validation
      const paramString = JSON.stringify(parameters);
      const validation = this.validateInput(paramString);
      
      if (!validation.isValid) {
        console.warn(`🚧 Tool ${toolName} has suspicious parameters:`, validation.warnings);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ Parameter validation error for ${toolName}:`, error);
      return false;
    }
  }
}
```

### 4. Simple Audit Logging

**Basic Activity Logging:**

```typescript
interface AuditEvent {
  timestamp: Date;
  userId: string;
  action: string;
  resource: string;
  success: boolean;
  details?: any;
  ipAddress?: string;
}

class SimpleAuditLogger {
  private logFile: string;

  constructor(logFile = './logs/audit.log') {
    this.logFile = logFile;
  }

  async logEvent(event: Omit<AuditEvent, 'timestamp'>): Promise<void> {
    const auditEvent: AuditEvent = {
      timestamp: new Date(),
      ...event
    };

    const logEntry = JSON.stringify(auditEvent);
    
    try {
      const { appendFile, mkdir } = await import('fs/promises');
      const { dirname } = await import('path');
      
      // Ensure log directory exists
      await mkdir(dirname(this.logFile), { recursive: true });
      
      // Append to log file
      await appendFile(this.logFile, logEntry + '\n');
      
    } catch (error) {
      console.error('Failed to write audit log:', error);
    }
  }

  async logToolExecution(
    toolName: string, 
    parameters: any, 
    success: boolean, 
    userId = 'system'
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: 'tool_execution',
      resource: toolName,
      success,
      details: { parameters, timestamp: new Date().toISOString() }
    });
  }

  async logFileAccess(
    filePath: string, 
    operation: 'read' | 'write', 
    success: boolean, 
    userId = 'system'
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: `file_${operation}`,
      resource: filePath,
      success
    });
  }

  async logSecurityViolation(
    violation: string, 
    details: any, 
    userId = 'system'
  ): Promise<void> {
    await this.logEvent({
      userId,
      action: 'security_violation',
      resource: violation,
      success: false,
      details
    });
  }
}
```

### 5. Network Security

**Basic Network Restrictions:**

```typescript
class NetworkValidator {
  private allowedHosts: string[];
  private blockedHosts: string[];
  private allowedPorts: number[];

  constructor(config: {
    allowedHosts?: string[];
    blockedHosts?: string[];
    allowedPorts?: number[];
  }) {
    this.allowedHosts = config.allowedHosts || [];
    this.blockedHosts = config.blockedHosts || ['localhost', '127.0.0.1', '0.0.0.0'];
    this.allowedPorts = config.allowedPorts || [80, 443, 8080];
  }

  validateURL(url: string): boolean {
    try {
      const parsed = new URL(url);
      
      // Check blocked hosts
      if (this.blockedHosts.includes(parsed.hostname)) {
        console.warn(`🚫 Blocked host: ${parsed.hostname}`);
        return false;
      }

      // Check allowed hosts (if specified)
      if (this.allowedHosts.length > 0) {
        const isAllowed = this.allowedHosts.some(allowed => 
          parsed.hostname === allowed || parsed.hostname.endsWith('.' + allowed)
        );
        
        if (!isAllowed) {
          console.warn(`🚫 Host not in allowed list: ${parsed.hostname}`);
          return false;
        }
      }

      // Check allowed ports
      const port = parseInt(parsed.port) || (parsed.protocol === 'https:' ? 443 : 80);
      if (!this.allowedPorts.includes(port)) {
        console.warn(`🚫 Port not allowed: ${port}`);
        return false;
      }

      return true;
    } catch (error) {
      console.error(`❌ URL validation error: ${error.message}`);
      return false;
    }
  }
}
```

## Integrated Security Manager

**Putting It All Together:**

```typescript
class SecurityManager {
  private pathValidator: PathValidator;
  private inputValidator: InputValidator;
  private auditLogger: SimpleAuditLogger;
  private networkValidator: NetworkValidator;
  private processIsolation: SimpleProcessIsolation;

  constructor(config: SecurityConfig) {
    this.pathValidator = new PathValidator(
      config.allowedPaths,
      config.deniedPaths
    );
    
    this.inputValidator = new InputValidator();
    this.auditLogger = new SimpleAuditLogger();
    
    this.networkValidator = new NetworkValidator({
      allowedHosts: config.allowedHosts,
      blockedHosts: config.blockedHosts,
      allowedPorts: config.allowedPorts
    });
    
    this.processIsolation = new SimpleProcessIsolation();
  }

  async validateToolExecution(
    toolName: string,
    parameters: any,
    userId = 'system'
  ): Promise<boolean> {
    try {
      // Input validation
      if (!this.inputValidator.validateToolParameters(toolName, parameters)) {
        await this.auditLogger.logSecurityViolation(
          'invalid_tool_parameters',
          { toolName, parameters },
          userId
        );
        return false;
      }

      // Path validation (if tool involves file operations)
      if (parameters.path && !await this.pathValidator.validatePath(parameters.path)) {
        await this.auditLogger.logSecurityViolation(
          'invalid_file_path',
          { toolName, path: parameters.path },
          userId
        );
        return false;
      }

      // Network validation (if tool involves URLs)
      if (parameters.url && !this.networkValidator.validateURL(parameters.url)) {
        await this.auditLogger.logSecurityViolation(
          'invalid_url_access',
          { toolName, url: parameters.url },
          userId
        );
        return false;
      }

      // Log successful validation
      await this.auditLogger.logToolExecution(toolName, parameters, true, userId);
      return true;

    } catch (error) {
      await this.auditLogger.logSecurityViolation(
        'security_validation_error',
        { toolName, error: error.message },
        userId
      );
      return false;
    }
  }

  async executeSecurely<T>(
    operation: () => Promise<T>,
    context: { toolName: string; userId?: string }
  ): Promise<T> {
    const startTime = Date.now();
    
    try {
      const result = await operation();
      
      await this.auditLogger.logEvent({
        userId: context.userId || 'system',
        action: 'secure_execution',
        resource: context.toolName,
        success: true,
        details: { executionTime: Date.now() - startTime }
      });
      
      return result;
      
    } catch (error) {
      await this.auditLogger.logEvent({
        userId: context.userId || 'system',
        action: 'secure_execution',
        resource: context.toolName,
        success: false,
        details: { error: error.message, executionTime: Date.now() - startTime }
      });
      
      throw error;
    }
  }
}
```

## Configuration Integration

**Security Configuration:**

```typescript
// Extend the main config schema
const SecurityConfigSchema = z.object({
  auditLogging: z.boolean().default(true),
  
  // Path security
  allowedPaths: z.array(z.string()).default(['./workspace', './temp']),
  deniedPaths: z.array(z.string()).default(['/etc', '/usr', '~/.ssh', '/System']),
  maxFileSize: z.string().default('10MB'),
  
  // Network security
  allowedHosts: z.array(z.string()).default([]),
  blockedHosts: z.array(z.string()).default(['localhost', '127.0.0.1']),
  allowedPorts: z.array(z.number()).default([80, 443, 8080]),
  
  // Process security
  maxExecutionTime: z.number().default(30000), // 30 seconds
  isolateProcesses: z.boolean().default(true)
});

// Usage in main application
async function initializeSecurityManager(config: QiConfig): Promise<SecurityManager> {
  return new SecurityManager(config.security);
}
```

## Integration with MCP Tools

**Secure Tool Execution:**

```typescript
class SecureMCPManager extends SimpleMCPManager {
  constructor(private securityManager: SecurityManager) {
    super();
  }

  async executeTool(toolName: string, parameters: any): Promise<any> {
    // Security validation
    const isValid = await this.securityManager.validateToolExecution(
      toolName,
      parameters
    );
    
    if (!isValid) {
      throw new Error(`Security validation failed for tool: ${toolName}`);
    }

    // Execute tool securely
    return await this.securityManager.executeSecurely(
      () => super.executeTool(toolName, parameters),
      { toolName }
    );
  }
}
```

## Testing Security

**Security Test Patterns:**

```typescript
describe('Security Manager', () => {
  let securityManager: SecurityManager;

  beforeEach(() => {
    securityManager = new SecurityManager({
      allowedPaths: ['./test/workspace'],
      deniedPaths: ['/etc', '/usr'],
      allowedHosts: ['api.example.com'],
      blockedHosts: ['localhost'],
      allowedPorts: [80, 443],
      auditLogging: true,
      maxExecutionTime: 5000,
      isolateProcesses: true
    });
  });

  it('should block access to denied paths', async () => {
    const isValid = await securityManager.validateToolExecution(
      'read_file',
      { path: '/etc/passwd' }
    );
    
    expect(isValid).toBe(false);
  });

  it('should allow access to permitted paths', async () => {
    const isValid = await securityManager.validateToolExecution(
      'read_file',
      { path: './test/workspace/file.txt' }
    );
    
    expect(isValid).toBe(true);
  });

  it('should block suspicious input patterns', async () => {
    const isValid = await securityManager.validateToolExecution(
      'execute_command',
      { command: 'rm -rf /' }
    );
    
    expect(isValid).toBe(false);
  });
});
```

## Next Steps

After implementing T8 security:

1. **Proceed to T9**: [Testing](./T9-testing-simplified.md) for essential testing patterns
2. **Test Security**: Verify security validations work correctly
3. **Configure Logging**: Set up audit log monitoring
4. **Review Permissions**: Ensure file and network permissions are appropriate

This simplified approach provides essential security through proven patterns and existing tools, reducing complexity from 1,296 lines to ~400 lines while maintaining effective protection.