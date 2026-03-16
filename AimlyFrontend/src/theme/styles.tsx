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
      main: '#164562',              // logo navy
      content: '#e1eeea',          // logo mint — readable on navy
    },
    secondary: {
      main: '#0f3347',              // navy darkened for secondary surfaces
      content: '#e1eeea',
    },
    accent: {
      main: '#1bb596',              // logo teal
      content: '#0a1f1b',          // dark teal for text on accent
    },
    neutral: {
      main: '#1c2a30',              // navy-tinted dark neutral
      content: '#e1eeea',
    },
    base: {
      100: '#09090b',               // OLED black (unchanged — pure dark bg)
      200: '#0d1a22',               // navy-tinted dark surface
      300: '#122030',               // borders
      400: '#1a2e3a',               // sub-items inside cards
      content: '#e1eeea',          // logo mint — primary text
    },
    info: {
      main: '#1490b8',              // teal-shifted blue
      content: '#e1eeea',
    },
    success: {
      main: '#1bb596',              // logo teal doubles as success
      content: '#051a14',
    },
    warning: {
      main: 'oklch(77.482% 0.115 81.519)',  // keep amber as-is
      content: 'oklch(98% 0.02 81.519)',
    },
    error: {
      main: 'oklch(51.61% 0.146 29.674)',   // keep red as-is
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
      color: '#1bb596',
      background: '#051a14',
      border: '#0a2e22',
      icon: '✅',
    },
    read: {
      color: '#1490b8',
      background: '#061520',
      border: '#0e2535',
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
      color: '#e1eeea',
      background: '#0d1a22',
      border: '#1a2e3a',
      icon: '🕐',
    },
    untouched: {
      color: '#5a7a85',
      background: '#0d1a22',
      border: '#1a2e3a',
      icon: '⚪',
    },
  },
  toggleIcon: '☀️',
};

const lightTheme: Theme = {
  name: 'light',
  colorScheme: 'light',
  colors: {
    primary: {
      main: '#164562',              // logo navy — strong CTA color
      content: '#e1eeea',          // logo mint — text on navy buttons
    },
    secondary: {
      main: '#2a6b8a',              // navy lightened for secondary
      content: '#e1eeea',
    },
    accent: {
      main: '#1bb596',              // logo teal
      content: '#ffffff',
    },
    neutral: {
      main: '#c8dbd5',              // muted mint-grey neutral
      content: '#164562',          // navy text on neutral
    },
    base: {
      100: '#e1eeea',               // logo mint — outermost canvas bg
      200: '#edf4f1',               // cards/sections — lighter mint
      300: '#c8dbd5',               // borders — slightly deeper mint
      400: '#f5faf8',               // sub-items — near white
      content: '#164562',          // logo navy — primary text
    },
    info: {
      main: '#1490b8',
      content: '#ffffff',
    },
    success: {
      main: '#1bb596',              // logo teal
      content: '#ffffff',
    },
    warning: {
      main: 'oklch(65% 0.18 65)',
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
      color: '#0e7a5e',
      background: '#cce8e1',
      border: '#9dd3c7',
      icon: '✅',
    },
    read: {
      color: '#1490b8',
      background: '#cce5f0',
      border: '#99ccde',
      icon: '👁️',
    },
    failed: {
      color: 'oklch(71.76% 0.221 22.18)',
      background: 'oklch(95% 0.08 22.18)',
      border: 'oklch(85% 0.18 22.18)',
      icon: '❌',
    },
    draft: {
      color: 'oklch(65% 0.18 65)',
      background: 'oklch(95% 0.06 65)',
      border: 'oklch(82% 0.13 65)',
      icon: '📝',
    },
    scheduled: {
      color: '#164562',
      background: '#d4e4ee',
      border: '#a8c8db',
      icon: '🕐',
    },
    untouched: {
      color: '#4a7a70',
      background: '#d8ece7',
      border: '#b0d4cc',
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