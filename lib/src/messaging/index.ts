/**
 * Messaging Module for v-0.6.x Async Messaging
 *
 * Core async message queue system inspired by Claude Code's h2A pattern,
 * adapted for QiCore functional programming with Result<T> error handling.
 */

// Implementations
export * from '@qi/agent/messaging/impl';
export { QiAsyncMessageQueue } from '@qi/agent/messaging/impl/QiAsyncMessageQueue';
export { QiMessageFactory } from '@qi/agent/messaging/impl/QiMessageFactory';
// Interfaces
export * from '@qi/agent/messaging/interfaces';

export {
  type IAsyncMessageQueue,
  QueueEventType,
  type QueueOptions,
  type QueueState,
} from '@qi/agent/messaging/interfaces/IAsyncMessageQueue';
// Types and enums
export * from '@qi/agent/messaging/types';
// Convenience re-exports for common usage
export {
  type AgentOutputMessage,
  type BaseMessage,
  type CommandMessage,
  MessagePriority,
  MessageStatus,
  MessageType,
  type QiMessage,
  type SystemControlMessage,
  type UserInputMessage,
} from '@qi/agent/messaging/types/MessageTypes';
