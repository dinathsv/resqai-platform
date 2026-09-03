
/**
 * Flow 2: Registration (new account)
 * 1. User enters details (name, password, phone, NIC)
 * 2. Backend starts registration
 * 3. Backend sends OTP to phone via Notification System
 * → navigate to OTP verification screen
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
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts, Glass } from '../../constants/theme';

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');

    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError('Please fill in all required fields');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({
          full_name: fullName.trim(),
          email: email.trim(),
          phone_number: phone.trim() || null,
          password: password,
        }),
      });

      const data = await res.json();

      if (res.ok) {
        // Registration started → OTP sent → navigate to OTP screen
        router.push({
          pathname: '/(auth)/verify-otp',
          params: { userId: data.user_id, email: email.trim() },
        });
      } else {
        if (res.status === 409) {
          setError('An account with this email already exists');
        } else {
          setError(data.detail || 'Registration failed. Please try again.');
        }
      }
    } catch (err) {
      console.error('Register error:', err);
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
          <Text style={styles.headerTitle}>Create Account</Text>
          <Text style={styles.subtitle}>
            Register to access all ResQAI features
          </Text>

          <View style={styles.card}>
            {error ? (
              <View style={styles.errorBox}>
                <Text style={styles.errorText}>⚠ {error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Full Name *</Text>
              <TextInput
                style={styles.input}
                value={fullName}
                onChangeText={setFullName}
                placeholder="Enter your full name"
                placeholderTextColor={Colors.textMuted}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Email *</Text>
              <TextInput
                style={styles.input}
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={Colors.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Phone Number</Text>
              <TextInput
                style={styles.input}
                value={phone}
                onChangeText={setPhone}
                placeholder="+94 7X XXX XXXX"
                placeholderTextColor={Colors.textMuted}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Password *</Text>
              <TextInput
                style={styles.input}
                value={password}
                onChangeText={setPassword}
                placeholder="At least 6 characters"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={styles.label}>Confirm Password *</Text>
              <TextInput
                style={styles.input}
                value={confirmPassword}
                onChangeText={setConfirmPassword}
                placeholder="Re-enter your password"
                placeholderTextColor={Colors.textMuted}
                secureTextEntry
                editable={!loading}
                onSubmitEditing={handleRegister}
              />
            </View>

            <TouchableOpacity
              style={[styles.registerButton, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.registerButtonText}>Register</Text>
              )}
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={styles.linkButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Text style={styles.linkText}>
              Already have an account? <Text style={styles.linkBold}>Sign In</Text>
            </Text>
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
    paddingHorizontal: 24,
    paddingVertical: 32,
  },
  headerTitle: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.accent,
    marginBottom: 6,
  },
  subtitle: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginBottom: 24,
  },
  card: {
    ...Glass.card,
    padding: 24,
    marginBottom: 20,
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
    marginBottom: 14,
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
    fontSize: 16,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  registerButton: {
    backgroundColor: Colors.cta,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: 8,
    shadowColor: Colors.cta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  registerButtonText: {
    color: Colors.white,
    fontSize: 16,
    fontFamily: Fonts.bold,
  },
  linkButton: {
    alignItems: 'center',
    paddingVertical: 8,
  },
  linkText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  linkBold: {
    fontFamily: Fonts.bold,
    color: Colors.accent,
  },
});
