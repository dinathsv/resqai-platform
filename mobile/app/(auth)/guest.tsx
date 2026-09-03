
/**
 * Flow 4: Guest user asking for help
 * 1. User opens app as guest → requests guest access
 * 2. User enters NIC number → Backend verifies NIC
 *    alt [NIC valid]   → NIC verified → show help center (dashboard)
 *    alt [NIC invalid] → NIC verification failed → show error message
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import * as Location from 'expo-location';
import { apiFetch } from '../../config/api';
import { Colors, Fonts, Glass } from '../../constants/theme';

export default function GuestScreen() {
  const router = useRouter();
  const [nic, setNic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyNic = async () => {
    const trimmedNic = nic.trim();

    if (!trimmedNic) {
      setError('Please enter your NIC number');
      return;
    }

    // Client-side format check: old format (9 digits + V/X) or new format (12 digits)
    const nicRegex = /^[0-9]{9}[VvXx]$|^[0-9]{12}$/;
    if (!nicRegex.test(trimmedNic)) {
      setError('Invalid NIC format. Use old format (e.g. 123456789V) or new format (12 digits)');
      return;
    }

    setError('');
    setLoading(true);

    try {
      // Try to get location for the guest session
      let lat: number | null = null;
      let lng: number | null = null;

      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const location = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.Balanced,
          });
          lat = location.coords.latitude;
          lng = location.coords.longitude;
        }
      } catch {
        // Location not critical for guest NIC verification
      }

      const res = await apiFetch('/api/auth/guest/verify-nic', {
        method: 'POST',
        body: JSON.stringify({
          nic_number: trimmedNic,
          lat,
          lng,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // NIC valid → store guest token → show dashboard/help center
        await AsyncStorage.setItem('guest_token', data.access_token);
        router.replace('/(people)/dashboard');
      } else {
        // NIC invalid → show error message
        if (res.status === 400) {
          if (data.detail?.includes('format')) {
            setError('Invalid NIC format. Please check and try again.');
          } else if (data.detail?.includes('registry')) {
            setError('NIC not found in the national registry. Please check your number.');
          } else {
            setError(data.detail || 'NIC verification failed');
          }
        } else {
          setError(data.detail || 'Verification failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Guest NIC verify error:', err);
      setError('Connection error. Please check your internet connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <View style={styles.content}>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.backText}>← Back to Sign In</Text>
          </TouchableOpacity>

          <View style={styles.iconCircle}>
            <Text style={styles.iconText}>🪪</Text>
          </View>

          <Text style={styles.title}>Guest Access</Text>
          <Text style={styles.subtitle}>
            Enter your NIC number to access emergency help features without an account.
          </Text>

          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>NIC Number</Text>
              <TextInput
                style={styles.input}
                value={nic}
                onChangeText={setNic}
                placeholder="e.g. 200012345678 or 951234567V"
                placeholderTextColor={Colors.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleVerifyNic}
                maxLength={12}
              />
            </View>

            <TouchableOpacity
              style={[styles.verifyButton, loading && styles.buttonDisabled]}
              onPress={handleVerifyNic}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.verifyButtonText}>Verify & Continue</Text>
              )}
            </TouchableOpacity>

            <Text style={styles.disclaimer}>
              Guest sessions expire after 30 minutes.{'\n'}
              Register for full access to all features.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  flex: {
    flex: 1,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backLink: {
    alignSelf: 'flex-start',
    marginBottom: 24,
  },
  backText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.accent,
  },
  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: Colors.accentLight,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  iconText: {
    fontSize: 36,
  },
  title: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    textAlign: 'center',
    lineHeight: 20,
    marginBottom: 24,
  },
  card: {
    ...Glass.card,
    padding: 24,
    width: '100%',
  },
  errorBox: {
    backgroundColor: 'rgba(235, 0, 0, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(235, 0, 0, 0.15)',
  },
  errorText: {
    color: Colors.error,
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 20,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    ...Glass.input,
    paddingVertical: 14,
    paddingHorizontal: 14,
    fontSize: 18,
    fontFamily: Fonts.medium,
    color: Colors.textPrimary,
    letterSpacing: 1,
    textAlign: 'center',
  },
  verifyButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  verifyButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  disclaimer: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 20,
    lineHeight: 18,
  },
});
