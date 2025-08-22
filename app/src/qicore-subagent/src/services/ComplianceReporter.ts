/**
 * Compliance Reporter Service
 * 
 * Generates comprehensive QiCore compliance reports from analysis results.
 * Provides markdown and JSON export formats with detailed insights.
 */

import {
  create,
  fromAsyncTryCatch,
  match,
  type QiError,
  type Result,
  success,
} from '../utils/result';
import type {
  AnalysisSession,
  ComplianceReport,
  ComplianceResult,
  IComplianceReporter,
  ModuleAnalysisSection,
  QiCoreViolation,
  ReportSummary,
  SessionSummary,
} from '../types/index';

// Error factory for reporting operations
const reporterError = {
  reportGenerationFailed: (sessionId: string, reason: string): QiError =>
    create('REPORT_GENERATION_FAILED', `Report generation failed for session ${sessionId}: ${reason}`, 'SYSTEM', { 
      sessionId, 
      reason 
    }),
  
  exportFailed: (format: string, reason: string): QiError =>
    create('EXPORT_FAILED', `Report export failed for format ${format}: ${reason}`, 'SYSTEM', { 
      format, 
      reason 
    }),
  
  invalidSession: (sessionId: string): QiError =>
    create('INVALID_SESSION', `Invalid or incomplete session: ${sessionId}`, 'VALIDATION', { sessionId }),
};

export class ComplianceReporter implements IComplianceReporter {
  
  async generateReport(session: AnalysisSession): Promise<ComplianceReport> {
    return fromAsyncTryCatch(
      async () => {
        // Validate session has results
        if (session.results.length === 0) {
          throw reporterError.invalidSession(session.sessionId);
        }

        // Generate summary statistics
        const summary = this.generateReportSummary(session.results);
        
        // Group results by module type and generate insights
        const moduleAnalysis = this.generateModuleAnalysis(session.results);
        
        // Generate recommendations based on common patterns
        const recommendations = this.generateRecommendations(session.results);
        
        // Generate next steps based on compliance levels
        const nextSteps = this.generateNextSteps(session.results);

        return {
          sessionId: session.sessionId,
          generatedAt: new Date(),
          summary,
          moduleAnalysis,
          recommendations,
          nextSteps,
        } satisfies ComplianceReport;
      },
      (error) => reporterError.reportGenerationFailed(session.sessionId, String(error))
    ).then(result => match(
      (report) => report,
      (error) => { throw error; },
      result
    ));
  }

  async exportReport(report: ComplianceReport, format: 'markdown' | 'json'): Promise<string> {
    return fromAsyncTryCatch(
      async () => {
        switch (format) {
          case 'markdown':
            return this.exportMarkdown(report);
          case 'json':
            return this.exportJson(report);
          default:
            throw reporterError.exportFailed(format, 'Unsupported format');
        }
      },
      (error) => reporterError.exportFailed(format, String(error))
    ).then(result => match(
      (exported) => exported,
      (error) => { throw error; },
      result
    ));
  }

  generateSessionSummary(session: AnalysisSession): SessionSummary {
    const overallScore = session.results.length > 0 
      ? session.results.reduce((sum, r) => sum + r.score, 0) / session.results.length
      : 0;
    
    const duration = session.endTime 
      ? session.endTime.getTime() - session.startTime.getTime()
      : Date.now() - session.startTime.getTime();
    
    return {
      sessionId: session.sessionId,
      targetPath: session.targetPath,
      totalTargets: session.totalTargets,
      overallCompliance: this.calculateOverallCompliance(session.results),
      averageScore: overallScore,
      duration,
      timestamp: session.startTime,
    };
  }

  // Private implementation methods

  private generateReportSummary(results: readonly ComplianceResult[]): ReportSummary {
    const totalModules = results.length;
    
    // Count by module type
    const modulesByType = {
      external: results.filter(r => r.moduleType === 'EXTERNAL').length,
      internal: results.filter(r => r.moduleType === 'INTERNAL').length,
    };
    
    // Count by compliance level
    const complianceDistribution = {
      compliant: results.filter(r => r.complianceLevel === 'COMPLIANT').length,
      minorViolations: results.filter(r => r.complianceLevel === 'MINOR_VIOLATIONS').length,
      majorViolations: results.filter(r => r.complianceLevel === 'MAJOR_VIOLATIONS').length,
      criticalViolations: results.filter(r => r.complianceLevel === 'CRITICAL_VIOLATIONS').length,
      notAnalyzed: results.filter(r => r.complianceLevel === 'NOT_ANALYZED').length,
    };
    
    const averageScore = totalModules > 0 
      ? results.reduce((sum, r) => sum + r.score, 0) / totalModules
      : 0;
    
    const overallCompliance = this.calculateOverallCompliance(results);
    
    return {
      totalModules,
      modulesByType,
      complianceDistribution,
      averageScore,
      overallCompliance,
    };
  }

  private generateModuleAnalysis(results: readonly ComplianceResult[]): ModuleAnalysisSection[] {
    const sections: ModuleAnalysisSection[] = [];
    
    // Analyze EXTERNAL modules
    const externalModules = results.filter(r => r.moduleType === 'EXTERNAL');
    if (externalModules.length > 0) {
      sections.push({
        moduleType: 'EXTERNAL',
        modules: externalModules,
        typeSpecificInsights: this.generateExternalInsights(externalModules),
        commonViolations: this.findCommonViolations(externalModules),
        bestPracticeExamples: this.findBestPracticeExamples(externalModules),
      });
    }
    
    // Analyze INTERNAL modules
    const internalModules = results.filter(r => r.moduleType === 'INTERNAL');
    if (internalModules.length > 0) {
      sections.push({
        moduleType: 'INTERNAL',
        modules: internalModules,
        typeSpecificInsights: this.generateInternalInsights(internalModules),
        commonViolations: this.findCommonViolations(internalModules),
        bestPracticeExamples: this.findBestPracticeExamples(internalModules),
      });
    }
    
    return sections;
  }

  private generateExternalInsights(modules: readonly ComplianceResult[]): readonly string[] {
    const insights: string[] = [];
    
    const twoLayerViolations = modules.flatMap(m => m.violations)
      .filter(v => v.type === 'ARCHITECTURE_VIOLATION').length;
    
    if (twoLayerViolations > 0) {
      insights.push(`${twoLayerViolations} modules missing two-layer architecture pattern`);
    }
    
    const compliantModules = modules.filter(m => m.complianceLevel === 'COMPLIANT').length;
    if (compliantModules > 0) {
      insights.push(`${compliantModules} modules demonstrate excellent external API design`);
    }
    
    return insights;
  }

  private generateInternalInsights(modules: readonly ComplianceResult[]): readonly string[] {
    const insights: string[] = [];
    
    const methodChainingViolations = modules.flatMap(m => m.violations)
      .filter(v => v.type === 'METHOD_CHAINING').length;
    
    if (methodChainingViolations > 0) {
      insights.push(`${methodChainingViolations} instances of method chaining instead of standalone functions`);
    }
    
    const resultUsageCount = modules.filter(m => 
      m.strengths.some(s => s.includes('Result<T>'))
    ).length;
    
    if (resultUsageCount > 0) {
      insights.push(`${resultUsageCount} modules properly use Result<T> return types`);
    }
    
    return insights;
  }

  private findCommonViolations(modules: readonly ComplianceResult[]): readonly QiCoreViolation[] {
    const allViolations = modules.flatMap(m => m.violations);
    const violationCounts = new Map<string, { violation: QiCoreViolation; count: number }>();
    
    for (const violation of allViolations) {
      const key = `${violation.type}:${violation.message}`;
      const existing = violationCounts.get(key);
      if (existing) {
        existing.count++;
      } else {
        violationCounts.set(key, { violation, count: 1 });
      }
    }
    
    // Return violations that appear in multiple modules
    return Array.from(violationCounts.values())
      .filter(({ count }) => count > 1)
      .sort((a, b) => b.count - a.count)
      .slice(0, 5) // Top 5 common violations
      .map(({ violation }) => violation);
  }

  private findBestPracticeExamples(modules: readonly ComplianceResult[]): readonly string[] {
    const examples: string[] = [];
    
    // Find modules with high scores and interesting strengths
    const exemplaryModules = modules
      .filter(m => m.score >= 90 && m.strengths.length > 0)
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    
    for (const module of exemplaryModules) {
      const fileName = module.filePath.split('/').pop() || module.filePath;
      examples.push(`${fileName}: ${module.strengths[0]} (Score: ${module.score})`);
    }
    
    return examples;
  }

  private generateRecommendations(results: readonly ComplianceResult[]): readonly string[] {
    const recommendations: string[] = [];
    
    // Analyze violation patterns
    const allViolations = results.flatMap(r => r.violations);
    const methodChainingCount = allViolations.filter(v => v.type === 'METHOD_CHAINING').length;
    const tryCatchCount = allViolations.filter(v => v.type === 'TRY_CATCH').length;
    const directAccessCount = allViolations.filter(v => v.type === 'DIRECT_ACCESS').length;
    
    if (methodChainingCount > 0) {
      recommendations.push(
        `Replace ${methodChainingCount} instances of method chaining with standalone functions ` +
        `(match(onSuccess, onError, result) instead of result.match())`
      );
    }
    
    if (tryCatchCount > 0) {
      recommendations.push(
        `Replace ${tryCatchCount} try/catch blocks with fromAsyncTryCatch for better QiCore integration`
      );
    }
    
    if (directAccessCount > 0) {
      recommendations.push(
        `Eliminate ${directAccessCount} direct .value/.error accesses using functional composition`
      );
    }
    
    // Add architectural recommendations
    const externalCount = results.filter(r => r.moduleType === 'EXTERNAL').length;
    const internalCount = results.filter(r => r.moduleType === 'INTERNAL').length;
    
    if (externalCount > 0) {
      recommendations.push(
        `Review ${externalCount} external modules for two-layer architecture compliance`
      );
    }
    
    if (internalCount > 0) {
      recommendations.push(
        `Optimize ${internalCount} internal modules for Result<T> composition patterns`
      );
    }
    
    return recommendations;
  }

  private generateNextSteps(results: readonly ComplianceResult[]): readonly string[] {
    const nextSteps: string[] = [];
    
    const criticalCount = results.filter(r => r.complianceLevel === 'CRITICAL_VIOLATIONS').length;
    const majorCount = results.filter(r => r.complianceLevel === 'MAJOR_VIOLATIONS').length;
    
    if (criticalCount > 0) {
      nextSteps.push(`🚨 PRIORITY: Fix ${criticalCount} modules with critical QiCore violations`);
    }
    
    if (majorCount > 0) {
      nextSteps.push(`⚠️  Address ${majorCount} modules with major violations for better compliance`);
    }
    
    // Add specific guidance based on results
    const avgScore = results.reduce((sum, r) => sum + r.score, 0) / results.length;
    if (avgScore < 70) {
      nextSteps.push('📚 Consider QiCore training session to improve overall patterns');
    }
    
    if (avgScore >= 90) {
      nextSteps.push('✨ Excellent compliance! Document these patterns as team standards');
    }
    
    nextSteps.push('🔄 Re-run analysis after implementing fixes to track improvements');
    
    return nextSteps;
  }

  private calculateOverallCompliance(results: readonly ComplianceResult[]) {
    if (results.length === 0) return 'NOT_ANALYZED';
    
    const criticalCount = results.filter(r => r.complianceLevel === 'CRITICAL_VIOLATIONS').length;
    const majorCount = results.filter(r => r.complianceLevel === 'MAJOR_VIOLATIONS').length;
    const minorCount = results.filter(r => r.complianceLevel === 'MINOR_VIOLATIONS').length;
    const compliantCount = results.filter(r => r.complianceLevel === 'COMPLIANT').length;
    
    if (criticalCount > 0) return 'CRITICAL_VIOLATIONS';
    if (majorCount > results.length / 2) return 'MAJOR_VIOLATIONS';
    if (minorCount > compliantCount) return 'MINOR_VIOLATIONS';
    return 'COMPLIANT';
  }

  private exportMarkdown(report: ComplianceReport): string {
    const { summary, moduleAnalysis, recommendations, nextSteps } = report;
    
    let markdown = '';
    
    // Header
    markdown += `# QiCore Compliance Analysis Report\n\n`;
    markdown += `**Generated:** ${report.generatedAt.toISOString()}\n`;
    markdown += `**Session:** ${report.sessionId}\n\n`;
    
    // Executive Summary
    markdown += `## 📊 Executive Summary\n\n`;
    markdown += `- **Total Modules:** ${summary.totalModules}\n`;
    markdown += `- **Overall Compliance:** ${summary.overallCompliance}\n`;
    markdown += `- **Average Score:** ${summary.averageScore.toFixed(1)}/100\n\n`;
    
    // Module Distribution
    markdown += `### Module Distribution\n`;
    markdown += `- **External Modules:** ${summary.modulesByType.external}\n`;
    markdown += `- **Internal Modules:** ${summary.modulesByType.internal}\n\n`;
    
    // Compliance Distribution
    markdown += `### Compliance Distribution\n`;
    markdown += `- ✅ **Compliant:** ${summary.complianceDistribution.compliant}\n`;
    markdown += `- ⚠️  **Minor Violations:** ${summary.complianceDistribution.minorViolations}\n`;
    markdown += `- 🚨 **Major Violations:** ${summary.complianceDistribution.majorViolations}\n`;
    markdown += `- 💥 **Critical Violations:** ${summary.complianceDistribution.criticalViolations}\n\n`;
    
    // Module Analysis
    for (const section of moduleAnalysis) {
      markdown += `## 📁 ${section.moduleType} Modules Analysis\n\n`;
      
      // Insights
      if (section.typeSpecificInsights.length > 0) {
        markdown += `### Key Insights\n`;
        for (const insight of section.typeSpecificInsights) {
          markdown += `- ${insight}\n`;
        }
        markdown += `\n`;
      }
      
      // Common Violations
      if (section.commonViolations.length > 0) {
        markdown += `### Common Violations\n`;
        for (const violation of section.commonViolations) {
          markdown += `- **${violation.type}** (${violation.severity}): ${violation.message}\n`;
          markdown += `  - *Suggestion:* ${violation.suggestion}\n`;
        }
        markdown += `\n`;
      }
      
      // Best Practices
      if (section.bestPracticeExamples.length > 0) {
        markdown += `### Best Practice Examples\n`;
        for (const example of section.bestPracticeExamples) {
          markdown += `- ${example}\n`;
        }
        markdown += `\n`;
      }
      
      // Module Details
      markdown += `### Module Details\n\n`;
      markdown += `| Module | Compliance | Score | Violations | Strengths |\n`;
      markdown += `|--------|-----------|--------|------------|----------|\n`;
      
      for (const module of section.modules) {
        const fileName = module.filePath.split('/').pop() || module.filePath;
        const complianceIcon = this.getComplianceIcon(module.complianceLevel);
        markdown += `| ${fileName} | ${complianceIcon} ${module.complianceLevel} | ${module.score} | ${module.violations.length} | ${module.strengths.length} |\n`;
      }
      markdown += `\n`;
    }
    
    // Recommendations
    if (recommendations.length > 0) {
      markdown += `## 💡 Recommendations\n\n`;
      for (const rec of recommendations) {
        markdown += `- ${rec}\n`;
      }
      markdown += `\n`;
    }
    
    // Next Steps
    if (nextSteps.length > 0) {
      markdown += `## 🎯 Next Steps\n\n`;
      for (const step of nextSteps) {
        markdown += `1. ${step}\n`;
      }
      markdown += `\n`;
    }
    
    markdown += `---\n*Generated by QiCore Subagent Workflow*\n`;
    
    return markdown;
  }

  private exportJson(report: ComplianceReport): string {
    return JSON.stringify(report, null, 2);
  }

  private getComplianceIcon(level: string): string {
    switch (level) {
      case 'COMPLIANT': return '✅';
      case 'MINOR_VIOLATIONS': return '⚠️';
      case 'MAJOR_VIOLATIONS': return '🚨';
      case 'CRITICAL_VIOLATIONS': return '💥';
      default: return '❓';
    }
  }
}