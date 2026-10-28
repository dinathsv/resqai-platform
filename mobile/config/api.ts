import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const LOCALHOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

/**
 * Returns true when the app is running inside Expo Go or a development build
 * (i.e. there is a live Metro bundler connection).  Production APK/IPA builds
 * will never have a `hostUri`.
 */
function isDevelopmentClient(): boolean {
  return !!Constants.expoConfig?.hostUri;
}

function getDevelopmentHost(): string | null {
  const hostUri = Constants.expoConfig?.hostUri;
  if (!hostUri) return null;
  return hostUri.split(':')[0] || null;
}

/**
 * Validates a URL is well-formed and uses an acceptable scheme.
 * Returns the cleaned URL (trailing slash stripped) or null.
 */
function validateUrl(raw: string | undefined): string | null {
  if (!raw || !raw.trim()) return null;
  const url = raw.trim().replace(/\/+$/, '');
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) return null;
    return url;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Base URL resolution
// ---------------------------------------------------------------------------

/**
 * Resolves a service base URL.
 *
 * Priority:
 * 1. Explicit env var (EXPO_PUBLIC_*) → used as-is (production).
 * 2. Browser hostname (web platform, non-localhost) → derive from page host.
 * 3. Expo dev-server host (native development builds) → derive from Metro.
 * 4. Localhost fallback → ONLY in development.  Production builds without an
 *    env var will throw a clear error rather than silently targeting localhost.
 */
function resolveBaseUrl(
  envVar: string | undefined,
  fallbackPort: string,
  serviceName: string,
): string {
  // 1. Explicit env value
  const validated = validateUrl(envVar);
  if (validated) return validated;

  // 2. Web: derive from page hostname
  if (
    Platform.OS === 'web' &&
    typeof window !== 'undefined' &&
    window.location?.hostname
  ) {
    const host = window.location.hostname;
    if (host && host !== 'localhost' && host !== '127.0.0.1') {
      return `http://${host}:${fallbackPort}`;
    }
    if (__DEV__) {
      return `http://localhost:${fallbackPort}`;
    }
  }

  // 3 & 4. Native
  if (isDevelopmentClient()) {
    // Running under Expo Go / dev-client — use the Metro host
    const devHost = getDevelopmentHost() || LOCALHOST;
    return `http://${devHost}:${fallbackPort}`;
  }

  // Production build with no env var → configuration error.
  // Return a clearly-broken URL so requests fail fast with a diagnostic
  // message instead of silently targeting a random local IP.
  console.error(
    `[ResQAI] Missing ${serviceName} URL for production build. ` +
    `Set the corresponding EXPO_PUBLIC_* environment variable before building.`,
  );
  return `https://MISSING-${serviceName}-URL.invalid`;
}

// ---------------------------------------------------------------------------
// Service URLs
// ---------------------------------------------------------------------------

// Python FastAPI — primary API (auth, requests, donations, alerts)
export const API_BASE = resolveBaseUrl(
  process.env.EXPO_PUBLIC_API_URL,
  '8000',
  'API',
);

// AI Microservice (first-aid-chat, translate-report, locate-resources, generate-summary)
// The .env file uses EXPO_PUBLIC_AI_API_URL; support both names for compatibility
export const AI_BASE = resolveBaseUrl(
  process.env.EXPO_PUBLIC_AI_URL || process.env.EXPO_PUBLIC_AI_API_URL,
  '8000',
  'AI',
);

// Node.js Backend — real-time events & Socket.IO
// The .env file uses EXPO_PUBLIC_NODE_API_URL; support both names for compatibility
export const SOCKET_URL = resolveBaseUrl(
  process.env.EXPO_PUBLIC_SOCKET_URL || process.env.EXPO_PUBLIC_NODE_API_URL,
  '5000',
  'SOCKET',
);

// Log resolved URLs at startup (no sensitive data)
if (__DEV__) {
  console.log('[ResQAI] API_BASE  =', API_BASE);
  console.log('[ResQAI] AI_BASE   =', AI_BASE);
  console.log('[ResQAI] SOCKET_URL=', SOCKET_URL);
}

// ---------------------------------------------------------------------------
// Auth token helpers
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Fetch wrappers
// ---------------------------------------------------------------------------

/**
 * Safely extract a human-readable error message from any API response.
 *
 * Handles:
 * - FastAPI `{ detail: "..." }`
 * - FastAPI validation `{ detail: [ { msg: "..." }, ... ] }`
 * - Generic `{ message: "..." }` or `{ error: "..." }`
 * - Non-JSON responses (HTML error pages, empty bodies)
 */
export async function parseErrorResponse(res: Response): Promise<string> {
  let body: string;
  try {
    body = await res.text();
  } catch {
    return `Server error (HTTP ${res.status})`;
  }

  // Try JSON parse
  try {
    const data = JSON.parse(body);

    // FastAPI-style detail
    if (typeof data.detail === 'string') return data.detail;
    if (Array.isArray(data.detail)) {
      return data.detail
        .map((d: { msg?: string }) => d.msg || JSON.stringify(d))
        .join('; ');
    }
    if (data.detail && typeof data.detail === 'object' && data.detail.msg) {
      return data.detail.msg;
    }

    // Generic message / error fields
    if (typeof data.message === 'string') return data.message;
    if (typeof data.error === 'string') return data.error;

    return `Server error (HTTP ${res.status})`;
  } catch {
    // Non-JSON response — return a safe summary
    return `Server error (HTTP ${res.status})`;
  }
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

  const url = `${API_BASE}${path}`;

  try {
    if (__DEV__) {
      console.log(`[ResQAI] → ${options.method || 'GET'} ${url}`);
    }
    const res = await fetch(url, {
      ...options,
      headers,
    });
    if (__DEV__) {
      console.log(`[ResQAI] ← ${res.status} ${url}`);
    }
    return res;
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : String(error);
    console.warn(`[ResQAI] Network error for ${path}: ${errMsg}`);
    return new Response(
      JSON.stringify({
        detail: `Cannot reach the server. Please check your internet connection and try again.`,
        error: 'network_unavailable',
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

  const url = `${AI_BASE}${path}`;

  try {
    if (__DEV__) {
      console.log(`[ResQAI] → AI ${options.method || 'GET'} ${url}`);
    }
    return await fetch(url, {
      ...options,
      headers,
    });
  } catch (error) {
    const errMsg =
      error instanceof Error ? error.message : String(error);
    console.warn(`[ResQAI] AI request failed for ${path}: ${errMsg}`);
    return new Response(
      JSON.stringify({
        detail: 'The AI service is currently unavailable.',
        error: 'network_unavailable',
      }),
      {
        status: 503,
        headers: { 'Content-Type': 'application/json' },
      }
    );
  }
}
