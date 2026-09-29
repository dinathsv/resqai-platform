
/**
 * Flow 2: Registration — OTP Verification
 * 5. User enters OTP code
 * 6. Backend verifies OTP
 *    alt [OTP valid]   → save user → login success → show dashboard
 *    alt [OTP invalid] → show error & allow retry (resend OTP)
 */

import React, { useState, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts, Glass } from '../../constants/theme';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { userId, email } = useLocalSearchParams() as { userId: string; email: string };
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  const handleVerify = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      setError('Please enter the 6-digit OTP code');
      return;
    }

    setError('');
    setSuccessMsg('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/verify-otp', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId, otp: trimmedOtp }),
      });

      const data = await res.json();

      if (res.ok) {
        // OTP valid → account created → login success → show dashboard
        await AsyncStorage.setItem('token', data.access_token);
        router.replace('/(people)/dashboard');
      } else {
        // OTP invalid → show error & allow retry
        setOtp('');
        if (res.status === 400) {
          setError('Invalid or expired OTP. Please check the code or request a new one.');
        } else {
          setError(data.detail || 'Verification failed. Please try again.');
        }
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('OTP verify error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const handleResendOtp = async () => {
    setError('');
    setSuccessMsg('');
    setResending(true);

    try {
      const res = await apiFetch('/api/auth/resend-otp', {
        method: 'POST',
        body: JSON.stringify({ user_id: userId }),
      });

      const data = await res.json();

      if (res.ok) {
        setSuccessMsg('A new OTP has been sent to your phone');
        setOtp('');
        inputRef.current?.focus();
      } else {
        if (res.status === 429) {
          setError('Too many resend attempts. Please wait a few minutes.');
        } else {
          setError(data.detail || 'Failed to resend OTP');
        }
      }
    } catch (err) {
      console.error('Resend OTP error:', err);
      setError('Connection error. Please try again.');
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.content}>
        <View style={styles.iconCircle}>
          <Text style={styles.iconText}>📱</Text>
        </View>

        <Text style={styles.title}>Verify Your Account</Text>
        <Text style={styles.subtitle}>
          We've sent a 6-digit OTP to your phone.{'\n'}
          {email ? `Registered email: ${email}` : ''}
        </Text>

        <View style={styles.card}>
          {error ? (
            <View style={styles.errorBox}>
              <Text style={styles.errorText}>⚠ {error}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={styles.successBox}>
              <Text style={styles.successText}>✓ {successMsg}</Text>
            </View>
          ) : null}

          <TextInput
            ref={inputRef}
            style={styles.otpInput}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={Colors.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            editable={!loading}
            autoFocus
            onSubmitEditing={handleVerify}
          />

          <TouchableOpacity
            style={[styles.verifyButton, loading && styles.buttonDisabled]}
            onPress={handleVerify}
            disabled={loading}
            activeOpacity={0.7}
          >
            {loading ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <Text style={styles.verifyButtonText}>Verify OTP</Text>
            )}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={styles.resendLabel}>Didn't receive the code?</Text>
            <TouchableOpacity
              onPress={handleResendOtp}
              disabled={resending}
              activeOpacity={0.7}
            >
              {resending ? (
                <ActivityIndicator size="small" color={Colors.accent} />
              ) : (
                <Text style={styles.resendLink}>Resend OTP</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  content: {
    flex: 1,
    paddingHorizontal: 24,
    justifyContent: 'center',
    alignItems: 'center',
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
    marginBottom: 28,
  },
  card: {
    ...Glass.card,
    padding: 28,
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
  successBox: {
    backgroundColor: 'rgba(0, 201, 71, 0.08)',
    borderRadius: 10,
    padding: 12,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: 'rgba(0, 201, 71, 0.15)',
  },
  successText: {
    color: Colors.success,
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
  },
  otpInput: {
    ...Glass.input,
    paddingVertical: 16,
    paddingHorizontal: 20,
    fontSize: 28,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: 8,
    marginBottom: 20,
  },
  verifyButton: {
    backgroundColor: Colors.cta,
    paddingVertical: 14,
    borderRadius: 12,
    alignItems: 'center',
    shadowColor: Colors.cta,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
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
  resendRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 24,
    gap: 6,
  },
  resendLabel: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
  },
  resendLink: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.accent,
    textDecorationLine: 'underline',
  },
});
