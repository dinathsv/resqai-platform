import React, { useEffect, useState, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  ScrollView,
  Platform,
  Linking,
  Dimensions,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { connectSocket, disconnectSocket } from '../../config/socket';
import { Colors, Fonts } from '../../constants/theme';
import BottomNav from '../../components/BottomNav';

interface AlertItem {
  alert_id: string;
  disaster_type: string;
  severity: number;
  district: string;
  created_at: string;
  description?: string;
}

export default function DashboardScreen() {
  const router = useRouter();
  const [userName, setUserName] = useState<string>('');
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [topAlert, setTopAlert] = useState<{
    title: string;
    description: string;
    id?: string;
  }>({
    title: 'Flood Alert',
    description: 'Heavy rainfall and strong winds in western province',
  });

  useEffect(() => {
    let mounted = true;

    async function init() {
      try {
        const meRes = await apiFetch('/api/auth/me');
        if (meRes.ok) {
          const meData = await meRes.json();
          if (mounted) setUserName(meData.full_name || 'Citizen');
        }

        const alertsRes = await apiFetch('/api/alerts');
        if (alertsRes.ok) {
          const alertsData = await alertsRes.json();
          if (mounted && alertsData.alerts && alertsData.alerts.length > 0) {
            setAlerts(alertsData.alerts);
            const first = alertsData.alerts[0];
            setTopAlert({
              title: `${first.disaster_type.toUpperCase()} Alert`,
              description:
                first.description ||
                `Severe conditions reported in ${first.district || 'Western Province'}`,
              id: first.alert_id,
            });
          }
        }
      } catch (err) {
        console.error('Dashboard init error:', err);
      }
    }

    init();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    let mounted = true;

    async function setupSocket() {
      try {
        const socket = await connectSocket();
        if (!socket) return;

        const onAlertReceived = (alert: AlertItem) => {
          if (!mounted) return;
          setAlerts((prev) => [alert, ...prev]);
          setTopAlert({
            title: `${alert.disaster_type.toUpperCase()} Alert`,
            description:
              alert.description ||
              `Severe conditions reported in ${alert.district || 'Western Province'}`,
            id: alert.alert_id,
          });
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

  const handleCall = (number: string) => {
    Linking.openURL(`tel:${number}`);
  };

  const handleViewAlert = () => {
    if (topAlert.id) {
      router.push(`/(people)/alert/${topAlert.id}` as any);
    } else {
      router.push('/(people)/locator');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Top Header matching Image 3 */}
      <View style={styles.topHeader}>
        <TouchableOpacity
          style={styles.headerIconButton}
          onPress={() => router.push('/(people)/activities')}
          activeOpacity={0.7}
        >
          <Text style={styles.dotsIcon}>⋮</Text>
        </TouchableOpacity>

        <View style={styles.headerTitleGroup}>
          <Text style={styles.headerBrand}>ResQAi</Text>
          <Text style={styles.headerSub}>
            Ai powered Real-Time Disaster Relief Platform
          </Text>
        </View>

        <View style={styles.headerSpacer} />
      </View>

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Disaster Alert Banner matching Image 3 */}
        <View style={styles.alertBanner}>
          <View style={styles.alertBannerRow}>
            {/* Warning triangle in glowing circular container */}
            <View style={styles.alertIconCircle}>
              <View style={styles.warningTriangleOuter}>
                <Text style={styles.warningExclamation}>⚠️</Text>
              </View>
            </View>

            {/* Alert Texts */}
            <View style={styles.alertTextWrap}>
              <Text style={styles.alertHeading}>{topAlert.title}</Text>
              <Text style={styles.alertBody}>{topAlert.description}</Text>
            </View>
          </View>

          {/* View Button */}
          <View style={styles.alertActionRow}>
            <TouchableOpacity
              style={styles.viewAlertPill}
              onPress={handleViewAlert}
              activeOpacity={0.85}
            >
              <Text style={styles.viewAlertText}>View</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsRow}>
          {/* Card 1: SOS Emergency Request */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(people)/help')}
            activeOpacity={0.75}
          >
            <View style={styles.sosCircle}>
              <Text style={styles.sosCircleText}>SOS</Text>
            </View>
            <Text style={styles.actionLabel}>Emergency{'\n'}Request</Text>
          </TouchableOpacity>

          {/* Card 2: Nearest Hospitals */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(people)/locator')}
            activeOpacity={0.75}
          >
            <View style={styles.actionIconBox}>
              <Text style={styles.actionEmoji}>🏥</Text>
            </View>
            <Text style={styles.actionLabel}>Nearest{'\n'}Hospitals</Text>
          </TouchableOpacity>

          {/* Card 3: AI First Aid Assistant */}
          <TouchableOpacity
            style={styles.actionCard}
            onPress={() => router.push('/(people)/chatbot')}
            activeOpacity={0.75}
          >
            <View style={styles.aiHexBadge}>
              <View style={styles.aiHexInner}>
                <Text style={styles.aiHexText}>AI</Text>
              </View>
            </View>
            <Text style={styles.actionLabel}>Ai First aid{'\n'}Assistant</Text>
          </TouchableOpacity>
        </View>

        {/* Map Preview matching Image 3 */}
        <TouchableOpacity
          style={styles.mapContainer}
          onPress={() => router.push('/(people)/locator')}
          activeOpacity={0.9}
        >
          {/* Stylized dark-mode road network background */}
          <View style={styles.mapGridBackground}>
            {/* Road lines simulation */}
            <View style={styles.mapRoad1} />
            <View style={styles.mapRoad2} />
            <View style={styles.mapRoad3} />
            <View style={styles.mapRoad4} />
            <View style={styles.mapRoad5} />
            <View style={styles.mapRoad6} />
            <View style={styles.mapRoadCurve1} />
            <View style={styles.mapRoadCurve2} />

            {/* Glowing Red Location Pins matching Image 3 */}
            <View style={[styles.mapPinWrap, { top: '22%', left: '26%' }]}>
              <Text style={styles.mapPin}>📍</Text>
            </View>
            <View style={[styles.mapPinWrap, { top: '56%', left: '38%' }]}>
              <Text style={styles.mapPin}>📍</Text>
            </View>
            <View style={[styles.mapPinWrap, { top: '57%', left: '53%' }]}>
              <Text style={styles.mapPin}>📍</Text>
            </View>
            <View style={[styles.mapPinWrap, { top: '68%', left: '51%' }]}>
              <Text style={styles.mapPin}>📍</Text>
            </View>
            <View style={[styles.mapPinWrap, { top: '55%', left: '64%' }]}>
              <Text style={styles.mapPin}>📍</Text>
            </View>
          </View>
        </TouchableOpacity>

        {/* Emergency Numbers Section */}
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>Emergency Numbers</Text>
        </View>

        <View style={styles.emergencyRow}>
          {/* 1990 Suwa Seriya */}
          <TouchableOpacity
            style={styles.emergencyCard}
            onPress={() => handleCall('1990')}
            activeOpacity={0.75}
          >
            <Text style={styles.emergencyNumber}>1990</Text>
            <Text style={styles.emergencyName}>Suwa Seriya</Text>
            <View style={styles.emergencyIconWrap}>
              <Text style={styles.ambulanceIcon}>🚑</Text>
            </View>
          </TouchableOpacity>

          {/* 110 Fire Service */}
          <TouchableOpacity
            style={styles.emergencyCard}
            onPress={() => handleCall('110')}
            activeOpacity={0.75}
          >
            <Text style={styles.emergencyNumber}>110</Text>
            <Text style={styles.emergencyName}>Fire Service</Text>
            <View style={styles.emergencyIconWrap}>
              <Text style={styles.fireIcon}>🔥</Text>
            </View>
          </TouchableOpacity>

          {/* 119 Police */}
          <TouchableOpacity
            style={styles.emergencyCard}
            onPress={() => handleCall('119')}
            activeOpacity={0.75}
          >
            <Text style={styles.emergencyNumber}>119</Text>
            <Text style={styles.emergencyName}>Police</Text>
            <View style={styles.emergencyIconWrap}>
              <Text style={styles.policeIcon}>👮</Text>
            </View>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* Bottom Navigation */}
      <BottomNav currentTab="home" />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 14,
    paddingBottom: 8,
    backgroundColor: '#FFFFFF',
  },
  headerIconButton: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotsIcon: {
    fontSize: 22,
    fontWeight: '700',
    color: '#0F172A',
  },
  headerTitleGroup: {
    alignItems: 'center',
  },
  headerBrand: {
    fontSize: 21,
    fontFamily: Fonts.bold,
    color: '#DC2626',
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  headerSub: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#64748B',
    marginTop: 1,
  },
  headerSpacer: {
    width: 36,
  },
  scrollContent: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 10,
    paddingBottom: 24,
  },

  /* Alert Banner */
  alertBanner: {
    backgroundColor: '#DC2626',
    borderRadius: 22,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    marginBottom: 18,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.28,
    shadowRadius: 16,
    elevation: 4,
    ...(Platform.OS === 'web'
      ? ({
          backgroundImage: 'linear-gradient(135deg, #E01E2E 0%, #B91C1C 100%)',
          boxShadow: '0 8px 24px rgba(220, 38, 38, 0.25)',
        } as any)
      : {}),
  },
  alertBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIconCircle: {
    width: 58,
    height: 58,
    borderRadius: 29,
    backgroundColor: 'rgba(255, 255, 255, 0.18)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  warningTriangleOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningExclamation: {
    fontSize: 32,
  },
  alertTextWrap: {
    flex: 1,
  },
  alertHeading: {
    fontSize: 20,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  alertBody: {
    fontSize: 12.5,
    fontFamily: Fonts.medium,
    color: '#FFE4E6',
    lineHeight: 17,
  },
  alertActionRow: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  viewAlertPill: {
    backgroundColor: '#FFFFFF',
    paddingVertical: 6,
    paddingHorizontal: 22,
    borderRadius: 20,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.15,
    shadowRadius: 4,
    elevation: 2,
  },
  viewAlertText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    color: '#0F172A',
  },

  /* Section Header */
  sectionHeader: {
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#0F172A',
    letterSpacing: -0.3,
  },

  /* Quick Actions */
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 16,
  },
  actionCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 18,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
        } as any)
      : {}),
  },
  sosCircle: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  sosCircleText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    letterSpacing: 0.5,
  },
  actionIconBox: {
    width: 48,
    height: 48,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
  },
  actionEmoji: {
    fontSize: 32,
  },
  aiHexBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F1F5F9',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    borderWidth: 1.5,
    borderColor: '#0F172A',
  },
  aiHexInner: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  aiHexText: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    fontWeight: '900',
    color: '#0F172A',
  },
  actionLabel: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    color: '#0F172A',
    textAlign: 'center',
    lineHeight: 16,
  },

  /* Dark Map Preview */
  mapContainer: {
    height: 175,
    borderRadius: 22,
    overflow: 'hidden',
    backgroundColor: '#111827',
    marginBottom: 18,
    borderWidth: 1,
    borderColor: '#1F2937',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.15,
    shadowRadius: 12,
    elevation: 3,
  },
  mapGridBackground: {
    flex: 1,
    backgroundColor: '#121A28',
    position: 'relative',
  },
  mapRoad1: {
    position: 'absolute',
    top: -20,
    left: '20%',
    width: 3.5,
    height: 220,
    backgroundColor: 'rgba(212, 175, 55, 0.45)',
    transform: [{ rotate: '25deg' }],
  },
  mapRoad2: {
    position: 'absolute',
    top: 40,
    left: -20,
    width: 380,
    height: 3,
    backgroundColor: 'rgba(212, 175, 55, 0.45)',
    transform: [{ rotate: '-8deg' }],
  },
  mapRoad3: {
    position: 'absolute',
    top: 100,
    left: -10,
    width: 400,
    height: 2.5,
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
    transform: [{ rotate: '12deg' }],
  },
  mapRoad4: {
    position: 'absolute',
    top: -30,
    left: '60%',
    width: 3,
    height: 240,
    backgroundColor: 'rgba(212, 175, 55, 0.45)',
    transform: [{ rotate: '-18deg' }],
  },
  mapRoad5: {
    position: 'absolute',
    top: -10,
    left: '80%',
    width: 2.5,
    height: 220,
    backgroundColor: 'rgba(212, 175, 55, 0.35)',
    transform: [{ rotate: '35deg' }],
  },
  mapRoad6: {
    position: 'absolute',
    top: 140,
    left: '10%',
    width: 280,
    height: 2,
    backgroundColor: 'rgba(212, 175, 55, 0.30)',
  },
  mapRoadCurve1: {
    position: 'absolute',
    top: 30,
    left: '30%',
    width: 140,
    height: 100,
    borderRadius: 70,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.30)',
  },
  mapRoadCurve2: {
    position: 'absolute',
    bottom: -20,
    left: '45%',
    width: 120,
    height: 80,
    borderRadius: 60,
    borderWidth: 2,
    borderColor: 'rgba(212, 175, 55, 0.25)',
  },
  mapPinWrap: {
    position: 'absolute',
    alignItems: 'center',
    justifyContent: 'center',
  },
  mapPin: {
    fontSize: 22,
  },

  /* Emergency Numbers */
  emergencyRow: {
    flexDirection: 'row',
    gap: 10,
    marginBottom: 10,
  },
  emergencyCard: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F1F5F9',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 16px rgba(15, 23, 42, 0.06)',
        } as any)
      : {}),
  },
  emergencyNumber: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    fontWeight: '800',
    color: '#0F172A',
    marginBottom: 2,
  },
  emergencyName: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    color: '#475569',
    marginBottom: 10,
    textAlign: 'center',
  },
  emergencyIconWrap: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ambulanceIcon: {
    fontSize: 28,
  },
  fireIcon: {
    fontSize: 28,
  },
  policeIcon: {
    fontSize: 28,
  },
});
