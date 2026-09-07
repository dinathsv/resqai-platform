

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
  Platform,
  ImageSourcePropType,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { connectSocket, disconnectSocket } from '../../config/socket';
import { Colors, Fonts, Glass } from '../../constants/theme';

interface AlertItem {
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
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
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

        const onAlertReceived = (alert: AlertItem) => {
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
        };

        socket.on('alert_received', onAlertReceived);
        socket.on('emergency_alert', onAlertReceived);

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

  const getSeverityBadge = (severity: number) => {
    if (severity >= 4) {
      return { label: 'CRITICAL', bg: 'rgba(184, 46, 85, 0.35)', text: '#FFFFFF', border: 'rgba(255, 255, 255, 0.20)' };
    }
    if (severity === 3) {
      return { label: 'ELEVATED', bg: 'rgba(229, 152, 53, 0.25)', text: '#E59835', border: 'rgba(229, 152, 53, 0.40)' };
    }
    return { label: 'ADVISORY', bg: 'rgba(255, 255, 255, 0.10)', text: '#F3D6DE', border: 'rgba(255, 255, 255, 0.12)' };
  };

  const renderAlertItem = ({ item }: { item: AlertItem }) => {
    const badge = getSeverityBadge(item.severity);
    return (
      <TouchableOpacity
        style={styles.alertCard}
        onPress={() => router.push(`/(people)/alert/${item.alert_id}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.alertTopLine}>
          <View style={[styles.severityPill, { backgroundColor: badge.bg, borderColor: badge.border }]}>
            <Text style={[styles.severityPillText, { color: badge.text }]}>{badge.label}</Text>
          </View>
          <Text style={styles.alertTime}>{formatTime(item.created_at)}</Text>
        </View>

        <View style={styles.alertContent}>
          <Text style={styles.alertType}>{item.disaster_type.toUpperCase()}</Text>
          <Text style={styles.alertDistrict}>📍 {item.district || 'All Island'}</Text>
        </View>
      </TouchableOpacity>
    );
  };

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
      {/* Top Bar */}
      <View style={styles.header}>
        <View>
          <View style={styles.headerBrand}>
            <Image
              source={require('../../assets/Resqai.jpeg')}
              style={styles.headerLogo}
              resizeMode="contain"
            />
            <Text style={styles.headerTitle}>ResQAI</Text>
            <View style={styles.livePulseDot} />
            <Text style={styles.liveBadge}>LIVE RELIEF</Text>
          </View>
          <Text style={styles.welcome}>Hello, {userName || 'Citizen'}</Text>
        </View>

        <TouchableOpacity onPress={handleExit} style={styles.exitButton} activeOpacity={0.7}>
          <Text style={styles.headerExit}>Sign Out</Text>
        </TouchableOpacity>
      </View>

      {/* Emergency Quick SOS Banner */}
      <TouchableOpacity
        style={styles.emergencyBanner}
        onPress={() => router.push('/(people)/help')}
        activeOpacity={0.85}
      >
        <View style={styles.sosIconCircle}>
          <Text style={styles.sosEmoji}>🚑</Text>
        </View>
        <View style={styles.sosContent}>
          <Text style={styles.sosHeading}>In Danger? Tap for SOS</Text>
          <Text style={styles.sosSub}>Call 1990 Ambulance & send live GPS triage</Text>
        </View>
        <View style={styles.sosChevronWrap}>
          <Text style={styles.sosChevron}>→</Text>
        </View>
      </TouchableOpacity>

      {/* 2x2 Tactical Grid */}
      <View style={styles.grid}>
        <View style={styles.gridRow}>
          {GRID_ITEMS.slice(0, 2).map(renderGridCell)}
        </View>
        <View style={styles.gridRow}>
          {GRID_ITEMS.slice(2, 4).map(renderGridCell)}
        </View>
      </View>

      {/* Active Alerts Section */}
      <View style={styles.alertsSection}>
        <View style={styles.alertsHeaderRow}>
          <Text style={styles.alertsHeading}>Active Alerts</Text>
          <View style={styles.alertCountBadge}>
            <Text style={styles.alertCountText}>{alerts.length}</Text>
          </View>
        </View>

        {alerts.length === 0 ? (
          <View style={styles.emptyState}>
            <Text style={styles.emptyIcon}>🛡️</Text>
            <Text style={styles.emptyTitle}>No Active Hazards</Text>
            <Text style={styles.noAlerts}>No active severe warnings reported in your district.</Text>
          </View>
        ) : (
          <FlatList
            data={alerts}
            keyExtractor={(item) => item.alert_id}
            renderItem={renderAlertItem}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.alertsList}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'transparent',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
    backgroundColor: 'transparent',
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
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
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#F47294',
  },
  liveBadge: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#F47294',
    letterSpacing: 0.8,
  },
  welcome: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
    marginTop: 2,
    opacity: 0.95,
  },
  exitButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 12px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.35)',
        } as any)
      : {}),
  },
  headerExit: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  emergencyBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 14,
    ...Glass.cardUrgent,
    paddingVertical: 14,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
  },
  sosIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(12px)',
          WebkitBackdropFilter: 'blur(12px)',
          boxShadow: 'inset 0 1px 1px rgba(255, 255, 255, 0.3)',
        } as any)
      : {}),
  },
  sosEmoji: {
    fontSize: 22,
  },
  sosContent: {
    flex: 1,
  },
  sosHeading: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  sosSub: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
    marginTop: 1,
    opacity: 0.95,
  },
  sosChevronWrap: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.35)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosChevron: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  grid: {
    paddingHorizontal: 16,
    marginBottom: 14,
    gap: 10,
  },
  gridRow: {
    flexDirection: 'row',
    gap: 10,
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
    marginHorizontal: 16,
    marginBottom: 16,
    ...Glass.card,
    padding: 18,
  },
  alertsHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  alertsHeading: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  alertCountBadge: {
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 12,
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.30)',
  },
  alertCountText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  alertsList: {
    gap: 10,
  },
  alertCard: {
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 16,
    padding: 14,
    ...(Platform.OS === 'web'
      ? ({
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          boxShadow: '0 4px 16px rgba(0, 0, 0, 0.25), inset 0 1px 1px rgba(255, 255, 255, 0.30)',
        } as any)
      : {}),
  },
  alertTopLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  severityPill: {
    paddingHorizontal: 7,
    paddingVertical: 2,
    borderRadius: 6,
    borderWidth: 1,
  },
  severityPillText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    letterSpacing: 0.5,
  },
  alertContent: {
    flex: 1,
  },
  alertType: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  alertDistrict: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
    marginTop: 2,
    opacity: 0.9,
  },
  alertTime: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
    opacity: 0.8,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  emptyIconWrap: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    borderWidth: 1.5,
    borderColor: 'rgba(255, 255, 255, 0.30)',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  emptyIcon: {
    fontSize: 32,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
    marginBottom: 4,
  },
  noAlerts: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
    color: '#FFFFFF',
    textAlign: 'center',
    opacity: 0.85,
    lineHeight: 18,
    paddingHorizontal: 20,
  },
});

