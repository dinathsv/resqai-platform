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

const OPENWEATHER_API_KEY = process.env.EXPO_PUBLIC_OPENWEATHER_API_KEY || '882c9e6e37b9947d6d7ac859be36a1a7';

interface AlertItem {
  alert_id: string;
  disaster_type: string;
  severity: number;
  district: string;
  created_at: string;
  description?: string;
}

interface WeatherData {
  temp: number;
  feelsLike: number;
  humidity: number;
  windSpeed: number;
  description: string;
  icon: string;
  cityName: string;
  main: string;
}

// Weather icon mapping to emoji for cross-platform support
const getWeatherEmoji = (main: string): string => {
  const map: Record<string, string> = {
    Clear: '☀️',
    Clouds: '☁️',
    Rain: '🌧️',
    Drizzle: '🌦️',
    Thunderstorm: '⛈️',
    Snow: '❄️',
    Mist: '🌫️',
    Smoke: '🌫️',
    Haze: '🌫️',
    Dust: '🌪️',
    Fog: '🌁',
    Sand: '🌪️',
    Ash: '🌋',
    Squall: '💨',
    Tornado: '🌪️',
  };
  return map[main] || '🌤️';
};

// Weather-based gradient colors for the card
const getWeatherColors = (main: string, isDark: boolean): { bg: string; accent: string; text: string } => {
  const colors: Record<string, { bg: string; accent: string; text: string }> = {
    Clear: { bg: isDark ? 'rgba(251, 191, 36, 0.12)' : 'rgba(251, 191, 36, 0.10)', accent: '#FBBF24', text: isDark ? '#FDE68A' : '#92400E' },
    Clouds: { bg: isDark ? 'rgba(148, 163, 184, 0.12)' : 'rgba(148, 163, 184, 0.10)', accent: '#94A3B8', text: isDark ? '#CBD5E1' : '#475569' },
    Rain: { bg: isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.10)', accent: '#3B82F6', text: isDark ? '#93C5FD' : '#1E40AF' },
    Drizzle: { bg: isDark ? 'rgba(96, 165, 250, 0.12)' : 'rgba(96, 165, 250, 0.10)', accent: '#60A5FA', text: isDark ? '#BFDBFE' : '#1E3A8A' },
    Thunderstorm: { bg: isDark ? 'rgba(139, 92, 246, 0.12)' : 'rgba(139, 92, 246, 0.10)', accent: '#8B5CF6', text: isDark ? '#C4B5FD' : '#5B21B6' },
    Snow: { bg: isDark ? 'rgba(186, 230, 253, 0.12)' : 'rgba(186, 230, 253, 0.15)', accent: '#BAE6FD', text: isDark ? '#E0F2FE' : '#0C4A6E' },
    Mist: { bg: isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(148, 163, 184, 0.08)', accent: '#94A3B8', text: isDark ? '#CBD5E1' : '#475569' },
    Haze: { bg: isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(148, 163, 184, 0.08)', accent: '#94A3B8', text: isDark ? '#CBD5E1' : '#475569' },
    Fog: { bg: isDark ? 'rgba(148, 163, 184, 0.10)' : 'rgba(148, 163, 184, 0.08)', accent: '#94A3B8', text: isDark ? '#CBD5E1' : '#475569' },
  };
  return colors[main] || colors.Clear;
};

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
  const [weather, setWeather] = useState<WeatherData | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(true);
  const [weatherError, setWeatherError] = useState<string | null>(null);
  
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  const fetchUserLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') return;
      const location = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High });
      setUserLocation({ lat: location.coords.latitude, lng: location.coords.longitude });
    } catch (err: any) {
      console.warn('Location fetch failed:', err?.message || 'Permission denied or unavailable');
      setUserLocation({ lat: 6.9271, lng: 79.8612 }); // Fallback to Colombo
    } finally {
      setLoadingLocation(false);
    }
  };

  // Fetch weather data when user location is available
  const fetchWeather = useCallback(async (lat: number, lng: number) => {
    setWeatherLoading(true);
    setWeatherError(null);
    try {
      const response = await fetch(
        `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lng}&appid=${OPENWEATHER_API_KEY}&units=metric`
      );
      if (!response.ok) throw new Error('Weather fetch failed');
      const data = await response.json();
      setWeather({
        temp: Math.round(data.main.temp),
        feelsLike: Math.round(data.main.feels_like),
        humidity: data.main.humidity,
        windSpeed: Math.round(data.wind.speed * 3.6), // Convert m/s to km/h
        description: data.weather[0].description,
        icon: data.weather[0].icon,
        cityName: data.name,
        main: data.weather[0].main,
      });
    } catch (err: any) {
      console.error('Weather fetch error:', err);
      setWeatherError('Unable to load weather');
    } finally {
      setWeatherLoading(false);
    }
  }, []);

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

  // Fetch weather whenever location updates
  useEffect(() => {
    if (userLocation) {
      fetchWeather(userLocation.lat, userLocation.lng);
    }
  }, [userLocation, fetchWeather]);

  useEffect(() => {
    let mounted = true;

    async function setupSocket() {
      try {
        const socket = await connectSocket();
        if (!socket) return;

        const onAlertReceived = (alert: any) => {
          if (!mounted) return;
          setAlerts((prev) => [alert, ...prev]);
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

  const weatherColors = weather ? getWeatherColors(weather.main, theme.isDark) : null;

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
      <TopBar transparent={false} />

      <ScrollView
        style={styles.scrollContent}
        contentContainerStyle={styles.scrollInner}
        showsVerticalScrollIndicator={false}
      >
        {/* Weather Widget */}
        <View style={[
          styles.weatherCard,
          {
            backgroundColor: weatherColors?.bg || theme.surfaceElevated,
            borderColor: weatherColors?.accent ? `${weatherColors.accent}40` : theme.border,
          },
        ]}>
          {weatherLoading ? (
            <View style={styles.weatherLoading}>
              <ActivityIndicator size="small" color={theme.accent} />
              <Text style={[styles.weatherLoadingText, { color: theme.textMuted }]}>Loading weather...</Text>
            </View>
          ) : weatherError ? (
            <View style={styles.weatherLoading}>
              <Text style={{ fontSize: 28 }}>🌤️</Text>
              <Text style={[styles.weatherLoadingText, { color: theme.textMuted }]}>{weatherError}</Text>
              <TouchableOpacity
                onPress={() => userLocation && fetchWeather(userLocation.lat, userLocation.lng)}
                style={[styles.weatherRetryBtn, { borderColor: theme.border }]}
              >
                <Text style={[styles.weatherRetryText, { color: theme.accent }]}>Retry</Text>
              </TouchableOpacity>
            </View>
          ) : weather ? (
            <>
              {/* Top Row: Emoji + Temp + Location */}
              <View style={styles.weatherTopRow}>
                <Text style={styles.weatherEmoji}>{getWeatherEmoji(weather.main)}</Text>
                <View style={styles.weatherTempBlock}>
                  <Text style={[styles.weatherTemp, { color: theme.textPrimary }]}>
                    {weather.temp}°C
                  </Text>
                  <Text style={[styles.weatherFeelsLike, { color: theme.textMuted }]}>
                    Feels like {weather.feelsLike}°C
                  </Text>
                </View>
                <View style={styles.weatherLocationBlock}>
                  <Text style={[styles.weatherCity, { color: theme.textPrimary }]}>📍 {weather.cityName}</Text>
                  <Text style={[styles.weatherDesc, { color: weatherColors?.text || theme.textSecondary }]}>
                    {weather.description.charAt(0).toUpperCase() + weather.description.slice(1)}
                  </Text>
                </View>
              </View>

              {/* Divider */}
              <View style={[styles.weatherDivider, { backgroundColor: theme.border }]} />

              {/* Bottom Row: Stats */}
              <View style={styles.weatherStatsRow}>
                <View style={styles.weatherStat}>
                  <Text style={styles.weatherStatIcon}>💧</Text>
                  <Text style={[styles.weatherStatValue, { color: theme.textPrimary }]}>{weather.humidity}%</Text>
                  <Text style={[styles.weatherStatLabel, { color: theme.textMuted }]}>Humidity</Text>
                </View>
                <View style={[styles.weatherStatDivider, { backgroundColor: theme.border }]} />
                <View style={styles.weatherStat}>
                  <Text style={styles.weatherStatIcon}>💨</Text>
                  <Text style={[styles.weatherStatValue, { color: theme.textPrimary }]}>{weather.windSpeed} km/h</Text>
                  <Text style={[styles.weatherStatLabel, { color: theme.textMuted }]}>Wind</Text>
                </View>
                <View style={[styles.weatherStatDivider, { backgroundColor: theme.border }]} />
                <View style={styles.weatherStat}>
                  <Text style={styles.weatherStatIcon}>🌡️</Text>
                  <Text style={[styles.weatherStatValue, { color: theme.textPrimary }]}>{weather.feelsLike}°C</Text>
                  <Text style={[styles.weatherStatLabel, { color: theme.textMuted }]}>Feels Like</Text>
                </View>
              </View>
            </>
          ) : null}
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

  /* Weather Card */
  weatherCard: {
    borderRadius: 14,
    paddingHorizontal: 18,
    paddingVertical: 16,
    marginBottom: 18,
    borderWidth: 1,
  },
  weatherLoading: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 20,
    gap: 8,
  },
  weatherLoadingText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
  },
  weatherRetryBtn: {
    marginTop: 4,
    paddingVertical: 6,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  weatherRetryText: {
    fontSize: 12,
    fontFamily: Fonts.semiBold,
  },
  weatherTopRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  weatherEmoji: {
    fontSize: 40,
  },
  weatherTempBlock: {
    marginRight: 'auto' as any,
  },
  weatherTemp: {
    fontSize: 28,
    fontFamily: Fonts.bold,
    fontWeight: '700',
    letterSpacing: -1,
  },
  weatherFeelsLike: {
    fontSize: 11,
    fontFamily: Fonts.medium,
    marginTop: 1,
  },
  weatherLocationBlock: {
    alignItems: 'flex-end',
  },
  weatherCity: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  weatherDesc: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  weatherDivider: {
    height: 1,
    marginVertical: 12,
    opacity: 0.5,
  },
  weatherStatsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
  },
  weatherStat: {
    flex: 1,
    alignItems: 'center',
  },
  weatherStatIcon: {
    fontSize: 18,
    marginBottom: 4,
  },
  weatherStatValue: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    fontWeight: '600',
  },
  weatherStatLabel: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    marginTop: 2,
  },
  weatherStatDivider: {
    width: 1,
    height: 30,
    opacity: 0.4,
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
    padding: 0,
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
