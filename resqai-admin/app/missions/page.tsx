'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';

interface Mission {
  mission_id: string; request_id?: string; origin_request_id?: string;
  mission_type: 'help' | 'donation'; title: string; original_message?: string;
  description?: string; requester_name?: string; volunteer_count?: number;
  donation_count?: number; created_at: string; status: string;
}
interface MissionResponse { missions: Mission[] }
const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function MissionsPage() {
  const [filter, setFilter] = useState<'all' | 'active' | 'help' | 'donation' | 'completed'>('active');
  const { data, error, isLoading, mutate } = useSWR<MissionResponse>(`/api/missions?filter=${filter}`, fetcher, { refreshInterval: 5000 });

  async function updateStatus(id: string, status: string) {
    try { await api.patch(`/api/missions/${id}/status`, { status }); await mutate(); }
    catch { alert('Failed to update mission status.'); }
  }

  return (
    <div className="page">
      <h1>Missions</h1>
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px', flexWrap: 'wrap' }}>
        {(['all','active','help','donation','completed'] as const).map((item) => (
          <button key={item} type="button" className={filter === item ? '' : 'outline'} onClick={() => setFilter(item)}>
            {item === 'all' ? 'All Active Missions' : item === 'help' ? 'Help Missions' : item === 'donation' ? 'Donation Missions' : item[0].toUpperCase() + item.slice(1) + ' Missions'}
          </button>
        ))}
      </div>

      <div className="tableWrap">
        <table><thead><tr>
          <th>Mission ID</th><th>Related Request ID</th><th>Mission Type</th><th>Original Request Description</th>
          <th>Requester</th><th>Participants</th><th>Created</th><th>Status</th><th>Details</th>
        </tr></thead><tbody>
          {isLoading ? <tr><td colSpan={9}>Loading missions...</td></tr>
            : error ? <tr><td colSpan={9}>Unable to load missions.</td></tr>
            : data?.missions?.length ? data.missions.map((mission) => (
              <tr key={mission.mission_id}>
                <td><code>{mission.mission_id.slice(0, 8)}</code></td>
                <td><code>{(mission.request_id || mission.origin_request_id || '—').slice(0, 8)}</code></td>
                <td>{mission.mission_type === 'donation' ? 'Donation Mission' : 'Help Mission'}</td>
                <td>{mission.original_message || mission.description || '—'}</td>
                <td>{mission.requester_name || '—'}</td>
                <td>{(mission.volunteer_count || 0) + (mission.donation_count || 0)}</td>
                <td>{mission.created_at ? new Date(mission.created_at).toLocaleString() : '—'}</td>
                <td>{mission.status}</td>
                <td><Link href={`/missions/${mission.mission_id}`}>View Details</Link></td>
              </tr>
            )) : <tr><td colSpan={9}>No missions found.</td></tr>}
        </tbody></table>
      </div>
    </div>
  );
}
