/**
 * QiCore-based Agent Connector implementation
 *
 * Provides robust agent integration with qicore Result<T> patterns
 * and functional composition for connection management and communication.
 */

import { create, Err, fromAsyncTryCatch, match, Ok, type QiError, type Result } from '@qi/base';
import type { IAgentConnector } from '../abstractions/ICLIServices.js';

/**
 * Agent connector error types
 */
interface AgentConnectorError extends QiError {
  context: {
    agentId?: string;
    operation?: string;
    connectionState?: string;
    error?: string;
    input?: string;
  };
}

const agentError = (
  code: string,
  message: string,
  context: AgentConnectorError['context'] = {}
): AgentConnectorError => create(code, message, 'NETWORK', context) as AgentConnectorError;

/**
 * Agent connection state
 */
type ConnectionState = 'disconnected' | 'connecting' | 'connected' | 'error' | 'disposed';

/**
 * Agent information interface
 */
interface AgentInfo {
  id: string;
  name: string;
  version?: string;
  capabilities?: string[];
  status: ConnectionState;
  lastActivity?: Date;
  connectionTime?: Date;
}

/**
 * Event handler types
 */
type ProgressHandler = (progress: any) => void;
type MessageHandler = (message: any) => void;
type CompleteHandler = (result: any) => void;
type ErrorHandler = (error: any) => void;
type CancelledHandler = (reason: string) => void;

/**
 * QiCore implementation of agent connectivity
 * Provides robust connection management with proper error handling
 */
export class QiCoreAgentConnector implements IAgentConnector {
  private currentAgent: any = null;
  private connectionState: ConnectionState = 'disconnected';
  private agentInfo: AgentInfo | null = null;
  private eventHandlers: {
    progress: ProgressHandler[];
    message: MessageHandler[];
    complete: CompleteHandler[];
    error: ErrorHandler[];
    cancelled: CancelledHandler[];
  } = {
    progress: [],
    message: [],
    complete: [],
    error: [],
    cancelled: [],
  };
  private connectionTimeout: number = 30000; // 30 seconds
  private isDisposed = false;

  constructor(options: { connectionTimeout?: number } = {}) {
    this.connectionTimeout = options.connectionTimeout || 30000;
  }

  /**
   * Connect to an agent with timeout and validation
   */
  connectAgent(agent: any): Result<void, QiError> {
    if (this.isDisposed) {
      return Err(
        agentError('CONNECTOR_DISPOSED', 'Agent connector has been disposed', {
          operation: 'connect',
        })
      );
    }

    const validationResult = this.validateAgent(agent);

    return match(
      (validatedAgent) => {
        this.connectionState = 'connecting';

        try {
          // Store agent reference
          this.currentAgent = validatedAgent;

          // Create agent info
          this.agentInfo = {
            id: this.generateAgentId(validatedAgent),
            name: validatedAgent.constructor?.name || 'Unknown Agent',
            status: 'connected',
            connectionTime: new Date(),
            lastActivity: new Date(),
            capabilities: this.extractCapabilities(validatedAgent),
          };

          // Setup event listeners
          this.setupAgentEventListeners(validatedAgent);

          this.connectionState = 'connected';
          return Ok(void 0);
        } catch (error) {
          this.connectionState = 'error';
          return Err(
            agentError(
              'CONNECTION_FAILED',
              `Failed to connect to agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { operation: 'connect', error: String(error) }
            )
          );
        }
      },
      (error) => Err(error),
      validationResult
    );
  }

  /**
   * Disconnect from current agent
   */
  disconnectAgent(): Result<void, QiError> {
    if (this.connectionState === 'disconnected') {
      return Ok(void 0);
    }

    try {
      // Remove event listeners
      this.removeAgentEventListeners();

      // Clear agent reference
      this.currentAgent = null;
      this.agentInfo = null;
      this.connectionState = 'disconnected';

      return Ok(void 0);
    } catch (error) {
      return Err(
        agentError(
          'DISCONNECTION_FAILED',
          `Failed to disconnect from agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { operation: 'disconnect', error: String(error) }
        )
      );
    }
  }

  /**
   * Send input to connected agent
   */
  async sendToAgent(input: string, context?: any): Promise<Result<void, QiError>> {
    const connectionCheck = this.checkConnection();

    return await match(
      async () => {
        const inputValidation = this.validateInput(input);

        return await match(
          async (validInput) => {
            return await fromAsyncTryCatch(
              async () => {
                if (!this.currentAgent.process) {
                  throw new Error('Agent does not support processing');
                }

                const request = {
                  input: validInput,
                  context: {
                    timestamp: new Date(),
                    source: 'qicore-agent-connector',
                    ...context,
                  },
                };

                // Update last activity
                if (this.agentInfo) {
                  this.agentInfo.lastActivity = new Date();
                }

                // Send to agent (fire and forget - results come via events)
                this.currentAgent.process(request).catch((error: Error) => {
                  this.handleAgentError(error);
                });

                return void 0;
              },
              (error: unknown) =>
                agentError(
                  'SEND_FAILED',
                  `Failed to send input to agent: ${error instanceof Error ? error.message : 'Unknown error'}`,
                  {
                    operation: 'send',
                    input: input.slice(0, 100), // Truncate for logging
                    error: String(error),
                  }
                )
            );
          },
          async (error: QiError) => Err(error),
          inputValidation
        );
      },
      async (error: QiError) => Err(error),
      connectionCheck
    );
  }

  /**
   * Cancel current agent operation
   */
  cancelAgent(): Result<void, QiError> {
    const connectionCheck = this.checkConnection();

    return match(
      () => {
        try {
          if (this.currentAgent.cancel && typeof this.currentAgent.cancel === 'function') {
            this.currentAgent.cancel();
          } else {
            // Emit manual cancellation if agent doesn't support it
            this.eventHandlers.cancelled.forEach((handler) => {
              try {
                handler('manual_cancellation');
              } catch (error) {
                console.error('Error in cancelled handler:', error);
              }
            });
          }

          return Ok(void 0);
        } catch (error) {
          return Err(
            agentError(
              'CANCEL_FAILED',
              `Failed to cancel agent operation: ${error instanceof Error ? error.message : 'Unknown error'}`,
              { operation: 'cancel', error: String(error) }
            )
          );
        }
      },
      (error) => Err(error),
      connectionCheck
    );
  }

  /**
   * Check if agent is connected
   */
  isAgentConnected(): boolean {
    return this.connectionState === 'connected' && this.currentAgent !== null;
  }

  /**
   * Get current agent information
   */
  getAgentInfo(): AgentInfo | null {
    return this.agentInfo ? { ...this.agentInfo } : null;
  }

  /**
   * Set up agent event handlers
   */
  onAgentProgress(callback: ProgressHandler): void {
    this.eventHandlers.progress.push(callback);
  }

  onAgentMessage(callback: MessageHandler): void {
    this.eventHandlers.message.push(callback);
  }

  onAgentComplete(callback: CompleteHandler): void {
    this.eventHandlers.complete.push(callback);
  }

  onAgentError(callback: ErrorHandler): void {
    this.eventHandlers.error.push(callback);
  }

  onAgentCancelled(callback: CancelledHandler): void {
    this.eventHandlers.cancelled.push(callback);
  }

  /**
   * Remove all agent event handlers
   */
  removeAgentHandlers(): void {
    this.eventHandlers = {
      progress: [],
      message: [],
      complete: [],
      error: [],
      cancelled: [],
    };
  }

  /**
   * Get connection statistics
   */
  getConnectionStats(): {
    state: ConnectionState;
    uptime?: number;
    lastActivity?: Date;
    handlerCount: Record<string, number>;
  } {
    const stats = {
      state: this.connectionState,
      handlerCount: {
        progress: this.eventHandlers.progress.length,
        message: this.eventHandlers.message.length,
        complete: this.eventHandlers.complete.length,
        error: this.eventHandlers.error.length,
        cancelled: this.eventHandlers.cancelled.length,
      },
    };

    if (this.agentInfo?.connectionTime) {
      return {
        ...stats,
        uptime: Date.now() - this.agentInfo.connectionTime.getTime(),
        lastActivity: this.agentInfo.lastActivity,
      };
    }

    return stats;
  }

  /**
   * Dispose of connector and clean up resources
   */
  dispose(): Result<void, QiError> {
    if (this.isDisposed) {
      return Ok(void 0);
    }

    try {
      // Disconnect from agent
      this.disconnectAgent();

      // Remove all handlers
      this.removeAgentHandlers();

      // Mark as disposed
      this.isDisposed = true;

      return Ok(void 0);
    } catch (error) {
      return Err(
        agentError(
          'DISPOSAL_FAILED',
          `Failed to dispose connector: ${error instanceof Error ? error.message : 'Unknown error'}`,
          { operation: 'dispose', error: String(error) }
        )
      );
    }
  }

  // Private methods

  private validateAgent(agent: any): Result<any, QiError> {
    if (!agent) {
      return Err(
        agentError('INVALID_AGENT', 'Agent cannot be null or undefined', { operation: 'validate' })
      );
    }

    if (typeof agent !== 'object') {
      return Err(
        agentError('INVALID_AGENT_TYPE', 'Agent must be an object', { operation: 'validate' })
      );
    }

    // Check for required methods
    if (!agent.process || typeof agent.process !== 'function') {
      return Err(
        agentError('MISSING_PROCESS_METHOD', 'Agent must have a process method', {
          operation: 'validate',
        })
      );
    }

    return Ok(agent);
  }

  private validateInput(input: string): Result<string, QiError> {
    if (!input || typeof input !== 'string') {
      return Err(
        agentError('INVALID_INPUT', 'Input must be a non-empty string', {
          operation: 'validateInput',
          input: String(input),
        })
      );
    }

    const trimmed = input.trim();
    if (trimmed.length === 0) {
      return Err(
        agentError('EMPTY_INPUT', 'Input cannot be empty', { operation: 'validateInput' })
      );
    }

    return Ok(trimmed);
  }

  private checkConnection(): Result<void, QiError> {
    if (this.isDisposed) {
      return Err(
        agentError('CONNECTOR_DISPOSED', 'Agent connector has been disposed', {
          connectionState: this.connectionState,
        })
      );
    }

    if (this.connectionState !== 'connected') {
      return Err(
        agentError('NOT_CONNECTED', 'No agent connected', {
          connectionState: this.connectionState,
          operation: 'checkConnection',
        })
      );
    }

    if (!this.currentAgent) {
      return Err(
        agentError('INVALID_AGENT_REFERENCE', 'Agent reference is invalid', {
          connectionState: this.connectionState,
          operation: 'checkConnection',
        })
      );
    }

    return Ok(void 0);
  }

  private generateAgentId(agent: any): string {
    const timestamp = Date.now();
    const random = Math.random().toString(36).substr(2, 9);
    const name = agent.constructor?.name || 'Agent';
    return `${name}-${timestamp}-${random}`;
  }

  private extractCapabilities(agent: any): string[] {
    const capabilities: string[] = [];

    if (agent.process) capabilities.push('process');
    if (agent.cancel) capabilities.push('cancel');
    if (agent.getCurrentModel) capabilities.push('model-info');
    if (agent.stateManager) capabilities.push('state-management');

    return capabilities;
  }

  private setupAgentEventListeners(agent: any): void {
    if (agent.on && typeof agent.on === 'function') {
      agent.on('progress', (progress: any) => this.handleAgentProgress(progress));
      agent.on('message', (message: any) => this.handleAgentMessage(message));
      agent.on('complete', (result: any) => this.handleAgentComplete(result));
      agent.on('error', (error: any) => this.handleAgentError(error));
      agent.on('cancelled', (reason: string) => this.handleAgentCancelled(reason));
    }
  }

  private removeAgentEventListeners(): void {
    if (this.currentAgent?.removeAllListeners) {
      this.currentAgent.removeAllListeners('progress');
      this.currentAgent.removeAllListeners('message');
      this.currentAgent.removeAllListeners('complete');
      this.currentAgent.removeAllListeners('error');
      this.currentAgent.removeAllListeners('cancelled');
    }
  }

  private handleAgentProgress(progress: any): void {
    if (this.agentInfo) {
      this.agentInfo.lastActivity = new Date();
    }

    this.eventHandlers.progress.forEach((handler) => {
      try {
        handler(progress);
      } catch (error) {
        console.error('Error in progress handler:', error);
      }
    });
  }

  private handleAgentMessage(message: any): void {
    if (this.agentInfo) {
      this.agentInfo.lastActivity = new Date();
    }

    this.eventHandlers.message.forEach((handler) => {
      try {
        handler(message);
      } catch (error) {
        console.error('Error in message handler:', error);
      }
    });
  }

  private handleAgentComplete(result: any): void {
    if (this.agentInfo) {
      this.agentInfo.lastActivity = new Date();
    }

    this.eventHandlers.complete.forEach((handler) => {
      try {
        handler(result);
      } catch (error) {
        console.error('Error in complete handler:', error);
      }
    });
  }

  private handleAgentError(error: any): void {
    if (this.agentInfo) {
      this.agentInfo.lastActivity = new Date();
    }

    this.eventHandlers.error.forEach((handler) => {
      try {
        handler(error);
      } catch (error) {
        console.error('Error in error handler:', error);
      }
    });
  }

  private handleAgentCancelled(reason: string): void {
    if (this.agentInfo) {
      this.agentInfo.lastActivity = new Date();
    }

    this.eventHandlers.cancelled.forEach((handler) => {
      try {
        handler(reason);
      } catch (error) {
        console.error('Error in cancelled handler:', error);
      }
    });
  }
}
