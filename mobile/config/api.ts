/**
 * ResQAI — API Configuration & Helpers
 * Centralized API base URL and fetch wrappers with token injection.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

// Android emulator uses 10.0.2.2 to reach host localhost
// iOS simulator uses localhost directly
const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

/** Node.js backend */
export const API_BASE = `http://${LOCALHOST}:3000`;

/** Python AI microservice (direct calls for chatbot — no auth needed) */
export const AI_BASE = `http://${LOCALHOST}:8001`;

/**
 * Get the stored auth token (JWT for registered users, or guest_token).
 */
export async function getToken(): Promise<string | null> {
  const token = await AsyncStorage.getItem('token');
  if (token) return token;
  return AsyncStorage.getItem('guest_token');
}

/**
 * Authenticated fetch wrapper for the Node.js backend.
 * Automatically injects the Bearer token from AsyncStorage.
 */
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

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

/**
 * Unauthenticated fetch to the AI microservice.
 */
export async function aiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  return fetch(`${AI_BASE}${path}`, {
    ...options,
    headers,
  });
}
