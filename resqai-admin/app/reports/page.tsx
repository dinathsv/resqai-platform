'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';

interface ReportResponse {
  narrative: string;
  statistics: Record<string, number>;
  generated_at: string;
}

export default function ReportsPage() {
  const [report, setReport] = useState<ReportResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);

  async function generateReport() {
    if (lock.current) return;
    lock.current = true;
    setLoading(true); setError('');
    try {
      const res = await api.get('/api/admin/dashboard/report');
      setReport(res.data);
    } catch (err: unknown) {
      const apiError = err as { response?: { data?: { error?: string } } };
      setError(apiError.response?.data?.error || 'Unable to generate the report.');
    } finally { lock.current = false; setLoading(false); }
  }

  return (
    <div className="page">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', marginBottom: '16px' }}>
        <h1>Situational Intel</h1>
        <button type="button" disabled={loading} onClick={generateReport}>{loading ? 'Generating...' : 'Generate Report'}</button>
      </div>
      {error && <p role="alert">{error}</p>}
      <div className="section">
        {loading ? <p>Generating a database-based operational summary...</p>
          : report ? (
            <>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                {Object.entries(report.statistics || {}).map(([key, value]) => (
                  <span key={key} className="statusBadge statusInfo"><strong>{key.replaceAll('_', ' ')}</strong>: {value}</span>
                ))}
              </div>
              <div>{report.narrative.split('\n').map((paragraph, index) => <p key={index}>{paragraph}</p>)}</div>
              <p style={{ marginTop: '12px', color: 'var(--text-muted)' }}>Generated: {new Date(report.generated_at).toLocaleString()}</p>
            </>
          ) : <p>Generate a report to aggregate current requests, missions, alerts, and participation data.</p>}
      </div>
    </div>
  );
}
