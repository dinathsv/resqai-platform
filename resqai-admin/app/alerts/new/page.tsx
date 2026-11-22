'use client';

import { useState, useEffect, FormEvent } from 'react';
import api from '@/lib/api';
import styles from './newAlert.module.css';

const DISASTER_TYPES = ['Flood', 'Landslide', 'Fire', 'Earthquake', 'Accident', 'Other'];
const EXPIRES_OPTIONS = [
  { label: '1 Hour', value: 1 },
  { label: '6 Hours', value: 6 },
  { label: '24 Hours', value: 24 },
  { label: '48 Hours', value: 48 },
  { label: 'Manually Cancel (No expiry)', value: 0 },
];

export default function NewAlertPage() {
  const [form, setForm] = useState({
    disaster_type: '',
    severity: 3,
    zone_wkt: '',
    work_plan: '',
    expires_hours: 24,
  });
  const [loading, setLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      const saved = localStorage.getItem('resqai_alert_draft');
      if (saved) {
        const parsed = JSON.parse(saved);
        setForm((prev) => ({ ...prev, ...parsed }));
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  function update(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent, isDraft: boolean = false) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponseText('');

    if (isDraft) {
      try {
        localStorage.setItem('resqai_alert_draft', JSON.stringify(form));
        setResponseText('Draft saved locally in your browser. You can return and publish it anytime.');
      } catch {
        setError('Could not save draft to local storage');
      }
      setLoading(false);
      return;
    }

    const payload = {
      disaster_type: form.disaster_type,
      disasterType: form.disaster_type,
      zone_wkt: form.zone_wkt.trim(),
      affectedZone: form.zone_wkt.trim(),
      work_plan: form.work_plan.trim(),
      workPlan: form.work_plan.trim(),
      expires_hours: form.expires_hours,
      expiresIn: form.expires_hours,
      severity: Number(form.severity) || 3,
      is_draft: false,
    };

    try {
      const res = await api.post('/api/alerts', payload);
      const data = res.data;
      setResponseText(
        `Alert issued successfully! Delivered to ${data.app_count ?? 0} users via app, ${data.sms_count ?? 0} via SMS.`
      );
      try {
        localStorage.removeItem('resqai_alert_draft');
      } catch {
        // Ignore storage cleanup errors
      }
      setForm({
        disaster_type: '',
        severity: 3,
        zone_wkt: '',
        work_plan: '',
        expires_hours: 24,
      });
    } catch (err: unknown) {
      console.error('Issue Alert submission error:', err);
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { status?: number; data?: { error?: string; message?: string } } };
        console.error('API Response Status:', axiosErr.response?.status);
        console.error('API Response Data:', axiosErr.response?.data);
        const detail = axiosErr.response?.data?.error || axiosErr.response?.data?.message;
        setError(detail ? `Failed to issue alert: ${detail}` : 'Failed to issue alert (Server error)');
      } else {
        setError('Network error: Could not reach the server');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Issue Emergency Alert</h1>

      <form className={styles.form} onSubmit={(e) => handleSubmit(e, false)}>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="alert-type">Disaster Type</label>
          <select
            id="alert-type"
            value={form.disaster_type}
            onChange={(e) => update('disaster_type', e.target.value)}
            required
          >
            <option value="">Select type...</option>
            {DISASTER_TYPES.map((t) => (
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>

        <div className={styles.field}>
          <label className={styles.label}>Severity Level (1 = Low, 5 = Critical)</label>
          <div className={styles.severityRow}>
            {[1, 2, 3, 4, 5].map((lvl) => (
              <button
                key={lvl}
                type="button"
                className={form.severity === lvl ? styles.severityBtnActive : styles.severityBtn}
                onClick={() => update('severity', lvl)}
              >
                {lvl}
              </button>
            ))}
          </div>
          {form.severity >= 4 && (
            <div className={styles.criticalWarning}>
              High severity alert: Triggers immediate push broadcasts and SMS notifications.
            </div>
          )}
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="alert-zone">Affected Zone</label>
          <textarea
            id="alert-zone"
            rows={3}
            value={form.zone_wkt}
            onChange={(e) => update('zone_wkt', e.target.value)}
            placeholder="e.g. Colombo, Gampaha or POLYGON((...)) — leave blank for nationwide alert"
          />
          <div className={styles.helper}>
            Enter district names separated by commas (e.g. Colombo, Gampaha) or a WKT polygon. Leave blank for nationwide alert.
          </div>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="alert-workplan">Preliminary Work Plan</label>
          <textarea
            id="alert-workplan"
            rows={6}
            value={form.work_plan}
            onChange={(e) => update('work_plan', e.target.value)}
            placeholder={`1. Evacuate immediately to higher ground\n2. Avoid flooded roads\n3. Contact nearest shelter at...`}
            required
          />
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor="alert-expires">Expires After</label>
          <select
            id="alert-expires"
            value={form.expires_hours}
            onChange={(e) => update('expires_hours', Number(e.target.value))}
          >
            {EXPIRES_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>

        <div className={styles.preview}>
          <div className={styles.previewTitle}>Preview — Citizens will see this:</div>
          <div className={styles.previewContent}>
            <span className={styles.previewType}>
              {form.disaster_type || 'Disaster Type'} (Severity {form.severity}/5)
            </span>
            {form.zone_wkt && (
              <div style={{ fontSize: '12px', color: 'var(--text-muted)', marginTop: '4px' }}>
                Zone: {form.zone_wkt}
              </div>
            )}
            {form.work_plan && (
              <div className={styles.previewWorkPlan}>
                {form.work_plan.slice(0, 100)}{form.work_plan.length > 100 ? '...' : ''}
              </div>
            )}
          </div>
        </div>

        <div className={styles.buttonRow}>
          <button type="submit" disabled={loading}>
            {loading ? 'Issuing...' : 'Issue Alert'}
          </button>
          <button
            type="button"
            className="outline"
            disabled={loading}
            onClick={(e) => handleSubmit(e, true)}
          >
            Save Draft
          </button>
        </div>

        {error && <div className="error">{error}</div>}
        {responseText && <div className={styles.responseText}>{responseText}</div>}
      </form>
    </div>
  );
}
