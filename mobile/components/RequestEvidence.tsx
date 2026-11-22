import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Image, Modal, Platform, Pressable, ScrollView, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { File as NativeFile, Paths } from 'expo-file-system';
import { useFocusEffect } from 'expo-router';
import { getToken } from '../config/api';
import { useTheme } from '../context/ThemeContext';
import { useLanguage } from '../context/LanguageContext';
import { EvidenceChallenge, EvidenceInfo, evidenceRequest, isActiveEvidenceChallenge, isValidEvidenceImage } from '../services/requestEvidence';
import MinimalButton from './MinimalButton';
import { ReliefText, reliefStyles } from './ReliefUI';

/** Optional private review, mounted only for a request that the API already saved. */
export default function RequestEvidence({ requestId }: { requestId: string }) {
  const { t, formatDate } = useLanguage(); const { theme } = useTheme();
  const [open, setOpen] = useState(false); const [signedIn, setSignedIn] = useState(false);
  const [info, setInfo] = useState<EvidenceInfo | null>(null);
  const [consent, setConsent] = useState(false); const [challenge, setChallenge] = useState<EvidenceChallenge | null>(null);
  const [nicImage, setNicImage] = useState(''); const [selfieImage, setSelfieImage] = useState('');
  const [capturedAt, setCapturedAt] = useState(''); const [busy, setBusy] = useState(false);
  const [error, setError] = useState(''); const [notice, setNotice] = useState('');
  const [seconds, setSeconds] = useState(0); const [camera, setCamera] = useState<'nic' | 'selfie' | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null); const streamRef = useRef<MediaStream | null>(null);
  const mounted = useRef(true); const focused = useRef(true); const pending = useRef<AbortController | null>(null);
  const ownerToken = useRef<string | null>(null);
  const currentChallenge = useRef<EvidenceChallenge | null>(null);
  currentChallenge.current = challenge;
  const challengeInstruction = challenge?.challenge_code && /^\d{6}$/.test(challenge.challenge_code)
    ? t('requestEvidence.challengeInstruction', { code: challenge.challenge_code }) : challenge?.prompt || '';

  const stopCamera = useCallback(() => {
    streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
  }, []);
  const discardDraft = useCallback(() => {
    setChallenge(null); currentChallenge.current = null; setNicImage(''); setSelfieImage(''); setCapturedAt('');
    setCamera(null); stopCamera();
  }, [stopCamera]);
  useEffect(() => {
    mounted.current = true;
    return () => { mounted.current = false; pending.current?.abort(); stopCamera(); };
  }, [stopCamera]);
  useFocusEffect(useCallback(() => {
    focused.current = true;
    return () => { focused.current = false; pending.current?.abort(); discardDraft(); setConsent(false); };
  }, [discardDraft]));
  useEffect(() => {
    if (!challenge) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((Date.parse(challenge.expires_at) - Date.now()) / 1000));
      setSeconds(remaining);
      if (!remaining) { discardDraft(); setNotice(t('requestEvidence.expired')); }
    };
    tick(); const timer = setInterval(tick, 1000); return () => clearInterval(timer);
  }, [challenge, discardDraft, t]);
  useEffect(() => {
    if (!camera || Platform.OS !== 'web') return;
    let cancelled = false;
    void (async () => {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error();
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: camera === 'selfie' ? 'user' : { ideal: 'environment' }, width: { ideal: 1280 } }, audio: false,
        });
        if (cancelled || !mounted.current || !focused.current) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
      } catch {
        if (!cancelled && mounted.current) { setError(t('requestEvidence.cameraUnavailable')); setCamera(null); stopCamera(); }
      }
    })();
    return () => { cancelled = true; stopCamera(); };
  }, [camera, stopCamera, t]);

  async function load() {
    setOpen(true); setBusy(true); setError('');
    try {
      const token = await getToken(); if (!mounted.current) return;
      if (token !== ownerToken.current) { discardDraft(); setConsent(false); setInfo(null); }
      ownerToken.current = token;
      setSignedIn(!!token); if (!token) return;
      pending.current = new AbortController();
      const result = await evidenceRequest<EvidenceInfo>(requestId, 'GET', undefined, false, pending.current.signal);
      if (mounted.current) setInfo(result);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : t('requestEvidence.failed')); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function startChallenge() {
    if (busy || !consent) return;
    discardDraft(); setBusy(true); setError(''); setNotice('');
    try {
      pending.current = new AbortController();
      const value = await evidenceRequest<EvidenceChallenge>(requestId, 'POST', undefined, true, pending.current.signal);
      if (!isActiveEvidenceChallenge(value)) throw new Error(t('requestEvidence.expired'));
      if (mounted.current && focused.current) setChallenge(value);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : t('requestEvidence.failed')); }
    finally { if (mounted.current) setBusy(false); }
  }
  function acceptImage(value: string, kind: 'nic' | 'selfie') {
    if (!mounted.current || !focused.current) return;
    if (!isActiveEvidenceChallenge(currentChallenge.current)) { discardDraft(); setError(t('requestEvidence.expired')); return; }
    if (!isValidEvidenceImage(value)) { setError(t('requestEvidence.imageInvalid')); return; }
    if (kind === 'nic') setNicImage(value);
    else { setSelfieImage(value); setCapturedAt(new Date().toISOString()); }
    setError('');
  }
  async function nativeImage(kind: 'nic' | 'selfie', gallery = false) {
    if (!isActiveEvidenceChallenge(currentChallenge.current) || busy) return;
    setBusy(true); setError('');
    try {
      const permission = gallery ? await ImagePicker.requestMediaLibraryPermissionsAsync() : await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted) throw new Error(t('requestEvidence.cameraUnavailable'));
      const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'], allowsEditing: false, quality: .55, base64: true, exif: false,
        cameraType: kind === 'selfie' ? ImagePicker.CameraType.front : ImagePicker.CameraType.back,
      };
      const image = gallery ? await ImagePicker.launchImageLibraryAsync(options) : await ImagePicker.launchCameraAsync(options);
      if (image.canceled || !image.assets[0]) return;
      const asset = image.assets[0];
      // The picker returns JPEG base64. Remove its temporary app-cache copy before retaining the in-memory image.
      const value = asset.base64 ? `data:image/jpeg;base64,${asset.base64}` : '';
      if (asset.uri.startsWith(Paths.cache.uri)) {
        const temporary = new NativeFile(asset.uri); if (temporary.exists) temporary.delete();
      }
      acceptImage(value, kind);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : t('requestEvidence.failed')); }
    finally { if (mounted.current) setBusy(false); }
  }
  function pickNic() {
    if (Platform.OS !== 'web') { void nativeImage('nic', true); return; }
    if (!isActiveEvidenceChallenge(currentChallenge.current) || busy) return;
    const input = document.createElement('input'); input.type = 'file'; input.accept = 'image/jpeg,image/png,image/webp';
    input.onchange = () => {
      const file = input.files?.[0]; if (!file) return;
      if (file.size > 3_000_000) { setError(t('requestEvidence.imageInvalid')); return; }
      const reader = new FileReader();
      reader.onload = () => { if (typeof reader.result === 'string') acceptImage(reader.result, 'nic'); };
      reader.onerror = () => { if (mounted.current) setError(t('requestEvidence.imageInvalid')); };
      reader.readAsDataURL(file);
    };
    input.click();
  }
  function capture(kind: 'nic' | 'selfie') {
    if (Platform.OS === 'web') { setError(''); setCamera(kind); }
    else void nativeImage(kind);
  }
  function snapWebCamera() {
    const video = videoRef.current; if (!video || !camera || !video.videoWidth || !video.videoHeight) return;
    const canvas = document.createElement('canvas'); const ratio = Math.min(1, 1280 / Math.max(video.videoWidth, video.videoHeight));
    canvas.width = Math.round(video.videoWidth * ratio); canvas.height = Math.round(video.videoHeight * ratio);
    const context = canvas.getContext('2d'); if (!context) return;
    context.drawImage(video, 0, 0, canvas.width, canvas.height);
    acceptImage(canvas.toDataURL('image/jpeg', .65), camera); setCamera(null); stopCamera();
    canvas.width = 0; canvas.height = 0;
  }
  async function upload() {
    if (busy || !consent || !nicImage || !selfieImage || !capturedAt) return;
    if (!isActiveEvidenceChallenge(challenge)) { discardDraft(); setError(t('requestEvidence.expired')); return; }
    setBusy(true); setError(''); setNotice('');
    try {
      if (!ownerToken.current || await getToken() !== ownerToken.current) {
        discardDraft(); setConsent(false); setInfo(null); setSignedIn(false);
        throw new Error(t('requestEvidence.signInNeeded'));
      }
      pending.current = new AbortController();
      await evidenceRequest(requestId, 'POST', {
        challenge_id: challenge.challenge_id, nic_image: nicImage, selfie_image: selfieImage, captured_at: capturedAt, consent: true,
      }, false, pending.current.signal);
      if (!mounted.current) return;
      discardDraft(); setConsent(false); setNotice(t('requestEvidence.received'));
      const updated = await evidenceRequest<EvidenceInfo>(requestId, 'GET', undefined, false, pending.current.signal);
      if (mounted.current) setInfo(updated);
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : t('requestEvidence.failed')); }
    finally { if (mounted.current) setBusy(false); }
  }
  async function remove() {
    if (busy) return; setBusy(true); setError('');
    try {
      pending.current = new AbortController();
      await evidenceRequest(requestId, 'DELETE', undefined, false, pending.current.signal);
      if (mounted.current) { discardDraft(); setConsent(false); setInfo(old => old ? { ...old, items: [] } : old); setNotice(t('requestEvidence.removed')); }
    } catch (e) { if (mounted.current) setError(e instanceof Error ? e.message : t('requestEvidence.failed')); }
    finally { if (mounted.current) setBusy(false); }
  }

  if (!open) return <MinimalButton title={t('requestEvidence.open')} variant="outline" onPress={() => { void load(); }} />;
  return <View style={{ gap: 12, borderTopWidth: 1, borderTopColor: theme.border, paddingTop: 16 }}>
    <ReliefText title>{t('requestEvidence.title')}</ReliefText>
    <ReliefText muted>{t('requestEvidence.intro')}</ReliefText>
    {busy && <ActivityIndicator color={theme.brandActive} />}
    {!signedIn && !busy && <ReliefText>{t('requestEvidence.signInNeeded')}</ReliefText>}
    {signedIn && info && <>
      {!info.configured && <ReliefText>{t('requestEvidence.unavailable')}</ReliefText>}
      {info.items?.length > 0 && <>
        <ReliefText>{t('requestEvidence.stored')}</ReliefText>
        <ReliefText muted>{t('requestEvidence.deleteBy', { date: formatDate(info.items[0].expires_at) })}</ReliefText>
        <MinimalButton title={t('requestEvidence.remove')} variant="outline" onPress={() => { void remove(); }} disabled={busy} />
      </>}
      {info.configured && !info.items?.length && <>
        <Pressable accessibilityRole="checkbox" accessibilityState={{ checked: consent, disabled: busy }} disabled={busy}
          onPress={() => { if (consent) discardDraft(); setConsent(!consent); }} style={{ flexDirection: 'row', gap: 10, alignItems: 'flex-start' }}>
          <View style={{ width: 22, height: 22, borderRadius: 4, borderWidth: 2, borderColor: theme.brandActive, backgroundColor: consent ? theme.brandActive : 'transparent', alignItems: 'center', justifyContent: 'center' }}><ReliefText>{consent ? '✓' : ''}</ReliefText></View>
          <View style={{ flex: 1 }}><ReliefText>{t('requestEvidence.consent')}</ReliefText></View>
        </Pressable>
        {!challenge && <MinimalButton title={t('requestEvidence.start')} onPress={() => { void startChallenge(); }} disabled={busy || !consent} />}
        {challenge && <>
          <ReliefText title>{challengeInstruction}</ReliefText>
          <ReliefText muted>{t('requestEvidence.timeLeft', { seconds })}</ReliefText>
          <ReliefText muted>{t('requestEvidence.selfieInstruction')}</ReliefText>
          <View style={reliefStyles.row}>
            <MinimalButton title={t('requestEvidence.nicCamera')} variant="outline" onPress={() => capture('nic')} disabled={busy} />
            <MinimalButton title={t('requestEvidence.nicGallery')} variant="outline" onPress={pickNic} disabled={busy} />
          </View>
          {nicImage ? <Image accessibilityLabel={t('requestEvidence.nicPreview')} source={{ uri: nicImage }} resizeMode="contain" style={{ height: 140, width: '100%' }} /> : null}
          <MinimalButton title={t(selfieImage ? 'requestEvidence.retakeSelfie' : 'requestEvidence.selfieCamera')} variant="outline" onPress={() => capture('selfie')} disabled={busy} />
          {selfieImage ? <Image accessibilityLabel={t('requestEvidence.selfiePreview')} source={{ uri: selfieImage }} resizeMode="contain" style={{ height: 140, width: '100%' }} /> : null}
          <MinimalButton title={t('requestEvidence.send')} onPress={() => { void upload(); }} disabled={busy || !nicImage || !selfieImage || !consent} />
          <MinimalButton title={t('requestEvidence.discard')} variant="outline" onPress={discardDraft} disabled={busy} />
        </>}
      </>}
    </>}
    {notice ? <ReliefText>{notice}</ReliefText> : null}
    {error ? <><ReliefText>{error}</ReliefText><MinimalButton title={t('common.retry')} variant="outline" onPress={() => { void load(); }} disabled={busy} /></> : null}
    <Modal visible={!!camera && Platform.OS === 'web'} animationType="slide" onRequestClose={() => { setCamera(null); stopCamera(); }}>
      <ScrollView contentContainerStyle={{ padding: 24, gap: 18, backgroundColor: theme.background, flexGrow: 1 }}>
        <ReliefText title>{camera === 'selfie' ? t('requestEvidence.selfieCamera') : t('requestEvidence.nicCamera')}</ReliefText>
        <ReliefText>{challengeInstruction}</ReliefText>
        <ReliefText muted>{t('requestEvidence.timeLeft', { seconds })}</ReliefText>
        {Platform.OS === 'web' && React.createElement('video', { ref: videoRef, autoPlay: true, playsInline: true, muted: true, style: { width: '100%', maxHeight: '60vh', transform: camera === 'selfie' ? 'scaleX(-1)' : undefined } })}
        <MinimalButton title={t('requestEvidence.takePhoto')} onPress={snapWebCamera} />
        <MinimalButton title={t('common.cancel')} variant="outline" onPress={() => { setCamera(null); stopCamera(); }} />
      </ScrollView>
    </Modal>
  </View>;
}
