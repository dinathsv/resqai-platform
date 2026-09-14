/**
 * ResQAI — ML Disaster Prediction Service Client
 * Communicates with the FastAPI ML microservice (ml-models/api.py) on port 5005.
 */

import { Platform } from 'react-native';

const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';
export const ML_API_BASE =
  process.env.EXPO_PUBLIC_ML_API_URL || `http://${LOCALHOST}:5005`;

// --------------- Types ---------------

export interface PredictionRequest {
  district: string;
  monthly_rainfall?: Record<string, number>;
  peak_24h_rain_mm?: number;
  annual_rainfall_mm?: number;
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
  prediction: {
    flood_status: string;
    flood_probabilities: Record<string, number>;
    overall_hazard_level: string;
    hazard_index: number;
    peak_24h_rain_mm: number;
    annual_rainfall_mm: number;
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

export async function fetchMLHealth(): Promise<HealthResponse> {
  const res = await fetch(`${ML_API_BASE}/health`);
  if (!res.ok) throw new Error(`ML API health check failed: ${res.status}`);
  return res.json();
}

export async function fetchDistricts(): Promise<string[]> {
  const res = await fetch(`${ML_API_BASE}/districts`);
  if (!res.ok) throw new Error(`Failed to fetch districts: ${res.status}`);
  const data = await res.json();
  return data.districts;
}

export async function predictDisasterRisk(
  payload: PredictionRequest
): Promise<PredictionResult> {
  const res = await fetch(`${ML_API_BASE}/predict`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err?.detail?.error || `Prediction failed: ${res.status}`);
  }
  return res.json();
}
