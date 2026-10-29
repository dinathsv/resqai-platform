'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';

interface Participant { assignment_id?: string; donation_id?: string; user_id?: string; full_name?: string; email?: string; status?: string; amount?: number; assigned_at?: string; created_at?: string; completed_at?: string }
interface MissionData { mission_id: string; title: string; description?: string; status: string; mission_type?: string; request_id?: string; original_message?: string; requester_name?: string; requester_email?: string; created_at: string; request_created_at?: string }
interface MissionResponse { mission: MissionData; participants: Participant[]; donations: Participant[] }
const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function MissionDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data, error, isLoading, mutate } = useSWR<MissionResponse>(`/api/missions/${id}`, fetcher);
  const [status, setStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');

  async function saveStatus() {
    if (!status) return;
    setSaving(true); setMessage('');
    try { await api.patch(`/api/missions/${id}/status`, { status }); await mutate(); setMessage('Mission status updated successfully.'); }
    catch { setMessage('Failed to update mission status.'); }
    finally { setSaving(false); }
  }

  if (isLoading) return <div className="page">Loading mission...</div>;
  if (error) return <div className="page">Failed to load mission.</div>;
  if (!data) return <div className="page">Mission not found.</div>;

  const mission = data.mission;
  const participants = [...data.participants, ...data.donations];

  return (
    <div className="page">
      <h1>Mission #{mission.mission_id.slice(0, 8)}</h1>
      <section className="section">
        <h2>Mission Information</h2>
        <p><strong>Type:</strong> {mission.mission_type === 'donation' ? 'Donation Mission' : 'Help Mission'}</p>
        <p><strong>Current status:</strong> {mission.status}</p>
        <p><strong>Created:</strong> {new Date(mission.created_at).toLocaleString()}</p>
        <select value={status || mission.status} onChange={(e) => setStatus(e.target.value)}>
          <option value="planning">Planning</option><option value="active">Active</option><option value="paused">Paused</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option>
        </select>
        <button type="button" style={{ marginTop: '12px' }} disabled={saving} onClick={saveStatus}>{saving ? 'Saving...' : 'Save Status'}</button>
        {message && <p role="status">{message}</p>}
      </section>

      <section className="section">
        <h2>Original Request</h2>
        <p>{mission.original_message || 'No description provided.'}</p>
        {mission.request_id && <p><a href={`/requests/${mission.request_id}`}>View Originating Request</a></p>}
        {mission.requester_name && <p><strong>Requester:</strong> {mission.requester_name}</p>}
      </section>

      <section className="section">
        <h2>{mission.mission_type === 'donation' ? 'Donation Commitments' : 'Accepted Helpers'}</h2>
        {participants.length ? participants.map((participant, index) => (
          <div key={participant.assignment_id || participant.donation_id || participant.user_id || index} style={{ borderBottom: '1px solid var(--border-default)', padding: '10px 0' }}>
            <strong>{participant.full_name || 'User'}</strong>
            {participant.email && <div>{participant.email}</div>}
            {typeof participant.amount === 'number' && <div>Commitment: LKR {participant.amount.toLocaleString()}</div>}
            <div>Status: {participant.status || 'accepted'}</div>
            {(participant.assigned_at || participant.created_at) && <div>Accepted: {new Date(participant.assigned_at || participant.created_at || '').toLocaleString()}</div>}
          </div>
        )) : <p>No users have accepted this mission yet.</p>}
      </section>
    </div>
  );
}
