import React, { createContext, useContext, useState, useEffect } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

type Theme = 'light' | 'dark' | 'system';

interface ThemeContextType {
  theme: Theme;
  isDark: boolean;
  setTheme: (theme: Theme) => void;
  colors: {
    background: string;
    card: string;
    cardSecondary: string;
    text: string;
    textSecondary: string;
    textTertiary: string;
    border: string;
    primary: string;
    success: string;
    error: string;
  };
}

const ThemeContext = createContext<ThemeContextType | undefined>(undefined);

const lightColors = {
  background: '#ffffff',
  card: '#f5f5f5',
  cardSecondary: '#e5e5e5',
  text: '#0a0a0a',
  textSecondary: '#525252',
  textTertiary: '#737373',
  border: '#e5e5e5',
  primary: '#c8f542',
  success: '#22c55e',
  error: '#ef4444',
};

const darkColors = {
  background: '#0a0a0a',
  card: '#262626',
  cardSecondary: '#1a1a1a',
  text: '#ffffff',
  textSecondary: '#a3a3a3',
  textTertiary: '#737373',
  border: '#262626',
  primary: '#c8f542',
  success: '#22c55e',
  error: '#ef4444',
};

export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemColorScheme = useColorScheme();
  const [theme, setThemeState] = useState<Theme>('dark');
  
  // Load theme from storage on mount
  useEffect(() => {
    loadTheme();
  }, []);

  const loadTheme = async () => {
    try {
      const savedTheme = await AsyncStorage.getItem('app_theme');
      if (savedTheme && (savedTheme === 'light' || savedTheme === 'dark' || savedTheme === 'system')) {
        setThemeState(savedTheme as Theme);
      }
    } catch (error) {
      console.error('Error loading theme:', error);
    }
  };

  const setTheme = async (newTheme: Theme) => {
    try {
      await AsyncStorage.setItem('app_theme', newTheme);
      setThemeState(newTheme);
    } catch (error) {
      console.error('Error saving theme:', error);
    }
  };

  // Determine if dark mode should be active
  const isDark = theme === 'system' 
    ? systemColorScheme === 'dark' 
    : theme === 'dark';

  const colors = isDark ? darkColors : lightColors;

  return (
    <ThemeContext.Provider value={{ theme, isDark, setTheme, colors }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const context = useContext(ThemeContext);
  if (context === undefined) {
    throw new Error('useTheme must be used within a ThemeProvider');
  }
  return context;
}
