import { Platform } from 'react-native';

// ---------------------------------------------
//  ResQAI Minimal Design System
//  Inspired by Linear / Stripe / Vercel
// ---------------------------------------------

// Primary accent: a vibrant, accessible blue
export const Accent = {
  blue:       '#0A84FF',
  blueHover:  '#0070E0',
  blueSubtle: 'rgba(10, 132, 255, 0.08)',
} as const;

// Semantic status colors — used sparingly
export const Status = {
  success:       '#22C55E',
  successSubtle: 'rgba(34, 197, 94, 0.08)',
  warning:       '#F59E0B',
  warningSubtle: 'rgba(245, 158, 11, 0.08)',
  error:         '#EF4444',
  errorSubtle:   'rgba(239, 68, 68, 0.08)',
} as const;

// ---------------------------------------------
//  Theme token shape
// ---------------------------------------------
export type ThemeTokens = {
  isDark: boolean;
  // Canvas & surfaces
  background:      string;
  backgroundDeep:  string;
  surface:         string;
  surfaceElevated: string;
  surfaceSubtle:   string;
  // Text hierarchy
  textPrimary:     string;
  textSecondary:   string;
  textMuted:       string;
  // Accent
  accent:          string;
  accentHover:     string;
  accentSubtle:    string;
  // Semantic
  success:         string;
  successSubtle:   string;
  warning:         string;
  warningSubtle:   string;
  error:           string;
  errorSubtle:     string;
  // Borders
  border:          string;
  borderSubtle:    string;
  // Navigation
  navBar:          string;
  navBarBorder:    string;
  // Inputs
  inputBg:         string;
  inputBorder:     string;
  // Overlay
  overlay:         string;
  // Legacy compat aliases
  brand:           string;
  brandActive:     string;
  emergency:       string;
  emergencySevere: string;
  emergencyLight:  string;
  white:           string;
  silver:          string;
  accentLight:     string;
  accentDark:      string;
  primary:         string;
  textSecondaryOld:string;
  successLight:    string;
  warningLight:    string;
};

// ---------------------------------------------
//  LIGHT THEME
// ---------------------------------------------
export const lightTheme: ThemeTokens = {
  isDark: false,
  background:      '#FAFAFA',
  backgroundDeep:  '#F4F4F5',
  surface:         '#FFFFFF',
  surfaceElevated: '#F4F4F5',
  surfaceSubtle:   '#FAFAFA',
  textPrimary:     '#09090B',
  textSecondary:   '#71717A',
  textMuted:       '#A1A1AA',
  accent:          Accent.blue,
  accentHover:     Accent.blueHover,
  accentSubtle:    Accent.blueSubtle,
  success:         Status.success,
  successSubtle:   Status.successSubtle,
  warning:         Status.warning,
  warningSubtle:   Status.warningSubtle,
  error:           Status.error,
  errorSubtle:     Status.errorSubtle,
  border:          '#E4E4E7',
  borderSubtle:    '#F4F4F5',
  navBar:          '#FFFFFF',
  navBarBorder:    '#E4E4E7',
  inputBg:         '#FFFFFF',
  inputBorder:     '#E4E4E7',
  overlay:         'rgba(9, 9, 11, 0.50)',
  // Legacy aliases
  brand:           Accent.blue,
  brandActive:     Accent.blue,
  emergency:       Status.error,
  emergencySevere: '#DC2626',
  emergencyLight:  Status.errorSubtle,
  white:           '#FFFFFF',
  silver:          '#A1A1AA',
  accentLight:     Accent.blueSubtle,
  accentDark:      Accent.blueHover,
  primary:         '#09090B',
  textSecondaryOld:'#71717A',
  successLight:    Status.successSubtle,
  warningLight:    Status.warningSubtle,
};

// ---------------------------------------------
//  DARK THEME
// ---------------------------------------------
export const darkTheme: ThemeTokens = {
  isDark: true,
  background:      '#0F0F10',
  backgroundDeep:  '#09090A',
  surface:         '#18181B',
  surfaceElevated: '#212124',
  surfaceSubtle:   '#141415',
  textPrimary:     '#FAFAFA',
  textSecondary:   '#A1A1AA',
  textMuted:       '#52525B',
  accent:          Accent.blue,
  accentHover:     '#3B9EFF',
  accentSubtle:    'rgba(10, 132, 255, 0.12)',
  success:         Status.success,
  successSubtle:   'rgba(34, 197, 94, 0.12)',
  warning:         Status.warning,
  warningSubtle:   'rgba(245, 158, 11, 0.12)',
  error:           Status.error,
  errorSubtle:     'rgba(239, 68, 68, 0.12)',
  border:          '#27272A',
  borderSubtle:    '#1E1E21',
  navBar:          '#18181B',
  navBarBorder:    '#27272A',
  inputBg:         '#18181B',
  inputBorder:     '#27272A',
  overlay:         'rgba(0, 0, 0, 0.65)',
  // Legacy aliases
  brand:           Accent.blue,
  brandActive:     Accent.blue,
  emergency:       Status.error,
  emergencySevere: '#DC2626',
  emergencyLight:  'rgba(239, 68, 68, 0.12)',
  white:           '#FFFFFF',
  silver:          '#A1A1AA',
  accentLight:     'rgba(10, 132, 255, 0.12)',
  accentDark:      Accent.blueHover,
  primary:         '#FAFAFA',
  textSecondaryOld:'#A1A1AA',
  successLight:    'rgba(34, 197, 94, 0.12)',
  warningLight:    'rgba(245, 158, 11, 0.12)',
};

// ---------------------------------------------
//  Backward-compat Colors export (dark theme defaults)
// ---------------------------------------------
export const Colors = {
  background:      darkTheme.background,
  surface:         darkTheme.surface,
  surfaceLight:    darkTheme.surfaceSubtle,
  surfaceSubtle:   darkTheme.surfaceSubtle,
  surfaceElevated: darkTheme.surfaceElevated,
  primary:         darkTheme.textPrimary,
  primaryLight:    darkTheme.textSecondary,
  slateMuted:      darkTheme.textMuted,
  brandRed:        Status.error,
  brandRedDark:    '#DC2626',
  brandRedLight:   Status.errorSubtle,
  brandRedGlow:    'rgba(239, 68, 68, 0.25)',
  accent:          Accent.blue,
  accentDark:      Accent.blueHover,
  accentLight:     darkTheme.accentSubtle,
  accentGlow:      'rgba(10, 132, 255, 0.30)',
  navy:            '#18181B',
  navyDark:        '#0F0F10',
  navyLight:       '#212124',
  navyBubble:      '#18181B',
  cta:             Accent.blue,
  ctaDark:         Accent.blueHover,
  ctaLight:        Accent.blueSubtle,
  amberWarning:    Status.warning,
  amberLight:      Status.warningSubtle,
  infoBlue:        Accent.blue,
  infoLight:       Accent.blueSubtle,
  textPrimary:     darkTheme.textPrimary,
  textSecondary:   darkTheme.textSecondary,
  textMuted:       darkTheme.textMuted,
  border:          darkTheme.border,
  borderLight:     darkTheme.borderSubtle,
  borderDark:      '#3F3F46',
  white:           '#FFFFFF',
  black:           '#000000',
  overlay:         darkTheme.overlay,
  error:           Status.error,
  errorLight:      Status.errorSubtle,
  success:         Status.success,
  successLight:    Status.successSubtle,
  warning:         Status.warning,
  warningLight:    Status.warningSubtle,
  info:            Accent.blue,
} as const;

// ---------------------------------------------
//  Typography
// ---------------------------------------------
const SYSTEM_FONT = Platform.select({
  ios:     'System',
  web:     'Inter, -apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif',
  default: 'System',
}) as string;

export const Fonts = {
  regular:  SYSTEM_FONT,
  medium:   SYSTEM_FONT,
  semiBold: SYSTEM_FONT,
  bold:     SYSTEM_FONT,
} as const;

// ---------------------------------------------
//  Minimal card styles (replaces old glassmorphism)
// ---------------------------------------------
export function makeCardStyles(theme: ThemeTokens) {
  return {
    card: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
    },
    cardElevated: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 12,
      ...(Platform.OS === 'web' ? ({
        boxShadow: '0 1px 2px rgba(0, 0, 0, 0.05)',
      } as any) : {
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      }),
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1,
      borderColor: theme.inputBorder,
      borderRadius: 8,
      color: theme.textPrimary,
    },
  };
}

// Backward compat: makeGlass alias
export const makeGlass = makeCardStyles;

// Static Glass (dark theme) for backward compat
export const Glass = makeCardStyles(darkTheme);
