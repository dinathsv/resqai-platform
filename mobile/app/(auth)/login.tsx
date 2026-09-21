/**
 * Flow 1: User Login (returning user)
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet, Image,
  SafeAreaView, KeyboardAvoidingView, Platform, ActivityIndicator, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function LoginScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const glass = useMemo(() => makeGlass(theme), [theme]);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleLogin = async () => {
    const trimmedEmail = email.trim();
    const trimmedPassword = password.trim();
    if (!trimmedEmail || !trimmedPassword) { setError('Please enter both email and password'); return; }
    setError(''); setLoading(true);
    try {
      const res = await apiFetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email: trimmedEmail, password: trimmedPassword }) });
      const data = await res.json();
      if (res.ok) {
        await AsyncStorage.setItem('token', data.access_token);
        router.replace('/(people)/dashboard');
      } else {
        if (res.status === 401) setError('Invalid email or password');
        else if (res.status === 403) setError('Account not verified. Please complete OTP verification.');
        else if (res.status === 429) setError('Too many failed attempts. Account locked for 15 minutes.');
        else {
          const detail = data.detail;
          if (typeof detail === 'string') setError(detail);
          else if (Array.isArray(detail)) setError(detail.map((d: any) => d.msg || JSON.stringify(d)).join('; '));
          else if (detail && typeof detail === 'object') setError(detail.msg || JSON.stringify(detail));
          else setError('Login failed. Please try again.');
        }
      }
    } catch (err) { console.error('Login error:', err); setError('Connection error. Please check your internet connection.'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={styles.logoSection}>
            <Image 
              source={require('../../assets/resqai_logo.png')} 
              style={{ width: 140, height: 140, marginBottom: 16 }} 
              resizeMode="contain" 
            />
            <Text style={[styles.tagline, { color: theme.textSecondary }]}>Rapid Triage & Emergency Response</Text>
          </View>

          <View style={[styles.card, glass.card]}>
            <Text style={[styles.cardTitle, { color: theme.textPrimary }]}>Sign In</Text>
            <Text style={[styles.cardSubtitle, { color: theme.textMuted }]}>Access your emergency contact portal</Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
                <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>⚠ {error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Email Address</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={email} onChangeText={setEmail} placeholder="citizen@example.com"
                placeholderTextColor={theme.textMuted} keyboardType="email-address" autoCapitalize="none" autoCorrect={false} editable={!loading} />
            </View>

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>Password</Text>
              <TextInput style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={password} onChangeText={setPassword} placeholder="••••••••••••"
                placeholderTextColor={theme.textMuted} secureTextEntry editable={!loading} onSubmitEditing={handleLogin} />
            </View>

            <TouchableOpacity style={[styles.loginButton, { backgroundColor: theme.brandActive, shadowColor: theme.brandActive }, loading && styles.buttonDisabled]}
              onPress={handleLogin} disabled={loading} activeOpacity={0.8}>
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.loginButtonText}>Sign In</Text>}
            </TouchableOpacity>

            <TouchableOpacity style={styles.linkButton} onPress={() => router.push('/(auth)/register')} activeOpacity={0.7}>
              <Text style={[styles.linkText, { color: theme.textMuted }]}>
                Need to register? <Text style={[styles.linkBold, { color: theme.brandActive }]}>Create Account</Text>
              </Text>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={[styles.guestButton, { borderColor: theme.border, backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(22,79,67,0.05)' }]}
            onPress={() => router.push('/(auth)/guest')} activeOpacity={0.7}>
            <Text style={[styles.guestText, { color: theme.textPrimary }]}>Continue as Anonymous Guest</Text>
          </TouchableOpacity>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  scrollContent: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingVertical: 36 },
  logoSection: { alignItems: 'center', marginBottom: 28 },
  badgeWrapper: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, paddingHorizontal: 12, borderRadius: 20, marginBottom: 10, borderWidth: 1 },
  brandIconCircle: { marginRight: 6 },
  brandIcon: { fontSize: 14 },
  brandTag: { fontSize: 11, fontFamily: Fonts.bold, letterSpacing: 0.8 },
  titleRow: { flexDirection: 'row', alignItems: 'center' },
  logoTextPrimary: { fontSize: 38, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  logoTextAccent: { fontSize: 38, fontFamily: Fonts.bold, letterSpacing: -0.5 },
  tagline: { fontSize: 14, fontFamily: Fonts.semiBold, marginTop: 4 },
  card: { padding: 24, marginBottom: 16, borderRadius: 12 },
  cardTitle: { fontSize: 20, fontFamily: Fonts.bold, textAlign: 'center' },
  cardSubtitle: { fontSize: 13, fontFamily: Fonts.semiBold, textAlign: 'center', marginTop: 2, marginBottom: 20 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  inputGroup: { marginBottom: 16 },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.semiBold, borderRadius: 8, borderWidth: 1 },
  loginButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  loginButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
  linkButton: { alignItems: 'center', marginTop: 18 },
  linkText: { fontSize: 13, fontFamily: Fonts.regular },
  linkBold: { fontFamily: Fonts.bold },
  guestButton: { alignItems: 'center', paddingVertical: 12, borderRadius: 8, borderWidth: 1 },
  guestText: { fontSize: 14, fontFamily: Fonts.bold },
});