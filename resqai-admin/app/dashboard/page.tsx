'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './dashboard.module.css';

interface StatData {
  help_requests: number;
  donation_requests: number;
  active_missions: number;
  active_alerts: number;
}

interface SituationalReport {
  narrative: string;
  statistics: Record<string, number>;
  generated_at: string;
}

interface HelpRequest {
  request_id: string;
  emergency_type: string;
  request_type?: 'help' | 'donation';
  original_message: string;
  created_at: string;
  submitted_by?: string;
  source: string;
  admin_status?: 'pending' | 'in_progress' | 'finished';
  status: string;
}

interface RequestsResponse {
  requests: HelpRequest[];
  total: number;
  page: number;
  pages: number;
}

interface ChatMessage {
  id: string;
  agency: string;
  sender: string;
  message_text: string;
  created_at: string;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);
const fetchStats = async (url: string): Promise<StatData> => {
  const { data } = await api.get(url);
  const fields: (keyof StatData)[] = ['help_requests', 'donation_requests', 'active_missions', 'active_alerts'];
  if (!data || fields.some((field) => typeof data[field] !== 'number' || !Number.isFinite(data[field]))) {
    throw new Error('Dashboard API returned invalid totals.');
  }
  return data as StatData;
};

const fetchRequests = async (url: string): Promise<RequestsResponse> => {
  const { data } = await api.get(url);
  if (!data || !Array.isArray(data.requests)) {
    throw new Error('Requests API returned an invalid response.');
  }
  return data as RequestsResponse;
};

export default function DashboardPage() {

  const { data: stats, error: statsError } = useSWR<StatData>('/api/admin/dashboard/stats', fetchStats, {
    refreshInterval: 30000,
  });

  const requestsKey = '/api/requests?limit=20';
  const { data: requestData, error: requestsError, isLoading: requestsLoading, mutate: mutateRequests } = useSWR<RequestsResponse>(requestsKey, fetchRequests, {
    refreshInterval: 30000,
  });
  const requests = requestData?.requests;

  const [report, setReport] = useState<SituationalReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const reportLock = useRef(false);
  const [reportTime, setReportTime] = useState<string>('');
  const [reportError, setReportError] = useState<string>('');
  const generateReport = useCallback(async () => {
    if (reportLock.current) return;
    reportLock.current = true;
    setReportLoading(true);
    setReportError('');
    try {
      const res = await api.get('/api/admin/dashboard/report');
      setReport(res.data);
      setReportTime(new Date().toLocaleTimeString());
    } catch (error: unknown) {
      setReport(null);
      const apiError = error as { response?: { data?: { error?: string } } };
      setReportError(apiError.response?.data?.error || 'Unable to generate the report. Please try again.');
    } finally {
      reportLock.current = false;
      setReportLoading(false);
    }
  }, []);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on('new_message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });
    
    socket.on('new_request', () => {
      // Re-fetch the requests list instantly
      mutateRequests();
      // Also mutate stats to update the counters instantly
      mutate('/api/admin/dashboard/stats');
    });

    socket.on('request_updated', () => {
      mutateRequests();
      mutate('/api/admin/dashboard/stats');
    });

    const refreshStats = () => mutate('/api/admin/dashboard/stats');
    socket.on('emergency_alert', refreshStats);
    socket.on('alert_updated', refreshStats);

    return () => {
      socket.off('new_message');
      socket.off('new_request');
      socket.off('request_updated');
      socket.off('emergency_alert', refreshStats);
      socket.off('alert_updated', refreshStats);
    };
  }, [mutateRequests]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  function sendChat() {
    if (!chatInput.trim()) return;
    const socket = getSocket();
    socket.emit('admin_send_message', {
      channel_id: 1,
      message_text: chatInput,
    });
    setChatInput('');
  }

  function getStatusBadge(status: string) {
    if (status === 'finished') return <span className="statusBadge statusSuccess">Finished</span>;
    if (status === 'in_progress') return <span className="statusBadge statusWarning">In Progress</span>;
    return <span className="statusBadge statusInfo">Pending</span>;
  }

  return (
    <div className="page">
      <div className={styles.sectionHeader}>
        <div>
          <h1>Dashboard</h1>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statBox}>
          <div className={styles.statContent}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Help Requests</span>
              <div className={styles.statIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                  <path d="M9 14l2 2 4-4" />
                </svg>
              </div>
            </div>
            <div className={styles.statNumber}>{statsError ? '!' : stats?.help_requests ?? '—'}</div>
          </div>
        </div>

        <div className={`${styles.statBox} ${styles.statBoxCritical}`}>
          <div className={styles.statContent}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Donation Requests</span>
              <div className={styles.statIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />
                </svg>
              </div>
            </div>
            <div className={styles.statNumber}>{statsError ? '!' : stats?.donation_requests ?? '—'}</div>
          </div>
        </div>

        <div className={`${styles.statBox} ${styles.statBoxWarning}`}>
          <div className={styles.statContent}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Active Missions</span>
              <div className={styles.statIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
                </svg>
              </div>
            </div>
            <div className={styles.statNumber}>{statsError ? '!' : stats?.active_missions ?? '—'}</div>
          </div>
        </div>

        <div className={`${styles.statBox} ${styles.statBoxSuccess}`}>
          <div className={styles.statContent}>
            <div className={styles.statTop}>
              <span className={styles.statLabel}>Active Alerts</span>
              <div className={styles.statIcon}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" />
                  <path d="M13.73 21a2 2 0 0 1-3.46 0" />
                </svg>
              </div>
            </div>
            <div className={styles.statNumber}>{statsError ? '!' : stats?.active_alerts ?? '—'}</div>
          </div>
        </div>
      </div>

      {statsError && <p role="alert" className={styles.errorText}>Dashboard totals could not be loaded. Check your connection and permissions.</p>}

      <div className="section">
        <div className={styles.sectionHeader}>
          <h2>AI Summary Report</h2>
          <div>
            {reportTime && (
              <span className={styles.sectionMeta} style={{ marginRight: '12px' }}>
                Synced at {reportTime}
              </span>
            )}
            <button
              className={styles.refreshBtn}
              onClick={generateReport}
              disabled={reportLoading}
            >
              {reportLoading ? 'Generating...' : 'Generate Report'}
            </button>
          </div>
        </div>
        <div className={styles.reportBox}>
          {reportLoading ? (
            <p className={styles.loadingText}>Generating summary from current incident data...</p>
          ) : report ? (
            <>
              <div className={styles.reportStats}>
                {Object.entries(report.statistics || {}).map(([key, value]) => (
                  <span key={key}><strong>{key.replaceAll('_', ' ')}:</strong> {value}</span>
                ))}
              </div>
              <div className={styles.reportText}>
                {report.narrative.split('\n').map((p, i) => <p key={i}>{p}</p>)}
              </div>
            </>
          ) : (
            <p className={styles.loadingText}>
              {reportError || 'Click "Generate Report" to create a summary from current incident data.'}
            </p>
          )}
        </div>
      </div>

      <div className="section">
        <div className={styles.sectionHeader}>
          <h2>Requests</h2>
        </div>
        {requestsError && <p role="alert" className={styles.errorText}>Requests could not be loaded. Check your connection and permissions.</p>}
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Request Type</th>
                <th>Request Message</th>
                <th>Submitted By</th>
                <th>Created Date and Time</th>
                <th>Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              {requestsLoading ? (
                <tr><td colSpan={7}>Loading active requests...</td></tr>
              ) : requestsError ? (
                <tr><td colSpan={7}>Unable to load requests.</td></tr>
              ) : requests && requests.length > 0 ? (
                requests.map((r) => (
                  <tr key={r.request_id}>
                    <td><code>{r.request_id.slice(0, 8)}</code></td>
                    <td><strong>{r.request_type === 'donation' ? 'Donation Request' : 'Help Request'}</strong></td>
                    <td>{(r.original_message || '').slice(0, 80)}</td>
                    <td>{r.submitted_by || (r.source === 'guest' ? 'Guest' : 'User')}</td>
                    <td>{r.created_at ? new Date(r.created_at).toLocaleString() : '—'}</td>
                    <td>{getStatusBadge(r.admin_status || r.status)}</td>
                    <td><Link href={`/requests/${r.request_id}`} className={styles.actionLink}>View Details</Link></td>
                  </tr>
                ))
              ) : (
                <tr><td colSpan={7} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                  {requestData ? 'No active requests.' : 'Waiting for request data...'}
                </td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.chatSection}>
        <div className={styles.sectionHeader}>
          <h2>Team Chat</h2>
        </div>
        <div className={styles.chatBox}>
          <div className={styles.chatMessages}>
            {chatMessages.length === 0 ? (
              <p className={styles.loadingText} style={{ padding: '16px', textAlign: 'center' }}>
                Messages will appear here in real time.
              </p>
            ) : (
              chatMessages.map((msg, i) => (
                <div key={msg.id || i} className={styles.chatMessage}>
                  <strong>[{msg.agency}] {msg.sender}:</strong>
                  {msg.message_text}
                  <span className={styles.chatTime}>
                    {new Date(msg.created_at).toLocaleTimeString()}
                  </span>
                </div>
              ))
            )}
            <div ref={chatEndRef} />
          </div>
          <div className={styles.chatInputRow}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Send a message..."
              id="chat-input"
            />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
