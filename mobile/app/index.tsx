

import React, { useEffect, useState } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors } from '../constants/theme';
import { getToken } from '../config/api';

/**
 * Entry point: check for stored auth token.
 * - If token exists → go to dashboard
 * - If no token → go to login
 */
export default function Index() {
  const router = useRouter();
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    async function checkAuth() {
      try {
        const token = await getToken();

        if (token) {
          router.replace('/(people)/dashboard');
        } else {
          router.replace('/(auth)/login');
        }
      } catch {
        router.replace('/(auth)/login');
      } finally {
        setChecking(false);
      }
    }
    checkAuth();
  }, []);

  if (checking) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={Colors.accent} />
      </View>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
