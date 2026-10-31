'use client';

import { FormEvent, use, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';
import { apiError, readable } from '@/lib/operations';
import VerificationBadge from '@/components/VerificationBadge';

interface Participant {
  assignment_id?: string; donation_id?: string; user_id?: string; full_name?: string;
  email?: string; phone_number?: string; status?: string; quantity?: number;
  item_name?: string; unit?: string; delivered_quantity?: number;
}
interface RequestDetail {
  request_id: string; request_type: 'help' | 'donation'; original_message: string;
  submitted_by: string; submitted_by_email?: string; submitted_by_phone?: string; phone_verified: boolean;
  created_at: string; admin_status: string; status: string; verification_status: string;
  verification_method?: string; verification_notes?: string; verified_at?: string;
  urgency_level: number; triage_source?: string; incident_type?: string; affected_people: number;
  location_source: string; location_label?: string; gps_location?: { lat: number; lng: number };
  requested_items: Array<{ item_name: string; quantity: number; unit: string }>;
  evidence_note?: string; risk_flags: Array<string | Record<string, unknown>>;
  participants: Participant[]; missions: Array<{ mission_id: string; title: string; status: string }>;
  status_history: Array<{ history_id: string; old_status?: string; new_status: string; changed_at: string; notes?: string }>;
  verification_history: Array<{ verification_id: string; decision: string; method: string; notes: string; reviewer_name?: string; agency?: string; created_at: string }>;
}
const fetcher = (url: string) => api.get(url).then(response => response.data);

export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: request, error, isLoading, mutate } = useSWR<RequestDetail>(`/api/requests/${id}`, fetcher, { refreshInterval: 15000 });
  const [decision, setDecision] = useState('needs_information');
  const [method, setMethod] = useState('phone_callback');
  const [notes, setNotes] = useState('');
  const [nextStatus, setNextStatus] = useState('in_progress');
  const [reason, setReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);

  async function review(event: FormEvent) {
    event.preventDefault();
    if (!request || saving) return;
    setSaving(true); setFeedback('');
    try {
      await api.patch(`/api/requests/${id}/verification`, { decision, method, notes, expected_verification_status: request.verification_status });
      setNotes(''); await mutate(); setFailed(false); setFeedback('Review saved with the reviewer and decision history.');
    } catch (error) { setFailed(true); setFeedback(apiError(error, 'Review could not be saved.')); }
    finally { setSaving(false); }
  }
  async function updateStatus(event: FormEvent) {
    event.preventDefault(); if (saving) return;
    setSaving(true); setFeedback('');
    try { await api.patch(`/api/requests/${id}/status`, { status: nextStatus, reason }); await mutate(); setReason(''); setFailed(false); setFeedback('Response status updated.'); }
    catch (error) { setFailed(true); setFeedback(apiError(error, 'Status could not be updated.')); }
    finally { setSaving(false); }
  }
  if (isLoading) return <div className="page">Loading request…</div>;
  if (error || !request) return <div className="page" role="alert">Unable to load this request.</div>;
  const closed = request.admin_status === 'finished' || ['resolved', 'cancelled'].includes(request.status);

  return <div className="page">
    <Link href="/requests">← Review queue</Link>
    <h1>{request.request_type === 'donation' ? 'Goods request' : 'Help request'} #{id.slice(0, 8)}</h1>
    <div className="opsActions"><VerificationBadge status={request.verification_status} /><span className="statusBadge statusInfo">{readable(request.admin_status)}</span><strong>Priority {request.urgency_level}/5</strong></div>
    <section className="section">
      <h2>Reported situation</h2>
      <p style={{ whiteSpace: 'pre-wrap' }}>{request.original_message}</p>
      <div className="opsGrid">
        <div><strong>Affected people</strong><p>{request.affected_people ?? 'Not recorded'}</p></div>
        <div><strong>Priority assessment</strong><p>{readable(request.triage_source || 'not recorded')}{request.incident_type ? ` · ${readable(request.incident_type)}` : ''}</p><small>Priority supports dispatcher review; it does not prove the report is genuine.</small></div>
        <div><strong>Location</strong><p>{request.location_label || 'No area description'}</p><p className="opsMuted">Source: {readable(request.location_source || 'unknown')}</p>
          {request.gps_location && <a href={`https://www.google.com/maps?q=${request.gps_location.lat},${request.gps_location.lng}`} target="_blank" rel="noopener noreferrer">View reported coordinates</a>}</div>
      </div>
      <h3>Requested goods</h3>
      {request.requested_items?.length ? <ul>{request.requested_items.map((item, index) => <li key={index}>{item.item_name}: {item.quantity} {item.unit}</li>)}</ul> : <p className="opsMuted">No itemized goods requested.</p>}
      <h3 style={{ marginTop: 16 }}>Supporting information supplied by requester</h3>
      <p style={{ whiteSpace: 'pre-wrap' }}>{request.evidence_note || 'No supporting note supplied. Ask for details during review.'}</p>
      {request.risk_flags?.length > 0 && <div className="opsNotice"><strong>Review flags — signals to check, not a fraud verdict</strong><ul>{request.risk_flags.map((flag, index) => <li key={index}>{typeof flag === 'string' ? readable(flag) : String(flag.reason || flag.message || flag.code || JSON.stringify(flag))}</li>)}</ul></div>}
    </section>
    <section className="section">
      <h2>Requester contact</h2><p>{request.submitted_by || 'Guest'}</p>
      {request.submitted_by_email && <p>{request.submitted_by_email}</p>}
      {request.submitted_by_phone && <p><a href={`tel:${request.submitted_by_phone}`}>{request.submitted_by_phone}</a></p>}
      <p className="opsMuted">Phone: {request.phone_verified ? 'OTP verified' : 'Not verified'}. Phone ownership is separate from confirmation of the need.</p>
      <p className="opsMuted">Submitted {new Date(request.created_at).toLocaleString()}</p>
    </section>
    <section className="section">
      <h2>Review the need</h2>
      <p>Record the checks you actually completed and the evidence supporting your decision. Goods requests become available to donors after approval.</p>
      {closed ? <p>This request is closed.</p> : <form className="opsForm" onSubmit={review}>
        <label>Decision<select value={decision} onChange={event => setDecision(event.target.value)}><option value="needs_information">Request more information</option><option value="verified">Confirm need</option><option value="rejected">Reject request</option></select></label>
        <label>Verification method<select value={method} onChange={event => setMethod(event.target.value)}><option value="phone_callback">Phone callback</option><option value="field_visit">Field visit</option><option value="agency_confirmation">Agency confirmation</option><option value="document_review">Document review</option></select></label>
        <label>Findings and reason<textarea value={notes} onChange={event => setNotes(event.target.value)} minLength={10} maxLength={2000} rows={4} required placeholder="Who confirmed the need, what was checked, and any remaining uncertainty" /></label>
        <button type="submit" disabled={saving || notes.trim().length < 10}>{saving ? 'Saving…' : 'Save review'}</button>
      </form>}
      {feedback && <p role={failed ? 'alert' : 'status'} className={failed ? 'opsError' : ''}>{feedback}</p>}
    </section>
    <section className="section"><h2>Response progress</h2>
      {!closed && <form className="opsForm" onSubmit={updateStatus}><label>Next status<select value={nextStatus} onChange={event => setNextStatus(event.target.value)}><option value="in_progress">In progress</option><option value="finished">Finished — missions completed</option></select></label>
        <label>Reason<textarea value={reason} minLength={10} maxLength={2000} required onChange={event => setReason(event.target.value)} rows={2} /></label>
        <button type="submit" disabled={saving || reason.trim().length < 10}>Update response status</button></form>}
      {request.missions?.map(mission => <p key={mission.mission_id}><Link href={`/missions/${mission.mission_id}`}>{mission.title}</Link> · {readable(mission.status)}</p>)}
      {!request.missions?.length && <p>No mission yet.</p>}
      {request.request_type === 'donation' && <p><Link href="/goods">Open goods and delivery coordination</Link></p>}
    </section>
    <section className="section"><h2>Participants</h2>{request.participants?.length ? request.participants.map((person, index) => <div className="opsCard" key={person.assignment_id || person.donation_id || index}><strong>{person.full_name || 'User'}</strong><p>{person.status && readable(person.status)}</p>{person.item_name && <p>{person.quantity} {person.unit} {person.item_name} · confirmed delivered: {person.delivered_quantity || 0}</p>}</div>) : <p>No participants yet.</p>}</section>
    <section className="section"><h2>Verification history</h2><ol className="opsTimeline">{request.verification_history?.map(review => <li key={review.verification_id}><strong>{readable(review.decision)} · {readable(review.method)}</strong><p>{review.notes}</p><small>{review.reviewer_name || 'Administrator'}{review.agency ? ` · ${review.agency}` : ''} · {new Date(review.created_at).toLocaleString()}</small></li>)}</ol>{!request.verification_history?.length && <p>No verification decisions recorded.</p>}</section>
    <section className="section"><h2>Response history</h2><ol className="opsTimeline">{request.status_history?.map(entry => <li key={entry.history_id}><strong>{readable(entry.new_status)}</strong><p>{entry.notes || 'System workflow transition'}</p><small>{new Date(entry.changed_at).toLocaleString()}</small></li>)}</ol></section>
  </div>;
}
