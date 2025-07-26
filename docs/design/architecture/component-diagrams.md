# Component Diagrams (C4 Level 3)

## Overview

This document presents the component-level architecture for both containers in the qi-v2-agent system, showing the internal structure and interactions within each container.

## CLI Container Components

### CLI Container Component Diagram

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "lineColor": "#000000"}}}%%
graph TB
    subgraph "CLI Container"
        subgraph "Command Processing"
            CommandParser["<b>Command Parser</b><br/>TypeScript Component<br/><br/>Parses CLI arguments and validates<br/>command syntax using Commander.js<br/><br/>• Argument parsing<br/>• Option validation<br/>• Help generation"]
            
            CommandRouter["<b>Command Router</b><br/>TypeScript Component<br/><br/>Routes commands to appropriate<br/>handlers based on command type<br/><br/>• Static command routing<br/>• Interactive command routing<br/>• Workflow command routing"]
        end
        
        subgraph "Command Handlers"
            StaticHandler["<b>Static Command Handler</b><br/>TypeScript Component<br/><br/>Executes immediate commands<br/>that don't require interaction<br/><br/>• Config display<br/>• Server status<br/>• Help commands"]
            
            InteractiveHandler["<b>Interactive Command Handler</b><br/>TypeScript Component<br/><br/>Manages long-running interactive<br/>sessions with user input<br/><br/>• Session lifecycle<br/>• User input processing<br/>• UI state management"]
            
            WorkflowHandler["<b>Workflow Command Handler</b><br/>TypeScript Component<br/><br/>Executes predefined workflows<br/>with pre-loaded messages<br/><br/>• Workflow template loading<br/>• Message pre-processing<br/>• Automatic execution"]
        end
        
        subgraph "UI Layer"
            UIRenderer["<b>UI Renderer</b><br/>TypeScript Component<br/><br/>Renders terminal output using<br/>console.log or Ink React<br/><br/>• Static output rendering<br/>• Interactive UI components<br/>• Streaming display"]
            
            InputHandler["<b>Input Handler</b><br/>TypeScript Component<br/><br/>Captures and processes user<br/>input in interactive mode<br/><br/>• Keyboard input capture<br/>• Input validation<br/>• Command completion"]
        end
        
        subgraph "Smart Router Integration"
            SmartRouterClient["<b>Smart Router Client</b><br/>TypeScript Component<br/><br/>Communicates with Smart Router<br/>Container via API calls<br/><br/>• Message transmission<br/>• Response streaming<br/>• Connection management"]
        end
        
        subgraph "Configuration"
            ConfigManager["<b>Config Manager</b><br/>TypeScript Component<br/><br/>Loads and validates CLI<br/>configuration settings<br/><br/>• Config file loading<br/>• Environment variables<br/>• Validation schemas"]
        end
    end
    
    subgraph "External Systems"
        UserTerminal["<b>User Terminal</b><br/>External System<br/><br/>Terminal where user<br/>enters commands"]
        
        SmartRouterAPI["<b>Smart Router Container</b><br/>External Container<br/><br/>Provides intelligent routing<br/>and tool orchestration"]
    end
    
    %% User interaction flow
    UserTerminal --> CommandParser
    CommandParser --> CommandRouter
    CommandRouter --> StaticHandler
    CommandRouter --> InteractiveHandler
    CommandRouter --> WorkflowHandler
    
    %% UI interaction flow
    StaticHandler --> UIRenderer
    InteractiveHandler --> UIRenderer
    WorkflowHandler --> UIRenderer
    InteractiveHandler --> InputHandler
    InputHandler --> InteractiveHandler
    
    %% Smart Router integration
    InteractiveHandler --> SmartRouterClient
    WorkflowHandler --> SmartRouterClient
    SmartRouterClient --> SmartRouterAPI
    SmartRouterAPI --> SmartRouterClient
    SmartRouterClient --> UIRenderer
    
    %% Configuration
    CommandParser --> ConfigManager
    StaticHandler --> ConfigManager
    InteractiveHandler --> ConfigManager
    WorkflowHandler --> ConfigManager
    
    %% Output to user
    UIRenderer --> UserTerminal
    
    classDef command fill:#e3f2fd,stroke:#1976d2,color:#000000
    classDef handler fill:#fff3e0,stroke:#f57c00,color:#000000
    classDef ui fill:#f3e5f5,stroke:#7b1fa2,color:#000000
    classDef integration fill:#e8f5e8,stroke:#2e7d32,color:#000000
    classDef config fill:#fce4ec,stroke:#c2185b,color:#000000
    classDef external fill:#f5f5f5,stroke:#757575,color:#000000
    
    class CommandParser,CommandRouter command
    class StaticHandler,InteractiveHandler,WorkflowHandler handler
    class UIRenderer,InputHandler ui
    class SmartRouterClient integration
    class ConfigManager config
    class UserTerminal,SmartRouterAPI external
```

### CLI Container Component Responsibilities

#### Command Processing Layer
- **Command Parser**: 
  - Parses `process.argv` using Commander.js
  - Validates command syntax and options
  - Generates help documentation
  
- **Command Router**: 
  - Determines command type (static/interactive/workflow)
  - Routes to appropriate handler
  - Manages command lifecycle

#### Command Handlers Layer
- **Static Command Handler**:
  - Handles `qi config --show`, `qi servers --list`
  - Immediate execution and exit
  - Direct console output

- **Interactive Command Handler**:
  - Handles `qi unified`, `qi chat`
  - Long-running sessions
  - Real-time user interaction

- **Workflow Command Handler**:
  - Handles `qi edit file.js "fix bug"`
  - Pre-loaded workflow execution
  - Automatic tool triggering

#### UI Layer
- **UI Renderer**:
  - Static output via console.log
  - Interactive UI via Ink React
  - Streaming response display

- **Input Handler**:
  - Keyboard input capture
  - Input validation and processing
  - Command completion support

#### Integration Layer
- **Smart Router Client**:
  - HTTP/IPC communication with Smart Router
  - Message serialization/deserialization
  - Connection pooling and retry logic

#### Configuration Layer
- **Config Manager**:
  - YAML configuration loading
  - Environment variable override
  - Configuration validation

## Smart Router Container Components

### Smart Router Container Component Diagram

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "lineColor": "#000000"}}}%%
graph TB
    subgraph "Smart Router Container"
        subgraph "Request Processing"
            RequestHandler["<b>Request Handler</b><br/>TypeScript Component<br/><br/>Receives and validates incoming<br/>requests from CLI Container<br/><br/>• Request validation<br/>• Message parsing<br/>• Context extraction"]
            
            ResponseGenerator["<b>Response Generator</b><br/>TypeScript Component<br/><br/>Formats and streams responses<br/>back to CLI Container<br/><br/>• Response formatting<br/>• Token streaming<br/>• Status updates"]
        end
        
        subgraph "Intelligence Layer"
            IntentAnalyzer["<b>Intent Analyzer</b><br/>TypeScript Component<br/><br/>Analyzes user messages to<br/>determine intent and routing<br/><br/>• Natural language analysis<br/>• Pattern matching<br/>• Confidence scoring"]
            
            RoutingEngine["<b>Routing Engine</b><br/>TypeScript Component<br/><br/>Decides between direct LLM response<br/>and tool-based workflows<br/><br/>• Routing decision logic<br/>• Strategy selection<br/>• Fallback handling"]
        end
        
        subgraph "LLM Integration"
            LLMProvider["<b>LLM Provider</b><br/>TypeScript Component<br/><br/>Abstracts different LLM providers<br/>and manages model interactions<br/><br/>• Provider abstraction<br/>• Request/response handling<br/>• Connection pooling"]
            
            PromptManager["<b>Prompt Manager</b><br/>TypeScript Component<br/><br/>Manages system prompts and<br/>context formatting for LLMs<br/><br/>• System prompt templates<br/>• Context formatting<br/>• Token optimization"]
        end
        
        subgraph "Tool Management"
            ToolManager["<b>Tool Manager</b><br/>TypeScript Component<br/><br/>Orchestrates tool execution<br/>and manages tool lifecycle<br/><br/>• Tool discovery<br/>• Execution orchestration<br/>• Result aggregation"]
            
            MCPIntegration["<b>MCP Integration</b><br/>TypeScript Component<br/><br/>Integrates with Model Context<br/>Protocol servers for tools<br/><br/>• MCP server communication<br/>• Tool registration<br/>• Protocol handling"]
            
            WorkflowTools["<b>Workflow Tools</b><br/>TypeScript Component<br/><br/>Built-in workflow tools for<br/>common development tasks<br/><br/>• edit_files tool<br/>• analyze_code tool<br/>• explain_concept tool"]
        end
        
        subgraph "State Management"
            ConversationManager["<b>Conversation Manager</b><br/>TypeScript Component<br/><br/>Manages conversation context<br/>and message history<br/><br/>• Context tracking<br/>• Message persistence<br/>• Thread management"]
            
            SessionManager["<b>Session Manager</b><br/>TypeScript Component<br/><br/>Manages user sessions and<br/>maintains session state<br/><br/>• Session lifecycle<br/>• State persistence<br/>• Cleanup management"]
        end
        
        subgraph "Configuration"
            ConfigValidator["<b>Config Validator</b><br/>TypeScript Component<br/><br/>Validates Smart Router<br/>configuration and settings<br/><br/>• Schema validation<br/>• Environment setup<br/>• Error reporting"]
        end
    end
    
    subgraph "External Systems"
        CLIContainerAPI["<b>CLI Container</b><br/>External Container<br/><br/>Sends user messages and<br/>receives responses"]
        
        OllamaServer["<b>Ollama Server</b><br/>External System<br/><br/>Local LLM inference<br/>server (localhost:11434)"]
        
        MCPServers["<b>MCP Servers</b><br/>External System<br/><br/>Tool execution servers<br/>(filesystem, git, etc.)"]
    end
    
    %% Request flow
    CLIContainerAPI --> RequestHandler
    RequestHandler --> IntentAnalyzer
    IntentAnalyzer --> RoutingEngine
    
    %% Direct LLM flow
    RoutingEngine --> LLMProvider
    LLMProvider --> PromptManager
    PromptManager --> OllamaServer
    OllamaServer --> LLMProvider
    LLMProvider --> ResponseGenerator
    
    %% Tool workflow flow
    RoutingEngine --> ToolManager
    ToolManager --> MCPIntegration
    ToolManager --> WorkflowTools
    MCPIntegration --> MCPServers
    MCPServers --> MCPIntegration
    WorkflowTools --> LLMProvider
    ToolManager --> ResponseGenerator
    
    %% Context and state management
    IntentAnalyzer --> ConversationManager
    ConversationManager --> SessionManager
    SessionManager --> ConversationManager
    RoutingEngine --> ConversationManager
    
    %% Configuration
    RequestHandler --> ConfigValidator
    LLMProvider --> ConfigValidator
    ToolManager --> ConfigValidator
    
    %% Response flow
    ResponseGenerator --> CLIContainerAPI
    
    classDef request fill:#e3f2fd,stroke:#1976d2,color:#000000
    classDef intelligence fill:#fff3e0,stroke:#f57c00,color:#000000
    classDef llm fill:#f3e5f5,stroke:#7b1fa2,color:#000000
    classDef tools fill:#e8f5e8,stroke:#2e7d32,color:#000000
    classDef state fill:#fce4ec,stroke:#c2185b,color:#000000
    classDef config fill:#f1f8e9,stroke:#689f38,color:#000000
    classDef external fill:#f5f5f5,stroke:#757575,color:#000000
    
    class RequestHandler,ResponseGenerator request
    class IntentAnalyzer,RoutingEngine intelligence
    class LLMProvider,PromptManager llm
    class ToolManager,MCPIntegration,WorkflowTools tools
    class ConversationManager,SessionManager state
    class ConfigValidator config
    class CLIContainerAPI,OllamaServer,MCPServers external
```

### Smart Router Container Component Responsibilities

#### Request Processing Layer
- **Request Handler**:
  - Validates incoming requests from CLI Container
  - Extracts message content and context
  - Handles authentication and rate limiting

- **Response Generator**:
  - Formats responses for CLI Container
  - Manages streaming token delivery
  - Provides status updates and error handling

#### Intelligence Layer
- **Intent Analyzer**:
  - Performs natural language analysis
  - Classifies user intent (conversation, workflow, etc.)
  - Provides confidence scores for routing decisions

- **Routing Engine**:
  - Makes routing decisions based on intent analysis
  - Selects between direct LLM and tool workflows
  - Handles fallback strategies for ambiguous inputs

#### LLM Integration Layer
- **LLM Provider**:
  - Abstracts different LLM providers (Ollama, OpenAI, etc.)
  - Manages model loading and inference
  - Handles connection pooling and retry logic

- **Prompt Manager**:
  - Manages system prompt templates
  - Formats context for LLM consumption
  - Optimizes token usage and context windows

#### Tool Management Layer
- **Tool Manager**:
  - Orchestrates tool discovery and execution
  - Manages tool dependencies and sequencing
  - Aggregates results from multiple tools

- **MCP Integration**:
  - Communicates with MCP servers via JSON-RPC
  - Handles tool registration and lifecycle
  - Manages protocol compliance and error handling

- **Workflow Tools**:
  - Implements built-in development workflow tools
  - Provides edit_files, analyze_code, explain_concept
  - Integrates with LLM for content generation

#### State Management Layer
- **Conversation Manager**:
  - Tracks conversation context and history
  - Manages message threading and continuity
  - Provides context for intent analysis

- **Session Manager**:
  - Manages user session lifecycle
  - Persists session state across interactions
  - Handles session cleanup and resource management

#### Configuration Layer
- **Config Validator**:
  - Validates Smart Router configuration schemas
  - Manages environment-specific settings
  - Provides configuration error reporting

## Component Interaction Patterns

### Cross-Container Communication

```mermaid
%%{init: {"theme": "base", "themeVariables": {"primaryColor": "#ffffff", "primaryTextColor": "#000000", "primaryBorderColor": "#000000", "lineColor": "#000000"}}}%%
sequenceDiagram
    participant CLI as CLI Container<br/>Smart Router Client
    participant REQ as Smart Router Container<br/>Request Handler
    participant INT as Intent Analyzer
    participant ROUTE as Routing Engine
    participant LLM as LLM Provider
    participant TOOL as Tool Manager
    participant RESP as Response Generator
    
    CLI->>REQ: User message + context
    REQ->>INT: Analyze intent
    INT->>ROUTE: Intent + confidence
    
    alt Direct LLM Response
        ROUTE->>LLM: Generate response
        LLM->>RESP: LLM response
    else Tool Workflow
        ROUTE->>TOOL: Execute tools
        TOOL->>LLM: Generate content
        LLM->>TOOL: Generated content
        TOOL->>RESP: Tool results
    end
    
    RESP->>CLI: Streaming response
```

### Intra-Container Component Flow

#### CLI Container Flow
```
User Input → Command Parser → Command Router → Handler → UI Renderer → User Output
                                    ↓
                            Smart Router Client ← → Smart Router Container
```

#### Smart Router Container Flow
```
CLI Request → Request Handler → Intent Analyzer → Routing Engine
                                                        ↓
                                              LLM Provider ← → Ollama
                                                        ↓
                                               Tool Manager ← → MCP Servers
                                                        ↓
                                             Response Generator → CLI Response
```

## Component Dependencies

### CLI Container Dependencies
- **Command Parser** → ConfigManager
- **Command Router** → StaticHandler, InteractiveHandler, WorkflowHandler
- **Interactive/Workflow Handlers** → SmartRouterClient, UIRenderer
- **UI Renderer** → External Terminal
- **Smart Router Client** → Smart Router Container API

### Smart Router Container Dependencies
- **Request Handler** → ConfigValidator
- **Intent Analyzer** → ConversationManager, LLMProvider
- **Routing Engine** → IntentAnalyzer, ToolManager, LLMProvider
- **LLM Provider** → OllamaServer, PromptManager
- **Tool Manager** → MCPIntegration, WorkflowTools
- **MCP Integration** → External MCP Servers
- **All Components** → ConfigValidator

## Error Handling Between Components

### CLI Container Error Flow
```
Component Error → Error Handler → UI Renderer → User-Friendly Message
                      ↓
                Smart Router Client → Retry/Fallback Logic
```

### Smart Router Container Error Flow
```
Component Error → Error Logger → Response Generator → Error Response to CLI
                      ↓
                Circuit Breaker → Fallback Strategy
```

## Performance Considerations

### CLI Container
- **Command Parser**: <50ms parsing time
- **UI Renderer**: 16ms frame rate for smooth streaming
- **Smart Router Client**: Connection pooling for efficiency

### Smart Router Container  
- **Intent Analyzer**: <500ms analysis time
- **LLM Provider**: Connection pooling, request batching
- **Tool Manager**: Parallel tool execution where possible
- **Conversation Manager**: Efficient context windowing

This component-level view provides the detailed internal structure needed to understand how each container achieves its responsibilities through well-defined component interactions and clear separation of concerns.