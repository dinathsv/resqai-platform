/**
 * Flow 1: User Login (returning user)
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch, parseErrorResponse } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSelector from '../../components/LanguageSelector';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t, setLanguage } = useLanguage();
  const glass = useMemo(() => makeGlass(theme), [theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) {
      setError(t('auth.requiredFields'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }),
      });
      if (res.ok) {
        const data = await res.json();
        await AsyncStorage.setItem('token', data.access_token);
        // If user has a saved language preference in backend, apply it
        if (data.user?.language_pref && (data.user.language_pref === 'en' || data.user.language_pref === 'ta' || data.user.language_pref === 'si')) {
          await setLanguage(data.user.language_pref);
        }
        router.replace('/(people)/dashboard');
      } else {
        if (res.status === 401) setError(t('auth.invalidCredentials'));
        else if (res.status === 429) setError(t('auth.accountLocked'));
        else if (res.status === 503) setError(t('auth.connectionError'));
        else {
          const errorMsg = await parseErrorResponse(res);
          setError(errorMsg);
        }
      }
    } catch (err) {
      console.error('Login error:', err);
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          <View style={styles.logoSection}>
            <Image 
              source={require('../../assets/resqai_logo.png')} 
              style={{ width: 130, height: 130, marginBottom: 12 }} 
              resizeMode="contain" 
            />
            <Text style={[styles.appTitle, { color: theme.textPrimary }]}>
              {t('common.appName')}
            </Text>
            <Text style={[styles.appSubtitle, { color: theme.textMuted }]}>
              {t('common.appTagline')}
            </Text>
          </View>

          <View style={[styles.card, glass.card]}>
            {/* Trilingual Language Selector during onboarding */}
            <LanguageSelector variant="segmented" style={{ marginBottom: 16 }} />

            <Text style={[styles.cardTitle, { color: theme.textPrimary, marginBottom: 20 }]}>
              {t('auth.signIn')}
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
                <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>
                  ⚠ {error}
                </Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t('auth.emailAddress')}
              </Text>
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
              />
            </View>

            <View style={styles.inputGroup}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <Text style={[styles.label, { color: theme.textSecondary, marginBottom: 0 }]}>
                  {t('auth.password')}
                </Text>
                <TouchableOpacity onPress={() => router.push('/(auth)/forgot-password')} activeOpacity={0.7}>
                  <Text style={[styles.linkBold, { color: theme.brandActive, fontSize: 12 }]}>
                    {t('auth.forgotPassword')}
                  </Text>
                </TouchableOpacity>
              </View>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary, paddingRight: 40 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder="••••••••••••"
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                  onSubmitEditing={handleLogin}
                />
                <TouchableOpacity style={{ position: 'absolute', right: 14 }} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[
                styles.loginButton,
                { backgroundColor: theme.brandActive },
                Platform.OS === 'web' ? { boxShadow: `0 4px 8px ${theme.brandActive}40` } : { shadowColor: theme.brandActive },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.loginButtonText}>{t('auth.signIn')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
              <Text style={[styles.linkText, { color: theme.brandActive }]}>
                {t('auth.needAccount')}
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity
            style={[
              styles.guestButton,
              { borderColor: theme.border, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,79,67,0.05)' },
            ]}
            onPress={() => router.push('/(auth)/guest')}
            activeOpacity={0.7}
          >
            <Text style={[styles.guestText, { color: theme.textPrimary }]}>
              {t('auth.guestSignIn')}
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  logoSection: { alignItems: 'center', marginBottom: 20 },
  appTitle: { fontSize: 26, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  appSubtitle: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginTop: 4, paddingHorizontal: 16 },
  card: { padding: 22, marginBottom: 16, borderRadius: 12 },
  cardTitle: { fontSize: 20, fontFamily: Fonts.bold, textAlign: 'center' },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.semiBold, borderRadius: 8, borderWidth: 1 },
  loginButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
  linkButton: { alignItems: 'center', marginTop: 16 },
  linkText: { fontSize: 13, fontFamily: Fonts.semiBold, textAlign: 'center' },
  linkBold: { fontFamily: Fonts.bold },
  guestButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 8, borderWidth: 1 },
  guestText: { fontSize: 14, fontFamily: Fonts.semiBold },
});