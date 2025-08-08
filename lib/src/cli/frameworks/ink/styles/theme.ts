/**
 * Ink CLI Theme and Styling System
 * 
 * Centralized styling configuration for the entire CLI interface
 */

export interface CLITheme {
  colors: {
    primary: string;
    secondary: string;
    accent: string;
    success: string;
    warning: string;
    error: string;
    info: string;
    dim: string;
    text: string;
    background: string;
  };
  gradients: {
    header: string[];
    provider: string[];
    model: string[];
    rainbow: string;
  };
  borders: {
    input: {
      style: 'single' | 'double' | 'round' | 'bold' | 'singleDouble' | 'doubleSingle' | 'classic';
      colorActive: string;
      colorBusy: string;
    };
  };
  spacing: {
    none: number;
    xs: number;
    sm: number;
    md: number;
    lg: number;
    xl: number;
  };
  layout: {
    headerAlignment: 'left' | 'center' | 'right';
    statusAlignment: 'left' | 'center' | 'right';
  };
}

export const defaultTheme: CLITheme = {
  colors: {
    primary: 'cyan',
    secondary: 'magenta', 
    accent: 'yellow',
    success: 'green',
    warning: 'yellow',
    error: 'red',
    info: 'blue',
    dim: 'dim',
    text: 'white',
    background: 'black',
  },
  gradients: {
    header: ['magenta', 'cyan', 'blue'],
    provider: ['magenta', 'cyan'],
    model: ['cyan', 'blue'],
    rainbow: 'rainbow',
  },
  borders: {
    input: {
      style: 'single',
      colorActive: 'green',
      colorBusy: 'yellow',
    },
  },
  spacing: {
    none: 0,
    xs: 1,
    sm: 2,
    md: 4,
    lg: 8,
    xl: 16,
  },
  layout: {
    headerAlignment: 'center',
    statusAlignment: 'left',
  },
};

export const styles = {
  header: {
    padding: defaultTheme.spacing.xs,
    justifyContent: defaultTheme.layout.headerAlignment,
  },
  content: {
    flexGrow: 1,
    flexDirection: 'column' as const,
  },
  inputContainer: {
    borderStyle: defaultTheme.borders.input.style,
    paddingX: defaultTheme.spacing.sm,
    paddingY: defaultTheme.spacing.xs,
  },
  statusLine: {
    paddingX: defaultTheme.spacing.sm,
    paddingY: defaultTheme.spacing.none, // Zero gap!
    justifyContent: 'space-between' as const,
    alignItems: 'center' as const,
  },
  statusLeft: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
  statusRight: {
    flexDirection: 'row' as const,
    alignItems: 'center' as const,
  },
} as const;

export const getInputBorderColor = (state: 'ready' | 'busy') => {
  return state === 'busy' 
    ? defaultTheme.borders.input.colorBusy
    : defaultTheme.borders.input.colorActive;
};

export const textStyles = {
  header: {
    color: defaultTheme.colors.primary,
    bold: true,
  },
  provider: {
    bold: true,
  },
  model: {
    bold: true,
  },
  mode: {
    color: defaultTheme.colors.accent,
  },
  separator: {
    color: defaultTheme.colors.dim,
  },
  processing: {
    color: defaultTheme.colors.warning,
  },
  progress: {
    color: defaultTheme.colors.info,
  },
  progressBar: {
    complete: '█',
    incomplete: '░',
    width: 40,
    showPercentage: true,
  },
} as const;

export const createProgressBar = (progress: number, width: number = textStyles.progressBar.width) => {
  const filled = Math.round(progress * width);
  const empty = width - filled;
  const bar = textStyles.progressBar.complete.repeat(filled) + textStyles.progressBar.incomplete.repeat(empty);
  const percentage = Math.round(progress * 100);
  return `[${bar}] ${percentage}%`;
};