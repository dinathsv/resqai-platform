'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
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
    return () => {
      socket.off('new_message');
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

  return (
    <div className="page">
      <h1>Dashboard</h1>

      <div className={styles.statsRow}>
        <div className={styles.statBox}>
          <div className={styles.statNumber}>{stats?.active_requests ?? '—'}</div>
          <div className={styles.statLabel}>Active Requests</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statNumber}>{stats?.critical_count ?? '—'}</div>
          <div className={styles.statLabel}>Critical</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statNumber}>{stats?.active_alerts ?? '—'}</div>
          <div className={styles.statLabel}>Active Alerts</div>
        </div>
        <div className={styles.statBox}>
          <div className={styles.statNumber}>
            {stats ? formatCurrency(stats.total_donations) : '—'}
          </div>
          <div className={styles.statLabel}>Donations</div>
        </div>
      </div>

      <div className="section">
        <div className={styles.sectionHeader}>
          <h2>AI Situation Report</h2>
          <div>
            {reportTime && (
              <span className={styles.sectionMeta}>Last updated: {reportTime}</span>
            )}
            <button
              className={styles.refreshBtn}
              onClick={generateReport}
              disabled={reportLoading}
            >
              Refresh
            </button>
          </div>
        </div>
        <div className={styles.reportBox}>
          {reportLoading ? (
            <p className={styles.loadingText}>Generating report...</p>
          ) : report ? (
            <>
              <div className={styles.reportStats}>
                <span><strong>Total Incidents:</strong> {report.total_incidents}</span>
                <span><strong>Critical:</strong> {report.critical_count}</span>
              </div>
              <div className={styles.reportText}>
                {report.narrative.split('\n').map((p, i) => (
                  <p key={i}>{p}</p>
                ))}
              </div>
            </>
          ) : (
            <p className={styles.loadingText}>
              Click &quot;Refresh&quot; to generate an AI situation report.
            </p>
          )}
        </div>
      </div>

      <div className="section">
        <h2>Active Requests</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Urgency</th>
              <th>Message</th>
              <th>Time</th>
              <th>Source</th>
              <th>Status</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            {requests && requests.length > 0 ? (
              requests.map((r) => (
                <tr key={r.request_id}>
                  <td>{r.request_id.slice(0, 8)}</td>
                  <td>{r.emergency_type}</td>
                  <td className={urgencyClass(r.urgency_level)}>{r.urgency_level}</td>
                  <td>{r.original_message.slice(0, 50)}{r.original_message.length > 50 ? '...' : ''}</td>
                  <td>{new Date(r.created_at).toLocaleTimeString()}</td>
                  <td>{r.source || 'App'}</td>
                  <td>{r.status}</td>
                  <td>
                    <div className={styles.tableActions}>
                      <Link href={`/requests/${r.request_id}`} className={styles.actionLink}>
                        View
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
                <td colSpan={8}>No active requests</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.chatSection}>
        <h2>Inter-Agency Chat</h2>
        <div className={styles.chatBox}>
          <div className={styles.chatMessages}>
            {chatMessages.map((msg, i) => (
              <div key={msg.id || i} className={styles.chatMessage}>
                <strong>[{msg.agency}] {msg.sender}:</strong>
                {msg.message_text}
                <span className={styles.chatTime}>
                  [{new Date(msg.created_at).toLocaleTimeString()}]
                </span>
              </div>
            ))}
            <div ref={chatEndRef} />
          </div>
          <div className={styles.chatInputRow}>
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendChat()}
              placeholder="Type a message..."
              id="chat-input"
            />
            <button onClick={sendChat}>Send</button>
          </div>
        </div>
      </div>
    </div>
  );
}
