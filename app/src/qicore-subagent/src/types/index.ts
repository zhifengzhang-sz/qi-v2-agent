/**
 * QiCore Subagent Workflow Types
 * 
 * Type definitions for the optimal main assistant + qicore-specialist workflow
 */

import type { QiError } from '../utils/result';

// ============================================================================
// Analysis Target Types
// ============================================================================

export type ModuleType = 'EXTERNAL' | 'INTERNAL';

export interface AnalysisTarget {
  readonly filePath: string;
  readonly moduleType: ModuleType;
  readonly moduleName: string;
  readonly exists: boolean;
  readonly size?: number;
  readonly lastModified?: Date;
}

export interface FileContent {
  readonly filePath: string;
  readonly content: string;
  readonly lineCount: number;
  readonly encoding: string;
}

// ============================================================================
// Analysis Configuration
// ============================================================================

export interface AnalysisConfig {
  readonly targetPatterns: {
    readonly external: readonly string[];
    readonly internal: readonly string[];
  };
  readonly focusAreas: {
    readonly external: readonly string[];
    readonly internal: readonly string[];
  };
  readonly qicoreSpecialist: {
    readonly promptTemplate: string;
    readonly maxRetries: number;
    readonly timeoutMs: number;
  };
  readonly reporting: {
    readonly formats: readonly ('markdown' | 'json')[];
    readonly includeEvidence: boolean;
    readonly showLineNumbers: boolean;
  };
}

// ============================================================================
// Compliance Analysis Results
// ============================================================================

export type ComplianceLevel = 'COMPLIANT' | 'MINOR_VIOLATIONS' | 'MAJOR_VIOLATIONS' | 'CRITICAL_VIOLATIONS' | 'NOT_ANALYZED';

export interface QiCoreViolation {
  readonly type: 'METHOD_CHAINING' | 'TRY_CATCH' | 'DIRECT_ACCESS' | 'MISSING_RESULT' | 'MISSING_ERROR_HANDLING' | 'ARCHITECTURE_VIOLATION';
  readonly severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  readonly lineNumber?: number;
  readonly code: string;
  readonly message: string;
  readonly suggestion: string;
  readonly evidence: string;
}

export interface ComplianceResult {
  readonly filePath: string;
  readonly moduleType: ModuleType;
  readonly complianceLevel: ComplianceLevel;
  readonly score: number; // 0-100
  readonly violations: readonly QiCoreViolation[];
  readonly strengths: readonly string[];
  readonly analysisTimestamp: Date;
  readonly qicoreSpecialistUsed: boolean;
  readonly analysisTimeMs: number;
}

// ============================================================================
// Session Management
// ============================================================================

export interface AnalysisSession {
  readonly sessionId: string;
  readonly contextId: string; // From ContextManager
  readonly startTime: Date;
  endTime?: Date;
  status: 'RUNNING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  readonly targetPath: string;
  totalTargets: number;
  completedTargets: number;
  results: ComplianceResult[];
  readonly config: AnalysisConfig;
}

export interface SessionSummary {
  readonly sessionId: string;
  readonly targetPath: string;
  readonly totalTargets: number;
  readonly overallCompliance: ComplianceLevel;
  readonly averageScore: number;
  readonly duration: number; // milliseconds
  readonly timestamp: Date;
}

// ============================================================================
// Reporting Types
// ============================================================================

export interface ComplianceReport {
  readonly sessionId: string;
  readonly generatedAt: Date;
  readonly summary: ReportSummary;
  readonly moduleAnalysis: ModuleAnalysisSection[];
  readonly recommendations: readonly string[];
  readonly nextSteps: readonly string[];
}

export interface ReportSummary {
  readonly totalModules: number;
  readonly modulesByType: {
    readonly external: number;
    readonly internal: number;
  };
  readonly complianceDistribution: {
    readonly compliant: number;
    readonly minorViolations: number;
    readonly majorViolations: number;
    readonly criticalViolations: number;
    readonly notAnalyzed: number;
  };
  readonly averageScore: number;
  readonly overallCompliance: ComplianceLevel;
}

export interface ModuleAnalysisSection {
  readonly moduleType: ModuleType;
  readonly modules: readonly ComplianceResult[];
  readonly typeSpecificInsights: readonly string[];
  readonly commonViolations: readonly QiCoreViolation[];
  readonly bestPracticeExamples: readonly string[];
}

// ============================================================================
// Message Queue Types
// ============================================================================

export type AnalysisMessageType = 
  | 'QICORE_ANALYSIS_START'
  | 'QICORE_DISCOVERY_REQUEST'
  | 'QICORE_DISCOVERY_COMPLETE'
  | 'QICORE_SPECIALIST_ANALYZE'
  | 'QICORE_ANALYSIS_COMPLETE'
  | 'QICORE_GENERATE_REPORT'
  | 'QICORE_SESSION_UPDATE'
  | 'QICORE_ANALYSIS_ERROR';

export interface AnalysisMessage {
  readonly type: AnalysisMessageType;
  readonly sessionId: string;
  readonly payload: unknown;
  readonly timestamp: Date;
  readonly priority: 'low' | 'normal' | 'high' | 'critical';
}

// ============================================================================
// Service Interface Types
// ============================================================================

export interface IFileDiscoveryService {
  discoverModules(targetPath: string, config: AnalysisConfig): Promise<AnalysisTarget[]>;
  readFileContents(filePath: string): Promise<FileContent>;
  validateFileExists(filePath: string): Promise<boolean>;
  detectModuleType(filePath: string): ModuleType;
}

export interface IQiCoreSpecialistService {
  analyzeCode(content: FileContent, moduleType: ModuleType, config: AnalysisConfig): Promise<ComplianceResult>;
  formatAnalysisPrompt(content: FileContent, moduleType: ModuleType, focusAreas: readonly string[]): string;
  parseAnalysisResponse(response: string, filePath: string, moduleType: ModuleType): ComplianceResult;
}

export interface IComplianceReporter {
  generateReport(session: AnalysisSession): Promise<ComplianceReport>;
  exportReport(report: ComplianceReport, format: 'markdown' | 'json'): Promise<string>;
  generateSessionSummary(session: AnalysisSession): SessionSummary;
}

export interface IAnalysisOrchestrator {
  startAnalysis(targetPath: string, config: AnalysisConfig): Promise<string>; // returns sessionId
  getSession(sessionId: string): Promise<AnalysisSession | null>;
  getSessionSummary(sessionId: string): Promise<SessionSummary | null>;
  cancelAnalysis(sessionId: string): Promise<void>;
  listSessions(): Promise<SessionSummary[]>;
}

// ============================================================================
// Error Types
// ============================================================================

export interface AnalysisError extends QiError {
  readonly analysisContext?: {
    readonly sessionId?: string;
    readonly filePath?: string;
    readonly moduleType?: ModuleType;
    readonly phase?: 'discovery' | 'analysis' | 'reporting';
  };
}

// ============================================================================
// CLI Types
// ============================================================================

export interface AnalysisCliOptions {
  readonly target: string;
  readonly type?: ModuleType;
  readonly config?: string;
  readonly output?: string;
  readonly format?: 'markdown' | 'json';
  readonly debug?: boolean;
  readonly dryRun?: boolean;
}

export interface DemoOptions {
  readonly interactive?: boolean;
  readonly verbose?: boolean;
  readonly skipReport?: boolean;
}

// ============================================================================
// Configuration File Types
// ============================================================================

export interface AnalysisConfigFile {
  readonly analysis: {
    readonly target_patterns: {
      readonly external: string[];
      readonly internal: string[];
    };
    readonly focus_areas: {
      readonly external: string[];
      readonly internal: string[];
    };
  };
  readonly qicore_specialist: {
    readonly prompt_template: string;
    readonly max_retries: number;
    readonly timeout_ms: number;
  };
  readonly reporting: {
    readonly formats: ('markdown' | 'json')[];
    readonly include_evidence: boolean;
    readonly show_line_numbers: boolean;
  };
}