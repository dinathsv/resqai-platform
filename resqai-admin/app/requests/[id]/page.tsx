'use client';

import { use, useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/lib/api';
import styles from './requestDetail.module.css';

interface TimelineEvent {
  status: string;
  timestamp: string;
}

interface RequestDetail {
  request_id: string;
  emergency_type: string;
  urgency_level: number;
  original_message: string;
  ai_summary: string;
  gps_location: { lat: number; lng: number } | null;
  status: string;
  timeline: TimelineEvent[];
}

interface Mission {
  mission_id: string;
  name: string;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function RequestDetailPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const { id } = params;

  const [selectedMission, setSelectedMission] = useState('');
  const [missions, setMissions] = useState<Mission[]>([]);

  const { data: request, error, mutate } = useSWR<RequestDetail>(
    `/api/requests/${id}`,
    fetcher
  );

  useEffect(() => {

    api.get('/api/missions?status=active').then((res) => {
      setMissions(res.data.missions || []);
    }).catch((err) => console.error("Failed to fetch missions", err));
  }, []);

  async function updateStatus(newStatus: string) {
    if (newStatus === 'flagged' && !window.confirm('Flag this request as fake?')) return;
    try {
      await api.patch(`/api/requests/${id}/status`, { status: newStatus });
      mutate();
      if (newStatus === 'flagged' || newStatus === 'resolved') {
        router.push('/requests');
      }
    } catch {
      alert('Failed to update status');
    }
  }

  async function assignToMission() {
    if (!selectedMission) return;
    try {
      await api.post(`/api/missions/${selectedMission}/assign-request`, { request_id: id });
      alert('Request assigned successfully');
      mutate();
    } catch {
      alert('Failed to assign request');
    }
  }

  if (error) return <div className="page">Failed to load request</div>;
  if (!request) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h1>Request #{request.request_id.slice(0, 8)}</h1>

      <div className={styles.section}>
        <div className={styles.originalMessage}>
          {request.original_message}
        </div>
        {request.ai_summary && (
          <div className={styles.aiSummary}>
            {request.ai_summary}
          </div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Location</h2>
        {request.gps_location ? (
          <div>
            {request.gps_location.lat}, {request.gps_location.lng}
            <a
              href={`https://www.google.com/maps/search/?api=1&query=${request.gps_location.lat},${request.gps_location.lng}`}
              target="_blank"
              rel="noreferrer"
              className={styles.gpsLink}
            >
              Open Maps
            </a>
          </div>
        ) : (
          <div>Location not provided</div>
        )}
      </div>

      <div className={styles.section}>
        <h2>Timeline</h2>
        <ul className={styles.timeline}>
          {request.timeline && request.timeline.length > 0 ? (
            request.timeline.map((event, idx) => (
              <li key={idx} className={styles.timelineItem}>
                <span className={styles.timelineDate}>
                  {new Date(event.timestamp).toLocaleString()}
                </span>
                {event.status}
              </li>
            ))
          ) : (
            <li className={styles.timelineItem}>
              <span className={styles.timelineDate}>—</span>
              No timeline events
            </li>
          )}
        </ul>
      </div>

      {request.status !== 'resolved' && request.status !== 'flagged' && request.status !== 'cancelled' && (
        <div className={styles.section}>
          <h2>Assign to Mission</h2>
          <div className={styles.assignRow}>
            <select
              value={selectedMission}
              onChange={(e) => setSelectedMission(e.target.value)}
            >
              <option value="">Select a mission...</option>
              {missions.map((m) => (
                <option key={m.mission_id} value={m.mission_id}>{m.name}</option>
              ))}
            </select>
            <button className={styles.assignBtn} onClick={assignToMission}>
              Assign
            </button>
          </div>
        </div>
      )}

      <div className={styles.actionRow}>
        {request.status !== 'resolved' && (
          <button onClick={() => updateStatus('resolved')}>
            Mark Resolved
          </button>
        )}
        {request.status !== 'flagged' && (
          <button className="danger" onClick={() => updateStatus('flagged')}>
            Flag as Fake
          </button>
        )}
      </div>
    </div>
  );
}
