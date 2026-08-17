'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';
import styles from './requests.module.css';

interface Request {
  request_id: string;
  emergency_type: string;
  urgency_level: number;
  original_message: string;
  created_at: string;
  source: string;
  status: string;
}

interface RequestsResponse {
  requests: Request[];
  total: number;
  page: number;
  pages: number;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function RequestsPage() {
  const [filterType, setFilterType] = useState('');
  const [filterUrgency, setFilterUrgency] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDate, setFilterDate] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  if (filterType) params.set('type', filterType);
  if (filterUrgency) params.set('urgency', filterUrgency);
  if (filterStatus) params.set('status', filterStatus);
  if (filterDate) params.set('date', filterDate);

  const { data, mutate } = useSWR<RequestsResponse>(
    `/api/requests?${params.toString()}`,
    fetcher
  );

  async function flagAsFake(id: string) {
    if (!window.confirm('Flag this request as fake?')) return;
    try {
      await api.patch(`/api/requests/${id}/status`, { status: 'flagged' });
      mutate();
    } catch 
  }

  function urgencyClass(level: number, status: string) {
    if (status === 'flagged') return styles.urgencyNormal;
    if (level === 5) return styles.urgency5;
    if (level === 4) return styles.urgency4;
    return styles.urgencyNormal;
  }

  const totalPages = data?.pages ?? 1;

  return (
    <div className="page">
      <h1>Requests Management</h1>

      <div className={styles.filterRow}>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All Types</option>
          <option value="Flood">Flood</option>
          <option value="Landslide">Landslide</option>
          <option value="Fire">Fire</option>
          <option value="Earthquake">Earthquake</option>
          <option value="Medical">Medical</option>
          <option value="Other">Other</option>
        </select>

        <select value={filterUrgency} onChange={(e) => { setFilterUrgency(e.target.value); setPage(1); }}>
          <option value="">All Urgencies</option>
          <option value="5">5 (Critical)</option>
          <option value="4">4 (High)</option>
          <option value="3">3 (Medium)</option>
          <option value="2">2 (Low)</option>
          <option value="1">1 (Lowest)</option>
        </select>

        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="verified">Verified</option>
          <option value="in_progress">In Progress</option>
          <option value="resolved">Resolved</option>
          <option value="flagged">Flagged</option>
        </select>

        <input
          type="date"
          value={filterDate}
          onChange={(e) => { setFilterDate(e.target.value); setPage(1); }}
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Type</th>
            <th>Urgency</th>
            <th>Message</th>
            <th>Submitted</th>
            <th>Source</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.requests && data.requests.length > 0 ? (
            data.requests.map((req) => (
              <tr key={req.request_id} className={req.status === 'flagged' ? styles.flaggedRow : undefined}>
                <td>{req.request_id.slice(0, 8)}</td>
                <td>{req.emergency_type}</td>
                <td className={urgencyClass(req.urgency_level, req.status)}>{req.urgency_level}</td>
                <td>{req.original_message.slice(0, 50)}{req.original_message.length > 50 ? '...' : ''}</td>
                <td>{new Date(req.created_at).toLocaleString()}</td>
                <td>{req.source || 'App'}</td>
                <td>{req.status}</td>
                <td>
                  <div className={styles.actions}>
                    <Link href={`/requests/${req.request_id}`} className={styles.viewLink}>
                      View
                    </Link>
                    {req.status !== 'flagged' && (
                      <button
                        className={`outline ${styles.flagBtn}`}
                        onClick={() => flagAsFake(req.request_id)}
                      >
                        Flag as Fake
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8}>No requests found</td>
            </tr>
          )}
        </tbody>
      </table>

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
