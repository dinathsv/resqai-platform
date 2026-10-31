import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useFocusEffect, useRouter } from 'expo-router';
import { apiFetch, getToken, parseErrorResponse } from '../../config/api';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import MinimalButton from '../../components/MinimalButton';
import { ReliefPage, ReliefCard, ReliefText, ReliefField, ReliefBadge, reliefStyles } from '../../components/ReliefUI';
import { getMyQueuedRequests, getMyRequestReceipts, syncMyRequests, subscribeQueue, QueuedRequest } from '../../services/requestQueue';

interface RequestItem {
  request_id: string; client_request_id?: string; message: string; status: string;
  admin_status?: string; evidence_note?: string; verification_status?: string; review_notes?: string; verification_notes?: string;
  location_label?: string; location_source?: string; created_at: string;
  requested_items?: { item_name: string; quantity: number; unit: string }[];
  history?: { status?: string; new_status?: string; note?: string; reason?: string; changed_at?: string }[];
}
export default function ActivitiesScreen() {
  const { t } = useLanguage(); const { theme } = useTheme(); const router = useRouter();
  const [requests, setRequests] = useState<RequestItem[]>([]); const [queued, setQueued] = useState<QueuedRequest[]>([]);
  const [loading, setLoading] = useState(false); const [retrying, setRetrying] = useState(false); const [error, setError] = useState('');
  const [editing, setEditing] = useState<RequestItem | null>(null);
  const [infoMessage, setInfoMessage] = useState(''); const [infoNote, setInfoNote] = useState('');
  const [saving, setSaving] = useState(false); const [infoError, setInfoError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null); const [history, setHistory] = useState<Record<string, RequestItem>>({});
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      setQueued(await getMyQueuedRequests());
      const receipts = await getMyRequestReceipts();
      if (!await getToken()) { setRequests(receipts); return; }
      const response = await apiFetch('/api/requests/my');
      if (!response.ok) { setRequests(receipts); throw new Error(await parseErrorResponse(response)); }
      const data = await response.json(); const rows: RequestItem[] = Array.isArray(data) ? data : [];
      setRequests([...rows, ...receipts.filter((r: RequestItem) => !rows.some(item => item.request_id === r.request_id))]);
    } catch (e) { setError(e instanceof Error ? e.message : t('relief.loadFailed')); }
    finally { setLoading(false); }
  }, [t]);
  useFocusEffect(useCallback(() => {
    void load();
    return subscribeQueue(() => { void load(); });
  }, [load]));
  async function retry() {
    if (retrying) return; setRetrying(true); setError('');
    try { await syncMyRequests(true); await load(); }
    catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { setRetrying(false); }
  }
  // Detail reads are explicit and remain scoped to the owner's API permissions.
  async function openDetails(request: RequestItem) {
    if (expanded === request.request_id) { setExpanded(null); return; }
    setExpanded(request.request_id);
    if (!await getToken()) return;
    const response = await apiFetch(`/api/requests/${request.request_id}`);
    if (response.ok) { const data = await response.json(); setHistory(old => ({ ...old, [request.request_id]: data })); }
    else setError(await parseErrorResponse(response));
  }
  async function saveInformation() {
    if (!editing || saving) return;
    if (infoMessage.trim().length < 5) { setInfoError(t('relief.describeRequired')); return; }
    setSaving(true); setInfoError('');
    try {
      const response = await apiFetch(`/api/requests/${editing.request_id}/information`, {
        method: 'PATCH', body: JSON.stringify({ message: infoMessage.trim(), evidence_note: infoNote.trim() }),
      });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      setEditing(null); await load();
    } catch (e) { setInfoError(e instanceof Error ? e.message : t('common.error')); }
    finally { setSaving(false); }
  }
  return <ReliefPage title={t('relief.activityTitle')} subtitle={t('relief.activityIntro')} refreshing={loading} onRefresh={() => { void load(); }}>
    <View style={reliefStyles.row}><MinimalButton title={t('relief.newRequest')} onPress={() => router.push('/(people)/help')} /><MinimalButton title={t('relief.goodsTitle')} variant="outline" onPress={() => router.push('/(people)/donate')} /></View>
    {error ? <ReliefCard><ReliefText>{error}</ReliefText></ReliefCard> : null}
    {queued.length > 0 && <>
      <ReliefText title>{t('relief.savedOnDevice')} · {queued.length}</ReliefText>
      <ReliefText muted>{t('relief.queuedNote')}</ReliefText>
      {queued.map(row => <ReliefCard key={row.id}><ReliefBadge status={row.status} /><ReliefText title>{row.payload.message}</ReliefText><ReliefText muted>{row.payload.location_label || t('relief.locationUnknown')}</ReliefText>{row.error ? <ReliefText>{row.error}</ReliefText> : null}<ReliefText muted>{new Date(row.created_at).toLocaleString()}</ReliefText></ReliefCard>)}
      <MinimalButton title={retrying ? t('relief.sending') : t('relief.retrySaved')} onPress={() => { void retry(); }} disabled={retrying} />
    </>}
    <ReliefText title>{t('relief.submittedRequests')}</ReliefText>
    {loading && <ActivityIndicator color={theme.brandActive} />}
    {!loading && !requests.length && <ReliefCard><ReliefText>{t('relief.noRequests')}</ReliefText></ReliefCard>}
    {requests.map(request => {
      const detail = history[request.request_id] || request;
      return <ReliefCard key={request.request_id || request.client_request_id}>
        <View style={reliefStyles.row}><ReliefBadge status={request.verification_status || 'unverified'} /><ReliefBadge status={request.status || 'pending'} /></View>
        <ReliefText title>{request.message}</ReliefText>
        <ReliefText muted>{request.location_label || t('relief.locationUnknown')} · {new Date(request.created_at).toLocaleDateString()}</ReliefText>
        {(request.review_notes || request.verification_notes) ? <ReliefText>{request.review_notes || request.verification_notes}</ReliefText> : null}
        {request.verification_status === 'needs_information' && <ReliefText muted>{t('relief.moreInformation')}</ReliefText>}
        {request.requested_items?.map((item, i) => <ReliefText key={i}>{item.quantity} {item.unit} · {item.item_name}</ReliefText>)}
        {['unverified', 'needs_information'].includes(request.verification_status || '') && (!request.admin_status || request.admin_status === 'pending') && <MinimalButton title={t('relief.updateInformation')} onPress={() => { setEditing(request); setInfoMessage(request.message); setInfoNote(request.evidence_note || ''); setInfoError(''); }} />}
        <MinimalButton title={t('relief.requestHistory')} variant="outline" onPress={() => { void openDetails(request); }} />
        {expanded === request.request_id && <View style={{ gap: 10 }}><ReliefText muted>{t('relief.reference')}: {request.request_id}</ReliefText>{detail.history?.length ? detail.history.map((event, i) => <View key={i} style={{ borderLeftWidth: 2, borderColor: theme.brandActive, paddingLeft: 12 }}><ReliefText>{event.new_status || event.status}</ReliefText>{event.note || event.reason ? <ReliefText muted>{event.note || event.reason}</ReliefText> : null}{event.changed_at ? <ReliefText muted>{new Date(event.changed_at).toLocaleString()}</ReliefText> : null}</View>) : <ReliefText muted>{t('relief.noHistory')}</ReliefText>}</View>}
      </ReliefCard>;
    })}
    <Modal visible={!!editing} transparent animationType="slide" onRequestClose={() => { if (!saving) setEditing(null); }}>
      <View style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' }}><ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: '85%', backgroundColor: theme.background }} contentContainerStyle={{ padding: 24, gap: 18 }}>
        <ReliefText title>{t('relief.updateInformation')}</ReliefText>
        <ReliefText muted>{t('relief.resubmitNote')}</ReliefText>
        <ReliefField label={t('relief.situation')} value={infoMessage} onChangeText={setInfoMessage} multiline maxLength={5000} editable={!saving} />
        <ReliefField label={t('relief.evidenceNote')} value={infoNote} onChangeText={setInfoNote} multiline maxLength={2000} editable={!saving} />
        {infoError ? <ReliefText>{infoError}</ReliefText> : null}
        <MinimalButton title={saving ? t('relief.sending') : t('relief.resubmit')} onPress={() => { void saveInformation(); }} disabled={saving} />
        <MinimalButton title={t('common.cancel')} variant="outline" onPress={() => setEditing(null)} disabled={saving} />
      </ScrollView></View>
    </Modal>
  </ReliefPage>;
}
