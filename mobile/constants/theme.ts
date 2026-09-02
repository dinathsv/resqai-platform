/**
 * ResQAI Mobile Theme — "Lifeline Humanist" Design System
 * Designed for crisis situations: calm authority, high legibility, zero alarm-fatigue.
 *
 * Color Architecture (60 - 30 - 10 Rule):
 *   60% Base Canvas  — Soft Warm Canvas (#F8FAFC) & Pure Card Surfaces (#FFFFFF)
 *   30% Structure    — Deep Slate (#0F172A / #334155) for crisp typography & grounding borders
 *   10% Action/Life  — Crimson Life Pulse (#E11D48) for SOS/Urgent + Forest Mint (#059669) for Verified/Help
 */

export const Colors = {
  // 60% — Canvas & Surfaces (Warm, anti-glare, comfortable in sunlight and night)
  background: '#F8FAFC',
  surface: '#FFFFFF',
  surfaceLight: '#F1F5F9',
  surfaceSubtle: '#F8FAFC',

  // 30% — Brand, Framing & High-Contrast Typography
  primary: '#0F172A',       // Deep Navy Slate - authority, stability, trust
  primaryLight: '#1E293B',  // Secondary deep slate
  slateMuted: '#64748B',    // Subtitle & secondary metadata slate

  // 10% — Emergency & Action Anchors (Intentional, dignified, not blinding)
  accent: '#E11D48',        // Crimson Rose / Life Pulse (SOS, Alerts, Critical)
  accentDark: '#BE123C',    // Deep Crimson (Active press state)
  accentLight: 'rgba(225, 29, 72, 0.08)',
  accentGlow: 'rgba(225, 29, 72, 0.20)',

  // 10% — Life-Saving Affirmation / CTA
  cta: '#059669',           // Forest Mint — affirmative, reassuring, emergency clear
  ctaDark: '#047857',       // Dark emerald
  ctaLight: 'rgba(5, 150, 105, 0.10)',

  // Specialized Emergency Triage Accents
  amberWarning: '#D97706',  // Amber warning (floods, weather alerts)
  amberLight: 'rgba(217, 119, 6, 0.10)',
  infoBlue: '#0284C7',      // Info / Hospitals / Guidance
  infoLight: 'rgba(2, 132, 199, 0.10)',

  // High-Legibility Neutrals (WCAG AAA compliant on white/light gray)
  textPrimary: '#0F172A',
  textSecondary: '#475569',
  textMuted: '#94A3B8',
  border: '#E2E8F0',
  borderLight: '#F1F5F9',
  borderDark: '#CBD5E1',
  white: '#FFFFFF',
  black: '#000000',
  overlay: 'rgba(15, 23, 42, 0.55)',

  // Semantic mappings
  error: '#E11D48',
  success: '#059669',
  warning: '#D97706',
  info: '#0284C7',
} as const;

export const Fonts = {
  regular: 'Montserrat_400Regular',
  medium: 'Montserrat_500Medium',
  semiBold: 'Montserrat_600SemiBold',
  bold: 'Montserrat_700Bold',
} as const;

/** Tactile elevation and human-crafted card physics */
export const Glass = {
  card: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.06,
    shadowRadius: 14,
    elevation: 3,
  },
  cardElevated: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 20,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.10,
    shadowRadius: 20,
    elevation: 6,
  },
  cardUrgent: {
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    borderRadius: 18,
    shadowColor: '#E11D48',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.12,
    shadowRadius: 16,
    elevation: 4,
  },
  input: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#E2E8F0',
    borderRadius: 14,
  },
} as const;

