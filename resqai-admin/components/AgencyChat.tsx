'use client';

import { FormEvent, useEffect, useState } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';
import { apiError } from '@/lib/operations';
import { getSocket } from '@/lib/socket';

interface Message { message_id: string; message_text: string; sent_at: string; sender: string; agency?: string; district?: string }
const fetcher = (url: string) => api.get(url).then(response => response.data);

export default function AgencyChat() {
  const { data, error, mutate } = useSWR<{ messages: Message[]; has_more: boolean }>('/api/chat?limit=50', fetcher, { refreshInterval: 15000 });
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [older, setOlder] = useState<Message[]>([]);
  const [hasMore, setHasMore] = useState(true);
  const [loadingOlder, setLoadingOlder] = useState(false);
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => { void mutate(); };
    socket.on('agency_message', refresh);
    return () => { socket.off('agency_message', refresh); };
  }, [mutate]);
  async function send(event: FormEvent) {
    event.preventDefault();
    if (saving || !text.trim()) return;
    setSaving(true); setFeedback('');
    try { await api.post('/api/chat', { message_text: text, channel_id: 1 }); setText(''); await mutate(); }
    catch (error) { setFeedback(apiError(error, 'Message was not saved. Please retry.')); }
    finally { setSaving(false); }
  }
  async function loadOlder() {
    const before = older[0]?.sent_at || data?.messages[0]?.sent_at;
    if (!before || loadingOlder) return;
    setLoadingOlder(true);
    try {
      const response = await api.get('/api/chat', { params: { before, limit: 50 } });
      setOlder(previous => [...response.data.messages, ...previous]); setHasMore(response.data.has_more);
    } catch (error) { setFeedback(apiError(error, 'Could not load older messages.')); }
    finally { setLoadingOlder(false); }
  }
  const messages = Array.from(new Map([...older, ...(data?.messages || [])].map(message => [message.message_id, message])).values());
  return <section className="section">
    <h2>Agency coordination</h2>
    <p className="opsMuted">Shared operations room for active administrators. Messages are retained when you reconnect.</p>
    {error && <p role="alert">Agency messages could not be loaded.</p>}
    {hasMore && data?.has_more && <button type="button" className="outline" onClick={loadOlder} disabled={loadingOlder}>{loadingOlder ? 'Loading…' : 'Load older messages'}</button>}
    <div className="opsChat" aria-label="Agency message history">
      {messages.map(message => <article key={message.message_id} className="opsChatMessage">
        <strong>{message.sender}</strong> <span className="opsMuted">{[message.agency, message.district].filter(Boolean).join(' · ')}</span>
        <p style={{ whiteSpace: 'pre-wrap' }}>{message.message_text}</p>
        <time className="opsMuted" dateTime={message.sent_at}>{new Date(message.sent_at).toLocaleString()}</time>
      </article>)}
      {!messages.length && !error && <p>No messages yet. Coordinate a review or delivery here.</p>}
    </div>
    <form onSubmit={send} className="opsForm">
      <label>Message<textarea value={text} maxLength={2000} rows={3} onChange={event => setText(event.target.value)} required /></label>
      <button type="submit" disabled={saving || !text.trim()}>{saving ? 'Sending…' : 'Send message'}</button>
      {feedback && <p role="alert">{feedback}</p>}
    </form>
  </section>;
}
