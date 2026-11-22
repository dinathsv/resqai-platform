import { API_BASE, getToken, parseErrorResponse } from '../config/api';

export const MAX_EVIDENCE_IMAGE_BYTES = 3_000_000;

export interface EvidenceChallenge {
  challenge_id: string;
  challenge_code?: string;
  prompt: string;
  expires_at: string;
}
export interface EvidenceInfo {
  configured: boolean;
  items: { evidence_id: string; kind: string; created_at: string; expires_at: string }[];
  review_note?: string;
}

/** Image contents stay in memory and go only to the authenticated evidence API. */
export function isValidEvidenceImage(value: string): boolean {
  const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(value);
  if (!match || match[2].length % 4 !== 0) return false;
  const padding = match[2].endsWith('==') ? 2 : match[2].endsWith('=') ? 1 : 0;
  const bytes = match[2].length * 3 / 4 - padding;
  return bytes >= 64 && bytes <= MAX_EVIDENCE_IMAGE_BYTES;
}

export function isActiveEvidenceChallenge(challenge: EvidenceChallenge | null, now = Date.now()): challenge is EvidenceChallenge {
  return !!challenge && typeof challenge.challenge_id === 'string' && !!challenge.challenge_id
    && typeof challenge.prompt === 'string' && !!challenge.prompt.trim()
    && Number.isFinite(Date.parse(challenge.expires_at)) && Date.parse(challenge.expires_at) > now;
}

export async function evidenceRequest<T>(
  requestId: string, method: 'GET' | 'POST' | 'DELETE', body?: object,
  challenge = false, signal?: AbortSignal,
): Promise<T> {
  const token = await getToken();
  if (!token) throw new Error('Sign in with a phone-verified account to submit private verification photos.');
  const controller = new AbortController();
  const abort = () => controller.abort();
  if (signal?.aborted) controller.abort();
  signal?.addEventListener('abort', abort, { once: true });
  const timeout = setTimeout(abort, 30000);
  try {
    const response = await fetch(`${API_BASE}/api/requests/${encodeURIComponent(requestId)}/verification-evidence${challenge ? '/challenge' : ''}`, {
      method, signal: controller.signal, cache: 'no-store', redirect: 'error',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' },
      ...(body ? { body: JSON.stringify(body) } : {}),
    });
    if (!response.ok) throw new Error(await parseErrorResponse(response));
    return response.status === 204 ? undefined as T : await response.json();
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener('abort', abort);
  }
}
