/**
 * ResQAI Mobile Theme
 *
 * Color distribution:
 *   60% #F5F5F5  — backgrounds, base surfaces
 *   30% #EB0000  — accent (headers, banners, active states, borders, progress)
 *   10% #00C947  — important action buttons (primary CTAs)
 *
 * Font: Montserrat (all weights loaded via @expo-google-fonts/montserrat)
 * Style: Glassmorphism on cards & page sections
 */

export const Colors = {
  // 60 % — base / background
  background: '#F5F5F5',
  surface: '#FFFFFF',
  surfaceLight: '#FAFAFA',

  // 30 % — accent / brand
  accent: '#EB0000',
  accentDark: '#C40000',
  accentLight: 'rgba(235, 0, 0, 0.08)',

  // 10 % — important CTA
  cta: '#00C947',
  ctaDark: '#00A33A',

  // Neutrals
  textPrimary: '#1A1A1A',
  textSecondary: '#666666',
  textMuted: '#999999',
  border: '#E0E0E0',
  borderLight: '#EEEEEE',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(0,0,0,0.35)',

  // Semantic
  error: '#EB0000',
  success: '#00C947',
  warning: '#FF9500',
} as const;

export const Fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semiBold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
} as const;

/** Reusable glassmorphism card style (React Native compatible) */
export const Glass = {
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.72)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.45)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.08,
    shadowRadius: 16,
    elevation: 6,
  },
  cardDark: {
    backgroundColor: 'rgba(26, 26, 26, 0.65)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    borderRadius: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 16,
    elevation: 6,
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: 12,
  },
} as const;
