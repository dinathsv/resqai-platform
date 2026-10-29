'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';
import styles from './requests.module.css';

interface RequestItem {
  request_id: string;
  emergency_type: string;
  request_type: 'help' | 'donation';
  original_message: string;
  created_at: string;
  submitted_by: string;
  source: string;
  admin_status: 'pending' | 'in_progress' | 'finished';
  status: string;
}

interface RequestsResponse {
  requests: RequestItem[];
  total: number;
  page: number;
  pages: number;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);

function statusLabel(status: string) {
  if (status === 'finished') return 'Finished';
  if (status === 'in_progress') return 'In Progress';
  return 'Pending';
}

export default function RequestsPage() {
  const [filterType, setFilterType] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  if (filterType) params.set('type', filterType);
  if (filterStatus) params.set('status', filterStatus);
  if (search.trim()) params.set('search', search.trim());

  const { data, error, isLoading, mutate } = useSWR<RequestsResponse>(
    `/api/requests?${params.toString()}`,
    fetcher,
    { refreshInterval: 5000 },
  );

  const totalPages = data?.pages ?? 1;

  return (
    <div className="page">
      <h1>Requests Management</h1>

      <div className={styles.filterRow}>
        <select value={filterType} onChange={(e) => { setFilterType(e.target.value); setPage(1); }}>
          <option value="">All Request Types</option>
          <option value="help">Help Request</option>
          <option value="donation">Donation Request</option>
        </select>

        <select value={filterStatus} onChange={(e) => { setFilterStatus(e.target.value); setPage(1); }}>
          <option value="">All Statuses</option>
          <option value="pending">Pending</option>
          <option value="in_progress">In Progress</option>
          <option value="finished">Finished</option>
        </select>

        <input
          type="search"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search message or requester"
        />

        <button type="button" className="outline" onClick={() => mutate()}>Refresh</button>
      </div>

      {error && <p role="alert" className={styles.errorText}>Requests could not be loaded.</p>}

      <div className="tableWrap">
        <table>
          <thead>
            <tr>
              <th>Request ID</th>
              <th>Request Type</th>
              <th>Request Message / Description</th>
              <th>Submitted By</th>
              <th>Created Date and Time</th>
              <th>Status</th>
              <th>Details</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr><td colSpan={7}>Loading requests...</td></tr>
            ) : error ? (
              <tr><td colSpan={7}>Unable to load requests.</td></tr>
            ) : data?.requests?.length ? (
              data.requests.map((req) => (
                <tr key={req.request_id}>
                  <td><code>{req.request_id.slice(0, 8)}</code></td>
                  <td>{req.request_type === 'donation' ? 'Donation Request' : 'Help Request'}</td>
                  <td>{req.original_message || '—'}</td>
                  <td>{req.submitted_by || (req.source === 'guest' ? 'Guest' : 'User')}</td>
                  <td>{req.created_at ? new Date(req.created_at).toLocaleString() : '—'}</td>
                  <td>
                    <span className={`statusBadge ${req.admin_status === 'finished' ? 'statusSuccess' : req.admin_status === 'in_progress' ? 'statusWarning' : 'statusInfo'}`}>
                      {statusLabel(req.admin_status)}
                    </span>
                  </td>
                  <td>
                    <Link href={`/requests/${req.request_id}`} className={styles.viewLink}>View Details</Link>
                  </td>
                </tr>
              ))
            ) : (
              <tr><td colSpan={7}>No requests found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.pagination}>
        <button type="button" className="outline" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</button>
        <span>Page {page} of {totalPages}</span>
        <button type="button" className="outline" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</button>
      </div>
    </div>
  );
}
