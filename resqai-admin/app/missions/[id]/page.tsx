'use client';

import { FormEvent, use, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';
import { apiError, readable } from '@/lib/operations';
import VerificationBadge from '@/components/VerificationBadge';

interface Participant { assignment_id?: string; donation_id?: string; user_id?: string; full_name?: string; email?: string; status: string; quantity?: number; item_name?: string; unit?: string; delivered_quantity?: number; completion_requested_at?: string; completion_note?: string; recipient_confirmed_at?: string; completion_review_reason?: string; reviewed_by?: string; reviewed_at?: string }
interface Mission { mission_id: string; title: string; description?: string; status: string; mission_type: string; request_id?: string; original_message?: string; requester_name?: string; created_at: string; verification_status: string }
interface Response { mission: Mission; participants: Participant[]; donations: Participant[]; history: Array<{ history_id: string; old_status: string; new_status: string; notes: string; changed_at: string; reviewer_name?: string }> }
const fetcher = (url: string) => api.get(url).then(response => response.data);
const transitions: Record<string, string[]> = { planning: ['active','cancelled'], active: ['paused','completed','cancelled'], paused: ['active','cancelled'], completed: [], cancelled: [] };

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, isLoading, mutate } = useSWR<Response>(`/api/missions/${id}`, fetcher, { refreshInterval: 15000 });
  const [status, setStatus] = useState('');
  const [reason, setReason] = useState('');
  const [assignmentId, setAssignmentId] = useState('');
  const [exceptionReason, setExceptionReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  async function saveStatus(event: FormEvent) {
    event.preventDefault(); if (!status || saving) return;
    setSaving(true); setFeedback('');
    try { await api.patch(`/api/missions/${id}/status`, { status, reason }); await mutate(); setStatus(''); setReason(''); setFailed(false); setFeedback('Mission transition recorded.'); }
    catch (error) { setFailed(true); setFeedback(apiError(error, 'Mission status could not be updated.')); }
    finally { setSaving(false); }
  }
  async function confirmException(event: FormEvent) {
    event.preventDefault(); if (!assignmentId || saving) return;
    setSaving(true); setFeedback('');
    try { await api.post(`/api/goods/volunteers/${assignmentId}/complete-exception`, { reason: exceptionReason }); await mutate(); setAssignmentId(''); setExceptionReason(''); setFailed(false); setFeedback('Administrator confirmation and findings recorded.'); }
    catch (error) { setFailed(true); setFeedback(apiError(error, 'Completion review could not be saved.')); }
    finally { setSaving(false); }
  }
  if (isLoading) return <div className="page">Loading mission…</div>;
  if (error || !data) return <div className="page" role="alert">Unable to load this mission.</div>;
  const { mission } = data;
  const available = transitions[mission.status] || [];
  return <div className="page"><Link href="/missions">← Missions</Link><h1>{mission.title}</h1>
    <div className="opsActions"><span className="statusBadge statusInfo">{readable(mission.status)}</span><VerificationBadge status={mission.verification_status} /></div>
    <section className="section"><h2>Originating request</h2><p>{mission.original_message || mission.description || 'No description recorded.'}</p><p>Requester: {mission.requester_name || 'Guest'}</p>{mission.request_id && <Link href={`/requests/${mission.request_id}`}>View need verification and request history</Link>}{mission.mission_type === 'donation' && <p><Link href="/goods">Open goods inventory and deliveries</Link></p>}</section>
    <section className="section"><h2>Mission progress</h2><p className="opsMuted">Completion requires confirmed assistance or all goods delivered. Outstanding stock and disputes must be resolved first.</p>
      {available.length ? <form className="opsForm" onSubmit={saveStatus}><label>Next status<select value={status} required onChange={event => setStatus(event.target.value)}><option value="">Select transition</option>{available.map(value => <option key={value} value={value}>{readable(value)}</option>)}</select></label><label>Reason and checks completed<textarea required minLength={10} maxLength={2000} value={reason} rows={3} onChange={event => setReason(event.target.value)} /></label><button type="submit" disabled={saving || !status || reason.trim().length < 10}>{saving ? 'Saving…' : 'Update mission status'}</button></form> : <p>This mission is closed.</p>}
      {feedback && <p role={failed ? 'alert' : 'status'} className={failed ? 'opsError' : ''}>{feedback}</p>}
    </section>
    <section className="section"><h2>Volunteer assistance</h2>{data.participants.length ? data.participants.map(person => <article className="opsCard" key={person.assignment_id}>
      <strong>{person.full_name || 'Volunteer'}</strong><p>Status: {readable(person.status)}</p>{person.completion_note && <p>Volunteer completion note: {person.completion_note}</p>}
      {person.recipient_confirmed_at ? <p>Recipient confirmed on {new Date(person.recipient_confirmed_at).toLocaleString()}</p> : person.reviewed_at ? <p>Administrator confirmed: {person.completion_review_reason}</p> : <p className="opsMuted">Recipient confirmation has not been recorded.</p>}
      {(person.completion_requested_at || person.status === 'completed') && !person.recipient_confirmed_at && !person.reviewed_at && available.length > 0 && <button type="button" className="outline" disabled={saving} onClick={() => { setAssignmentId(person.assignment_id || ''); setExceptionReason(''); }}>Review completion exception</button>}
    </article>) : <p>No volunteer assignments.</p>}
      {assignmentId && <form className="opsForm" onSubmit={confirmException}><p className="opsNotice">Use this when normal recipient confirmation is unavailable. Record the callback, field evidence, or agency confirmation supporting completion; the audit identifies this as administrator confirmation.</p><label>Evidence and reason<textarea required minLength={20} maxLength={1500} rows={4} value={exceptionReason} onChange={event => setExceptionReason(event.target.value)} /></label><div className="opsActions"><button type="submit" disabled={saving || exceptionReason.trim().length < 20}>Record reviewed completion</button><button type="button" className="outline" disabled={saving} onClick={() => setAssignmentId('')}>Cancel</button></div></form>}
    </section>
    {mission.mission_type === 'donation' && <section className="section"><h2>Goods contributions</h2>{data.donations.length ? data.donations.map(pledge => <article className="opsCard" key={pledge.donation_id}><strong>{pledge.full_name}</strong><p>{pledge.quantity} {pledge.unit} {pledge.item_name} pledged · {pledge.delivered_quantity || 0} confirmed delivered</p><span>{readable(pledge.status)}</span></article>) : <p>No goods pledged yet.</p>}</section>}
    <section className="section"><h2>Mission history</h2><ol className="opsTimeline">{data.history?.map(entry => <li key={entry.history_id}><strong>{readable(entry.old_status)} → {readable(entry.new_status)}</strong><p>{entry.notes}</p><small>{entry.reviewer_name || 'Administrator'} · {new Date(entry.changed_at).toLocaleString()}</small></li>)}</ol></section>
  </div>;
}
