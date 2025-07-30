// Cognitive Framework Abstractions - Technology Agnostic
//
// Based on docs/agents/v1/agent.abstractions.md
// These interfaces contain no dependencies on specific packages or frameworks
// and can be implemented using any technology stack.

/**
 * Abstract cognitive pattern (technology-agnostic)
 */
export interface CognitivePattern {
  readonly name: string;
  readonly description: string;
  readonly purpose: string;
  readonly characteristics: readonly string[];
  readonly abstractKeywords: readonly string[];
  readonly contextWeight: number;
}

/**
 * Domain specialization mode
 */
export interface DomainMode {
  readonly abstractPattern: string;
  readonly domainName: string;
  readonly domainKeywords: readonly string[];
  readonly domainTools: readonly string[];
  readonly domainPrompts: readonly string[];
}

/**
 * Domain configuration
 */
export interface DomainConfiguration {
  readonly domain: string;
  readonly version: string;
  readonly description: string;
  readonly patterns: ReadonlyMap<string, DomainMode>;
}

/**
 * Processing context for pattern detection and input classification
 */
export interface ProcessingContext {
  readonly threadId?: string;
  readonly sessionId?: string;
  readonly currentInputType?: 'command' | 'prompt' | 'workflow';
  readonly currentPattern?: string;
  readonly userHistory?: readonly ProcessingEvent[];
  readonly environmentContext?: ReadonlyMap<string, unknown>;
}

/**
 * Pattern detection result
 */
export interface PatternDetectionResult {
  readonly pattern: CognitivePattern;
  readonly confidence: number;
  readonly detectionMethod: 'rule-based' | 'llm-based' | 'hybrid';
  readonly metadata: ReadonlyMap<string, unknown>;
}

/**
 * Abstract pattern matcher interface
 */
export interface IPatternMatcher {
  detectPattern(input: string, context?: ProcessingContext): Promise<PatternDetectionResult>;
  getAvailablePatterns(): readonly CognitivePattern[];
  updatePatternConfiguration(patterns: readonly CognitivePattern[]): void;
}

/**
 * Processing event (referenced by ProcessingContext)
 */
export interface ProcessingEvent {
  readonly eventId: string;
  readonly sessionId: string;
  readonly timestamp: Date;
  readonly type: 'input' | 'pattern_detection' | 'workflow_execution' | 'tool_execution' | 'output';
  readonly data: ReadonlyMap<string, unknown>;
}

/**
 * Abstract cognitive patterns (technology-agnostic)
 */
export const ABSTRACT_COGNITIVE_PATTERNS: readonly CognitivePattern[] = [
  {
    name: 'analytical',
    description: 'Deep analysis and structured reasoning',
    purpose: 'Break down complex problems systematically',
    characteristics: ['methodical', 'thorough', 'structured', 'evidence-based'],
    abstractKeywords: ['analyze', 'review', 'examine', 'assess', 'evaluate'],
    contextWeight: 0.8
  },
  {
    name: 'creative',
    description: 'Generation and synthesis of new content',
    purpose: 'Create, build, and synthesize new artifacts',
    characteristics: ['innovative', 'constructive', 'synthesis', 'ideation'],
    abstractKeywords: ['create', 'build', 'generate', 'design', 'develop'],
    contextWeight: 0.9
  },
  {
    name: 'informational',
    description: 'Knowledge sharing and explanation',
    purpose: 'Educate, clarify, and transfer understanding',
    characteristics: ['educational', 'clarifying', 'comprehensive', 'accessible'],
    abstractKeywords: ['explain', 'help', 'what', 'how', 'why', 'understand'],
    contextWeight: 0.6
  },
  {
    name: 'problem-solving',
    description: 'Issue identification and resolution',
    purpose: 'Diagnose problems and provide solutions',
    characteristics: ['diagnostic', 'solution-oriented', 'systematic', 'practical'],
    abstractKeywords: ['fix', 'solve', 'resolve', 'debug', 'troubleshoot'],
    contextWeight: 0.7
  },
  {
    name: 'conversational',
    description: 'General dialog and interaction',
    purpose: 'Maintain natural conversation flow',
    characteristics: ['responsive', 'contextual', 'adaptive', 'personable'],
    abstractKeywords: ['chat', 'discuss', 'talk', 'general'],
    contextWeight: 0.5
  }
] as const;