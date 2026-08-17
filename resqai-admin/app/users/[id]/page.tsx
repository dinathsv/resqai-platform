'use client';

import { use, useState } from 'react';
import { useRouter } from 'next/navigation';
import useSWR from 'swr';
import api from '@/lib/api';
import styles from './userDetail.module.css';

interface Request {
  request_id: string;
  emergency_type: string;
  urgency_level: number;
  status: string;
  created_at: string;
}

interface Donation {
  amount: number;
  mission_name: string;
  date: string;
  status: string;
}

interface UserDetail {
  user_id: string;
  full_name: string;
  email: string;
  phone_number: string;
  created_at: string;
  total_requests: number;
  donations_made: number;
  quiz_attempts: number;
  requests_history: Request[];
  donation_history: Donation[];
}

const fetcher = (url: string) => api.get(url).then((res) => res.data);

export default function UserDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const router = useRouter();
  const { id } = use(params);

  const { data: user, error } = useSWR<UserDetail>(
    `/api/admin/users/${id}`,
    fetcher
  );

  async function suspendUser() {
    if (!window.confirm('Suspend this account?')) return;
    try {
      await api.patch(`/api/admin/users/${id}`, { is_active: false });
      router.push('/users');
    } catch {
      alert('Failed to suspend user');
    }
  }

  if (error) return <div className="page">Failed to load user</div>;
  if (!user) return <div className="page">Loading...</div>;

  return (
    <div className="page">
      <h1>User Details</h1>

      <div className={styles.definitionList}>
        <div className={styles.label}>Name:</div>
        <div className={styles.value}>{user.full_name}</div>

        <div className={styles.label}>Email:</div>
        <div className={styles.value}>{user.email}</div>

        <div className={styles.label}>Phone:</div>
        <div className={styles.value}>{user.phone_number || '—'}</div>

        <div className={styles.label}>Joined:</div>
        <div className={styles.value}>{new Date(user.created_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}</div>

        <div className={styles.label}>Total Requests:</div>
        <div className={styles.value}>{user.total_requests}</div>

        <div className={styles.label}>Donations Made:</div>
        <div className={styles.value}>LKR {user.donations_made.toLocaleString()}</div>

        <div className={styles.label}>Quiz Attempts:</div>
        <div className={styles.value}>{user.quiz_attempts}</div>
      </div>

      <div className={styles.section}>
        <h2>Requests History</h2>
        <table>
          <thead>
            <tr>
              <th>ID</th>
              <th>Type</th>
              <th>Urgency</th>
              <th>Status</th>
              <th>Date</th>
            </tr>
          </thead>
          <tbody>
            {user.requests_history && user.requests_history.length > 0 ? (
              user.requests_history.map((req) => (
                <tr key={req.request_id}>
                  <td>{req.request_id.slice(0, 8)}</td>
                  <td>{req.emergency_type}</td>
                  <td>{req.urgency_level}</td>
                  <td>{req.status}</td>
                  <td>{new Date(req.created_at).toLocaleDateString()}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={5}>No requests history</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.section}>
        <h2>Donation History</h2>
        <table>
          <thead>
            <tr>
              <th>Amount</th>
              <th>Mission</th>
              <th>Date</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            {user.donation_history && user.donation_history.length > 0 ? (
              user.donation_history.map((don, idx) => (
                <tr key={idx}>
                  <td>LKR {don.amount.toLocaleString()}</td>
                  <td>{don.mission_name}</td>
                  <td>{new Date(don.date).toLocaleDateString()}</td>
                  <td>{don.status}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4}>No donation history</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className={styles.suspendContainer}>
        <button className="danger" onClick={suspendUser}>
          Suspend Account
        </button>
      </div>
    </div>
  );
}
