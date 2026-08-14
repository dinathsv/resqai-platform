/**
 * ResQAI — Emergency Resource Locator Screen
 *
 * Finds nearest hospitals based on user location and emergency type.
 * Uses expo-location for GPS and react-native-maps for map display.
 */

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
  Dimensions,
} from 'react-native';
import * as Location from 'expo-location';
import MapView, { Marker } from 'react-native-maps';
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';

// ── Types ───────────────────────────────────────────────────

interface Hospital {
  hospital_id: string;
  name: string;
  phone: string | null;
  specialization: string | null;
  latitude: number;
  longitude: number;
  distance_metres: number;
}

// ── Emergency Types ─────────────────────────────────────────

const EMERGENCY_TYPES = ['Medical', 'Flood', 'Accident', 'Fire', 'Trapped'];

const SCREEN_HEIGHT = Dimensions.get('window').height;

// ── Component ───────────────────────────────────────────────

export default function LocatorScreen() {
  const router = useRouter();
  const [userLocation, setUserLocation] = useState<{
    lat: number;
    lng: number;
  } | null>(null);
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [emergencyType, setEmergencyType] = useState('medical');
  const emergencyTypeRef = useRef(emergencyType);
  const [loading, setLoading] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [manualArea, setManualArea] = useState('');

  // Keep ref in sync with latest emergencyType
  useEffect(() => {
    emergencyTypeRef.current = emergencyType;
  }, [emergencyType]);

  // ── Request location on mount ───────────────────────────
  useEffect(() => {
    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied. Enter your area manually below.');
          return;
        }

        const location = await Location.getCurrentPositionAsync({});
        const coords = {
          lat: location.coords.latitude,
          lng: location.coords.longitude,
        };
        setUserLocation(coords);
        fetchHospitals(coords.lat, coords.lng, emergencyTypeRef.current);
      } catch (err) {
        console.error('Location error:', err);
        setLocationError('Could not get your location. Enter your area manually below.');
      }
    }

    getLocation();
  }, []);

  // ── Fetch hospitals ─────────────────────────────────────
  const fetchHospitals = async (lat: number, lng: number, type: string) => {
    setLoading(true);
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
      setLoading(false);
    }
  };

  // ── Handle type change ──────────────────────────────────
  const handleTypeChange = (type: string) => {
    const typeKey = type.toLowerCase();
    setEmergencyType(typeKey);
    if (userLocation) {
      fetchHospitals(userLocation.lat, userLocation.lng, typeKey);
    }
  };

  // ── Handle manual search ────────────────────────────────
  const handleManualSearch = () => {
    // For manual area search, use a default location (Colombo)
    // In production, this would geocode the area name
    const defaultCoords = { lat: 6.9271, lng: 79.8612 };
    setUserLocation(defaultCoords);
    fetchHospitals(defaultCoords.lat, defaultCoords.lng, emergencyType);
  };

  // ── Show 1990 banner ────────────────────────────────────
  const show1990Banner =
    emergencyType === 'medical' || emergencyType === 'accident';

  // ── Render hospital row ─────────────────────────────────
  const renderHospitalItem = ({ item }: { item: Hospital }) => (
    <View style={styles.hospitalRow}>
      <View style={styles.hospitalInfo}>
        <Text style={styles.hospitalName}>{item.name}</Text>
        <Text style={styles.hospitalDistance}>
          {(item.distance_metres / 1000).toFixed(1)} km
        </Text>
        {item.specialization && (
          <Text style={styles.hospitalSpec}>{item.specialization}</Text>
        )}
      </View>
      {item.phone && (
        <TouchableOpacity
          onPress={() => Linking.openURL(`tel:${item.phone}`)}
          activeOpacity={0.7}
        >
          <Text style={styles.callButton}>Call</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  // ── Render ──────────────────────────────────────────────
  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Hospital</Text>
      </View>

      {/* Emergency type selector */}
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

      {/* 1990 Banner */}
      {show1990Banner && (
        <TouchableOpacity
          style={styles.banner1990}
          onPress={() => Linking.openURL('tel:1990')}
          activeOpacity={0.8}
        >
          <Text style={styles.banner1990Text}>
            🚑 Emergency? Call 1990 Suwa Seriya
          </Text>
        </TouchableOpacity>
      )}

      {/* Map */}
      {userLocation ? (
        <MapView
          style={styles.map}
          showsUserLocation={true}
          initialRegion={{
            latitude: userLocation.lat,
            longitude: userLocation.lng,
            latitudeDelta: 0.05,
            longitudeDelta: 0.05,
          }}
        >
          {hospitals.map((h) => (
            <Marker
              key={h.hospital_id}
              coordinate={{
                latitude: h.latitude,
                longitude: h.longitude,
              }}
              title={h.name}
              description={`${(h.distance_metres / 1000).toFixed(1)} km`}
              pinColor="red"
            />
          ))}
        </MapView>
      ) : (
        <View style={styles.mapPlaceholder}>
          {locationError ? (
            <Text style={styles.locationErrorText}>{locationError}</Text>
          ) : (
            <ActivityIndicator size="large" color="#000000" />
          )}
        </View>
      )}

      {/* Location denied fallback */}
      {locationError && !userLocation && (
        <View style={styles.manualSearch}>
          <TextInput
            style={styles.manualInput}
            value={manualArea}
            onChangeText={setManualArea}
            placeholder="Enter your area"
            placeholderTextColor="#999999"
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleManualSearch}
            activeOpacity={0.7}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      )}

      {/* Hospital list */}
      <View style={styles.hospitalSection}>
        <Text style={styles.hospitalHeading}>Nearest Hospitals</Text>

        {loading ? (
          <ActivityIndicator
            size="small"
            color="#000000"
            style={styles.listLoading}
          />
        ) : hospitals.length === 0 ? (
          <Text style={styles.noHospitals}>
            No hospitals found. Try changing the emergency type or location.
          </Text>
        ) : (
          <FlatList
            data={hospitals}
            keyExtractor={(item) => item.hospital_id}
            renderItem={renderHospitalItem}
            style={styles.hospitalList}
          />
        )}
      </View>
    </SafeAreaView>
  );
}

// ── Styles ──────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    fontSize: 16,
    color: '#000000',
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
  },
  typeSelector: {
    maxHeight: 50,
    paddingHorizontal: 12,
  },
  typeSelectorContent: {
    alignItems: 'center',
    gap: 8,
  },
  typeButton: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    // No border radius
  },
  typeButtonSelected: {
    backgroundColor: '#000000',
  },
  typeButtonUnselected: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#000000',
  },
  typeButtonText: {
    fontSize: 14,
    fontWeight: '500',
  },
  typeButtonTextSelected: {
    color: '#FFFFFF',
  },
  typeButtonTextUnselected: {
    color: '#000000',
  },
  banner1990: {
    backgroundColor: '#000000',
    paddingVertical: 12,
    paddingHorizontal: 16,
    // No border radius — full width
  },
  banner1990Text: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  map: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.5,
  },
  mapPlaceholder: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#F5F5F5',
  },
  locationErrorText: {
    fontSize: 14,
    color: '#888888',
    textAlign: 'center',
    paddingHorizontal: 32,
  },
  manualSearch: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
  },
  manualInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: '#000000',
    padding: 8,
    fontSize: 15,
    color: '#000000',
  },
  searchButton: {
    backgroundColor: '#000000',
    paddingHorizontal: 20,
    justifyContent: 'center',
  },
  searchButtonText: {
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: 'bold',
  },
  hospitalSection: {
    flex: 1,
    paddingHorizontal: 16,
  },
  hospitalHeading: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#000000',
    paddingVertical: 10,
  },
  listLoading: {
    paddingVertical: 20,
  },
  hospitalList: {
    flex: 1,
  },
  hospitalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#E0E0E0',
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 15,
    fontWeight: 'bold',
    color: '#000000',
  },
  hospitalDistance: {
    fontSize: 13,
    color: '#888888',
    marginTop: 2,
  },
  hospitalSpec: {
    fontSize: 12,
    color: '#888888',
    marginTop: 2,
  },
  callButton: {
    fontSize: 15,
    color: '#000000',
    fontWeight: 'bold',
    paddingHorizontal: 12,
  },
  noHospitals: {
    fontSize: 14,
    color: '#888888',
    paddingVertical: 16,
  },
});
