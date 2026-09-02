

import React, { useEffect } from 'react';
import { View, Text, StyleSheet, ActivityIndicator } from 'react-native';
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

export default function RootLayout() {
  const { isOnline } = useNetworkSync();
  const router = useRouter();

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
      <View style={styles.loadingRoot}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
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
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: Colors.background,
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
});