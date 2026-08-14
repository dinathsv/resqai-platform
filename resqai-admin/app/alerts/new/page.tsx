'use client';

import { useState, FormEvent } from 'react';
import api from '@/lib/api';
import styles from './newAlert.module.css';

const DISASTER_TYPES = ['Flood', 'Landslide', 'Fire', 'Earthquake', 'Accident', 'Other'];
const EXPIRES_OPTIONS = [
  { label: '1 Hour', value: 1 },
  { label: '6 Hours', value: 6 },
  { label: '24 Hours', value: 24 },
  { label: '48 Hours', value: 48 },
  { label: 'Manually Cancel', value: 0 },
];

export default function NewAlertPage() {
  const [form, setForm] = useState({
    disaster_type: '',
    severity: 1,
    zone_wkt: '',
    work_plan: '',
    expires_hours: 24,
  });
  const [loading, setLoading] = useState(false);
  const [responseText, setResponseText] = useState('');
  const [error, setError] = useState('');

  function update(field: string, value: string | number) {
    setForm((prev) => ({ ...prev, [field]: value }));
  }

  async function handleSubmit(e: FormEvent, isDraft: boolean = false) {
    e.preventDefault();
    setLoading(true);
    setError('');
    setResponseText('');

    try {
      const res = await api.post('/api/alerts', {
        ...form,
        is_draft: isDraft,
      });
      const data = res.data;
      setResponseText(
        `Alert issued. Delivered to ${data.app_count ?? 0} users via app, ${data.sms_count ?? 0} via SMS.`
      );
    } catch (err: unknown) {
      if (err && typeof err === 'object' && 'response' in err) {
        const axiosErr = err as { response?: { data?: { message?: string } } };
        setError(axiosErr.response?.data?.message || 'Failed to issue alert');
      } else {
        setError('Network error');
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="page">
      <h1>Issue Emergency Alert</h1>

      <form className={styles.form} onSubmit={(e) => handleSubmit(e, false)}>
        {/* Disaster Type */}
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

        {/* Severity Level */}
        <div className={styles.field}>
          <label className={styles.label}>Severity Level</label>
          <div className={styles.severityRow}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={form.severity === n ? styles.severityBtnActive : styles.severityBtn}
                onClick={() => update('severity', n)}
              >
                {n}
              </button>
            ))}
          </div>
          {form.severity >= 4 && (
            <div className={styles.criticalWarning}>
              Critical alert — admins will be notified via SMS
            </div>
          )}
        </div>

        {/* Affected Zone */}
        <div className={styles.field}>
          <label className={styles.label} htmlFor="alert-zone">Affected Zone</label>
          <textarea
            id="alert-zone"
            rows={3}
            value={form.zone_wkt}
            onChange={(e) => update('zone_wkt', e.target.value)}
            placeholder="Colombo, Gampaha or POLYGON((...))    "
            required
          />
          <div className={styles.helper}>
            Enter district names separated by commas for simple zones
          </div>
        </div>

        {/* Preliminary Work Plan */}
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

        {/* Expires After */}
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

        {/* Live Preview */}
        <div className={styles.preview}>
          <div className={styles.previewTitle}>Preview — Citizens will see this:</div>
          <div className={styles.previewContent}>
            <span className={styles.previewType}>
              {form.disaster_type || 'Disaster Type'}
            </span>
            {' | Severity: '}{form.severity}/5
            {form.work_plan && (
              <div className={styles.previewWorkPlan}>
                {form.work_plan.slice(0, 100)}{form.work_plan.length > 100 ? '...' : ''}
              </div>
            )}
          </div>
        </div>

        {/* Buttons */}
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
