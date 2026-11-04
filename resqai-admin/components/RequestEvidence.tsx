'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import useSWR from 'swr';
import api from '@/lib/api';
import { apiError } from '@/lib/operations';
import styles from './RequestEvidence.module.css';

interface EvidenceItem {
  evidence_id: string;
  kind: 'nic' | 'selfie';
  created_at: string;
  expires_at: string;
  challenge_prompt?: string;
  captured_at?: string;
}

interface EvidenceMetadata {
  configured: boolean;
  items: EvidenceItem[];
  review_note?: string;
}

const fetcher = (url: string) => api.get<EvidenceMetadata>(url, {
  headers: { 'Cache-Control': 'no-cache' },
}).then(response => response.data);

function EvidenceImage({ requestId, evidence }: { requestId: string; evidence: EvidenceItem }) {
  const [image, setImage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expired, setExpired] = useState(false);
  const objectUrl = useRef<string | null>(null);
  const pending = useRef<AbortController | null>(null);
  const title = evidence.kind === 'nic' ? 'NIC document' : 'Camera selfie';

  const hide = useCallback(() => {
    pending.current?.abort();
    pending.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
    setImage(null);
    setLoading(false);
    setError('');
  }, []);

  useEffect(() => () => {
    pending.current?.abort();
    pending.current = null;
    if (objectUrl.current) URL.revokeObjectURL(objectUrl.current);
    objectUrl.current = null;
  }, []);

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const checkExpiry = () => {
      const remaining = Date.parse(evidence.expires_at) - Date.now();
      if (!Number.isFinite(remaining) || remaining <= 0) { hide(); setExpired(true); }
      else timer = setTimeout(checkExpiry, Math.min(remaining, 60000));
    };
    timer = setTimeout(checkExpiry, 0);
    return () => clearTimeout(timer);
  }, [evidence.expires_at, hide]);

  async function view() {
    if (loading || image || expired) return;
    const controller = new AbortController();
    pending.current = controller;
    setLoading(true); setError('');
    try {
      const response = await api.get<Blob>(`/api/admin/request-evidence/${requestId}/${evidence.evidence_id}/image`, {
        responseType: 'blob', signal: controller.signal,
        headers: { 'Cache-Control': 'no-cache' },
      });
      if (controller.signal.aborted) return;
      if (response.data.type.split(';')[0] !== 'image/jpeg') throw new Error('Unsupported evidence image');
      const url = URL.createObjectURL(response.data);
      objectUrl.current = url;
      setImage(url);
    } catch (error) {
      if (!controller.signal.aborted) setError(apiError(error, 'The image is unavailable or has expired.'));
    } finally {
      if (pending.current === controller) { pending.current = null; setLoading(false); }
    }
  }

  if (expired) return <p className="opsMuted">{title} expired. Ask the requester to submit new evidence if needed.</p>;

  return <div className={styles.evidence}>
    <h3>{title}</h3>
    <p className="opsMuted">Submitted {new Date(evidence.created_at).toLocaleString()} · Expires {new Date(evidence.expires_at).toLocaleString()}</p>
    {evidence.captured_at && <p className="opsMuted">Reported capture time: {new Date(evidence.captured_at).toLocaleString()}</p>}
    {evidence.challenge_prompt && <p>Camera instruction: {evidence.challenge_prompt}</p>}
    <button type="button" onClick={image || loading ? hide : view}>
      {image ? `Hide ${title.toLowerCase()}` : loading ? 'Cancel loading image' : `View ${title.toLowerCase()}`}
    </button>
    {loading && <p role="status">Loading private image…</p>}
    {error && <p role="alert" className="opsError">{error}</p>}
    {image && <Image className={styles.image} src={image} width={800} height={600} unoptimized alt={`${title} submitted for private manual review`} />}
  </div>;
}

export default function RequestEvidence({ requestId }: { requestId: string }) {
  const { data, error, isLoading } = useSWR<EvidenceMetadata>(
    `/api/admin/request-evidence/${requestId}`, fetcher, { refreshInterval: 15000 },
  );

  return <section className="section">
    <h2>Private identity evidence</h2>
    <p>Compare the NIC and camera photo manually. Confirm the reported need separately; these uploads do not provide automatic face matching or proof of liveness.</p>
    <p className="opsMuted">Only administrators can open these images. Each image access is recorded. Hide images when you finish reviewing.</p>
    {isLoading ? <p role="status">Checking private evidence…</p>
      : error ? <p role="alert" className="opsError">Private evidence could not be loaded. Try again after checking the evidence service.</p>
        : !data?.configured ? <p className="opsMuted">Private evidence storage is not configured. Use a phone callback or field confirmation.</p>
          : !data.items.length ? <p className="opsMuted">No current NIC or camera photo supplied. Ask for evidence if it is needed for your review.</p>
            : <div className={styles.grid}>{data.items.map(evidence => <EvidenceImage key={evidence.evidence_id} requestId={requestId} evidence={evidence} />)}</div>}
    {data?.review_note && !error && <p className="opsMuted">{data.review_note}</p>}
  </section>;
}
