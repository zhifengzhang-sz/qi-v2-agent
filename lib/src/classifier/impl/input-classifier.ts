// Input Classifier Implementation - Clean Interface Layer
//
// Provides simple user-friendly API while hiding qicore complexity
// Follows same pattern as prompt module's DefaultPromptHandler
// NO QiCore imports - interface layer hides all Result<T> complexity

import type {
  ClassificationConfig,
  ClassificationMethod,
  ClassificationOptions,
  ClassificationResult,
  ClassificationStats,
  ClassificationType,
  IClassificationMethod,
  IClassifier,
} from '../abstractions/index.js';

/**
 * Input Classifier Interface Layer
 *
 * Clean delegation to classification method with proper Result<T> handling.
 * Never throws exceptions - always returns Result<T> or unwrapped values.
 */
export class InputClassifier implements IClassifier {
  private method: IClassificationMethod;
  private _totalClassifications: number = 0;
  private _averageConfidence: number = 0;
  private _averageProcessingTime: number = 0;
  private _typeDistribution: Map<ClassificationType, number> = new Map();
  private _methodUsage: Map<ClassificationMethod, number> = new Map();

  constructor(method: IClassificationMethod) {
    this.method = method;
  }

  async classify(input: string, options?: ClassificationOptions): Promise<ClassificationResult> {
    const startTime = Date.now();
    
    // Interface layer delegates to internal method and receives ClassificationResult directly
    // Internal methods handle all QiCore Result<T> complexity and return unwrapped results
    const result = await this.method.classify(input, options?.context);
    
    // Update stats with the result
    this.updateStats(result, Date.now() - startTime);
    
    return result;
  }

  // Interface layer provides simple API only - no QiCore exposure

  // Interface implementation methods
  configure(config: Partial<ClassificationConfig>): void {
    // Simple implementation - in a full implementation this would configure the underlying method
    console.warn('configure() not implemented in InputClassifier');
  }

  getSupportedTypes(): readonly ClassificationType[] {
    return ['command', 'prompt', 'workflow'];
  }

  getSupportedMethods(): readonly ClassificationMethod[] {
    return [this.method.getMethodName()];
  }

  getStats(): ClassificationStats {
    return {
      totalClassifications: this._totalClassifications,
      averageConfidence: this._averageConfidence,
      averageProcessingTime: this._averageProcessingTime,
      typeDistribution: new Map(this._typeDistribution),
      methodUsage: new Map(this._methodUsage),
    };
  }

  resetStats(): void {
    this._totalClassifications = 0;
    this._averageConfidence = 0;
    this._averageProcessingTime = 0;
    this._typeDistribution.clear();
    this._methodUsage.clear();
  }

  validateConfig(config: ClassificationConfig): boolean {
    // Simple validation
    return !!(config.defaultMethod && config.confidenceThreshold >= 0 && config.confidenceThreshold <= 1);
  }

  private updateStats(result: ClassificationResult, processingTime: number): void {
    this._totalClassifications++;
    
    // Update average confidence
    const totalConfidence = this._averageConfidence * (this._totalClassifications - 1) + result.confidence;
    this._averageConfidence = totalConfidence / this._totalClassifications;
    
    // Update average processing time
    const totalTime = this._averageProcessingTime * (this._totalClassifications - 1) + processingTime;
    this._averageProcessingTime = totalTime / this._totalClassifications;
    
    // Update type distribution
    const currentCount = this._typeDistribution.get(result.type) || 0;
    this._typeDistribution.set(result.type, currentCount + 1);
    
    // Update method usage
    const currentMethodCount = this._methodUsage.get(result.method) || 0;
    this._methodUsage.set(result.method, currentMethodCount + 1);
  }
}