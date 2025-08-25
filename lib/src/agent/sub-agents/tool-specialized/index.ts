/**
 * Tool-Specialized Sub-Agents
 *
 * Complete implementations of tool-specialized sub-agents following the v-0.10.0 roadmap.
 * All sub-agents use QiCore Result<T, QiError> patterns and extend BaseSubAgent.
 */

// Export task type definitions for type safety
export type FileOpsTaskType =
  | 'read_file'
  | 'write_file'
  | 'edit_file'
  | 'search_files'
  | 'file_analysis';

export type SearchTaskType =
  | 'content_search'
  | 'pattern_match'
  | 'code_search'
  | 'file_find'
  | 'multi_pattern_search';

export type WebTaskType =
  | 'web_fetch'
  | 'web_search'
  | 'content_extraction'
  | 'multi_url_fetch'
  | 'web_research';

export type GitTaskType =
  | 'git_status'
  | 'git_commit'
  | 'git_branch'
  | 'git_log'
  | 'git_diff'
  | 'git_workflow';

// Re-export commonly used types from core for convenience
export type {
  SubAgentCapability,
  SubAgentConfig,
  SubAgentProgress,
  SubAgentResult,
  SubAgentTask,
} from '../core/types.js';
// Export all implemented tool-specialized sub-agents
export { FileOpsSubAgent } from './FileOpsSubAgent.js';
export { GitSubAgent } from './GitSubAgent.js';
export { SearchSubAgent } from './SearchSubAgent.js';
export { WebSubAgent } from './WebSubAgent.js';
