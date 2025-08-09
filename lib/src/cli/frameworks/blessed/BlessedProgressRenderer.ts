/**
 * neo-blessed Progress Renderer implementation
 * 
 * Displays progress bars and status updates using blessed progress bar widgets.
 * Supports multi-phase progress tracking with visual indicators.
 */

import * as blessed from 'neo-blessed';
import type { IProgressRenderer, ProgressConfig } from '../../abstractions/IUIComponent.js';

/**
 * neo-blessed progress renderer implementation
 * 
 * Uses blessed progress bar widget for visual progress indication.
 * Supports phase labels, percentage display, and completion messages.
 */
export class BlessedProgressRenderer implements IProgressRenderer {
  private isDestroyed = false;
  private screen: blessed.Widgets.Screen;
  private progressBox?: blessed.Widgets.Box;
  private progressBar?: any;
  private statusText?: any;
  private percentageText?: any;
  private spinnerText?: any;
  private isVisible = false;
  private currentConfig?: ProgressConfig;
  private spinnerTimer?: NodeJS.Timeout;
  private spinnerFrame = 0;
  private hideTimer?: NodeJS.Timeout;
  private tuiMode = false; // Track if TUI mode is active

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
  }
  
  /**
   * Enable TUI mode (disables regular progress widgets)
   */
  enableTUIMode(): void {
    this.tuiMode = true;
    // Destroy any existing widgets since TUI handles everything
    this.destroyProgressWidgets();
  }

  private startSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
    }
    
    // Only start spinner if visible and not destroyed
    if (!this.isVisible || this.isDestroyed) return;
    
    // Animate spinner with different Unicode characters (vtop-style)
    const spinnerFrames = ['◐', '◓', '◑', '◒', '●', '○'];
    
    this.spinnerTimer = setInterval(() => {
      if (!this.spinnerText || !this.isVisible || this.isDestroyed) {
        this.stopSpinner();
        return;
      }
      
      this.spinnerFrame = (this.spinnerFrame + 1) % spinnerFrames.length;
      this.spinnerText.setContent(`{green-fg}${spinnerFrames[this.spinnerFrame]}{/green-fg}`);
      // Only render if not destroyed and visible
      if (!this.isDestroyed && this.isVisible) {
        this.screen.render();
      }
    }, 300); // Slower animation to reduce render calls
  }
  
  private stopSpinner(): void {
    if (this.spinnerTimer) {
      clearInterval(this.spinnerTimer);
      this.spinnerTimer = undefined;
    }
    
    if (this.spinnerText) {
      this.spinnerText.setContent('{green-fg}✓{/green-fg}'); // Checkmark
    }
  }

  private createProgressWidgets(): void {
    if (this.progressBox) return;
    
    // Don't create widgets if TUI mode is active
    if (this.tuiMode) return;

    // Create impressive dashboard-style container (blessed-contrib inspired)
    this.progressBox = blessed.box({
      parent: this.screen,
      top: 'center',
      left: 'center',
      width: '70%',
      height: 7,
      border: {
        type: 'line',
        fg: 'cyan'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'cyan'
        }
      },
      label: ' 🚀 QI AGENT PROGRESS MONITOR ',
      tags: true
    });

    // Create enhanced progress bar with vtop-style characters
    this.progressBar = blessed.progressbar({
      parent: this.progressBox,
      top: 2,
      left: 2,
      right: 2,
      height: 1,
      style: {
        bar: {
          bg: 'green',
          fg: 'black'
        },
        bg: 'grey'
      },
      ch: '█', // Full block character
      filled: 0,
      keys: false,
      mouse: false
    });

    // Add progress percentage display
    this.percentageText = blessed.text({
      parent: this.progressBox,
      top: 1,
      right: 2,
      width: 8,
      height: 1,
      align: 'right',
      style: {
        fg: 'yellow',
        bg: 'black',
        bold: true
      },
      content: '0%',
      tags: true
    });

    // Create enhanced status text with phase indicator
    this.statusText = blessed.text({
      parent: this.progressBox,
      top: 3,
      left: 2,
      right: 2,
      height: 1,
      align: 'left',
      style: {
        fg: 'white',
        bg: 'black'
      },
      content: '{cyan-fg}▶{/cyan-fg} Initializing system...',
      tags: true
    });

    // Add animated spinner for active processes
    this.spinnerText = blessed.text({
      parent: this.progressBox,
      top: 1,
      left: 2,
      width: 3,
      height: 1,
      style: {
        fg: 'green',
        bg: 'black'
      },
      content: '◐',
      tags: true
    });
  }

  private destroyProgressWidgets(): void {
    // Destroy child widgets first, then parent
    if (this.spinnerText) {
      this.spinnerText.destroy();
      this.spinnerText = undefined;
    }
    
    if (this.percentageText) {
      this.percentageText.destroy();
      this.percentageText = undefined;
    }
    
    if (this.statusText) {
      this.statusText.destroy();
      this.statusText = undefined;
    }
    
    if (this.progressBar) {
      this.progressBar.destroy();
      this.progressBar = undefined;
    }
    
    // Destroy parent container last
    if (this.progressBox) {
      this.progressBox.destroy();
      this.progressBox = undefined;
    }
  }

  start(config: ProgressConfig): void {
    if (this.isDestroyed) return;
    
    this.currentConfig = config;
    this.createProgressWidgets();
    this.startSpinner();
    
    if (this.progressBox && this.statusText) {
      const title = config.title || 'QI Agent Progress';
      this.progressBox.setLabel(` 🚀 ${title} `);
      this.statusText.setContent(`{cyan-fg}▶{/cyan-fg} ${config.initialMessage || 'Initializing system...'}`);
      this.progressBox.show();
      this.isVisible = true;
      this.screen.render();
    }
  }

  updateProgress(progress: number, phase: string, message?: string): void {
    if (this.isDestroyed || !this.isVisible) return;
    
    // Clamp progress between 0 and 1
    const clampedProgress = Math.max(0, Math.min(1, progress));
    const percentage = Math.round(clampedProgress * 100);
    
    if (this.progressBar) {
      this.progressBar.setProgress(percentage);
      
      // Change color based on progress (blessed-contrib style)
      if (percentage < 33) {
        this.progressBar.style.bar = { bg: 'red', fg: 'black' };
      } else if (percentage < 66) {
        this.progressBar.style.bar = { bg: 'yellow', fg: 'black' };
      } else {
        this.progressBar.style.bar = { bg: 'green', fg: 'black' };
      }
    }
    
    if (this.percentageText) {
      this.percentageText.setContent(`{bold}${percentage}%{/bold}`);
    }
    
    if (this.statusText) {
      const phaseIcon = this.getPhaseIcon(phase);
      const statusMessage = message || `${phase}...`;
      this.statusText.setContent(`{cyan-fg}${phaseIcon}{/cyan-fg} ${statusMessage}`);
    }
    
    this.screen.render();
  }
  
  private getPhaseIcon(phase: string): string {
    const lowerPhase = phase.toLowerCase();
    if (lowerPhase.includes('init')) return '⚙️';
    if (lowerPhase.includes('connect')) return '🔗';
    if (lowerPhase.includes('process')) return '⚒️';
    if (lowerPhase.includes('analyz')) return '🔍';
    if (lowerPhase.includes('generat')) return '✨';
    if (lowerPhase.includes('complet')) return '✅';
    return '▶'; // Default arrow
  }

  complete(message?: string): void {
    if (this.isDestroyed) return;
    
    this.stopSpinner();
    this.clearHideTimer();
    
    if (this.progressBar) {
      this.progressBar.setProgress(100);
      this.progressBar.style.bar = { bg: 'green', fg: 'black' };
    }
    
    if (this.percentageText) {
      this.percentageText.setContent('{bold}{green-fg}100%{/green-fg}{/bold}');
    }
    
    if (this.statusText) {
      this.statusText.setContent(`{green-fg}✅{/green-fg} ${message || 'Operation completed successfully!'}`);
    }
    
    if (this.progressBox) {
      this.progressBox.setLabel(' 🎉 COMPLETE ');
      this.progressBox.style.border = { fg: 'green' };
    }
    
    // Show completion briefly then properly hide and destroy
    this.screen.render();
    
    this.hideTimer = setTimeout(() => {
      this.hideAndDestroy();
    }, 2000);
  }

  cancel(message?: string): void {
    if (this.isDestroyed) return;
    
    this.clearHideTimer();
    
    if (this.statusText) {
      this.statusText.setContent(message || 'Cancelled ❌');
    }
    
    if (this.progressBox) {
      this.progressBox.setLabel(' ❌ CANCELLED ');
      this.progressBox.style.border = { fg: 'red' };
    }
    
    // Show cancellation briefly then properly hide and destroy
    this.screen.render();
    
    this.hideTimer = setTimeout(() => {
      this.hideAndDestroy();
    }, 1500);
  }

  error(message: string): void {
    if (this.isDestroyed) return;
    
    this.clearHideTimer();
    
    if (this.statusText) {
      this.statusText.setContent(`Error: ${message} ❌`);
    }
    
    if (this.progressBox) {
      this.progressBox.setLabel(' ❌ ERROR ');
      this.progressBox.style.border = { fg: 'red' };
    }
    
    // Show error briefly then properly hide and destroy
    this.screen.render();
    
    this.hideTimer = setTimeout(() => {
      this.hideAndDestroy();
    }, 3000);
  }

  show(): void {
    if (this.isDestroyed) return;
    
    if (this.progressBox) {
      this.progressBox.show();
      this.isVisible = true;
      this.screen.render();
    }
  }

  hide(): void {
    if (this.isDestroyed) return;
    
    this.clearHideTimer();
    this.stopSpinner(); // Stop animation when hidden
    this.isVisible = false;
    
    if (this.progressBox) {
      this.progressBox.hide();
      this.screen.render();
    }
  }
  
  private hideAndDestroy(): void {
    if (this.isDestroyed) return;
    
    this.hide();
    this.destroyProgressWidgets();
    this.screen.render();
  }
  
  private clearHideTimer(): void {
    if (this.hideTimer) {
      clearTimeout(this.hideTimer);
      this.hideTimer = undefined;
    }
  }

  render(): void {
    if (this.isDestroyed) return;
    
    this.screen.render();
  }

  update(data: any): void {
    if (this.isDestroyed) return;
    
    // Handle generic progress updates
    if (data && typeof data === 'object') {
      const { progress, phase, message } = data;
      
      if (typeof progress === 'number' && phase) {
        this.updateProgress(progress, phase, message);
      }
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    this.clearHideTimer();
    this.stopSpinner();
    this.destroyProgressWidgets();
    this.currentConfig = undefined;
    this.isVisible = false;
    this.isDestroyed = true;
  }

  /**
   * Check if progress is currently visible
   */
  isProgressVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Get current progress configuration
   */
  getCurrentConfig(): ProgressConfig | undefined {
    return this.currentConfig;
  }

  /**
   * Hide progress and prepare for content replacement
   */
  hideAndReplace(): void {
    this.clearHideTimer();
    this.hideAndDestroy();
  }

  /**
   * Get current progress state
   */
  getCurrentState(): ProgressConfig | null {
    return this.currentConfig || null;
  }

  /**
   * Check if progress is currently showing
   */
  isShowing(): boolean {
    return this.isVisible;
  }

  /**
   * Check if component is visible (IUIComponent interface)
   */
  isVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Update component configuration (IUIComponent interface)
   */
  updateConfig(config: any): void {
    if (config && typeof config === 'object') {
      this.currentConfig = { ...this.currentConfig, ...config };
    }
  }
}