import React, { useEffect, useRef, useState, useCallback } from 'react';
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
import { useTheme } from '../../context/ThemeContext';
import TopBar from '../../components/TopBar';
import { useCurrentLocation } from '../../hooks/useCurrentLocation';

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
  const { theme } = useTheme();
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

  // ── Current Location hook (browser Geolocation API on web, expo-location on native) ──
  const {
    location: currentDeviceLocation,
    status: currentLocStatus,
    statusMessage: currentLocStatusMessage,
    error: currentLocError,
    loading: currentLocLoading,
    requestLocation: requestDeviceLocation,
  } = useCurrentLocation();

  // ── Google Maps JavaScript API refs (web only) ──
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const googleMapRef = useRef<google.maps.Map | null>(null);
  const googleMarkerRef = useRef<google.maps.Marker | null>(null);
  const googleCircleRef = useRef<google.maps.Circle | null>(null);
  const [jsApiLoaded, setJsApiLoaded] = useState(false);
  const [jsApiError, setJsApiError] = useState(false);

  useEffect(() => {
    emergencyTypeRef.current = emergencyType;
  }, [emergencyType]);

  // ── Load Google Maps JavaScript API script (web only, when API key exists) ──
  useEffect(() => {
    if (Platform.OS !== 'web' || !GOOGLE_MAPS_API_KEY) return;
    // Check if already loaded
    if (typeof google !== 'undefined' && google.maps) {
      setJsApiLoaded(true);
      return;
    }
    // Check if script tag already exists
    const existingScript = document.querySelector('script[src*="maps.googleapis.com/maps/api/js"]');
    if (existingScript) {
      existingScript.addEventListener('load', () => setJsApiLoaded(true));
      return;
    }
    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}&libraries=marker`;
    script.async = true;
    script.defer = true;
    script.onload = () => setJsApiLoaded(true);
    script.onerror = () => setJsApiError(true);
    document.head.appendChild(script);
  }, []);

  // Request high-accuracy device GPS position on mount
  useEffect(() => {
    fetchCurrentLocation();
  }, []);

  // ── When the useCurrentLocation hook returns a result, sync it to locator state ──
  useEffect(() => {
    if (currentDeviceLocation && currentLocStatus === 'success') {
      const coords = {
        lat: currentDeviceLocation.latitude,
        lng: currentDeviceLocation.longitude,
      };
      setUserLocation(coords);
      fetchHospitals(coords.lat, coords.lng, emergencyTypeRef.current);

      // Update Google Maps JS API map if available
      if (Platform.OS === 'web' && jsApiLoaded && googleMapRef.current) {
        const latLng = new google.maps.LatLng(coords.lat, coords.lng);
        googleMapRef.current.panTo(latLng);
        googleMapRef.current.setZoom(15);

        // Update or create marker
        if (googleMarkerRef.current) {
          googleMarkerRef.current.setPosition(latLng);
        } else {
          googleMarkerRef.current = new google.maps.Marker({
            position: latLng,
            map: googleMapRef.current,
            title: 'Your Current Location',
            icon: {
              path: google.maps.SymbolPath.CIRCLE,
              scale: 10,
              fillColor: '#DC2626',
              fillOpacity: 1,
              strokeColor: '#FFFFFF',
              strokeWeight: 3,
            },
          });
        }

        // Update or create accuracy circle
        const accuracyMeters = currentDeviceLocation.accuracy ?? 0;
        if (accuracyMeters > 0) {
          if (googleCircleRef.current) {
            googleCircleRef.current.setCenter(latLng);
            googleCircleRef.current.setRadius(accuracyMeters);
          } else {
            googleCircleRef.current = new google.maps.Circle({
              center: latLng,
              radius: accuracyMeters,
              map: googleMapRef.current,
              fillColor: '#DC2626',
              fillOpacity: 0.08,
              strokeColor: '#DC2626',
              strokeOpacity: 0.25,
              strokeWeight: 1,
            });
          }
        }
      }
    }
    if (currentLocError) {
      setLocationError(currentLocError);
    }
  }, [currentDeviceLocation, currentLocStatus, currentLocError, jsApiLoaded]);

  // ── Initialize Google Maps JS API map when container is ready ──
  const initGoogleMap = useCallback((containerEl: HTMLDivElement | null) => {
    if (!containerEl || !jsApiLoaded || googleMapRef.current) return;
    mapContainerRef.current = containerEl;

    const defaultCenter = userLocation
      ? { lat: userLocation.lat, lng: userLocation.lng }
      : { lat: 7.8731, lng: 80.7718 }; // Sri Lanka center as initial view only

    googleMapRef.current = new google.maps.Map(containerEl, {
      center: defaultCenter,
      zoom: userLocation ? 15 : 8,
      mapTypeControl: false,
      streetViewControl: false,
      fullscreenControl: true,
      zoomControl: true,
    });

    // If we already have a location, place marker immediately
    if (userLocation) {
      const latLng = new google.maps.LatLng(userLocation.lat, userLocation.lng);
      googleMarkerRef.current = new google.maps.Marker({
        position: latLng,
        map: googleMapRef.current,
        title: 'Your Current Location',
        icon: {
          path: google.maps.SymbolPath.CIRCLE,
          scale: 10,
          fillColor: '#DC2626',
          fillOpacity: 1,
          strokeColor: '#FFFFFF',
          strokeWeight: 3,
        },
      });

      if (currentDeviceLocation?.accuracy && currentDeviceLocation.accuracy > 0) {
        googleCircleRef.current = new google.maps.Circle({
          center: latLng,
          radius: currentDeviceLocation.accuracy,
          map: googleMapRef.current,
          fillColor: '#DC2626',
          fillOpacity: 0.08,
          strokeColor: '#DC2626',
          strokeOpacity: 0.25,
          strokeWeight: 1,
        });
      }
    }
  }, [jsApiLoaded, userLocation, currentDeviceLocation]);

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

  // ── Determine whether to use the Google Maps JS API or Embed fallback (web only) ──
  const useJsApi = Platform.OS === 'web' && GOOGLE_MAPS_API_KEY && jsApiLoaded && !jsApiError;

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
                <Text style={styles.apiBadgeText}>{useJsApi ? 'JS API Active' : 'Google API Active'}</Text>
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

        {/* ── 📍 Current Location Button ── */}
        <TouchableOpacity
          style={[
            styles.currentLocationButton,
            currentLocLoading && styles.currentLocationButtonLoading,
          ]}
          onPress={requestDeviceLocation}
          disabled={currentLocLoading}
          activeOpacity={0.7}
        >
          {currentLocLoading ? (
            <View style={styles.currentLocBtnInner}>
              <ActivityIndicator size="small" color="#FFFFFF" />
              <Text style={styles.currentLocationButtonText}>
                Getting your current location...
              </Text>
            </View>
          ) : (
            <Text style={styles.currentLocationButtonText}>📍 Current Location</Text>
          )}
        </TouchableOpacity>

        {/* Status message */}
        {currentLocStatusMessage && currentLocStatus === 'success' ? (
          <View style={styles.locStatusSuccess}>
            <Text style={styles.locStatusSuccessText}>✅ {currentLocStatusMessage}</Text>
          </View>
        ) : null}
        {currentLocError ? (
          <View style={styles.locStatusError}>
            <Text style={styles.locStatusErrorText}>⚠️ {currentLocError}</Text>
          </View>
        ) : null}

        {/* ── Accuracy & Coordinates Info Panel ── */}
        {currentDeviceLocation && currentLocStatus === 'success' ? (
          <View style={styles.accuracyPanel}>
            <Text style={styles.accuracyTitle}>Current Location</Text>
            <View style={styles.accuracyRow}>
              <Text style={styles.accuracyLabel}>Latitude:</Text>
              <Text style={styles.accuracyValue}>{currentDeviceLocation.latitude.toFixed(5)}</Text>
            </View>
            <View style={styles.accuracyRow}>
              <Text style={styles.accuracyLabel}>Longitude:</Text>
              <Text style={styles.accuracyValue}>{currentDeviceLocation.longitude.toFixed(5)}</Text>
            </View>
            {currentDeviceLocation.accuracy !== null ? (
              <View style={styles.accuracyRow}>
                <Text style={styles.accuracyLabel}>Accuracy:</Text>
                <Text style={styles.accuracyValue}>
                  ~{Math.round(currentDeviceLocation.accuracy)} meters
                </Text>
              </View>
            ) : null}
          </View>
        ) : null}

        {/* ── Google Map Display ── */}
        {Platform.OS === 'web' ? (
          useJsApi ? (
            /* Google Maps JavaScript API — dynamic map with marker & accuracy circle */
            <View style={styles.iframeWrapper}>
              <div
                ref={initGoogleMap}
                style={{
                  width: '100%',
                  height: 240,
                  borderRadius: 14,
                }}
              />
            </View>
          ) : (
            /* Fallback: Embed iframe */
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
                allowFullScreen
                referrerPolicy="strict-origin-when-cross-origin"
              />
            </View>
          )
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
    <SafeAreaView style={[styles.container, { backgroundColor: theme.background }]}>
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
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 8 : 16,
    paddingBottom: 10,
    backgroundColor: '#FFFFFF',
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
    borderRadius: 8,
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
    borderRadius: 8,
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
    backgroundColor: '#FFFFFF',
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
    marginHorizontal: 16,
    marginVertical: 16,
    gap: 8,
  },
  manualInput: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 8,
    paddingHorizontal: 14,
    height: 48,
    fontSize: 14,
    fontFamily: Fonts.medium,
    color: '#0F172A',
  },
  searchButton: {
    backgroundColor: '#0F172A',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 16,
    borderRadius: 8,
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
  // ── Current Location Button ──
  currentLocationButton: {
    backgroundColor: '#DC2626',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#DC2626',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 3,
    ...(Platform.OS === 'web'
      ? ({
          boxShadow: '0 4px 14px rgba(220, 38, 38, 0.30)',
          transition: 'all 0.2s ease',
        } as any)
      : {}),
  },
  currentLocationButtonLoading: {
    backgroundColor: '#B91C1C',
    opacity: 0.9,
  },
  currentLocBtnInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  currentLocationButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  // ── Status Messages ──
  locStatusSuccess: {
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  locStatusSuccessText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#059669',
  },
  locStatusError: {
    backgroundColor: 'rgba(220, 38, 38, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(220, 38, 38, 0.20)',
    borderRadius: 8,
    paddingVertical: 6,
    paddingHorizontal: 10,
    marginBottom: 8,
  },
  locStatusErrorText: {
    fontSize: 12,
    fontFamily: Fonts.medium,
    color: '#DC2626',
    lineHeight: 17,
  },
  // ── Accuracy Panel ──
  accuracyPanel: {
    backgroundColor: '#F8FAFC',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 10,
    padding: 10,
    marginBottom: 10,
  },
  accuracyTitle: {
    fontSize: 12,
    fontFamily: Fonts.bold,
    color: '#0F172A',
    marginBottom: 4,
  },
  accuracyRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 2,
  },
  accuracyLabel: {
    fontSize: 11.5,
    fontFamily: Fonts.medium,
    color: '#64748B',
  },
  accuracyValue: {
    fontSize: 11.5,
    fontFamily: Fonts.bold,
    color: '#0F172A',
  },
});
