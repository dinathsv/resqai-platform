import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { translations, SupportedLanguage, LANGUAGE_OPTIONS, LanguageOption } from '../locales';
import { apiFetch } from '../config/api';

const STORAGE_KEY = 'resqai_user_language';

interface LanguageContextValue {
  language: SupportedLanguage;
  setLanguage: (lang: SupportedLanguage) => Promise<void>;
  t: (key: string, params?: Record<string, string | number>) => string;
  formatDate: (date: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatTime: (date: Date | string | number) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  options: LanguageOption[];
  isLoaded: boolean;
}

const LanguageContext = createContext<LanguageContextValue>({
  language: 'en',
  setLanguage: async () => {},
  t: (key) => key,
  formatDate: (d) => String(d),
  formatTime: (d) => String(d),
  formatNumber: (n) => String(n),
  options: LANGUAGE_OPTIONS,
  isLoaded: false,
});

/**
 * Detect device language on first launch.
 * Fallback order:
 *  1. Saved language from AsyncStorage
 *  2. Device system locale (if Sinhala or Tamil)
 *  3. Default to 'en' (English)
 */
function detectDeviceLanguage(): SupportedLanguage {
  try {
    let locale = '';
    if (Platform.OS === 'web' && typeof navigator !== 'undefined') {
      locale = navigator.language || (navigator as any).userLanguage || '';
    } else if (typeof Intl !== 'undefined' && typeof Intl.DateTimeFormat === 'function') {
      locale = Intl.DateTimeFormat().resolvedOptions().locale || '';
    }

    const clean = locale.toLowerCase();
    if (clean.startsWith('si') || clean.includes('sinhala')) return 'si';
    if (clean.startsWith('ta') || clean.includes('tamil')) return 'ta';
  } catch {
    // Ignore detection errors
  }
  return 'en';
}

function getNestedValue(obj: any, path: string): string | undefined {
  if (!obj || typeof obj !== 'object') return undefined;
  const parts = path.split('.');
  let current: any = obj;
  for (const part of parts) {
    if (current && typeof current === 'object' && part in current) {
      current = current[part];
    } else {
      return undefined;
    }
  }
  return typeof current === 'string' ? current : undefined;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<SupportedLanguage>('en');
  const [isLoaded, setIsLoaded] = useState(false);

  // Load language preference on startup
  useEffect(() => {
    let isMounted = true;

    async function loadPreference() {
      try {
        const saved = await AsyncStorage.getItem(STORAGE_KEY);
        if (saved === 'en' || saved === 'ta' || saved === 'si') {
          if (isMounted) setLanguageState(saved);
        } else {
          // First launch: detect device language
          const detected = detectDeviceLanguage();
          if (isMounted) setLanguageState(detected);
          await AsyncStorage.setItem(STORAGE_KEY, detected).catch(() => {});
        }
      } catch {
        if (isMounted) setLanguageState('en');
      } finally {
        if (isMounted) setIsLoaded(true);
      }
    }

    loadPreference();

    return () => {
      isMounted = false;
    };
  }, []);

  // Update language, persist locally, and sync to backend if authenticated
  const setLanguage = useCallback(async (newLang: SupportedLanguage) => {
    setLanguageState(newLang);

    // 1. Persist locally immediately
    try {
      await AsyncStorage.setItem(STORAGE_KEY, newLang);
    } catch (e) {
      console.warn('Failed to save language preference locally:', e);
    }

    // 2. Sync to backend if authenticated user
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        // Authenticated citizen: update backend profile
        await apiFetch('/api/auth/me', {
          method: 'PATCH',
          body: JSON.stringify({ language_pref: newLang }),
        }).catch((err) => {
          // Non-blocking: user selection still works locally and offline
          console.warn('Background sync of language_pref to server failed:', err);
        });
      }
    } catch {
      // Offline / guest mode: silent fallback
    }
  }, []);

  // Translation function with fallback, interpolation, and pluralization
  const t = useCallback(
    (key: string, params?: Record<string, string | number>): string => {
      const langDict = translations[language] || translations.en;
      const fallbackDict = translations.en;

      let rawString: string | undefined;

      // Plural lookup if count is provided
      if (params && typeof params.count === 'number') {
        const pluralSuffix = params.count === 1 ? '_one' : '_other';
        rawString =
          getNestedValue(langDict, `${key}${pluralSuffix}`) ||
          getNestedValue(fallbackDict, `${key}${pluralSuffix}`);
      }

      // Standard lookup
      if (!rawString) {
        rawString =
          getNestedValue(langDict, key) ||
          getNestedValue(fallbackDict, key) ||
          key;
      }

      // Interpolation: replace {name} or {{name}}
      if (params && rawString.includes('{')) {
        return rawString.replace(/\{\{?(\w+)\}?\}/g, (match, paramName) => {
          if (paramName in params) {
            return String(params[paramName]);
          }
          return match;
        });
      }

      return rawString;
    },
    [language]
  );

  // Locale mapper for Intl APIs
  const localeTag =
    language === 'si' ? 'si-LK' : language === 'ta' ? 'ta-LK' : 'en-LK';

  const formatDate = useCallback(
    (dateInput: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
      try {
        const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return String(dateInput);
        const defaultOptions: Intl.DateTimeFormatOptions = {
          year: 'numeric',
          month: 'short',
          day: 'numeric',
          ...options,
        };
        return new Intl.DateTimeFormat(localeTag, defaultOptions).format(d);
      } catch {
        return String(dateInput);
      }
    },
    [localeTag]
  );

  const formatTime = useCallback(
    (dateInput: Date | string | number) => {
      try {
        const d = dateInput instanceof Date ? dateInput : new Date(dateInput);
        if (isNaN(d.getTime())) return String(dateInput);
        return new Intl.DateTimeFormat(localeTag, {
          hour: '2-digit',
          minute: '2-digit',
          hour12: true,
        }).format(d);
      } catch {
        return String(dateInput);
      }
    },
    [localeTag]
  );

  const formatNumber = useCallback(
    (value: number, options?: Intl.NumberFormatOptions) => {
      try {
        return new Intl.NumberFormat(localeTag, options).format(value);
      } catch {
        return String(value);
      }
    },
    [localeTag]
  );

  return (
    <LanguageContext.Provider
      value={{
        language,
        setLanguage,
        t,
        formatDate,
        formatTime,
        formatNumber,
        options: LANGUAGE_OPTIONS,
        isLoaded,
      }}
    >
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage(): LanguageContextValue {
  return useContext(LanguageContext);
}
