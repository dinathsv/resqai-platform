import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { useLanguage } from '../context/LanguageContext';
import { useTheme } from '../context/ThemeContext';
import { Fonts } from '../constants/theme';
import { SupportedLanguage } from '../locales';

interface LanguageSelectorProps {
  variant?: 'segmented' | 'list';
  style?: any;
}

export default function LanguageSelector({ variant = 'segmented', style }: LanguageSelectorProps) {
  const { language, setLanguage, options } = useLanguage();
  const { theme } = useTheme();

  const handleSelect = (code: SupportedLanguage) => {
    if (code !== language) {
      setLanguage(code);
    }
  };

  if (variant === 'list') {
    return (
      <View style={[styles.listContainer, style]}>
        {options.map((opt) => {
          const isSelected = opt.code === language;
          return (
            <TouchableOpacity
              key={opt.code}
              style={[
                styles.listItem,
                {
                  backgroundColor: isSelected
                    ? theme.isDark
                      ? 'rgba(10, 132, 255, 0.15)'
                      : 'rgba(10, 132, 255, 0.08)'
                    : theme.surface,
                  borderColor: isSelected ? theme.accent : theme.border,
                },
              ]}
              onPress={() => handleSelect(opt.code)}
              activeOpacity={0.7}
              accessibilityRole="radio"
              accessibilityState={{ selected: isSelected }}
            >
              <View style={styles.listTextCol}>
                <Text
                  style={[
                    styles.listNativeName,
                    {
                      color: isSelected ? theme.accent : theme.textPrimary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {opt.nativeName}
                </Text>
                <Text style={[styles.listSubtext, { color: theme.textMuted }]}>
                  {opt.label}
                </Text>
              </View>

              {/* Radio Circle */}
              <View
                style={[
                  styles.radioOuter,
                  {
                    borderColor: isSelected ? theme.accent : theme.border,
                  },
                ]}
              >
                {isSelected && (
                  <View
                    style={[
                      styles.radioInner,
                      { backgroundColor: theme.accent },
                    ]}
                  />
                )}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
    );
  }

  // Segmented Pill Control (compact, ideal for onboarding & auth screens)
  return (
    <View
      style={[
        styles.segmentedContainer,
        {
          backgroundColor: theme.isDark
            ? 'rgba(255, 255, 255, 0.06)'
            : 'rgba(0, 0, 0, 0.04)',
          borderColor: theme.border,
        },
        Platform.OS === 'web' && ({
          backdropFilter: 'blur(10px)',
          WebkitBackdropFilter: 'blur(10px)',
        } as any),
        style,
      ]}
      accessibilityRole="radiogroup"
    >
      {options.map((opt) => {
        const isSelected = opt.code === language;
        return (
          <TouchableOpacity
            key={opt.code}
            style={[
              styles.segmentItem,
              isSelected && [
                styles.segmentItemActive,
                {
                  backgroundColor: theme.accent,
                  shadowColor: theme.accent,
                },
                Platform.OS === 'web' && ({
                  boxShadow: `0 2px 6px ${theme.accent}40`,
                } as any),
              ],
            ]}
            onPress={() => handleSelect(opt.code)}
            activeOpacity={0.7}
            accessibilityRole="radio"
            accessibilityState={{ selected: isSelected }}
          >
            <Text
              style={[
                styles.segmentText,
                {
                  color: isSelected ? '#FFFFFF' : theme.textSecondary,
                  fontWeight: isSelected ? '700' : '500',
                },
              ]}
              numberOfLines={1}
            >
              {opt.nativeName}
            </Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segmentedContainer: {
    flexDirection: 'row',
    borderRadius: 10,
    borderWidth: 1,
    padding: 3,
    marginBottom: 16,
    width: '100%',
  },
  segmentItem: {
    flex: 1,
    paddingVertical: 7,
    paddingHorizontal: 6,
    borderRadius: 7,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentItemActive: {
    elevation: 2,
  },
  segmentText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  listContainer: {
    width: '100%',
    gap: 8,
  },
  listItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 10,
    borderWidth: 1,
  },
  listTextCol: {
    flex: 1,
  },
  listNativeName: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    marginBottom: 2,
  },
  listSubtext: {
    fontSize: 12,
    fontFamily: Fonts.regular,
  },
  radioOuter: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 12,
  },
  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
