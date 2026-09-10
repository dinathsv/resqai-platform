import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useColorScheme } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { darkTheme, lightTheme, ThemeTokens } from '../constants/theme';

// ─────────────────────────────────────────────
//  Types
// ─────────────────────────────────────────────
export type ThemeMode = 'light' | 'dark' | 'system';

type ThemeContextValue = {
  theme: ThemeTokens;
  themeMode: ThemeMode;
  setThemeMode: (mode: ThemeMode) => void;
};

const STORAGE_KEY = 'resqai_theme_mode';

// ─────────────────────────────────────────────
//  Context
// ─────────────────────────────────────────────
const ThemeContext = createContext<ThemeContextValue>({
  theme: darkTheme,
  themeMode: 'system',
  setThemeMode: () => {},
});

// ─────────────────────────────────────────────
//  Provider
// ─────────────────────────────────────────────
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  const systemScheme = useColorScheme(); // 'light' | 'dark' | null
  const [themeMode, setThemeModeState] = useState<ThemeMode>('system');
  const [loaded, setLoaded] = useState(false);

  // Load persisted preference on mount
  useEffect(() => {
    let isMounted = true;

    async function loadThemeMode() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (isMounted && (saved === 'light' || saved === 'dark' || saved === 'system')) {
          setThemeModeState(saved);
        }
      } catch {
        // Ignore storage errors and fall back to system theme.
      } finally {
        if (isMounted) {
          setLoaded(true);
        }
      }
    }

    loadThemeMode();

    return () => {
      isMounted = false;
    };
  }, []);

  const setThemeMode = useCallback((mode: ThemeMode) => {
    setThemeModeState(mode);
    AsyncStorage.setItem(STORAGE_KEY, mode).catch(() => {});
  }, []);

  // Resolve effective theme
  const effectiveDark =
    themeMode === 'dark' ||
    (themeMode === 'system' && systemScheme === 'dark');
  const theme = effectiveDark ? darkTheme : lightTheme;

  // Don't render until we've read the stored preference (avoids flash)
  if (!loaded) return null;

  return (
    <ThemeContext.Provider value={{ theme, themeMode, setThemeMode }}>
      {children}
    </ThemeContext.Provider>
  );
}

// ─────────────────────────────────────────────
//  Hook
// ─────────────────────────────────────────────
export function useTheme(): ThemeContextValue {
  return useContext(ThemeContext);
}