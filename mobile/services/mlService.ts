/**
 * ResQAI — ML Disaster Prediction Service Client
 * Communicates with the FastAPI ML microservice (ml-models/api.py) on port 5005.
 */

import { ML_API_BASE } from '../config/api';
export { ML_API_BASE } from '../config/api';

// --------------- Types ---------------

export interface PredictionRequest {
  district: string;
  peak_24h_rain_mm?: number;
}

export interface AutomaticPredictionRequest {
  district: string;
  latitude?: number;
  longitude?: number;
}

export interface PredictionWeather {
  provider: string;
  model: string;
  source_url: string;
  timezone: string;
  period_start: string;
  period_end: string;
  weather_date: string;
  fetched_at: string;
  expires_at: string;
  cached: boolean;
  grid_latitude?: number;
  grid_longitude?: number;
  data_kind?: string;
  features: Record<string, number>;
}

export interface NBROLandslideAlert {
  level: number;
  color: string;
  status: string;
  message: string;
}

export interface PredictionResult {
  status: string;
  district: string;
  province: string;
  climatic_zone: string;
  river_basin: string;
  hazard_profile: string;
  mode?: 'automatic' | 'manual';
  assessment?: {
    kind: string;
    is_official_warning: boolean;
    description: string;
  };
  location?: {
    latitude: number;
    longitude: number;
    source: 'gps' | 'district_representative';
    district: string;
  };
  weather?: PredictionWeather;
  prediction: {
    flood_status?: string;
    flood_category?: string;
    flood_probabilities?: Record<string, number>;
    flood_category_probabilities?: Record<string, number>;
    overall_hazard_level?: string;
    hazard_index?: number;
    flood_risk_score?: number;
    peak_24h_rain_mm?: number;
    rain_24h_mm?: number;
    rain_48h_mm?: number;
    rain_72h_mm?: number;
    soil_saturation_index?: number;
  };
  nbro_landslide_alert: NBROLandslideAlert;
  actionable_guidance: string[];
  emergency_contacts: Record<string, string>;
}

export interface HealthResponse {
  status: string;
  service: string;
  supported_districts_count: number;
}

// --------------- District Coordinates (for Google Maps) ---------------

export const DISTRICT_COORDS: Record<string, { lat: number; lng: number }> = {
  Ampara:        { lat: 7.2913, lng: 81.6724 },
  Anuradhapura:  { lat: 8.3114, lng: 80.4037 },
  Badulla:       { lat: 6.9934, lng: 81.0550 },
  Batticaloa:    { lat: 7.7310, lng: 81.6747 },
  Colombo:       { lat: 6.9271, lng: 79.8612 },
  Galle:         { lat: 6.0535, lng: 80.2210 },
  Gampaha:       { lat: 7.0840, lng: 80.0098 },
  Hambantota:    { lat: 6.1429, lng: 81.1212 },
  Jaffna:        { lat: 9.6615, lng: 80.0255 },
  Kalutara:      { lat: 6.5854, lng: 80.1140 },
  Kandy:         { lat: 7.2906, lng: 80.6337 },
  Kegalle:       { lat: 7.2513, lng: 80.3464 },
  Kilinochchi:   { lat: 9.3803, lng: 80.3770 },
  Kurunegala:    { lat: 7.4818, lng: 80.3609 },
  Mannar:        { lat: 8.9810, lng: 79.9044 },
  Matale:        { lat: 7.4675, lng: 80.6234 },
  Matara:        { lat: 5.9549, lng: 80.5550 },
  Monaragala:    { lat: 6.8728, lng: 81.3507 },
  Mullaitivu:    { lat: 9.2671, lng: 80.8142 },
  'Nuwara Eliya':{ lat: 6.9497, lng: 80.7891 },
  Polonnaruwa:   { lat: 7.9403, lng: 81.0188 },
  Puttalam:      { lat: 8.0362, lng: 79.8283 },
  Ratnapura:     { lat: 6.6828, lng: 80.3992 },
  Trincomalee:   { lat: 8.5874, lng: 81.2152 },
  Vavuniya:      { lat: 8.7514, lng: 80.4971 },
};

// --------------- API Calls ---------------

export class PredictionServiceError extends Error {
  constructor(public readonly code: string, message: string) {
    super(message);
    this.name = 'PredictionServiceError';
  }
}

async function requestPrediction(
  path: string,
  payload: PredictionRequest | AutomaticPredictionRequest,
): Promise<PredictionResult> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 25000);
  try {
    const res = await fetch(`${ML_API_BASE}${path}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      const detail = err?.detail;
      throw new PredictionServiceError(
        detail?.code || (res.status === 422 || res.status === 400 ? 'invalid_location' : 'prediction_unavailable'),
        typeof detail === 'string' ? detail : detail?.message || detail?.error || 'Prediction is unavailable. Please try again.',
      );
    }
    const result: PredictionResult = await res.json();
    if (!result?.district || !(result.prediction?.flood_status || result.prediction?.flood_category)) {
      throw new PredictionServiceError('prediction_unavailable', 'The prediction service returned incomplete results.');
    }
    if (path === '/predict/automatic') {
      const weather = result.weather;
      if (result.mode !== 'automatic' || !weather?.provider ||
          !Number.isFinite(Date.parse(weather.period_start)) || !Number.isFinite(Date.parse(weather.period_end)) ||
          !Number.isFinite(Date.parse(weather.fetched_at)) ||
          !Number.isFinite(Date.parse(weather.expires_at)) || Date.parse(weather.expires_at) <= Date.now() ||
          !Number.isFinite(result.location?.latitude) || !Number.isFinite(result.location?.longitude)) {
        throw new PredictionServiceError('weather_unavailable', 'Complete, recent weather data is unavailable.');
      }
    }
    return result;
  } catch (error) {
    if (error instanceof PredictionServiceError) throw error;
    throw new PredictionServiceError(
      controller.signal.aborted ? 'prediction_timeout' : 'connection_error',
      controller.signal.aborted ? 'The weather request timed out. Please try again.' : 'Could not connect to the prediction service. Please check your connection.',
    );
  } finally {
    clearTimeout(timeout);
  }
}

export async function fetchMLHealth(): Promise<HealthResponse> {
  return fetchServiceInfo('/health');
}

export async function fetchDistricts(): Promise<string[]> {
  const data = await fetchServiceInfo<{ districts: string[] }>('/districts');
  if (!Array.isArray(data.districts) || !data.districts.length) throw new Error('Districts are unavailable');
  return data.districts;
}

async function fetchServiceInfo<T>(path: string): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const res = await fetch(`${ML_API_BASE}${path}`, { signal: controller.signal });
    if (!res.ok) throw new Error('Prediction service is unavailable');
    return await res.json();
  } finally {
    clearTimeout(timeout);
  }
}

export async function predictDisasterRisk(
  payload: PredictionRequest
): Promise<PredictionResult> {
  return requestPrediction('/predict', payload);
}

export async function predictAutomaticRisk(
  payload: AutomaticPredictionRequest,
): Promise<PredictionResult> {
  return requestPrediction('/predict/automatic', payload);
}
