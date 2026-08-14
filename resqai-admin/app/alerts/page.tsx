'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';
import styles from './alerts.module.css';

interface Alert {
  alert_id: string;
  disaster_type: string;
  severity: number;
  status: string;
  created_at: string;
  expires_at: string;
}

interface AlertsResponse {
  alerts: Alert[];
  total: number;
  page: number;
  pages: number;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function AlertsPage() {
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  if (filterType) params.set('type', filterType);
  if (filterStatus) params.set('status', filterStatus);

  const { data, mutate } = useSWR<AlertsResponse>(
    `/api/alerts?${params.toString()}`,
    fetcher
  );

  async function cancelAlert(id: string) {
    if (!window.confirm('Cancel this alert?')) return;
    try {
      await api.patch(`/api/alerts/${id}`, { status: 'cancelled' });
      mutate();
    } catch {
      // silently fail
    }
  }

  const totalPages = data?.pages ?? 1;

  return (
    <div className="page">
      <h1>Emergency Alerts</h1>

      <Link href="/alerts/new">
        <button className={styles.newAlertBtn}>Issue New Alert</button>
      </Link>

      {/* Filter Row */}
      <div className={styles.filterRow}>
        <select
          value={filterType}
          onChange={(e) => { setFilterType(e.target.value); setPage(1); }}
          id="filter-type"
        >
          <option value="">All Types</option>
          <option value="Flood">Flood</option>
          <option value="Landslide">Landslide</option>
          <option value="Fire">Fire</option>
          <option value="Earthquake">Earthquake</option>
          <option value="Accident">Accident</option>
          <option value="Other">Other</option>
        </select>
        <select
          value={filterStatus}
          onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}
          id="filter-status"
        >
          <option value="">All Statuses</option>
          <option value="active">Active</option>
          <option value="expired">Expired</option>
          <option value="cancelled">Cancelled</option>
        </select>
      </div>

      {/* Table */}
      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Severity</th>
            <th>Status</th>
            <th>Issued</th>
            <th>Expires</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.alerts && data.alerts.length > 0 ? (
            data.alerts.map((alert) => (
              <tr key={alert.alert_id}>
                <td>{alert.alert_id.slice(0, 8)}</td>
                <td>{alert.disaster_type}</td>
                <td>{alert.severity}/5</td>
                <td>{alert.status}</td>
                <td>{new Date(alert.created_at).toLocaleString()}</td>
                <td>{new Date(alert.expires_at).toLocaleString()}</td>
                <td>
                  <div className={styles.actions}>
                    <Link href={`/alerts/${alert.alert_id}`} className={styles.statsLink}>
                      Stats
                    </Link>
                    {alert.status === 'active' && (
                      <button
                        className={styles.cancelBtn}
                        onClick={() => cancelAlert(alert.alert_id)}
                      >
                        Cancel
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={7}>No alerts found</td>
            </tr>
          )}
        </tbody>
      </table>

      {/* Pagination */}
      <div className={styles.pagination}>
        <button
          className="outline"
          disabled={page <= 1}
          onClick={() => setPage(page - 1)}
        >
          Previous
        </button>
        {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
          <span
            key={p}
            className={p === page ? styles.pageNumActive : styles.pageNum}
            onClick={() => setPage(p)}
            style={{ cursor: 'pointer' }}
          >
            {p}
          </span>
        ))}
        <button
          className="outline"
          disabled={page >= totalPages}
          onClick={() => setPage(page + 1)}
        >
          Next
        </button>
      </div>
    </div>
  );
}
