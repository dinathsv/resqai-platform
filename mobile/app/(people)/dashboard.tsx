

import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  Image,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Animated,
  ImageSourcePropType,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { connectSocket, disconnectSocket } from '../../config/socket';

interface Alert {
  alert_id: string;
  disaster_type: string;
  severity: number;
  district: string;
  created_at: string;
}

interface GridItem {
  key: string;
  image: ImageSourcePropType;
  label: string;
  route: string;
  accentColor: string;
}

const GRID_ITEMS: GridItem[] = [
  {
    key: 'help',
    image: require('../../assets/SOS.PNG'),
    label: 'SOS Help',
    route: '/(people)/help',
    accentColor: '#DC2626',
  },
  {
    key: 'hospital',
    image: require('../../assets/Hospital.PNG'),
    label: 'Find Hospital',
    route: '/(people)/locator',
    accentColor: '#2563EB',
  },
  {
    key: 'chat',
    image: require('../../assets/Chatbot.PNG'),
    label: 'First Aid Chat',
    route: '/(people)/chatbot',
    accentColor: '#0284C7',
  },
  {
    key: 'alerts',
    image: require('../../assets/Map.PNG'),
    label: 'Disaster Map',
    route: '/(people)/dashboard',
    accentColor: '#2563EB',
  },
];

/* ------------------------------------------------------------------ */
/*  Fade overlay — simulates a top-to-bottom gradient (clear → white) */
/*  by stacking thin bands of increasing opacity                      */
/* ------------------------------------------------------------------ */
function FadeOverlay() {
  const BANDS = 8;
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {Array.from({ length: BANDS }).map((_, i) => (
        <View
          key={i}
          style={{
            flex: 1,
            backgroundColor: `rgba(255,255,255,${(i / BANDS) * 0.95})`,
          }}
        />
      ))}
    </View>
  );
}

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
    outputRange: ['#E0E0E0', '#FF0000'],
  });

  const renderAlertItem = ({ item }: { item: Alert }) => (
    <TouchableOpacity
      style={styles.alertRow}
      onPress={() => router.push(`/(people)/alert/${item.alert_id}`)}
      activeOpacity={0.7}
    >
      <Text style={styles.alertText}>
        <Text style={styles.alertType}>
          {item.disaster_type.toUpperCase()}
        </Text>
        {'  '}
        {item.district || 'Unknown'}
        {'  '}
        {formatTime(item.created_at)}
      </Text>
    </TouchableOpacity>
  );

  const renderGridCell = (item: GridItem) => (
    <TouchableOpacity
      key={item.key}
      style={styles.gridCell}
      onPress={() => router.push(item.route as any)}
      activeOpacity={0.7}
    >
      {/* Logo image – visible & clear at the top */}
      <Image source={item.image} style={styles.gridImage} resizeMode="contain" />

      {/* Fade overlay: transparent at top → white at bottom */}
      <FadeOverlay />

      {/* Label pinned to the bottom, always visible */}
      <View style={styles.gridLabelContainer}>
        <Text style={[styles.gridLabel, { color: item.accentColor }]}>
          {item.label}
        </Text>
      </View>
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>
        <View style={styles.headerBrand}>
          <Image
            source={require('../../assets/Resqai.jpeg')}
            style={styles.headerLogo}
            resizeMode="contain"
          />
          <Text style={styles.headerTitle}>ResQAI</Text>
        </View>
        <TouchableOpacity onPress={handleExit}>
          <Text style={styles.headerExit}>Exit</Text>
        </TouchableOpacity>
      </View>

      <Text style={styles.welcome}>Hello, {userName || '...'}</Text>

      <View style={styles.grid}>
        <View style={styles.gridRow}>
          {GRID_ITEMS.slice(0, 2).map(renderGridCell)}
        </View>
        <View style={styles.gridRow}>
          {GRID_ITEMS.slice(2, 4).map(renderGridCell)}
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  headerBrand: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerLogo: {
    width: 32,
    height: 32,
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: 'bold',
    color: '#000000',
  },
  headerExit: {
    fontSize: 16,
    color: '#000000',
  },
  welcome: {
    fontSize: 14,
    color: '#888888',
    paddingHorizontal: 16,
    marginBottom: 16,
  },
  grid: {
    paddingHorizontal: 16,
    marginBottom: 24,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 0,
  },
  gridCell: {
    flex: 1,
    height: 150,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
    overflow: 'hidden',
    position: 'relative',
    borderRadius: 12,
    margin: 4,
    /* subtle shadow for depth */
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 6,
    elevation: 3,
  },
  gridImage: {
    width: '100%',
    height: '100%',
    position: 'absolute',
    top: 0,
    left: 0,
  },
  gridLabelContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 10,
    paddingHorizontal: 8,
    backgroundColor: 'rgba(255,255,255,0.92)',
    alignItems: 'center',
  },
  gridLabel: {
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  alertsSection: {
    flex: 1,
    paddingHorizontal: 16,
    borderWidth: 1,
    borderColor: '#E0E0E0',
    marginHorizontal: 16,
    marginBottom: 16,
  },
  alertsHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    paddingVertical: 12,
  },
  alertsList: {
    flex: 1,
  },
  alertRow: {
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  alertText: {
    fontSize: 14,
    color: '#000000',
  },
  alertType: {
    fontWeight: 'bold',
  },
  noAlerts: {
    fontSize: 14,
    color: '#888888',
    paddingVertical: 16,
  },
});

