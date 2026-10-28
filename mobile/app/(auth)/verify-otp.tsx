/**
 * Flow 2: Registration — OTP Verification
 */
import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, Platform, KeyboardAvoidingView, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function VerifyOtpScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
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
    if (!trimmedOtp || trimmedOtp.length !== 6) {
      setError(t('auth.enterCode'));
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
        await AsyncStorage.setItem('token', data.access_token);
        router.replace('/(people)/dashboard');
      } else {
        setOtp('');
        setError(res.status === 400 ? t('auth.invalidCredentials') : (data.detail || t('common.error')));
        inputRef.current?.focus();
      }
    } catch {
      setError(t('auth.connectionError'));
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
        setSuccessMsg(t('common.success'));
        setOtp('');
        inputRef.current?.focus();
      } else {
        setError(res.status === 429 ? t('auth.accountLocked') : (data.detail || t('common.error')));
      }
    } catch {
      setError(t('auth.connectionError'));
    } finally {
      setResending(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
        >
          <View style={[styles.iconCircle, { backgroundColor: theme.successLight }]}>
            <Ionicons name="shield-checkmark-outline" size={36} color={theme.success} />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {t('auth.verifyOtp')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {t('auth.otpSentTo')} {email || ''}
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

            <TouchableOpacity
              style={[
                styles.verifyButton,
                { backgroundColor: theme.brandActive },
                Platform.OS === 'web' ? { boxShadow: `0 4px 8px ${theme.brandActive}40` } : { shadowColor: theme.brandActive },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleVerify}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>{t('auth.verifyOtp')}</Text>
              )}
            </TouchableOpacity>

            <View style={styles.resendRow}>
              <TouchableOpacity onPress={handleResendOtp} disabled={resending} activeOpacity={0.7}>
                {resending ? (
                  <ActivityIndicator size="small" color={theme.brandActive} />
                ) : (
                  <Text style={[styles.resendLink, { color: theme.brandActive }]}>
                    {t('auth.resendOtp')}
                  </Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32, justifyContent: 'center', alignItems: 'center' },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
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
  resendLink: { fontSize: 13, fontFamily: Fonts.bold, textDecorationLine: 'underline' },
});