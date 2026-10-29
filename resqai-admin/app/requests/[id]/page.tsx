'use client';

import { use, useState } from 'react';
import useSWR from 'swr';
import api from '@/lib/api';
import styles from './requestDetail.module.css';

interface Participant {
  assignment_id?: string; donation_id?: string; user_id?: string;
  full_name?: string; email?: string; phone_number?: string; avatar_url?: string;
  assigned_at?: string; accepted_at?: string; created_at?: string; completed_at?: string;
  status?: string; amount?: number; mission_id?: string; mission_title?: string;
}
interface RequestDetail {
  request_id: string; request_type: 'help' | 'donation'; emergency_type: string;
  original_message: string; submitted_by: string; submitted_by_email?: string; submitted_by_phone?: string;
  created_at: string; admin_status: 'pending' | 'in_progress' | 'finished'; gps_location?: { lat: number; lng: number } | null;
  participants: Participant[]; accepting_users: Participant[]; missions: Array<{ mission_id: string; title: string; description?: string; status: string; created_at: string }>;
  status_history: Array<{ history_id: string; old_status?: string; new_status: string; changed_at: string }>;
  timeline: Array<{ status: string; timestamp: string }>;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);
export default function RequestDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const { data: request, error, isLoading, mutate } = useSWR<RequestDetail>(`/api/requests/${id}`, fetcher, { refreshInterval: 5000 });
  const [status, setStatus] = useState<string>('');
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState<'success' | 'error'>('success');

  async function updateStatus() {
    if (!status) return;
    setSaving(true); setMessage('');
    try {
      await api.patch(`/api/requests/${id}/status`, { status });
      await mutate();
      setMessageType('success'); setMessage('Request status updated successfully.');
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setMessageType('error'); setMessage(apiError.response?.data?.error || 'Failed to update request status.');
    } finally { setSaving(false); }
  }

  if (isLoading) return <div className="page">Loading request...</div>;
  if (error) return <div className="page">Failed to load request.</div>;
  if (!request) return <div className="page">Request not found.</div>;

  const currentStatus = status || request.admin_status;
  const participantList = request.participants || request.accepting_users || [];

  return (
    <div className="page">
      <h1>Request #{request.request_id.slice(0, 8)}</h1>
      <div className={styles.section}>
        <h2>{request.request_type === 'donation' ? 'Donation Request' : 'Help Request'}</h2>
        <div className={styles.originalMessage}>{request.original_message || 'No description provided.'}</div>
      </div>

      <div className={styles.section}>
        <h2>Requester and Submission</h2>
        <p><strong>Submitted by:</strong> {request.submitted_by || 'Guest'}</p>
        {request.submitted_by_email && <p><strong>Email:</strong> {request.submitted_by_email}</p>}
        {request.submitted_by_phone && <p><strong>Phone:</strong> {request.submitted_by_phone}</p>}
        <p><strong>Created:</strong> {new Date(request.created_at).toLocaleString()}</p>
      </div>

      <div className={styles.section}>
        <h2>Request Status</h2>
        <div className={styles.assignRow}>
          <select value={currentStatus} onChange={(e) => setStatus(e.target.value)}>
            <option value="pending">Pending</option>
            <option value="in_progress">In Progress</option>
            <option value="finished">Finished</option>
          </select>
          <button type="button" className={styles.assignBtn} disabled={saving} onClick={updateStatus}>
            {saving ? 'Saving...' : 'Save Status'}
          </button>
        </div>
        {message && <p role={messageType === 'error' ? 'alert' : 'status'} className={messageType === 'error' ? styles.errorText : styles.successText}>{message}</p>}
      </div>

      <div className={styles.section}>
        <h2>Accepted Users</h2>
        {participantList.length === 0 ? (
          <p className={styles.metaText}>No users have accepted this request yet.</p>
        ) : (
          <div className={styles.participantList}>
            {participantList.map((participant, index) => (
              <div key={participant.assignment_id || participant.donation_id || participant.user_id || index} className={styles.participantCard}>
                <strong>{participant.full_name || 'User'}</strong>
                {participant.email && <span>{participant.email}</span>}
                {participant.phone_number && <span>{participant.phone_number}</span>}
                {typeof participant.amount === 'number' && <span>Amount: LKR {participant.amount.toLocaleString()}</span>}
                <span>Status: {participant.status || 'accepted'}</span>
                {(participant.assigned_at || participant.created_at) && (
                  <span>Accepted: {new Date(participant.assigned_at || participant.created_at || '').toLocaleString()}</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Related Missions</h2>
        {request.missions?.length ? request.missions.map((mission) => (
          <a key={mission.mission_id} href={`/missions/${mission.mission_id}`} className={styles.gpsLink}>
            {mission.title || mission.mission_id} — {mission.status}
          </a>
        )) : <p className={styles.metaText}>No mission has been created for this request.</p>}
      </div>

      <div className={styles.section}>
        <h2>Status History</h2>
        {request.status_history?.length ? (
          <ul className={styles.timeline}>{request.status_history.map((item) => (
            <li key={item.history_id} className={styles.timelineItem}>
              <span className={styles.timelineDate}>{new Date(item.changed_at).toLocaleString()}</span>
              {item.old_status ? `${item.old_status} → ${item.new_status}` : item.new_status}
            </li>
          ))}</ul>
        ) : <p className={styles.metaText}>No status changes recorded.</p>}
      </div>
    </div>
  );
}
