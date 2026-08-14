import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import MinimalButton from '../../components/MinimalButton';
import MinimalInput from '../../components/MinimalInput';
import Colors from '../../constants/colors';
import { api } from '../../constants/api';

export default function OTPScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ user_id: string; phone: string }>();
  const [otp, setOtp] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (otp.trim().length !== 6) {
      setError('Please enter the 6-digit OTP.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const res = await api.post('/api/auth/verify-otp', {
        user_id: params.user_id,
        otp,
      });

      const { token, role } = res.data;
      await AsyncStorage.setItem('token', token);
      await AsyncStorage.setItem('role', role || 'people');

      router.replace('/(people)/dashboard');
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'Verification failed.';
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
        <Text style={styles.title}>Enter OTP</Text>
        <Text style={styles.subtitle}>
          OTP sent to your phone {params.phone || ''}
        </Text>

        <MinimalInput
          label="OTP Code"
          value={otp}
          onChangeText={setOtp}
          placeholder="6-digit code"
          keyboardType="numeric"
          error={error}
        />

        <MinimalButton
          label="Verify"
          onPress={handleVerify}
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
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 32,
  },
});
