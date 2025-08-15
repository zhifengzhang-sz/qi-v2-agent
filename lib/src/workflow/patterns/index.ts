/**
 * @qi/workflow - Research Patterns Export
 *
 * AutoFlow research patterns implementation for v-0.8.0:
 * - ReAct: Reasoning and Acting with interleaved thought-action loops
 * - ReWOO: Reasoning Without Observations with upfront planning
 * - ADaPT: As-Needed Decomposition and Planning with recursive task breakdown
 */

export type { ADaPTTask } from './ADaPTPattern.js';
export { ADaPTPattern } from './ADaPTPattern.js';
export { ReActPattern } from './ReActPattern.js';

export type { ReWOOEvidence, ReWOOPlanStep } from './ReWOOPattern.js';
export { ReWOOPattern } from './ReWOOPattern.js';

import { ADaPTPattern } from './ADaPTPattern.js';
import { ReActPattern } from './ReActPattern.js';
import { ReWOOPattern } from './ReWOOPattern.js';

// Pattern factory for easy instantiation
export const createReActPattern = (toolExecutor?: any, config?: any) =>
  new ReActPattern(toolExecutor, config);

export const createReWOOPattern = (toolExecutor?: any, config?: any) =>
  new ReWOOPattern(toolExecutor, config);

export const createADaPTPattern = (toolExecutor?: any, config?: any) =>
  new ADaPTPattern(toolExecutor, config);
