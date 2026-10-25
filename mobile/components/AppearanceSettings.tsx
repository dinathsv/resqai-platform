import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Modal,
  Platform,
  ScrollView,
} from 'react-native';
import { useTheme, ThemeMode } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { Fonts } from '../constants/theme';
import LanguageSelector from './LanguageSelector';

interface AppearanceSettingsProps {
  visible: boolean;
  onClose: () => void;
}

type Option = { mode: ThemeMode; labelKey: string; icon: string };

const THEME_OPTIONS: Option[] = [
  { mode: 'light',  labelKey: 'settings.themeLight',  icon: '☀' },
  { mode: 'dark',   labelKey: 'settings.themeDark',   icon: '☾' },
  { mode: 'system', labelKey: 'settings.themeSystem', icon: '◐' },
];

export default function AppearanceSettings({ visible, onClose }: AppearanceSettingsProps) {
  const { theme, themeMode, setThemeMode } = useTheme();
  const { t } = useLanguage();

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
        style={[
          styles.backdrop,
          {
            backgroundColor: Platform.OS === 'web' ? 'transparent' : theme.overlay,
            alignItems: 'center',
          },
        ]}
        activeOpacity={1}
        onPress={onClose}
      >
        <View
          style={[
            styles.webFrameConstraint,
            { backgroundColor: Platform.OS === 'web' ? theme.overlay : 'transparent' },
          ]}
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
                width: '100%',
                maxWidth: 480,
                borderBottomLeftRadius: 0,
                borderBottomRightRadius: 0,
                boxShadow: theme.isDark
                  ? '0 -12px 40px rgba(0,0,0,0.5)'
                  : '0 -12px 40px rgba(22,79,67,0.15)',
              } as any),
            ]}
          >
            {/* Handle */}
            <View style={[styles.handle, { backgroundColor: theme.border }]} />

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollBody}>
              {/* Language Section */}
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                {t('settings.languageTitle')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                {t('settings.languageSubtitle')}
              </Text>
              <LanguageSelector variant="list" style={{ marginBottom: 24 }} />

              {/* Theme Section */}
              <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>
                {t('settings.appearanceTitle')}
              </Text>
              <Text style={[styles.subtitle, { color: theme.textMuted }]}>
                {t('settings.appearanceSubtitle')}
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
                {THEME_OPTIONS.map((opt, idx) => {
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
                        idx === THEME_OPTIONS.length - 1 && styles.segmentLast,
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
                        {t(opt.labelKey)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <TouchableOpacity
                style={[
                  styles.closeBtn,
                  { backgroundColor: theme.surfaceElevated, borderColor: theme.border },
                ]}
                onPress={onClose}
                activeOpacity={0.8}
              >
                <Text style={[styles.closeBtnText, { color: theme.textPrimary }]}>
                  {t('common.done')}
                </Text>
              </TouchableOpacity>
            </ScrollView>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  webFrameConstraint: {
    width: '100%',
    maxWidth: 480,
    height: '100%',
    justifyContent: 'flex-end',
  },
  sheet: {
    width: '100%',
    maxWidth: 480,
    maxHeight: '85%',
    alignSelf: 'center',
    borderTopLeftRadius: 16,
    borderTopRightRadius: 16,
    borderTopWidth: 1,
    paddingHorizontal: 24,
    paddingTop: 12,
    paddingBottom: 24,
  },
  scrollBody: {
    paddingBottom: 20,
  },
  handle: {
    width: 36,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    marginBottom: 14,
  },
  segmentContainer: {
    flexDirection: 'row',
    borderRadius: 12,
    borderWidth: 1,
    padding: 3,
    marginBottom: 24,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: 9,
    gap: 6,
  },
  segmentFirst: {
    borderTopLeftRadius: 9,
    borderBottomLeftRadius: 9,
  },
  segmentLast: {
    borderTopRightRadius: 9,
    borderBottomRightRadius: 9,
  },
  segmentActive: {
    borderRadius: 9,
  },
  segmentIcon: {
    fontSize: 14,
  },
  segmentLabel: {
    fontSize: 13,
  },
  closeBtn: {
    width: '100%',
    paddingVertical: 13,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeBtnText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
});