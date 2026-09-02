

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

interface AlertItem {
  alert_id: string;
  disaster_type: string;
  severity: number;
  district: string;
  created_at: string;
}

const GRID_ITEMS = [
  {
    key: 'help',
    emoji: '🆘',
    label: 'Request Help',
    subtitle: 'Immediate rescue & aid',
    route: '/(people)/help',
    badgeColor: Colors.accentLight,
    badgeBorder: '#FECDD3',
  },
  {
    key: 'hospital',
    emoji: '🏥',
    label: 'Find Hospital',
    subtitle: 'Nearest trauma & care',
    route: '/(people)/locator',
    badgeColor: Colors.infoLight,
    badgeBorder: '#BAE6FD',
  },
  {
    key: 'chat',
    emoji: '💬',
    label: 'First Aid AI',
    subtitle: 'Interactive triage bot',
    route: '/(people)/chatbot',
    badgeColor: Colors.ctaLight,
    badgeBorder: '#A7F3D0',
  },
  {
    key: 'alerts',
    emoji: '📢',
    label: 'Disaster Map',
    subtitle: 'Live warning radars',
    route: '/(people)/dashboard',
    badgeColor: Colors.amberLight,
    badgeBorder: '#FDE68A',
  },
];

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

        socket.on('alert_received', (alert: AlertItem) => {
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

  const getSeverityBadge = (severity: number) => {
    if (severity >= 4) {
      return { label: 'CRITICAL', bg: '#FFF1F2', text: '#E11D48', border: '#FECDD3' };
    }
    if (severity === 3) {
      return { label: 'ELEVATED', bg: '#FFFBEB', text: '#D97706', border: '#FDE68A' };
    }
    return { label: 'ADVISORY', bg: '#F1F5F9', text: '#475569', border: '#E2E8F0' };
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

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Bar */}
      <View style={styles.header}>
        <View>
          <View style={styles.brandRow}>
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
          {GRID_ITEMS.slice(0, 2).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.gridCell}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: item.badgeColor, borderColor: item.badgeBorder }]}>
                <Text style={styles.gridEmoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.gridLabel}>{item.label}</Text>
              <Text style={styles.gridSubtitle}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
        </View>
        <View style={styles.gridRow}>
          {GRID_ITEMS.slice(2, 4).map((item) => (
            <TouchableOpacity
              key={item.key}
              style={styles.gridCell}
              onPress={() => router.push(item.route as any)}
              activeOpacity={0.75}
            >
              <View style={[styles.gridIconCircle, { backgroundColor: item.badgeColor, borderColor: item.badgeBorder }]}>
                <Text style={styles.gridEmoji}>{item.emoji}</Text>
              </View>
              <Text style={styles.gridLabel}>{item.label}</Text>
              <Text style={styles.gridSubtitle}>{item.subtitle}</Text>
            </TouchableOpacity>
          ))}
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
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingTop: 14,
    paddingBottom: 10,
  },
  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  headerTitle: {
    fontSize: 26,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    letterSpacing: -0.5,
  },
  livePulseDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
  },
  liveBadge: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: Colors.accent,
    letterSpacing: 0.8,
  },
  welcome: {
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: Colors.slateMuted,
    marginTop: 2,
  },
  exitButton: {
    paddingVertical: 7,
    paddingHorizontal: 14,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  headerExit: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
    color: Colors.slateMuted,
  },
  emergencyBanner: {
    marginHorizontal: 16,
    marginTop: 8,
    marginBottom: 14,
    backgroundColor: '#FFF1F2',
    borderWidth: 1.5,
    borderColor: '#FECDD3',
    borderRadius: 16,
    paddingVertical: 12,
    paddingHorizontal: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: Colors.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 3,
  },
  sosIconCircle: {
    width: 42,
    height: 42,
    borderRadius: 12,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
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
    color: Colors.accent,
  },
  sosSub: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: '#9F1239',
    marginTop: 1,
  },
  sosChevronWrap: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#FFE4E6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  sosChevron: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: Colors.accent,
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
    ...Glass.card,
    paddingVertical: 18,
    paddingHorizontal: 14,
    alignItems: 'flex-start',
  },
  gridIconCircle: {
    width: 46,
    height: 46,
    borderRadius: 12,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  gridEmoji: {
    fontSize: 22,
  },
  gridLabel: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  gridSubtitle: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.slateMuted,
    marginTop: 2,
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
    color: Colors.textPrimary,
  },
  alertCountBadge: {
    backgroundColor: Colors.surfaceLight,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
  },
  alertCountText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: Colors.slateMuted,
  },
  alertsList: {
    gap: 10,
  },
  alertCard: {
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 12,
    padding: 12,
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
    color: Colors.textPrimary,
  },
  alertDistrict: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  alertTime: {
    fontSize: 11,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 28,
  },
  emptyIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  emptyTitle: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  noAlerts: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.slateMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: 20,
  },
});

