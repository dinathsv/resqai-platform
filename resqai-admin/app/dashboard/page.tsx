'use client';

import { useEffect } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import AgencyChat from '@/components/AgencyChat';
import VerificationBadge from '@/components/VerificationBadge';
import { readable } from '@/lib/operations';

interface Request { request_id: string; original_message: string; request_type: string; submitted_by: string; urgency_level: number; verification_status: string; admin_status: string; created_at: string }
const fetcher = (url: string) => api.get(url).then(response => response.data);
const cards = [
  { key: 'urgent_waiting', label: 'Urgent reports awaiting response', href: '/requests', urgent: true },
  { key: 'awaiting_verification', label: 'Awaiting need verification', href: '/requests' },
  { key: 'active_missions', label: 'Active missions', href: '/missions' },
  { key: 'disputed_deliveries', label: 'Delivery disputes', href: '/goods', urgent: true },
  { key: 'fulfilled_requests', label: 'Resolved requests', href: '/reports' },
  { key: 'confirmed_deliveries', label: 'Confirmed goods deliveries', href: '/goods' },
  { key: 'goods_pledges', label: 'Goods pledges', href: '/goods' },
  { key: 'active_alerts', label: 'Active public alerts', href: '/alerts' },
];

export default function DashboardPage() {
  const { data: stats, error: statsError, mutate: refreshStats } = useSWR<Record<string, number | null>>('/api/admin/dashboard/stats', fetcher, { refreshInterval: 30000 });
  const { data, error: requestError, mutate: refreshRequests } = useSWR<{ requests: Request[] }>('/api/requests?limit=10&status=pending', fetcher, { refreshInterval: 15000 });
  useEffect(() => {
    const socket = getSocket();
    const refresh = () => { void refreshStats(); void refreshRequests(); };
    const events = ['new_request', 'request_updated', 'mission_updated', 'goods_updated', 'alert_updated', 'emergency_alert'];
    events.forEach(event => socket.on(event, refresh));
    return () => { events.forEach(event => socket.off(event, refresh)); };
  }, [refreshStats, refreshRequests]);
  return <div className="page"><h1>Response overview</h1>
    <p className="opsMuted">Current operational records. Emergency priority and confirmation of a reported need are tracked separately.</p>
    {statsError && <p role="alert" className="opsError">Operational totals are unavailable. Refresh to retry.</p>}
    <div className="opsGrid">{cards.map(card => <Link className="opsCard" key={card.key} href={card.href} style={{ textDecoration: 'none', color: 'inherit' }}><span>{card.label}</span><strong className="opsNumber" style={card.urgent && Number(stats?.[card.key]) > 0 ? { color: 'var(--status-critical)' } : undefined}>{statsError ? 'Unavailable' : stats?.[card.key] ?? '—'}</strong></Link>)}</div>
    <div className="opsActions"><Link href="/requests">Review pending needs</Link><Link href="/goods">Coordinate goods</Link><Link href="/reports">Export operational report</Link><button type="button" className="outline" onClick={() => { void refreshStats(); void refreshRequests(); }}>Refresh overview</button></div>
    <section className="section"><h2>Waiting requests</h2><p className="opsMuted">Highest priority first, then oldest. Unverified urgent reports can be investigated immediately.</p>
      <div className="tableWrap"><table><thead><tr><th>Request</th><th>Requester</th><th>Priority</th><th>Need verification</th><th>Waiting since</th></tr></thead><tbody>
        {requestError ? <tr><td colSpan={5}>Requests could not be loaded.</td></tr> : !data ? <tr><td colSpan={5}>Loading…</td></tr> : data.requests.length ? data.requests.map(request => <tr key={request.request_id}><td><Link href={`/requests/${request.request_id}`}>{request.request_type === 'donation' ? 'Goods request' : 'Help request'} #{request.request_id.slice(0, 8)}</Link><p>{request.original_message.slice(0, 160)}{request.original_message.length > 160 ? '…' : ''}</p></td><td>{request.submitted_by}</td><td>{request.urgency_level}/5</td><td><VerificationBadge status={request.verification_status} /><p className="opsMuted">{readable(request.admin_status)}</p></td><td>{new Date(request.created_at).toLocaleString()}</td></tr>) : <tr><td colSpan={5}>No waiting requests.</td></tr>}
      </tbody></table></div>
    </section>
    <AgencyChat />
  </div>;
}
