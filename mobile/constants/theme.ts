import { Platform } from 'react-native';

/**
 * ResQAI Mobile Theme — "Imperial Burgundy & Apple SF Pro" Design System
 *
 * Color Architecture (60 - 30 - 10 Rule):
 *   60% Base Canvas  — Imperial Velvet Burgundy (#380C19) & Elevated Wine Surfaces (#4A1222)
 *   30% Structure    — Crisp Apple Ivory/White (#FFFFFF / #FCE7ED) & Muted Rose Slate (#C4A2AC)
 *   10% Action/Life  — Forest Mint (#059669) for affirmative CTA + Velvet Burgundy (#9E2247)
 */

export const Colors = {
  // 60% — Canvas & Surfaces: Burgundy Canvas with Mirror Transparent (No Color) Boxes
  background: '#300814',       // Imperial Velvet Burgundy Canvas
  surface: 'rgba(255, 255, 255, 0.06)',          // Mirror Transparent (No Color)
  surfaceLight: 'rgba(255, 255, 255, 0.10)',     // Elevated Mirror Sheen
  surfaceSubtle: 'rgba(255, 255, 255, 0.04)',    // Subtle Mirror Inset

  // 30% — High-Legibility Pure White & Semi-Bold Hierarchy
  primary: '#FFFFFF',          // Pure clean white
  primaryLight: '#FFFFFF',
  slateMuted: '#FFFFFF',       // Clean white for secondary labels

  // 10% — Action & Emergency Anchors
  accent: '#F47294',           // Luminous Rose / Wine Glow
  accentDark: '#B82E55',
  accentLight: 'rgba(244, 114, 148, 0.25)',
  accentGlow: 'rgba(244, 114, 148, 0.45)',

  // 10% — Affirmative Action / Life CTA
  cta: '#059669',              // Forest Mint / Emerald — affirmative, reassuring
  ctaDark: '#047857',          // Dark Emerald
  ctaLight: 'rgba(5, 150, 105, 0.20)',

  // Specialized Emergency Triage Accents
  amberWarning: '#E59835',     // Amber Gold
  amberLight: 'rgba(229, 152, 53, 0.20)',
  infoBlue: '#38BDF8',         // Sky Blue
  infoLight: 'rgba(56, 189, 248, 0.20)',

  // Pure White Apple iOS Typography & Mirror Specular Borders
  textPrimary: '#FFFFFF',
  textSecondary: '#FFFFFF',
  textMuted: 'rgba(255, 255, 255, 0.85)',
  border: 'rgba(255, 255, 255, 0.28)',
  borderLight: 'rgba(255, 255, 255, 0.18)',
  borderDark: 'rgba(255, 255, 255, 0.45)',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 3, 7, 0.75)',

  // Semantic mappings
  error: '#BE234D',
  errorLight: 'rgba(190, 35, 77, 0.22)',
  success: '#059669',
  warning: '#E59835',
  info: '#38BDF8',
} as const;

/** Apple iOS SF Pro Typography across the system */
const SF_PRO_FAMILY = Platform.select({
  ios: 'System',
  web: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", system-ui, sans-serif',
  default: 'System',
}) as string;

export const Fonts = {
  regular: SF_PRO_FAMILY,
  medium: SF_PRO_FAMILY,
  semiBold: SF_PRO_FAMILY,
  bold: SF_PRO_FAMILY,
} as const;

/** Mirror Transparent (No Color) physics with specular reflection and pure white text */
export const Glass = {
  card: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.35,
    shadowRadius: 24,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(160%)',
          WebkitBackdropFilter: 'blur(22px) saturate(160%)',
          boxShadow:
            '0 8px 32px 0 rgba(0, 0, 0, 0.35), inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.45), inset 0 -1px 1px 0 rgba(255, 255, 255, 0.10)',
        } as any)
      : {}),
  },
  cardElevated: {
    backgroundColor: 'rgba(255, 255, 255, 0.09)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    borderRadius: 24,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.45,
    shadowRadius: 30,
    elevation: 8,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(26px) saturate(170%)',
          WebkitBackdropFilter: 'blur(26px) saturate(170%)',
          boxShadow:
            '0 12px 40px 0 rgba(0, 0, 0, 0.45), inset 0 2px 2px 0 rgba(255, 255, 255, 0.55), inset 0 -1px 1px 0 rgba(255, 255, 255, 0.12)',
        } as any)
      : {}),
  },
  cardUrgent: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.38)',
    borderRadius: 22,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.40,
    shadowRadius: 20,
    elevation: 5,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(22px) saturate(160%)',
          WebkitBackdropFilter: 'blur(22px) saturate(160%)',
          boxShadow:
            '0 8px 32px 0 rgba(0, 0, 0, 0.35), inset 0 1.5px 1.5px 0 rgba(255, 255, 255, 0.50), inset 0 -1px 1px 0 rgba(255, 255, 255, 0.12)',
        } as any)
      : {}),
  },
  input: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.28)',
    borderRadius: 16,
    color: '#FFFFFF',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: 'inset 0 1px 3px 0 rgba(0, 0, 0, 0.25), inset 0 1px 1px 0 rgba(255, 255, 255, 0.20)',
        } as any)
      : {}),
  },
} as const;

