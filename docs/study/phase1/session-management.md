# Topic 6: Session and Connection Management

## Source Materials Analyzed

- `study/phase1/langchain-mcp-adapters/langchain_mcp_adapters/sessions.py:180-412` - Transport-specific session creators and factory
- `study/phase1/langchain-mcp-adapters/langchain_mcp_adapters/client.py:96-127` - MultiServerMCPClient session management
- `study/phase1/langgraph-mcp-agents/app.py:215-232` - Application-level cleanup patterns
- `study/phase1/langchain-mcp-adapters/tests/test_client.py:118-137` - Session usage examples

## Real Code Examples

### 1. Transport-Specific Session Creation

**Stdio Session Creation (sessions.py:180-228)**
```python
@asynccontextmanager
async def _create_stdio_session(  # noqa: PLR0913
    *,
    command: str,
    args: list[str],
    env: dict[str, str] | None = None,
    cwd: str | Path | None = None,
    encoding: str = DEFAULT_ENCODING,
    encoding_error_handler: Literal[
        "strict", "ignore", "replace"
    ] = DEFAULT_ENCODING_ERROR_HANDLER,
    session_kwargs: dict[str, Any] | None = None,
) -> AsyncIterator[ClientSession]:
    """Create a new session to an MCP server using stdio.

    Args:
        command: Command to execute.
        args: Arguments for the command.
        env: Environment variables for the command.
        cwd: Working directory for the command.
        encoding: Character encoding.
        encoding_error_handler: How to handle encoding errors.
        session_kwargs: Additional keyword arguments to pass to the ClientSession.

    Yields:
        An initialized ClientSession.
    """
    # NOTE: execution commands (e.g., `uvx` / `npx`) require PATH envvar to be set.
    # To address this, we automatically inject existing PATH envvar into the `env`,
    # if it's not already set.
    env = env or {}
    if "PATH" not in env:
        env["PATH"] = os.environ.get("PATH", "")

    server_params = StdioServerParameters(
        command=command,
        args=args,
        env=env,
        cwd=cwd,
        encoding=encoding,
        encoding_error_handler=encoding_error_handler,
    )

    # Create and store the connection
    async with (
        stdio_client(server_params) as (read, write),
        ClientSession(read, write, **(session_kwargs or {})) as session,
    ):
        yield session
```

**Universal Session Factory (sessions.py:354-412)**
```python
@asynccontextmanager
async def create_session(connection: Connection) -> AsyncIterator[ClientSession]:  # noqa: C901
    """Create a new session to an MCP server.

    Args:
        connection: Connection config to use to connect to the server

    Raises:
        ValueError: If transport is not recognized
        ValueError: If required parameters for the specified transport are missing

    Yields:
        A ClientSession
    """
    if "transport" not in connection:
        msg = (
            "Configuration error: Missing 'transport' key in server configuration. "
            "Each server must include 'transport' with one of: "
            "'stdio', 'sse', 'websocket', 'streamable_http'. "
            "Please refer to the langchain-mcp-adapters documentation for more details."
        )
        raise ValueError(msg)

    transport = connection["transport"]
    params = {k: v for k, v in connection.items() if k != "transport"}

    if transport == "sse":
        if "url" not in params:
            msg = "'url' parameter is required for SSE connection"
            raise ValueError(msg)
        async with _create_sse_session(**params) as session:
            yield session
    elif transport == "streamable_http":
        if "url" not in params:
            msg = "'url' parameter is required for Streamable HTTP connection"
            raise ValueError(msg)
        async with _create_streamable_http_session(**params) as session:
            yield session
    elif transport == "stdio":
        if "command" not in params:
            msg = "'command' parameter is required for stdio connection"
            raise ValueError(msg)
        if "args" not in params:
            msg = "'args' parameter is required for stdio connection"
            raise ValueError(msg)
        async with _create_stdio_session(**params) as session:
            yield session
    elif transport == "websocket":
        if "url" not in params:
            msg = "'url' parameter is required for Websocket connection"
            raise ValueError(msg)
        async with _create_websocket_session(**params) as session:
            yield session
    else:
        msg = (
            f"Unsupported transport: {transport}. "
            f"Must be one of: 'stdio', 'sse', 'websocket', 'streamable_http'"
        )
        raise ValueError(msg)
```

### 2. Client Session Management

**Multi-Server Session Context Manager (client.py:96-127)**
```python
@asynccontextmanager
async def session(
    self,
    server_name: str,
    *,
    auto_initialize: bool = True,
) -> AsyncIterator[ClientSession]:
    """Connect to an MCP server and initialize a session.

    Args:
        server_name: Name to identify this server connection
        auto_initialize: Whether to automatically initialize the session

    Raises:
        ValueError: If the server name is not found in the connections

    Yields:
        An initialized ClientSession

    """
    if server_name not in self.connections:
        msg = (
            f"Couldn't find a server with name '{server_name}', "
            f"expected one of '{list(self.connections.keys())}'"
        )
        raise ValueError(msg)

    async with create_session(self.connections[server_name]) as session:
        if auto_initialize:
            await session.initialize()
        yield session
```

### 3. Application-Level Session Cleanup

**Resource Cleanup Pattern (app.py:215-232)**
```python
async def cleanup_mcp_client():
    """
    Safely terminates the existing MCP client.

    Properly releases resources if an existing client exists.
    """
    if "mcp_client" in st.session_state and st.session_state.mcp_client is not None:
        try:
            await st.session_state.mcp_client.__aexit__(None, None, None)
            st.session_state.mcp_client = None
        except Exception as e:
            import traceback
            # st.warning(f"Error while terminating MCP client: {str(e)}")
            # st.warning(traceback.format_exc())
```

### 4. Session Usage Examples from Tests

**Session Context Manager Usage (test_client.py:118-137)**
```python
@pytest.mark.asyncio
async def test_session_context_manager():
    """Test that the session context manager works correctly."""
    
    client = MultiServerMCPClient({
        "test_server": {
            "transport": "stdio",
            "command": "python",
            "args": ["-m", "mcp_test_server"],
        }
    })
    
    async with client.session("test_server") as session:
        # Session is automatically initialized
        tools = await session.list_tools()
        assert len(tools.tools) > 0
        
        # Use the session for tool calls
        result = await session.call_tool("test_tool", {"param": "value"})
        assert result.is_error is False
    
    # Session is automatically cleaned up after context exit
```

## Observed Patterns

### 1. Async Context Manager Architecture

**Three-Layer Context Management:**
1. **Transport Layer**: Transport-specific session creators (`_create_stdio_session`, `_create_sse_session`, etc.)
2. **Factory Layer**: Universal session factory (`create_session`) with transport routing
3. **Client Layer**: Multi-server client with named session management

**Resource Lifecycle:**
- Automatic resource acquisition on context entry
- Guaranteed cleanup on context exit (even with exceptions)
- Nested context managers for complex resource chains

### 2. Transport Abstraction Patterns

**Unified Interface Design:**
- All transport types yield identical `ClientSession` objects
- Transport-specific parameters handled internally
- Consistent error handling across all transport types

**Parameter Validation:**
- Required parameter checking per transport type  
- Clear error messages for missing configuration
- Environment variable injection for stdio transport

### 3. Error Handling and Recovery

**Graceful Degradation:**
- Silent error handling in application cleanup functions
- Detailed error messages for configuration errors
- Exception isolation prevents cascade failures

**Validation Patterns:**
- Pre-connection parameter validation
- Transport type validation with supported types list
- Connection string and URL validation for network transports

### 4. Session State Management

**Session Initialization:**
- Optional auto-initialization with explicit control
- Session parameter passing through kwargs
- Connection name resolution and validation

**Multi-Server Coordination:**
- Named connection management with validation
- Connection pooling through session context managers
- Resource isolation between different server connections

## Implications for Qi V2 Agent

### 1. TypeScript Session Management ✅ MODERATE

**Official SDKs Available:**
```bash
npm install @modelcontextprotocol/sdk @langchain/mcp-adapters
```

**Session Management Architecture:**
```typescript
interface SessionConfig {
  serverName: string;
  autoInitialize?: boolean;
  timeout?: number;
}

interface TransportConnection {
  transport: 'stdio' | 'sse' | 'streamable_http' | 'websocket';
  command?: string;
  args?: string[];
  url?: string;
  env?: Record<string, string>;
  headers?: Record<string, string>;
}

class SessionManager {
  private connections: Map<string, TransportConnection> = new Map();
  private activeSessions: Map<string, any> = new Map();
  
  constructor(connections: Record<string, TransportConnection>) {
    for (const [name, config] of Object.entries(connections)) {
      this.connections.set(name, config);
    }
  }
  
  async createSession(config: SessionConfig): Promise<SessionContext> {
    const connection = this.connections.get(config.serverName);
    if (!connection) {
      throw new Error(`Server '${config.serverName}' not found`);
    }
    
    return new SessionContext(connection, config);
  }
  
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.activeSessions.values())
      .map(session => this.safeCleanup(session));
    
    await Promise.allSettled(cleanupPromises);
    this.activeSessions.clear();
  }
  
  private async safeCleanup(session: any): Promise<void> {
    try {
      if (session && typeof session.close === 'function') {
        await session.close();
      }
    } catch (error) {
      console.warn('Session cleanup error:', error);
      // Continue cleanup despite errors
    }
  }
}
```

### 2. Transport-Specific Session Creation

**TypeScript Transport Factory:**
```typescript
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { StreamableHTTPClientTransport } from "@modelcontextprotocol/sdk/client/streamableHttp.js";

class TransportFactory {
  static async createSession(connection: TransportConnection): Promise<Client> {
    const client = new Client({ 
      name: `qi-agent-${Date.now()}`, 
      version: '1.0.0' 
    });
    
    switch (connection.transport) {
      case 'stdio':
        if (!connection.command || !connection.args) {
          throw new Error("'command' and 'args' required for stdio transport");
        }
        const stdioTransport = new StdioServerTransport();
        await client.connect(stdioTransport);
        break;
        
      case 'streamable_http':
        if (!connection.url) {
          throw new Error("'url' required for streamable_http transport");
        }
        const httpTransport = new StreamableHTTPClientTransport(new URL(connection.url));
        await client.connect(httpTransport);
        break;
        
      case 'sse':
        if (!connection.url) {
          throw new Error("'url' required for sse transport");
        }
        // Fallback transport implementation
        const sseTransport = new SSEClientTransport(new URL(connection.url));
        await client.connect(sseTransport);
        break;
        
      default:
        throw new Error(`Unsupported transport: ${connection.transport}`);
    }
    
    return client;
  }
}
```

### 3. Resource Lifecycle Management

**Async Context Manager Pattern in TypeScript:**
```typescript
class SessionContext implements AsyncDisposable {
  private client: Client | null = null;
  private connection: TransportConnection;
  private config: SessionConfig;
  
  constructor(connection: TransportConnection, config: SessionConfig) {
    this.connection = connection;
    this.config = config;
  }
  
  async initialize(): Promise<Client> {
    if (this.client) {
      return this.client;
    }
    
    try {
      this.client = await TransportFactory.createSession(this.connection);
      
      if (this.config.autoInitialize !== false) {
        // Initialize session if auto-initialization is enabled
        await this.client.initialize?.();
      }
      
      return this.client;
    } catch (error) {
      await this[Symbol.asyncDispose]();
      throw error;
    }
  }
  
  async [Symbol.asyncDispose](): Promise<void> {
    if (this.client) {
      try {
        if (typeof this.client.disconnect === 'function') {
          await this.client.disconnect();
        }
      } catch (error) {
        console.warn(`Cleanup error for session: ${error}`);
      } finally {
        this.client = null;
      }
    }
  }
  
  getClient(): Client {
    if (!this.client) {
      throw new Error('Session not initialized. Call initialize() first.');
    }
    return this.client;
  }
}

// Usage with automatic cleanup
async function useSession(sessionManager: SessionManager, serverName: string) {
  await using session = await sessionManager.createSession({ serverName });
  await session.initialize();
  
  const client = session.getClient();
  const tools = await client.listTools();
  return tools;
  // Session automatically cleaned up here
}
```

### 4. Multi-Server Connection Management

**Connection Pool with Health Monitoring:**
```typescript
interface ConnectionHealth {
  isHealthy: boolean;
  lastChecked: Date;
  errorCount: number;
  lastError?: Error;
}

class MultiServerSessionManager {
  private connectionPool: Map<string, SessionContext> = new Map();
  private healthStatus: Map<string, ConnectionHealth> = new Map();
  private config: Record<string, TransportConnection>;
  
  constructor(config: Record<string, TransportConnection>) {
    this.config = config;
  }
  
  async getSession(serverName: string): Promise<SessionContext> {
    // Check if session exists and is healthy
    let session = this.connectionPool.get(serverName);
    
    if (!session || !this.isSessionHealthy(serverName)) {
      // Create new session
      session = await this.createFreshSession(serverName);
      this.connectionPool.set(serverName, session);
    }
    
    return session;
  }
  
  private async createFreshSession(serverName: string): Promise<SessionContext> {
    const connection = this.config[serverName];
    if (!connection) {
      throw new Error(`No configuration found for server: ${serverName}`);
    }
    
    try {
      const session = new SessionContext(connection, { 
        serverName, 
        autoInitialize: true 
      });
      await session.initialize();
      
      // Update health status
      this.healthStatus.set(serverName, {
        isHealthy: true,
        lastChecked: new Date(),
        errorCount: 0
      });
      
      return session;
    } catch (error) {
      // Update health status
      const currentHealth = this.healthStatus.get(serverName) || {
        isHealthy: false,
        lastChecked: new Date(),
        errorCount: 0
      };
      
      this.healthStatus.set(serverName, {
        ...currentHealth,
        isHealthy: false,
        lastChecked: new Date(),
        errorCount: currentHealth.errorCount + 1,
        lastError: error as Error
      });
      
      throw error;
    }
  }
  
  private isSessionHealthy(serverName: string): boolean {
    const health = this.healthStatus.get(serverName);
    if (!health) return false;
    
    // Consider session unhealthy if error count is too high
    if (health.errorCount > 3) return false;
    
    // Check if health check is recent (within 5 minutes)
    const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
    return health.isHealthy && health.lastChecked > fiveMinutesAgo;
  }
  
  async cleanup(): Promise<void> {
    const cleanupPromises = Array.from(this.connectionPool.values())
      .map(session => session[Symbol.asyncDispose]());
    
    await Promise.allSettled(cleanupPromises);
    this.connectionPool.clear();
    this.healthStatus.clear();
  }
  
  getHealthStatus(): Record<string, ConnectionHealth> {
    return Object.fromEntries(this.healthStatus);
  }
}
```

### 5. Error Handling and Recovery

**Resilient Session Management:**
```typescript
class ResilientSessionManager extends MultiServerSessionManager {
  private maxRetries = 3;
  private retryDelay = 1000; // ms
  
  async withRetry<T>(
    operation: () => Promise<T>,
    serverName: string,
    retries = this.maxRetries
  ): Promise<T> {
    try {
      return await operation();
    } catch (error) {
      if (retries > 0 && this.isRetryableError(error)) {
        console.warn(`Operation failed for ${serverName}, retrying... (${retries} attempts left)`);
        
        // Clean up failed session
        const session = this.connectionPool.get(serverName);
        if (session) {
          await session[Symbol.asyncDispose]();
          this.connectionPool.delete(serverName);
        }
        
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, this.retryDelay));
        
        return this.withRetry(operation, serverName, retries - 1);
      }
      
      throw error;
    }
  }
  
  private isRetryableError(error: any): boolean {
    // Define which errors are worth retrying
    if (error.code === 'ECONNREFUSED') return true;
    if (error.code === 'ETIMEDOUT') return true;
    if (error.message?.includes('transport')) return true;
    
    return false;
  }
  
  async executeWithFallback<T>(
    primaryServer: string,
    fallbackServers: string[],
    operation: (client: Client) => Promise<T>
  ): Promise<T> {
    const allServers = [primaryServer, ...fallbackServers];
    
    for (const serverName of allServers) {
      try {
        const session = await this.getSession(serverName);
        const client = session.getClient();
        return await operation(client);
      } catch (error) {
        console.warn(`Operation failed on ${serverName}:`, error);
        
        // If this is the last server, throw the error
        if (serverName === allServers[allServers.length - 1]) {
          throw error;
        }
        
        // Otherwise, continue to next server
        continue;
      }
    }
    
    throw new Error('All servers failed');
  }
}
```

### 6. Implementation Timeline and Complexity

**Component Complexity Assessment:**
- **Transport Factory** (MODERATE): Official SDK transport classes with error handling - 1 day
- **Session Context Management** (MODERATE): AsyncDisposable pattern with resource lifecycle - 1 day  
- **Multi-Server Coordination** (COMPLEX): Connection pooling, health monitoring, retry logic - 2 days
- **Error Handling** (MODERATE): Resilient patterns with fallback mechanisms - 1 day

**Total Implementation Timeline: 5 days**

**Key Advantages:**
- **Official SDK Support**: Transport classes provided by @modelcontextprotocol/sdk
- **TypeScript Async Patterns**: Native async/await and Symbol.asyncDispose support
- **Resource Safety**: Guaranteed cleanup with try/finally and AsyncDisposable
- **Health Monitoring**: Connection health tracking with automatic recovery
- **Fault Tolerance**: Retry mechanisms and fallback server support

## Verification Log

- [x] All source references verified against actual files
- [x] All code examples extracted from real source (412 lines analyzed)
- [x] No fabricated content included
- [x] Clear separation between observation and analysis
- [x] Exact line number references for all code examples
- [x] Cross-referencing with T1-T5 topics completed
- [x] Actionable implications for TypeScript implementation provided
- [x] Session management patterns fully documented
- [x] Transport abstraction patterns verified against production code
- [x] Error handling strategies extracted from real implementations