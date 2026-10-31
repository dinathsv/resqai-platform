import React, { useCallback, useState } from 'react';
import { View, ActivityIndicator, Modal, ScrollView } from 'react-native';
import { useFocusEffect } from 'expo-router';
import { apiFetch, parseErrorResponse } from '../../config/api';
import { useLanguage } from '../../context/LanguageContext';
import { useTheme } from '../../context/ThemeContext';
import MinimalButton from '../../components/MinimalButton';
import { ReliefPage, ReliefCard, ReliefText, ReliefField, ReliefBadge, reliefStyles } from '../../components/ReliefUI';

interface Mission { mission_id: string; title: string; description: string; district: string; mission_type?: string; volunteers_needed?: number }
interface Assignment { assignment_id: string; mission_title: string; status: string; completion_pending: boolean; completion_note?: string }
interface Confirmation { assignment_id: string; mission_title: string; volunteer_name: string; completion_note?: string }
export default function VolunteerScreen() {
  const { t } = useLanguage(); const { theme } = useTheme();
  const [tab, setTab] = useState<'available' | 'mine' | 'confirmations'>('available');
  const [missions, setMissions] = useState<Mission[]>([]); const [assignments, setAssignments] = useState<Assignment[]>([]); const [confirmations, setConfirmations] = useState<Confirmation[]>([]);
  const [loading, setLoading] = useState(false); const [busy, setBusy] = useState(false); const [error, setError] = useState('');
  const [completion, setCompletion] = useState<Assignment | null>(null); const [note, setNote] = useState('');
  const load = useCallback(async () => {
    setLoading(true); setError('');
    try {
      const path = tab === 'available' ? '/api/missions?status=active' : tab === 'mine' ? '/api/volunteer-assignments' : '/api/volunteer-assignments/confirmations';
      const response = await apiFetch(path); if (!response.ok) throw new Error(await parseErrorResponse(response));
      const rows = await response.json();
      if (tab === 'available') setMissions(rows.filter((m: Mission) => m.mission_type !== 'donation'));
      else if (tab === 'mine') setAssignments(rows); else setConfirmations(rows);
    } catch (e) { setError(e instanceof Error ? e.message : t('relief.loadFailed')); }
    finally { setLoading(false); }
  }, [tab, t]);
  useFocusEffect(useCallback(() => { void load(); }, [load]));
  async function act(path: string, body: object, method = 'PATCH') {
    if (busy) return; setBusy(true); setError('');
    try {
      const response = await apiFetch(path, { method, body: JSON.stringify(body) });
      if (!response.ok) throw new Error(await parseErrorResponse(response));
      setCompletion(null); await load();
    } catch (e) { setError(e instanceof Error ? e.message : t('common.error')); }
    finally { setBusy(false); }
  }
  return <ReliefPage title={t('dashboard.volunteerHub')} subtitle={t('relief.volunteerIntro')} refreshing={loading} onRefresh={() => { void load(); }}>
    <View style={reliefStyles.row}><MinimalButton small title={t('relief.availableMissions')} variant={tab === 'available' ? 'primary' : 'outline'} onPress={() => setTab('available')} /><MinimalButton small title={t('relief.myAssignments')} variant={tab === 'mine' ? 'primary' : 'outline'} onPress={() => setTab('mine')} /><MinimalButton small title={t('relief.confirmHelp')} variant={tab === 'confirmations' ? 'primary' : 'outline'} onPress={() => setTab('confirmations')} /></View>
    {error ? <ReliefCard><ReliefText>{error}</ReliefText></ReliefCard> : null}{loading && <ActivityIndicator color={theme.brandActive} />}
    {tab === 'available' && <>{!loading && !missions.length && <ReliefText>{t('volunteer.noMissionsAvailable')}</ReliefText>}{missions.map(m => <ReliefCard key={m.mission_id}><ReliefText title>{m.title}</ReliefText><ReliefText muted>{m.district}</ReliefText><ReliefText>{m.description}</ReliefText><MinimalButton title={t('volunteer.join')} disabled={busy} onPress={() => { void act('/api/volunteer-assignments', { mission_id: m.mission_id }, 'POST'); }} /></ReliefCard>)}</>}
    {tab === 'mine' && <>{!loading && !assignments.length && <ReliefText>{t('relief.noAssignments')}</ReliefText>}{assignments.map(a => <ReliefCard key={a.assignment_id}><ReliefText title>{a.mission_title}</ReliefText><ReliefBadge status={a.status} />{a.completion_pending ? <ReliefText>{t('relief.completionPending')}</ReliefText> : ['active', 'accepted'].includes(a.status) ? <MinimalButton title={t('relief.requestCompletion')} onPress={() => { setCompletion(a); setNote(''); }} /> : null}</ReliefCard>)}</>}
    {tab === 'confirmations' && <><ReliefText muted>{t('relief.confirmHelpNote')}</ReliefText>{!loading && !confirmations.length && <ReliefText>{t('relief.noConfirmations')}</ReliefText>}{confirmations.map(c => <ReliefCard key={c.assignment_id}><ReliefText title>{c.mission_title}</ReliefText><ReliefText>{c.volunteer_name}</ReliefText><ReliefText>{c.completion_note || t('relief.noCompletionNote')}</ReliefText><MinimalButton title={t('relief.helpReceived')} disabled={busy} onPress={() => { void act(`/api/volunteer-assignments/${c.assignment_id}/confirm`, {}); }} /></ReliefCard>)}</>}
    <Modal visible={!!completion} transparent animationType="slide" onRequestClose={() => { if (!busy) setCompletion(null); }}><View style={{ flex: 1, backgroundColor: theme.overlay, justifyContent: 'flex-end' }}><ScrollView style={{ maxHeight: '80%', backgroundColor: theme.background }} contentContainerStyle={{ padding: 24, gap: 18 }}><ReliefText title>{t('relief.requestCompletion')}</ReliefText><ReliefText>{t('relief.completionNote')}</ReliefText><ReliefField label={t('relief.workDone')} value={note} onChangeText={setNote} multiline maxLength={1500} /><MinimalButton title={t('relief.submitForConfirmation')} disabled={busy} onPress={() => { if (completion) void act(`/api/volunteer-assignments/${completion.assignment_id}/complete`, { note: note.trim() }); }} /><MinimalButton title={t('common.cancel')} variant="outline" disabled={busy} onPress={() => setCompletion(null)} />{error ? <ReliefText>{error}</ReliefText> : null}</ScrollView></View></Modal>
  </ReliefPage>;
}
