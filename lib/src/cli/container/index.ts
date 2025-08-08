/**
 * CLI Container - Dependency injection for CLI components
 * 
 * This module exports the dependency injection container implementation
 * with QiCore-based error handling and lifecycle management.
 */

// Container implementation
export { CLIContainer } from './CLIContainer.js';

// Re-export container interfaces
export type {
  ICLIContainer,
  ICLIContainerBuilder,
  IFrameworkRegistry,
  ServiceFactory,
  ServiceLifecycle,
  ServiceRegistration,
  ContainerConfig,
  CLIFactory,
  ContainerFactory,
  FrameworkRegistration,
} from '../abstractions/ICLIContainer.js';