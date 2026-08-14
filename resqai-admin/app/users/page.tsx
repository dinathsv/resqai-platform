'use client';

import { useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';
import styles from './users.module.css';

interface User {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  user_type: string;
  nic_number?: string;
  is_verified: boolean;
  created_at: string;
}

interface UsersResponse {
  users: User[];
  total: number;
  page: number;
  pages: number;
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  if (search) params.set('search', search);

  const { data, mutate } = useSWR<UsersResponse>(
    `/api/admin/users?${params.toString()}`,
    fetcher
  );

  async function suspendUser(id: string) {
    if (!window.confirm('Suspend this account?')) return;
    try {
      await api.patch(`/api/admin/users/${id}`, { is_active: false });
      mutate();
    } catch {
      // silently fail
    }
  }

  async function resendOtp(id: string) {
    try {
      await api.post(`/api/admin/users/${id}/resend-otp`);
    } catch {
      // silently fail
    }
  }

  const totalPages = data?.pages ?? 1;

  return (
    <div className="page">
      <h1>User Management</h1>

      <div className={styles.searchRow}>
        <input
          type="text"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name or email..."
          id="user-search"
        />
      </div>

      <table>
        <thead>
          <tr>
            <th>ID</th>
            <th>Name</th>
            <th>Email</th>
            <th>Phone</th>
            <th>Type</th>
            <th>Verified</th>
            <th>Joined</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          {data?.users && data.users.length > 0 ? (
            data.users.map((user) => (
              <tr key={user.user_id}>
                <td>{user.user_id.slice(0, 8)}</td>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{user.phone_number}</td>
                <td>
                  {user.user_type === 'guest'
                    ? `Guest (NIC: ${user.nic_number || '—'})`
                    : 'People'}
                </td>
                <td>
                  {user.is_verified ? (
                    'Yes'
                  ) : (
                    <button
                      className={`outline ${styles.resendBtn}`}
                      onClick={() => resendOtp(user.user_id)}
                    >
                      Resend OTP
                    </button>
                  )}
                </td>
                <td>{new Date(user.created_at).toLocaleDateString()}</td>
                <td>
                  <div className={styles.actions}>
                    <Link href={`/users/${user.user_id}`} className={styles.viewLink}>
                      View
                    </Link>
                    <button
                      className={`danger ${styles.suspendBtn}`}
                      onClick={() => suspendUser(user.user_id)}
                    >
                      Suspend
                    </button>
                  </div>
                </td>
              </tr>
            ))
          ) : (
            <tr>
              <td colSpan={8}>No users found</td>
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
