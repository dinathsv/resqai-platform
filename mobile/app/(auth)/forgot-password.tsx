import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const glass = useMemo(() => makeGlass(theme), [theme]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) { setError('Email is required'); return; }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) { setError('Please enter a valid email'); return; }

    setError('');
    setSuccess('');
    setLoading(true);

    try {
      const res = await apiFetch('/api/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail }),
      });
      
      const data = await res.json();
      
      if (res.ok) {
        setSuccess('OTP has been sent');
        // Small delay to show success message before navigating
        setTimeout(() => {
          router.push({
            pathname: '/(auth)/reset-password',
            params: { email: trimmedEmail }
          });
        }, 1500);
      } else {
        setError(data.detail || 'Failed to request password reset');
      }
    } catch (err) {
      setError('Connection error. Please try again later.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
          
          <View style={styles.headerSection}>
            <View style={[styles.iconCircle, { backgroundColor: theme.accentLight }]}>
              <Text style={styles.iconText}>🔐</Text>
            </View>
            <Text style={[styles.title, { color: theme.textPrimary }]}>Forgot Password</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              Enter your registered email address and we'll send you an OTP to reset your password.
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
              <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={email} onChangeText={setEmail} placeholder="citizen@example.com"
                placeholderTextColor={theme.textMuted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!loading} onSubmitEditing={handleRequestReset} />
            </View>

            <TouchableOpacity style={[styles.actionButton, { backgroundColor: theme.brandActive, shadowColor: theme.brandActive }, loading && styles.buttonDisabled]}
              onPress={handleRequestReset} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.actionButtonText}>Send OTP</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => router.back()} activeOpacity={0.7} disabled={loading}>
              <Text style={[styles.linkText, { color: theme.textMuted }]}>
                Remember your password? <Text style={[styles.linkBold, { color: theme.brandActive }]}>Sign In</Text>
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
  actionButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 4 },
  buttonDisabled: { opacity: 0.6 },
  actionButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
  linkButton: { alignItems: 'center', marginTop: 24 },
  linkText: { fontSize: 13, fontFamily: Fonts.regular },
  linkBold: { fontFamily: Fonts.bold },
});
