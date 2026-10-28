/**
 * Flow 4: Guest user asking for help
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import LanguageSelector from '../../components/LanguageSelector';

export default function GuestScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const { t } = useLanguage();
  const glass = useMemo(() => makeGlass(theme), [theme]);
  const [nic, setNic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyNic = async () => {
    const trimmedNic = nic.trim();
    if (!trimmedNic) {
      setError(t('auth.invalidNic'));
      return;
    }
    const nicRegex = /^[0-9]{9}[VvXx]$|^[0-9]{12}$/;
    if (!nicRegex.test(trimmedNic)) {
      setError(t('auth.invalidNic'));
      return;
    }
    setError('');
    setLoading(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') {
          const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced });
          lat = loc.coords.latitude;
          lng = loc.coords.longitude;
        }
      } catch {}
      const res = await apiFetch('/api/auth/guest/verify-nic', {
        method: 'POST',
        body: JSON.stringify({ nic_number: trimmedNic, lat, lng }),
      });
      const data = await res.json();
      if (res.ok) {
        await AsyncStorage.setItem('guest_token', data.access_token);
        router.replace('/(people)/dashboard');
      } else {
        if (res.status === 400) {
          setError(data.detail || t('auth.invalidNic'));
        } else {
          setError(data.detail || t('common.error'));
        }
      }
    } catch {
      console.error('Guest NIC verify error');
      setError(t('auth.connectionError'));
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : 'height'} keyboardVerticalOffset={20}>
        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
          <TouchableOpacity
            style={styles.backLink}
            onPress={() => {
              if (router.canGoBack()) router.back();
              else router.replace('/(auth)/login');
            }}
            activeOpacity={0.7}
          >
            <Text style={[styles.backText, { color: theme.brandActive }]}>
              ← {t('auth.signIn')}
            </Text>
          </TouchableOpacity>

          <View style={[styles.iconCircle, { backgroundColor: theme.successLight }]}>
            <Ionicons name="shield-checkmark-outline" size={36} color={theme.success} />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>
            {t('auth.guestSignIn')}
          </Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            {t('auth.guestTagline')}
          </Text>

          <View style={[styles.card, glass.card]}>
            <LanguageSelector variant="segmented" style={{ marginBottom: 16 }} />

            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
                <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>⚠ {error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>
                {t('auth.nicNumber')}
              </Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={nic}
                onChangeText={setNic}
                placeholder={t('auth.nicPlaceholder')}
                placeholderTextColor={theme.textMuted}
                autoCapitalize="characters"
                autoCorrect={false}
                editable={!loading}
                onSubmitEditing={handleVerifyNic}
                maxLength={12}
              />
              <Text style={[styles.hint, { color: theme.textMuted }]}>
                {t('auth.nicHint')}
              </Text>
            </View>

            <TouchableOpacity
              style={[
                styles.verifyButton,
                { backgroundColor: theme.brandActive },
                Platform.OS === 'web' ? { boxShadow: `0 4px 8px ${theme.brandActive}40` } : { shadowColor: theme.brandActive },
                loading && styles.buttonDisabled,
              ]}
              onPress={handleVerifyNic}
              disabled={loading}
              activeOpacity={0.7}
            >
              {loading ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <Text style={styles.verifyButtonText}>{t('common.confirm')}</Text>
              )}
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
  content: { flexGrow: 1, paddingHorizontal: 24, paddingVertical: 28 },
  backLink: { marginBottom: 16 },
  backText: { fontSize: 14, fontFamily: Fonts.semiBold },
  iconCircle: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center', alignSelf: 'center', marginBottom: 14 },
  title: { fontSize: 24, fontFamily: Fonts.bold, textAlign: 'center', marginBottom: 6 },
  subtitle: { fontSize: 13, fontFamily: Fonts.regular, textAlign: 'center', marginBottom: 20, paddingHorizontal: 16 },
  card: { padding: 22, borderRadius: 12 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.bold, textAlign: 'center' },
  inputGroup: { marginBottom: 18 },
  label: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 14, fontFamily: Fonts.semiBold, borderRadius: 8, borderWidth: 1 },
  hint: { fontSize: 11, fontFamily: Fonts.regular, marginTop: 4 },
  verifyButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center', marginTop: 8 },
  buttonDisabled: { opacity: 0.6 },
  verifyButtonText: { color: '#FFFFFF', fontSize: 15, fontFamily: Fonts.bold },
});