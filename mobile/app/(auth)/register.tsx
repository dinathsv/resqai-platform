/**
 * Flow 2: Registration (new account)
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSelector from '../../components/LanguageSelector';

export default function RegisterScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { language, t } = useLanguage();
  const glass = useMemo(() => makeGlass(theme), [theme]);
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRegister = async () => {
    setError('');
    if (!fullName.trim() || !email.trim() || !password.trim()) {
      setError(t('auth.requiredFields'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('auth.passwordMismatch'));
      return;
    }
    if (password.length < 6) {
      setError(t('auth.passwordLength'));
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
          password,
          language_pref: language,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        router.push({ pathname: '/(auth)/verify-otp', params: { userId: data.user_id, email: email.trim() } });
      } else {
        if (res.status === 409) setError(t('auth.invalidCredentials'));
        else setError(typeof data.detail === 'string' ? data.detail : t('common.error'));
      }
    } catch (err) {
      console.error('Register error:', err);
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <Image 
              source={require('../../assets/resqai_logo.png')} 
              style={{ width: 130, height: 130, marginBottom: 12 }} 
              resizeMode="contain" 
            />
            <Text style={[styles.appTitle, { color: theme.textPrimary }]}>
              {t('common.appName')}
            </Text>
            <Text style={[styles.appSubtitle, { color: theme.textMuted }]}>
              {t('auth.registerCitizen')}
            </Text>
          </View>

          <View style={[styles.card, glass.card]}>
            <LanguageSelector variant="segmented" style={{ marginBottom: 16 }} />

            <Text style={[styles.headerTitle, { color: theme.textPrimary, textAlign: 'center', marginBottom: 20 }]}>
              {t('auth.register')}
            </Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
                <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>⚠ {error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t('auth.fullName')} *</Text>
              <TextInput
                style={[styles.input, inputStyle]}
                value={fullName}
                onChangeText={setFullName}
                placeholder={t('auth.fullNamePlaceholder')}
                placeholderTextColor={theme.textMuted}
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t('auth.emailAddress')} *</Text>
              <TextInput
                style={[styles.input, inputStyle]}
                value={email}
                onChangeText={setEmail}
                placeholder={t('auth.emailPlaceholder')}
                placeholderTextColor={theme.textMuted}
                keyboardType="email-address"
                autoCapitalize="none"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t('auth.phone')}</Text>
              <TextInput
                style={[styles.input, inputStyle]}
                value={phone}
                onChangeText={setPhone}
                placeholder={t('auth.phonePlaceholder')}
                placeholderTextColor={theme.textMuted}
                keyboardType="phone-pad"
                editable={!loading}
              />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t('auth.password')} *</Text>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={[styles.input, inputStyle, { paddingRight: 40 }]}
                  value={password}
                  onChangeText={setPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showPassword}
                  editable={!loading}
                />
                <TouchableOpacity style={{ position: 'absolute', right: 14 }} onPress={() => setShowPassword(!showPassword)}>
                  <Ionicons name={showPassword ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>{t('auth.confirmPassword')} *</Text>
              <View style={{ position: 'relative', justifyContent: 'center' }}>
                <TextInput
                  style={[styles.input, inputStyle, { paddingRight: 40 }]}
                  value={confirmPassword}
                  onChangeText={setConfirmPassword}
                  placeholder={t('auth.passwordPlaceholder')}
                  placeholderTextColor={theme.textMuted}
                  secureTextEntry={!showConfirmPassword}
                  editable={!loading}
                />
                <TouchableOpacity style={{ position: 'absolute', right: 14 }} onPress={() => setShowConfirmPassword(!showConfirmPassword)}>
                  <Ionicons name={showConfirmPassword ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
                </TouchableOpacity>
              </View>
            </View>

            <TouchableOpacity
              style={[styles.registerButton, { backgroundColor: theme.brandActive, shadowColor: theme.brandActive }, loading && styles.buttonDisabled]}
              onPress={handleRegister}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.registerButtonText}>{t('auth.register')}</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(auth)/login')} activeOpacity={0.7}>
              <Text style={[styles.linkText, { color: theme.brandActive }]}>
                {t('auth.haveAccount')}
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
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 28 },
  appTitle: { fontSize: 26, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  appSubtitle: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginTop: 4 },
  card: { padding: 22, marginBottom: 16, borderRadius: 12 },
  headerTitle: { fontSize: 20, fontFamily: Fonts.bold },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.semiBold, borderRadius: 8, borderWidth: 1 },
  registerButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  registerButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
  linkButton: { alignItems: 'center', marginTop: 16 },
  linkText: { fontSize: 13, fontFamily: Fonts.semiBold },
});