# Operational Concerns

**Context**: These are the practical essentials missing from the original architecture (identified in opus4 review).

## Overview

The original architecture focused on abstract patterns but missed critical operational requirements for production systems. This document addresses:

- **Rate Limiting**: Prevent API/server overload
- **Retry Logic**: Handle network failures gracefully  
- **Timeout Handling**: Prevent hanging operations
- **Cost Tracking**: Monitor LLM token usage
- **Error Recovery**: Graceful degradation patterns

---

## 1. Rate Limiting

### 1.1 MCP Server Rate Limits

**Problem**: MCP servers can be overwhelmed by rapid tool calls.

**Solution**: Per-server rate limiting with backoff:

```typescript
interface RateLimitConfig {
  mcpServers: {
    perSecond: 10;     // Max 10 calls per second per server
    perMinute: 300;    // Max 300 calls per minute per server
    burstSize: 5;      // Allow short bursts
  };
}
```

**Implementation**:
- Token bucket algorithm per MCP server
- Exponential backoff when limits exceeded
- Queue requests during rate limit periods

### 1.2 LLM Provider Rate Limits

**Problem**: LLM APIs have strict rate limits and cost implications.

**Solution**: Provider-specific rate limiting:

```typescript
interface LLMRateLimits {
  ollama: {
    perSecond: 5;      // Local server limits
    concurrent: 2;     // Max concurrent requests
  };
  openai: {
    perMinute: 60;     // API tier limits
    tokensPerMinute: 150000;
  };
  anthropic: {
    perMinute: 50;
    tokensPerMinute: 100000;
  };
}
```

---

## 2. Retry Logic

### 2.1 Exponential Backoff Strategy

**Standard Retry Pattern**:
```typescript
async function withRetry<T>(
  operation: () => Promise<T>,
  config: {
    maxRetries: 3;
    baseDelayMs: 1000;
    maxDelayMs: 10000;
    retryOn: (error: Error) => boolean;
  }
): Promise<T>
```

**Retry Schedule**:
- Attempt 1: Immediate
- Attempt 2: 1s delay  
- Attempt 3: 2s delay
- Attempt 4: 4s delay
- Fail after 4 attempts

### 2.2 Retry Conditions

**Retryable Errors**:
- Network timeouts
- HTTP 429 (Rate Limited)
- HTTP 502/503/504 (Server errors)
- Connection refused
- MCP server temporarily unavailable

**Non-Retryable Errors**:
- HTTP 400 (Bad Request)
- HTTP 401/403 (Authentication)
- Invalid tool parameters
- Parsing errors
- User cancellation

---

## 3. Timeout Handling

### 3.1 Timeout Hierarchy

```typescript
interface TimeoutConfig {
  toolExecution: 30000;    // 30s max per tool
  modelGeneration: 60000;  // 60s max per LLM call
  totalRequest: 120000;    // 2min max per user request
  mcpServerStart: 10000;   // 10s to start MCP server
}
```

### 3.2 Timeout Strategies

**Tool Execution**:
- Hard timeout at 30s
- Graceful cancellation if possible
- Return partial results when available

**Model Generation**:
- Stream timeout: 60s total
- Heartbeat timeout: 10s between tokens
- Fallback to shorter response if needed

**Request Processing**:
- Total timeout: 2 minutes
- Progressive timeout warnings at 30s intervals
- Graceful degradation to simpler responses

---

## 4. Cost Tracking

### 4.1 Token Usage Monitoring

**Track by**:
- User/session
- Cognitive mode
- Time period (hourly/daily/monthly)
- Model provider

```typescript
interface CostMetrics {
  tokensUsed: {
    prompt: number;
    completion: number;
    total: number;
  };
  estimatedCost: {
    usd: number;
    provider: string;
  };
  mode: CognitiveMode;
  timestamp: Date;
}
```

### 4.2 Budget Controls

**Daily Budget Limits**:
```typescript
interface BudgetConfig {
  daily: {
    maxUSD: 10.00;
    warningAt: 8.00;
    throttleAt: 9.00;
  };
  monthly: {
    maxUSD: 200.00;
    warningAt: 150.00;
  };
}
```

**Cost Optimization**:
- Use cheaper models for simple tasks
- Cache common responses
- Prefer local models (Ollama) when possible
- Truncate excessive context

---

## 5. Error Recovery Patterns

### 5.1 Graceful Degradation

**Pattern**: When advanced features fail, fall back to simpler alternatives.

**Examples**:
- Multi-signal detection fails → Simple keyword matching
- Sequential-thinking tool fails → Direct LLM reasoning
- Web search fails → Use cached/local knowledge
- Preferred model unavailable → Use fallback model

### 5.2 Circuit Breaker Pattern

**Implementation**: Stop calling failing services temporarily.

```typescript
interface CircuitBreakerConfig {
  failureThreshold: 5;     // Failures before opening
  timeoutMs: 30000;        // How long to stay open
  monitoringPeriod: 60000; // Reset period
}
```

**States**:
- **Closed**: Normal operation
- **Open**: All calls fail fast (service unavailable)
- **Half-Open**: Test if service recovered

### 5.3 Fallback Chains

**Tool Execution Fallbacks**:
```
Primary Tool → Alternative Tool → Manual Instructions → Error Response
```

**Model Provider Fallbacks**:
```
Preferred Model → Backup Model → Local Model → Cached Response
```

---

## 6. Implementation Priorities

### Phase 1: Essential Safety
1. **Timeout handling** (prevent hangs)
2. **Basic retry logic** (handle failures)
3. **Rate limiting** (prevent overload)

### Phase 2: Production Reliability
4. **Error recovery patterns** (graceful degradation)
5. **Circuit breaker** (isolate failures)
6. **Cost tracking** (budget control)

### Phase 3: Advanced Operations
7. **Performance monitoring** (latency/throughput)
8. **Health checks** (component status)
9. **Alerting** (failure notifications)

---

## 7. Configuration Example

**Unified Operational Config**:
```yaml
operational:
  rateLimits:
    mcpServers:
      perSecond: 10
      perMinute: 300
    llmProviders:
      perSecond: 5
      tokensPerMinute: 150000
  
  timeouts:
    toolExecution: 30000
    modelGeneration: 60000
    totalRequest: 120000
  
  retries:
    maxAttempts: 3
    baseDelayMs: 1000
    maxDelayMs: 10000
  
  costs:
    enableTracking: true
    budgetLimits:
      daily: 10.00
      monthly: 200.00
  
  circuitBreaker:
    failureThreshold: 5
    timeoutMs: 30000
```

This operational foundation ensures the agent framework is production-ready with proper error handling, cost control, and reliability measures.