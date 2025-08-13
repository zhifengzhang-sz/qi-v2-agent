/**
 * @qi/tools - Security Gateway
 *
 * Multi-layer security gateway that provides:
 * - Input sanitization and validation
 * - Output filtering for sensitive data
 * - Rate limiting and abuse prevention
 * - Security audit logging
 * - Threat detection and prevention
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
import { createQiLogger } from '../../utils/QiCoreLogger.js';
import type { ToolCall, ToolContext, ToolResult } from '../core/interfaces/ITool.js';

/**
 * Security threat levels
 */
export enum ThreatLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical',
}

/**
 * Security violation types
 */
export enum ViolationType {
  INJECTION_ATTEMPT = 'injection_attempt',
  PATH_TRAVERSAL = 'path_traversal',
  RATE_LIMIT_EXCEEDED = 'rate_limit_exceeded',
  SUSPICIOUS_PATTERN = 'suspicious_pattern',
  UNAUTHORIZED_ACCESS = 'unauthorized_access',
  DATA_EXFILTRATION = 'data_exfiltration',
  PRIVILEGE_ESCALATION = 'privilege_escalation',
}

/**
 * Security violation record
 */
interface SecurityViolation {
  readonly timestamp: number;
  readonly sessionId: string;
  readonly userId?: string;
  readonly toolName: string;
  readonly violationType: ViolationType;
  readonly threatLevel: ThreatLevel;
  readonly description: string;
  readonly input?: any;
  readonly blockedOutput?: any;
  readonly ipAddress?: string;
  readonly metadata: Record<string, unknown>;
}

/**
 * Rate limiting configuration
 */
interface RateLimitConfig {
  readonly windowMs: number; // Time window in milliseconds
  readonly maxRequests: number; // Maximum requests per window
  readonly burstLimit: number; // Burst allowance
  readonly blockDurationMs: number; // Block duration when exceeded
}

/**
 * Input sanitization rule
 */
interface SanitizationRule {
  readonly name: string;
  readonly pattern: RegExp;
  readonly threatLevel: ThreatLevel;
  readonly action: 'block' | 'sanitize' | 'warn';
  readonly replacement?: string;
}

/**
 * Output filter rule
 */
interface OutputFilterRule {
  readonly name: string;
  readonly pattern: RegExp;
  readonly threatLevel: ThreatLevel;
  readonly action: 'redact' | 'block' | 'warn';
  readonly replacement?: string;
}

/**
 * Security statistics
 */
interface SecurityStats {
  readonly totalRequests: number;
  readonly blockedRequests: number;
  readonly sanitizedInputs: number;
  readonly filteredOutputs: number;
  readonly violationsByType: Record<ViolationType, number>;
  readonly violationsByThreatLevel: Record<ThreatLevel, number>;
  readonly rateLimitHits: number;
}

/**
 * Mutable security statistics for internal use
 */
interface MutableSecurityStats {
  totalRequests: number;
  blockedRequests: number;
  sanitizedInputs: number;
  filteredOutputs: number;
  violationsByType: Record<ViolationType, number>;
  violationsByThreatLevel: Record<ThreatLevel, number>;
  rateLimitHits: number;
}

/**
 * Security error with enhanced context
 */
interface SecurityError extends QiError {
  context: {
    sessionId?: string;
    userId?: string;
    toolName?: string;
    violationType?: ViolationType;
    threatLevel?: ThreatLevel;
    blocked?: boolean;
  };
}

const securityError = (
  code: string,
  message: string,
  category: 'VALIDATION' | 'SYSTEM' | 'NETWORK' | 'BUSINESS',
  context: SecurityError['context'] = {}
): SecurityError => create(code, message, category, context) as SecurityError;

/**
 * Default security configurations
 */
const DEFAULT_RATE_LIMITS: Record<string, RateLimitConfig> = {
  default: {
    windowMs: 60000, // 1 minute
    maxRequests: 100,
    burstLimit: 20,
    blockDurationMs: 300000, // 5 minutes
  },
  system: {
    windowMs: 60000,
    maxRequests: 10, // Stricter for system tools
    burstLimit: 3,
    blockDurationMs: 600000, // 10 minutes
  },
  file: {
    windowMs: 60000,
    maxRequests: 50,
    burstLimit: 10,
    blockDurationMs: 300000,
  },
};

const DEFAULT_SANITIZATION_RULES: SanitizationRule[] = [
  // SQL Injection
  {
    name: 'sql_injection',
    pattern: /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT)\b|[';])/gi,
    threatLevel: ThreatLevel.HIGH,
    action: 'block',
  },

  // Command Injection
  {
    name: 'command_injection',
    pattern: /[;&|`$(){}[\]\\]/g,
    threatLevel: ThreatLevel.HIGH,
    action: 'sanitize',
    replacement: '',
  },

  // Path Traversal
  {
    name: 'path_traversal',
    pattern: /\.\.[/\\]/g,
    threatLevel: ThreatLevel.MEDIUM,
    action: 'block',
  },

  // Script Injection
  {
    name: 'script_injection',
    pattern: /<script[^>]*>.*?<\/script>/gi,
    threatLevel: ThreatLevel.HIGH,
    action: 'sanitize',
    replacement: '',
  },

  // Null bytes
  {
    name: 'null_bytes',
    pattern: /\0/g,
    threatLevel: ThreatLevel.MEDIUM,
    action: 'sanitize',
    replacement: '',
  },
];

const DEFAULT_OUTPUT_FILTER_RULES: OutputFilterRule[] = [
  // API Keys
  {
    name: 'api_keys',
    pattern: /\b[A-Za-z0-9]{32,}\b/g,
    threatLevel: ThreatLevel.HIGH,
    action: 'redact',
    replacement: '[REDACTED_API_KEY]',
  },

  // JWT Tokens
  {
    name: 'jwt_tokens',
    pattern: /eyJ[A-Za-z0-9_-]*\.eyJ[A-Za-z0-9_-]*\.[A-Za-z0-9_-]*/g,
    threatLevel: ThreatLevel.HIGH,
    action: 'redact',
    replacement: '[REDACTED_JWT_TOKEN]',
  },

  // SSH Keys
  {
    name: 'ssh_keys',
    pattern: /-----BEGIN [A-Z ]+-----[\s\S]*?-----END [A-Z ]+-----/g,
    threatLevel: ThreatLevel.CRITICAL,
    action: 'redact',
    replacement: '[REDACTED_SSH_KEY]',
  },

  // Credit Card Numbers
  {
    name: 'credit_cards',
    pattern: /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
    threatLevel: ThreatLevel.CRITICAL,
    action: 'redact',
    replacement: '[REDACTED_CREDIT_CARD]',
  },

  // Email Addresses (optional, based on privacy requirements)
  {
    name: 'email_addresses',
    pattern: /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/g,
    threatLevel: ThreatLevel.LOW,
    action: 'warn',
  },
];

/**
 * Security Gateway - Multi-layer Protection
 */
export class SecurityGateway {
  private logger: any;
  private violations: SecurityViolation[] = [];
  private rateLimitTracking = new Map<
    string,
    { count: number; windowStart: number; blocked: boolean; blockUntil: number }
  >();

  // Configuration
  private sanitizationRules: SanitizationRule[] = [];
  private outputFilterRules: OutputFilterRule[] = [];
  private rateLimits: Record<string, RateLimitConfig> = {};

  // Statistics
  private stats: MutableSecurityStats = {
    totalRequests: 0,
    blockedRequests: 0,
    sanitizedInputs: 0,
    filteredOutputs: 0,
    violationsByType: {} as Record<ViolationType, number>,
    violationsByThreatLevel: {} as Record<ThreatLevel, number>,
    rateLimitHits: 0,
  };

  // Settings
  private readonly maxViolationHistory = 10000;
  private readonly enableSecurityLogging = true;

  constructor() {
    this.sanitizationRules = [...DEFAULT_SANITIZATION_RULES];
    this.outputFilterRules = [...DEFAULT_OUTPUT_FILTER_RULES];
    this.rateLimits = { ...DEFAULT_RATE_LIMITS };

    this.logger = createQiLogger({
      name: 'SecurityGateway',
      level: process.env.NODE_ENV === 'development' ? 'debug' : 'info',
      pretty: process.env.NODE_ENV === 'development',
    });

    // Initialize violation counters
    for (const violationType of Object.values(ViolationType)) {
      this.stats.violationsByType[violationType] = 0;
    }
    for (const threatLevel of Object.values(ThreatLevel)) {
      this.stats.violationsByThreatLevel[threatLevel] = 0;
    }

    // Start periodic cleanup
    this.startPeriodicCleanup();
  }

  /**
   * Validate and sanitize input before tool execution
   */
  async validateInput(call: ToolCall, context: ToolContext): Promise<Result<ToolCall, QiError>> {
    this.stats.totalRequests++;

    try {
      // Rate limiting check
      const rateLimitResult = await this.checkRateLimit(call.toolName, context);
      if (rateLimitResult.tag === 'failure') {
        this.stats.blockedRequests++;
        return rateLimitResult;
      }

      // Input sanitization
      const sanitizationResult = await this.sanitizeInput(call, context);
      if (sanitizationResult.tag === 'failure') {
        this.stats.blockedRequests++;
        return sanitizationResult;
      }

      return success(sanitizationResult.value);
    } catch (error) {
      return failure(
        securityError(
          'INPUT_VALIDATION_FAILED',
          `Input validation failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          {
            sessionId: context.sessionId,
            userId: context.userId,
            toolName: call.toolName,
          }
        )
      );
    }
  }

  /**
   * Filter and sanitize output before returning to user
   */
  async filterOutput<T>(
    result: ToolResult<T>,
    context: ToolContext
  ): Promise<Result<ToolResult<T>, QiError>> {
    try {
      if (!result.success || !result.output) {
        return success(result); // No output to filter
      }

      // Convert output to string for filtering
      const outputString =
        typeof result.output === 'string' ? result.output : JSON.stringify(result.output);

      let filteredOutput = outputString;
      let hasFiltering = false;

      // Apply output filter rules
      for (const rule of this.outputFilterRules) {
        if (rule.pattern.test(filteredOutput)) {
          hasFiltering = true;

          switch (rule.action) {
            case 'block':
              await this.logSecurityViolation(
                ViolationType.DATA_EXFILTRATION,
                rule.threatLevel,
                `Output blocked due to sensitive content: ${rule.name}`,
                context,
                result.toolName,
                undefined,
                { filteredContent: true }
              );

              return failure(
                securityError(
                  'OUTPUT_BLOCKED',
                  'Output contains sensitive information and has been blocked',
                  'VALIDATION',
                  {
                    sessionId: context.sessionId,
                    toolName: result.toolName,
                    threatLevel: rule.threatLevel,
                    blocked: true,
                  }
                )
              );

            case 'redact':
              filteredOutput = filteredOutput.replace(
                rule.pattern,
                rule.replacement || '[REDACTED]'
              );
              this.stats.filteredOutputs++;
              break;

            case 'warn':
              await this.logSecurityViolation(
                ViolationType.DATA_EXFILTRATION,
                rule.threatLevel,
                `Potential sensitive data in output: ${rule.name}`,
                context,
                result.toolName,
                undefined,
                { potentiallyExposed: true }
              );
              break;
          }
        }
      }

      // Create filtered result
      const filteredResult: ToolResult<T> = {
        ...result,
        output: (typeof result.output === 'string'
          ? filteredOutput
          : JSON.parse(filteredOutput)) as T,
        metadata: new Map([
          ...Array.from(result.metadata.entries()),
          ...(hasFiltering ? [['outputFiltered', 'true'] as [string, unknown]] : []),
        ]),
      };

      return success(filteredResult);
    } catch (error) {
      return failure(
        securityError(
          'OUTPUT_FILTERING_FAILED',
          `Output filtering failed: ${error instanceof Error ? error.message : String(error)}`,
          'SYSTEM',
          {
            sessionId: context.sessionId,
            toolName: result.toolName,
          }
        )
      );
    }
  }

  /**
   * Get security violations (for monitoring/alerting)
   */
  getSecurityViolations(limit?: number): readonly SecurityViolation[] {
    const violations = limit ? this.violations.slice(-limit) : this.violations;
    return violations.slice(); // Return copy
  }

  /**
   * Get security statistics
   */
  getSecurityStats(): SecurityStats {
    return {
      ...this.stats,
      violationsByType: { ...this.stats.violationsByType },
      violationsByThreatLevel: { ...this.stats.violationsByThreatLevel },
    };
  }

  /**
   * Add custom sanitization rule
   */
  addSanitizationRule(rule: SanitizationRule): Result<void, QiError> {
    try {
      // Validate rule
      new RegExp(rule.pattern); // Test if pattern is valid regex
      this.sanitizationRules.push(rule);

      this.logger.info('Sanitization rule added', {
        component: 'SecurityGateway',
        method: 'addSanitizationRule',
        ruleName: rule.name,
        threatLevel: rule.threatLevel,
        action: rule.action,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        securityError(
          'INVALID_SANITIZATION_RULE',
          `Invalid sanitization rule: ${error instanceof Error ? error.message : String(error)}`,
          'VALIDATION'
        )
      );
    }
  }

  /**
   * Add custom output filter rule
   */
  addOutputFilterRule(rule: OutputFilterRule): Result<void, QiError> {
    try {
      // Validate rule
      new RegExp(rule.pattern); // Test if pattern is valid regex
      this.outputFilterRules.push(rule);

      this.logger.info('Output filter rule added', {
        component: 'SecurityGateway',
        method: 'addOutputFilterRule',
        ruleName: rule.name,
        threatLevel: rule.threatLevel,
        action: rule.action,
      });

      return success(undefined);
    } catch (error) {
      return failure(
        securityError(
          'INVALID_OUTPUT_FILTER_RULE',
          `Invalid output filter rule: ${error instanceof Error ? error.message : String(error)}`,
          'VALIDATION'
        )
      );
    }
  }

  /**
   * Update rate limit configuration
   */
  updateRateLimit(toolCategory: string, config: RateLimitConfig): Result<void, QiError> {
    if (config.windowMs <= 0 || config.maxRequests <= 0) {
      return failure(
        securityError(
          'INVALID_RATE_LIMIT_CONFIG',
          'Rate limit configuration must have positive values for windowMs and maxRequests',
          'VALIDATION'
        )
      );
    }

    this.rateLimits[toolCategory] = config;

    this.logger.info('Rate limit updated', {
      component: 'SecurityGateway',
      method: 'updateRateLimit',
      toolCategory,
      config,
    });

    return success(undefined);
  }

  /**
   * Clear security violation history
   */
  clearViolationHistory(): Result<number, QiError> {
    const count = this.violations.length;
    this.violations = [];

    // Reset violation counters
    for (const violationType of Object.values(ViolationType)) {
      this.stats.violationsByType[violationType] = 0;
    }
    for (const threatLevel of Object.values(ThreatLevel)) {
      this.stats.violationsByThreatLevel[threatLevel] = 0;
    }

    return success(count);
  }

  // Private helper methods

  private async checkRateLimit(
    toolName: string,
    context: ToolContext
  ): Promise<Result<void, QiError>> {
    const key = `${context.sessionId}:${toolName}`;
    const now = Date.now();

    // Determine rate limit configuration
    const toolCategory = this.getToolCategory(toolName);
    const config = this.rateLimits[toolCategory] || this.rateLimits.default;

    let tracking = this.rateLimitTracking.get(key);

    if (!tracking) {
      tracking = {
        count: 0,
        windowStart: now,
        blocked: false,
        blockUntil: 0,
      };
      this.rateLimitTracking.set(key, tracking);
    }

    // Check if currently blocked
    if (tracking.blocked && now < tracking.blockUntil) {
      await this.logSecurityViolation(
        ViolationType.RATE_LIMIT_EXCEEDED,
        ThreatLevel.MEDIUM,
        `Rate limit block still active for ${toolName}`,
        context,
        toolName,
        undefined,
        { remainingBlockTime: tracking.blockUntil - now }
      );

      return failure(
        securityError(
          'RATE_LIMIT_BLOCKED',
          `Tool execution blocked due to rate limit. Try again in ${Math.ceil((tracking.blockUntil - now) / 1000)} seconds`,
          'VALIDATION',
          {
            sessionId: context.sessionId,
            toolName,
            violationType: ViolationType.RATE_LIMIT_EXCEEDED,
            threatLevel: ThreatLevel.MEDIUM,
            blocked: true,
          }
        )
      );
    }

    // Reset window if expired
    if (now - tracking.windowStart >= config.windowMs) {
      tracking.count = 0;
      tracking.windowStart = now;
      tracking.blocked = false;
      tracking.blockUntil = 0;
    }

    // Check rate limit
    if (tracking.count >= config.maxRequests) {
      // Block for configured duration
      tracking.blocked = true;
      tracking.blockUntil = now + config.blockDurationMs;
      this.stats.rateLimitHits++;

      await this.logSecurityViolation(
        ViolationType.RATE_LIMIT_EXCEEDED,
        ThreatLevel.MEDIUM,
        `Rate limit exceeded for ${toolName}: ${tracking.count} requests in window`,
        context,
        toolName,
        undefined,
        { requestCount: tracking.count, windowMs: config.windowMs }
      );

      return failure(
        securityError(
          'RATE_LIMIT_EXCEEDED',
          `Rate limit exceeded for ${toolName}. Blocked for ${config.blockDurationMs / 1000} seconds`,
          'VALIDATION',
          {
            sessionId: context.sessionId,
            toolName,
            violationType: ViolationType.RATE_LIMIT_EXCEEDED,
            threatLevel: ThreatLevel.MEDIUM,
            blocked: true,
          }
        )
      );
    }

    // Increment counter
    tracking.count++;

    return success(undefined);
  }

  private async sanitizeInput(
    call: ToolCall,
    context: ToolContext
  ): Promise<Result<ToolCall, QiError>> {
    let sanitizedInput = call.input;
    let hasSanitization = false;

    // Convert input to string for pattern matching
    const inputString = JSON.stringify(call.input);

    for (const rule of this.sanitizationRules) {
      if (rule.pattern.test(inputString)) {
        switch (rule.action) {
          case 'block':
            await this.logSecurityViolation(
              this.getViolationTypeFromRule(rule),
              rule.threatLevel,
              `Input blocked due to ${rule.name}`,
              context,
              call.toolName,
              call.input,
              { ruleName: rule.name }
            );

            return failure(
              securityError(
                'INPUT_BLOCKED',
                `Input contains potentially malicious content and has been blocked: ${rule.name}`,
                'VALIDATION',
                {
                  sessionId: context.sessionId,
                  toolName: call.toolName,
                  violationType: this.getViolationTypeFromRule(rule),
                  threatLevel: rule.threatLevel,
                  blocked: true,
                }
              )
            );

          case 'sanitize': {
            // Apply sanitization to the input string representation
            const sanitizedString = inputString.replace(rule.pattern, rule.replacement || '');
            try {
              sanitizedInput = JSON.parse(sanitizedString);
              hasSanitization = true;
              this.stats.sanitizedInputs++;

              await this.logSecurityViolation(
                this.getViolationTypeFromRule(rule),
                rule.threatLevel,
                `Input sanitized due to ${rule.name}`,
                context,
                call.toolName,
                call.input,
                { ruleName: rule.name, sanitized: true }
              );
            } catch (error) {
              // If JSON parsing fails, keep original input but log warning
              this.logger.warn('Input sanitization failed', {
                component: 'SecurityGateway',
                method: 'sanitizeInput',
                error,
                ruleName: rule.name,
              });
            }
            break;
          }

          case 'warn':
            await this.logSecurityViolation(
              this.getViolationTypeFromRule(rule),
              rule.threatLevel,
              `Suspicious input pattern detected: ${rule.name}`,
              context,
              call.toolName,
              call.input,
              { ruleName: rule.name, warningOnly: true }
            );
            break;
        }
      }
    }

    const sanitizedCall: ToolCall = {
      ...call,
      input: sanitizedInput,
    };

    return success(sanitizedCall);
  }

  private getToolCategory(toolName: string): string {
    const systemTools = ['BashTool', 'ProcessManager', 'EnvironmentTool'];
    const fileTools = ['ReadTool', 'WriteTool', 'EditTool', 'MultiEditTool', 'LSTool'];

    if (systemTools.includes(toolName)) return 'system';
    if (fileTools.includes(toolName)) return 'file';

    return 'default';
  }

  private getViolationTypeFromRule(rule: SanitizationRule): ViolationType {
    const ruleToViolationMap: Record<string, ViolationType> = {
      sql_injection: ViolationType.INJECTION_ATTEMPT,
      command_injection: ViolationType.INJECTION_ATTEMPT,
      path_traversal: ViolationType.PATH_TRAVERSAL,
      script_injection: ViolationType.INJECTION_ATTEMPT,
      null_bytes: ViolationType.SUSPICIOUS_PATTERN,
    };

    return ruleToViolationMap[rule.name] || ViolationType.SUSPICIOUS_PATTERN;
  }

  private async logSecurityViolation(
    violationType: ViolationType,
    threatLevel: ThreatLevel,
    description: string,
    context: ToolContext,
    toolName: string,
    input?: any,
    metadata: Record<string, unknown> = {}
  ): Promise<void> {
    const violation: SecurityViolation = {
      timestamp: Date.now(),
      sessionId: context.sessionId,
      userId: context.userId,
      toolName,
      violationType,
      threatLevel,
      description,
      input,
      metadata,
    };

    this.violations.push(violation);

    // Update statistics
    this.stats.violationsByType[violationType]++;
    this.stats.violationsByThreatLevel[threatLevel]++;

    // Trim violation history if it gets too large
    if (this.violations.length > this.maxViolationHistory) {
      this.violations = this.violations.slice(-this.maxViolationHistory / 2);
    }

    // Log security events
    if (this.enableSecurityLogging) {
      const logLevel =
        threatLevel === ThreatLevel.CRITICAL || threatLevel === ThreatLevel.HIGH ? 'error' : 'warn';

      this.logger[logLevel]('Security violation detected', {
        component: 'SecurityGateway',
        method: 'logSecurityViolation',
        violationType,
        threatLevel,
        description,
        toolName,
        sessionId: context.sessionId,
        userId: context.userId,
        metadata,
      });
    }
  }

  private startPeriodicCleanup(): void {
    // Clean up old rate limit tracking data every 5 minutes
    setInterval(() => {
      const now = Date.now();
      const maxAge = 3600000; // 1 hour

      for (const [key, tracking] of this.rateLimitTracking.entries()) {
        if (now - tracking.windowStart > maxAge && !tracking.blocked) {
          this.rateLimitTracking.delete(key);
        }
      }
    }, 300000); // 5 minutes
  }
}
