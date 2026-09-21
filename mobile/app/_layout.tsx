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
import { ThemeProvider, useTheme } from '../context/ThemeContext';

const isWeb = Platform.OS === 'web';

function useWebMobileFrame() {
  // Web frame styling removed for minimal design
}

// Inner layout that can read theme from context
function AppLayout() {
  const { isOnline } = useNetworkSync();
  const router = useRouter();
  const { theme } = useTheme();



  useEffect(() => {
    initDB();
    registerForPushNotifications();
    const cleanup = setupNotificationListeners(router);
    return cleanup;
  }, []);



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