

import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

function getDevelopmentHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  return hostUri.split(':')[0] || null;
}

function resolveBaseUrl(envValue?: string, fallbackHost = LOCALHOST, port = '8000') {
  if (envValue) {
    return envValue.replace(/\/$/, '');
  }

  if (typeof window !== 'undefined' && window.location?.hostname) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${port}`;
    }
  }

  const developmentHost = Platform.OS !== 'web' ? getDevelopmentHost() : null;
  return `http://${developmentHost || fallbackHost}:${port}`;
}

// Python FastAPI — primary API (auth, requests, donations, alerts)
export const API_BASE = resolveBaseUrl(process.env.EXPO_PUBLIC_API_URL);

// AI Microservice (first-aid-chat, translate-report, locate-resources, generate-summary)
// These endpoints are also available through the Python API at /api/ai/*
export const AI_BASE = resolveBaseUrl(process.env.EXPO_PUBLIC_AI_URL);

// Node.js Backend — real-time events & Socket.IO
export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL ||
  `http://${getDevelopmentHost() || LOCALHOST}:5000`;

function isExpiredJwt(token: string): boolean {
  try {
    const payload = token.split('.')[1];
    if (!payload || typeof globalThis.atob !== 'function') return false;

    const decoded = globalThis.atob(payload.replace(/-/g, '+').replace(/_/g, '/'));
    const { exp } = JSON.parse(decoded) as { exp?: number };
    return typeof exp === 'number' && exp * 1000 <= Date.now();
  } catch {
    // A token that is not a JWT is left for the API to validate.
    return false;
  }
}

export async function getToken(): Promise<string | null> {
  for (const key of ['token', 'guest_token'] as const) {
    const token = await AsyncStorage.getItem(key);
    if (!token) continue;

    if (isExpiredJwt(token)) {
      await AsyncStorage.removeItem(key);
      continue;
    }

    return token;
  }

  return null;
}

export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const token = await getToken();
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  try {
    return await fetch(`${API_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    console.warn(`API request failed for ${path}:`, error);
    return new Response(
      JSON.stringify({
        error: 'network_unavailable',
        message: 'The backend is currently unavailable. Please check that the API server is running.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}

export async function aiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  try {
    return await fetch(`${AI_BASE}${path}`, {
      ...options,
      headers,
    });
  } catch (error) {
    console.warn(`AI request failed for ${path}:`, error);
    return new Response(
      JSON.stringify({
        error: 'network_unavailable',
        message: 'The AI service is currently unavailable.',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
