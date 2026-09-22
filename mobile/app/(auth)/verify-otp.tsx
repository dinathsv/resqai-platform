/**
 * Flow 2: Registration — OTP Verification
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const glass = useMemo(() => makeGlass(theme), [theme]);
  const { userId, email } = useLocalSearchParams() as { userId: string; email: string };
  const [otp, setOtp] = useState('');
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const inputRef = useRef<React.ElementRef<typeof TextInput>>(null);

  const handleVerify = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) { setError('Please enter the 6-digit OTP code'); return; }
    setError(''); setSuccessMsg(''); setLoading(true);
    try {
      const res = await apiFetch('/api/auth/verify-otp', { method: 'POST', body: JSON.stringify({ user_id: userId, otp: trimmedOtp }) });
      const data = await res.json();
      if (res.ok) { await AsyncStorage.setItem('token', data.access_token); router.replace('/(people)/dashboard'); }
      else {
        setOtp('');
        setError(res.status === 400 ? 'Invalid or expired OTP. Please check the code or request a new one.' : (data.detail || 'Verification failed. Please try again.'));
        inputRef.current?.focus();
      }
    } catch { setError('Connection error. Please try again.'); }
    finally { setLoading(false); }
  };

  const handleResendOtp = async () => {
    setError(''); setSuccessMsg(''); setResending(true);
    try {
      const res = await apiFetch('/api/auth/resend-otp', { method: 'POST', body: JSON.stringify({ user_id: userId }) });
      const data = await res.json();
      if (res.ok) { setSuccessMsg('A new OTP has been sent to your phone'); setOtp(''); inputRef.current?.focus(); }
      else setError(res.status === 429 ? 'Too many resend attempts. Please wait a few minutes.' : (data.detail || 'Failed to resend OTP'));
    } catch { setError('Connection error. Please try again.'); }
    finally { setResending(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <View style={styles.content}>
        <View style={[styles.iconCircle, { backgroundColor: theme.successLight }]}>
          <Ionicons name="shield-checkmark-outline" size={36} color={theme.success} />
        </View>

        <Text style={[styles.title, { color: theme.textPrimary }]}>Verify Your Account</Text>
        <Text style={[styles.subtitle, { color: theme.textMuted }]}>
          We've sent a 6-digit OTP to your phone.{'\n'}
          {email ? `Registered email: ${email}` : ''}
        </Text>

        <View style={[styles.card, glass.card]}>
          {error ? (
            <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
              <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>⚠ {error}</Text>
            </View>
          ) : null}

          {successMsg ? (
            <View style={[styles.successBox, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
              <Text style={[styles.successText, { color: theme.isDark ? '#FFFFFF' : theme.success }]}>✓ {successMsg}</Text>
            </View>
          ) : null}

          <TextInput
            ref={inputRef}
            style={[styles.otpInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
            value={otp}
            onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
            placeholder="000000"
            placeholderTextColor={theme.textMuted}
            keyboardType="number-pad"
            maxLength={6}
            textAlign="center"
            editable={!loading}
            autoFocus
            onSubmitEditing={handleVerify}
          />

          <TouchableOpacity style={[styles.verifyButton, { backgroundColor: theme.brandActive, shadowColor: theme.brandActive }, loading && styles.buttonDisabled]}
            onPress={handleVerify} disabled={loading} activeOpacity={0.7}>
            {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.verifyButtonText}>Verify OTP</Text>}
          </TouchableOpacity>

          <View style={styles.resendRow}>
            <Text style={[styles.resendLabel, { color: theme.textMuted }]}>Didn't receive the code?</Text>
            <TouchableOpacity onPress={handleResendOtp} disabled={resending} activeOpacity={0.7}>
              {resending ? <ActivityIndicator size="small" color={theme.brandActive} /> : <Text style={[styles.resendLink, { color: theme.brandActive }]}>Resend OTP</Text>}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  iconText: { fontSize: 36 },
  title: { fontSize: 24, fontFamily: Fonts.bold, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20, marginBottom: 28 },
  card: { padding: 24, width: '100%', borderRadius: 12 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center' },
  successBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  successText: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center' },
  otpInput: { paddingVertical: 12, paddingHorizontal: 16, fontSize: 24, fontFamily: Fonts.bold, letterSpacing: 6, marginBottom: 20, borderRadius: 8, borderWidth: 1 },
  verifyButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  verifyButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: Fonts.bold },
  resendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', marginTop: 24, gap: 6 },
  resendLabel: { fontSize: 13, fontFamily: Fonts.regular },
  resendLink: { fontSize: 13, fontFamily: Fonts.bold, textDecorationLine: 'underline' },
});