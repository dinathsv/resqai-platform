import React, { useState } from 'react';
import { View, Linking, ActivityIndicator } from 'react-native';
import * as Location from 'expo-location';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useRouter } from 'expo-router';
import { useTheme } from '../../context/ThemeContext';
import { useLanguage } from '../../context/LanguageContext';
import MinimalButton from '../../components/MinimalButton';
import { ReliefPage, ReliefCard, ReliefText, ReliefField, ReliefBadge, reliefStyles } from '../../components/ReliefUI';
import { createClientId, submitDurableRequest, getMyQueuedRequests } from '../../services/requestQueue';

export default function HelpScreen() {
  const { theme } = useTheme(); const { t } = useLanguage(); const router = useRouter();
  const [kind, setKind] = useState<'help_rescue' | 'donation'>('help_rescue');
  const [message, setMessage] = useState(''); const [locationLabel, setLocationLabel] = useState('');
  const [people, setPeople] = useState('1'); const [urgency, setUrgency] = useState(3);
  const [evidence, setEvidence] = useState(''); const [busy, setBusy] = useState(false);
  const [locating, setLocating] = useState(false); const [error, setError] = useState('');
  const [coords, setCoords] = useState<{lat: number; lng: number} | null>(null);
  const [locationNotice, setLocationNotice] = useState('');
  const [items, setItems] = useState([{ item_name: '', quantity: '1', unit: 'packs' }]);
  const [result, setResult] = useState<{state: string; id: string} | null>(null);
  const [clientId, setClientId] = useState(createClientId);

  async function locate() {
    setLocating(true); setLocationNotice('');
    try {
      const permission = await Location.requestForegroundPermissionsAsync();
      if (permission.status !== 'granted') throw new Error();
      const location = await Promise.race([
        Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.High }),
        new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 12000)),
      ]);
      setCoords({ lat: location.coords.latitude, lng: location.coords.longitude });
      setLocationNotice(t('relief.gpsCaptured'));
    } catch { setCoords(null); setLocationNotice(t('relief.gpsUnavailable')); }
    finally { setLocating(false); }
  }
  async function submit() {
    if (busy) return;
    setError('');
    if (message.trim().length < 5) { setError(t('relief.describeRequired')); return; }
    const affected = Number(people);
    if (!Number.isInteger(affected) || affected < 1 || affected > 100000) { setError(t('relief.peopleInvalid')); return; }
    const requested = kind === 'donation' ? items.map(i => ({ item_name: i.item_name.trim(), quantity: Number(i.quantity), unit: i.unit.trim() })) : [];
    if (requested.some(i => i.item_name.length < 2 || !i.unit || !Number.isInteger(i.quantity) || i.quantity <= 0 || i.quantity > 100000)) { setError(t('relief.itemsInvalid')); return; }
    if (kind === 'donation' && !await AsyncStorage.getItem('token')) { setError(t('relief.accountForGoods')); return; }
    setBusy(true);
    try {
      const state = await submitDurableRequest({
        client_request_id: clientId, message: message.trim(), request_type: kind,
        lat: coords?.lat ?? null, lng: coords?.lng ?? null,
        location_source: coords ? 'gps' : locationLabel.trim() ? 'manual' : 'unknown',
        location_label: locationLabel.trim(), affected_people: affected,
        urgency_level: urgency, requested_items: requested, evidence_note: evidence.trim(),
      });
      setResult({ state, id: clientId });
      if (state === 'failed') {
        const pending = (await getMyQueuedRequests()).find(r => r.id === clientId);
        setError(pending?.error || t('relief.retryRequired'));
      }
      // A retry keeps this identifier while any saved submission is unresolved.
      if (state === 'sent') setClientId(createClientId());
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { setBusy(false); }
  }
  return <ReliefPage title={t('relief.requestTitle')} subtitle={t('relief.requestIntro')}>
    <ReliefCard>
      <ReliefText title>{t('relief.urgentTitle')}</ReliefText>
      <ReliefText muted>{t('relief.dialerNote')}</ReliefText>
      <View style={reliefStyles.row}>
        <MinimalButton title="1990" variant="cta" onPress={() => { void Linking.openURL('tel:1990').catch(() => setError(t('relief.dialerUnavailable'))); }} />
        <MinimalButton title={t('relief.firstAid')} variant="outline" onPress={() => router.push('/(people)/chatbot')} />
      </View>
    </ReliefCard>
    {result ? <ReliefCard>
      <ReliefBadge status={result.state} />
      <ReliefText title>{result.state === 'sent' ? t('relief.requestReceived') : t('relief.savedOnDevice')}</ReliefText>
      <ReliefText>{result.state === 'sent' ? t('relief.receivedNote') : t('relief.queuedNote')}</ReliefText>
      <ReliefText muted>{t('relief.reference')}: {result.id.slice(0, 8)}</ReliefText>
      <MinimalButton title={t('relief.trackRequests')} onPress={() => router.push('/(people)/activities')} />
      {result.state === 'sent' ? <MinimalButton title={t('relief.newRequest')} variant="outline" onPress={() => { setResult(null); setMessage(''); setEvidence(''); }} /> : null}
    </ReliefCard> : null}
    {(!result || result.state === 'failed') && <ReliefCard>
      <ReliefText title>{t('relief.whatNeeded')}</ReliefText>
      <View style={reliefStyles.row}>
        <MinimalButton title={t('relief.helpRescue')} variant={kind === 'help_rescue' ? 'primary' : 'outline'} onPress={() => setKind('help_rescue')} disabled={busy} />
        <MinimalButton title={t('relief.goodsRequest')} variant={kind === 'donation' ? 'primary' : 'outline'} onPress={() => setKind('donation')} disabled={busy} />
      </View>
      <ReliefField label={t('relief.situation')} value={message} onChangeText={setMessage} multiline maxLength={4000} editable={!busy} />
      <ReliefField label={t('relief.affectedPeople')} value={people} onChangeText={setPeople} keyboardType="number-pad" maxLength={7} editable={!busy} />
      <ReliefText>{t('relief.urgency')}</ReliefText>
      <View style={reliefStyles.row}>{[1, 2, 3, 4, 5].map(level => <MinimalButton key={level} title={String(level)} small variant={urgency === level ? 'primary' : 'outline'} onPress={() => setUrgency(level)} disabled={busy} />)}</View>
      <ReliefField label={t('relief.locationLabel')} value={locationLabel} onChangeText={setLocationLabel} placeholder={t('relief.locationPlaceholder')} maxLength={255} editable={!busy} />
      <MinimalButton title={locating ? t('common.loading') : coords ? t('relief.updateGps') : t('relief.useGps')} variant="outline" onPress={() => { void locate(); }} disabled={locating || busy} />
      {coords ? <ReliefText muted>{coords.lat.toFixed(5)}, {coords.lng.toFixed(5)}</ReliefText> : null}
      {locationNotice ? <ReliefText muted>{locationNotice}</ReliefText> : null}
      {kind === 'donation' && <>
        <ReliefText title>{t('relief.requestedGoods')}</ReliefText>
        <ReliefText muted>{t('relief.goodsReviewNote')}</ReliefText>
        {items.map((item, index) => <View key={index} style={{ gap: 10, paddingVertical: 8 }}>
          <ReliefField label={`${t('relief.item')} ${index + 1}`} value={item.item_name} onChangeText={value => setItems(old => old.map((r, i) => i === index ? { ...r, item_name: value } : r))} placeholder={t('relief.itemPlaceholder')} maxLength={120} />
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <View style={{ flex: 1 }}><ReliefField label={t('relief.quantity')} value={item.quantity} keyboardType="number-pad" onChangeText={value => setItems(old => old.map((r, i) => i === index ? { ...r, quantity: value } : r))} /></View>
            <View style={{ flex: 1 }}><ReliefField label={t('relief.unit')} value={item.unit} onChangeText={value => setItems(old => old.map((r, i) => i === index ? { ...r, unit: value } : r))} maxLength={30} /></View>
          </View>
          {items.length > 1 && <MinimalButton title={t('relief.remove')} small variant="outline" onPress={() => setItems(old => old.filter((_, i) => i !== index))} />}
        </View>)}
        {items.length < 20 && <MinimalButton title={t('relief.addItem')} variant="outline" onPress={() => setItems(old => [...old, { item_name: '', quantity: '1', unit: 'packs' }])} />}
      </>}
      <ReliefField label={t('relief.evidenceNote')} value={evidence} onChangeText={setEvidence} multiline maxLength={2000} editable={!busy} />
      <ReliefText muted>{t('relief.noDocuments')}</ReliefText>
      {busy && <ActivityIndicator color={theme.brandActive} />}
      <MinimalButton title={busy ? t('relief.sending') : t('relief.sendRequest')} onPress={() => { void submit(); }} disabled={busy || locating} />
    </ReliefCard>}
    {error ? <ReliefCard><ReliefText>{error}</ReliefText><MinimalButton title={t('relief.trackRequests')} variant="outline" onPress={() => router.push('/(people)/activities')} /></ReliefCard> : null}
  </ReliefPage>;
}
