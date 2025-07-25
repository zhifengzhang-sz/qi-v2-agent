import type { AgentMessage } from '@qi/agent';

/**
 * Creates workflow messages that trigger smart routing to LangGraph agent
 * These messages are designed to contain keywords that the smart router
 * will detect as requiring tools (needsTools=true)
 */

export interface EditWorkflowOptions {
  message?: string;
  interactive?: boolean;
}

export interface AnalyzeWorkflowOptions {
  codebase?: boolean;
  complexity?: boolean;
  dependencies?: boolean;
  format?: 'text' | 'json' | 'markdown';
}

export interface ExplainWorkflowOptions {
  concept?: string;
  line?: number;
  function?: string;
  level?: 'beginner' | 'intermediate' | 'advanced';
}

/**
 * Creates messages for the edit workflow that will trigger smart routing
 */
export function createEditWorkflowMessages(
  files: string[], 
  options: EditWorkflowOptions
): AgentMessage[] {
  const instruction = options.message || 'Please review and improve the code';
  const fileList = files.length > 0 ? files.join(', ') : 'the specified files';
  
  // This message content is carefully crafted to trigger needsTools=true
  // in the smart router (contains 'file', 'read', 'write' keywords)
  const workflowMessage = {
    role: 'user' as const,
    content: `I need help editing these files: ${fileList}

Instructions: ${instruction}

Please:
1. Read the files to understand the current code
2. Analyze the code structure and identify areas for improvement
3. Make the requested changes following best practices
4. Write the updated files with clear explanations of changes made

Use the filesystem tools to read and write files as needed. Focus on code quality, maintainability, and following TypeScript/JavaScript best practices.

${options.interactive ? '\nThis is an interactive session - please ask questions if you need clarification about the changes.' : ''}`
  };
  
  return [workflowMessage];
}

/**
 * Creates messages for the analyze workflow
 */
export function createAnalyzeWorkflowMessages(
  target: string,
  options: AnalyzeWorkflowOptions
): AgentMessage[] {
  let analysisScope = '';
  
  if (options.codebase) {
    analysisScope = 'Please analyze the entire codebase structure and patterns.';
  } else {
    analysisScope = `Please analyze the file or directory: ${target}`;
  }
  
  let focusAreas = [];
  if (options.complexity) {
    focusAreas.push('code complexity and cyclomatic complexity');
  }
  if (options.dependencies) {
    focusAreas.push('dependencies, imports, and module relationships');
  }
  
  const focusText = focusAreas.length > 0 
    ? `Focus particularly on: ${focusAreas.join(', ')}.`
    : 'Provide a comprehensive analysis including code quality, structure, and potential improvements.';
  
  const workflowMessage = {
    role: 'user' as const,
    content: `I need a detailed code analysis.

${analysisScope}

${focusText}

Please:
1. Read and examine the files thoroughly
2. Analyze code structure, patterns, and architecture
3. Identify complexity issues and potential improvements
4. Check for code quality and maintainability concerns
5. Provide actionable recommendations

Use the filesystem tools to read files and directories as needed. Present the analysis in a clear, structured format${options.format === 'json' ? ' as JSON' : options.format === 'markdown' ? ' using markdown formatting' : ''}.`
  };
  
  return [workflowMessage];
}

/**
 * Creates messages for the explain workflow
 */
export function createExplainWorkflowMessages(
  target: string,
  options: ExplainWorkflowOptions
): AgentMessage[] {
  let explanation = '';
  
  if (options.concept) {
    explanation = `Please explain the programming concept: "${options.concept}"
    
Provide a clear explanation suitable for ${options.level || 'intermediate'} level understanding.`;
  } else {
    explanation = `Please explain the code in: ${target}
    
${options.line ? `Focus on line ${options.line}.` : ''}
${options.function ? `Focus on the function: ${options.function}.` : ''}

Explanation level: ${options.level || 'intermediate'}`;
  }
  
  const workflowMessage = {
    role: 'user' as const,
    content: `I need help understanding this code.

${explanation}

Please:
1. ${options.concept ? 'Explain the concept clearly with examples' : 'Read and examine the file'}
2. Break down complex parts into understandable components  
3. Explain the purpose and functionality
4. Provide context and practical examples
5. Suggest best practices and common patterns

${options.concept ? '' : 'Use the filesystem tools to read the file as needed.'}

Make the explanation clear, educational, and appropriate for the specified level.`
  };
  
  return [workflowMessage];
}