import { useState, useCallback } from 'react';
import { Platform } from 'react-native';
import * as Location from 'expo-location';

// ─────────────────────────────────────────────
//  useCurrentLocation — Browser Geolocation API
//  hook for obtaining the device's real-time
//  position. Uses navigator.geolocation on web
//  and expo-location on native platforms.
// ─────────────────────────────────────────────

export type LocationStatus = 'idle' | 'requesting' | 'success' | 'error';

export interface CurrentLocationResult {
  latitude: number;
  longitude: number;
  accuracy: number | null;
}

export interface UseCurrentLocationReturn {
  /** The most recently obtained location, or null */
  location: CurrentLocationResult | null;
  /** Human-readable status for UI display */
  status: LocationStatus;
  /** User-friendly status message */
  statusMessage: string;
  /** User-friendly error message, or empty string */
  error: string;
  /** Whether a location request is in progress */
  loading: boolean;
  /** Call this to request the device's current location */
  requestLocation: () => void;
}

/**
 * Get a user-friendly error message from a GeolocationPositionError code.
 */
function getWebGeolocationErrorMessage(error: GeolocationPositionError): string {
  switch (error.code) {
    case error.PERMISSION_DENIED:
      return 'Location permission was denied. Please allow location access in your browser settings.';
    case error.POSITION_UNAVAILABLE:
      return 'Unable to determine your current location. Please check that location services are enabled on your device.';
    case error.TIMEOUT:
      return 'Location request timed out. Please try again or check your device\'s location settings.';
    default:
      return 'An unknown error occurred while retrieving your location. Please try again.';
  }
}

/**
 * Browser Geolocation API options as specified in requirements:
 *   enableHighAccuracy: true  — request best available (GPS/GNSS/Wi-Fi)
 *   timeout: 10000            — allow 10 seconds to obtain position
 *   maximumAge: 0             — never use a cached/stale position
 */
const WEB_GEOLOCATION_OPTIONS: PositionOptions = {
  enableHighAccuracy: true,
  timeout: 10000,
  maximumAge: 0,
};

export function useCurrentLocation(): UseCurrentLocationReturn {
  const [location, setLocation] = useState<CurrentLocationResult | null>(null);
  const [status, setStatus] = useState<LocationStatus>('idle');
  const [statusMessage, setStatusMessage] = useState('');
  const [error, setError] = useState('');

  const requestLocation = useCallback(() => {
    setStatus('requesting');
    setStatusMessage('Getting your current location...');
    setError('');

    if (Platform.OS === 'web') {
      // ── Web: Use browser Geolocation API directly ──
      if (!navigator.geolocation) {
        setStatus('error');
        setError('Geolocation is not supported by your browser. Please use a modern browser.');
        setStatusMessage('');
        return;
      }

      navigator.geolocation.getCurrentPosition(
        // ── successCallback ──
        (position: GeolocationPosition) => {
          const result: CurrentLocationResult = {
            latitude: position.coords.latitude,
            longitude: position.coords.longitude,
            accuracy: position.coords.accuracy ?? null,
          };
          setLocation(result);
          setStatus('success');
          setStatusMessage('Location found');
          setError('');
        },
        // ── errorCallback ──
        (err: GeolocationPositionError) => {
          setStatus('error');
          setError(getWebGeolocationErrorMessage(err));
          setStatusMessage('');
        },
        // ── options ──
        WEB_GEOLOCATION_OPTIONS,
      );
    } else {
      // ── Native (Android / iOS): Use expo-location ──
      (async () => {
        try {
          const { status: permStatus } = await Location.requestForegroundPermissionsAsync();
          if (permStatus !== 'granted') {
            setStatus('error');
            setError('Location permission was denied. Please allow location access in your device settings.');
            setStatusMessage('');
            return;
          }

          const loc = await Location.getCurrentPositionAsync({
            accuracy: Location.Accuracy.High,
          });

          const result: CurrentLocationResult = {
            latitude: loc.coords.latitude,
            longitude: loc.coords.longitude,
            accuracy: loc.coords.accuracy ?? null,
          };
          setLocation(result);
          setStatus('success');
          setStatusMessage('Location found');
          setError('');
        } catch (err) {
          console.error('expo-location error:', err);
          setStatus('error');
          setError('Unable to determine your current location. Please check that location services are enabled on your device.');
          setStatusMessage('');
        }
      })();
    }
  }, []);

  return {
    location,
    status,
    statusMessage,
    error,
    loading: status === 'requesting',
    requestLocation,
  };
}
