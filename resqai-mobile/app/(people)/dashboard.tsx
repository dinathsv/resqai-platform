import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
} from 'react-native';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Colors from '../../constants/colors';

const MENU_ITEMS = [
  { label: 'First Aid Chatbot', route: '/(people)/chatbot' },
  { label: 'Shelter Locator', route: '/(people)/locator' },
  { label: 'Submit Help Request', route: '/(people)/request' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState('');

  useEffect(() => {
    const load = async () => {
      const name = await AsyncStorage.getItem('user_name');
      if (name) setUserName(name);
    };
    load();
  }, []);

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(['token', 'role', 'user_name']);
    router.replace('/(auth)/login');
  };

  return (
    <ScrollView
      contentContainerStyle={styles.container}
    >
      <Text style={styles.greeting}>
        {userName ? `Hello, ${userName}` : 'Dashboard'}
      </Text>
      <Text style={styles.subtitle}>What do you need?</Text>

      <View style={styles.menu}>
        {MENU_ITEMS.map((item) => (
          <TouchableOpacity
            key={item.route}
            style={styles.menuItem}
            onPress={() => router.push(item.route as any)}
          >
            <Text style={styles.menuText}>{item.label}</Text>
            <Text style={styles.arrow}>→</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.footer}>
        <TouchableOpacity onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
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
  greeting: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.black,
    marginBottom: 4,
  },
  subtitle: {
    fontSize: 14,
    color: Colors.gray,
    marginBottom: 32,
  },
  menu: {
    gap: 0,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 16,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  menuText: {
    fontSize: 16,
    color: Colors.black,
  },
  arrow: {
    fontSize: 16,
    color: Colors.gray,
  },
  footer: {
    marginTop: 48,
    alignItems: 'center',
  },
  logoutText: {
    fontSize: 14,
    color: Colors.red,
    textDecorationLine: 'underline',
  },
});
