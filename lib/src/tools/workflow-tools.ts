import { tool } from '@langchain/core/tools';
import { z } from 'zod';
import type { MCPManager } from '../mcp/manager.js';
import type { OllamaLLM } from '../llm/ollama.js';

export interface WorkflowToolsConfig {
  mcpManager: MCPManager;
  llm: OllamaLLM;
  threadId?: string;
}


/**
 * Creates workflow tools that can be used by LangChain agents
 * These tools directly execute operations using MCP manager and LLM
 * without creating recursive calls to the agent factory
 */
export function createWorkflowTools(config: WorkflowToolsConfig) {
  const { mcpManager, llm, threadId } = config;

  const editFilesTool = tool(
    async ({ files, instruction }) => {
      try {
        console.log(`🔧 Creating/editing file: ${files[0]} with instruction: ${instruction}`);
        
        // 1. Generate code using LLM directly (no recursive calls)
        const messages = [{
          role: 'user' as const,
          content: `Generate ${instruction} for file ${files[0]}. 
                   Provide complete, working code without explanations or markdown formatting.
                   Just return the raw code that should be written to the file.`
        }];
        
        const codeResponse = await llm.invoke(messages);
        const code = codeResponse.content;
        
        if (!code || typeof code !== 'string') {
          throw new Error('LLM failed to generate code content');
        }
        
        console.log(`📝 Generated ${code.length} characters of code`);
        
        // 2. Write file using MCP directly (no agent factory)
        const result = await mcpManager.executeTool('write_file', {
          path: files[0],
          content: code
        });
        
        // 3. Handle MCP operation result
        if (result && typeof result === 'object' && 'error' in result) {
          throw new Error(`File operation failed: ${result.error}`);
        }
        
        console.log(`✅ Successfully created/edited ${files[0]}`);
        return `✅ Successfully created ${files[0]} with ${instruction}`;
        
      } catch (error) {
        const errorMsg = `❌ Failed to create/edit ${files[0]}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        return errorMsg;
      }
    },
    {
      name: "edit_files",
      description: `Create, edit, modify, or update code files with AI-generated content.

WHEN TO USE:
- User wants to create new files with specific content
- User wants to modify existing files
- User wants to write code to files
- User says: "write to file X", "create file Y", "save code to Z"

EXAMPLES:
- "write to file foo.py a quicksort function" → files: ["foo.py"], instruction: "a quicksort function in Python"
- "create file utils.js with helper functions" → files: ["utils.js"], instruction: "helper functions in JavaScript"
- "write to file test.html a simple webpage" → files: ["test.html"], instruction: "a simple HTML webpage"`,
      schema: z.object({
        files: z.array(z.string()).describe("Array of file paths to create/edit"),
        instruction: z.string().describe("What content to generate or how to modify the files")
      })
    }
  );

  const analyzeCodeTool = tool(
    async ({ target, options = {} }) => {
      try {
        console.log(`🔍 Analyzing: ${target}`);
        if (options.complexity) console.log('📊 Complexity analysis enabled');
        if (options.dependencies) console.log('📦 Dependency analysis enabled');
        
        // 1. Read file/directory using MCP directly
        let content = '';
        try {
          const readResult = await mcpManager.executeTool('read_file', { path: target });
          content = typeof readResult === 'string' ? readResult : 
                   (readResult && typeof readResult === 'object' && 'content' in readResult) ? 
                   String(readResult.content) : String(readResult);
        } catch (readError) {
          // If single file fails, try directory listing
          try {
            const listResult = await mcpManager.executeTool('list_directory', { path: target });
            content = `Directory listing: ${JSON.stringify(listResult, null, 2)}`;
          } catch (listError) {
            throw new Error(`Failed to read file or list directory: ${readError instanceof Error ? readError.message : String(readError)}`);
          }
        }
        
        // 2. Analyze using LLM directly
        let analysisPrompt = `Analyze this code/directory: ${target}\n\nContent:\n${content}\n\n`;
        
        if (options.complexity) {
          analysisPrompt += "Focus on code complexity, cyclomatic complexity, and maintainability.\n";
        }
        if (options.dependencies) {
          analysisPrompt += "Focus on dependencies, imports, and module relationships.\n";
        }
        
        analysisPrompt += "Provide detailed analysis with actionable recommendations.";
        
        const analysisResponse = await llm.invoke([{
          role: 'user',
          content: analysisPrompt
        }]);
        
        if (!analysisResponse.content || typeof analysisResponse.content !== 'string') {
          throw new Error('LLM failed to generate analysis');
        }
        
        console.log(`✅ Analysis completed for: ${target}`);
        return `📊 Code Analysis for ${target}:\n\n${analysisResponse.content}`;
        
      } catch (error) {
        const errorMsg = `❌ Analysis failed for ${target}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        return errorMsg;
      }
    },
    {
      name: "analyze_code",
      description: `Analyze code complexity, structure, dependencies, and quality.

WHEN TO USE:
- User wants to check code complexity or quality
- User wants to analyze file or directory structure
- User wants to review dependencies and imports  
- User wants insights about codebase
- User says: "analyze my code", "check complexity", "review dependencies"

EXAMPLES:
- "Analyze the complexity of utils.js" → target: "utils.js", options: {complexity: true}
- "Check dependencies in src/" → target: "src/", options: {dependencies: true}`,
      schema: z.object({
        target: z.string().describe("File, directory, or code pattern to analyze"),
        options: z.object({
          complexity: z.boolean().optional().describe("Focus on complexity analysis"),
          dependencies: z.boolean().optional().describe("Analyze dependencies and imports"),
          format: z.string().optional().describe("Output format: text, json, or markdown")
        }).optional().describe("Analysis options")
      })
    }
  );

  const explainConceptTool = tool(
    async ({ target, options = {} }) => {
      try {
        console.log(`📚 Explaining: ${target}`);
        if (options.concept) console.log(`💡 Explaining concept: ${options.concept}`);
        if (options.level) console.log(`🎯 Level: ${options.level}`);
        
        let explanationPrompt = '';
        
        if (options.concept) {
          // Explaining a programming concept
          explanationPrompt = `Explain the programming concept: "${options.concept}"
          
Provide a clear explanation suitable for ${options.level || 'intermediate'} level understanding.
Include examples, use cases, and best practices.`;
        } else {
          // Explaining code in a file
          try {
            const readResult = await mcpManager.executeTool('read_file', { path: target });
            const content = typeof readResult === 'string' ? readResult : 
                           (readResult && typeof readResult === 'object' && 'content' in readResult) ? 
                           String(readResult.content) : String(readResult);
            
            explanationPrompt = `Explain this code from ${target}:

${content}

Explanation level: ${options.level || 'intermediate'}

Please:
1. Break down complex parts into understandable components
2. Explain the purpose and functionality  
3. Provide context and practical examples
4. Suggest best practices and common patterns
5. Make it clear and educational`;
          } catch (readError) {
            // If file reading fails, treat as concept explanation
            explanationPrompt = `Explain the programming concept or topic: "${target}"
            
Provide a clear explanation suitable for ${options.level || 'intermediate'} level understanding.
Include examples, use cases, and best practices.`;
          }
        }
        
        const explanationResponse = await llm.invoke([{
          role: 'user',
          content: explanationPrompt
        }]);
        
        if (!explanationResponse.content || typeof explanationResponse.content !== 'string') {
          throw new Error('LLM failed to generate explanation');
        }
        
        console.log(`✅ Explanation completed for: ${target}`);
        return `📚 Explanation for ${target}:\n\n${explanationResponse.content}`;
        
      } catch (error) {
        const errorMsg = `❌ Explanation failed for ${target}: ${error instanceof Error ? error.message : String(error)}`;
        console.error(errorMsg);
        return errorMsg;
      }
    },
    {
      name: "explain_concept",
      description: `Explain code concepts, functions, or programming topics.

WHEN TO USE:
- User wants to understand specific code or functions
- User wants to learn programming concepts  
- User wants explanations of complex logic
- User needs educational assistance
- User says: "explain this function", "how does async work", "what is this code doing"

EXAMPLES:
- "Explain how async/await works" → target: "async/await", options: {concept: "async/await", level: "intermediate"}
- "Explain this function in utils.js" → target: "utils.js", options: {level: "beginner"}`,
      schema: z.object({
        target: z.string().describe("File path, function, or concept to explain"),
        options: z.object({
          concept: z.string().optional().describe("Specific programming concept to explain"),
          level: z.string().optional().describe("Explanation level: beginner, intermediate, or advanced")
        }).optional().describe("Explanation options")
      })
    }
  );

  return [editFilesTool, analyzeCodeTool, explainConceptTool];
}