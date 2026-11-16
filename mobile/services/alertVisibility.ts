export interface AlertVisibility {
  source?: string | null;
  disaster_type?: string | null;
  verification_status?: string | null;
}

export function isCommunityRequestAlert(alert: AlertVisibility): boolean {
  if (alert.source === 'admin_alert') return false;
  return alert.source === 'community_request' || alert.verification_status != null
    || ['help_rescue', 'donation'].includes((alert.disaster_type || '').toLowerCase());
}

/** Older caches without review metadata must never imply administrator approval. */
export function isVisibleCommunityAlert(alert: AlertVisibility): boolean {
  return !isCommunityRequestAlert(alert) || alert.verification_status === 'verified';
}

export function visibleAlerts<T extends AlertVisibility>(alerts: T[]): T[] {
  return alerts.filter(alert => !!alert && isVisibleCommunityAlert(alert));
}
