import React, { useState, useRef, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function ResetPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const glass = useMemo(() => makeGlass(theme), [theme]);
  const { email } = useLocalSearchParams() as { email: string };

  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const passwordRef = useRef<React.ElementRef<typeof TextInput>>(null);

  const handleReset = async () => {
    const trimmedOtp = otp.trim();
    if (!trimmedOtp || trimmedOtp.length !== 6) { setError('Please enter the 6-digit OTP code'); return; }
    if (newPassword.length < 6) { setError('Password must be at least 6 characters'); return; }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({ email, otp: trimmedOtp, new_password: newPassword }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess('Password reset successfully!');
        setTimeout(() => {
          router.replace('/(auth)/login');
        }, 2000);
      } else {
        setError(data.detail || 'Invalid or expired OTP');
      }
    } catch (err) {
      setError('Connection error. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerSection}>
            <View style={[styles.iconCircle, { backgroundColor: theme.successLight }]}>
              <Text style={styles.iconText}>🛡️</Text>
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Set New Password</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Enter the 6-digit OTP sent to your phone/email and your new password.
            </Text>
          </View>

          <View style={[styles.card, glass.card]}>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
                <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>⚠ {error}</Text>
              </View>
            ) : null}

            {success ? (
              <View style={[styles.successBox, { backgroundColor: theme.successLight, borderColor: theme.success }]}>
                <Text style={[styles.successText, { color: theme.isDark ? '#FFFFFF' : theme.success }]}>✓ {success}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>6-Digit OTP</Text>
              <TextInput style={[styles.input, styles.otpInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={otp} onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, '').slice(0, 6))}
                placeholder="000000" placeholderTextColor={theme.textMuted} keyboardType="number-pad" maxLength={6}
                textAlign="center" editable={!loading} autoFocus onSubmitEditing={() => passwordRef.current?.focus()} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>New Password</Text>
              <TextInput ref={passwordRef} style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={newPassword} onChangeText={setNewPassword} placeholder="••••••••••••"
                placeholderTextColor={theme.textMuted} secureTextEntry editable={!loading} onSubmitEditing={handleReset} />
            </View>

            <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.brandActive, shadowColor: theme.brandActive }, loading && styles.buttonDisabled]}
              onPress={handleReset} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.actionButtonText}>Reset Password</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(auth)/login'); }} activeOpacity={0.7} disabled={loading}>
              <Text style={[styles.linkText, { color: theme.textMuted }]}>
                Cancel reset? <Text style={[styles.linkBold, { color: theme.brandActive }]}>Go Back</Text>
              </Text>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  headerSection: { alignItems: 'center', marginBottom: 28 },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  iconText: { fontSize: 36 },
  title: { fontSize: 24, fontFamily: Fonts.bold, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20, paddingHorizontal: 10 },
  card: { padding: 24, borderRadius: 12 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  successBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  successText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.semiBold, borderRadius: 8, borderWidth: 1 },
  otpInput: { fontSize: 24, fontFamily: Fonts.bold, letterSpacing: 6, paddingVertical: 14 },
  actionButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
  linkButton: { alignItems: 'center', marginTop: 24 },
  linkText: { fontSize: 13, fontFamily: Fonts.regular },
  linkBold: { fontFamily: Fonts.bold },
});
