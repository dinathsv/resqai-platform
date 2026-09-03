
/**
 * Flow 1: User Login (returning user)
 * 1. User enters email and password
 * 2. Backend checks credentials against Database
 * 3. alt [valid] → login success → show dashboard
 *    alt [invalid] → show error message
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts, Glass } from '../../constants/theme';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();

    if (!trimmedEmail || !trimmedPassword) {
      setError('Please enter both email and password');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      });

      const data = await res.json();

      if (res.ok) {
        // Login success → store token → show dashboard
        await AsyncStorage.setItem('token', data.access_token);
        router.replace('/(people)/dashboard');
      } else {
        // Credentials invalid → show error message
        if (res.status === 401) {
          setError('Invalid email or password');
        } else if (res.status === 403) {
          setError('Account not verified. Please complete OTP verification.');
        } else if (res.status === 429) {
          setError('Too many failed attempts. Account locked for 15 minutes.');
        } else {
          setError(data.detail || 'Login failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Login error:', err);
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
        <ScrollView
          contentContainerStyle={styles.scrollContent}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.logoSection}>
            <View style={styles.badgeWrapper}>
              <View style={styles.brandIconCircle}>
                <Text style={styles.brandIcon}>🛡️</Text>
              </View>
              <Text style={styles.brandTag}>RESQAI NETWORK</Text>
            </View>
            <View style={styles.titleRow}>
              <Text style={styles.logoTextPrimary}>ResQ</Text>
              <Text style={styles.logoTextAccent}>AI</Text>
            </View>
            <Text style={styles.tagline}>Rapid Triage & Emergency Response</Text>
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Sign In</Text>
            <Text style={styles.cardSubtitle}>Access your emergency contact portal</Text>

            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email Address</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="citizen@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="••••••••••••"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                editable={!loading}
                onSubmitEditing={handleLogin}
              />
            </View>

            <TouchableOpacity
              style={[styles.loginButton, loading && styles.buttonDisabled]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.loginButtonText}>Sign In</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.linkButton}
              onPress={() => router.push('/(auth)/register')}
              activeOpacity={0.7}
            >
              <Text style={styles.linkText}>
                Need to register? <Text style={styles.linkBold}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.guestButton}
            onPress={() => router.push('/(auth)/guest')}
            activeOpacity={0.7}
          >
            <Text style={styles.guestText}>Continue as Anonymous Guest</Text>
          </TouchableOpacity>
        </ScrollView>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 36,
  },
  logoSection: {
    alignItems: 'center',
    marginBottom: 28,
  },
  badgeWrapper: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surfaceLight,
    paddingVertical: 4,
    paddingHorizontal: 10,
    borderRadius: 20,
    marginBottom: 10,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  brandIconCircle: {
    marginRight: 6,
  },
  brandIcon: {
    fontSize: 14,
  },
  brandTag: {
    fontSize: 11,
    fontFamily: Fonts.bold,
    color: Colors.slateMuted,
    letterSpacing: 0.8,
  },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  logoTextPrimary: {
    fontSize: 38,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  logoTextAccent: {
    fontSize: 38,
    fontFamily: Fonts.bold,
    color: Colors.accent,
    letterSpacing: -0.5,
  },
  tagline: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.slateMuted,
    marginTop: 4,
  },
  card: {
    ...Glass.card,
    padding: 24,
    marginBottom: 16,
  },
  cardTitle: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  cardSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.slateMuted,
    textAlign: 'center',
    marginTop: 2,
    marginBottom: 20,
  },
  errorBox: {
    backgroundColor: '#FFF1F2',
    borderRadius: 12,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: '#FECDD3',
  },
  errorText: {
    color: Colors.accent,
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  inputGroup: {
    marginBottom: 16,
  },
  label: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginBottom: 6,
  },
  input: {
    ...Glass.input,
    paddingVertical: 12,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  loginButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  loginButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 18,
  },
  linkText: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  linkBold: {
    fontFamily: Fonts.bold,
    color: Colors.accent,
  },
  guestButton: {
    alignItems: 'center',
    paddingVertical: 13,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: Colors.borderDark,
    backgroundColor: Colors.surface,
  },
  guestText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.textSecondary,
  },
});

