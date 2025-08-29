# Dual-Route Claude Integration Proposal

## Executive Summary

This proposal outlines two distinct integration strategies for leveraging Claude's capabilities: 
1. **CLI Route**: Using Claude Code CLI as execution engine
2. **SDK Route**: Direct Claude API integration for multi-agent orchestration

Both routes leverage Claude's 2025 multi-agent capabilities but with different architectural approaches.

## Route 1: CLI Integration (Execution Engine Approach)

### Architecture
```
┌─────────────────┐    ┌───────────────────┐    ┌──────────────────┐
│   qi-v2-agent   │───▶│  CLI Bridge Layer │───▶│ Claude Code CLI  │
│   (Orchestrator)│    │ (Config Mapper)   │    │ (Execution Engine)│
└─────────────────┘    └───────────────────┘    └──────────────────┘
       │                         │                         │
       │                         │                         │
       ▼                         ▼                         ▼
┌─────────────────┐    ┌───────────────────┐    ┌──────────────────┐
│ Custom SubAgents│    │  Result Parser    │◀───│  CLI Output     │
│ (Specialized)   │    │ (Event Converter) │    │ (Stream/Results)│
└─────────────────┘    └───────────────────┘    └──────────────────┘
```

### Implementation

#### 1. CLI Bridge Layer
```typescript
// src/integration/claude-cli/bridge.ts
export class ClaudeCLIBridge {
  private cliProcess: ChildProcess;
  
  async executeTask(taskConfig: CLITaskConfig): Promise<CLIResult> {
    const cliCommand = this.buildCLICommand(taskConfig);
    
    return new Promise((resolve, reject) => {
      this.cliProcess = spawn('claude', cliCommand, {
        env: this.prepareCLIEnvironment(taskConfig)
      });
      
      let output = '';
      this.cliProcess.stdout.on('data', (data) => {
        output += data.toString();
        this.emit('progress', this.parseProgress(data));
      });
      
      this.cliProcess.on('close', (code) => {
        if (code === 0) {
          resolve(this.parseFinalResult(output));
        } else {
          reject(new CLIExecutionError(output));
        }
      });
    });
  }
  
  private buildCLICommand(config: CLITaskConfig): string[] {
    return [
      '--task', JSON.stringify(config.task),
      '--agents', config.agents.join(','),
      '--format', 'json-stream',
      '--timeout', config.timeoutMs.toString()
    ];
  }
}
```

#### 2. Configuration Mapping
```typescript
// src/integration/claude-cli/config-mapper.ts
export class CLIConfigMapper {
  mapQiToClaudeConfig(qiConfig: QiWorkflowConfig): CLITaskConfig {
    return {
      task: this.mapTaskDescription(qiConfig.task),
      agents: this.mapSubAgents(qiConfig.agents),
      resources: {
        maxMemory: qiConfig.resources.memoryLimit || '1G',
        maxTime: qiConfig.resources.timeoutMs || 300000,
        concurrency: qiConfig.concurrency || 5
      },
      environment: this.mapEnvironment(qiConfig.env)
    };
  }
  
  private mapSubAgents(qiAgents: QiSubAgent[]): string[] {
    return qiAgents.map(agent => 
      `@${agent.role}:${agent.specialization}`
    );
  }
}
```

### Advantages
- **Leverages full Claude Code CLI capabilities**
- **No API rate limits or costs** (local execution)
- **Complete feature access** including latest sub-agent system
- **Better for complex, long-running tasks**

### Limitations
- **Requires Claude Code CLI installation**
- **Less control over execution flow**
- **Harder to debug and monitor**
- **Platform-dependent**

## Route 2: SDK Integration (API-First Approach)

### Architecture
```
┌─────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│   qi-v2-agent   │───▶│  SDK Orchestrator   │───▶│  Claude API      │
│   (Controller)  │    │ (Direct Integration)│    │ (Cloud Service)  │
└─────────────────┘    └─────────────────────┘    └──────────────────┘
       │                         │                         │
       │                         │                         │
       ▼                         ▼                         ▼
┌─────────────────┐    ┌─────────────────────┐    ┌──────────────────┐
│ Custom Logic    │    │  Response Handler   │◀───│  API Responses   │
│ (Business Rules)│    │ (Result Processing) │    │ (JSON Streaming) │
└─────────────────┘    └─────────────────────┘    └──────────────────┘
```

### Implementation

#### 1. SDK Orchestrator
```typescript
// src/integration/claude-sdk/orchestrator.ts
export class ClaudeSDKOrchestrator {
  private anthropic: Anthropic;
  
  async executeMultiAgentWorkflow(
    task: string, 
    agents: AgentSpec[]
  ): Promise<WorkflowResult> {
    const message: MessageParam = {
      role: 'user',
      content: this.buildAgentCoordinationPrompt(task, agents)
    };
    
    const response = await this.anthropic.messages.create({
      model: 'claude-3.5-sonnet',
      messages: [message],
      max_tokens: 4096,
      tools: this.prepareAgentTools(agents),
      tool_choice: 'auto'
    });
    
    return this.processAgentResponse(response);
  }
  
  private buildAgentCoordinationPrompt(task: string, agents: AgentSpec[]): string {
    return `Coordinate these specialized agents:
${agents.map(a => `- @${a.name}: ${a.specialization}`).join('\n')}

Task: ${task}

Please delegate subtasks appropriately and synthesize final results.`;
  }
}
```

#### 2. Agent Management
```typescript
// src/integration/claude-sdk/agent-manager.ts
export class SDKAgentManager {
  private agentRegistry = new Map<string, AgentCapabilities>();
  
  registerAgent(name: string, capabilities: AgentCapabilities) {
    this.agentRegistry.set(name, capabilities);
  }
  
  async createSubAgent(task: string, agentType: string): Promise<SubAgent> {
    const capabilities = this.agentRegistry.get(agentType);
    if (!capabilities) {
      throw new AgentNotFoundError(agentType);
    }
    
    const response = await this.anthropic.messages.create({
      model: 'claude-3.5-sonnet',
      messages: [{
        role: 'user',
        content: `Act as ${agentType} agent. Task: ${task}`
      }],
      max_tokens: 2048,
      tools: capabilities.tools
    });
    
    return {
      id: generateId(),
      type: agentType,
      task: task,
      response: response
    };
  }
}
```

### Advantages
- **No local installation required**
- **Better monitoring and control**
- **Easier debugging and logging**
- **Platform independent**
- **Direct integration with existing auth/system**

### Limitations
- **API rate limits and costs**
- **Limited to API-exposed features**
- **Network dependency**
- **Potential latency**

## Comparative Analysis

### Feature Comparison
| Feature | CLI Route | SDK Route |
|---------|-----------|-----------|
| Sub-agent coordination | ✅ Full access | ✅ API available |
| Real-time streaming | ✅ Native | ✅ Via API |
| Tool execution | ✅ Direct | ✅ Through API |
| Resource management | ✅ Local control | ⚠️ API limits |
| Cost | Free (local) | Usage-based |
| Installation | Required | None |
| Platform support | Limited | Universal |

### Performance Characteristics
| Metric | CLI Route | SDK Route |
|--------|-----------|-----------|
| Latency | Low (local) | Medium (network) |
| Throughput | High | API-dependent |
| Reliability | High | Network-dependent |
| Scalability | Limited | High (cloud) |

## Hybrid Approach Recommendation

### Phase 1: SDK First (Immediate)
```typescript
// Start with SDK for rapid development
const orchestrator = new HybridOrchestrator({
  primary: 'sdk',    // Use SDK as default
  fallback: 'cli',   // Fallback to CLI if needed
  features: {
    planning: 'sdk',     // Use SDK for coordination
    execution: 'cli',    // Use CLI for heavy execution
    synthesis: 'sdk'     // Use SDK for result aggregation
  }
});
```

### Phase 2: Dynamic Routing
```typescript
// Smart routing based on task characteristics
class SmartRouter {
  async routeTask(task: Task): Promise<IntegrationRoute> {
    const characteristics = this.analyzeTask(task);
    
    if (characteristics.complexity > 8) {
      return 'cli'; // Complex tasks to CLI
    } else if (characteristics.requiresRealtime) {
      return 'sdk'; // Real-time to SDK
    } else if (task.resourceIntensive) {
      return 'cli'; // Resource-heavy to CLI
    } else {
      return 'sdk'; // Default to SDK
    }
  }
}
```

### Phase 3: Unified Interface
```typescript
// Unified interface that abstracts both routes
class UnifiedClaudeIntegration {
  constructor(private cliBridge: ClaudeCLIBridge, 
              private sdkOrchestrator: ClaudeSDKOrchestrator) {}
  
  async execute(task: Task, options?: ExecutionOptions) {
    const route = options?.route || await this.determineBestRoute(task);
    
    switch (route) {
      case 'cli':
        return this.cliBridge.executeTask(task);
      case 'sdk':
        return this.sdkOrchestrator.executeTask(task);
      default:
        throw new Error(`Unknown route: ${route}`);
    }
  }
}
```

## Implementation Roadmap

### Month 1: Foundation
- **Both routes**: Basic interface implementation
- **SDK route**: API integration and authentication
- **CLI route**: Command mapping and execution bridge

### Month 2: Feature Parity
- **Both routes**: Sub-agent coordination support
- **SDK route**: Streaming response handling
- **CLI route**: Output parsing and error handling

### Month 3: Production Ready
- **Hybrid routing**: Smart task distribution
- **Monitoring**: Unified logging and metrics
- **Optimization**: Performance tuning for both routes

## Configuration Examples

### CLI Route Configuration
```yaml
# config/claude-cli.yaml
claude:
  cli:
    path: "/usr/local/bin/claude"
    timeout: 300000
    env:
      ANTHROPIC_API_KEY: ${ANTHROPIC_API_KEY}
      CLAUDE_DEBUG: "false"
    resources:
      max_memory: "2G"
      max_concurrent: 10
```

### SDK Route Configuration
```yaml
# config/claude-sdk.yaml
claude:
  sdk:
    api_key: ${ANTHROPIC_API_KEY}
    model: "claude-3.5-sonnet"
    timeout: 30000
    max_retries: 3
    rate_limiting:
      requests_per_minute: 100
      burst_capacity: 20
```

### Hybrid Configuration
```yaml
# config/hybrid.yaml
claude:
  strategy: "hybrid"
  default_route: "sdk"
  routing_rules:
    - when: task.complexity > 7
      route: "cli"
    - when: task.requires_realtime == true
      route: "sdk"
    - when: task.resource_usage > 500
      route: "cli"
  fallback:
    primary: "sdk"
    secondary: "cli"
```

## Risk Mitigation

### CLI Route Risks
1. **Installation dependency**: Provide automated setup scripts
2. **Version compatibility**: Implement version checking
3. **Platform limitations**: Clear documentation of requirements

### SDK Route Risks  
1. **API rate limits**: Implement smart rate limiting and caching
2. **Network issues**: Robust retry mechanisms and fallbacks
3. **Cost management**: Usage monitoring and budget controls

## Conclusion

The dual-route approach provides maximum flexibility:

1. **SDK Route**: Best for most use cases - no installation, better control
2. **CLI Route**: Essential for complex tasks and resource-intensive operations  
3. **Hybrid Approach**: Optimal balance leveraging both strengths

Start with **SDK implementation** for rapid development, then add **CLI support** for performance-critical scenarios, with a **smart router** to choose the best path for each task.