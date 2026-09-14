import { Platform } from 'react-native';

// ---------------------------------------------
//  ResQAI Brand Palette (immutable constants)
// ---------------------------------------------
export const Brand = {
  darkGreen:      '#164F43',
  emeraldGreen:   '#26745F',
  crimsonRed:     '#B51F2A',
  brightRed:      '#D52D35',
  silver:         '#C7C9C9',
  darkGray:       '#34383A',
  white:          '#FFFFFF',
} as const;

// ---------------------------------------------
//  Theme token shape
// ---------------------------------------------
export type ThemeTokens = {
  isDark: boolean;
  background:      string;
  backgroundDeep:  string;
  surface:         string;
  surfaceElevated: string;
  surfaceSubtle:   string;
  textPrimary:     string;
  textSecondary:   string;
  textMuted:       string;
  brand:           string;
  brandActive:     string;
  emergency:       string;
  emergencySevere: string;
  emergencyLight:  string;
  border:          string;
  borderSubtle:    string;
  navBar:          string;
  navBarBorder:    string;
  inputBg:         string;
  inputBorder:     string;
  overlay:         string;
  white:           string;
  silver:          string;
  success:         string;
  successLight:    string;
  warning:         string;
  warningLight:    string;
  accent:          string;
  accentLight:     string;
  accentDark:      string;
  primary:         string;
  textSecondaryOld:string;
};

// ---------------------------------------------
//  DARK THEME
// ---------------------------------------------
export const darkTheme: ThemeTokens = {
  isDark: true,
  background:      '#164F43', // Requested green color
  backgroundDeep:  '#0E3530',
  surface:         'rgba(38, 116, 95, 0.8)', // Lighter green for cards
  surfaceElevated: 'rgba(38, 116, 95, 0.95)',
  surfaceSubtle:   'rgba(255, 255, 255, 0.1)',
  textPrimary:     '#FFFFFF',
  textSecondary:   '#C7C9C9',
  textMuted:       'rgba(199, 201, 201, 0.65)',
  brand:           '#164F43',
  brandActive:     '#26745F',
  emergency:       '#D52D35',
  emergencySevere: '#B51F2A',
  emergencyLight:  'rgba(213, 45, 53, 0.18)',
  border:          'rgba(38, 116, 95, 0.40)',
  borderSubtle:    'rgba(255, 255, 255, 0.10)',
  navBar:          'rgba(26, 38, 36, 0.97)',
  navBarBorder:    'rgba(38, 116, 95, 0.35)',
  inputBg:         'rgba(22, 79, 67, 0.30)',
  inputBorder:     'rgba(38, 116, 95, 0.50)',
  overlay:         'rgba(0, 0, 0, 0.65)',
  white:           '#FFFFFF',
  silver:          '#C7C9C9',
  success:         '#26745F',
  successLight:    'rgba(38, 116, 95, 0.20)',
  warning:         '#E59835',
  warningLight:    'rgba(229, 152, 53, 0.18)',
  accent:          '#26745F',
  accentLight:     'rgba(38, 116, 95, 0.20)',
  accentDark:      '#164F43',
  primary:         '#FFFFFF',
  textSecondaryOld:'#C7C9C9',
};

// ---------------------------------------------
//  LIGHT THEME
// ---------------------------------------------
export const lightTheme: ThemeTokens = {
  isDark: false,
  background:      '#FFFFFF',
  backgroundDeep:  '#F0F5F3',
  surface:         '#FFFFFF',
  surfaceElevated: '#F0F5F3',
  surfaceSubtle:   '#F8FAF9',
  textPrimary:     '#34383A',
  textSecondary:   '#164F43',
  textMuted:       '#6B7E79',
  brand:           '#164F43',
  brandActive:     '#26745F',
  emergency:       '#D52D35',
  emergencySevere: '#B51F2A',
  emergencyLight:  'rgba(213, 45, 53, 0.08)',
  border:          '#C7C9C9',
  borderSubtle:    'rgba(22, 79, 67, 0.15)',
  navBar:          '#FFFFFF',
  navBarBorder:    '#E8ECEB',
  inputBg:         '#FFFFFF',
  inputBorder:     '#C7C9C9',
  overlay:         'rgba(52, 56, 58, 0.50)',
  white:           '#FFFFFF',
  silver:          '#C7C9C9',
  success:         '#26745F',
  successLight:    'rgba(38, 116, 95, 0.10)',
  warning:         '#C07A28',
  warningLight:    'rgba(192, 122, 40, 0.10)',
  accent:          '#26745F',
  accentLight:     'rgba(38, 116, 95, 0.10)',
  accentDark:      '#164F43',
  primary:         '#34383A',
  textSecondaryOld:'#164F43',
};

// ---------------------------------------------
//  Backward-compat Colors export
// ---------------------------------------------
export const Colors = {
  background:      darkTheme.background,
  surface:         '#26745F',
  surfaceLight:    darkTheme.surfaceSubtle,
  surfaceSubtle:   darkTheme.surfaceSubtle,
  surfaceElevated: darkTheme.surfaceElevated,
  primary:         darkTheme.textPrimary,
  primaryLight:    darkTheme.textSecondary,
  slateMuted:      darkTheme.textMuted,
  brandRed:        '#D52D35',
  brandRedDark:    '#B51F2A',
  brandRedLight:   'rgba(213, 45, 53, 0.18)',
  brandRedGlow:    'rgba(213, 45, 53, 0.25)',
  accent:          '#26745F',
  accentDark:      '#164F43',
  accentLight:     'rgba(38, 116, 95, 0.20)',
  accentGlow:      'rgba(38, 116, 95, 0.30)',
  navy:            '#164F43',
  navyDark:        '#0E3530',
  navyLight:       '#26745F',
  navyBubble:      '#164F43',
  cta:             '#D52D35',
  ctaDark:         '#B51F2A',
  ctaLight:        'rgba(213, 45, 53, 0.18)',
  amberWarning:    '#E59835',
  amberLight:      'rgba(229, 152, 53, 0.18)',
  infoBlue:        '#2563EB',
  infoLight:       'rgba(37, 99, 235, 0.15)',
  textPrimary:     darkTheme.textPrimary,
  textSecondary:   darkTheme.textSecondary,
  textMuted:       darkTheme.textMuted,
  border:          darkTheme.border,
  borderLight:     darkTheme.borderSubtle,
  borderDark:      'rgba(38, 116, 95, 0.60)',
  white:           '#FFFFFF',
  black:           '#000000',
  overlay:         darkTheme.overlay,
  error:           '#D52D35',
  errorLight:      'rgba(213, 45, 53, 0.18)',
  success:         '#26745F',
  successLight:    'rgba(38, 116, 95, 0.20)',
  warning:         '#E59835',
  warningLight:    'rgba(229, 152, 53, 0.18)',
  info:            '#2563EB',
} as const;

// ---------------------------------------------
//  Typography
// ---------------------------------------------
const SF_PRO_FAMILY = Platform.select({
  ios:     'System',
  web:     '-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", system-ui, sans-serif',
  default: 'System',
}) as string;

export const Fonts = {
  regular:  SF_PRO_FAMILY,
  medium:   SF_PRO_FAMILY,
  semiBold: SF_PRO_FAMILY,
  bold:     SF_PRO_FAMILY,
} as const;

// ---------------------------------------------
//  Glassmorphism helpers (theme-aware)
// ---------------------------------------------
export function makeGlass(theme: ThemeTokens) {
  const blur = Platform.OS === 'web';
  return {
    card: {
      backgroundColor: theme.surface,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 20,
      shadowColor: theme.isDark ? '#000000' : '#164F43',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: theme.isDark ? 0.35 : 0.06,
      shadowRadius: 14,
      elevation: 3,
      ...(blur ? ({
        backdropFilter: 'blur(16px)',
        WebkitBackdropFilter: 'blur(16px)',
        boxShadow: theme.isDark
          ? '0 4px 20px rgba(0,0,0,0.35), inset 0 1px 1px rgba(255,255,255,0.08)'
          : '0 4px 18px rgba(22,79,67,0.08), 0 1px 3px rgba(22,79,67,0.04)',
      } as any) : {}),
    },
    cardElevated: {
      backgroundColor: theme.surfaceElevated,
      borderWidth: 1,
      borderColor: theme.border,
      borderRadius: 22,
      shadowColor: theme.isDark ? '#000000' : '#164F43',
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: theme.isDark ? 0.40 : 0.10,
      shadowRadius: 20,
      elevation: 5,
      ...(blur ? ({
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        boxShadow: theme.isDark
          ? '0 8px 28px rgba(0,0,0,0.45), inset 0 1px 1px rgba(255,255,255,0.08)'
          : '0 8px 24px rgba(22,79,67,0.10), 0 2px 6px rgba(22,79,67,0.05)',
      } as any) : {}),
    },
    cardUrgent: {
      backgroundColor: theme.emergency,
      borderWidth: 0,
      borderRadius: 22,
      shadowColor: theme.emergency,
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.35,
      shadowRadius: 18,
      elevation: 5,
      ...(blur ? ({
        backgroundImage: 'linear-gradient(135deg, #B51F2A 0%, #D52D35 100%)',
        boxShadow: '0 8px 24px rgba(213,45,53,0.35)',
      } as any) : {}),
    },
    input: {
      backgroundColor: theme.inputBg,
      borderWidth: 1.5,
      borderColor: theme.inputBorder,
      borderRadius: 24,
      color: theme.textPrimary,
      ...(blur ? ({
        backdropFilter: 'blur(12px)',
        WebkitBackdropFilter: 'blur(12px)',
        boxShadow: theme.isDark
          ? '0 2px 8px rgba(0,0,0,0.25)'
          : '0 2px 8px rgba(22,79,67,0.04)',
      } as any) : {}),
    },
  };
}

// Backward-compat static Glass (dark theme values)
export const Glass = makeGlass(darkTheme);
