'use client';

import Link from 'next/link';
import { useState, FormEvent, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import axios from 'axios';
import styles from '../../login.module.css';

const AUTH_API_URL = process.env.NEXT_PUBLIC_AUTH_API_URL || 'http://localhost:8000';

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get('email') || '';
  
  const [otp, setOtp] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

    if (otp.trim().length !== 6) {
      setError('Please enter a valid 6-digit OTP');
      return;
    }
    if (newPassword.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }

    setLoading(true);

    try {
      await axios.post(`${AUTH_API_URL}/api/auth/admin/reset-password`, { 
        email, 
        otp: otp.trim(), 
        new_password: newPassword 
      });
      
      setSuccess('Password reset successfully!');
      setTimeout(() => {
        router.replace('/login');
      }, 2000);
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { detail?: string } } };
        setError(axiosErr.response?.data?.detail || 'Invalid or expired OTP');
      } else {
        setError('Network error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <form className={styles.form} onSubmit={handleSubmit}>
      <div className={styles.brandIcon}>🛡️</div>
      <div className={styles.title}>Set New Password</div>
      <div className={styles.subtitle} style={{ marginBottom: '20px' }}>
        Enter the 6-digit OTP sent to {email || 'your email'} and your new password.
      </div>

      {error && <div className={styles.error} style={{ marginBottom: '16px' }}>{error}</div>}
      {success && <div className={styles.error} style={{ marginBottom: '16px', backgroundColor: 'var(--success-light)', color: 'var(--success)', borderColor: 'var(--success)' }}>✓ {success}</div>}

      <div className={styles.field}>
        <label className={styles.label} htmlFor="reset-otp">6-Digit OTP</label>
        <input
          id="reset-otp"
          type="text"
          value={otp}
          onChange={(e) => setOtp(e.target.value.replace(/[^0-9]/g, '').slice(0, 6))}
          required
          placeholder="000000"
          disabled={loading}
          maxLength={6}
          style={{ letterSpacing: '4px', fontSize: '18px', textAlign: 'center', fontWeight: 'bold' }}
        />
      </div>

      <div className={styles.field}>
        <label className={styles.label} htmlFor="reset-password">New Password</label>
        <div style={{ position: 'relative' }}>
          <input
            id="reset-password"
            type={showPassword ? 'text' : 'password'}
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            required
            placeholder="••••••••••••"
            disabled={loading}
            style={{ paddingRight: '40px', width: '100%', boxSizing: 'border-box' }}
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            style={{
              position: 'absolute',
              right: '10px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              cursor: 'pointer',
              fontSize: '16px',
              color: 'var(--text-muted)'
            }}
          >
            {showPassword ? '🙈' : '👁️'}
          </button>
        </div>
      </div>

      <button type="submit" className={styles.submitBtn} disabled={loading}>
        {loading ? 'Resetting...' : 'Reset Password'}
      </button>

      <div style={{ textAlign: 'center', marginTop: '20px' }}>
        <Link href="/login" style={{ fontSize: '13px', color: 'var(--text-muted)', textDecoration: 'none' }}>
          Cancel reset? <span style={{ color: 'var(--accent)', fontWeight: 'bold' }}>Go Back</span>
        </Link>
      </div>
    </form>
  );
}

export default function AdminResetPasswordPage() {
  return (
    <div className={styles.wrapper}>
      <Suspense fallback={<div className={styles.form}>Loading...</div>}>
        <ResetPasswordForm />
      </Suspense>
    </div>
  );
}
