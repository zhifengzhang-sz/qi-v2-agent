/**
 * ConfigBuilder Extensions for Functional Composition
 * 
 * Adds missing flatMap/map methods to enable clean @qi/base patterns
 */

import { ConfigBuilder } from '@qi/core/config';
import { flatMap, map, type Result, type QiError } from '@qi/base';
import type { ConfigError } from '@qi/core/config';

declare module '@qi/core/config' {
  interface ConfigBuilder {
    flatMap<T>(fn: (builder: ConfigBuilder) => Result<T, ConfigError>): Result<T, ConfigError>;
    map<T>(fn: (builder: ConfigBuilder) => T): ConfigBuilder;
  }
}

// Extend ConfigBuilder prototype with functional composition methods
ConfigBuilder.prototype.flatMap = function<T>(
  fn: (builder: ConfigBuilder) => Result<T, ConfigError>
): Result<T, ConfigError> {
  return fn(this);
};

ConfigBuilder.prototype.map = function<T>(
  fn: (builder: ConfigBuilder) => T
): ConfigBuilder {
  const result = fn(this);
  // If the function returns a ConfigBuilder, return it; otherwise wrap in new builder
  return result instanceof ConfigBuilder ? result : this;
};

export {}; // Make this a module