'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import useSWR, { mutate } from 'swr';
import api from '@/lib/api';
import { getSocket } from '@/lib/socket';
import styles from './dashboard.module.css';

interface StatData {
  active_requests: number;
  critical_count: number;
  active_alerts: number;
  total_donations: number;
}

interface HelpRequest {
  request_id: string;
  emergency_type: string;
  urgency_level: number;
  original_message: string;
  created_at: string;
  source: string;
  status: string;
}

interface SituationalReport {
  narrative: string;
  total_incidents: number;
  critical_count: number;
  zones: string[];
}

interface ChatMessage {
  id: string;
  agency: string;
  sender: string;
  message_text: string;
  created_at: string;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function DashboardPage() {

  const { data: stats } = useSWR<StatData>('/api/admin/dashboard/stats', fetcher, {
    refreshInterval: 30000,
  });

  const { data: requests } = useSWR<HelpRequest[]>('/api/requests?status=pending,ai_processing,verified,dispatched,in_progress&limit=20', fetcher, {
    refreshInterval: 30000,
  });

  const [report, setReport] = useState<SituationalReport | null>(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportTime, setReportTime] = useState<string>('');

  const generateReport = useCallback(async () => {
    if (!requests || requests.length === 0) return;
    setReportLoading(true);
    try {
      const res = await api.post('/api/ai/generate-summary', {
        requests: requests.map((r) => ({
          request_id: r.request_id,
          emergency_type: r.emergency_type,
          urgency_level: r.urgency_level,
          message: r.original_message,
          status: r.status,
        })),
      });
      setReport(res.data);
      setReportTime(new Date().toLocaleTimeString());
    } catch {
      setReport(null);
    } finally {
      setReportLoading(false);
    }
  }, [requests]);

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState('');
  const chatEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const socket = getSocket();
    socket.on('new_message', (msg: ChatMessage) => {
      setChatMessages((prev) => [...prev, msg]);
    });
    
    socket.on('new_request', (req: any) => {
      // Re-fetch the requests list instantly
      mutate('/api/requests?status=pending,ai_processing,verified,dispatched,in_progress&limit=20');
      // Also mutate stats to update the counters instantly
      mutate('/api/admin/dashboard/stats');
    });

    return () => {
      socket.off('new_message');
      socket.off('new_request');
    };
  }, []);

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

  async function resolveRequest(id: string) {
    try {
      await api.patch(`/api/requests/${id}/status`, { status: 'resolved' });
    } catch (error) {
      console.error("Failed to resolve request:", error);
    }
  }

  function urgencyClass(level: number) {
    if (level === 5) return styles.urgency5;
    if (level === 4) return styles.urgency4;
    return styles.urgencyNormal;
  }

  function formatCurrency(amount: number) {
    return `LKR ${amount.toLocaleString()}`;
  }

  function getUrgencyBadge(level: number) {
    if (level === 5) {
      return (
        <span className={`${styles.urgencyPill} ${styles.urgency5}`}>
          ● Critical ({level})
        </span>
      );
    }
    if (level === 4) {
      return (
        <span className={`${styles.urgencyPill} ${styles.urgency4}`}>
          ▲ High ({level})
        </span>
      );
    }
    return (
      <span className={`${styles.urgencyPill} ${styles.urgencyNormal}`}>
        Standard ({level})
      </span>
    );
  }

  function getStatusBadge(status: string) {
    switch (status) {
      case 'verified':
      case 'dispatched':
        return <span className="statusBadge statusSuccess">{status}</span>;
      case 'critical':
        return <span className="statusBadge statusCritical">{status}</span>;
      case 'pending':
      case 'ai_processing':
        return <span className="statusBadge statusWarning">{status}</span>;
      default:
        return <span className="statusBadge statusInfo">{status}</span>;
    }
  }

  return (
    <div className="page">
      <div className={styles.sectionHeader}>
        <div>
          <h1>Disaster Operations Deck</h1>
          <p className={styles.sectionMeta}>
            National Disaster Management Center · Sri Lanka Multi-Agency Command
          </p>
        </div>
      </div>

      <div className={styles.statsRow}>
        <div className={styles.statBox}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Active Requests</span>
            <div className={styles.statIcon}>🆘</div>
          </div>
          <div className={styles.statNumber}>{stats?.active_requests ?? '—'}</div>
        </div>

        <div className={`${styles.statBox} ${styles.statBoxCritical}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Critical Triage</span>
            <div className={styles.statIcon}>🚨</div>
          </div>
          <div className={styles.statNumber}>{stats?.critical_count ?? '—'}</div>
        </div>

        <div className={`${styles.statBox} ${styles.statBoxWarning}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Active Alerts</span>
            <div className={styles.statIcon}>📢</div>
          </div>
          <div className={styles.statNumber}>{stats?.active_alerts ?? '—'}</div>
        </div>

        <div className={`${styles.statBox} ${styles.statBoxSuccess}`}>
          <div className={styles.statTop}>
            <span className={styles.statLabel}>Relief Donations</span>
            <div className={styles.statIcon}>🤝</div>
          </div>
          <div className={styles.statNumber}>
            {stats ? formatCurrency(stats.total_donations) : '—'}
          </div>
        </div>
      </div>

      <div className="section">
        <div className={styles.sectionHeader}>
          <h2>🤖 AI Situational Telemetry Report</h2>
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
              {reportLoading ? 'Analyzing...' : 'Generate New Intel'}
            </button>
          </div>
        </div>
        <div className={styles.reportBox}>
          {reportLoading ? (
            <p className={styles.loadingText}>Synthesizing multi-modal disaster reports with Gemini AI...</p>
          ) : report ? (
            <>
              <div className={styles.reportStats}>
                <span><strong>Total Incidents:</strong> {report.total_incidents}</span>
                <span><strong>High-Priority Zones:</strong> {report.critical_count} critical</span>
              </div>
              <div className={styles.reportText}>
                {report.narrative.split('\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
              {report.zones && report.zones.length > 0 && (
                <div className={styles.zonesList}>
                  {report.zones.map((zone, idx) => (
                    <span key={idx} className={styles.zoneChip}>📍 {zone}</span>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className={styles.loadingText}>
              Click &quot;Generate New Intel&quot; to synthesize pending incident reports across Sri Lanka districts.
            </p>
          )}
        </div>
      </div>

      <div className="section">
        <div className={styles.sectionHeader}>
          <h2>Live Citizen Triage Feed</h2>
        </div>
        <div className="tableWrap">
          <table>
            <thead>
              <tr>
                <th>ID</th>
                <th>Type</th>
                <th>Triage Urgency</th>
                <th>Citizen Message</th>
                <th>Timestamp</th>
                <th>Channel</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {requests && requests.length > 0 ? (
                requests.map((r) => (
                  <tr key={r.request_id}>
                    <td><code>{r.request_id.slice(0, 8)}</code></td>
                    <td><strong>{r.emergency_type}</strong></td>
                    <td>{getUrgencyBadge(r.urgency_level)}</td>
                    <td>{r.original_message.slice(0, 50)}{r.original_message.length > 50 ? '...' : ''}</td>
                    <td>{new Date(r.created_at).toLocaleTimeString()}</td>
                    <td><span className="statusBadge statusInfo">{r.source || 'Mobile App'}</span></td>
                    <td>{getStatusBadge(r.status)}</td>
                    <td>
                      <div className={styles.tableActions}>
                        <Link href={`/requests/${r.request_id}`} className={styles.actionLink}>
                          Inspect
                        </Link>
                        <button
                          className={styles.resolveBtn}
                          onClick={() => resolveRequest(r.request_id)}
                        >
                          Resolve
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: '30px', color: 'var(--text-muted)' }}>
                    No active emergency requests requiring immediate triage.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className={styles.chatSection}>
        <div className={styles.sectionHeader}>
          <h2>🛡️ Inter-Agency Field Communications</h2>
        </div>
        <div className={styles.chatBox}>
          <div className={styles.chatMessages}>
            {chatMessages.length === 0 ? (
              <p className={styles.loadingText} style={{ padding: '20px', textAlign: 'center' }}>
                Secure telemetry channel connected. Messages from Army, Police, and DMC will appear in real time.
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
              placeholder="Broadcast message to active rescue coordinators..."
              id="chat-input"
            />
            <button onClick={sendChat}>Transmit</button>
          </div>
        </div>
      </div>
    </div>
  );
}
