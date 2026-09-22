/**
 * Flow 4: Guest user asking for help
 */
import React, { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, StyleSheet,
  SafeAreaView, ActivityIndicator, KeyboardAvoidingView, Platform,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { apiFetch } from '../../config/api';
import { Fonts, makeGlass } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';

export default function GuestScreen() {
  const router = useRouter();
  const { theme } = useTheme();
  const glass = useMemo(() => makeGlass(theme), [theme]);
  const [nic, setNic] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleVerifyNic = async () => {
    const trimmedNic = nic.trim();
    if (!trimmedNic) { setError('Please enter your NIC number'); return; }
    const nicRegex = /^[0-9]{9}[VvXx]$|^[0-9]{12}$/;
    if (!nicRegex.test(trimmedNic)) { setError('Invalid NIC format. Use old format (e.g. 123456789V) or new format (12 digits)'); return; }
    setError(''); setLoading(true);
    try {
      let lat: number | null = null, lng: number | null = null;
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status === 'granted') { const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }); lat = loc.coords.latitude; lng = loc.coords.longitude; }
      } catch {}
      const res = await apiFetch('/api/auth/guest/verify-nic', { method: 'POST', body: JSON.stringify({ nic_number: trimmedNic, lat, lng }) });
      const data = await res.json();
      if (res.ok) { await AsyncStorage.setItem('guest_token', data.access_token); router.replace('/(people)/dashboard'); }
      else {
        if (res.status === 400) {
          if (data.detail?.includes('format')) setError('Invalid NIC format. Please check and try again.');
          else if (data.detail?.includes('registry')) setError('NIC not found in the national registry. Please check your number.');
          else setError(data.detail || 'NIC verification failed');
        } else setError(data.detail || 'Verification failed. Please try again.');
      }
    } catch { console.error('Guest NIC verify error'); setError('Connection error. Please check your internet connection.'); }
    finally { setLoading(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <View style={styles.content}>
          <TouchableOpacity style={styles.backLink} onPress={() => { if (router.canGoBack()) router.back(); else router.replace('/(auth)/login'); }} activeOpacity={0.7}>
            <Text style={[styles.backText, { color: theme.brandActive }]}>← Back to Sign In</Text>
          </TouchableOpacity>

          <View style={[styles.iconCircle, { backgroundColor: theme.successLight }]}>
            <Ionicons name="person-outline" size={36} color={theme.success} />
          </View>

          <Text style={[styles.title, { color: theme.textPrimary }]}>Guest Access</Text>
          <Text style={[styles.subtitle, { color: theme.textMuted }]}>
            Enter your NIC number to access emergency help features without an account.
          </Text>

          <View style={[styles.card, glass.card]}>
            {error ? (
              <View style={[styles.errorBox, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
                <Text style={[styles.errorText, { color: theme.isDark ? '#FFFFFF' : theme.emergency }]}>⚠ {error}</Text>
              </View>
            ) : null}

            <View style={styles.inputGroup}>
              <Text style={[styles.label, { color: theme.textSecondary }]}>NIC Number</Text>
              <TextInput
                style={[styles.input, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={nic} onChangeText={setNic} placeholder="e.g. 200012345678 or 951234567V"
                placeholderTextColor={theme.textMuted} autoCapitalize="characters" autoCorrect={false}
                editable={!loading} onSubmitEditing={handleVerifyNic} maxLength={12} />
            </View>

            <TouchableOpacity style={[styles.verifyButton, { backgroundColor: theme.brandActive, shadowColor: theme.brandActive }, loading && styles.buttonDisabled]}
              onPress={handleVerifyNic} disabled={loading} activeOpacity={0.7}>
              {loading ? <ActivityIndicator size="small" color="#FFFFFF" /> : <Text style={styles.verifyButtonText}>Verify & Continue</Text>}
            </TouchableOpacity>

            <Text style={[styles.disclaimer, { color: theme.textMuted }]}>
              Guest sessions expire after 30 minutes.{'\n'}Register for full access to all features.
            </Text>
          </View>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 24, justifyContent: 'center', alignItems: 'center' },
  backLink: { alignSelf: 'flex-start', marginBottom: 24 },
  backText: { fontSize: 14, fontFamily: Fonts.semiBold },
  iconCircle: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  iconText: { fontSize: 36 },
  title: { fontSize: 24, fontFamily: Fonts.bold, marginBottom: 8 },
  subtitle: { fontSize: 14, fontFamily: Fonts.regular, textAlign: 'center', lineHeight: 20, marginBottom: 24 },
  card: { padding: 24, width: '100%', borderRadius: 12 },
  errorBox: { borderRadius: 8, padding: 12, marginBottom: 16, borderWidth: 1 },
  errorText: { fontSize: 13, fontFamily: Fonts.medium, textAlign: 'center' },
  inputGroup: { marginBottom: 20 },
  label: { fontSize: 13, fontFamily: Fonts.medium, marginBottom: 6 },
  input: { paddingVertical: 12, paddingHorizontal: 14, fontSize: 16, fontFamily: Fonts.medium, letterSpacing: 1, textAlign: 'center', borderRadius: 8, borderWidth: 1 },
  verifyButton: { paddingVertical: 12, borderRadius: 8, alignItems: 'center' },
  buttonDisabled: { opacity: 0.6 },
  verifyButtonText: { color: '#FFFFFF', fontSize: 16, fontFamily: Fonts.bold },
  disclaimer: { fontSize: 12, fontFamily: Fonts.regular, textAlign: 'center', marginTop: 20, lineHeight: 18 },
});