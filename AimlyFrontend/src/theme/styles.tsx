/**
 * Central Theme System for AI Aimly Pro
 * Provides theme context and theme objects for styled components
 */

export interface ThemeColors {
  primary: {
    main: string;
    content: string;
  };
  secondary: {
    main: string;
    content: string;
  };
  accent: {
    main: string;
    content: string;
  };
  neutral: {
    main: string;
    content: string;
  };
  base: {
    100: string;
    200: string;
    300: string;
    400: string;
    content: string;
  };
  info: {
    main: string;
    content: string;
  };
  success: {
    main: string;
    content: string;
  };
  warning: {
    main: string;
    content: string;
  };
  error: {
    main: string;
    content: string;
  };
}

export interface EmailStatusColors {
  sent: {
    color: string;
    background: string;
    border: string;
    icon: string;
  };
  read: {
    color: string;
    background: string;
    border: string;
    icon: string;
  };
  failed: {
    color: string;
    background: string;
    border: string;
    icon: string;
  };
  draft: {
    color: string;
    background: string;
    border: string;
    icon: string;
  };
  scheduled: {
    color: string;
    background: string;
    border: string;
    icon: string;
  };
  untouched: {
    color: string;
    background: string;
    border: string;
    icon: string;
  };
}

export interface ThemeRadius {
  selector: string;
  field: string;
  box: string;
}

export interface Theme {
  name: string;
  colorScheme: 'dark' | 'light';
  colors: ThemeColors;
  radius: ThemeRadius;
  emailStatus: EmailStatusColors;
  toggleIcon: string;
}

const darkTheme: Theme = {
  name: 'onyx',
  colorScheme: 'dark',
  colors: {
    primary: {
      main: 'oklch(41.703% 0.099 251.473)', // Your perfect blue - keep as is
      content: 'oklch(88.34% 0.019 251.473)',
    },
    secondary: {
      main: 'oklch(64.092% 0.027 229.389)',
      content: 'oklch(12.818% 0.005 229.389)',
    },
    accent: {
      main: 'oklch(67.271% 0.167 35.791)',
      content: 'oklch(13.454% 0.033 35.791)',
    },
    neutral: {
      main: '#28282c',
      content: '#f4f4f5',
    },
    base: {
      100: '#09090b', // Page background — pure OLED black (outermost, darkest)
      200: '#111113', // Sections/cards — one step lighter
      300: '#1c1c1f', // Borders
      400: '#1e1e22', // Sub-items inside cards — lightest layer
      content: '#f4f4f5', // Primary text
    },
    info: {
      main: 'oklch(62.616% 0.143 240.033)',
      content: 'oklch(98% 0.02 240.033)',
    },
    success: {
      main: 'oklch(70.226% 0.094 156.596)',
      content: 'oklch(98% 0.02 156.596)',
    },
    warning: {
      main: 'oklch(77.482% 0.115 81.519)',
      content: 'oklch(98% 0.02 81.519)',
    },
    error: {
      main: 'oklch(51.61% 0.146 29.674)',
      content: 'oklch(98% 0.02 29.674)',
    },
  },
  radius: {
    selector: '1rem',
    field: '0.5rem',
    box: '0.75rem',
  },
  emailStatus: {
    sent: {
      color: '#22c55e',
      background: '#0b1a10',
      border: '#163d20',
      icon: '✅',
    },
    read: {
      color: '#60a5fa',
      background: '#0b0f1a',
      border: '#131c33',
      icon: '👁️',
    },
    failed: {
      color: '#f87171',
      background: '#1a0b0b',
      border: '#331414',
      icon: '❌',
    },
    draft: {
      color: '#fbbf24',
      background: '#1a160b',
      border: '#332b0f',
      icon: '📝',
    },
    scheduled: {
      color: '#fb923c',
      background: '#1a110b',
      border: '#331e0e',
      icon: '🕐',
    },
    untouched: {
      color: '#71717a',
      background: '#0f0f11',
      border: '#1c1c1f',
      icon: '⚪',
    },
  },
  toggleIcon: '☀️',
};


// Light Theme
const lightTheme: Theme = {
  name: 'light',
  colorScheme: 'light',
  colors: {
    primary: {
      main: 'oklch(90% 0.15 50.934)',
      content: 'oklch(12% 0.042 264.695)',
    },
    secondary: {
      main: 'oklch(80% 0.19 30)',
      content: 'oklch(100% 0 0)',
    },
    accent: {
      main: 'oklch(70.616% 0.143 240.033)',
      content: 'oklch(12% 0.042 264.695)',
    },
    neutral: {
      main: 'oklch(76.662% 0.135 153.45)',
      content: 'oklch(98.462% 0.001 247.838)',
    },
    base: {
      100: '#d8dce5', // Page background — least white (outermost canvas)
      200: '#e8ebf0', // Sections/cards — noticeably lighter
      300: '#c4c9d4', // Borders
      400: '#f5f6f8', // Sub-items inside cards — near white (innermost, lightest)
      content: 'oklch(35.519% 0.032 262.988)', // Primary text — unchanged
    },
    info: {
      main: 'oklch(72.06% 0.191 231.6)',
      content: 'oklch(0% 0 0)',
    },
    success: {
      main: 'oklch(64.8% 0.15 160)',
      content: 'oklch(0% 0 0)',
    },
    warning: {
      main: 'oklch(65% 0.18 65)', // Deep amber - strong contrast on light bg
      content: 'oklch(0% 0 0)',
    },
    error: {
      main: 'oklch(71.76% 0.221 22.18)',
      content: 'oklch(0% 0 0)',
    },
  },
  radius: {
    selector: '1rem',
    field: '0.5rem',
    box: '0.75rem',
  },
  emailStatus: {
    sent: {
      color: 'oklch(64.8% 0.15 160)',
      background: 'oklch(95% 0.05 160)',
      border: 'oklch(80% 0.12 160)',
      icon: '✅',
    },
    read: {
      color: 'oklch(72.06% 0.191 231.6)',
      background: 'oklch(95% 0.08 231.6)',
      border: 'oklch(85% 0.15 231.6)',
      icon: '👁️',
    },
    failed: {
      color: 'oklch(71.76% 0.221 22.18)',
      background: 'oklch(95% 0.08 22.18)',
      border: 'oklch(85% 0.18 22.18)',
      icon: '❌',
    },
    draft: {
      color: 'oklch(65% 0.18 65)',        // Deep amber - matches warning color
      background: 'oklch(95% 0.06 65)',
      border: 'oklch(82% 0.13 65)',
      icon: '📝',
    },
    scheduled: {
      color: 'oklch(70.616% 0.143 240.033)',
      background: 'oklch(95% 0.05 240.033)',
      border: 'oklch(85% 0.12 240.033)',
      icon: '🕐',
    },
    untouched: {
      color: 'oklch(76.662% 0.135 153.45)',
      background: 'oklch(95% 0.05 153.45)',
      border: 'oklch(88% 0.11 153.45)',
      icon: '⚪',
    },
  },
  toggleIcon: '🌙',
};

export const themes = {
  dark: darkTheme,
  light: lightTheme,
};

export type ThemeMode = keyof typeof themes;

// Theme Context and Hook
import { createContext, useContext, useState, useEffect } from 'react';
import type { ReactNode } from 'react';

interface ThemeContextValue {
  theme: Theme;
  themeMode: ThemeMode;
  toggleTheme: () => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

export const useTheme = () => {
  const context = useContext(ThemeContext);
  if (!context) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
};

interface ThemeProviderProps {
  children: ReactNode;
}

export const ThemeProvider = ({ children }: ThemeProviderProps) => {
  const [themeMode, setThemeMode] = useState<ThemeMode>(() => {
    const saved = localStorage.getItem('theme-mode');
    if (saved) {
      return saved as ThemeMode;
    }
    // Check system preference
    if (window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches) {
      return 'dark';
    }
    return 'light'; // Default fallback
  });

  const theme = themes[themeMode];

  const toggleTheme = () => {
    const newMode = themeMode === 'dark' ? 'light' : 'dark';
    setThemeMode(newMode);
    localStorage.setItem('theme-mode', newMode);
  };

  useEffect(() => {
    // Set body background
    document.body.style.backgroundColor = theme.colors.base[100];
    document.body.style.color = theme.colors.base.content;
  }, [theme]);

  return (
    <ThemeContext.Provider value={{ theme, themeMode, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};