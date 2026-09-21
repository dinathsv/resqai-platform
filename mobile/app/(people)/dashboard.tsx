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
  Image,
  ActivityIndicator,
} from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { connectSocket, disconnectSocket } from '../../config/socket';
import { Colors, Fonts } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import BottomNav from '../../components/BottomNav';
import TopBar from '../../components/TopBar';


interface AlertItem {
  alert_id: string;
  disaster_type: string;
  severity: number;
  district: string;
  created_at: string;
  description?: string;
}

function EmergencyGlow() {
  return (
    <View style={styles.emergencyGlow} pointerEvents="none">
      <View style={[styles.glowCircle, styles.glowOuter]}>
        <View style={[styles.glowCircle, styles.glowMiddle]}>
          <View style={[styles.glowCircle, styles.glowInner]}>
            <View style={[styles.glowCircle, styles.glowCore]} />
          </View>
        </View>
      </View>
    </View>
  );
}

export default function DashboardScreen() {
  const { theme } = useTheme();
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
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const fetchUserLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
    } catch (err) {
      console.error('Location error:', err);
    } finally {
      setLoadingLocation(false);
    }
  };

  useEffect(() => {
    let mounted = true;

    fetchUserLocation();

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
            const typeCapitalized = first.disaster_type
              ? first.disaster_type.charAt(0).toUpperCase() + first.disaster_type.slice(1)
              : 'Flood';
            setTopAlert({
              title: `${typeCapitalized} Alert`,
              description:
                first.work_plan ||
                first.description ||
                (first.district ? `Severe conditions reported in ${first.district}` : 'Heavy rainfall and strong winds in western province'),
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

        const onAlertReceived = (alert: any) => {
          if (!mounted) return;
          setAlerts((prev) => [alert, ...prev]);
          const typeCapitalized = alert.disaster_type
            ? alert.disaster_type.charAt(0).toUpperCase() + alert.disaster_type.slice(1)
            : 'Emergency';
          setTopAlert({
            title: `${typeCapitalized} Alert`,
            description:
              alert.work_plan ||
              alert.description ||
              (alert.district ? `Severe conditions reported in ${alert.district}` : 'Emergency warning issued by Disaster Management Centre'),
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar transparent={false} />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Disaster Alert Banner */}
        <View style={[styles.alertBanner, { backgroundColor: theme.emergencyLight, borderColor: theme.emergency }]}>
          <View style={styles.alertBannerRow}>
            <View style={[styles.alertIconCircle, { backgroundColor: theme.emergency }]}>
              <View style={styles.warningTriangleOuter}>
                <Text style={styles.warningExclamation}>⬡</Text>
              </View>
            </View>

            <View style={styles.alertTextWrap}>
              <Text style={[styles.alertHeading, { color: theme.emergency }]}>{topAlert.title}</Text>
              <Text style={[styles.alertBody, { color: theme.textSecondary }]}>{topAlert.description}</Text>
            </View>
          </View>

          <View style={styles.alertActionRow}>
            <TouchableOpacity
              style={[styles.viewAlertPill, { backgroundColor: theme.emergency }]}
              onPress={handleViewAlert}
              activeOpacity={0.85}
            >
              <Text style={[styles.viewAlertText, { color: '#FFFFFF' }]}>View Details</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Quick Actions Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Quick Actions</Text>
        </View>

        <View style={styles.quickActionsGrid}>
          <View style={styles.quickActionsRow}>
            {/* Card 1: SOS Emergency Request */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/(people)/help')}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCardWrap}>
                <Image
                  source={require('../../assets/SOS.png')}
                  style={styles.actionIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>Emergency{'\n'}Request</Text>
            </TouchableOpacity>

            {/* Card 2: Nearest Hospitals */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/(people)/locator')}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCardWrap}>
                <Image
                  source={require('../../assets/Hospital.png')}
                  style={styles.actionIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>Nearest{'\n'}Hospitals</Text>
            </TouchableOpacity>
          </View>

          <View style={styles.quickActionsRow}>
            {/* Card 3: AI First Aid Assistant */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/(people)/chatbot')}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCardWrap}>
                <Image
                  source={require('../../assets/Chatbot.png')}
                  style={styles.actionIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>AI First Aid{'\n'}Assistant</Text>
            </TouchableOpacity>

            {/* Card 4: AI Disaster Prediction */}
            <TouchableOpacity
              style={[styles.actionCard, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => router.push('/(people)/prediction')}
              activeOpacity={0.75}
            >
              <View style={styles.actionIconCardWrap}>
                <Image
                  source={require('../../assets/Map.png')}
                  style={styles.actionIconImage}
                  resizeMode="contain"
                />
              </View>
              <Text style={[styles.actionLabel, { color: theme.textPrimary }]}>Disaster{'\n'}Prediction</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Map Preview matching Image 3 */}
        <TouchableOpacity
          style={[styles.mapContainer, { backgroundColor: theme.surfaceElevated, borderColor: theme.border }]}
          onPress={() => router.push('/(people)/locator')}
          activeOpacity={0.9}
        >
          {loadingLocation ? (
             <View style={styles.mapGridBackground}>
                <ActivityIndicator size="large" color={theme.brandActive} />
                <Text style={[styles.sectionTitle, { color: theme.textMuted, marginTop: 10 }]}>Detecting GPS...</Text>
             </View>
          ) : userLocation ? (
            Platform.OS === 'web' ? (
              <iframe
                title="Live Dashboard Map"
                src={process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ? `https://www.google.com/maps/embed/v1/place?key=${process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY}&q=${userLocation.lat},${userLocation.lng}&zoom=11` : `https://maps.google.com/maps?q=${userLocation.lat},${userLocation.lng}&hl=en&z=11&output=embed`}
                style={{ width: '100%', height: '100%', border: 'none', borderRadius: 20 }}
                loading="lazy"
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            ) : (
              <View style={styles.mapGridBackground}>
                <Text style={{ fontSize: 36, marginBottom: 6 }}>🗺️</Text>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Tap to open full map</Text>
              </View>
            )
          ) : (
             <View style={styles.mapGridBackground}>
                <Text style={{ fontSize: 36, marginBottom: 6 }}>📍</Text>
                <Text style={[styles.sectionTitle, { color: theme.textMuted }]}>Location unavailable</Text>
             </View>
          )}
        </TouchableOpacity>

        {/* Emergency Numbers Section */}
        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: theme.textPrimary }]}>Emergency Numbers</Text>
        </View>

        <View style={styles.emergencyRow}>
          {/* 1990 Suwa Seriya */}
          <TouchableOpacity
            style={styles.emergencyCard}
            onPress={() => handleCall('1990')}
            activeOpacity={0.75}
          >
            <View style={styles.emergencyIconWrap}>
              <Image source={require('../../assets/1990_Suwa_Seriya.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </View>
          </TouchableOpacity>

          {/* 110 Fire Service */}
          <TouchableOpacity
            style={styles.emergencyCard}
            onPress={() => handleCall('110')}
            activeOpacity={0.75}
          >
            <View style={styles.emergencyIconWrap}>
              <Image source={require('../../assets/110_Fire_Service.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
            </View>
          </TouchableOpacity>

          {/* 119 Police */}
          <TouchableOpacity
            style={styles.emergencyCard}
            onPress={() => handleCall('119')}
            activeOpacity={0.75}
          >
            <View style={styles.emergencyIconWrap}>
              <Image source={require('../../assets/119_police.png')} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
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
  },
  topHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: Platform.OS === 'ios' ? 8 : 14,
    paddingBottom: 8,
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
  },
  scrollInner: {
    paddingHorizontal: 16,
    paddingTop: 12,
    paddingBottom: 24,
  },

  alertBanner: {
    borderRadius: 12,
    paddingHorizontal: 18,
    paddingTop: 18,
    paddingBottom: 14,
    marginBottom: 18,
    borderWidth: 1,
  },
  alertBannerRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  alertIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 14,
  },
  warningTriangleOuter: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  warningExclamation: {
    fontSize: 24,
    color: '#FFFFFF',
  },
  alertTextWrap: {
    flex: 1,
  },
  alertHeading: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    marginBottom: 4,
  },
  alertBody: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    lineHeight: 18,
  },
  alertActionRow: {
    alignItems: 'flex-end',
    marginTop: 8,
  },
  viewAlertPill: {
    paddingVertical: 8,
    paddingHorizontal: 20,
    borderRadius: 8,
  },
  viewAlertText: {
    fontSize: 13,
    fontFamily: Fonts.bold,
  },

  /* Section Header */
  sectionHeader: {
    marginBottom: 10,
    marginTop: 4,
  },
  sectionTitle: {
    fontSize: 15,
    fontFamily: Fonts.semiBold,
    letterSpacing: -0.2,
  },

  /* Quick Actions */
  quickActionsGrid: {
    marginBottom: 16,
    gap: 10,
  },
  quickActionsRow: {
    flexDirection: 'row',
    gap: 10,
  },
  actionCard: {
    flex: 1,
    borderRadius: 12,
    paddingVertical: 16,
    paddingHorizontal: 8,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  actionIconCardWrap: {
    width: 52,
    height: 52,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 8,
  },
  actionIconImage: {
    width: 48,
    height: 48,
  },
  actionLabel: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    textAlign: 'center',
    lineHeight: 18,
  },

  /* Dark Map Preview */
  mapContainer: {
    height: 175,
    borderRadius: 12,
    overflow: 'hidden',
    marginBottom: 18,
    borderWidth: 1,
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
    borderRadius: 12,
    height: 120,
    overflow: 'hidden',
    position: 'relative',
  },
  emergencyGlow: {
    ...StyleSheet.absoluteFill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowCircle: {
    width: 190,
    height: 190,
    borderRadius: 95,
    alignItems: 'center',
    justifyContent: 'center',
  },
  glowOuter: {
    position: 'absolute',
    backgroundColor: 'rgba(10, 132, 255, 0.03)',
  },
  glowMiddle: {
    width: 150,
    height: 150,
    borderRadius: 75,
    backgroundColor: 'rgba(10, 132, 255, 0.05)',
  },
  glowInner: {
    width: 110,
    height: 110,
    borderRadius: 55,
    backgroundColor: 'rgba(10, 132, 255, 0.08)',
  },
  glowCore: {
    width: 76,
    height: 76,
    borderRadius: 38,
    backgroundColor: 'rgba(10, 132, 255, 0.12)',
  },
  emergencyNumber: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    marginBottom: 0,
  },
  emergencyName: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    textAlign: 'center',
  },
  emergencyIconWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    top: 0,
    bottom: 0,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  emergencyTextWrap: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'flex-end',
  },
  ambulanceIcon: {
    fontSize: 24,
  },
  fireIcon: {
    fontSize: 24,
  },
  policeIcon: {
    fontSize: 24,
  },
});
