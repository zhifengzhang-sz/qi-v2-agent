/**
 * State Widget for Neo-blessed CLI
 *
 * Shows current application state with visual indicators
 */

import blessed from 'neo-blessed';
import type { AppState, AppSubState } from '../../../abstractions/index.js';

interface StateWidgetOptions {
  parent: blessed.Widgets.Screen;
  state: AppState;
  subState?: AppSubState;
  taskName?: string;
}

const STATE_COLORS = {
  busy: 'yellow',
  ready: 'green',
} as const;

const SUB_STATE_LABELS = {
  planning: '📋 Planning',
  editing: '✏️  Editing',
  generic: '💬 Generic',
} as const;

export class StateWidget {
  private widget: blessed.Widgets.BoxElement;
  private state: AppState = 'ready';
  private subState: AppSubState = 'generic';
  private taskName?: string;

  constructor(options: StateWidgetOptions) {
    this.state = options.state;
    this.subState = options.subState || 'generic';
    this.taskName = options.taskName;

    this.widget = blessed.box({
      parent: options.parent,
      top: 0,
      right: 0,
      width: 30,
      height: 3,
      border: {
        type: 'line',
      },
      style: {
        fg: this.getStateColor(),
        border: {
          fg: this.getStateColor(),
        },
      },
      content: this.getStateDisplay(),
      tags: true,
      padding: {
        left: 1,
        right: 1,
      },
    });

    this.render();
  }

  updateState(state: AppState, subState?: AppSubState, taskName?: string): void {
    this.state = state;
    if (subState) this.subState = subState;
    this.taskName = taskName;

    // Update widget properties
    this.widget.setContent(this.getStateDisplay());
    this.widget.style.fg = this.getStateColor();
    this.widget.style.border = { fg: this.getStateColor() };

    this.render();
  }

  private getStateDisplay(): string {
    if (this.state === 'busy') {
      return this.taskName ? `⏳ Busy: ${this.taskName}` : '⏳ Busy';
    }

    if (this.state === 'ready' && this.subState) {
      const label = SUB_STATE_LABELS[this.subState];
      return `${label}\\n{dim-fg}(Shift+Tab to cycle){/dim-fg}`;
    }

    return '🟢 Ready';
  }

  private getStateColor(): string {
    return STATE_COLORS[this.state] || 'white';
  }

  private render(): void {
    this.widget.screen.render();
  }

  getWidget(): blessed.Widgets.BoxElement {
    return this.widget;
  }

  destroy(): void {
    this.widget.destroy();
  }
}
