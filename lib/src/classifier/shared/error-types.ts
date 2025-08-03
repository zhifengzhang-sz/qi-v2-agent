/**
 * Standardized Error Context Types for Classifier Module
 * 
 * This module defines unified error context structures across all classification methods
 * to ensure consistent error reporting and debugging capabilities.
 */

import type { QiError } from '@qi/base';

/**
 * Base error context shared across all classification methods
 */
export interface BaseClassificationErrorContext {
  // Input and operation identification
  input?: string;
  operation: string;
  method: string;
  
  // Model and provider information
  model?: string;
  provider?: string;
  
  // Error details
  error?: string;
  
  // Input characteristics
  length?: number;
  
  // Performance metrics
  latency_ms?: number;
  
  // Session tracking (for conversational methods)
  session_id?: string;
  
  // Index signature for QiCore compatibility
  [key: string]: unknown;
}

/**
 * Extended context for retry-based classification methods
 */
export interface RetryClassificationErrorContext extends BaseClassificationErrorContext {
  retry_count?: number;
  max_retries?: number;
  attempt?: number;
}

/**
 * Extended context for parsing-based classification methods
 */
export interface ParsingClassificationErrorContext extends RetryClassificationErrorContext {
  parse_attempt?: number;
  fixing_attempts?: number;
  parser_type?: string;
  schema_name?: string;
}

/**
 * Extended context for rule-based classification methods
 */
export interface RuleBasedClassificationErrorContext extends BaseClassificationErrorContext {
  pattern?: string;
  rule_type?: string;
  matched_patterns?: string[];
}

/**
 * Unified classification error interface
 */
export interface ClassificationError extends QiError {
  context: BaseClassificationErrorContext;
}

/**
 * Retry-based classification error interface
 */
export interface RetryClassificationError extends QiError {
  context: RetryClassificationErrorContext;
}

/**
 * Parsing-based classification error interface
 */
export interface ParsingClassificationError extends QiError {
  context: ParsingClassificationErrorContext;
}

/**
 * Rule-based classification error interface
 */
export interface RuleBasedClassificationError extends QiError {
  context: RuleBasedClassificationErrorContext;
}

/**
 * Shared error factory utilities for consistent error creation across all classification methods
 */
export function createClassificationError(
  method: string,
  code: string,
  message: string,
  category: import('@qi/base').ErrorCategory,
  context: Partial<BaseClassificationErrorContext> = {}
): import('@qi/base').QiError {
  const { create } = require('@qi/base');
  return create(code, message, category, {
    operation: 'classification',
    method,
    ...context
  });
}

export function createRuleBasedError(
  code: string,
  message: string,
  category: import('@qi/base').ErrorCategory,
  context: Partial<RuleBasedClassificationErrorContext> = {}
): import('@qi/base').QiError {
  return createClassificationError('rule-based', code, message, category, context);
}

export function createRetryError(
  method: string,
  code: string,
  message: string,
  category: import('@qi/base').ErrorCategory,
  context: Partial<RetryClassificationErrorContext> = {}
): import('@qi/base').QiError {
  return createClassificationError(method, code, message, category, context);
}

export function createParsingError(
  method: string,
  code: string,
  message: string,
  category: import('@qi/base').ErrorCategory,
  context: Partial<ParsingClassificationErrorContext> = {}
): import('@qi/base').QiError {
  return createClassificationError(method, code, message, category, context);
}