# Error Handling and Recovery Strategies

Claude Code implements a comprehensive multi-level error handling system that ensures system stability, provides meaningful error messages, and enables graceful recovery from various failure scenarios.

## Error Handling Architecture Overview

The error handling system operates across multiple layers with specific strategies for each component:

```
┌─────────────────────────────────────────────────────────────────┐
│                 Error Handling Architecture                     │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Error       │  │ Error       │  │ Context             │      │
│  │ Detection   │  │ Classification│  │ Preservation        │      │
│  │             │  │             │  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Recovery    │  │ Fallback    │  │ Error               │      │
│  │ Strategies  │  │ Mechanisms  │  │ Reporting           │      │
│  │             │  │             │  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ Retry       │  │ Degraded    │  │ User                │      │
│  │ Logic       │  │ Operation   │  │ Communication       │      │
│  │             │  │             │  │                     │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Error Classification System

### 1. Error Categories

Claude Code categorizes errors into distinct types with specific handling strategies:

```typescript
enum ErrorCategory {
  SYSTEM = 'system',           // System-level failures
  VALIDATION = 'validation',   // Input validation failures
  SECURITY = 'security',       // Security violations
  RESOURCE = 'resource',       // Resource exhaustion
  NETWORK = 'network',         // Network connectivity issues
  TOOL = 'tool',              // Tool execution failures
  AGENT = 'agent',            // Agent processing errors
  USER = 'user'               // User-related errors
}

enum ErrorSeverity {
  CRITICAL = 'critical',       // System shutdown required
  HIGH = 'high',              // Major functionality affected
  MEDIUM = 'medium',          // Partial functionality affected
  LOW = 'low',               // Minor issues
  INFO = 'info'              // Informational only
}

interface ErrorContext {
  category: ErrorCategory;
  severity: ErrorSeverity;
  recoverable: boolean;
  retryable: boolean;
  userMessage: string;
  technicalDetails: string;
  context: Record<string, any>;
  timestamp: Date;
  stackTrace?: string;
}
```

### 2. Error Detection and Classification

```javascript
class ErrorDetector {
  static classify(error, context) {
    // Built-in error type detection
    if (error instanceof ValidationError) {
      return {
        category: ErrorCategory.VALIDATION,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: false,
        userMessage: 'Invalid input provided',
        technicalDetails: error.message
      };
    }
    
    if (error instanceof SecurityError) {
      return {
        category: ErrorCategory.SECURITY,
        severity: ErrorSeverity.CRITICAL,
        recoverable: false,
        retryable: false,
        userMessage: 'Security policy violation detected',
        technicalDetails: error.message
      };
    }
    
    if (error instanceof TimeoutError) {
      return {
        category: ErrorCategory.RESOURCE,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true,
        userMessage: 'Operation timed out',
        technicalDetails: error.message
      };
    }
    
    // Pattern-based classification
    return this.classifyByPattern(error, context);
  }
  
  static classifyByPattern(error, context) {
    const message = error.message.toLowerCase();
    
    // Network-related patterns
    if (message.includes('network') || message.includes('connection')) {
      return {
        category: ErrorCategory.NETWORK,
        severity: ErrorSeverity.MEDIUM,
        recoverable: true,
        retryable: true,
        userMessage: 'Network connectivity issue',
        technicalDetails: error.message
      };
    }
    
    // Resource patterns
    if (message.includes('memory') || message.includes('disk') || message.includes('resource')) {
      return {
        category: ErrorCategory.RESOURCE,
        severity: ErrorSeverity.HIGH,
        recoverable: true,
        retryable: false,
        userMessage: 'System resources exhausted',
        technicalDetails: error.message
      };
    }
    
    // Default classification
    return {
      category: ErrorCategory.SYSTEM,
      severity: ErrorSeverity.HIGH,
      recoverable: false,
      retryable: false,
      userMessage: 'An unexpected error occurred',
      technicalDetails: error.message
    };
  }
}
```

## Recovery Strategies

### 1. Hierarchical Recovery System

```javascript
class ErrorRecoveryManager {
  constructor() {
    this.recoveryStrategies = new Map([
      [ErrorCategory.SYSTEM, new SystemErrorRecovery()],
      [ErrorCategory.VALIDATION, new ValidationErrorRecovery()],
      [ErrorCategory.SECURITY, new SecurityErrorRecovery()],
      [ErrorCategory.RESOURCE, new ResourceErrorRecovery()],
      [ErrorCategory.NETWORK, new NetworkErrorRecovery()],
      [ErrorCategory.TOOL, new ToolErrorRecovery()],
      [ErrorCategory.AGENT, new AgentErrorRecovery()],
      [ErrorCategory.USER, new UserErrorRecovery()]
    ]);
  }
  
  async handleError(error, context) {
    const errorContext = ErrorDetector.classify(error, context);
    const strategy = this.recoveryStrategies.get(errorContext.category);
    
    if (!strategy) {
      return this.defaultErrorHandling(error, errorContext);
    }
    
    try {
      return await strategy.recover(error, errorContext, context);
    } catch (recoveryError) {
      // Recovery itself failed - escalate
      return this.escalateError(error, recoveryError, context);
    }
  }
  
  async escalateError(originalError, recoveryError, context) {
    // Log the compound failure
    this.logCompoundError(originalError, recoveryError, context);
    
    // Attempt safe shutdown of affected components
    await this.safeShutdown(context);
    
    return {
      success: false,
      error: 'Multiple system failures detected',
      requiresRestart: true,
      originalError: originalError.message,
      recoveryError: recoveryError.message
    };
  }
}
```

### 2. Category-Specific Recovery Strategies

#### System Error Recovery
```javascript
class SystemErrorRecovery {
  async recover(error, errorContext, context) {
    if (errorContext.severity === ErrorSeverity.CRITICAL) {
      // Critical system errors require immediate shutdown
      await this.emergencyShutdown(context);
      return {
        success: false,
        error: 'Critical system error - restart required',
        requiresRestart: true
      };
    }
    
    // Attempt graceful degradation
    if (this.canDegrade(error, context)) {
      return await this.enableDegradedMode(context);
    }
    
    // Try component restart
    return await this.attemptComponentRestart(error, context);
  }
  
  async enableDegradedMode(context) {
    // Disable non-essential features
    const degradedFeatures = [
      'advanced_tools',
      'concurrent_execution',
      'streaming_responses'
    ];
    
    await this.disableFeatures(degradedFeatures);
    
    return {
      success: true,
      degraded: true,
      message: 'System operating in degraded mode',
      disabledFeatures: degradedFeatures
    };
  }
}
```

#### Tool Error Recovery
```javascript
class ToolErrorRecovery {
  async recover(error, errorContext, context) {
    const toolName = context.toolName;
    
    // Check if tool has alternative implementations
    const alternatives = await this.findAlternativeTools(toolName);
    if (alternatives.length > 0) {
      return await this.attemptAlternativeTool(alternatives[0], context);
    }
    
    // Try tool-specific recovery strategies
    const toolRecovery = this.getToolSpecificRecovery(toolName);
    if (toolRecovery) {
      return await toolRecovery(error, context);
    }
    
    // Generic tool recovery
    return await this.genericToolRecovery(error, context);
  }
  
  getToolSpecificRecovery(toolName) {
    const strategies = {
      'bash': this.recoverBashTool,
      'webfetch': this.recoverWebFetchTool,
      'edit': this.recoverEditTool,
      'read': this.recoverReadTool
    };
    
    return strategies[toolName];
  }
  
  async recoverBashTool(error, context) {
    // For bash tools, try with safer parameters
    if (error.message.includes('permission denied')) {
      // Remove potentially dangerous flags
      const safeCommand = this.sanitizeCommand(context.params.command);
      
      return {
        success: true,
        alternativeAction: {
          tool: 'bash',
          params: { ...context.params, command: safeCommand },
          warning: 'Command was modified for safety'
        }
      };
    }
    
    return { success: false };
  }
}
```

#### Network Error Recovery
```javascript
class NetworkErrorRecovery {
  constructor() {
    this.retryConfig = {
      maxRetries: 3,
      baseDelay: 1000,
      maxDelay: 10000,
      backoffMultiplier: 2
    };
  }
  
  async recover(error, errorContext, context) {
    // Network errors are generally retryable
    if (errorContext.retryable) {
      return await this.attemptRetryWithBackoff(error, context);
    }
    
    // Try alternative endpoints
    const alternatives = await this.findAlternativeEndpoints(context);
    if (alternatives.length > 0) {
      return await this.tryAlternativeEndpoint(alternatives[0], context);
    }
    
    // Enable offline mode if applicable
    if (this.supportsOfflineMode(context)) {
      return await this.enableOfflineMode(context);
    }
    
    return { success: false, error: 'Network recovery failed' };
  }
  
  async attemptRetryWithBackoff(error, context) {
    let lastError = error;
    
    for (let attempt = 0; attempt < this.retryConfig.maxRetries; attempt++) {
      const delay = Math.min(
        this.retryConfig.baseDelay * Math.pow(this.retryConfig.backoffMultiplier, attempt),
        this.retryConfig.maxDelay
      );
      
      await this.sleep(delay);
      
      try {
        // Retry the original operation
        const result = await this.retryOperation(context);
        return { success: true, result, retriedAfter: attempt + 1 };
      } catch (retryError) {
        lastError = retryError;
        
        // If error type changes, re-evaluate recovery strategy
        if (retryError.constructor !== error.constructor) {
          const newStrategy = ErrorDetector.classify(retryError, context);
          if (newStrategy.category !== ErrorCategory.NETWORK) {
            throw retryError; // Let different error handler take over
          }
        }
      }
    }
    
    return { success: false, error: lastError.message, retriesExhausted: true };
  }
}
```

## Fallback Mechanisms

### 1. Graceful Degradation

```javascript
class GracefulDegradation {
  constructor() {
    this.featureDependencies = {
      'streaming_responses': ['real_time_updates', 'progress_indicators'],
      'concurrent_execution': ['parallel_tools', 'resource_optimization'],
      'advanced_tools': ['bash', 'network_tools', 'system_integration'],
      'context_compression': ['memory_optimization', 'long_conversations']
    };
  }
  
  async degradeSystem(unavailableFeatures, context) {
    const degradationPlan = this.createDegradationPlan(unavailableFeatures);
    const results = [];
    
    for (const step of degradationPlan) {
      try {
        const result = await this.executeStep(step, context);
        results.push(result);
      } catch (error) {
        // Log degradation failure but continue
        this.logDegradationError(error, step);
        results.push({ step: step.name, success: false, error: error.message });
      }
    }
    
    return {
      success: true,
      degradationResults: results,
      operationalFeatures: await this.getOperationalFeatures(context)
    };
  }
  
  createDegradationPlan(unavailableFeatures) {
    const plan = [];
    
    for (const feature of unavailableFeatures) {
      const dependencies = this.featureDependencies[feature] || [];
      
      plan.push({
        name: `disable_${feature}`,
        type: 'disable',
        target: feature,
        dependencies: dependencies
      });
      
      // Add alternative implementations if available
      const alternatives = this.getAlternativeImplementations(feature);
      for (const alternative of alternatives) {
        plan.push({
          name: `enable_${alternative.name}`,
          type: 'enable_alternative',
          target: feature,
          alternative: alternative
        });
      }
    }
    
    return plan;
  }
}
```

### 2. Backup Strategies

```javascript
class BackupStrategyManager {
  constructor() {
    this.backupStrategies = {
      'tool_execution': [
        this.tryLocalExecution,
        this.trySimplifiedExecution,
        this.tryManualFallback
      ],
      'network_operations': [
        this.tryCachedResult,
        this.tryOfflineMode,
        this.tryUserPrompt
      ],
      'agent_processing': [
        this.trySimpleMode,
        this.tryStaticResponse,
        this.tryErrorStateMode
      ]
    };
  }
  
  async executeBackupStrategy(operationType, error, context) {
    const strategies = this.backupStrategies[operationType] || [];
    
    for (const strategy of strategies) {
      try {
        const result = await strategy.call(this, error, context);
        if (result.success) {
          return {
            ...result,
            backupStrategyUsed: strategy.name
          };
        }
      } catch (strategyError) {
        // Log strategy failure but continue to next
        this.logStrategyError(strategyError, strategy.name);
      }
    }
    
    // All backup strategies failed
    return {
      success: false,
      error: 'All backup strategies exhausted',
      originalError: error.message
    };
  }
  
  async tryLocalExecution(error, context) {
    // For tool execution, try using local alternatives
    const localTool = await this.findLocalAlternative(context.toolName);
    if (!localTool) {
      return { success: false };
    }
    
    try {
      const result = await localTool.execute(context.params);
      return {
        success: true,
        result,
        message: 'Used local alternative tool'
      };
    } catch (localError) {
      return { success: false, error: localError.message };
    }
  }
  
  async tryCachedResult(error, context) {
    // For network operations, try using cached results
    const cachedResult = await this.getCachedResult(context);
    if (!cachedResult) {
      return { success: false };
    }
    
    return {
      success: true,
      result: cachedResult,
      message: 'Used cached result (may be outdated)',
      cached: true,
      cacheAge: cachedResult.age
    };
  }
}
```

## Error Communication and User Experience

### 1. User-Friendly Error Messages

```javascript
class ErrorMessageFormatter {
  constructor() {
    this.messageTemplates = {
      [ErrorCategory.VALIDATION]: {
        title: 'Input Error',
        icon: '⚠️',
        template: 'There was an issue with the provided input: {details}',
        actionable: true
      },
      [ErrorCategory.NETWORK]: {
        title: 'Connection Issue',
        icon: '🌐',
        template: 'Unable to connect to external services. {details}',
        actionable: true
      },
      [ErrorCategory.SECURITY]: {
        title: 'Security Policy',
        icon: '🔒',
        template: 'Action blocked by security policy: {details}',
        actionable: false
      },
      [ErrorCategory.RESOURCE]: {
        title: 'System Resources',
        icon: '💾',
        template: 'System resource limit reached: {details}',
        actionable: true
      }
    };
  }
  
  formatErrorMessage(error, errorContext, context) {
    const template = this.messageTemplates[errorContext.category] || 
                    this.messageTemplates.default;
    
    const message = template.template.replace('{details}', errorContext.userMessage);
    
    return {
      title: template.title,
      icon: template.icon,
      message,
      severity: errorContext.severity,
      actionable: template.actionable,
      suggestions: this.generateSuggestions(errorContext, context),
      technicalDetails: errorContext.technicalDetails,
      timestamp: new Date().toISOString()
    };
  }
  
  generateSuggestions(errorContext, context) {
    const suggestions = [];
    
    if (errorContext.retryable) {
      suggestions.push({
        action: 'retry',
        description: 'Try the operation again',
        automatic: false
      });
    }
    
    if (errorContext.category === ErrorCategory.VALIDATION) {
      suggestions.push({
        action: 'fix_input',
        description: 'Review and correct the input parameters',
        automatic: false
      });
    }
    
    if (errorContext.category === ErrorCategory.NETWORK) {
      suggestions.push({
        action: 'check_connection',
        description: 'Check your internet connection',
        automatic: false
      });
      
      suggestions.push({
        action: 'try_offline',
        description: 'Switch to offline mode if available',
        automatic: true
      });
    }
    
    return suggestions;
  }
}
```

### 2. Progressive Error Recovery

```javascript
class ProgressiveErrorRecovery {
  constructor() {
    this.recoveryLevels = [
      'immediate_retry',
      'alternative_approach',
      'degraded_functionality',
      'user_intervention',
      'system_restart'
    ];
  }
  
  async attemptRecovery(error, context) {
    let lastError = error;
    const recoveryAttempts = [];
    
    for (const level of this.recoveryLevels) {
      try {
        const strategy = this.getRecoveryStrategy(level);
        const result = await strategy(lastError, context);
        
        recoveryAttempts.push({
          level,
          success: result.success,
          message: result.message
        });
        
        if (result.success) {
          return {
            recovered: true,
            finalResult: result,
            recoveryPath: recoveryAttempts
          };
        }
        
        lastError = result.error || lastError;
        
      } catch (recoveryError) {
        recoveryAttempts.push({
          level,
          success: false,
          error: recoveryError.message
        });
        
        lastError = recoveryError;
      }
    }
    
    // All recovery levels failed
    return {
      recovered: false,
      finalError: lastError,
      recoveryPath: recoveryAttempts,
      requiresManualIntervention: true
    };
  }
  
  getRecoveryStrategy(level) {
    const strategies = {
      immediate_retry: this.immediateRetry,
      alternative_approach: this.alternativeApproach,
      degraded_functionality: this.degradedFunctionality,
      user_intervention: this.userIntervention,
      system_restart: this.systemRestart
    };
    
    return strategies[level];
  }
  
  async immediateRetry(error, context) {
    // Simple retry without modification
    try {
      const result = await this.retryOriginalOperation(context);
      return { success: true, result, message: 'Retry successful' };
    } catch (retryError) {
      return { success: false, error: retryError };
    }
  }
  
  async alternativeApproach(error, context) {
    // Try different methods to achieve the same goal
    const alternatives = await this.findAlternativeMethods(context);
    
    for (const alternative of alternatives) {
      try {
        const result = await alternative.execute(context);
        return { 
          success: true, 
          result, 
          message: `Used alternative method: ${alternative.name}` 
        };
      } catch (altError) {
        continue;
      }
    }
    
    return { success: false, error: 'No alternative methods succeeded' };
  }
}
```

## Monitoring and Analytics

### 1. Error Pattern Detection

```javascript
class ErrorPatternAnalyzer {
  constructor() {
    this.errorHistory = [];
    this.patternThresholds = {
      frequency: 5,        // Same error 5+ times
      timeWindow: 300000,  // Within 5 minutes
      correlation: 0.8     // 80% correlation threshold
    };
  }
  
  analyzeErrorPatterns() {
    const patterns = {
      frequent: this.detectFrequentErrors(),
      cascading: this.detectCascadingFailures(),
      cyclical: this.detectCyclicalPatterns(),
      correlated: this.detectCorrelatedErrors()
    };
    
    return {
      timestamp: new Date().toISOString(),
      patterns,
      recommendations: this.generateRecommendations(patterns)
    };
  }
  
  detectFrequentErrors() {
    const now = Date.now();
    const recentErrors = this.errorHistory.filter(
      error => now - error.timestamp < this.patternThresholds.timeWindow
    );
    
    const errorGroups = new Map();
    
    for (const error of recentErrors) {
      const key = `${error.category}:${error.code}`;
      const group = errorGroups.get(key) || [];
      group.push(error);
      errorGroups.set(key, group);
    }
    
    return Array.from(errorGroups.entries())
      .filter(([key, errors]) => errors.length >= this.patternThresholds.frequency)
      .map(([key, errors]) => ({
        pattern: key,
        count: errors.length,
        firstSeen: Math.min(...errors.map(e => e.timestamp)),
        lastSeen: Math.max(...errors.map(e => e.timestamp)),
        contexts: errors.map(e => e.context)
      }));
  }
  
  generateRecommendations(patterns) {
    const recommendations = [];
    
    if (patterns.frequent.length > 0) {
      recommendations.push({
        type: 'frequent_errors',
        priority: 'high',
        message: `${patterns.frequent.length} error patterns detected with high frequency`,
        actions: [
          'Review error handling for frequent patterns',
          'Consider implementing preventive measures',
          'Update user documentation for common issues'
        ]
      });
    }
    
    if (patterns.cascading.length > 0) {
      recommendations.push({
        type: 'cascading_failures',
        priority: 'critical',
        message: 'Cascading failure patterns detected',
        actions: [
          'Implement circuit breaker patterns',
          'Improve error isolation',
          'Add early failure detection'
        ]
      });
    }
    
    return recommendations;
  }
}
```

This comprehensive error handling system ensures Claude Code can gracefully handle various failure scenarios while maintaining system stability and providing a good user experience through meaningful error messages and effective recovery strategies.