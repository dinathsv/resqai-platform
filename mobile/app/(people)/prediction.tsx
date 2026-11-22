import { SafeAreaView } from 'react-native-safe-area-context';
import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Linking,
  ActivityIndicator,
  Animated,
  TextInput,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { Fonts } from '../../constants/theme';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import TopBar from '../../components/TopBar';
import LocationMap from '../../components/LocationMap';
import BottomNav from '../../components/BottomNav';
import {
  fetchDistricts,
  fetchMLHealth,
  predictDisasterRisk,
  predictAutomaticRisk,
  PredictionServiceError,
  DISTRICT_COORDS,
  type PredictionResult,
} from '../../services/mlService';

const USE_NATIVE_DRIVER = Platform.OS !== 'web';

// ── Color palette (clean mobile) ──
const C = {
  white:       '#FFFFFF',
  bg:          '#F8FAFC',
  card:        '#FFFFFF',
  border:      '#F1F5F9',
  borderMed:   '#E2E8F0',
  textDark:    '#0F172A',
  textMid:     '#475569',
  textLight:   '#94A3B8',
  brand:       '#164F43',
  brandActive: '#26745F',
  red:         '#DC2626',
  redLight:    '#FEF2F2',
  redBorder:   '#FECACA',
  amber:       '#F59E0B',
  amberLight:  '#FFFBEB',
  amberBorder: '#FDE68A',
  yellow:      '#EAB308',
  yellowLight: '#FEFCE8',
  green:       '#059669',
  greenLight:  '#ECFDF5',
  greenBorder: '#A7F3D0',
  blue:        '#2563EB',
  blueLight:   '#EFF6FF',
};

export default function PredictionScreen() {
  const { theme } = useTheme();
  const { t, formatDate } = useLanguage();
  const router = useRouter();
  const cardTheme = { backgroundColor: theme.surface, borderColor: theme.border };

  // --- State ---
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [peak24h, setPeak24h] = useState('');
  const [manualMode, setManualMode] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [showDetails, setShowDetails] = useState(false);
  const [error, setError] = useState('');
  const [locationError, setLocationError] = useState('');
  const [now, setNow] = useState(Date.now());

  // Live location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const locationRequest = useRef(0);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Hardcoded fallback so the picker always works, even if the ML API is offline
  const FALLBACK_DISTRICTS = Object.keys(DISTRICT_COORDS).sort();

  // GPS is requested only after the person chooses to use their location.
  useEffect(() => {
    (async () => {
      try {
        const [distList] = await Promise.all([
          fetchDistricts(),
          fetchMLHealth().then(() => setApiHealthy(true)).catch(() => setApiHealthy(false)),
        ]);
        setDistricts(distList);
      } catch {
        setApiHealthy(false);
        setDistricts(FALLBACK_DISTRICTS);
      }
    })();
    return () => { locationRequest.current += 1; };
  }, []);

  const fetchUserLocation = async () => {
    if (loading || loadingLocation) return;
    if (!selectedDistrict) {
      setError(t('prediction.selectDistrictPrompt'));
      return;
    }
    const requestId = ++locationRequest.current;
    setLoadingLocation(true);
    setLocationError('');
    setError('');
    setUserLocation(null);
    setResult(null);
    try {
      let coords: { latitude: number; longitude: number };
      if (Platform.OS === 'web') {
        if (!navigator.geolocation) throw new Error('Location unavailable');
        coords = await new Promise((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(
            ({ coords: position }) => resolve(position),
            reject,
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 }
          );
        });
      } else {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') throw new Error('Location permission denied');
        const location = await new Promise<Location.LocationObject>((resolve, reject) => {
          const timer = setTimeout(() => reject(new Error('Location request timed out')), 12000);
          Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }).then(
            (position) => { clearTimeout(timer); resolve(position); },
            (err) => { clearTimeout(timer); reject(err); },
          );
        });
        coords = location.coords;
      }
      if (requestId !== locationRequest.current) return;
      // Keep the scope of this Sri Lankan district model explicit.
      if (coords.latitude < 5.8 || coords.latitude > 9.9 || coords.longitude < 79.5 || coords.longitude > 82.0) {
        setLocationError(t('prediction.locationOutsideSriLanka'));
        return;
      }
      setUserLocation({ lat: coords.latitude, lng: coords.longitude });
      setResult(null);
    } catch {
      if (requestId === locationRequest.current) setLocationError(t('prediction.locationUnavailable'));
    } finally {
      if (requestId === locationRequest.current) setLoadingLocation(false);
    }
  };

  useEffect(() => {
    if (!result?.weather) return;
    const timer = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(timer);
  }, [result]);

  const weatherExpired = Boolean(result?.weather && Date.parse(result.weather.expires_at) <= now);
  const weatherTime = (value: string) => formatDate(value, {
    year: 'numeric', month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit', timeZone: 'Asia/Colombo',
  });

  // Pulse animation for alert levels
  useEffect(() => {
    const isMajor =
      result?.prediction?.flood_status === 'Major Flood' ||
      result?.prediction?.flood_category?.includes('Critical') ||
      result?.prediction?.flood_category?.includes('High');
    if (result && ((result.nbro_landslide_alert?.level ?? 0) >= 2 || isMajor)) {
      const pulse = Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      );
      pulse.start();
      return () => { pulse.stop(); pulseAnim.setValue(1); };
    }
  }, [result, pulseAnim]);

  const animateResultsIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, []);

  const handlePredict = async () => {
    if (loading || loadingLocation) return;
    if (!selectedDistrict) {
      setError(t('prediction.selectDistrictPrompt'));
      return;
    }
    const rainfall = Number(peak24h);
    if (manualMode && (!peak24h.trim() || !Number.isFinite(rainfall) || rainfall < 0)) {
      setError(t('prediction.invalidManualRainfall'));
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);
    setShowDetails(false);

    try {
      const res = manualMode
        ? await predictDisasterRisk({ district: selectedDistrict, peak_24h_rain_mm: rainfall })
        : await predictAutomaticRisk({
          district: selectedDistrict,
          ...(userLocation ? { latitude: userLocation.lat, longitude: userLocation.lng } : {}),
        });
      setResult(manualMode ? { ...res, mode: 'manual' } : res);
      setNow(Date.now());
      setApiHealthy(true);
      animateResultsIn();
    } catch (e) {
      const code = e instanceof PredictionServiceError ? e.code : '';
      setError(t(code === 'weather_unavailable' ? 'prediction.weatherUnavailable'
        : code === 'invalid_location' ? 'prediction.invalidLocation'
          : code === 'connection_error' ? 'prediction.connectionError'
            : code === 'prediction_timeout' ? 'prediction.requestTimeout'
              : 'prediction.predictionUnavailable'));
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setShowDetails(false);
    setError('');
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(people)/dashboard');
  };

  // --- Map helpers ---
  const getMapCenter = () => {
    if (result) {
      if (result.location) return { lat: result.location.latitude, lng: result.location.longitude };
      const coords = DISTRICT_COORDS[result.district];
      if (coords) return coords;
    }
    if (userLocation) return userLocation;
    if (selectedDistrict && DISTRICT_COORDS[selectedDistrict]) return DISTRICT_COORDS[selectedDistrict];
    return { lat: 7.8731, lng: 80.7718 }; // Sri Lanka center
  };

  // --- Color helpers ---
  const getFloodColor = (status?: string) => {
    if (!status) return C.green;
    if (status.includes('Critical') || status === 'Major Flood') return C.red;
    if (status.includes('High') || status === 'Minor Flood') return C.amber;
    if (status.includes('Advisory')) return C.yellow;
    return C.green;
  };
  const getFloodBg = (status?: string) => {
    if (theme.isDark) {
      if (!status) return 'rgba(5, 150, 105, 0.18)';
      if (status.includes('Critical') || status === 'Major Flood') return 'rgba(220, 38, 38, 0.18)';
      if (status.includes('High') || status === 'Minor Flood') return 'rgba(245, 158, 11, 0.18)';
      if (status.includes('Advisory')) return 'rgba(234, 179, 8, 0.18)';
      return 'rgba(5, 150, 105, 0.18)';
    }
    if (!status) return C.greenLight;
    if (status.includes('Critical') || status === 'Major Flood') return C.redLight;
    if (status.includes('High') || status === 'Minor Flood') return C.amberLight;
    if (status.includes('Advisory')) return C.yellowLight;
    return C.greenLight;
  };
  const getFloodBorder = (status?: string) => {
    if (theme.isDark) return getFloodColor(status);
    if (!status) return C.greenBorder;
    if (status.includes('Critical') || status === 'Major Flood') return C.redBorder;
    if (status.includes('High') || status === 'Minor Flood') return C.amberBorder;
    if (status.includes('Advisory')) return C.amberBorder;
    return C.greenBorder;
  };
  const getFloodEmoji = (status?: string) => {
    if (!status) return '✅';
    if (status.includes('Critical') || status === 'Major Flood') return '🌊';
    if (status.includes('High') || status === 'Minor Flood') return '💧';
    if (status.includes('Advisory')) return '⚠️';
    return '✅';
  };
  const getHazardColor = (index: number) => {
    if (index > 2 ? index >= 60 : index >= 2) return C.red;
    if (index > 2 ? index >= 25 : index >= 1) return C.amber;
    return C.green;
  };
  const getNBROColor = (level: number) => {
    if (level >= 3) return C.red;
    if (level >= 2) return C.amber;
    if (level >= 1) return C.yellow;
    return C.green;
  };
  const getNBROBg = (level: number) => {
    if (level >= 3) return C.redLight;
    if (level >= 2) return C.amberLight;
    if (level >= 1) return C.yellowLight;
    return C.greenLight;
  };
  const getNBROEmoji = (level: number) => {
    if (level >= 3) return '🔴';
    if (level >= 2) return '🟠';
    if (level >= 1) return '🟡';
    return '🟢';
  };

  // ────────────── Render Sections ──────────────

  const districtList = districts.length > 0 ? districts : FALLBACK_DISTRICTS;
  const hasElevatedRisk = Boolean(result && (
    getFloodColor(result.prediction.flood_status || result.prediction.flood_category) !== C.green ||
    (result.nbro_landslide_alert?.level ?? 0) > 0
  ));

  const renderDistrictPicker = () => (
    <View style={{ zIndex: 10, position: 'relative' }}>
      <Text style={[s.inputLabel, { color: theme.textMuted }]}>{t('prediction.selectDistrict')}</Text>
      <TouchableOpacity
        style={[s.pickerButton, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
        onPress={() => setShowDistrictPicker(!showDistrictPicker)}
        disabled={loading}
        activeOpacity={0.7}
      >
        <Text style={[s.pickerText, !selectedDistrict ? { color: theme.textMuted } : { color: theme.textPrimary }]}>
          {selectedDistrict || t('prediction.selectDistrictPrompt')}
        </Text>
        <Text style={[s.pickerChevron, { color: theme.textMuted }]}>{showDistrictPicker ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showDistrictPicker && (
        <View style={[s.dropdownList, { backgroundColor: theme.surface }]}>
          <ScrollView style={s.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false} showsHorizontalScrollIndicator={false}>
            {districtList.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  s.dropdownItem,
                  { borderBottomColor: theme.border },
                  selectedDistrict === d && { backgroundColor: theme.successLight },
                ]}
                onPress={() => {
                  locationRequest.current += 1;
                  setLoadingLocation(false);
                  setSelectedDistrict(d);
                  setUserLocation(null);
                  setLocationError('');
                  setError('');
                  setResult(null);
                  setShowDistrictPicker(false);
                }}
                disabled={loading}
                activeOpacity={0.7}
              >
                <Text style={[
                  s.dropdownText,
                  { color: theme.textPrimary },
                  selectedDistrict === d && { color: theme.brandActive, fontFamily: Fonts.bold },
                ]}>
                  {d}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}
    </View>
  );

  const renderPeakRainInput = () => (
    <View style={s.peakSection}>
      <Text style={[s.inputLabel, { color: theme.textMuted }]}>{t('prediction.peakRainfallInput')}</Text>
      <View style={s.peakRow}>
        <TextInput
          style={[s.textInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
          value={peak24h}
          onChangeText={setPeak24h}
          placeholder="e.g. 125"
          placeholderTextColor={theme.textMuted}
          keyboardType="numeric"
          accessibilityLabel={t('prediction.peakRainfallInput')}
        />
      </View>
    </View>
  );

  const renderWeatherControls = () => (
    <View style={s.weatherControls}>
      <View style={[s.locationChoice, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
        <Text style={[s.locationChoiceTitle, { color: theme.textPrimary }]}>
          📍 {t(userLocation ? 'prediction.gpsLocation' : 'prediction.districtLocation')}
        </Text>
        <Text style={[s.explanation, { color: theme.textMuted }]}>
          {t(userLocation ? 'prediction.gpsLocationShort' : 'prediction.districtLocationShort')}
        </Text>
        <TouchableOpacity
          style={[s.locationButton, { borderColor: theme.brandActive }, (loading || loadingLocation) && { opacity: 0.6 }]}
          onPress={fetchUserLocation}
          disabled={loading || loadingLocation}
          activeOpacity={0.7}
        >
          {loadingLocation ? <ActivityIndicator color={theme.brandActive} size="small" />
            : <Text style={[s.locationButtonText, { color: theme.brandActive }]}>{t('prediction.useMyLocation')}</Text>}
        </TouchableOpacity>
        {userLocation && (
          <TouchableOpacity onPress={() => { setUserLocation(null); setResult(null); setLocationError(''); }} disabled={loading}>
            <Text style={[s.referenceLink, { color: theme.textSecondary }]}>{t('prediction.useDistrictLocation')}</Text>
          </TouchableOpacity>
        )}
      </View>
      {locationError ? <Text style={[s.explanation, { color: C.amber }]}>{locationError}</Text> : null}
      <Text style={[s.explanation, { color: theme.textSecondary }]}>{t('prediction.recentWeatherNotice')}</Text>
    </View>
  );

  const renderManualControls = () => (
    <View>
      <TouchableOpacity
        style={s.advancedToggle}
        onPress={() => { setManualMode(!manualMode); setError(''); setLocationError(''); }}
        disabled={loading || loadingLocation}
        activeOpacity={0.7}
      >
        <Text style={[s.advancedToggleText, { color: theme.textMuted }]}>
          {manualMode ? '▲' : '▼'} {t('prediction.manualMode')}
        </Text>
      </TouchableOpacity>
      {manualMode && (
        <View style={[s.noticeBox, { backgroundColor: theme.surfaceSubtle, borderColor: theme.border }]}>
          <Text style={[s.explanation, { color: theme.textSecondary }]}>{t('prediction.manualHelp')}</Text>
          {renderPeakRainInput()}
        </View>
      )}
    </View>
  );

  // ── Live Map Section ──
  const renderLiveMap = () => {
    const center = getMapCenter();

    return (
      <View style={[s.card, cardTheme]}>
        <View style={s.mapHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: theme.textPrimary }]}>
              📍 {t('prediction.assessmentLocation')}
            </Text>
            <Text style={[s.mapCoords, { color: theme.textMuted }]}>
              {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
            </Text>
          </View>
        </View>

        <View style={s.mapIframeWrap}>
          <LocationMap lat={center.lat} lng={center.lng} zoom={result ? 11 : 8} title="Prediction location map" />
        </View>

        <TouchableOpacity
          style={s.openMapBtn}
          onPress={() => Linking.openURL(`https://www.google.com/maps/search/?api=1&query=${center.lat},${center.lng}`)}
          activeOpacity={0.7}
        >
          <Text style={s.openMapBtnText}>{t('common.directions')} 🗺️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  // ── Flood Card ──
  const renderFloodCard = (detailsOnly = false) => {
    if (!result) return null;
    const pred = result.prediction || {};
    const flood_status = pred.flood_status || pred.flood_category || t('prediction.assessmentUnavailable');
    const flood_probabilities: Record<string, number> =
      pred.flood_probabilities || pred.flood_category_probabilities || {};
    const statusColor = getFloodColor(flood_status);
    const statusBg = getFloodBg(flood_status);
    const statusBorder = getFloodBorder(flood_status);
    const probValues = Object.values(flood_probabilities);
    const maxProb = probValues.length > 0 ? Math.max(...probValues) : 0;

    return (
      <View style={[s.card, cardTheme]}>
        <Text style={[s.cardTitle, { color: theme.textPrimary }]}>
          {detailsOnly ? t('prediction.floodProbabilities') : `${getFloodEmoji(flood_status)} ${t('prediction.floodAssessment')}`}
        </Text>
        {!detailsOnly && <View style={[s.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
          <Text style={[s.statusBadgeText, { color: statusColor }]}>{flood_status}</Text>
        </View>}

        {detailsOnly && Object.entries(flood_probabilities).map(([label, pct]) => (
          <View key={label} style={s.probRow}>
            <Text style={[s.probLabel, { color: theme.textSecondary }]}>{label.split(' (')[0]}</Text>
            <View style={[s.probBarBg, { backgroundColor: theme.surfaceSubtle }]}>
              <View
                style={[
                  s.probBarFill,
                  { width: `${Math.min(pct, 100)}%`, backgroundColor: pct === maxProb ? statusColor : C.brandActive },
                ]}
              />
            </View>
            <Text style={[s.probPct, { color: theme.textPrimary }]}>{pct}%</Text>
          </View>
        ))}
      </View>
    );
  };

  // ── Hazard Card ──
  const renderHazardCard = () => {
    if (!result) return null;
    const pred = result.prediction || {};
    const overall_hazard_level = pred.overall_hazard_level || pred.flood_category || t('prediction.assessmentUnavailable');
    const hazard_index = typeof pred.hazard_index === 'number'
      ? pred.hazard_index
      : (typeof pred.flood_risk_score === 'number' ? pred.flood_risk_score : 0);
    const hazardColor = getHazardColor(hazard_index);
    const hazardPct = hazard_index > 2 ? Math.min(hazard_index, 100) : (hazard_index / 2) * 100;

    return (
      <View style={[s.card, cardTheme]}>
        <Text style={[s.cardTitle, { color: theme.textPrimary }]}>⚡ Overall Hazard Level</Text>
        <View style={s.gaugeContainer}>
          <View style={[s.gaugeTrack, { backgroundColor: theme.surfaceSubtle }]}>
            <View style={[s.gaugeFill, { width: `${Math.max(hazardPct, 8)}%`, backgroundColor: hazardColor }]} />
          </View>
          <View style={s.gaugeLabels}>
            <Text style={[s.gaugeLabel, { color: C.green }]}>Low</Text>
            <Text style={[s.gaugeLabel, { color: C.amber }]}>Moderate</Text>
            <Text style={[s.gaugeLabel, { color: C.red }]}>Critical</Text>
          </View>
        </View>
        <View style={[s.statusBadge, { backgroundColor: hazardColor + '14', borderColor: hazardColor + '55' }]}>
          <Text style={[s.statusBadgeText, { color: hazardColor }]}>{overall_hazard_level}</Text>
        </View>
      </View>
    );
  };

  // ── NBRO Card ──
  const renderNBROCard = (detailsOnly = false) => {
    if (!result?.nbro_landslide_alert) return null;
    const alert = result.nbro_landslide_alert;
    const alertColor = getNBROColor(alert.level);
    const isUrgent = alert.level >= 2 && !detailsOnly;

    const CardWrapper = isUrgent ? Animated.View : View;
    const urgentStyle = isUrgent
      ? [s.urgentCard, { transform: [{ scale: pulseAnim }] }]
      : [s.card, cardTheme];

    return (
      <CardWrapper style={urgentStyle as any}>
        <Text style={[s.cardTitle, { color: isUrgent ? C.white : theme.textPrimary }]}>
          {getNBROEmoji(alert.level)} {t('prediction.rainfallIndicator')}
        </Text>

        {!detailsOnly && <View style={s.nbroLevelRow}>
          <View style={[s.nbroDot, { backgroundColor: isUrgent ? C.white : alertColor }]} />
          <Text style={[s.nbroStatus, { color: isUrgent ? C.white : theme.textPrimary }]}>{alert.status}</Text>
        </View>}

        {((detailsOnly && alert.level === 0) || (!detailsOnly && alert.level > 0)) && (
          <Text style={[s.nbroMessage, { color: isUrgent ? 'rgba(255,255,255,0.85)' : theme.textSecondary }]}>
            {alert.message}
          </Text>
        )}
        {detailsOnly && <Text style={[s.nbroMessage, { color: theme.textSecondary }]}>
          {t('prediction.rainfallIndicatorHelp')}
        </Text>}

        {detailsOnly && <View style={s.nbroThresholds}>
          {[
            { label: '<75', color: C.green },
            { label: '75', color: C.yellow },
            { label: '100', color: C.amber },
            { label: '150+', color: C.red },
          ].map((t, i) => (
            <View key={i} style={s.nbroThresholdItem}>
              <View style={[s.nbroThresholdDot, { backgroundColor: isUrgent ? 'rgba(255,255,255,0.7)' : t.color }]} />
              <Text style={[s.nbroThresholdText, { color: isUrgent ? 'rgba(255,255,255,0.6)' : theme.textMuted }]}>{t.label}mm</Text>
            </View>
          ))}
        </View>}
      </CardWrapper>
    );
  };

  // ── District Profile ──
  const renderDistrictProfileCard = () => {
    if (!result) return null;
    const pred = result.prediction || {};
    const peak24h = pred.rain_24h_mm ?? pred.peak_24h_rain_mm;
    const rain48h = pred.rain_48h_mm;
    const rain72h = pred.rain_72h_mm;

    const profileItems = [
      { label: 'Province', value: result.province },
      { label: 'Climatic Zone', value: result.climatic_zone },
      { label: 'River Basin', value: result.river_basin },
      { label: 'Hazard Profile', value: result.hazard_profile },
    ];
    if (peak24h !== undefined) profileItems.push({ label: t('prediction.rain24h'), value: `${peak24h} mm` });
    if (rain48h !== undefined) {
      profileItems.push({ label: t('prediction.rain48h'), value: `${rain48h} mm` });
    }
    if (rain72h !== undefined) {
      profileItems.push({ label: t('prediction.rain72h'), value: `${rain72h} mm` });
    }

    return (
      <View style={[s.card, cardTheme]}>
        <Text style={[s.cardTitle, { color: theme.textPrimary }]}>🏛️ District Profile</Text>
        {profileItems.map(({ label, value }, i, arr) => (
          <View key={label} style={[s.profileRow, { borderBottomColor: theme.border }, i === arr.length - 1 && { borderBottomWidth: 0 }]}>
            <Text style={[s.profileLabel, { color: theme.textMuted }]}>{label}</Text>
            <Text style={[s.profileValue, { color: theme.textPrimary }]}>{value}</Text>
          </View>
        ))}
      </View>
    );
  };

  const renderWeatherSource = (detailsOnly = false) => {
    if (!result) return null;
    if (result.mode === 'manual') {
      return (
        <View style={[s.noticeBox, { borderColor: C.amberBorder, backgroundColor: theme.surfaceSubtle, marginBottom: 14 }]}>
          <Text style={[s.locationChoiceTitle, { color: theme.textPrimary }]}>{t('prediction.manualResult')}</Text>
          <Text style={[s.explanation, { color: theme.textSecondary }]}>{t('prediction.manualHelp')}</Text>
        </View>
      );
    }
    const weather = result.weather;
    if (!weather) return null;
    const rain24h = result.prediction.rain_24h_mm ?? result.prediction.peak_24h_rain_mm;
    return (
      <View style={[s.card, cardTheme]}>
        <Text style={[s.cardTitle, { color: theme.textPrimary }]}>{t(detailsOnly ? 'prediction.weatherSource' : 'prediction.weatherSummary')}</Text>
        {!detailsOnly && <Text style={[s.explanation, { color: theme.textSecondary }]}>
          {t('prediction.weatherDay')}: {formatDate(weather.weather_date, { timeZone: 'Asia/Colombo' })}
        </Text>}
        {!detailsOnly && typeof rain24h === 'number' && Number.isFinite(rain24h) && (
          <Text style={[s.sourceLine, { color: theme.textPrimary }]}>{t('prediction.rain24h')}: {rain24h.toFixed(1)} mm</Text>
        )}
        {detailsOnly && <View style={s.weatherDetails}>
          <Text style={[s.explanation, { color: theme.textSecondary }]}>{weather.provider} · {weather.model}</Text>
          <Text style={[s.explanation, { color: theme.textSecondary }]}>{t('prediction.modelWeatherHelp')}</Text>
          <Text style={[s.explanation, { color: theme.textSecondary }]}>{t('prediction.completeDayNotice')}</Text>
          <Text style={[s.sourceLine, { color: theme.textSecondary }]}>
            {t('prediction.weatherWindow')}: {weatherTime(weather.period_start)} – {weatherTime(weather.period_end)} ({weather.timezone})
          </Text>
          <Text style={[s.sourceLine, { color: theme.textSecondary }]}>
            {t('prediction.weatherFetched')}: {weatherTime(weather.fetched_at)}{weather.cached ? ` · ${t('prediction.cachedWeather')}` : ''}
          </Text>
          <Text style={[s.sourceLine, { color: theme.textSecondary }]}>
            {t(result.location?.source === 'gps' ? 'prediction.gpsLocation' : 'prediction.districtLocation')}
          </Text>
          {Number.isFinite(weather.grid_latitude) && Number.isFinite(weather.grid_longitude) && (
            <Text style={[s.sourceLine, { color: theme.textSecondary }]}>
              {t('prediction.weatherGridPoint')}: {weather.grid_latitude!.toFixed(3)}, {weather.grid_longitude!.toFixed(3)}
            </Text>
          )}
        </View>}
        {!detailsOnly && weatherExpired && <Text style={[s.explanation, { color: C.red }]}>{t('prediction.weatherExpired')}</Text>}
        {!detailsOnly && <TouchableOpacity
          style={[s.locationButton, { borderColor: theme.brandActive }]}
          onPress={handlePredict}
          disabled={loading}
        >
          <Text style={[s.locationButtonText, { color: theme.brandActive }]}>{t('prediction.refreshWeather')}</Text>
        </TouchableOpacity>}
      </View>
    );
  };

  // ── Guidance ──
  const renderGuidanceCard = () => {
    if (!result || !result.actionable_guidance.length) return null;
    const pred = result.prediction || {};
    const isUrgent =
      pred.flood_status === 'Major Flood' ||
      pred.flood_category?.includes('Critical') ||
      pred.flood_category?.includes('High') ||
      (result.nbro_landslide_alert?.level ?? 0) >= 2;

    return (
      <View style={isUrgent ? s.urgentCard : [s.card, cardTheme]}>
        <Text style={[s.cardTitle, { color: isUrgent ? C.white : theme.textPrimary }]}>📢 Actionable Guidance</Text>
        {result.actionable_guidance.map((msg, i) => (
          <View key={i} style={s.guidanceItem}>
            <Text style={[s.guidanceBullet, { color: isUrgent ? C.white : C.red }]}>▸</Text>
            <Text style={[s.guidanceText, { color: isUrgent ? 'rgba(255,255,255,0.9)' : theme.textSecondary }]}>{msg}</Text>
          </View>
        ))}
      </View>
    );
  };

  // ── Emergency Contacts ──
  const renderEmergencyContactsCard = (detailsOnly = false) => {
    if (!result) return null;
    const contacts = Object.entries(result.emergency_contacts);
    const visibleContacts = detailsOnly ? contacts.slice(2) : contacts.slice(0, 2);
    if (!visibleContacts.length) return null;

    return (
      <View style={[s.card, cardTheme]}>
        <Text style={[s.cardTitle, { color: theme.textPrimary }]}>🆘 Emergency Contacts</Text>
        {visibleContacts.map(([key, value], i, arr) => {
          const phoneMatch = value.match(/[\d\-\s\/]+/);
          const phone = phoneMatch ? phoneMatch[0].trim().split('/')[0].trim().replace(/\s/g, '') : '';
          return (
            <TouchableOpacity
              key={key}
              style={[s.contactRow, { borderBottomColor: theme.border }, i === arr.length - 1 && { borderBottomWidth: 0 }]}
              onPress={() => phone && Linking.openURL(`tel:${phone}`)}
              activeOpacity={0.7}
            >
              <Text style={[s.contactLabel, { color: theme.textPrimary }]}>{value}</Text>
              {phone ? (
                <View style={s.callChip}>
                  <Text style={s.callChipText}>📞 {t('common.call')}</Text>
                </View>
              ) : null}
            </TouchableOpacity>
          );
        })}
      </View>
    );
  };

  // ────────────── Main Render ──────────────
  return (
    <SafeAreaView edges={['left', 'right', 'bottom']} style={[s.container, { backgroundColor: theme.background }]}>
      <TopBar title={t('prediction.title')} showBack onBack={handleBack} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollInner}
        showsVerticalScrollIndicator={false}
        showsHorizontalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        {/* API Health */}
        <View style={s.healthRow}>
          <View style={[s.healthDot, {
            backgroundColor: apiHealthy === true ? C.green : apiHealthy === false ? C.red : C.textLight,
          }]} />
          <Text style={[s.healthText, { color: theme.textMuted }]}>
            ML Engine {apiHealthy === true ? 'Online' : apiHealthy === false ? 'Offline' : 'Checking...'}
          </Text>
        </View>

        {/* Form */}
        {!result && (
          <View style={[s.card, cardTheme]}>
            <Text style={[s.formTitle, { color: theme.textPrimary }]}>{t('prediction.title')}</Text>
            <Text style={[s.formSubtitle, { color: theme.textSecondary }]}>{t('prediction.subtitle')}</Text>

            {renderDistrictPicker()}
            {!manualMode && renderWeatherControls()}
            {renderManualControls()}

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.predictButton, (loading || loadingLocation) && { opacity: 0.7 }]}
              onPress={handlePredict}
              disabled={loading || loadingLocation}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <Text style={s.predictButtonText}>🔍 {t(manualMode ? 'prediction.runDemonstration' : 'prediction.predictButton')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {!result && selectedDistrict && renderLiveMap()}

        {/* Results */}
        {result && (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={s.resultHeader}>
              <Text style={[s.resultDistrict, { color: theme.textPrimary }]}>{result.district}</Text>
              <Text style={[s.resultProvince, { color: theme.textSecondary }]}>
                {t(result.location?.source === 'gps' ? 'prediction.gpsLocation' : 'prediction.districtLocation')}
              </Text>
            </View>

            {result.mode === 'manual' && renderWeatherSource()}
            {!weatherExpired && renderFloodCard()}
            {result.mode !== 'manual' && renderWeatherSource()}
            {!weatherExpired && renderNBROCard()}
            {!weatherExpired && hasElevatedRisk && renderGuidanceCard()}
            <Text style={[s.assessmentNote, { color: theme.textSecondary }]}>{t('prediction.aiEstimateHelp')}</Text>
            {renderEmergencyContactsCard()}

            <TouchableOpacity
              style={[s.detailsToggle, { backgroundColor: theme.surface, borderColor: theme.border }]}
              onPress={() => setShowDetails(!showDetails)}
              accessibilityRole="button"
              accessibilityState={{ expanded: showDetails }}
              activeOpacity={0.7}
            >
              <Text style={[s.locationButtonText, { color: theme.textPrimary }]}>{t(showDetails ? 'prediction.hideDetails' : 'prediction.showDetails')}</Text>
              <Text style={{ color: theme.textSecondary }}>{showDetails ? '▲' : '▼'}</Text>
            </TouchableOpacity>
            {showDetails && <>
              {!weatherExpired && renderFloodCard(true)}
              {result.mode !== 'manual' && renderWeatherSource(true)}
              {!weatherExpired && renderNBROCard(true)}
              {!weatherExpired && renderHazardCard()}
              {!weatherExpired && !hasElevatedRisk && renderGuidanceCard()}
              {renderDistrictProfileCard()}
              {renderLiveMap()}
              {renderEmergencyContactsCard(true)}
            </>}

            <TouchableOpacity style={[s.resetButton, { backgroundColor: theme.surface, borderColor: theme.border }]} onPress={handleReset} activeOpacity={0.7}>
              <Text style={[s.resetButtonText, { color: theme.textPrimary }]}>🔄 {t('common.retry')}</Text>
            </TouchableOpacity>
          </Animated.View>
        )}
      </ScrollView>

      <BottomNav currentTab="home" />
    </SafeAreaView>
  );
}

// ===== Styles =====
const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: C.bg },
  scroll: { flex: 1 },
  scrollInner: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 30 },

  // Health
  healthRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', marginBottom: 6, paddingHorizontal: 4 },
  healthDot: { width: 7, height: 7, borderRadius: 4, marginRight: 5 },
  healthText: { fontSize: 11, fontFamily: Fonts.medium, color: C.textLight },

  // Card (shared)
  card: {
    backgroundColor: C.white, borderRadius: 12, borderWidth: 1, borderColor: C.border,
    padding: 18, marginBottom: 14,
  },
  urgentCard: {
    backgroundColor: C.red, borderRadius: 12, padding: 18, marginBottom: 14,
  },
  cardTitle: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 12, color: C.textDark },

  // Form
  formTitle: { fontSize: 17, fontFamily: Fonts.bold, fontWeight: '700', marginBottom: 16, color: C.textDark },
  formSubtitle: { fontSize: 13, fontFamily: Fonts.medium, lineHeight: 19, marginBottom: 16 },
  weatherControls: { marginTop: 14, gap: 10 },
  explanation: { fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18 },
  locationChoice: { borderWidth: 1, padding: 12, borderRadius: 12, gap: 8 },
  locationChoiceTitle: { fontSize: 13, fontFamily: Fonts.bold, lineHeight: 19 },
  locationButton: { borderWidth: 1, borderRadius: 10, padding: 11, alignItems: 'center', marginTop: 4 },
  locationButtonText: { fontFamily: Fonts.semiBold, fontSize: 13 },
  referenceLink: { fontFamily: Fonts.medium, fontSize: 12, textAlign: 'center', paddingTop: 6 },
  noticeBox: { borderWidth: 1, padding: 12, borderRadius: 12, gap: 8 },
  sourceLine: { fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18, marginTop: 8, marginBottom: 4 },
  weatherDetails: { marginTop: 12, gap: 4 },
  assessmentNote: { fontSize: 12, fontFamily: Fonts.medium, lineHeight: 18, marginHorizontal: 4, marginBottom: 14 },
  detailsToggle: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 14, borderWidth: 1, borderRadius: 12, marginBottom: 14 },

  // Picker
  inputLabel: { fontSize: 13, fontFamily: Fonts.semiBold, marginBottom: 6, marginLeft: 4, color: C.textMid },
  pickerButton: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: 13, paddingHorizontal: 16,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMed, borderRadius: 14,
  },
  pickerText: { fontSize: 14, fontFamily: Fonts.medium, flex: 1, color: C.textDark },
  pickerChevron: { fontSize: 12, marginLeft: 8, color: C.textLight },
  dropdownList: {
    borderWidth: 1, borderColor: C.borderMed, borderRadius: 12, marginTop: 6,
    maxHeight: 220, overflow: 'hidden', backgroundColor: C.white,
    zIndex: 100,
  },
  dropdownScroll: { maxHeight: 220 },
  dropdownItem: { paddingVertical: 12, paddingHorizontal: 16, borderBottomWidth: 1, borderBottomColor: C.border },
  dropdownText: { fontSize: 14, fontFamily: Fonts.medium, color: C.textDark },

  // Peak Rain
  peakSection: { marginTop: 16 },
  peakRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },
  textInput: {
    flex: 1, paddingVertical: 13, paddingHorizontal: 16, fontSize: 15,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMed, borderRadius: 14, color: C.textDark,
  },
  peakLegend: { paddingTop: 4, gap: 3 },
  legendRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { fontSize: 10, fontFamily: Fonts.medium, color: C.textLight },

  // Monthly
  advancedToggle: { marginTop: 16, paddingVertical: 8 },
  advancedToggleText: { fontSize: 13, fontFamily: Fonts.semiBold, textAlign: 'center', color: C.brandActive },
  monthGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 10 },
  monthCell: { width: '22%', flexGrow: 1 },
  monthLabel: { fontSize: 11, fontFamily: Fonts.semiBold, textAlign: 'center', marginBottom: 4, color: C.textLight },
  monthInput: {
    paddingVertical: 8, paddingHorizontal: 6, fontSize: 13, textAlign: 'center', borderRadius: 12,
    backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMed, color: C.textDark,
  },

  // Error
  errorBox: { padding: 12, borderRadius: 12, marginTop: 12, backgroundColor: C.redLight, borderWidth: 1, borderColor: C.redBorder },
  errorText: { fontSize: 13, fontFamily: Fonts.medium, color: C.red },

  // Predict
  predictButton: {
    marginTop: 18, paddingVertical: 14, borderRadius: 12, alignItems: 'center', justifyContent: 'center',
    backgroundColor: C.textDark,
  },
  predictButtonText: { fontSize: 16, fontFamily: Fonts.bold, fontWeight: '700', color: C.white },

  // Results
  resultHeader: { alignItems: 'center', marginBottom: 12, marginTop: 4 },
  resultDistrict: { fontSize: 24, fontFamily: Fonts.bold, fontWeight: '800', color: C.textDark },
  resultProvince: { fontSize: 13, fontFamily: Fonts.medium, marginTop: 2, color: C.textMid },

  // Flood
  statusBadge: { alignSelf: 'flex-start', paddingVertical: 6, paddingHorizontal: 16, borderRadius: 20, borderWidth: 1.5, marginBottom: 12 },
  statusBadgeText: { fontSize: 14, fontFamily: Fonts.bold, fontWeight: '700' },
  sectionSubtitle: { fontSize: 12, fontFamily: Fonts.semiBold, marginBottom: 8, color: C.textLight },
  probRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 6 },
  probLabel: { width: 90, fontSize: 12, fontFamily: Fonts.medium, color: C.textMid },
  probBarBg: { flex: 1, height: 8, borderRadius: 4, marginHorizontal: 8, overflow: 'hidden', backgroundColor: C.border },
  probBarFill: { height: '100%', borderRadius: 4 },
  probPct: { width: 42, fontSize: 12, fontFamily: Fonts.bold, textAlign: 'right', color: C.textDark },

  // Hazard
  gaugeContainer: { marginBottom: 12 },
  gaugeTrack: { height: 12, borderRadius: 6, overflow: 'hidden', marginBottom: 6, backgroundColor: C.border },
  gaugeFill: { height: '100%', borderRadius: 6 },
  gaugeLabels: { flexDirection: 'row', justifyContent: 'space-between' },
  gaugeLabel: { fontSize: 10, fontFamily: Fonts.semiBold },

  // NBRO
  nbroLevelRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 8 },
  nbroDot: { width: 14, height: 14, borderRadius: 7, marginRight: 10 },
  nbroStatus: { flex: 1, fontSize: 15, fontFamily: Fonts.bold, fontWeight: '700', color: C.textDark },
  nbroMessage: { fontSize: 13, fontFamily: Fonts.medium, lineHeight: 19, marginBottom: 12, color: C.textMid },
  nbroThresholds: { flexDirection: 'row', justifyContent: 'space-around', marginTop: 4 },
  nbroThresholdItem: { alignItems: 'center', gap: 3 },
  nbroThresholdDot: { width: 10, height: 10, borderRadius: 5 },
  nbroThresholdText: { fontSize: 10, fontFamily: Fonts.medium, color: C.textLight },

  // Map
  mapHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 },
  mapCoords: { fontSize: 11, fontFamily: Fonts.medium, color: C.textLight, marginTop: 2 },
  refreshGpsBtn: { paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, backgroundColor: C.bg },
  refreshGpsText: { fontSize: 11.5, fontFamily: Fonts.semiBold, color: C.textMid },
  mapIframeWrap: { width: '100%', height: 200, borderRadius: 14, overflow: 'hidden', marginBottom: 10, backgroundColor: C.border },
  mapNativePlaceholder: {
    height: 150, borderRadius: 14, alignItems: 'center', justifyContent: 'center',
    marginBottom: 10, backgroundColor: C.bg, borderWidth: 1, borderColor: C.border,
  },
  mapLoadingText: { marginTop: 10, fontSize: 13, fontFamily: Fonts.medium, color: C.textLight },
  mapNativeText: { fontSize: 14, fontFamily: Fonts.semiBold, color: C.textMid },
  openMapBtn: { paddingVertical: 10, borderRadius: 12, alignItems: 'center', backgroundColor: C.red },
  openMapBtnText: { color: C.white, fontSize: 13.5, fontFamily: Fonts.bold },

  // Profile
  profileRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 9, borderBottomWidth: 1, borderBottomColor: C.border },
  profileLabel: { fontSize: 13, fontFamily: Fonts.medium, color: C.textLight },
  profileValue: { fontSize: 13, fontFamily: Fonts.bold, flex: 1, textAlign: 'right', marginLeft: 12, color: C.textDark },

  // Guidance
  guidanceItem: { flexDirection: 'row', marginBottom: 8, paddingRight: 8 },
  guidanceBullet: { fontSize: 14, marginRight: 8, marginTop: 1, color: C.red },
  guidanceText: { flex: 1, fontSize: 13, fontFamily: Fonts.medium, lineHeight: 19, color: C.textMid },

  // Contacts
  contactRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: C.border },
  contactLabel: { flex: 1, fontSize: 13, fontFamily: Fonts.medium, color: C.textDark, marginRight: 10 },
  callChip: { paddingVertical: 5, paddingHorizontal: 12, borderRadius: 10, backgroundColor: C.greenLight },
  callChipText: { fontSize: 12, fontFamily: Fonts.bold, color: C.green },

  // Reset
  resetButton: {
    marginTop: 6, marginBottom: 20, paddingVertical: 14, borderRadius: 16, alignItems: 'center',
    backgroundColor: C.white, borderWidth: 1, borderColor: C.borderMed,
  },
  resetButtonText: { fontSize: 14, fontFamily: Fonts.bold, color: C.textDark },
});
