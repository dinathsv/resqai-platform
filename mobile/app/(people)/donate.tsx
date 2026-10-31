import React, { useCallback, useRef, useState } from 'react';
import { View, Modal, ScrollView, ActivityIndicator } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiFetch, parseErrorResponse } from '../../config/api';
import { createClientId } from '../../services/requestQueue';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import MinimalButton from '../../components/MinimalButton';
import { ReliefPage, ReliefCard, ReliefText, ReliefField, ReliefBadge, reliefStyles } from '../../components/ReliefUI';

interface Need { need_id: string; item_name: string; unit: string; required_quantity: number; pledged_quantity: number; received_quantity: number; dispatched_quantity: number; delivered_quantity: number; remaining_quantity: number }
interface Mission { mission_id: string; title: string; description: string; district: string; needs: Need[] }
interface Pledge { donation_id: string; mission_title: string; item_name: string; unit: string; quantity: number; received_quantity: number; dispatched_quantity: number; delivered_quantity: number; status: string }
interface Delivery { delivery_id: string; mission_title: string; item_name: string; unit: string; quantity: number; status: string; dispatch_note?: string; dispute_reason?: string; review_reason?: string }

export default function DonateScreen() {
  const { theme } = useTheme(); const { t } = useLanguage();
  const [tab, setTab] = useState<'needs' | 'pledges' | 'deliveries'>('needs');
  const [missions, setMissions] = useState<Mission[]>([]); const [pledges, setPledges] = useState<Pledge[]>([]); const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading] = useState(false); const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [selected, setSelected] = useState<{need: Need; mission: Mission} | null>(null);
  const [quantity, setQuantity] = useState('1'); const [condition, setCondition] = useState<'new' | 'good'>('new'); const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false); const pledgeId = useRef(createClientId()); const actionLock = useRef(false);
  const [review, setReview] = useState<{delivery: Delivery; action: 'confirm' | 'dispute'} | null>(null); const [reason, setReason] = useState('');
  const [modalError, setModalError] = useState(''); const [accountError, setAccountError] = useState('');

  const load = useCallback(async () => {
    setLoading(true); setError(''); setAccountError('');
    try {
      const results = await Promise.allSettled([apiFetch('/api/missions?status=active'), apiFetch('/api/donations'), apiFetch('/api/donations/deliveries')]);
      for (let i = 0; i < results.length; i++) {
        const entry = results[i];
        if (entry.status !== 'fulfilled') { if (i === 0) setError(t('relief.loadFailed')); continue; }
        const response = entry.value;
        if (!response.ok) {
          const message = await parseErrorResponse(response);
          if (i === 0) setError(message); else setAccountError(message);
          if (i === 1) setPledges([]); if (i === 2) setDeliveries([]);
          continue;
        }
        const rows = await response.json();
        if (!Array.isArray(rows)) continue;
        if (i === 0) setMissions(rows.filter((m: Mission) => m.needs?.length));
        if (i === 1) setPledges(rows); if (i === 2) setDeliveries(rows);
      }
    } catch { setError(t('relief.loadFailed')); } finally { setLoading(false); }
  }, [t]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  function select(mission: Mission, need: Need) {
    setSelected({ mission, need }); setQuantity('1'); setCondition('new'); setNote(''); setModalError(''); pledgeId.current = createClientId();
  }
  async function pledge() {
    if (!selected || actionLock.current) return;
    const value = Number(quantity);
    if (!Number.isFinite(value) || value <= 0 || value > selected.need.remaining_quantity || value > 1000000 || Math.abs(value * 100 - Math.round(value * 100)) > 0.000001) { setModalError(t('relief.pledgeQuantityInvalid')); return; }
    actionLock.current = true; setBusy(true); setModalError('');
    try {
      const response = await apiFetch('/api/donations', { method: 'POST', body: JSON.stringify({ need_id: selected.need.need_id, quantity: value, condition, availability_note: note.trim(), client_pledge_id: pledgeId.current }) });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      setSelected(null); setNotice(t('relief.pledgeRecorded')); setTab('pledges'); await load();
    } catch (e) { setModalError(e instanceof Error ? e.message : t('common.error')); }
    finally { actionLock.current = false; setBusy(false); }
  }
  async function updateDelivery() {
    if (!review || actionLock.current) return;
    if (review.action === 'dispute' && reason.trim().length < 5) { setModalError(t('relief.reasonRequired')); return; }
    actionLock.current = true; setBusy(true); setModalError('');
    try {
      const response = await apiFetch(`/api/donations/deliveries/${review.delivery.delivery_id}/${review.action}`, { method: 'PATCH', body: JSON.stringify(review.action === 'dispute' ? { reason: reason.trim() } : {}) });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      setReview(null); setNotice(t('relief.deliveryUpdated')); await load();
    } catch (e) { setModalError(e instanceof Error ? e.message : t('common.error')); }
    finally { actionLock.current = false; setBusy(false); }
  }
  const progress = (delivered: number, total: number) => <View style={{ height: 7, backgroundColor: theme.borderSubtle, borderRadius: 10, overflow: 'hidden' }}><View style={{ height: 7, width: `${total ? Math.min(100, delivered / total * 100) : 0}%`, backgroundColor: theme.brandActive }} /></View>;

  return <ReliefPage title={t('relief.goodsTitle')} subtitle={t('relief.goodsIntro')} refreshing={loading} onRefresh={() => { void load(); }}>
    <View style={reliefStyles.row}>{(['needs', 'pledges', 'deliveries'] as const).map(key => <MinimalButton key={key} title={t(`relief.${key}`)} small variant={tab === key ? 'primary' : 'outline'} onPress={() => setTab(key)} />)}</View>
    {notice ? <ReliefCard><ReliefText>{notice}</ReliefText></ReliefCard> : null}
    {error || (tab !== 'needs' && accountError) ? <ReliefCard><ReliefText>{error || accountError}</ReliefText><MinimalButton title={t('relief.refresh')} variant="outline" onPress={() => { void load(); }} /></ReliefCard> : null}
    {loading && <ActivityIndicator color={theme.brandActive} />}
    {tab === 'needs' && <>
      {!loading && !missions.length && <ReliefCard><ReliefText>{t('relief.noVerifiedNeeds')}</ReliefText></ReliefCard>}
      {missions.map(mission => <ReliefCard key={mission.mission_id}>
        <ReliefBadge status="verified" /><ReliefText title>{mission.title}</ReliefText>
        <ReliefText muted>{mission.district || t('relief.locationUnknown')}</ReliefText>
        {mission.description ? <ReliefText>{mission.description}</ReliefText> : null}
        {mission.needs.map(need => <View key={need.need_id} style={{ gap: 9, borderTopWidth: 1, borderColor: theme.borderSubtle, paddingTop: 15 }}>
          <ReliefText title>{need.item_name}</ReliefText>
          <ReliefText>{need.remaining_quantity} {need.unit} {t('relief.stillNeeded')}</ReliefText>
          {progress(need.delivered_quantity, need.required_quantity)}
          <ReliefText muted>{need.delivered_quantity} / {need.required_quantity} {need.unit} {t('relief.delivered')} · {need.pledged_quantity} {t('relief.pledged')}</ReliefText>
          <MinimalButton title={need.remaining_quantity > 0 ? t('relief.offerGoods') : t('relief.fullyPledged')} disabled={need.remaining_quantity <= 0} onPress={() => select(mission, need)} />
        </View>)}
      </ReliefCard>)}
    </>}
    {tab === 'pledges' && <>
      {!loading && !pledges.length && !accountError && <ReliefCard><ReliefText>{t('relief.noPledges')}</ReliefText></ReliefCard>}
      {pledges.map(p => <ReliefCard key={p.donation_id}><ReliefBadge status={p.status} /><ReliefText title>{p.quantity} {p.unit} · {p.item_name}</ReliefText><ReliefText muted>{p.mission_title}</ReliefText>{progress(p.delivered_quantity, p.quantity)}<ReliefText>{t('relief.received')}: {p.received_quantity} · {t('relief.dispatched')}: {p.dispatched_quantity} · {t('relief.delivered')}: {p.delivered_quantity}</ReliefText><ReliefText muted>{t('relief.pledgeNotDelivery')}</ReliefText></ReliefCard>)}
    </>}
    {tab === 'deliveries' && <>
      <ReliefText muted>{t('relief.recipientIntro')}</ReliefText>
      {!loading && !deliveries.length && !accountError && <ReliefCard><ReliefText>{t('relief.noDeliveries')}</ReliefText></ReliefCard>}
      {deliveries.map(delivery => <ReliefCard key={delivery.delivery_id}><ReliefBadge status={delivery.status} /><ReliefText title>{delivery.quantity} {delivery.unit} · {delivery.item_name}</ReliefText><ReliefText muted>{delivery.mission_title}</ReliefText>{delivery.dispatch_note ? <ReliefText>{delivery.dispatch_note}</ReliefText> : null}{delivery.dispute_reason ? <ReliefText>{delivery.dispute_reason}</ReliefText> : null}{delivery.review_reason ? <ReliefText>{delivery.review_reason}</ReliefText> : null}
        {delivery.status === 'dispatched' && <><MinimalButton title={t('relief.confirmReceived')} onPress={() => { setReview({ delivery, action: 'confirm' }); setModalError(''); }} /><MinimalButton title={t('relief.reportProblem')} variant="outline" onPress={() => { setReview({ delivery, action: 'dispute' }); setReason(''); setModalError(''); }} /></>}
      </ReliefCard>)}
    </>}
    <Modal visible={!!selected || !!review} transparent animationType="slide" onRequestClose={() => { if (!busy) { setSelected(null); setReview(null); } }}>
      <View style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' }}><View style={{ backgroundColor: theme.background, borderTopLeftRadius: 24, borderTopRightRadius: 24, maxHeight: '90%', width: '100%', maxWidth: 720, alignSelf: 'center' }}><ScrollView keyboardShouldPersistTaps="handled" contentContainerStyle={{ padding: 24, paddingBottom: 40, gap: 18 }}>
        {selected ? <><ReliefText title>{t('relief.offerGoods')} · {selected.need.item_name}</ReliefText><ReliefText muted>{selected.mission.title}</ReliefText><ReliefField label={`${t('relief.quantity')} (${selected.need.unit})`} value={quantity} onChangeText={setQuantity} keyboardType="decimal-pad" editable={!busy} /><View style={reliefStyles.row}>{(['new', 'good'] as const).map(value => <MinimalButton key={value} title={t(`relief.${value}`)} variant={condition === value ? 'primary' : 'outline'} onPress={() => setCondition(value)} disabled={busy} />)}</View><ReliefField label={t('relief.availability')} value={note} onChangeText={setNote} multiline maxLength={1000} editable={!busy} /><ReliefText muted>{t('relief.pledgeNote')}</ReliefText><MinimalButton title={busy ? t('relief.sending') : t('relief.confirmPledge')} onPress={() => { void pledge(); }} disabled={busy} /></> : review ? <><ReliefText title>{t(review.action === 'confirm' ? 'relief.confirmReceived' : 'relief.reportProblem')}</ReliefText><ReliefText>{review.delivery.quantity} {review.delivery.unit} · {review.delivery.item_name}</ReliefText><ReliefText>{t(review.action === 'confirm' ? 'relief.confirmDeliveryNote' : 'relief.disputeNote')}</ReliefText>{review.action === 'dispute' && <ReliefField label={t('relief.reason')} value={reason} onChangeText={setReason} multiline maxLength={1000} editable={!busy} />}<MinimalButton title={busy ? t('relief.sending') : t('relief.confirm')} onPress={() => { void updateDelivery(); }} disabled={busy} /></> : null}
        {modalError ? <ReliefText>{modalError}</ReliefText> : null}
        <MinimalButton title={t('common.cancel')} variant="outline" disabled={busy} onPress={() => { setSelected(null); setReview(null); }} />
      </ScrollView></View></View>
    </Modal>
  </ReliefPage>;
}
