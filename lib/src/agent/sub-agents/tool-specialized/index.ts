/**
 * Tool-Specialized Sub-Agents
 * 
 * Note: These implementations are in development.
 * Currently only exporting interfaces for build compatibility.
 */

// Export types for now
export type FileOpsTaskType = 'file_read' | 'file_write' | 'file_edit' | 'file_search';
export type SearchTaskType = 'content_search' | 'pattern_match' | 'code_search';
export type WebTaskType = 'web_fetch' | 'web_search' | 'content_extraction';
export type CodeAnalysisTaskType = 'code_review' | 'pattern_detection' | 'dependency_analysis';
export type GitTaskType = 'git_status' | 'git_commit' | 'git_branch' | 'git_merge';

// TODO: Export actual implementations once TypeScript errors are resolved
// export { FileOpsSubAgent } from './FileOpsSubAgent.js';
// export { SearchSubAgent } from './SearchSubAgent.js';
// export { WebSubAgent } from './WebSubAgent.js';
// export { CodeAnalysisSubAgent } from './CodeAnalysisSubAgent.js';
// export { GitSubAgent } from './GitSubAgent.js';