// Basic Prompt Manager Implementation  
//
// Simple implementation for template management and model configuration retrieval
// Provider selection logic is externalized to routing engines per architecture design
// Can be enhanced with more sophisticated template systems later

import type { 
  IPromptManager,
  PromptTemplate,
  ModelConfiguration
} from '../../core/interfaces.js';

export class BasicPromptManager implements IPromptManager {
  private templates = new Map<string, PromptTemplate>();
  private modelConfigs = new Map<string, ModelConfiguration>();
  private modelsByProvider = new Map<string, ModelConfiguration[]>();

  constructor(modelConfigs: ModelConfiguration[]) {
    // Initialize available model configurations
    for (const config of modelConfigs) {
      this.modelConfigs.set(config.id, config);
      
      // Group models by provider for easier lookup
      if (!this.modelsByProvider.has(config.providerId)) {
        this.modelsByProvider.set(config.providerId, []);
      }
      this.modelsByProvider.get(config.providerId)!.push(config);
    }
    
    this.initializeBasicTemplates();
  }

  private initializeBasicTemplates(): void {
    // Basic templates - can be expanded later
    const basicTemplate: PromptTemplate = {
      id: 'basic',
      name: 'Basic Prompt',
      template: '{input}',
      parameters: ['input'],
      description: 'Simple pass-through template'
    };

    this.templates.set('basic', basicTemplate);
  }

  async loadTemplate(templateId: string): Promise<PromptTemplate> {
    const template = this.templates.get(templateId);
    if (!template) {
      throw new Error(`Template '${templateId}' not found`);
    }
    return template;
  }


  getAvailableTemplates(): readonly PromptTemplate[] {
    return Array.from(this.templates.values());
  }

  async getModelConfiguration(providerId: string, modelId: string): Promise<ModelConfiguration> {
    const config = this.modelConfigs.get(modelId);
    if (!config) {
      throw new Error(`Model configuration '${modelId}' not found`);
    }
    
    if (config.providerId !== providerId) {
      throw new Error(`Model '${modelId}' does not belong to provider '${providerId}'`);
    }
    
    return config;
  }

  async getAvailableModels(providerId?: string): Promise<readonly ModelConfiguration[]> {
    if (providerId) {
      return this.modelsByProvider.get(providerId) || [];
    }
    return Array.from(this.modelConfigs.values());
  }

}