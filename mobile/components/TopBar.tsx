import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  Platform,
  Pressable,
  Animated,
  Easing,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import AppearanceSettings from './AppearanceSettings';
import { Ionicons } from '@expo/vector-icons';

interface TopBarProps {
  title?: string;
  showBack?: boolean;
  onBack?: () => void;
  showLogo?: boolean;
  rightAction?: React.ReactNode;
  theme?: 'light' | 'dark' | 'red';
  transparent?: boolean;
}

export default function TopBar({
  title,
  showBack = false,
  onBack,
  showLogo = false,
  rightAction,
  theme = 'light',
  transparent = false,
}: TopBarProps) {
  const router = useRouter();
  const pathname = usePathname();
  const [menuVisible, setMenuVisible] = useState(false);
  const [languageMenuVisible, setLanguageMenuVisible] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const languageMenuAnimation = React.useRef(new Animated.Value(0)).current;
  const { theme: appTheme } = useTheme();
  const { language, setLanguage, options, t } = useLanguage();
  const isDark = appTheme.isDark || theme === 'dark' || theme === 'red';
  const useNativeDriver = Platform.OS !== 'web';

  const handleDefaultBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(people)/dashboard');
    }
  };

  const handleNavigate = (path: string) => {
    setMenuVisible(false);
    if (pathname === path) return;
    router.push(path as any);
  };

  const handleSignOut = async () => {
    setMenuVisible(false);
    try {
      await AsyncStorage.clear();
    } catch (e) {
      console.warn('Sign out clear error:', e);
    }
    router.replace('/');
  };

  const openLanguageMenu = () => {
    setLanguageMenuVisible(true);
    Animated.timing(languageMenuAnimation, {
      toValue: 1,
      duration: 220,
      easing: Easing.out(Easing.cubic),
      useNativeDriver,
    }).start();
  };

  const closeLanguageMenu = (afterClose?: () => void) => {
    Animated.timing(languageMenuAnimation, {
      toValue: 0,
      duration: 160,
      easing: Easing.in(Easing.cubic),
      useNativeDriver,
    }).start(({ finished }) => {
      if (finished) {
        setLanguageMenuVisible(false);
        afterClose?.();
      }
    });
  };

  const selectLanguage = (nextLanguage: typeof language) => {
    closeLanguageMenu(() => {
      if (nextLanguage !== language) {
        setLanguage(nextLanguage);
      }
    });
  };

  return (
    <>
      <View
        style={[
          styles.headerBar,
          {
            backgroundColor: appTheme.navBar,
            borderBottomColor: appTheme.navBarBorder,
          },
          isDark && styles.headerBarDark,
          transparent && styles.headerBarTransparent,
        ]}
      >
        {/* Left Side: Back button or ResQAI Logo */}
        <View style={styles.leftContainer}>
          {showBack ? (
            <TouchableOpacity
              style={styles.backButtonTouch}
              onPress={onBack || handleDefaultBack}
              activeOpacity={0.7}
            >
              <Text
                style={[
                  styles.backButtonText,
                  isDark && styles.backButtonTextDark,
                ]}
              >
                ←
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.replace('/(people)/dashboard')}
              activeOpacity={0.8}
              style={[styles.logoTouch, styles.logoBadge]}
            >
              <Image
                source={require('../assets/resqai_logo.png')}
                style={styles.logoImage}
                resizeMode="contain"
              />
            </TouchableOpacity>
          )}
        </View>

        {/* Center: Page Title if provided */}
        <View style={styles.centerContainer}>
          {title ? (
            <Text
              style={[
                styles.titleText,
                isDark && styles.titleTextDark,
              ]}
              numberOfLines={1}
            >
              {title}
            </Text>
          ) : showBack && showLogo ? (
            <View style={styles.logoBadgeSmall}>
              <Image
                source={require('../assets/resqai_logo.png')}
                style={styles.logoImageSmall}
                resizeMode="contain"
              />
            </View>
          ) : null}
        </View>

        {/* Right Side: Language picker & 3-Dot Button */}
        <View style={styles.rightContainer}>
          {rightAction ? (
            rightAction
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <TouchableOpacity
                style={[
                  styles.langPill,
                  {
                    backgroundColor: appTheme.isDark
                      ? 'rgba(255, 255, 255, 0.08)'
                      : 'rgba(10, 132, 255, 0.08)',
                    borderColor: appTheme.border,
                  },
                ]}
                onPress={openLanguageMenu}
                activeOpacity={0.7}
                accessibilityLabel="Choose language"
                accessibilityState={{ expanded: languageMenuVisible }}
              >
                <Ionicons name="globe-outline" size={15} color={appTheme.accent} />
                <Text
                  style={[
                    styles.langPillText,
                    { color: appTheme.accent },
                  ]}
                >
                  {t('nav.language')}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.dotsButton,
                  isDark && styles.dotsButtonDark,
                ]}
                onPress={() => setMenuVisible(true)}
                activeOpacity={0.7}
                accessibilityLabel="Open Navigation Menu"
              >
                <Text
                  style={[
                    styles.dotsIcon,
                    { color: appTheme.textPrimary },
                    isDark && styles.dotsIconDark,
                  ]}
                >
                  ⋮
                </Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      </View>

      <Modal
        visible={languageMenuVisible}
        transparent
        animationType="none"
        onRequestClose={() => closeLanguageMenu()}
      >
        <Pressable style={styles.languageOverlay} onPress={() => closeLanguageMenu()}>
          <Animated.View
            style={[
              styles.languageMenuWrapper,
              {
                opacity: languageMenuAnimation,
                transform: [
                  {
                    translateY: languageMenuAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [-8, 0],
                    }),
                  },
                  {
                    scale: languageMenuAnimation.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.96, 1],
                    }),
                  },
                ],
              },
            ]}
          >
            <Pressable
              style={[
                styles.languageMenu,
                { backgroundColor: appTheme.surface, borderColor: appTheme.border },
              ]}
              onPress={(event) => event.stopPropagation()}
            >
              <View style={styles.languageMenuHeader}>
                <View style={styles.languageMenuHeading}>
                  <Text style={[styles.languageMenuTitle, { color: appTheme.textPrimary }]}>
                    {t('nav.language')}
                  </Text>
                </View>
              </View>
              {options.map((option) => {
                const selected = option.code === language;
                return (
                  <TouchableOpacity
                    key={option.code}
                    style={[
                      styles.languageOption,
                      {
                        borderColor: selected ? appTheme.accent : appTheme.border,
                        backgroundColor: selected
                          ? appTheme.isDark
                            ? 'rgba(10, 132, 255, 0.16)'
                            : 'rgba(10, 132, 255, 0.08)'
                          : appTheme.isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : '#FFFFFF',
                      },
                    ]}
                    onPress={() => selectLanguage(option.code)}
                    activeOpacity={0.7}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                  >
                    <View style={styles.languageOptionText}>
                      <Text
                        style={[
                          styles.languageNativeName,
                          { color: selected ? appTheme.accent : appTheme.textPrimary },
                        ]}
                      >
                        {option.nativeName}
                      </Text>
                      <Text style={[styles.languageEnglishName, { color: appTheme.textMuted }]}>
                        {option.label} · {option.code.toUpperCase()}
                      </Text>
                    </View>
                    <View
                      style={[
                        styles.languageCheck,
                        {
                          borderColor: selected ? appTheme.accent : appTheme.border,
                          backgroundColor: selected ? appTheme.accent : 'transparent',
                        },
                      ]}
                    >
                      {selected && <View style={styles.languageCheckDot} />}
                    </View>
                  </TouchableOpacity>
                );
              })}
            </Pressable>
          </Animated.View>
        </Pressable>
      </Modal>

      {/* Sleek Top-Right Navigation Dropdown Menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <Pressable onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentWrapper}>
              <Pressable>
                <View
                  style={[
                    styles.menuDropdown,
                    { backgroundColor: appTheme.surface, borderColor: appTheme.border },
                  ]}
                >
                  {/* Language & Appearance */}
                  <TouchableOpacity
                    style={styles.menuItem}
                    onPress={() => {
                      setMenuVisible(false);
                      setSettingsVisible(true);
                    }}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="language-outline" size={16} color={appTheme.textPrimary} />
                    <Text style={[styles.menuItemLabel, { color: appTheme.textPrimary }]}>
                      {t('nav.language')} / {t('nav.appearance')}
                    </Text>
                  </TouchableOpacity>

                  <View style={styles.menuDivider} />

                  <TouchableOpacity
                    style={styles.menuItemSignOut}
                    onPress={handleSignOut}
                    activeOpacity={0.7}
                  >
                    <Ionicons name="log-out-outline" size={16} color={appTheme.emergency} />
                    <Text style={styles.menuSignOutLabel}>{t('nav.signOut')}</Text>
                  </TouchableOpacity>
                </View>
              </Pressable>
            </View>
          </View>
        </Pressable>
      </Modal>

      <AppearanceSettings
        visible={settingsVisible}
        onClose={() => setSettingsVisible(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  headerBar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#F1F5F9',
    zIndex: 10,
  },
  leftContainer: {
    minWidth: 48,
    justifyContent: 'center',
    alignItems: 'flex-start',
  },
  logoTouch: {
    padding: 2,
  },
  logoBadge: {
    padding: 3,
  },
  logoBadgeSmall: {
    padding: 2,
  },
  logoImage: {
    width: 36,
    height: 36,
    borderRadius: 6,
  },
  logoImageSmall: {
    width: 28,
    height: 28,
    borderRadius: 4,
  },
  backButtonTouch: {
    paddingVertical: 6,
    paddingRight: 10,
  },
  backButtonText: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#DC2626',
  },
  centerContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  centerSpace: {
    flex: 1,
  },
  titleText: {
    fontSize: 17,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    textAlign: 'center',
    letterSpacing: -0.3,
  },
  rightContainer: {
    minWidth: 40,
    alignItems: 'flex-end',
    justifyContent: 'center',
  },
  dotsButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsIcon: {
    fontSize: 20,
    color: '#0F172A',
    fontFamily: Fonts.bold,
    lineHeight: 22,
  },
  headerBarTransparent: {
    backgroundColor: 'transparent',
    borderBottomWidth: 0,
  },
  headerBarDark: {
    backgroundColor: '#18181B',
    borderBottomColor: '#27272A',
  },
  backButtonTextDark: {
    color: '#FFFFFF',
  },
  titleTextDark: {
    color: '#FFFFFF',
  },
  dotsButtonDark: {
  },
  dotsIconDark: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'transparent',
    justifyContent: 'flex-start',
    alignItems: 'center',
  },
  languageOverlay: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
    backgroundColor: 'rgba(15, 23, 42, 0.16)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(8px)',
          WebkitBackdropFilter: 'blur(8px)',
        } as any)
      : {}),
  },
  languageMenuWrapper: {
    width: '100%',
    maxWidth: 250,
    transformOrigin: 'center',
  } as any,
  languageMenu: {
    width: '100%',
    borderRadius: 16,
    borderWidth: 1,
    padding: 10,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 10px 24px rgba(15, 23, 42, 0.14)' } as any)
      : {}),
    elevation: 10,
  },
  languageMenuHeader: {
    marginBottom: 4,
    paddingHorizontal: 4,
    paddingVertical: 2,
  },
  languageMenuHeading: {
    flex: 1,
  },
  languageMenuTitle: {
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  languageOption: {
    minHeight: 44,
    borderRadius: 10,
    borderWidth: 1,
    paddingHorizontal: 11,
    marginTop: 5,
    flexDirection: 'row',
    alignItems: 'center',
  },
  languageOptionText: {
    flex: 1,
    gap: 1,
  },
  languageNativeName: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  languageEnglishName: {
    fontSize: 10,
    fontFamily: Fonts.regular,
  },
  languageCheck: {
    width: 16,
    height: 16,
    borderRadius: 8,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: 8,
  },
  languageCheckDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#FFFFFF',
  },
  modalContentWrapper: {
    width: '100%',
    maxWidth: 480,
    alignItems: 'flex-end',
    paddingRight: 16,
    paddingTop: Platform.OS === 'ios' ? 56 : 56,
  },
  menuDropdown: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 12,
    ...(Platform.OS === 'web'
      ? ({ boxShadow: '0 12px 24px rgba(15, 23, 42, 0.1)' } as any)
      : {}),
    elevation: 10,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
  },
  menuItemActive: {
    backgroundColor: '#FEE2E2',
  },
  menuItemIcon: {
    fontSize: 18,
  },
  menuItemLabel: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#1E293B',
  },
  menuItemLabelActive: {
    color: '#DC2626',
    fontFamily: Fonts.bold,
  },
  menuItemSignOut: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 12,
    gap: 12,
    marginTop: 4,
  },
  menuSignOutLabel: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#DC2626',
  },
  langPill: {
    minHeight: 34,
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 10,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    alignItems: 'center',
    justifyContent: 'center',
  },
  langPillText: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
  },
});
