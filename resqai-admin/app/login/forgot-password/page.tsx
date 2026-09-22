'use client';

import Link from 'next/link';
import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import axios from 'axios';
import styles from '../login.module.css';

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:8000';

export default function AdminForgotPasswordPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);

    try {
      await axios.post(`${AUTH_API_URL}/api/auth/admin/forgot-password`, { email });
      setSuccess('OTP has been sent');
      setTimeout(() => {
        router.push(`/login/reset-password?email=${encodeURIComponent(email)}`);
      }, 1500);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || 'Failed to request reset');
      } else {
        setError('Network error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={styles.wrapper}>
      <form className={styles.form} onSubmit={handleSubmit}>
        <div className={styles.brandIcon}>🔐</div>
        <div className={styles.title}>Forgot Password</div>
        <div className={styles.subtitle} style={{ marginBottom: '20px' }}>
          Enter your admin email to receive an OTP.
        </div>

        {error && <div className={styles.error} style={{ marginBottom: '16px' }}>{error}</div>}
        {success && <div className={styles.error} style={{ marginBottom: '16px', backgroundColor: 'var(--success-light)', color: 'var(--success)', borderColor: 'var(--success)' }}>✓ {success}</div>}

        <div className={styles.field}>
          <label className={styles.label} htmlFor="login-email">Email Address</label>
          <input
            id="login-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            placeholder="admin@resqai.lk"
            disabled={loading}
          />
        </div>

        <button type="submit" className={styles.submitBtn} disabled={loading}>
          {loading ? 'Sending...' : 'Send OTP'}
        </button>

        <div style={{ textAlign: 'center', marginTop: '20px' }}>
          <Link href="/login" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
            Remember your password? <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Sign In</span>
          </Link>
        </div>
      </form>
    </div>
  );
}
