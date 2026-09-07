import { Platform } from 'react-native';

/**
 * ResQAI Mobile Theme — Modern Clean Disaster Relief & AI Assistant Design System
 * Matches reference screenshots:
 *   - Clean Light Canvas (#F8FAFC / #FFFFFF)
 *   - Vibrant Emergency Brand Red (#DC2626 / #EF4444)
 *   - Midnight Navy (#160B3F / #0F172A) for AI Assistant & User bubbles
 *   - Crisp typography with high legibility
 */

export const Colors = {
  // Canvas & Surfaces
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceLight: '#F1F5F9',
  surfaceSubtle: '#F8FAFC',
  surfaceElevated: '#FFFFFF',

  // Primary & Text
  primary: '#0F172A',
  primaryLight: '#1E293B',
  slateMuted: '#64748B',

  // Brand Emergency Red
  brandRed: '#DC2626',
  brandRedDark: '#B91C1C',
  brandRedLight: '#FEE2E2',
  brandRedGlow: 'rgba(220, 38, 38, 0.25)',

  // Accent mapping (mapped to brand red for key highlights)
  accent: '#DC2626',
  accentDark: '#B91C1C',
  accentLight: 'rgba(220, 38, 38, 0.12)',
  accentGlow: 'rgba(220, 38, 38, 0.25)',

  // Midnight Navy (used in AI First-Aid header and user chat bubble)
  navy: '#160B3F',
  navyDark: '#0E0628',
  navyLight: '#241458',
  navyBubble: '#1B0F48',

  // CTA & Actions
  cta: '#DC2626',
  ctaDark: '#B91C1C',
  ctaLight: 'rgba(220, 38, 38, 0.12)',

  // Specialized Accents & Statuses
  amberWarning: '#E59835',
  amberLight: 'rgba(229, 152, 53, 0.18)',
  infoBlue: '#2563EB',
  infoLight: 'rgba(37, 99, 235, 0.15)',

  // High-legibility typography
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderDark: '#CBD5E1',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.65)',

  // Semantic
  error: '#DC2626',
  errorLight: '#FEE2E2',
  success: '#16A34A',
  successLight: '#DCFCE7',
  warning: '#F59E0B',
  warningLight: '#FEF3C7',
  info: '#2563EB',
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

/** Clean white cards with refined drop shadows & borders */
export const Glass = {
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    borderRadius: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 18px rgba(15, 23, 42, 0.06), 0 1px 3px rgba(15, 23, 42, 0.04)',
        } as any)
      : {}),
  },
  cardElevated: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 22,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 8px 24px rgba(15, 23, 42, 0.08), 0 2px 6px rgba(15, 23, 42, 0.04)',
        } as any)
      : {}),
  },
  cardUrgent: {
    backgroundColor: '#DC2626',
    borderWidth: 0,
    borderRadius: 22,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.25,
    shadowRadius: 18,
    elevation: 5,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #DC2626 0%, #EF4444 100%)',
          boxShadow: '0 8px 24px rgba(220, 38, 38, 0.28)',
        } as any)
      : {}),
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 24,
    color: '#0F172A',
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.04)',
        } as any)
      : {}),
  },
} as const;
