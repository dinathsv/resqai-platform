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
import AsyncStorage from '@react-native-async-storage/async-storage';
import MinimalButton from '../../components/MinimalButton';
import MinimalInput from '../../components/MinimalInput';
import Colors from '../../constants/colors';
import { api } from '../../constants/api';

export default function LoginScreen() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    if (!email.trim() || !password.trim()) {
      setError('Email and password are required.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/login', { email, password });
      const { token, role } = res.data;

      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('role', role);

      if (role === 'people') {
        router.replace('/(people)/dashboard');
      }
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Login failed. Check your credentials.';
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
        <View style={styles.headerArea}>
          <Text style={styles.title}>ResQAI</Text>
          <Text style={styles.subtitle}>Emergency Relief Platform</Text>
        </View>

        <View style={styles.form}>
          <MinimalInput
            label="Email"
            value={email}
            onChangeText={setEmail}
            placeholder="you@example.com"
            keyboardType="email-address"
          />
          <MinimalInput
            label="Password"
            value={password}
            onChangeText={setPassword}
            placeholder="Enter password"
            secureTextEntry
          />

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <MinimalButton
            label="Login"
            onPress={handleLogin}
            loading={loading}
          />

          <View style={styles.links}>
            <TouchableOpacity onPress={() => router.push('/(auth)/guest')}>
              <Text style={styles.link}>Continue as Guest →</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => router.push('/(auth)/register')}>
              <Text style={styles.link}>Register</Text>
            </TouchableOpacity>
          </View>
        </View>
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
    justifyContent: 'center',
    paddingHorizontal: 24,
    paddingVertical: 48,
    backgroundColor: Colors.white,
  },
  headerArea: {
    alignItems: 'center',
    marginBottom: 48,
  },
  title: {
    fontSize: 36,
    fontWeight: '700',
    color: Colors.black,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    marginTop: 4,
  },
  form: {
    width: '100%',
  },
  error: {
    fontSize: 13,
    color: Colors.red,
    textAlign: 'center',
    marginBottom: 16,
  },
  links: {
    marginTop: 24,
    alignItems: 'center',
    gap: 16,
  },
  link: {
    fontSize: 14,
    color: Colors.black,
    textDecorationLine: 'underline',
  },
});
