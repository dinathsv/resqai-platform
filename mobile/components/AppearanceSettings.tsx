import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
} from 'react-native';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { Fonts } from '../constants/theme';

interface AppearanceSettingsProps {
  visible: boolean;
  onClose: () => void;
}

type Option = { mode: ThemeMode; label: string; icon: string };

const OPTIONS: Option[] = [
  { mode: 'light',  label: 'Light',  icon: '☀' },
  { mode: 'dark',   label: 'Dark',   icon: '🌙' },
  { mode: 'system', label: 'System', icon: '◐' },
];

export default function AppearanceSettings({ visible, onClose }: AppearanceSettingsProps) {
  const { theme, themeMode, setThemeMode } = useTheme();

  const handleSelect = (mode: ThemeMode) => {
    setThemeMode(mode);
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={[styles.backdrop, { backgroundColor: theme.overlay }]}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          style={[
            styles.sheet,
            {
              backgroundColor: theme.navBar,
              borderTopColor: theme.border,
            },
            Platform.OS === 'web' && ({
              boxShadow: theme.isDark
                ? '0 -12px 40px rgba(0,0,0,0.5)'
                : '0 -12px 40px rgba(22,79,67,0.15)',
            } as any),
          ]}
        >
          {/* Handle */}
          <View style={[styles.handle, { backgroundColor: theme.border }]} />

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            Appearance
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Choose your preferred theme
          </Text>

          {/* Segmented control */}
          <View
            style={[
              styles.segmentContainer,
              {
                backgroundColor: theme.isDark
                  ? 'rgba(255,255,255,0.06)'
                  : 'rgba(22,79,67,0.07)',
                borderColor: theme.border,
              },
              Platform.OS === 'web' && ({
                backdropFilter: 'blur(16px)',
                WebkitBackdropFilter: 'blur(16px)',
              } as any),
            ]}
          >
            {OPTIONS.map((opt, idx) => {
              const isActive = themeMode === opt.mode;
              return (
                <TouchableOpacity
                  key={opt.mode}
                  style={[
                    styles.segment,
                      isActive && [
                        styles.segmentActive,
                        {
                          backgroundColor: theme.brandActive,
                          borderColor: theme.brandActive,
                        },
                      ],
                    idx === 0 && styles.segmentFirst,
                    idx === OPTIONS.length - 1 && styles.segmentLast,
                  ]}
                  onPress={() => handleSelect(opt.mode)}
                  activeOpacity={0.75}
                >
                  <Text style={styles.segmentIcon}>{opt.icon}</Text>
                  <Text
                    style={[
                      styles.segmentLabel,
                      {
                        color: isActive
                          ? '#FFFFFF'
                          : theme.textSecondary,
                        fontFamily: isActive ? Fonts.bold : Fonts.semiBold,
                      },
                    ]}
                  >
                    {opt.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {/* Description row */}
          <View style={[styles.descRow, { backgroundColor: theme.surfaceSubtle, borderColor: theme.borderSubtle }]}>
            <Text style={[styles.descIcon]}>
              {themeMode === 'light' ? '☀' : themeMode === 'dark' ? '🌙' : '◐'}
            </Text>
            <Text style={[styles.descText, { color: theme.textMuted }]}>
              {themeMode === 'system'
                ? 'Follows your device display settings automatically'
                : themeMode === 'dark'
                ? 'Dark mode — professional, secure, low-light optimised'
                : 'Light mode — clean, bright, high-contrast'}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.closeBtn,
              { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
            ]}
            onPress={onClose}
            activeOpacity={0.8}
          >
            <Text style={[styles.closeBtnText, { color: theme.textPrimary }]}>Done</Text>
          </TouchableOpacity>
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 420,
    alignSelf: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 40,
    alignItems: 'center',
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    marginBottom: 20,
  },
  title: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginBottom: 24,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 16,
    borderWidth: 1,
    padding: 4,
    width: '100%',
    marginBottom: 20,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 12,
    gap: 6,
  },
  segmentFirst: {
    borderTopLeftRadius: 12,
    borderBottomLeftRadius: 12,
  },
  segmentLast: {
    borderTopRightRadius: 12,
    borderBottomRightRadius: 12,
  },
  segmentActive: {
  },
  segmentIcon: {
    fontSize: 15,
  },
  segmentLabel: {
    fontSize: 14,
  },
  descRow: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
    gap: 10,
    marginBottom: 20,
  },
  descIcon: {
    fontSize: 20,
  },
  descText: {
    flex: 1,
    fontSize: 13,
    fontFamily: Fonts.regular,
    lineHeight: 18,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
    borderWidth: 1,
  },
  closeBtnText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
});