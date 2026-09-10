'use client';

import { useState, useEffect } from 'react';
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

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function UsersPage() {
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const params = new URLSearchParams();
  params.set('page', String(page));
  params.set('limit', '20');
  if (search) params.set('search', search);

  const { data, error, isLoading, mutate } = useSWR<any>(
    `/api/admin/users?${params.toString()}`,
    fetcher
  );

  // Requirement 1: Log the raw API response using console.log('Fetched users payload:', data)
  useEffect(() => {
    if (data !== undefined) {
      console.log('Fetched users payload:', data);
    }
  }, [data]);

  async function suspendUser(id: string) {
    if (!window.confirm('Suspend this account?')) return;
    try {
      await api.patch(`/api/admin/users/${id}`, { is_active: false });
      mutate();
    } catch (err: any) {
      console.error('Failed to suspend user:', err);
      alert(err.response?.data?.error || 'Failed to suspend user');
    }
  }

  async function resendOtp(id: string) {
    try {
      await api.post(`/api/admin/users/${id}/resend-otp`);
      alert('OTP resent successfully');
    } catch (err: any) {
      console.error('Failed to resend OTP:', err);
      alert(err.response?.data?.error || 'Failed to resend OTP');
    }
  }

  // Requirement 1: Extraction handling for nested or flat payloads (data.users, data.data, or direct array data)
  const rawUsers: any[] = Array.isArray(data)
    ? data
    : Array.isArray(data?.users)
    ? data.users
    : Array.isArray(data?.data)
    ? data.data
    : [];

  const usersList: User[] = rawUsers.map((u: any) => ({
    user_id: String(u.user_id || u.id || ''),
    full_name: u.full_name || u.name || 'Unnamed User',
    email: u.email || '—',
    phone_number: u.phone_number || u.phone || '—',
    user_type: u.user_type || u.type || u.role || 'Citizen',
    nic_number: u.nic_number || u.nic || '',
    is_verified: Boolean(u.is_verified ?? u.verified),
    created_at: u.created_at || u.joined || new Date().toISOString(),
  }));

  // Requirement 3: Ensure search input dynamically filters users across name, email, and phone
  const filteredUsers = usersList.filter((user) => {
    if (!search.trim()) return true;
    const query = search.toLowerCase().trim();
    return (
      (user.full_name && user.full_name.toLowerCase().includes(query)) ||
      (user.email && user.email.toLowerCase().includes(query)) ||
      (user.phone_number && user.phone_number.toLowerCase().includes(query))
    );
  });

  const totalPages = data?.pages ?? 1;

  return (
    <div className="page">
      <h1>User Management</h1>

      <div className={styles.searchRow}>
        <input
          type="text"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          placeholder="Search by name, email, or phone..."
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
          {/* Requirement 3: Loading state spinner */}
          {isLoading || (!data && !error) ? (
            <tr>
              <td colSpan={8} style={{ textAlign: 'center', padding: '2rem' }}>
                <div className={styles.loadingContainer}>
                  <div className={styles.spinner} id="users-loading-spinner" />
                  <span>Loading registered users...</span>
                </div>
              </td>
            </tr>
          ) : error ? (
            /* Requirement 3: Display exact error message if API error occurs */
            <tr>
              <td colSpan={8} className={styles.errorCell}>
                <strong>API Error:</strong>{' '}
                {error.response?.data?.error || error.message || 'Failed to fetch users'}
              </td>
            </tr>
          ) : filteredUsers.length > 0 ? (
            filteredUsers.map((user) => (
              <tr key={user.user_id}>
                <td>{user.user_id.slice(0, 8)}</td>
                <td>{user.full_name}</td>
                <td>{user.email}</td>
                <td>{user.phone_number}</td>
                <td>
                  {user.user_type === 'guest'
                    ? `Guest (NIC: ${user.nic_number || '—'})`
                    : user.user_type}
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
              <td colSpan={8} style={{ textAlign: 'center' }}>
                No users found
              </td>
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
