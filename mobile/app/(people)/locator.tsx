

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
import { useRouter } from 'expo-router';
import { apiFetch } from '../../config/api';
import { Colors, Fonts, Glass } from '../../constants/theme';

interface Hospital {
  hospital_id: string;
  name: string;
  phone: string | null;
  specialization: string | null;
  latitude: number;
  longitude: number;
  distance_metres: number;
}

const EMERGENCY_TYPES = ['Medical', 'Flood', 'Accident', 'Fire', 'Trapped'];

const SCREEN_HEIGHT = Dimensions.get('window').height;

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

  useEffect(() => {
    emergencyTypeRef.current = emergencyType;
  }, [emergencyType]);

  useEffect(() => {
    async function getLocation() {
      try {
        const { status } = await Location.requestForegroundPermissionsAsync();
        if (status !== 'granted') {
          setLocationError('Location permission denied. Enter your area manually below.');
          return;
        }

        const location = await Location.getCurrentPositionAsync();
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

  const handleTypeChange = (type: string) => {
    const typeKey = type.toLowerCase();
    setEmergencyType(typeKey);
    if (userLocation) {
      fetchHospitals(userLocation.lat, userLocation.lng, typeKey);
    }
  };

  const handleManualSearch = () => {

    const defaultCoords = { lat: 6.9271, lng: 79.8612 };
    setUserLocation(defaultCoords);
    fetchHospitals(defaultCoords.lat, defaultCoords.lng, emergencyType);
  };

  const show1990Banner =
    emergencyType === 'medical' || emergencyType === 'accident';

  const renderHospitalItem = ({ item }: { item: Hospital }) => (
    <View style={styles.hospitalCard}>
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
          style={styles.callButtonContainer}
        >
          <Text style={styles.callButton}>📞 Call</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  const renderMap = () => {
    if (!userLocation) {
      return (
        <View style={styles.mapPlaceholder}>
          {locationError ? (
            <Text style={styles.locationErrorText}>{locationError}</Text>
          ) : (
            <ActivityIndicator size="large" color={Colors.accent} />
          )}
        </View>
      );
    }

    const { lat, lng } = userLocation;

    return (
      <View style={styles.mapContainer}>

        <View style={styles.mapHeader}>
          <Text style={styles.mapHeaderText}>
            📍 Your location: {lat.toFixed(4)}, {lng.toFixed(4)}
          </Text>
        </View>

        {hospitals.length > 0 ? (
          <View style={styles.mapMarkers}>
            {hospitals.slice(0, 5).map((h) => (
              <TouchableOpacity
                key={h.hospital_id}
                style={styles.mapMarker}
                onPress={() => {
                  Linking.openURL(
                    `https://www.openstreetmap.org/?mlat=${h.latitude}&mlon=${h.longitude}#map=16/${h.latitude}/${h.longitude}`
                  );
                }}
                activeOpacity={0.7}
              >
                <Text style={styles.mapMarkerIcon}>🏥</Text>
                <Text style={styles.mapMarkerName} numberOfLines={1}>
                  {h.name}
                </Text>
                <Text style={styles.mapMarkerDist}>
                  {(h.distance_metres / 1000).toFixed(1)} km
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        ) : null}

        <TouchableOpacity
          style={styles.openMapButton}
          onPress={() => {
            Linking.openURL(
              `https://www.openstreetmap.org/#map=14/${lat}/${lng}`
            );
          }}
          activeOpacity={0.7}
        >
          <Text style={styles.openMapButtonText}>Open Full Map 🗺️</Text>
        </TouchableOpacity>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>

      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Text style={styles.backButton}>← Back</Text>
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Find Hospital</Text>
      </View>

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

      {renderMap()}

      {locationError && !userLocation ? (
        <View style={styles.manualSearch}>
          <TextInput
            style={styles.manualInput}
            value={manualArea}
            onChangeText={setManualArea}
            placeholder="Enter your area"
            placeholderTextColor={Colors.textMuted}
          />
          <TouchableOpacity
            style={styles.searchButton}
            onPress={handleManualSearch}
            activeOpacity={0.7}
          >
            <Text style={styles.searchButtonText}>Search</Text>
          </TouchableOpacity>
        </View>
      ) : null}

      <View style={styles.hospitalSection}>
        <Text style={styles.hospitalHeading}>Nearest Hospitals</Text>

        {loading ? (
          <ActivityIndicator
            size="small"
            color={Colors.accent}
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

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  backButton: {
    fontSize: 16,
    fontFamily: Fonts.semiBold,
    color: Colors.accent,
    marginRight: 12,
  },
  headerTitle: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
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
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
  },
  typeButtonSelected: {
    backgroundColor: Colors.accent,
  },
  typeButtonUnselected: {
    ...Glass.card,
    borderRadius: 20,
  },
  typeButtonText: {
    fontSize: 14,
    fontFamily: Fonts.semiBold,
  },
  typeButtonTextSelected: {
    color: Colors.white,
  },
  typeButtonTextUnselected: {
    color: Colors.textPrimary,
  },
  banner1990: {
    backgroundColor: Colors.accent,
    paddingVertical: 12,
    paddingHorizontal: 16,
    marginHorizontal: 16,
    marginTop: 12,
    borderRadius: 12,
  },
  banner1990Text: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bold,
    textAlign: 'center',
  },
  mapContainer: {
    ...Glass.card,
    marginHorizontal: 16,
    marginTop: 12,
    padding: 12,
  },
  mapHeader: {
    paddingBottom: 8,
  },
  mapHeaderText: {
    fontSize: 13,
    fontFamily: Fonts.medium,
    color: Colors.textSecondary,
  },
  mapMarkers: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
    marginBottom: 8,
  },
  mapMarker: {
    backgroundColor: Colors.surfaceLight,
    borderWidth: 1,
    borderColor: Colors.borderLight,
    borderRadius: 10,
    paddingVertical: 8,
    paddingHorizontal: 10,
    alignItems: 'center',
    minWidth: 90,
  },
  mapMarkerIcon: {
    fontSize: 20,
    marginBottom: 4,
  },
  mapMarkerName: {
    fontSize: 11,
    fontFamily: Fonts.semiBold,
    color: Colors.textPrimary,
    textAlign: 'center',
  },
  mapMarkerDist: {
    fontSize: 10,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  openMapButton: {
    backgroundColor: Colors.accent,
    paddingVertical: 10,
    alignItems: 'center',
    borderRadius: 10,
  },
  openMapButtonText: {
    color: Colors.white,
    fontSize: 14,
    fontFamily: Fonts.bold,
  },
  mapPlaceholder: {
    width: '100%',
    height: SCREEN_HEIGHT * 0.35,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: Colors.background,
  },
  locationErrorText: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
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
    ...Glass.input,
    paddingVertical: 10,
    paddingHorizontal: 14,
    fontSize: 15,
    fontFamily: Fonts.regular,
    color: Colors.textPrimary,
  },
  searchButton: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 20,
    justifyContent: 'center',
    borderRadius: 10,
  },
  searchButtonText: {
    color: Colors.white,
    fontSize: 15,
    fontFamily: Fonts.bold,
  },
  hospitalSection: {
    flex: 1,
    paddingHorizontal: 16,
    marginTop: 8,
  },
  hospitalHeading: {
    fontSize: 18,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
    paddingVertical: 10,
  },
  listLoading: {
    paddingVertical: 20,
  },
  hospitalList: {
    flex: 1,
  },
  hospitalCard: {
    ...Glass.card,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 14,
    marginBottom: 10,
  },
  hospitalInfo: {
    flex: 1,
  },
  hospitalName: {
    fontSize: 15,
    fontFamily: Fonts.bold,
    color: Colors.textPrimary,
  },
  hospitalDistance: {
    fontSize: 13,
    fontFamily: Fonts.regular,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  hospitalSpec: {
    fontSize: 12,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    marginTop: 2,
  },
  callButtonContainer: {
    backgroundColor: Colors.cta,
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
  },
  callButton: {
    fontSize: 14,
    fontFamily: Fonts.bold,
    color: Colors.white,
  },
  noHospitals: {
    fontSize: 14,
    fontFamily: Fonts.regular,
    color: Colors.textMuted,
    paddingVertical: 16,
  },
});
