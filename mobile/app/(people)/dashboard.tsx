

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { connectSocket, disconnectSocket } from '../../config/socket';
import { Colors, Fonts, Glass } from '../../constants/theme';

interface Alert {
  alert_id: string;
  disaster_type: string;
  severity: number;
  district: string;
  created_at: string;
}

const GRID_ITEMS = [
  { key: 'help', emoji: '🆘', label: 'Request Help', route: '/(people)/help' },
  { key: 'hospital', emoji: '🏥', label: 'Find Hospital', route: '/(people)/locator' },
  { key: 'chat', emoji: '💬', label: 'First Aid Chat', route: '/(people)/chatbot' },
  { key: 'alerts', emoji: '📢', label: 'Alerts', route: '/(people)/dashboard' },
];

export default function DashboardScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>('');
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const flashAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {

        const meRes = await apiFetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (mounted) setUserName(meData.full_name || 'User');
        }

        const alertsRes = await apiFetch('/api/alerts');
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          if (mounted) setAlerts(alertsData.alerts || []);
        }
      } catch (err) {
        console.error('Dashboard init error:', err);
      }
    }

    init();
    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function setupSocket() {
      try {
        const socket = await connectSocket();

        if (!socket) {
          console.warn('Socket not connected, skipping alert listener setup.');
          return;
        }

        socket.on('alert_received', (alert: Alert) => {
          if (!mounted) return;
          setAlerts((prev) => [alert, ...prev]);

          Animated.sequence([
            Animated.timing(flashAnim, {
              toValue: 1,
              duration: 200,
              useNativeDriver: false,
            }),
            Animated.timing(flashAnim, {
              toValue: 0,
              duration: 800,
              useNativeDriver: false,
            }),
          ]).start();
        });

      } catch (err) {
        console.error('Socket setup error:', err);
      }
    }

    setupSocket();
    return () => {
      mounted = false;
      disconnectSocket();
    };
  }, []);

  const handleExit = useCallback(async () => {
    await AsyncStorage.clear();
    router.replace('/');
  }, [router]);

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const borderColor = flashAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [Colors.border, Colors.accent],
  });

  const renderAlertItem = ({ item }: { item: Alert }) => (
    <TouchableOpacity
      style={styles.alertRow}
      onPress={() => router.push(`/(people)/alert/${item.alert_id}`)}
      activeOpacity={0.7}
    >
      <View style={styles.alertContent}>
        <Text style={styles.alertType}>
          {item.disaster_type.toUpperCase()}
        </Text>
        <Text style={styles.alertDistrict}>
          {item.district || 'Unknown'}
        </Text>
      </View>
      <Text style={styles.alertTime}>
        {formatTime(item.created_at)}
      </Text>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>ResQAI</Text>
          <Text style={styles.welcome}>Hello, {userName || '...'}</Text>
        </View>
        <TouchableOpacity onPress={handleExit} style={styles.exitButton}>
          <Text style={styles.headerExit}>Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          {GRID_ITEMS.slice(0, 2).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.gridCell}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.gridEmoji}>{item.emoji}</Text>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.gridRow}>
          {GRID_ITEMS.slice(2, 4).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.gridCell}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.gridEmoji}>{item.emoji}</Text>
              <Text style={styles.gridLabel}>{item.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <Animated.View style={[styles.alertsSection, { borderColor }]}>
        <Text style={styles.alertsHeading}>Active Alerts</Text>

        {alerts.length === 0 ? (
          <Text style={styles.noAlerts}>No active alerts in your area</Text>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(item) => item.alert_id}
            renderItem={renderAlertItem}
            style={styles.alertsList}
          />
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 12,
  },
  headerTitle: {
    fontSize: 24,
    fontFamily: Fonts.bold,
    color: Colors.accent,
  },
  headerExit: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: Colors.accent,
  },
  exitButton: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.accent,
  },
  welcome: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  grid: {
    paddingHorizontal: 16,
    marginBottom: 16,
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
  },
  gridCell: {
    flex: 1,
    ...Glass.card,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 24,
  },
  gridEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  gridLabel: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  alertsSection: {
    flex: 1,
    marginHorizontal: 16,
    marginBottom: 16,
    ...Glass.card,
    padding: 16,
  },
  alertsHeading: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.accent,
    marginBottom: 8,
  },
  alertsList: {
    flex: 1,
  },
  alertRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.borderLight,
  },
  alertContent: {
    flex: 1,
  },
  alertType: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: Colors.accent,
  },
  alertDistrict: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  alertTime: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  noAlerts: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    paddingVertical: 16,
  },
});
