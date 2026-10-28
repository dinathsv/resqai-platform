import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
  LogBox,
} from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as Location from 'expo-location';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { initDB } from '../services/offlineStorage';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from '../services/notificationService';
import { ThemeProvider, useTheme } from '../context/ThemeContext';
import { LanguageProvider, useLanguage } from '../context/LanguageContext';
import { SafeAreaProvider } from 'react-native-safe-area-context';

LogBox.ignoreLogs([
  /props\.pointerEvents is deprecated\. Use style\.pointerEvents/,
  /shadow\* style props are deprecated/,
  /TouchableWithoutFeedback is deprecated/,
]);

const isWeb = Platform.OS === 'web';

function useWebMobileFrame() {
  useEffect(() => {
    if (Platform.OS === 'web' && typeof document !== 'undefined') {
      const styleId = 'resqai-hide-scrollbars';
      if (!document.getElementById(styleId)) {
        const style = document.createElement('style');
        style.id = styleId;
        style.textContent = `
          * {
            -ms-overflow-style: none !important;
            scrollbar-width: none !important;
          }
          *::-webkit-scrollbar {
            display: none !important;
            width: 0 !important;
            height: 0 !important;
          }
        `;
        document.head.appendChild(style);
      }
    }
  }, []);
}

// Inner layout that can read theme and language from context
function AppLayout() {
  const { isOnline } = useNetworkSync();
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();

  useEffect(() => {
    try {
      initDB();
    } catch (error) {
      console.warn('Offline storage initialization failed:', error);
    }
    registerForPushNotifications().catch((error) => {
      console.warn('Push notifications unavailable:', error);
    });
    const cleanup = setupNotificationListeners(router);
    return cleanup;
  }, []);

  useEffect(() => {
    if (Platform.OS === 'web') return;

    Location.requestForegroundPermissionsAsync().catch((error) => {
      console.warn('Location permission request failed:', error);
    });
  }, []);

  const appContent = (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      {!isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: theme.brand }]}>
          <Text style={[styles.offlineText, { color: '#FFFFFF' }]}>
            {t('common.offlineBanner')}
          </Text>
        </View>
      )}
      <Slot />
    </View>
  );

  if (isWeb) {
    return (
      <View
        style={[
          styles.webFrame,
          { backgroundColor: theme.background },
        ]}
      >
        {appContent}
      </View>
    );
  }

  return appContent;
}

export default function RootLayout() {
  useWebMobileFrame();
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <LanguageProvider>
          <AppLayout />
        </LanguageProvider>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const { width: screenWidth } = Dimensions.get('window');
const isMobileWeb = isWeb && screenWidth <= 480;

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  loadingRoot: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBanner: {
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    fontSize: 12,
    textAlign: 'center',
  },
  ...(isWeb
    ? {
        webFrame: {
          width: '100%',
          maxWidth: 480,
          marginHorizontal: 'auto',
          height: '100vh',
          overflow: 'hidden',
          backgroundColor: 'transparent',
        } as any,
      }
    : {}),
});