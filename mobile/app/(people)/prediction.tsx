import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
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
import BottomNav from '../../components/BottomNav';
import {
  fetchDistricts,
  fetchMLHealth,
  predictDisasterRisk,
  DISTRICT_COORDS,
  type PredictionResult,
} from '../../services/mlService';

const MONTHS = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
const MONTH_LABELS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];

const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';
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
  const { t } = useLanguage();
  const router = useRouter();
  const cardTheme = { backgroundColor: theme.surface, borderColor: theme.border };

  // --- State ---
  const [districts, setDistricts] = useState<string[]>([]);
  const [selectedDistrict, setSelectedDistrict] = useState('');
  const [showDistrictPicker, setShowDistrictPicker] = useState(false);
  const [monthlyRainfall, setMonthlyRainfall] = useState<Record<string, string>>({});
  const [peak24h, setPeak24h] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [loading, setLoading] = useState(false);
  const [apiHealthy, setApiHealthy] = useState<boolean | null>(null);
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [error, setError] = useState('');

  // Live location
  const [userLocation, setUserLocation] = useState<{ lat: number; lng: number } | null>(null);
  const [loadingLocation, setLoadingLocation] = useState(false);

  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Hardcoded fallback so the picker always works, even if the ML API is offline
  const FALLBACK_DISTRICTS = Object.keys(DISTRICT_COORDS).sort();

  // Load districts + health check + live location
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
    fetchUserLocation();
  }, []);

  const fetchUserLocation = async () => {
    setLoadingLocation(true);
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLoadingLocation(false);
        return;
      }
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });
      setUserLocation({
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      });
    } catch (err) {
      console.error('Location error:', err);
    } finally {
      setLoadingLocation(false);
    }
  };

  // Pulse animation for alert levels
  useEffect(() => {
    const isMajor =
      result?.prediction?.flood_status === 'Major Flood' ||
      result?.prediction?.flood_category?.includes('Critical') ||
      result?.prediction?.flood_category?.includes('High');
    if (result && ((result.nbro_landslide_alert?.level ?? 0) >= 2 || isMajor)) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.04, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 900, useNativeDriver: USE_NATIVE_DRIVER }),
        ])
      ).start();
    }
  }, [result]);

  const animateResultsIn = useCallback(() => {
    fadeAnim.setValue(0);
    slideAnim.setValue(30);
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 450, useNativeDriver: USE_NATIVE_DRIVER }),
      Animated.spring(slideAnim, { toValue: 0, friction: 8, useNativeDriver: USE_NATIVE_DRIVER }),
    ]).start();
  }, []);

  const handlePredict = async () => {
    if (!selectedDistrict) {
      setError(t('prediction.selectDistrictPrompt'));
      return;
    }
    setLoading(true);
    setError('');
    setResult(null);

    try {
      const monthly: Record<string, number> = {};
      for (const m of MONTHS) {
        const val = monthlyRainfall[m];
        if (val && parseFloat(val) > 0) monthly[m] = parseFloat(val);
      }

      const res = await predictDisasterRisk({
        district: selectedDistrict,
        monthly_rainfall: Object.keys(monthly).length > 0 ? monthly : undefined,
        peak_24h_rain_mm: peak24h ? parseFloat(peak24h) : undefined,
      });
      setResult(res);
      animateResultsIn();
    } catch (e: any) {
      setError(e.message || 'Prediction failed. Ensure the ML API is running on port 5005.');
    } finally {
      setLoading(false);
    }
  };

  const handleReset = () => {
    setResult(null);
    setError('');
    setSelectedDistrict('');
    setMonthlyRainfall({});
    setPeak24h('');
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace('/(people)/dashboard');
  };

  // --- Map helpers ---
  const getMapCenter = () => {
    if (result) {
      const coords = DISTRICT_COORDS[result.district];
      if (coords) return coords;
    }
    if (userLocation) return userLocation;
    return { lat: 7.8731, lng: 80.7718 }; // Sri Lanka center
  };

  const getGoogleEmbedUrl = (lat: number, lng: number, zoom = 11) => {
    if (GOOGLE_MAPS_API_KEY) {
      return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${lat},${lng}&zoom=${zoom}`;
    }
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=${zoom}&output=embed`;
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

  const renderDistrictPicker = () => (
    <View style={{ zIndex: 10, position: 'relative' }}>
      <Text style={[s.inputLabel, { color: theme.textMuted }]}>{t('prediction.selectDistrict')}</Text>
      <TouchableOpacity
        style={[s.pickerButton, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder }]}
        onPress={() => setShowDistrictPicker(!showDistrictPicker)}
        activeOpacity={0.7}
      >
        <Text style={[s.pickerText, !selectedDistrict ? { color: theme.textMuted } : { color: theme.textPrimary }]}>
          {selectedDistrict || t('prediction.selectDistrictPrompt')}
        </Text>
        <Text style={[s.pickerChevron, { color: theme.textMuted }]}>{showDistrictPicker ? '▲' : '▼'}</Text>
      </TouchableOpacity>

      {showDistrictPicker && (
        <View style={[s.dropdownList, { backgroundColor: theme.surface }]}>
          <ScrollView style={s.dropdownScroll} nestedScrollEnabled showsVerticalScrollIndicator={false}>
            {districtList.map((d) => (
              <TouchableOpacity
                key={d}
                style={[
                  s.dropdownItem,
                  { borderBottomColor: theme.border },
                  selectedDistrict === d && { backgroundColor: theme.successLight },
                ]}
                onPress={() => { setSelectedDistrict(d); setShowDistrictPicker(false); }}
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
        />
        <View style={s.peakLegend}>
          {[
            { label: '<75 Safe', color: C.green },
            { label: '75 Watch', color: C.yellow },
            { label: '100 Warn', color: C.amber },
            { label: '150+ Evac', color: C.red },
          ].map((item, i) => (
            <View key={i} style={s.legendRow}>
              <View style={[s.legendDot, { backgroundColor: item.color }]} />
              <Text style={[s.legendText, { color: theme.textMuted }]}>{item.label}</Text>
            </View>
          ))}
        </View>
      </View>
    </View>
  );

  const renderMonthlyInputs = () => (
    <View>
      <TouchableOpacity
        style={s.advancedToggle}
        onPress={() => setShowAdvanced(!showAdvanced)}
        activeOpacity={0.7}
      >
        <Text style={[s.advancedToggleText, { color: theme.textMuted }]}>
          {showAdvanced ? '▲' : '▼'} {t('prediction.monthlyRainfallHeader')}
        </Text>
      </TouchableOpacity>

      {showAdvanced && (
        <View style={s.monthGrid}>
          {MONTHS.map((m, i) => (
            <View key={m} style={s.monthCell}>
              <Text style={[s.monthLabel, { color: theme.textMuted }]}>{MONTH_LABELS[i]}</Text>
              <TextInput
                style={[s.monthInput, { backgroundColor: theme.inputBg, borderColor: theme.inputBorder, color: theme.textPrimary }]}
                value={monthlyRainfall[m] || ''}
                onChangeText={(val) => setMonthlyRainfall((prev) => ({ ...prev, [m]: val }))}
                placeholder="mm"
                placeholderTextColor={theme.textMuted}
                keyboardType="numeric"
              />
            </View>
          ))}
        </View>
      )}
    </View>
  );

  // ── Live Map Section ──
  const renderLiveMap = () => {
    const center = getMapCenter();
    const embedUrl = getGoogleEmbedUrl(center.lat, center.lng, result ? 11 : 8);
    const hasLocation = userLocation !== null;

    return (
      <View style={[s.card, cardTheme]}>
        <View style={s.mapHeader}>
          <View style={{ flex: 1 }}>
            <Text style={[s.cardTitle, { color: theme.textPrimary }]}>
              📍 {result ? `${result.district} Map` : 'Live Map'}
            </Text>
            <Text style={[s.mapCoords, { color: theme.textMuted }]}>
              {center.lat.toFixed(4)}, {center.lng.toFixed(4)}
            </Text>
          </View>
          <TouchableOpacity
            style={[s.refreshGpsBtn, { backgroundColor: theme.surfaceSubtle }]}
            onPress={fetchUserLocation}
            disabled={loadingLocation}
            activeOpacity={0.7}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color={C.brandActive} />
            ) : (
              <Text style={[s.refreshGpsText, { color: theme.textSecondary }]}>🔄 {t('common.retry')}</Text>
            )}
          </TouchableOpacity>
        </View>

        {Platform.OS === 'web' ? (
          <View style={s.mapIframeWrap}>
            <iframe
              title="Live Location Map"
              src={embedUrl}
              style={{ width: '100%', height: 200, border: 'none', borderRadius: 14 }}
              loading="lazy"
              allowFullScreen
              referrerPolicy="strict-origin-when-cross-origin"
            />
          </View>
        ) : (
          <View style={s.mapNativePlaceholder}>
            {loadingLocation ? (
              <>
                <ActivityIndicator size="large" color={C.brandActive} />
                <Text style={[s.mapLoadingText, { color: theme.textMuted }]}>Detecting GPS...</Text>
              </>
            ) : (
              <>
                <Text style={{ fontSize: 36, marginBottom: 6 }}>🗺️</Text>
                <Text style={[s.mapNativeText, { color: theme.textSecondary }]}>
                  {result ? `${result.district}, ${result.province}` : hasLocation ? 'Location detected' : 'Tap Refresh to detect GPS'}
                </Text>
              </>
            )}
          </View>
        )}

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
  const renderFloodCard = () => {
    if (!result) return null;
    const pred = result.prediction || {};
    const flood_status = pred.flood_status || pred.flood_category || 'Low Risk (Normal)';
    const flood_probabilities: Record<string, number> =
      pred.flood_probabilities || pred.flood_category_probabilities || {};
    const statusColor = getFloodColor(flood_status);
    const statusBg = getFloodBg(flood_status);
    const statusBorder = getFloodBorder(flood_status);
    const probValues = Object.values(flood_probabilities);
    const maxProb = probValues.length > 0 ? Math.max(...probValues) : 0;

    return (
      <View style={[s.card, cardTheme]}>
        <Text style={[s.cardTitle, { color: theme.textPrimary }]}>{getFloodEmoji(flood_status)} Flood Assessment</Text>
        <View style={[s.statusBadge, { backgroundColor: statusBg, borderColor: statusBorder }]}>
          <Text style={[s.statusBadgeText, { color: statusColor }]}>{flood_status}</Text>
        </View>

        <Text style={[s.sectionSubtitle, { color: theme.textMuted }]}>Flood Probabilities</Text>
        {Object.entries(flood_probabilities).map(([label, pct]) => (
          <View key={label} style={s.probRow}>
            <Text style={[s.probLabel, { color: theme.textSecondary }]} numberOfLines={1}>{label}</Text>
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
    const overall_hazard_level = pred.overall_hazard_level || pred.flood_category || 'Low Risk (Normal)';
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
  const renderNBROCard = () => {
    if (!result) return null;
    const alert = result.nbro_landslide_alert;
    const alertColor = getNBROColor(alert.level);
    const alertBg = getNBROBg(alert.level);
    const isUrgent = alert.level >= 2;

    const CardWrapper = isUrgent ? Animated.View : View;
    const urgentStyle = isUrgent
      ? [s.urgentCard, { transform: [{ scale: pulseAnim }] }]
      : [s.card, cardTheme];

    return (
      <CardWrapper style={urgentStyle as any}>
        <Text style={[s.cardTitle, { color: isUrgent ? C.white : theme.textPrimary }]}>
          {getNBROEmoji(alert.level)} NBRO Landslide Alert
        </Text>

        <View style={s.nbroLevelRow}>
          <View style={[s.nbroDot, { backgroundColor: isUrgent ? C.white : alertColor }]} />
          <Text style={[s.nbroStatus, { color: isUrgent ? C.white : theme.textPrimary }]}>{alert.status}</Text>
        </View>

        <Text style={[s.nbroMessage, { color: isUrgent ? 'rgba(255,255,255,0.85)' : theme.textSecondary }]}>
          {alert.message}
        </Text>

        <View style={s.nbroThresholds}>
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
        </View>
      </CardWrapper>
    );
  };

  // ── District Profile ──
  const renderDistrictProfileCard = () => {
    if (!result) return null;
    const pred = result.prediction || {};
    const peak24h = pred.peak_24h_rain_mm ?? pred.rain_24h_mm ?? 0;
    const rain48h = pred.rain_48h_mm;
    const rain72h = pred.rain_72h_mm;
    const annual = pred.annual_rainfall_mm ?? (peak24h > 0 ? (peak24h * 15).toFixed(1) : 'N/A');

    const profileItems = [
      { label: 'Province', value: result.province },
      { label: 'Climatic Zone', value: result.climatic_zone },
      { label: 'River Basin', value: result.river_basin },
      { label: 'Hazard Profile', value: result.hazard_profile },
      { label: 'Peak 24h Rain', value: `${peak24h} mm` },
    ];
    if (rain48h !== undefined) {
      profileItems.push({ label: '48h Rain', value: `${rain48h} mm` });
    }
    if (rain72h !== undefined) {
      profileItems.push({ label: '72h Rain', value: `${rain72h} mm` });
    } else {
      profileItems.push({ label: 'Annual Rainfall', value: `${annual} mm` });
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
  const renderEmergencyContactsCard = () => {
    if (!result) return null;
    const contacts = result.emergency_contacts;

    return (
      <View style={[s.card, cardTheme]}>
        <Text style={[s.cardTitle, { color: theme.textPrimary }]}>🆘 Emergency Contacts</Text>
        {Object.entries(contacts).map(([key, value], i, arr) => {
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
    <SafeAreaView style={[s.container, { backgroundColor: theme.background }]}>
      <TopBar title={t('prediction.title')} showBack onBack={handleBack} />

      <ScrollView
        style={s.scroll}
        contentContainerStyle={s.scrollInner}
        showsVerticalScrollIndicator={false}
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

        {/* Live Map (always visible) */}
        {renderLiveMap()}

        {/* Form */}
        {!result && (
          <View style={[s.card, cardTheme]}>
            <Text style={[s.formTitle, { color: theme.textPrimary }]}>{t('prediction.title')}</Text>

            {renderDistrictPicker()}
            {renderPeakRainInput()}
            {renderMonthlyInputs()}

            {error ? (
              <View style={s.errorBox}>
                <Text style={s.errorText}>⚠️ {error}</Text>
              </View>
            ) : null}

            <TouchableOpacity
              style={[s.predictButton, loading && { opacity: 0.7 }]}
              onPress={handlePredict}
              disabled={loading}
              activeOpacity={0.8}
            >
              {loading ? (
                <ActivityIndicator color={C.white} size="small" />
              ) : (
                <Text style={s.predictButtonText}>🔍 {t('prediction.predictButton')}</Text>
              )}
            </TouchableOpacity>
          </View>
        )}

        {/* Results */}
        {result && (
          <Animated.View style={{ opacity: fadeAnim, transform: [{ translateY: slideAnim }] }}>
            <View style={s.resultHeader}>
              <Text style={[s.resultDistrict, { color: theme.textPrimary }]}>{result.district}</Text>
              <Text style={[s.resultProvince, { color: theme.textMuted }]}>
                {result.province} Province • {result.climatic_zone} Zone
              </Text>
            </View>

            {renderFloodCard()}
            {renderNBROCard()}
            {renderHazardCard()}
            {renderGuidanceCard()}
            {renderDistrictProfileCard()}
            {renderEmergencyContactsCard()}

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
  nbroStatus: { fontSize: 15, fontFamily: Fonts.bold, fontWeight: '700', color: C.textDark },
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
