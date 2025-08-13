# Model Context Protocol (MCP) Integration

Claude Code implements a comprehensive MCP integration system that enables seamless connection to external servers for tools, resources, and capabilities expansion.

## System Overview

The MCP integration architecture provides a standardized protocol for extending Claude Code's capabilities through external services:

```
┌─────────────────────────────────────────────────────────────────┐
│                     Claude Code Core                           │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ MCP Manager │  │ MCP Client  │  │ MCP Resource Cache  │      │
│  │   (DV)      │  │   Pool      │  │      System         │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ MCP Config  │  │ MCP Tool    │  │ MCP OAuth Provider  │      │
│  │ Validator   │  │ Registry    │  │      (MO)           │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
├─────────────────────────────────────────────────────────────────┤
│                  MCP Transport Layer                           │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ HTTP Client │  │ SSE Client  │  │ WebSocket Client    │      │
│  │ (FF1)       │  │ (FF1)       │  │     (Do1)           │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ STDIO Client│  │ IDE Client  │  │ Protocol Handler    │      │
│  │             │  │             │  │      (wt)           │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────────┐
│                    MCP Servers                                 │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ HTTP Server │  │ SSE Server  │  │ WebSocket Server    │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────┐      │
│  │ STDIO Server│  │ IDE Server  │  │ Local Process       │      │
│  └─────────────┘  └─────────────┘  └─────────────────────┘      │
└─────────────────────────────────────────────────────────────────┘
```

## Core Components

### 1. MCP Server Manager (DV Function)

The `DV` function serves as the central MCP server management system:

**Responsibilities:**
- **Server Discovery**: Automatically discover and load MCP server configurations
- **Lifecycle Management**: Handle server startup, monitoring, and cleanup
- **Configuration Validation**: Ensure server configurations meet schema requirements
- **Health Monitoring**: Monitor server health and handle failures

**Key Features:**
- **Multi-scope Configuration**: Supports local, project, and user-level configurations
- **Hot Reloading**: Dynamic configuration updates without restart
- **Fallback Mechanisms**: Graceful degradation when servers fail

### 2. MCP Client Pool (ue Function)

The client connection factory manages different MCP transport protocols:

**Supported Protocols:**
- **STDIO**: Direct process communication
- **HTTP**: RESTful API communication  
- **SSE**: Server-Sent Events for streaming
- **WebSocket**: Full-duplex communication
- **WebSocket-IDE**: IDE-specific WebSocket protocol
- **SSE-IDE**: IDE-specific Server-Sent Events

**Connection Management:**
```javascript
// Connection Factory Pattern
class MCPClientPool {
  createConnection(type, config) {
    switch (type) {
      case 'stdio': return new STDIOClient(config);
      case 'http': return new HTTPClient(config);
      case 'sse': return new SSEClient(config);
      case 'ws': return new WebSocketClient(config);
      case 'ws-ide': return new IDEWebSocketClient(config);
      case 'sse-ide': return new IDESSEClient(config);
    }
  }
}
```

### 3. Protocol Handler (wt Function)

The protocol handler manages JSON-RPC communication:

**Core Functions:**
- **Message Serialization**: Convert requests to JSON-RPC format
- **Response Processing**: Parse and validate server responses
- **Error Handling**: Handle protocol-level errors
- **Timeout Management**: Manage request timeouts and retries

**JSON-RPC Implementation:**
```javascript
// JSON-RPC Message Format
{
  "jsonrpc": "2.0",
  "method": "tool_call",
  "params": {
    "tool_name": "example_tool",
    "arguments": {...}
  },
  "id": "unique_request_id"
}
```

## Configuration System

### 1. Configuration Hierarchy

Claude Code implements a three-tier configuration system:

```
Configuration Priority (highest to lowest):
1. Local (.mcp.json in current directory)
2. Project (.mcp.json in project root)
3. User (~/.claude/mcp.json)
```

### 2. Configuration Schema

**Base Configuration Format:**
```json
{
  "mcpServers": {
    "server_name": {
      "type": "stdio|http|sse|ws|ws-ide|sse-ide",
      "command": "string",           // stdio required
      "args": ["string"],           // stdio optional
      "url": "string",              // http/sse required
      "headers": {"key": "value"},  // http optional
      "authToken": "string",        // ws-ide optional
      "env": {"key": "value"}       // stdio optional
    }
  }
}
```

**Example Configurations:**

*STDIO Server:*
```json
{
  "mcpServers": {
    "filesystem": {
      "type": "stdio",
      "command": "mcp-server-filesystem",
      "args": ["--root", "/path/to/directory"],
      "env": {
        "LOG_LEVEL": "debug"
      }
    }
  }
}
```

*HTTP Server:*
```json
{
  "mcpServers": {
    "api_service": {
      "type": "http",
      "url": "https://api.example.com/mcp",
      "headers": {
        "Authorization": "Bearer token",
        "Content-Type": "application/json"
      }
    }
  }
}
```

### 3. Configuration Validation (Ug Function)

The schema validator ensures configuration integrity:

**Validation Rules:**
- **Required Fields**: Verify all required fields present
- **Type Checking**: Validate field types and formats
- **Protocol Validation**: Ensure protocol-specific requirements
- **Security Validation**: Check for insecure configurations

## Tool Integration

### 1. Tool Registry System

The MCP tool registry manages external tool discovery and access:

**Tool Naming Convention:**
```
mcp__<server_name>__<tool_name>
```

**Registry Functions:**
- **ZP1**: Tool name parser and resolver
- **j81**: Server name standardization
- **pi/y81**: Tool filtering by server name

### 2. Tool Resolution Pipeline

```
Tool Call Flow:
┌─────────────┐
│ Agent Tool  │
│ Request     │
└──────┬──────┘
       │
┌──────▼──────┐
│ Name Parser │  mcp__server__tool
│ (ZP1)       │  ↓
└──────┬──────┘  server: "server"
       │         tool: "tool"
┌──────▼──────┐
│ Server      │
│ Lookup      │
└──────┬──────┘
       │
┌──────▼──────┐
│ Protocol    │
│ Handler     │
└──────┬──────┘
       │
┌──────▼──────┐
│ MCP Server  │
│ Execution   │
└─────────────┘
```

## Transport Implementations

### 1. STDIO Transport

**Use Case**: Local process communication
**Advantages**: Low latency, secure
**Implementation**: Direct stdin/stdout communication

### 2. HTTP Transport (FF1)

**Use Case**: RESTful API integration
**Features**: 
- Standard HTTP methods
- Header customization
- Authentication support
- Request/response logging

### 3. Server-Sent Events (SSE)

**Use Case**: Streaming data from servers
**Features**:
- Real-time updates
- Automatic reconnection
- Event filtering

### 4. WebSocket Transport (Do1)

**Use Case**: Full-duplex communication
**Features**:
- Bi-directional messaging
- Low-latency communication
- Connection pooling

## Authentication and Security

### 1. OAuth Provider (MO Function)

Manages OAuth 2.0 authentication flows:

**Supported Flows:**
- Authorization Code Flow
- Client Credentials Flow
- Device Code Flow

**Token Management:**
- Automatic token refresh
- Secure token storage
- Token expiration handling

### 2. Security Measures

**Transport Security:**
- TLS encryption for network protocols
- Certificate validation
- Secure header handling

**Access Control:**
- Server-level permission validation
- Tool-level access restrictions
- Rate limiting

**Data Protection:**
- Request/response logging controls
- Sensitive data filtering
- Audit trail maintenance

## Error Handling and Recovery

### 1. Error Categories

**Connection Errors:**
- Server unavailable
- Network timeouts  
- Authentication failures

**Protocol Errors:**
- Malformed JSON-RPC messages
- Unsupported methods
- Version mismatches

**Tool Errors:**
- Tool not found
- Invalid arguments
- Execution failures

### 2. Recovery Strategies

**Automatic Recovery:**
- Connection retry with exponential backoff
- Fallback to alternative servers
- Graceful degradation of functionality

**Manual Recovery:**
- Configuration validation tools
- Server health diagnostics
- Manual reconnection options

## Performance Optimization

### 1. Connection Pooling

**Features:**
- Reuse existing connections
- Connection lifecycle management
- Resource cleanup

### 2. Caching System

**Resource Cache:**
- Cache server responses
- Intelligent cache invalidation
- Memory usage optimization

### 3. Request Optimization

**Batching:**
- Combine multiple requests
- Reduce protocol overhead
- Improve throughput

**Compression:**
- Request/response compression
- Bandwidth optimization
- Optional compression negotiation

## Integration with Agent System

### 1. Tool System Integration

MCP tools integrate seamlessly with Claude Code's native tool system:

```
Tool Execution Pipeline:
Agent Loop → Tool Router → MCP Handler → External Server
     ↑                                          ↓
     ←─────── Response Processing ←──────── Response
```

### 2. Real-time Streaming

MCP servers can participate in real-time streaming:

- **SSE Integration**: Stream updates through h2A message queue
- **WebSocket Support**: Bi-directional real-time communication
- **Event Coordination**: Coordinate events across multiple MCP servers

### 3. Context Management

**Context Sharing:**
- Share conversation context with MCP servers
- Selective context filtering for security
- Context compression for performance

This comprehensive MCP integration enables Claude Code to extend its capabilities through external services while maintaining security, performance, and reliability standards.