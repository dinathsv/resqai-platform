import { en, Translations } from './en';
import { ta } from './ta';
import { si } from './si';

export type SupportedLanguage = 'en' | 'ta' | 'si';

export interface LanguageOption {
  code: SupportedLanguage;
  label: string;
  nativeName: string;
  subtext: string;
}

export const LANGUAGE_OPTIONS: LanguageOption[] = [
  { code: 'en', label: 'English', nativeName: 'English', subtext: 'English' },
  { code: 'ta', label: 'Tamil', nativeName: 'தமிழ்', subtext: 'Tamil' },
  { code: 'si', label: 'Sinhala', nativeName: 'සිංහල', subtext: 'Sinhala' },
];

export const translations: Record<SupportedLanguage, Translations> = {
  en,
  ta,
  si,
};

export { en, ta, si, Translations };
