import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  FlatList,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  SafeAreaView,
  Linking,
  ActivityIndicator,
  Platform,
} from 'react-native';
import * as Location from 'expo-location';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts } from '../../constants/theme';
import TopBar from '../../components/TopBar';

interface Hospital {
  hospital_id: string;
  name: string;
  phone: string | null;
  specialization: string | null;
  latitude: number;
  longitude: number;
  distance_meters?: number;
  distance_metres?: number;
}

const EMERGENCY_TYPES = ['Medical', 'Flood', 'Accident', 'Fire', 'Trapped'];

// Google Maps API Key from environment (optional - falls back to free direct embed)
const GOOGLE_MAPS_API_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY || '';

export default function LocatorScreen() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
    label?: string;
  } | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [emergencyType, setEmergencyType] = useState('medical');
  const emergencyTypeRef = useRef(emergencyType);
  const [loadingHospitals, setLoadingHospitals] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [searchingLocation, setSearchingLocation] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [manualArea, setManualArea] = useState('');

  useEffect(() => {
    emergencyTypeRef.current = emergencyType;
  }, [emergencyType]);

  // Request high-accuracy device GPS position on mount
  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  const fetchCurrentLocation = async () => {
    setLoadingLocation(true);
    setLocationError('');
    try {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted') {
        setLocationError('GPS permission not granted. Search your city or address below.');
        setLoadingLocation(false);
        setUserLocation(null);
        setHospitals([]);
        return;
      }

      // Explicitly request High Accuracy GPS from the device
      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      const coords = {
        lat: location.coords.latitude,
        lng: location.coords.longitude,
      };
      setUserLocation(coords);
      fetchHospitals(coords.lat, coords.lng, emergencyTypeRef.current);
    } catch (err) {
      console.error('Location error:', err);
      setLocationError('Could not obtain live GPS coordinates. Search your city or area below.');
      setUserLocation(null);
      setHospitals([]);
    } finally {
      setLoadingLocation(false);
    }
  };

  const fetchHospitals = async (lat: number, lng: number, type: string) => {
    setLoadingHospitals(true);
    try {
      const res = await apiFetch(
        `/api/requests/locate?lat=${lat}&lng=${lng}&emergency_type=${type}`
      );
      if (res.ok) {
        const data = await res.json();
        setHospitals(data.hospitals || []);
      }
    } catch (err) {
      console.error('Fetch hospitals error:', err);
    } finally {
      setLoadingHospitals(false);
    }
  };

  const handleTypeChange = (type: string) => {
    const typeKey = type.toLowerCase();
    setEmergencyType(typeKey);
    if (userLocation) {
      fetchHospitals(userLocation.lat, userLocation.lng, typeKey);
    }
  };

  // Real-time geocoding for user-searched area/city
  const handleManualSearch = async () => {
    const rawQuery = manualArea.trim();
    if (!rawQuery) return;

    setSearchingLocation(true);
    setLocationError('');

    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          rawQuery
        )}&limit=1`,
        {
          headers: {
            'Accept-Language': 'en',
            'User-Agent': 'ResQAI-Platform',
          },
        }
      );
      const data = await res.json();
      if (data && data.length > 0) {
        const coords = {
          lat: parseFloat(data[0].lat),
          lng: parseFloat(data[0].lon),
          label: data[0].display_name.split(',')[0],
        };
        setUserLocation(coords);
        fetchHospitals(coords.lat, coords.lng, emergencyType);
        setSearchingLocation(false);
        setManualArea('');
        return;
      }
    } catch (e) {
      console.warn('Geocoding request failed:', e);
    }

    setLocationError(`Could not find "${rawQuery}". Please enter a valid city or address.`);
    setSearchingLocation(false);
  };

  const show1990Banner =
    emergencyType === 'medical' || emergencyType === 'accident';

  // Construct Google Maps Embed URL
  const getGoogleEmbedUrl = (lat: number, lng: number) => {
    if (GOOGLE_MAPS_API_KEY) {
      return `https://www.google.com/maps/embed/v1/place?key=${GOOGLE_MAPS_API_KEY}&q=${lat},${lng}&zoom=15`;
    }
    return `https://maps.google.com/maps?q=${lat},${lng}&hl=en&z=15&output=embed`;
  };

  const renderHospitalItem = ({ item }: { item: Hospital }) => {
    const distVal = item.distance_meters ?? item.distance_metres ?? 0;
    const distKm = (distVal / 1000).toFixed(1);

    return (
      <View style={styles.hospitalCard}>
        <View style={styles.hospitalInfo}>
          <Text style={styles.hospitalName}>{item.name}</Text>
          <Text style={styles.hospitalDistance}>📍 {distKm} km away</Text>
          {item.specialization && (
            <Text style={styles.hospitalSpec}>{item.specialization}</Text>
          )}
        </View>
        <View style={styles.cardActions}>
          <TouchableOpacity
            onPress={() => {
              Linking.openURL(
                `https://www.google.com/maps/search/?api=1&query=${item.latitude},${item.longitude}`
              );
            }}
            activeOpacity={0.7}
            style={styles.mapPinButton}
          >
            <Text style={styles.mapPinButtonText}>🗺️ Map</Text>
          </TouchableOpacity>
          {item.phone && (
            <TouchableOpacity
              onPress={() => Linking.openURL(`tel:${item.phone}`)}
              activeOpacity={0.7}
              style={styles.callButtonContainer}
            >
              <Text style={styles.callButton}>📞 Call</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    );
  };

  const renderMapSection = () => {
    if (!userLocation) {
      return (
        <View style={styles.noLocationContainer}>
          {loadingLocation ? (
            <View style={styles.mapPlaceholder}>
              <ActivityIndicator size="large" color={Colors.accent} />
              <Text style={styles.loadingLocText}>Detecting device GPS...</Text>
            </View>
          ) : (
            <View style={styles.noLocationBox}>
              <Text style={styles.noLocationIcon}>📍</Text>
              <Text style={styles.noLocationTitle}>Location Required</Text>
              <Text style={styles.noLocationSubtitle}>
                Allow GPS access or enter your city or address below to view nearby emergency care on Google Maps.
              </Text>
              <TouchableOpacity
                style={styles.retryGpsButton}
                onPress={fetchCurrentLocation}
                disabled={loadingLocation}
                activeOpacity={0.7}
              >
                <Text style={styles.retryGpsText}>🔄 Enable / Retry GPS</Text>
              </TouchableOpacity>
            </View>
          )}
        </View>
      );
    }

    const { lat, lng, label } = userLocation;
    const embedUrl = getGoogleEmbedUrl(lat, lng);

    return (
      <View style={styles.mapContainer}>
        {/* Map Header Status & GPS Refresh */}
        <View style={styles.mapHeader}>
          <View style={styles.mapHeaderLeft}>
            <Text style={styles.mapHeaderText}>
              📍 {label ? `${label} (${lat.toFixed(4)}, ${lng.toFixed(4)})` : `${lat.toFixed(4)}, ${lng.toFixed(4)}`}
            </Text>
            {GOOGLE_MAPS_API_KEY ? (
              <View style={styles.apiBadge}>
                <Text style={styles.apiBadgeText}>Google API Active</Text>
              </View>
            ) : (
              <View style={styles.embedBadge}>
                <Text style={styles.embedBadgeText}>Google Embed</Text>
              </View>
            )}
          </View>
          <TouchableOpacity
            style={styles.refreshLocButton}
            onPress={fetchCurrentLocation}
            disabled={loadingLocation}
            activeOpacity={0.7}
          >
            {loadingLocation ? (
              <ActivityIndicator size="small" color={Colors.accent} />
            ) : (
              <Text style={styles.refreshLocText}>🔄 Refresh GPS</Text>
            )}
          </TouchableOpacity>
        </View>

        {/* Embedded Google Map */}
        {Platform.OS === 'web' ? (
          <View style={styles.iframeWrapper}>
            <iframe
              title="Google Map Live Location"
              src={embedUrl}
              style={{
                width: '100%',
                height: 200,
                border: 'none',
                borderRadius: 14,
              }}
              loading="lazy"
            />
          </View>
        ) : null}

        {/* Quick Hospital Chips */}
        {hospitals.length > 0 ? (
          <View style={styles.mapMarkers}>
            {hospitals.slice(0, 4).map((h) => {
              const dist = (
                (h.distance_meters ?? h.distance_metres ?? 0) / 1000
              ).toFixed(1);
              return (
                <TouchableOpacity
                  key={h.hospital_id}
                  style={styles.mapMarker}
                  onPress={() => {
                    Linking.openURL(
                      `https://www.google.com/maps/search/?api=1&query=${h.latitude},${h.longitude}`
                    );
                  }}
                  activeOpacity={0.7}
                >
                  <Text style={styles.mapMarkerIcon}>🏥</Text>
                  <Text style={styles.mapMarkerName} numberOfLines={1}>
                    {h.name}
                  </Text>
                  <Text style={styles.mapMarkerDist}>{dist} km</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        ) : null}

        {/* Open in Google Maps Full Navigation */}
        <TouchableOpacity
          style={styles.openMapButton}
          onPress={() => {
            Linking.openURL(
              `https://www.google.com/maps/search/?api=1&query=${lat},${lng}`
            );
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.openMapButtonText}>Open in Google Maps 🗺️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace('/(people)/dashboard');
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Professional Top Bar with Back and 3-Dot Navigation Menu */}
      <TopBar title="Find Emergency Care" showBack onBack={handleBack} />

      <FlatList
        data={hospitals}
        keyExtractor={(item) => item.hospital_id}
        renderItem={renderHospitalItem}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View>
            {/* Emergency Type Selector */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.typeSelector}
              contentContainerStyle={styles.typeSelectorContent}
            >
              {EMERGENCY_TYPES.map((type) => {
                const isSelected = emergencyType === type.toLowerCase();
                return (
                  <TouchableOpacity
                    key={type}
                    style={[
                      styles.typeButton,
                      isSelected
                        ? styles.typeButtonSelected
                        : styles.typeButtonUnselected,
                    ]}
                    onPress={() => handleTypeChange(type)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.typeButtonText,
                        isSelected
                          ? styles.typeButtonTextSelected
                          : styles.typeButtonTextUnselected,
                      ]}
                    >
                      {type}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* 1990 Emergency Hotline Banner */}
            {show1990Banner && (
              <TouchableOpacity
                style={styles.banner1990}
                onPress={() => Linking.openURL('tel:1990')}
                activeOpacity={0.8}
              >
                <Text style={styles.banner1990Text}>
                  🚑 Immediate Threat? Call 1990 Suwa Seriya
                </Text>
              </TouchableOpacity>
            )}

            {/* Google Map Viewport */}
            {renderMapSection()}

            {/* Manual Location Search Bar */}
            <View style={styles.manualSearch}>
              <TextInput
                style={styles.manualInput}
                value={manualArea}
                onChangeText={setManualArea}
                placeholder="Search city, town, or address..."
                placeholderTextColor={Colors.textMuted}
                onSubmitEditing={handleManualSearch}
                returnKeyType="search"
              />
              <TouchableOpacity
                style={styles.searchButton}
                onPress={handleManualSearch}
                activeOpacity={0.7}
                disabled={searchingLocation}
              >
                {searchingLocation ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.searchButtonText}>Set Area</Text>
                )}
              </TouchableOpacity>
            </View>

            {locationError ? (
              <Text style={styles.locationErrorText}>{locationError}</Text>
            ) : null}

            {userLocation && (
              <Text style={styles.hospitalHeading}>
                {loadingHospitals
                  ? 'Searching nearest facilities...'
                  : `Nearest Medical Facilities (${hospitals.length})`}
              </Text>
            )}

            {loadingHospitals && (
              <ActivityIndicator
                size="small"
                color={Colors.accent}
                style={styles.listLoading}
              />
            )}

            {!loadingHospitals && userLocation && hospitals.length === 0 && (
              <Text style={styles.noHospitals}>
                No medical facilities found within range of this location.
              </Text>
            )}
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8FAFC',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 10,
    backgroundColor: '#F8FAFC',
  },
  backButtonTouch: {
    paddingVertical: 6,
    paddingRight: 12,
  },
  backButton: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: '#DC2626',
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    textAlign: 'center',
  },
  headerSpacer: {
    width: 60,
  },
  listContent: {
    paddingBottom: 40,
  },
  typeSelector: {
    maxHeight: 52,
    marginVertical: 6,
  },
  typeSelectorContent: {
    paddingHorizontal: 16,
    alignItems: 'center',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
  },
  typeButtonSelected: {
    backgroundColor: '#DC2626',
    borderColor: '#DC2626',
  },
  typeButtonUnselected: {
    backgroundColor: '#FFFFFF',
    borderColor: '#E2E8F0',
  },
  typeButtonText: {
    fontSize: 13,
    fontFamily: Fonts.semiBold,
  },
  typeButtonTextSelected: {
    color: '#FFFFFF',
  },
  typeButtonTextUnselected: {
    color: '#475569',
  },
  banner1990: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 8,
    borderRadius: 12,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 3,
  },
  banner1990Text: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  noLocationContainer: {
    marginHorizontal: 16,
    marginTop: 12,
  },
  noLocationBox: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
    alignItems: 'center',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.05,
    shadowRadius: 12,
    elevation: 2,
  },
  noLocationIcon: {
    fontSize: 32,
    marginBottom: 8,
  },
  noLocationTitle: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    marginBottom: 6,
  },
  noLocationSubtitle: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#64748B',
    textAlign: 'center',
    lineHeight: 18,
    marginBottom: 16,
  },
  retryGpsButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    paddingHorizontal: 18,
    borderRadius: 12,
  },
  retryGpsText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: Fonts.bold,
  },
  mapContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    marginHorizontal: 16,
    marginTop: 12,
    padding: 14,
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
  mapHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 10,
  },
  mapHeaderLeft: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  mapHeaderText: {
    fontSize: 12.5,
    fontFamily: Fonts.bold,
    color: '#0F172A',
  },
  apiBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  apiBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.bold,
    color: '#059669',
  },
  embedBadge: {
    backgroundColor: 'rgba(59, 130, 246, 0.10)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 6,
  },
  embedBadgeText: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: '#2563EB',
  },
  refreshLocButton: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: '#F1F5F9',
  },
  refreshLocText: {
    fontSize: 11.5,
    fontFamily: Fonts.semiBold,
    color: '#475569',
  },
  iframeWrapper: {
    width: '100%',
    height: 200,
    borderRadius: 14,
    overflow: 'hidden',
    backgroundColor: '#E2E8F0',
    marginBottom: 12,
  },
  mapMarkers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 10,
  },
  mapMarker: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    paddingVertical: 6,
    paddingHorizontal: 8,
    alignItems: 'center',
    flex: 1,
    minWidth: 72,
  },
  mapMarkerIcon: {
    fontSize: 18,
    marginBottom: 2,
  },
  mapMarkerName: {
    fontSize: 10.5,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    textAlign: 'center',
  },
  mapMarkerDist: {
    fontSize: 10,
    fontFamily: Fonts.medium,
    color: '#64748B',
    marginTop: 1,
  },
  openMapButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 12,
  },
  openMapButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: Fonts.bold,
  },
  mapPlaceholder: {
    width: '100%',
    height: 180,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 20,
  },
  loadingLocText: {
    marginTop: 10,
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: '#64748B',
  },
  manualSearch: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    marginTop: 12,
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 12,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 13.5,
    fontFamily: Fonts.regular,
    color: '#0F172A',
  },
  searchButton: {
    backgroundColor: '#0F172A',
    paddingHorizontal: 16,
    justifyContent: 'center',
    borderRadius: 12,
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 13.5,
    fontFamily: Fonts.bold,
  },
  locationErrorText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#DC2626',
    paddingHorizontal: 18,
    marginTop: 6,
  },
  hospitalHeading: {
    fontSize: 16,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    paddingHorizontal: 16,
    marginTop: 16,
    marginBottom: 8,
  },
  listLoading: {
    paddingVertical: 16,
  },
  hospitalCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginHorizontal: 16,
    marginBottom: 10,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.04,
    shadowRadius: 8,
    elevation: 1,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 14.5,
    fontFamily: Fonts.bold,
    color: '#0F172A',
  },
  hospitalDistance: {
    fontSize: 12.5,
    fontFamily: Fonts.medium,
    color: '#2563EB',
    marginTop: 2,
  },
  hospitalSpec: {
    fontSize: 11.5,
    fontFamily: Fonts.regular,
    color: '#64748B',
    marginTop: 2,
  },
  cardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  mapPinButton: {
    backgroundColor: '#F1F5F9',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E2E8F0',
  },
  mapPinButtonText: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#334155',
  },
  callButtonContainer: {
    backgroundColor: '#10B981',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  callButton: {
    fontSize: 13,
    fontFamily: Fonts.bold,
    color: '#FFFFFF',
  },
  noHospitals: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: '#64748B',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
});
