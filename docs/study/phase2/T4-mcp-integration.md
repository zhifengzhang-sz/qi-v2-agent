# T4: MCP Integration - Multi-Server Architecture Guide

## Overview

This guide covers the design and implementation of multi-server MCP (Model Context Protocol) integration for the Qi V2 Agent. Based on Phase 1 analysis, the TypeScript implementation leverages `@langchain/mcp-adapters` and `@modelcontextprotocol/sdk` to eliminate custom protocol handling while providing robust multi-server orchestration.

## Architecture Decisions

### MultiServerMCPClient vs Single Server

**Recommendation: MultiServerMCPClient for Production Systems**

**Why MultiServerMCPClient:**
- **Specialized Tool Domains**: Different servers can handle specific domains (file operations, web APIs, calculations)
- **Isolation & Security**: Server failures don't affect other servers
- **Performance Scaling**: Distribute load across multiple processes
- **Development Flexibility**: Teams can develop servers independently

**Single Server Scenarios:**
- **Development/Testing**: Simplified setup for initial development
- **Simple Use Cases**: Single domain applications (e.g., file-only tools)
- **Resource Constraints**: Minimal memory/CPU environments

**Architecture Impact:**
```typescript
// Multi-server approach enables domain separation
const mcpServers = {
  "file-operations": { transport: "stdio", command: "bun", args: ["./servers/file-server.ts"] },
  "web-search": { transport: "sse", url: "http://localhost:8001/mcp" },
  "calculator": { transport: "stdio", command: "node", args: ["./servers/calc-server.js"] }
};
```

### Transport Type Selection Strategy

**Transport Decision Matrix:**

| Transport | Use Case | Advantages | Limitations |
|-----------|----------|------------|-------------|
| **stdio** | Local servers, development | Simple setup, reliable | Process management needed |
| **sse** | Web services, real-time updates | HTTP-based, scalable | Requires HTTP server |
| **streamable_http** | REST-like integrations | Standard HTTP | No real-time capabilities |
| **websocket** | Bidirectional communication | Real-time, efficient | More complex setup |

**Selection Guidelines:**
- **Local Development**: Start with `stdio` for simplicity
- **Production Services**: Use `sse` for web-based servers
- **Third-party APIs**: Use `streamable_http` for REST integrations
- **Real-time Applications**: Use `websocket` for bidirectional needs

### Tool Loading Strategy

**Recommended: Lazy Loading with Caching**

**Architecture Pattern:**
1. **Server Discovery**: Enumerate configured servers on startup
2. **Tool Enumeration**: Load tool schemas without executing
3. **Lazy Execution**: Connect to servers only when tools are used
4. **Connection Pooling**: Reuse connections for multiple tool calls
5. **Graceful Degradation**: Continue operation if servers fail

**Benefits:**
- **Fast Startup**: Don't wait for all servers to be ready
- **Resource Efficiency**: Only connect to servers when needed
- **Fault Tolerance**: Isolated server failures
- **Dynamic Discovery**: Support runtime server addition/removal

## Integration Strategies

### Server Discovery Patterns

**Configuration-Based Discovery (Recommended)**

**YAML Configuration Pattern:**
```yaml
mcp_servers:
  file-server:
    transport: stdio
    command: bun
    args: ["./servers/file-server.ts"]
    env:
      LOG_LEVEL: debug
    working_directory: ./
    auto_start: true
    restart_policy: on_failure
    
  web-search:
    transport: sse
    url: "http://localhost:8001/mcp"
    headers:
      Authorization: "Bearer ${WEB_SEARCH_API_KEY}"
    timeout: 30000
    retry_attempts: 3
    health_check: "/health"
```

**Dynamic Discovery Considerations:**
- **Service Registry**: Future integration with service discovery systems
- **mDNS/Bonjour**: Local network server discovery
- **Plugin Architecture**: Runtime server loading from plugins directory

### Tool Loading Lifecycle

**Recommended Flow:**

1. **Initialization Phase**
   - Parse server configurations
   - Validate server definitions
   - Create server connection templates

2. **Discovery Phase**
   - Connect to servers (with timeout/retry)
   - Enumerate available tools
   - Build unified tool registry
   - Cache tool schemas

3. **Runtime Phase**
   - Route tool calls to appropriate servers
   - Handle server connection lifecycle
   - Manage tool execution context
   - Cache results where appropriate

4. **Cleanup Phase**
   - Gracefully disconnect from servers
   - Clean up resources
   - Log final statistics

### Error Handling Between Agent and MCP Servers

**Multi-Level Error Strategy:**

**Server-Level Errors:**
- **Connection Failures**: Retry with exponential backoff
- **Server Crashes**: Mark server as unavailable, attempt restart
- **Timeout Errors**: Fail gracefully, don't block other tools

**Tool-Level Errors:**
- **Tool Not Found**: Return descriptive error to agent
- **Execution Failures**: Log error, return formatted error response
- **Invalid Parameters**: Validate before sending to server

**Agent-Level Handling:**
- **Graceful Degradation**: Continue operation without failed servers
- **User Communication**: Inform user about unavailable tools
- **Retry Logic**: Intelligent retry for transient failures

**Error Response Format:**
```typescript
interface ToolExecutionResult {
  success: boolean;
  result?: any;
  error?: {
    type: 'connection' | 'timeout' | 'execution' | 'validation';
    message: string;
    server: string;
    tool: string;
    retryable: boolean;
  };
}
```

## Configuration Patterns

### YAML Schema Design

**Hierarchical Configuration Structure:**

```yaml
# Top-level agent configuration
agent:
  name: "qi-v2-agent"
  version: "1.0.0"
  
# Model configuration
model:
  provider: ollama
  name: deepseek-r1
  temperature: 0.1
  max_tokens: 4000
  
# MCP server definitions
mcp_servers:
  # Local servers
  file-operations:
    transport: stdio
    command: bun
    args: ["./servers/file-server.ts"]
    working_directory: "./"
    env:
      LOG_LEVEL: info
    restart_policy: on_failure
    health_check:
      enabled: true
      interval: 30
      timeout: 5
      
  # Remote HTTP servers  
  web-search:
    transport: sse
    url: "http://localhost:8001/mcp"
    headers:
      Authorization: "Bearer ${WEB_SEARCH_API_KEY}"
      User-Agent: "qi-agent/1.0.0"
    connection:
      timeout: 30000
      retry_attempts: 3
      retry_delay: 1000
    health_check:
      endpoint: "/health"
      expected_status: 200
      
  # WebSocket servers
  real-time-data:
    transport: websocket
    url: "ws://localhost:8002/mcp"
    connection:
      ping_interval: 30000
      max_reconnect_attempts: 5
      reconnect_delay: 2000

# Security configuration
security:
  tool_permissions:
    file-operations:
      allowed_paths: ["./workspace", "./temp"]
      denied_operations: ["delete", "execute"]
    web-search:
      rate_limit: 10  # requests per minute
      allowed_domains: ["*.safe-domain.com"]
      
# Logging and monitoring
logging:
  level: info
  file: "./logs/qi-agent.log"
  format: json
  rotation:
    max_size: 100MB
    max_files: 10
```

### Environment Variable Management

**Environment Variable Strategy:**

**Configuration Variables:**
- `QI_CONFIG_PATH`: Override default config file location
- `QI_LOG_LEVEL`: Runtime log level override
- `QI_MCP_TIMEOUT`: Global MCP operation timeout

**Server-Specific Variables:**
- `${SERVER_NAME}_API_KEY`: API keys for specific servers
- `${SERVER_NAME}_URL`: Override server URLs
- `${SERVER_NAME}_ENABLED`: Enable/disable specific servers

**Security Variables:**
- `QI_ENCRYPTION_KEY`: Configuration encryption key
- `QI_AUDIT_LOG_PATH`: Audit log file location
- `QI_SANDBOX_MODE`: Enable sandbox restrictions

**Variable Expansion Pattern:**
```yaml
mcp_servers:
  api-server:
    transport: sse
    url: "${API_SERVER_URL:http://localhost:8001}"  # Default fallback
    headers:
      Authorization: "Bearer ${API_SERVER_KEY}"      # Required
      Custom-Header: "${CUSTOM_HEADER:-default}"     # Optional with default
```

### Server Lifecycle Management

**Startup Sequence:**
1. **Configuration Loading**: Parse and validate config files
2. **Environment Setup**: Process environment variables
3. **Server Preparation**: Prepare server connection parameters
4. **Health Checks**: Verify server availability (optional)
5. **Tool Discovery**: Enumerate tools from available servers
6. **Agent Initialization**: Create agent with discovered tools

**Runtime Management:**
- **Connection Monitoring**: Track server connection health
- **Automatic Restart**: Restart failed servers with policies
- **Load Balancing**: Distribute requests across server instances
- **Circuit Breaker**: Temporarily disable failing servers

**Shutdown Sequence:**
1. **Graceful Disconnect**: Send disconnect messages to servers
2. **Connection Cleanup**: Close all server connections
3. **Resource Cleanup**: Clean up temporary resources
4. **Final Logging**: Log session statistics and errors

## Key API Concepts

### MultiServerMCPClient Integration

**Initialization Pattern:**
```typescript
import { MultiServerMCPClient } from '@langchain/mcp-adapters';

// Server configuration from YAML
const mcpServers = loadServerConfig();

// Client initialization with error handling
const mcpClient = new MultiServerMCPClient({
  mcpServers,
  options: {
    timeout: 30000,
    retryAttempts: 3,
    retryDelay: 1000
  }
});
```

**Tool Discovery Flow:**
1. **Connection Establishment**: Client connects to configured servers
2. **Capability Negotiation**: Exchange protocol versions and capabilities
3. **Tool Enumeration**: Request tool list from each server
4. **Schema Validation**: Validate tool schemas for compatibility
5. **Registry Population**: Add tools to unified tool registry

### Tool Permission Scoping

**Permission Model Design:**

**Server-Level Permissions:**
- **Resource Access**: File system paths, network endpoints
- **Operation Types**: Read, write, execute, delete permissions
- **Rate Limiting**: Request frequency limitations
- **Domain Restrictions**: Allowed/denied domains for web operations

**Tool-Level Permissions:**
- **Parameter Validation**: Allowed parameter ranges/values
- **Output Filtering**: Sanitize sensitive information from responses
- **Execution Context**: Sandbox/container restrictions
- **Audit Requirements**: Log tool executions

**User-Level Permissions:**
- **Tool Access**: Which tools user can access
- **Administrative Functions**: Server management capabilities
- **Configuration Changes**: Runtime configuration modification rights

**Implementation Strategy:**
```typescript
interface ToolPermission {
  server: string;
  tool: string;
  user: string;
  permissions: {
    execute: boolean;
    configure: boolean;
    audit_access: boolean;
  };
  restrictions: {
    parameter_limits?: Record<string, any>;
    output_filtering?: string[];
    rate_limit?: number;
  };
}
```

### Session Management Between Agent and Servers

**Session Lifecycle:**

**Session Creation:**
- **Authentication**: Verify client credentials with servers
- **Capability Exchange**: Negotiate supported features
- **Resource Allocation**: Allocate server-side resources
- **Context Initialization**: Set up execution context

**Session Maintenance:**
- **Heartbeat Monitoring**: Regular connectivity checks
- **State Synchronization**: Keep agent-server state consistent
- **Resource Monitoring**: Track resource usage
- **Error Recovery**: Handle temporary disconnections

**Session Cleanup:**
- **Resource Deallocation**: Clean up server-side resources
- **State Persistence**: Save important session state
- **Connection Termination**: Graceful connection closure
- **Audit Logging**: Log session activities

**AsyncDisposable Pattern:**
```typescript
// Automatic resource cleanup using AsyncDisposable
await using session = await mcpClient.createSession({
  server: 'file-operations',
  context: executionContext
});

// Session automatically cleaned up when scope exits
```

## Server Development Guidelines

### MCP Server Creation Best Practices

**Server Structure Recommendations:**
- **Single Responsibility**: Each server handles one domain
- **Stateless Design**: Avoid server-side state when possible
- **Error Resilience**: Handle errors gracefully
- **Performance Optimization**: Efficient tool execution
- **Security First**: Validate all inputs, sanitize outputs

**Tool Definition Patterns:**
- **Clear Schemas**: Comprehensive parameter descriptions
- **Input Validation**: Strict parameter validation
- **Output Consistency**: Standardized response formats
- **Error Messages**: Helpful error descriptions

### Testing Strategy for MCP Integration

**Multi-Level Testing:**

**Unit Tests:**
- **Tool Execution**: Test individual tool functionality
- **Parameter Validation**: Test input validation logic
- **Error Handling**: Test error scenarios
- **Configuration Loading**: Test config parsing

**Integration Tests:**
- **Server Communication**: Test agent-server communication
- **Multi-Server Scenarios**: Test cross-server workflows
- **Connection Recovery**: Test reconnection logic
- **Performance Tests**: Measure response times

**End-to-End Tests:**
- **Complete Workflows**: Test entire user scenarios
- **Error Recovery**: Test system resilience
- **Security Validation**: Test permission enforcement
- **Load Testing**: Test under realistic load

## Performance Considerations

### Connection Pooling Strategy

**Connection Management:**
- **Pool Size**: Optimize pool size based on usage patterns
- **Connection Reuse**: Reuse connections for multiple tool calls
- **Idle Timeout**: Close idle connections to save resources
- **Health Monitoring**: Monitor connection health

### Caching Strategies

**Tool Result Caching:**
- **Cache Keys**: Design effective cache keys
- **TTL Policies**: Set appropriate time-to-live values
- **Cache Invalidation**: Handle cache invalidation properly
- **Memory Management**: Limit cache memory usage

**Tool Schema Caching:**
- **Schema Versioning**: Handle schema version changes
- **Cache Warming**: Pre-load frequently used schemas
- **Update Strategies**: Handle schema updates gracefully

## Security Considerations

### Input Sanitization

**Parameter Validation:**
- **Type Checking**: Validate parameter types
- **Range Validation**: Check parameter ranges
- **Pattern Matching**: Validate string patterns
- **Injection Prevention**: Prevent code injection attacks

### Output Filtering

**Sensitive Data Protection:**
- **PII Detection**: Identify personally identifiable information
- **Credential Filtering**: Remove API keys and passwords
- **Path Sanitization**: Sanitize file system paths
- **Error Information**: Limit error message details

### Audit Logging

**Comprehensive Logging:**
- **Tool Executions**: Log all tool calls and results
- **Access Attempts**: Log unauthorized access attempts
- **Configuration Changes**: Log configuration modifications
- **Performance Metrics**: Log performance statistics

## Troubleshooting Guide

### Common Issues and Solutions

**Connection Problems:**
- **Server Not Starting**: Check server configuration and dependencies
- **Connection Timeouts**: Adjust timeout settings
- **Authentication Failures**: Verify credentials and permissions
- **Network Issues**: Check network connectivity and firewall settings

**Tool Execution Issues:**
- **Tool Not Found**: Verify tool registration and server status
- **Parameter Errors**: Check parameter validation and schemas
- **Execution Timeouts**: Optimize tool performance or increase timeouts
- **Permission Denied**: Review and update permission configurations

**Performance Issues:**
- **Slow Response Times**: Profile tool execution and optimize
- **Memory Leaks**: Monitor resource usage and implement cleanup
- **High CPU Usage**: Optimize algorithms and reduce computational complexity
- **Connection Pool Exhaustion**: Tune connection pool settings

## Next Steps

After completing T4 MCP integration architecture:

1. **Proceed to T5**: [Ollama Integration](./T5-ollama-integration.md) for local LLM setup strategies
2. **Review Security Model**: Design comprehensive permission system
3. **Plan Server Development**: Create development guidelines for MCP servers
4. **Performance Testing**: Establish performance benchmarks and monitoring

This T4 implementation guide provides the architectural foundation for robust multi-server MCP integration, enabling scalable and secure tool orchestration for the Qi V2 Agent.