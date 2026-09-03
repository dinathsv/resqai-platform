

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';

const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

// Python FastAPI — primary API (auth, requests, donations, alerts)
export const API_BASE =
  process.env.EXPO_PUBLIC_API_URL || `http://${LOCALHOST}:8000`;

// AI Microservice (first-aid-chat, translate-report, locate-resources, generate-summary)
// These endpoints are also available through the Python API at /api/ai/*
export const AI_BASE =
  process.env.EXPO_PUBLIC_AI_URL || `http://${LOCALHOST}:8000`;

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

  return fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });
}

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
