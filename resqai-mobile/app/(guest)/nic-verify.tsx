import React, { useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Location from 'expo-location';
import MinimalButton from '../../components/MinimalButton';
import MinimalInput from '../../components/MinimalInput';
import Colors from '../../constants/colors';
import { api } from '../../constants/api';

export default function NicVerifyScreen() {
  const router = useRouter();
  const [nic, setNic] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerify = async () => {
    if (!nic.trim()) {
      setError('NIC number is required.');
      return;
    }

    setError('');
    setLoading(true);

    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      let lat = 0;
      let lng = 0;

      if (status === 'granted') {
        const loc = await Location.getCurrentPositionAsync();
        lat = loc.coords.latitude;
        lng = loc.coords.longitude;
      }

      const res = await api.post('/api/auth/guest/verify-nic', {
        nic_number: nic,
        lat,
        lng,
      });

      await AsyncStorage.setItem('guest_token', res.data.access_token);
      router.replace('/(guest)/request');
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
    <ScrollView contentContainerStyle={styles.container}>
      <Text style={styles.title}>Verify NIC</Text>
      <Text style={styles.info}>
        Enter your NIC number to submit a help request as a guest.
      </Text>

      <MinimalInput
        label="NIC Number"
        value={nic}
        onChangeText={setNic}
        placeholder="881234567V or 198812345678"
        error={error}
      />

      <MinimalButton
        label="Verify & Continue"
        onPress={handleVerify}
        loading={loading}
      />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  info: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 32,
  },
});
