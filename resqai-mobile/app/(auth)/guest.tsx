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
import * as Location from 'expo-location';
import MinimalButton from '../../components/MinimalButton';
import MinimalInput from '../../components/MinimalInput';
import Colors from '../../constants/colors';
import { api } from '../../constants/api';

export default function GuestScreen() {
  const router = useRouter();
  const [nic, setNic] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleVerifyNIC = async () => {
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

      const { temp_token } = res.data;
      await AsyncStorage.setItem('guest_token', temp_token);

      router.replace('/(guest)/request');
    } catch (err: any) {
      const msg =
        err?.response?.data?.detail ||
        err?.response?.data?.message ||
        'NIC verification failed.';
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const handleChatbotOnly = () => {
    router.push('/(people)/chatbot');
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
        <Text style={styles.title}>Guest Access</Text>

        <Text style={styles.info}>
          You can use the First Aid Chatbot and Disaster Quiz without entering
          your NIC.
        </Text>

        <View style={styles.divider} />

        <Text style={styles.info}>
          To submit a help request, NIC required:
        </Text>

        <MinimalInput
          label="NIC Number"
          value={nic}
          onChangeText={setNic}
          placeholder="881234567V or 198812345678"
          error={error}
        />

        <MinimalButton
          label="Verify NIC & Continue"
          onPress={handleVerifyNIC}
          loading={loading}
        />

        <View style={styles.linkContainer}>
          <TouchableOpacity onPress={handleChatbotOnly}>
            <Text style={styles.link}>Use Chatbot Only →</Text>
          </TouchableOpacity>
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
    paddingHorizontal: 24,
    paddingVertical: 32,
    backgroundColor: Colors.white,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 24,
  },
  info: {
    fontSize: 14,
    color: Colors.black,
    lineHeight: 20,
    marginBottom: 16,
  },
  divider: {
    height: 1,
    backgroundColor: Colors.gray,
    marginVertical: 16,
  },
  linkContainer: {
    marginTop: 24,
    alignItems: 'center',
  },
  link: {
    fontSize: 14,
    color: Colors.black,
    textDecorationLine: 'underline',
  },
});
