/**
 * neo-blessed Stream Renderer implementation
 * 
 * Displays streaming text output using blessed log widget.
 * Supports scrollable output with real-time updates and syntax highlighting.
 */

import * as blessed from 'neo-blessed';
import type { IStreamRenderer } from '../../abstractions/IStreamRenderer.js';
import { BlessedTUILayout } from './BlessedTUILayout.js';

/**
 * neo-blessed stream renderer implementation
 * 
 * Uses blessed log widget for scrollable, streaming text output.
 * Supports real-time content updates with automatic scrolling.
 */
export class BlessedStreamRenderer implements IStreamRenderer {
  private isDestroyed = false;
  private screen: blessed.Widgets.Screen;
  private streamBox?: blessed.Widgets.Box;
  private logWidget?: any;
  private isVisible = false;
  private isStreaming = false;
  private streamContent: string[] = [];
  private completeCallback?: (content: string) => void;
  private cancelledCallback?: () => void;
  private progressIndicator?: any;
  private animationFrame = 0;
  private animationTimer?: NodeJS.Timeout;
  private tuiLayout?: BlessedTUILayout;
  private useTUI: boolean = false;

  constructor(screen: blessed.Widgets.Screen) {
    this.screen = screen;
  }
  
  /**
   * Enable TUI mode for multi-panel output
   */
  enableTUIMode(tuiLayout?: BlessedTUILayout): void {
    this.useTUI = true;
    if (tuiLayout) {
      this.tuiLayout = tuiLayout;
    }
  }

  private startProgressAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
    }
    
    // Animate progress indicator (vtop-style) 
    this.animationTimer = setInterval(() => {
      if (!this.isStreaming || !this.progressIndicator || this.isDestroyed) {
        this.stopProgressAnimation();
        return;
      }
      
      this.animationFrame = (this.animationFrame + 1) % 12;
      const frames = ['█░░', '▓█░', '░▓█', '░░█', '░█▓', '█░▓'];
      const frame = frames[Math.floor(this.animationFrame / 2)];
      
      this.progressIndicator.setContent(`{green-fg}${frame}{/green-fg}`);
      // Only render if not destroyed
      if (!this.isDestroyed) {
        this.screen.render();
      }
    }, 400); // Slower animation to reduce render calls
  }
  
  private stopProgressAnimation(): void {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = undefined;
    }
    
    if (this.progressIndicator) {
      this.progressIndicator.setContent('{cyan-fg}███{/cyan-fg}');
    }
  }

  private createStreamWidgets(): void {
    if (this.streamBox) return;

    // Create impressive dashboard-style output container
    this.streamBox = blessed.box({
      parent: this.screen,
      top: 4, // Below enhanced header
      left: 0,
      right: 0,
      bottom: 8, // Above input (4 lines) and status (2 lines) with 2 line buffer
      border: {
        type: 'line',
        fg: 'blue'
      },
      style: {
        fg: 'white',
        bg: 'black',
        border: {
          fg: 'blue'
        }
      },
      label: ' 🤖 AI RESPONSE ',
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      tags: true
    });

    // Add progress indicator inside the box header
    this.progressIndicator = blessed.text({
      parent: this.streamBox,
      top: -1,
      right: 2,
      content: '{green-fg}███{/green-fg}',
      tags: true
    });

    // Create log widget for streaming content with enhanced styling
    this.logWidget = blessed.log({
      parent: this.streamBox,
      top: 0,
      left: 1,
      right: 1,
      bottom: 1,
      style: {
        fg: 'white',
        bg: 'black'
      },
      tags: true,
      scrollable: true,
      alwaysScroll: true,
      mouse: true,
      keys: true,
      vi: true // vim-style scrolling
    });
  }

  private destroyStreamWidgets(): void {
    // Destroy child widgets first
    if (this.progressIndicator) {
      this.progressIndicator.destroy();
      this.progressIndicator = undefined;
    }
    
    if (this.logWidget) {
      this.logWidget.destroy();
      this.logWidget = undefined;
    }
    
    // Destroy parent container last
    if (this.streamBox) {
      this.streamBox.destroy();
      this.streamBox = undefined;
    }
  }

  startStreaming(): void {
    if (this.isDestroyed) return;
    
    this.isStreaming = true;
    
    if (this.useTUI && this.tuiLayout) {
      // TUI mode: Use the TUI layout's main panel
      const timestamp = new Date().toLocaleTimeString();
      this.tuiLayout.setMainContent(`{grey-fg}[${timestamp}]{/grey-fg} {cyan-fg}━━━ 🎆 AI RESPONSE STREAM INITIATED 🎆 ━━━{/cyan-fg}`);
    } else {
      // Regular mode: Create own widgets
      this.createStreamWidgets();
      
      if (this.streamBox) {
        this.streamBox.setLabel(' 🤖 AI RESPONSE (Generating...) ');
        this.streamBox.style.border = { fg: 'green' };
        
        // Add animated indicators (vtop-style)
        this.animationFrame = 0;
        this.startProgressAnimation();
      }
      
      // Add streaming start message with timestamp
      if (this.logWidget) {
        const timestamp = new Date().toLocaleTimeString();
        this.logWidget.add(`{grey-fg}[${timestamp}]{/grey-fg} {cyan-fg}━━━ 🎆 AI RESPONSE STREAM INITIATED 🎆 ━━━{/cyan-fg}`);
      }
      
      this.show();
    }
  }

  addChunk(content: string): void {
    if (this.isDestroyed || !this.isStreaming) return;
    
    // Split content into lines and add each one
    const lines = content.split('\n');
    
    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      
      if (i === 0 && this.streamContent.length > 0) {
        // Append to last line if it exists
        const lastIndex = this.streamContent.length - 1;
        this.streamContent[lastIndex] += line;
      } else {
        // Add as new line
        this.streamContent.push(line);
      }
    }
    
    if (this.useTUI && this.tuiLayout) {
      // TUI mode: Add to main panel
      this.tuiLayout.addToMain(content);
    } else {
      // Regular mode: Add to log widget
      if (this.logWidget) {
        this.logWidget.add(content);
        this.screen.render();
      }
    }
  }

  complete(): void {
    if (this.isDestroyed) return;
    
    this.isStreaming = false;
    
    if (this.useTUI && this.tuiLayout) {
      // TUI mode: Add completion message to main panel
      const timestamp = new Date().toLocaleTimeString();
      const lines = this.streamContent.length;
      this.tuiLayout.addToMain('\n{cyan-fg}━━━━━━━ ✨ RESPONSE COMPLETE ✨ ━━━━━━━{/cyan-fg}');
      this.tuiLayout.addToMain(`{grey-fg}[${timestamp}] 📈 Generated ${lines} lines • ✅ Stream completed successfully{/grey-fg}`);
      
      // Add AI response summary to conversation history
      const responsePreview = this.getStreamContent().substring(0, 100) + (this.getStreamContent().length > 100 ? '...' : '');
      this.tuiLayout.addToContext(`{bold}{green-fg}[${timestamp}] AI:{/green-fg}{/bold} ${responsePreview}`);
    } else {
      // Regular mode: Use regular widgets
      this.stopProgressAnimation();
      
      if (this.streamBox) {
        this.streamBox.setLabel(' 🤖 AI RESPONSE (Complete) ');
        this.streamBox.style.border = { fg: 'cyan' };
      }
      
      if (this.logWidget) {
        const timestamp = new Date().toLocaleTimeString();
        const lines = this.streamContent.length;
        this.logWidget.add('\n{cyan-fg}━━━━━━━ ✨ RESPONSE COMPLETE ✨ ━━━━━━━{/cyan-fg}');
        this.logWidget.add(`{grey-fg}[${timestamp}] 📈 Generated ${lines} lines • ✅ Stream completed successfully{/grey-fg}`);
      }
      
      this.screen.render();
    }
    
    // Call completion callback with accumulated content
    if (this.completeCallback) {
      this.completeCallback(this.getStreamContent());
    }
  }

  cancel(): void {
    if (this.isDestroyed) return;
    
    this.isStreaming = false;
    
    if (this.useTUI && this.tuiLayout) {
      // TUI mode: Add cancellation message to main panel
      this.tuiLayout.addToMain('\n{red-fg}--- Stream Cancelled ---{/red-fg}');
    } else {
      // Regular mode: Use regular widgets
      if (this.streamBox) {
        this.streamBox.setLabel(' Output Cancelled ❌ ');
        this.streamBox.style.border = { fg: 'red' };
      }
      
      if (this.logWidget) {
        this.logWidget.add('\n{red-fg}--- Stream Cancelled ---{/red-fg}');
      }
      
      this.screen.render();
    }
    
    // Call cancelled callback
    if (this.cancelledCallback) {
      this.cancelledCallback();
    }
  }

  error(message: string): void {
    if (this.isDestroyed) return;
    
    this.isStreaming = false;
    
    if (this.useTUI && this.tuiLayout) {
      // TUI mode: Add error message to main panel
      this.tuiLayout.addToMain(`\n{red-fg}ERROR: ${message}{/red-fg}`);
    } else {
      // Regular mode: Use regular widgets
      if (this.streamBox) {
        this.streamBox.setLabel(' Output Error ❌ ');
        this.streamBox.style.border = { fg: 'red' };
      }
      
      if (this.logWidget) {
        this.logWidget.add(`\n{red-fg}ERROR: ${message}{/red-fg}`);
      }
      
      this.screen.render();
    }
  }

  clear(): void {
    if (this.isDestroyed) return;
    
    this.streamContent = [];
    
    if (this.logWidget) {
      this.logWidget.setContent('');
    }
    
    this.screen.render();
  }

  show(): void {
    if (this.isDestroyed) return;
    
    if (!this.streamBox) {
      this.createStreamWidgets();
    }
    
    if (this.streamBox) {
      this.streamBox.show();
      this.isVisible = true;
      this.screen.render();
    }
  }

  hide(): void {
    if (this.isDestroyed) return;
    
    if (this.streamBox) {
      this.streamBox.hide();
      this.isVisible = false;
      this.screen.render();
    }
  }

  render(): void {
    if (this.isDestroyed) return;
    
    this.screen.render();
  }

  update(data: any): void {
    if (this.isDestroyed) return;
    
    // Handle generic stream updates
    if (data && typeof data === 'object') {
      if (data.content) {
        this.addChunk(data.content);
      }
      
      if (data.action === 'complete') {
        this.complete();
      } else if (data.action === 'cancel') {
        this.cancel();
      } else if (data.action === 'error' && data.message) {
        this.error(data.message);
      } else if (data.action === 'clear') {
        this.clear();
      }
    }
  }

  destroy(): void {
    if (this.isDestroyed) return;
    
    this.stopProgressAnimation();
    this.destroyStreamWidgets();
    this.streamContent = [];
    this.isVisible = false;
    this.isStreaming = false;
    this.isDestroyed = true;
  }

  /**
   * Check if stream is currently visible
   */
  isStreamVisible(): boolean {
    return this.isVisible;
  }

  /**
   * Check if currently streaming
   */
  isCurrentlyStreaming(): boolean {
    return this.isStreaming;
  }

  /**
   * Check if currently streaming (interface method)
   */
  isStreaming(): boolean {
    return this.isCurrentlyStreaming();
  }

  /**
   * Get current streaming state
   */
  getStreamingState(): any {
    return {
      isStreaming: this.isStreaming,
      isVisible: this.isVisible,
      contentLength: this.streamContent.length
    };
  }

  /**
   * Set up streaming event handlers
   */
  onStreamingComplete(callback: (content: string) => void): void {
    this.completeCallback = callback;
  }

  onStreamingCancelled(callback: () => void): void {
    this.cancelledCallback = callback;
  }

  /**
   * Get all stream content as string
   */
  getStreamContent(): string {
    return this.streamContent.join('\n');
  }

  /**
   * Set scroll position
   */
  scrollTo(position: number): void {
    if (this.isDestroyed || !this.streamBox) return;
    
    this.streamBox.scrollTo(position);
    this.screen.render();
  }

  /**
   * Scroll to bottom
   */
  scrollToBottom(): void {
    if (this.isDestroyed || !this.streamBox) return;
    
    this.streamBox.setScrollPerc(100);
    this.screen.render();
  }

  /**
   * Scroll to top
   */
  scrollToTop(): void {
    if (this.isDestroyed || !this.streamBox) return;
    
    this.streamBox.setScrollPerc(0);
    this.screen.render();
  }
}