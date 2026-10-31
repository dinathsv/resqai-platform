import AsyncStorage from '@react-native-async-storage/async-storage';
import { API_BASE, getToken, parseErrorResponse } from '../config/api';

export interface RequestedItem { item_name: string; quantity: number; unit: string }
export interface HelpPayload {
  client_request_id: string;
  message: string;
  request_type: 'help_rescue' | 'donation';
  lat?: number | null;
  lng?: number | null;
  location_label: string;
  location_source: 'gps' | 'manual' | 'unknown';
  affected_people: number;
  urgency_level?: number;
  requested_items: RequestedItem[];
  evidence_note: string;
}
export interface QueuedRequest {
  id: string; owner: string; payload: HelpPayload; created_at: string;
  status: 'queued' | 'failed'; error?: string;
}
const listeners = new Set<() => void>();
const locks = new Map<string, Promise<unknown>>();
const syncLocks = new Map<string, Promise<void>>();
export function subscribeQueue(fn: () => void) { listeners.add(fn); return () => { listeners.delete(fn); }; }
function notify() { listeners.forEach(fn => fn()); }
export function createClientId(): string {
  // This identifier prevents duplicate submissions; it is not an authentication secret.
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = Math.floor(Math.random() * 16); return (c === 'x' ? r : (r & 3) | 8).toString(16);
  });
}
export function ownerFromToken(token: string): string | null {
  try {
    const encoded = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    const body = JSON.parse(globalThis.atob(encoded));
    const id = body.sub || body.user_id || body.guest_id;
    return typeof id === 'string' ? `${body.role === 'guest' ? 'guest' : 'user'}:${id}` : null;
  } catch { return null; }
}
async function identity() {
  const token = await getToken();
  if (token) { const owner = ownerFromToken(token); return owner ? { token, owner } : null; }
  // Anonymous SOS stays in a separate device queue and is never attached to a later login.
  return { token: null, owner: 'anonymous-device' };
}
const keyFor = (owner: string) => `resqai:requests:v2:${owner}`;
async function read(owner: string): Promise<QueuedRequest[]> {
  const raw = await AsyncStorage.getItem(keyFor(owner));
  if (!raw) return [];
  const rows = JSON.parse(raw);
  if (!Array.isArray(rows)) throw new Error('Saved requests could not be read. Please try again.');
  return rows.filter((r: QueuedRequest) => r.owner === owner);
}
async function mutate(owner: string, fn: (rows: QueuedRequest[]) => QueuedRequest[]) {
  const previous = locks.get(owner) || Promise.resolve();
  const task = previous.catch(() => {}).then(async () => {
    await AsyncStorage.setItem(keyFor(owner), JSON.stringify(fn(await read(owner)))); notify();
  });
  locks.set(owner, task);
  try { await task; } finally { if (locks.get(owner) === task) locks.delete(owner); }
}
export async function getMyQueuedRequests(): Promise<QueuedRequest[]> {
  const user = await identity(); return user ? read(user.owner) : [];
}
export async function queueRequest(payload: HelpPayload): Promise<QueuedRequest> {
  const user = await identity();
  if (!user) throw new Error('Sign in or start a guest session before submitting a request.');
  const entry: QueuedRequest = { id: payload.client_request_id, owner: user.owner, payload, created_at: new Date().toISOString(), status: 'queued' };
  await mutate(user.owner, rows => rows.some(r => r.id === entry.id) ? rows.map(r => r.id === entry.id && r.status === 'failed' ? entry : r) : [...rows, entry]);
  return entry;
}
export async function syncMyRequests(includeFailed = false): Promise<void> {
  const user = await identity(); if (!user) return;
  const running = syncLocks.get(user.owner); if (running) return running;
  const work = (async () => {
    const rows = await read(user.owner);
    for (const row of rows) {
      if (row.status === 'failed' && !includeFailed) continue;
      const active = await identity();
      // A different session must never send another person's saved request.
      if (!active || active.owner !== user.owner) return;
      let status: QueuedRequest['status'] = 'queued'; let error = '';
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      try {
        const response = await fetch(`${API_BASE}/api/requests`, {
          method: 'POST', signal: controller.signal,
          headers: { 'Content-Type': 'application/json', ...(active.token ? { Authorization: `Bearer ${active.token}` } : {}) },
          body: JSON.stringify(row.payload),
        });
        if (response.ok) {
          const receipt = await response.json();
          const receiptKey = `resqai:receipts:v2:${user.owner}`;
          const previous = JSON.parse(await AsyncStorage.getItem(receiptKey) || '[]');
          const saved = { ...row.payload, ...receipt, created_at: row.created_at };
          await AsyncStorage.setItem(receiptKey, JSON.stringify([saved, ...previous.filter((r: {client_request_id: string}) => r.client_request_id !== row.id)].slice(0, 100)));
          await mutate(user.owner, existing => existing.filter(r => r.id !== row.id));
          continue;
        }
        error = await parseErrorResponse(response);
        status = response.status >= 500 || response.status === 429 ? 'queued' : 'failed';
      } catch { error = 'Not sent yet. Check your connection and retry.'; }
      finally { clearTimeout(timeout); }
      await mutate(user.owner, existing => existing.map(r => r.id === row.id ? { ...r, status, error } : r));
    }
  })();
  syncLocks.set(user.owner, work);
  try { await work; } finally { syncLocks.delete(user.owner); }
}
export async function removeQueuedRequest(id: string) {
  const user = await identity(); if (user) await mutate(user.owner, rows => rows.filter(r => r.id !== id));
}
export async function submitDurableRequest(payload: HelpPayload): Promise<'sent' | 'queued' | 'failed'> {
  const saved = await queueRequest(payload); // Never claim saved before storage succeeds.
  await syncMyRequests();
  const pending = (await read(saved.owner)).find(r => r.id === payload.client_request_id);
  return pending?.status || 'sent';
}

export async function getMyRequestReceipts(): Promise<any[]> {
  const user = await identity();
  if (!user) return [];
  return JSON.parse(await AsyncStorage.getItem(`resqai:receipts:v2:${user.owner}`) || '[]');
}
