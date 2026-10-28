import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, KeyboardAvoidingView, Platform, ScrollView, ActivityIndicator,
} from 'react-native';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';

export default function ForgotPasswordScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const glass = useMemo(() => makeGlass(theme), [theme]);

  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const handleRequestReset = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError(t('auth.requiredFields'));
      return;
    }
    if (!/\S+@\S+\.\S+/.test(trimmedEmail)) {
      setError(t('auth.invalidCredentials'));
      return;
    }

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
        setSuccess(t('common.success'));
        setTimeout(() => {
          router.push({
            pathname: '/(auth)/reset-password',
            params: { email: trimmedEmail }
          });
        }, 1500);
      } else {
        setError(data.detail || t('common.error'));
      }
    } catch {
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          <View style={[styles.card, glass.card]}>
            <Text style={[styles.title, { color: theme.textPrimary }]}>{t('auth.forgotPassword')}</Text>
            <Text style={[styles.subtitle, { color: theme.textMuted }]}>
              {t('auth.enterEmailForOtp')}
            </Text>

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
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t('auth.emailAddress')}</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={theme.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleRequestReset}
              />
            </View>

            <TouchableOpacity
              style={[
                styles.submitButton,
                { backgroundColor: theme.brandActive },
                Platform.OS === 'web' ? { boxShadow: `0 4px 8px ${theme.brandActive}40` } : { shadowColor: theme.brandActive },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleRequestReset}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.submitButtonText}>{t('common.submit')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={styles.backButton}
              onPress={() => router.back()}
              activeOpacity={0.7}
            >
              <Text style={[styles.backButtonText, { color: theme.brandActive }]}>
                ← {t('common.back')}
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
  card: { padding: 24, borderRadius: 12 },
  title: { fontSize: 22, fontFamily: Fonts.bold, textAlign: 'center', marginBottom: 8 },
  subtitle: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginBottom: 24 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  successBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  successText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.semiBold, borderRadius: 8, borderWidth: 1 },
  submitButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  submitButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
  backButton: { alignItems: 'center', marginTop: 18 },
  backButtonText: { fontSize: 13, fontFamily: Fonts.semiBold },
});
