

import React, { useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Slot, useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useNetworkSync } from '../hooks/useNetworkSync';
import { initDB } from '../services/offlineStorage';
import {
  registerForPushNotifications,
  setupNotificationListeners,
} from '../services/notificationService';

export default function RootLayout() {
  const { isOnline } = useNetworkSync();
  const router = useRouter();

  useEffect(() => {
    initDB();
    registerForPushNotifications();
    const cleanup = setupNotificationListeners(router);
    return cleanup;
  }, []);

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
  },
  offlineBanner: {
    backgroundColor: '#000',
    height: 28,
    justifyContent: 'center',
    alignItems: 'center',
  },
  offlineText: {
    color: '#FFF',
    fontSize: 12,
    textAlign: 'center',
  },
});