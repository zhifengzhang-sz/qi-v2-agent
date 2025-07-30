// Model Routing Engine - Provider Selection Logic
//
// Handles intelligent routing between different model providers based on context
// Can be configured with custom routing rules and provider preferences

import type { ProcessingContext, ModelConfiguration } from '../../core/interfaces.js';

/**
 * Model routing rule for selecting appropriate providers based on context
 */
export interface ModelRoutingRule {
  readonly name: string;
  readonly condition: (context: ProcessingContext) => boolean;
  readonly preferredProviders: readonly string[]; // Provider IDs in preference order
  readonly reasoning: string;
  readonly priority: number; // Higher number = higher priority
}

/**
 * Provider availability checker
 */
export interface IProviderHealthChecker {
  isProviderAvailable(providerId: string): Promise<boolean>;
  getProviderModels(providerId: string): Promise<ModelConfiguration[]>;
}

/**
 * Model routing engine for provider selection
 */
export class ModelRoutingEngine {
  private routingRules: ModelRoutingRule[];
  private providerHealthChecker?: IProviderHealthChecker;

  constructor(
    routingRules: ModelRoutingRule[],
    providerHealthChecker?: IProviderHealthChecker
  ) {
    // Sort rules by priority (highest first)
    this.routingRules = [...routingRules].sort((a, b) => b.priority - a.priority);
    this.providerHealthChecker = providerHealthChecker;
  }

  /**
   * Select the best provider based on context and routing rules
   */
  async selectProvider(context: ProcessingContext): Promise<string> {
    // Apply routing rules in priority order
    for (const rule of this.routingRules) {
      if (rule.condition(context)) {
        // Try preferred providers in order
        for (const providerId of rule.preferredProviders) {
          if (await this.isProviderAvailable(providerId)) {
            console.log(`Selected provider ${providerId} via rule: ${rule.name} - ${rule.reasoning}`);
            return providerId;
          }
        }
      }
    }
    
    throw new Error('No available providers match the routing rules');
  }

  /**
   * Get available models from a specific provider
   */
  async getProviderModels(providerId: string): Promise<ModelConfiguration[]> {
    if (this.providerHealthChecker) {
      return await this.providerHealthChecker.getProviderModels(providerId);
    }
    return [];
  }

  private async isProviderAvailable(providerId: string): Promise<boolean> {
    if (this.providerHealthChecker) {
      return await this.providerHealthChecker.isProviderAvailable(providerId);
    }
    // Default to true if no health checker provided
    return true;
  }

  /**
   * Create default routing rules for common scenarios
   */
  static createDefaultRoutingRules(): ModelRoutingRule[] {
    return [
      {
        name: 'privacy-first',
        condition: (context) => {
          const privacy = context.environmentContext?.get('privacyMode');
          return privacy === 'high' || privacy === true;
        },
        preferredProviders: ['ollama'],
        reasoning: 'Privacy mode enabled - prefer local models only',
        priority: 100
      },
      {
        name: 'complex-reasoning',
        condition: (context) => {
          return context.currentInputType === 'workflow' || 
                 (context.environmentContext?.get('complexity') as string) === 'high';
        },
        preferredProviders: ['openrouter', 'ollama'],
        reasoning: 'Complex task requires advanced reasoning capabilities',
        priority: 80
      },
      {
        name: 'cost-optimized',
        condition: (context) => {
          const budget = context.environmentContext?.get('budgetMode');
          return budget === 'low' || budget === true;
        },
        preferredProviders: ['ollama', 'openrouter'],
        reasoning: 'Budget mode - prefer cost-effective providers',
        priority: 60
      },
      {
        name: 'general-default',
        condition: () => true, // Always matches as final fallback
        preferredProviders: ['ollama', 'openrouter'],
        reasoning: 'Default routing for general prompts',
        priority: 10
      }
    ];
  }
}