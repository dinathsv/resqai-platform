import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useRouter } from 'expo-router';
import MinimalButton from '../../components/MinimalButton';
import MinimalInput from '../../components/MinimalInput';
import Colors from '../../constants/colors';
import { api } from '../../constants/api';

const LANGUAGES = [
  { key: 'si', label: 'සිං' },
  { key: 'ta', label: 'த' },
  { key: 'en', label: 'EN' },
];

export default function RegisterScreen() {
  const router = useRouter();
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [language, setLanguage] = useState('en');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleRegister = async () => {
    if (!fullName.trim() || !email.trim() || !phone.trim() || !password.trim()) {
      setError('All fields are required.');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/register', {
        full_name: fullName,
        email,
        phone,
        password,
        language,
      });

      const userId = res.data.user_id;
      router.push({
        pathname: '/(auth)/otp',
        params: { user_id: userId, phone },
      });
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Registration failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.flex}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Account</Text>

        <MinimalInput
          label="Full Name"
          value={fullName}
          onChangeText={setFullName}
          placeholder="Your full name"
        />
        <MinimalInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          keyboardType="email-address"
        />
        <MinimalInput
          label="Phone Number"
          value={phone}
          onChangeText={setPhone}
          placeholder="+94 7X XXX XXXX"
          keyboardType="phone-pad"
        />
        <MinimalInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          placeholder="Create a password"
          secureTextEntry
        />
        <MinimalInput
          label="Confirm Password"
          value={confirmPassword}
          onChangeText={setConfirmPassword}
          placeholder="Repeat password"
          secureTextEntry
        />

        <View style={styles.languageSection}>
          <Text style={styles.languageLabel}>Preferred Language</Text>
          <View style={styles.languageRow}>
            {LANGUAGES.map((lang) => {
              const isSelected = language === lang.key;
              return (
                <TouchableOpacity
                  key={lang.key}
                  onPress={() => setLanguage(lang.key)}
                  style={[
                    styles.langOption,
                    isSelected && styles.langOptionSelected,
                  ]}
                >
                  <Text
                    style={[
                      styles.langText,
                      isSelected && styles.langTextSelected,
                    ]}
                  >
                    {lang.label}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <MinimalButton
          label="Register"
          onPress={handleRegister}
          loading={loading}
        />
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
    backgroundColor: Colors.white,
  },
  container: {
    flexGrow: 1,
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: Colors.white,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 32,
  },
  languageSection: {
    marginBottom: 24,
  },
  languageLabel: {
    fontSize: 12,
    color: Colors.gray,
    marginBottom: 8,
  },
  languageRow: {
    flexDirection: 'row',
    gap: 0,
  },
  langOption: {
    flex: 1,
    paddingVertical: 10,
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.black,
    backgroundColor: Colors.white,
  },
  langOptionSelected: {
    backgroundColor: Colors.black,
  },
  langText: {
    fontSize: 14,
    color: Colors.black,
    fontWeight: '500',
  },
  langTextSelected: {
    color: Colors.white,
  },
  error: {
    fontSize: 13,
    color: Colors.red,
    textAlign: 'center',
    marginBottom: 16,
  },
});
