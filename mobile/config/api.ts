

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

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

  return `http://${fallbackHost}:${port}`;
}

// Python FastAPI — primary API (auth, requests, donations, alerts)
export const API_BASE = resolveBaseUrl(process.env.EXPO_PUBLIC_API_URL);

// AI Microservice (first-aid-chat, translate-report, locate-resources, generate-summary)
// These endpoints are also available through the Python API at /api/ai/*
export const AI_BASE = resolveBaseUrl(process.env.EXPO_PUBLIC_AI_URL);

// Node.js Backend — real-time events & Socket.IO
export const SOCKET_URL =
  process.env.EXPO_PUBLIC_SOCKET_URL || `http://${LOCALHOST}:5000`;

export async function getToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem('token');
  if (token) return token;
  return AsyncStorage.getItem('guest_token');
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
