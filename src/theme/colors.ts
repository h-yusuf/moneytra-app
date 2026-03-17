export const colors = {
  // Lime Green accent (primary)
  lime: {
    50: '#f7fee7',
    100: '#ecfccb',
    200: '#d9f99d',
    300: '#bef264',
    400: '#a3e635',
    500: '#84cc16',
    600: '#65a30d',
    700: '#4d7c0f',
    800: '#3f6212',
    900: '#365314',
  },
  // Dark theme colors
  dark: {
    50: '#f8fafc',
    100: '#f1f5f9',
    200: '#e2e8f0',
    300: '#cbd5e1',
    400: '#94a3b8',
    500: '#64748b',
    600: '#475569',
    700: '#334155',
    800: '#1e293b',
    900: '#0f172a',
    950: '#020617',
  },
  // Neutral grays
  neutral: {
    50: '#fafafa',
    100: '#f5f5f5',
    200: '#e5e5e5',
    300: '#d4d4d4',
    400: '#a3a3a3',
    500: '#737373',
    600: '#525252',
    700: '#404040',
    800: '#262626',
    900: '#171717',
  },
  red: {
    50: '#fef2f2',
    100: '#fee2e2',
    200: '#fecaca',
    300: '#fca5a5',
    400: '#f87171',
    500: '#ef4444',
    600: '#dc2626',
    700: '#b91c1c',
    800: '#991b1b',
    900: '#7f1d1d',
  },
  green: {
    50: '#f0fdf4',
    100: '#dcfce7',
    200: '#bbf7d0',
    300: '#86efac',
    400: '#4ade80',
    500: '#22c55e',
    600: '#16a34a',
    700: '#15803d',
    800: '#166534',
    900: '#14532d',
  },
};

// Main app theme - Dark with Lime accent
export const theme = {
  // Backgrounds
  background: {
    primary: '#0a0a0a',      // Main background (almost black)
    secondary: '#141414',    // Card background
    tertiary: '#1f1f1f',     // Elevated surfaces
    card: '#1a1a1a',         // Card surfaces
    input: '#262626',        // Input fields
  },
  // Accent colors
  accent: {
    primary: '#c8f542',      // Lime green (main accent)
    secondary: '#a3e635',    // Lighter lime
    muted: '#4d7c0f',        // Muted lime for backgrounds
  },
  // Text colors
  text: {
    primary: '#ffffff',      // White text
    secondary: '#a3a3a3',    // Gray text
    tertiary: '#737373',     // Muted text
    inverse: '#0a0a0a',      // Dark text on light backgrounds
  },
  // Status colors
  status: {
    success: '#22c55e',      // Green
    warning: '#f59e0b',      // Amber
    danger: '#ef4444',       // Red
    info: '#3b82f6',         // Blue
  },
  // Border colors
  border: {
    primary: '#262626',      // Main borders
    secondary: '#404040',    // Lighter borders
    accent: '#c8f542',       // Accent borders
  },
};

// Legacy support
export const lightTheme = {
  background: '#f5f5f5',
  surface: '#ffffff',
  text: {
    primary: '#171717',
    secondary: '#525252',
    tertiary: '#a3a3a3',
  },
  border: '#e5e5e5',
  primary: '#c8f542',
  success: colors.green[600],
  warning: '#f59e0b',
  danger: colors.red[600],
};

export const darkTheme = {
  background: '#0a0a0a',
  surface: '#1a1a1a',
  text: {
    primary: '#ffffff',
    secondary: '#a3a3a3',
    tertiary: '#737373',
  },
  border: '#262626',
  primary: '#c8f542',
  success: colors.green[500],
  warning: '#f59e0b',
  danger: colors.red[500],
};
