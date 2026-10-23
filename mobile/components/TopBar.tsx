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
} from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Colors, Fonts } from '../constants/theme';
import { useTheme } from '../context/ThemeContext';
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
  const { theme: appTheme } = useTheme();
  const isDark = appTheme.isDark || theme === 'dark' || theme === 'red';

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
                  { color: appTheme.textPrimary },
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
                  {/* Navigation Items */}
                <View style={styles.menuDivider} />

                <TouchableOpacity
                  style={styles.menuItemSignOut}
                  onPress={handleSignOut}
                  activeOpacity={0.7}
                >
                  <Ionicons name="log-out-outline" size={16} color={appTheme.emergency} />
                  <Text style={styles.menuSignOutLabel}>Sign Out</Text>
                </TouchableOpacity>
              </View>
            </Pressable>
          </View>
        </View>
      </Pressable>
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
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 12 },
    shadowOpacity: 0.1,
    shadowRadius: 24,
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
});
