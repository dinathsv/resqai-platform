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

export default function RegisterScreen() {
  const router = useRouter();
  const { theme } = useTheme();
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
    if (!fullName.trim() || !email.trim() || !password.trim()) { setError('Please fill in all required fields'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    setLoading(true);
    try {
      const res = await apiFetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ full_name: fullName.trim(), email: email.trim(), phone_number: phone.trim() || null, password }) });
      const data = await res.json();
      if (res.ok) {
        router.push({ pathname: '/(auth)/verify-otp', params: { userId: data.user_id, email: email.trim() } });
      } else {
        if (res.status === 409) setError('An account with this email already exists');
        else setError(typeof data.detail === 'string' ? data.detail : 'Registration failed. Please try again.');
      }
    } catch (err) { console.error('Register error:', err); setError('Connection error. Please check your internet connection.'); }
    finally { setLoading(false); }
  };

  const inputStyle = { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.scrollContent} keyboardShouldPersistTaps="handled">
          <View style={{ alignItems: 'center', marginBottom: 28 }}>
            <Image 
              source={require('../../assets/resqai_logo.png')} 
              style={{ width: 140, height: 140, marginBottom: 16 }} 
              resizeMode="contain" 
            />
          </View>

          <View style={[styles.card, glass.card]}>
            <Text style={[styles.headerTitle, { color: theme.textPrimary, textAlign: 'center', marginBottom: 20 }]}>Create Account</Text>

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
                <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>⚠ {error}</Text>
              </View>
            ) : null}

            {[
              { label: 'Full Name *', value: fullName, set: setFullName, placeholder: 'Enter your full name' },
              { label: 'Email *', value: email, set: setEmail, placeholder: 'you@example.com', keyboard: 'email-address' as const, capitalize: 'none' as const },
              { label: 'Phone Number', value: phone, set: setPhone, placeholder: '+94 7X XXX XXXX', keyboard: 'phone-pad' as const },
              { label: 'Password *', value: password, set: setPassword, placeholder: 'At least 6 characters', secure: true, isPassword: true, showState: showPassword, toggle: () => setShowPassword(!showPassword) },
              { label: 'Confirm Password *', value: confirmPassword, set: setConfirmPassword, placeholder: 'Re-enter your password', secure: true, isPassword: true, showState: showConfirmPassword, toggle: () => setShowConfirmPassword(!showConfirmPassword) },
            ].map((field) => (
              <View key={field.label} style={styles.inputGroup}>
                <Text style={[styles.label, { color: theme.textSecondary }]}>{field.label}</Text>
                {field.isPassword ? (
                  <View style={{ position: 'relative', justifyContent: 'center' }}>
                    <TextInput style={[styles.input, inputStyle, { paddingRight: 40 }]}
                      value={field.value} onChangeText={field.set} placeholder={field.placeholder}
                      placeholderTextColor={theme.textMuted} secureTextEntry={!field.showState} editable={!loading} />
                    <TouchableOpacity style={{ position: 'absolute', right: 14 }} onPress={field.toggle}>
                      <Ionicons name={field.showState ? "eye-off" : "eye"} size={20} color={theme.textMuted} />
                    </TouchableOpacity>
                  </View>
                ) : (
                  <TextInput style={[styles.input, inputStyle]}
                    value={field.value} onChangeText={field.set} placeholder={field.placeholder}
                    placeholderTextColor={theme.textMuted} keyboardType={field.keyboard || 'default'}
                    autoCapitalize={field.capitalize || 'sentences'} editable={!loading} />
                )}
              </View>
            ))}

            <TouchableOpacity style={[styles.registerButton, { backgroundColor: theme.brandActive, shadowColor: theme.brandActive }, loading && styles.buttonDisabled]}
              onPress={handleRegister} disabled={loading} activeOpacity={0.7}>
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.registerButtonText}>Register</Text>}
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.linkButton} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(auth)/login'); }} activeOpacity={0.7}>
            <Text style={[styles.linkText, { color: theme.textMuted }]}>
              Already have an account? <Text style={[styles.linkBold, { color: theme.brandActive }]}>Sign In</Text>
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
  scrollContent: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 32 },
  headerTitle: { fontSize: 28, fontFamily: Fonts.bold, marginBottom: 6 },
  subtitle: { fontSize: 14, fontFamily: Fonts.regular, marginBottom: 24 },
  card: { padding: 24, marginBottom: 20, borderRadius: 12 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center' },
  inputGroup: { marginBottom: 14 },
  label: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.regular, borderRadius: 8, borderWidth: 1 },
  registerButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  registerButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: Fonts.bold },
  linkButton: { alignItems: 'center', paddingVertical: 8 },
  linkText: { fontSize: 14, fontFamily: Fonts.regular },
  linkBold: { fontFamily: Fonts.bold },
});