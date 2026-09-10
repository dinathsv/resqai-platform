import React, { useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Modal,
  Platform,
  TouchableWithoutFeedback,
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts } from '../constants/theme';

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
  const isDark = theme === 'dark' || theme === 'red';

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

  return (
    <>
      <View
        style={[
          styles.headerBar,
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
                ← Back
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              onPress={() => router.replace('/(people)/dashboard')}
              activeOpacity={0.8}
              style={[styles.logoTouch, styles.logoBadge]}
            >
              <Image
                source={require('../assets/Resqai.jpeg')}
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
                source={require('../assets/Resqai.jpeg')}
                style={styles.logoImageSmall}
                resizeMode="contain"
              />
            </View>
          ) : null}
        </View>

        {/* Right Side: 3-Dot Button */}
        <View style={styles.rightContainer}>
          {rightAction ? (
            rightAction
          ) : (
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
                  isDark && styles.dotsIconDark,
                ]}
              >
                ⋮
              </Text>
            </TouchableOpacity>
          )}
        </View>
      </View>

      {/* Sleek Top-Right Navigation Dropdown Menu */}
      <Modal
        visible={menuVisible}
        transparent
        animationType="fade"
        onRequestClose={() => setMenuVisible(false)}
      >
        <TouchableWithoutFeedback onPress={() => setMenuVisible(false)}>
          <View style={styles.modalOverlay}>
            <View style={styles.modalContentWrapper}>
              <TouchableWithoutFeedback>
                <View style={styles.menuDropdown}>
                  {/* Menu Header */}
                  <View style={styles.menuHeader}>
                    <View style={styles.logoBadgeSmall}>
                      <Image
                        source={require('../assets/Resqai.jpeg')}
                        style={styles.menuLogo}
                        resizeMode="contain"
                      />
                    </View>
                    <TouchableOpacity
                      onPress={() => setMenuVisible(false)}
                      style={styles.closeButton}
                      activeOpacity={0.7}
                    >
                      <Text style={styles.closeIcon}>✕</Text>
                    </TouchableOpacity>
                  </View>

                <View style={styles.menuDivider} />

                {/* Navigation Items */}
                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    pathname === '/(people)/dashboard' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('/(people)/dashboard')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuItemIcon}>🏠</Text>
                  <Text
                    style={[
                      styles.menuItemLabel,
                      pathname === '/(people)/dashboard' && styles.menuItemLabelActive,
                    ]}
                  >
                    Dashboard Home
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    pathname === '/(people)/activities' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('/(people)/activities')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuItemIcon}>👤</Text>
                  <Text
                    style={[
                      styles.menuItemLabel,
                      pathname === '/(people)/activities' && styles.menuItemLabelActive,
                    ]}
                  >
                    Profile & Activities
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    pathname === '/(people)/help' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('/(people)/help')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuItemIcon}>🚨</Text>
                  <Text
                    style={[
                      styles.menuItemLabel,
                      pathname === '/(people)/help' && styles.menuItemLabelActive,
                    ]}
                  >
                    Emergency Help Center
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    pathname === '/(people)/locator' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('/(people)/locator')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuItemIcon}>🏥</Text>
                  <Text
                    style={[
                      styles.menuItemLabel,
                      pathname === '/(people)/locator' && styles.menuItemLabelActive,
                    ]}
                  >
                    Find Hospitals & Care
                  </Text>
                </TouchableOpacity>

                <TouchableOpacity
                  style={[
                    styles.menuItem,
                    pathname === '/(people)/chatbot' && styles.menuItemActive,
                  ]}
                  onPress={() => handleNavigate('/(people)/chatbot')}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuItemIcon}>🤖</Text>
                  <Text
                    style={[
                      styles.menuItemLabel,
                      pathname === '/(people)/chatbot' && styles.menuItemLabelActive,
                    ]}
                  >
                    AI First-Aid Guidance
                  </Text>
                </TouchableOpacity>

                <View style={styles.menuDivider} />

                {/* Sign Out Action */}
                <TouchableOpacity
                  style={styles.menuItemSignOut}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <Text style={styles.menuItemIcon}>🚪</Text>
                  <Text style={styles.menuSignOutLabel}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </TouchableWithoutFeedback>
          </View>
        </View>
      </TouchableWithoutFeedback>
    </Modal>
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
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    padding: 3,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 4,
    elevation: 3,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  logoBadgeSmall: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    padding: 2,
    borderWidth: 1,
    borderColor: '#E2E8F0',
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
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 2px 8px rgba(15, 23, 42, 0.05)',
        } as any)
      : {}),
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
    backgroundColor: 'transparent',
    borderBottomColor: 'transparent',
  },
  backButtonTextDark: {
    color: '#FFFFFF',
  },
  titleTextDark: {
    color: '#FFFFFF',
  },
  dotsButtonDark: {
    backgroundColor: 'rgba(255, 255, 255, 0.22)',
    borderColor: 'rgba(255, 255, 255, 0.40)',
  },
  dotsIconDark: {
    color: '#FFFFFF',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.40)',
    justifyContent: 'flex-start',
    alignItems: 'center',
    paddingTop: Platform.OS === 'ios' ? 56 : 48,
  },
  modalContentWrapper: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'flex-end',
    paddingRight: 16,
  },
  menuDropdown: {
    width: 250,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingVertical: 12,
    paddingHorizontal: 12,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.15,
    shadowRadius: 24,
    elevation: 10,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 12px 32px rgba(15, 23, 42, 0.16)',
        } as any)
      : {}),
  },
  menuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  menuLogo: {
    width: 100,
    height: 28,
  },
  closeButton: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
  },
  closeIcon: {
    fontSize: 12,
    color: '#64748B',
    fontFamily: Fonts.bold,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#F1F5F9',
    marginVertical: 8,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 10,
  },
  menuItemActive: {
    backgroundColor: '#FEE2E2',
  },
  menuItemIcon: {
    fontSize: 16,
  },
  menuItemLabel: {
    fontSize: 13.5,
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
    paddingVertical: 10,
    paddingHorizontal: 10,
    borderRadius: 12,
    gap: 10,
  },
  menuSignOutLabel: {
    fontSize: 13.5,
    fontFamily: Fonts.bold,
    color: '#DC2626',
  },
});
