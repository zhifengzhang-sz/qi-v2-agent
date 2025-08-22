/**
 * QiCore Result<T, E> implementation matching @qi/base patterns
 * Uses discriminated union with 'tag' property and standalone functions
 */

export type Result<T, E = Error> = 
  | { readonly tag: 'success'; readonly value: T }
  | { readonly tag: 'error'; readonly error: E };

// Create success results
export const Ok = <T>(value: T): Result<T, never> => ({
  tag: 'success',
  value,
});

export const success = Ok; // Alias for compatibility

// Create error results  
export const Err = <E>(error: E): Result<never, E> => ({
  tag: 'error',
  error,
});

export const failure = Err; // Alias for compatibility

// Standalone match function - NEVER use result.match()!
export const match = <T, E, R>(
  onSuccess: (value: T) => R,
  onError: (error: E) => R,
  result: Result<T, E>
): R => {
  if (result.tag === 'success') {
    return onSuccess(result.value);
  } else {
    return onError(result.error);
  }
};

// Standalone map function - transform success values
export const map = <T, U, E>(
  fn: (value: T) => U,
  result: Result<T, E>
): Result<U, E> => {
  if (result.tag === 'success') {
    return Ok(fn(result.value));
  } else {
    return { tag: 'error', error: result.error };
  }
};

// Standalone flatMap function - chain operations that return Result<T>
export const flatMap = <T, U, E>(
  fn: (value: T) => Result<U, E>,
  result: Result<T, E>
): Result<U, E> => {
  if (result.tag === 'success') {
    return fn(result.value);
  } else {
    return { tag: 'error', error: result.error };
  }
};

// Convert async operations to Result<T>
export const fromAsyncTryCatch = async <T, E = Error>(
  asyncFn: () => Promise<T>,
  errorMapper: (error: unknown) => E
): Promise<Result<T, E>> => {
  try {
    const value = await asyncFn();
    return Ok(value);
  } catch (error) {
    return Err(errorMapper(error));
  }
};

// QiError interface matching @qi/base
export interface QiError {
  readonly code: string;
  readonly message: string;
  readonly category: 'VALIDATION' | 'BUSINESS' | 'SYSTEM' | 'NETWORK' | 'AUTHENTICATION' | 'AUTHORIZATION';
  readonly details?: Record<string, unknown>;
}

// Error factory function
export const create = (
  code: string,
  message: string,
  category: QiError['category'],
  details?: Record<string, unknown>
): QiError => ({
  code,
  message,
  category,
  details,
});

// Common error constructors
export const validationError = (message: string, details?: Record<string, unknown>): QiError =>
  create('VALIDATION_ERROR', message, 'VALIDATION', details);

export const networkError = (message: string, details?: Record<string, unknown>): QiError =>
  create('NETWORK_ERROR', message, 'NETWORK', details);

export const businessError = (message: string, details?: Record<string, unknown>): QiError =>
  create('BUSINESS_ERROR', message, 'BUSINESS', details);

export const systemError = (message: string, details?: Record<string, unknown>): QiError =>
  create('SYSTEM_ERROR', message, 'SYSTEM', details);