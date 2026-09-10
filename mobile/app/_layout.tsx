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
import { useNetworkSync } from '../hooks/useNetworkSync';
import { initDB } from '../services/offlineStorage';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from '../services/notificationService';
import {
  useFonts,
  Montserrat_400Regular,
  Montserrat_500Medium,
  Montserrat_600SemiBold,
  Montserrat_700Bold,
} from '@expo-google-fonts/montserrat';
import { Fonts } from '../constants/theme';
import { ThemeProvider, useTheme } from '../context/ThemeContext';

const isWeb = Platform.OS === 'web';

function useWebMobileFrame() {
  useEffect(() => {
    if (!isWeb) return;
    const fontLink = document.createElement('link');
    fontLink.rel = 'stylesheet';
    fontLink.href = 'https://fonts.cdnfonts.com/css/sf-pro-display';
    document.head.appendChild(fontLink);
    const style = document.createElement('style');
    style.textContent = `
      * {
        font-family: -apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", "SF Pro", system-ui, sans-serif !important;
        -webkit-font-smoothing: antialiased;
        -moz-osx-font-smoothing: grayscale;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      *::-webkit-scrollbar {
        width: 0 !important;
        height: 0 !important;
        display: none !important;
      }
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        background-color: #1A2624;
        overflow: hidden;
        scrollbar-width: none !important;
        -ms-overflow-style: none !important;
      }
      #root {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100% !important;
        width: 100% !important;
        background-color: #1A2624;
      }
      #root > div {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        width: 100% !important;
        height: 100% !important;
      }
      @media (max-width: 480px) {
        html, body, #root {
          background-color: #34383A;
        }
      }
    `;
    document.head.appendChild(style);
    return () => {
      document.head.removeChild(style);
      if (fontLink.parentNode) fontLink.parentNode.removeChild(fontLink);
    };
  }, []);
}

// Inner layout that can read theme from context
function AppLayout() {
  const { isOnline } = useNetworkSync();
  const router = useRouter();
  const { theme } = useTheme();

  const [fontsLoaded] = useFonts({
    Montserrat_400Regular,
    Montserrat_500Medium,
    Montserrat_600SemiBold,
    Montserrat_700Bold,
  });

  useEffect(() => {
    initDB();
    registerForPushNotifications();
    const cleanup = setupNotificationListeners(router);
    return cleanup;
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={[styles.loadingRoot, isWeb && styles.webFrame, { backgroundColor: theme.background }]}>
        <ActivityIndicator size="large" color={theme.brandActive} />
      </View>
    );
  }

  const appContent = (
    <View style={[styles.root, { backgroundColor: theme.background }]}>
      <StatusBar style={theme.isDark ? 'light' : 'dark'} />
      {!isOnline && (
        <View style={[styles.offlineBanner, { backgroundColor: theme.brand }]}>
          <Text style={[styles.offlineText, { color: '#FFFFFF' }]}>
            Offline — requests will sync when connected
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
  LogBox.ignoreLogs([
    '"shadow*" style props are deprecated',
    'props.pointerEvents is deprecated',
    'TouchableWithoutFeedback is deprecated'
  ]);
  return (
    <ThemeProvider>
      <AppLayout />
    </ThemeProvider>
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
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  ...(isWeb
    ? {
        webFrame: {
          width: isMobileWeb ? '100%' : 420,
          maxWidth: isMobileWeb ? '100%' : 420,
          height: '100vh',
          maxHeight: isMobileWeb ? '100vh' : 900,
          overflow: 'hidden',
          borderRadius: isMobileWeb ? 0 : 36,
          ...(isMobileWeb
            ? {}
            : {
                shadowColor: '#000000',
                shadowOffset: { width: 0, height: 25 },
                shadowOpacity: 0.40,
                shadowRadius: 50,
                elevation: 20,
                borderWidth: 1,
                borderColor: 'rgba(255, 255, 255, 0.12)',
              }),
        } as any,
      }
    : {}),
});