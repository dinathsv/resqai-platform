

import React, { useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ActivityIndicator,
  Platform,
  Dimensions,
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
import { Colors, Fonts } from '../constants/theme';

const isWeb = Platform.OS === 'web';

/**
 * On web: inject global styles to create the dark background
 * and constrain the app to a mobile phone frame.
 */
function useWebMobileFrame() {
  useEffect(() => {
    if (!isWeb) return;

    // Load Apple SF Pro font on web
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
      }
      html, body {
        margin: 0;
        padding: 0;
        height: 100%;
        width: 100%;
        background-color: #0B0F17;
        overflow: hidden;
      }
      #root {
        display: flex !important;
        align-items: center !important;
        justify-content: center !important;
        height: 100% !important;
        width: 100% !important;
        background-color: #0B0F17;
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
          background-color: #F8FAFC;
        }
      }
    `;
    document.head.appendChild(style);

    return () => {
      document.head.removeChild(style);
      if (fontLink.parentNode) {
        fontLink.parentNode.removeChild(fontLink);
      }
    };
  }, []);
}

export default function RootLayout() {
  const { isOnline } = useNetworkSync();
  const router = useRouter();

  useWebMobileFrame();

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
      <View style={[styles.loadingRoot, isWeb && styles.webFrame]}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  const appContent = (
    <View style={styles.root}>
      <StatusBar style="light" />
      {!isOnline && (
        <View style={styles.offlineBanner}>
          <Text style={styles.offlineText}>
            Offline — requests will sync when connected
          </Text>
        </View>
      )}
      <Slot />
    </View>
  );

  // On web: wrap in a mobile phone frame container
  if (isWeb) {
    return <View style={styles.webFrame}>{appContent}</View>;
  }

  return appContent;
}

const { width: screenWidth } = Dimensions.get('window');
const isMobileWeb = isWeb && screenWidth <= 480;

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  offlineBanner: {
    backgroundColor: Colors.accent,
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: Colors.white,
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
          backgroundColor: '#F8FAFC',
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