// Core types for the Qi V2 Agent

export interface AgentMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp?: Date;
}

export interface StreamingOptions {
  onToken?: (token: string) => void;
  onThinking?: (thinking: string) => void;
  onComplete?: (response: string) => void;
  onError?: (error: Error) => void;
  controller?: AbortController;
}

export interface AgentResponse {
  content: string;
  thinking?: string;
  toolCalls?: ToolCall[];
  metadata?: Record<string, unknown>;
}

export interface ToolCall {
  name: string;
  arguments: Record<string, unknown>;
  result?: unknown;
}

export interface MCPTool {
  name: string;
  description: string;
  inputSchema: Record<string, unknown>;
  server?: string;
}

export interface PerformanceMetrics {
  responseTime: number;
  tokensPerSecond: number;
  memoryUsage: number;
  queueLength: number;
  errorRate: number;
  timestamp: Date;
}

// Common interface for all agent factories
export interface IAgentFactory {
  initialize(): Promise<void>;
  stream(messages: AgentMessage[], options?: StreamingOptions, threadId?: string): Promise<void>;
  invoke(messages: AgentMessage[], threadId?: string): Promise<AgentResponse>;
  getAvailableTools(): Promise<string[]>;
  getConnectedServers(): Promise<string[]>;
  healthCheck(): Promise<boolean>;
  cleanup(): Promise<void>;
  getConfig(): any;
  updateConfig?(newConfig: any): Promise<void>;
}