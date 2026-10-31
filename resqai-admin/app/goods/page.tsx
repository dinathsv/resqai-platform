'use client';

import { FormEvent, useEffect, useState } from 'react';
import Link from 'next/link';
import useSWR from 'swr';
import api from '@/lib/api';
import { apiError, readable } from '@/lib/operations';
import { getSocket } from '@/lib/socket';
import VerificationBadge from '@/components/VerificationBadge';

interface Need { need_id: string; item_name: string; unit: string; required_quantity: number; pledged_quantity: number; received_quantity: number; dispatched_quantity: number; delivered_quantity: number }
interface Pledge { donation_id: string; donor_name: string; item_name: string; unit: string; quantity: number; received_quantity: number; dispatched_quantity: number; delivered_quantity: number; condition: string; availability_note: string; status: string }
interface Delivery { delivery_id: string; item_name: string; unit: string; quantity: number; status: string; recipient_name: string; dispatch_note?: string; dispute_reason?: string; review_reason?: string; created_at: string; confirmed_at?: string }
interface GoodsEvent { event_id?: string; event_type: string; quantity?: number; reason?: string; created_at: string; actor_admin_id?: string; actor_user_id?: string }
interface Mission { mission_id: string; title: string; status: string; origin_request_id: string; requester_name: string; verification_status: string; needs: Need[]; pledges: Pledge[]; deliveries: Delivery[]; events: GoodsEvent[] }
type Action = { kind: 'receive' | 'dispatch' | 'need' | 'add' | 'review'; id: string; mission_id: string; label: string; max?: number; operation_id: string };
const fetcher = (url: string) => api.get(url).then(response => response.data);

export default function GoodsPage() {
  const { data, error, isLoading, mutate } = useSWR<{ missions: Mission[] }>('/api/goods', fetcher, { refreshInterval: 15000 });
  const [missionId, setMissionId] = useState('');
  const [action, setAction] = useState<Action | null>(null);
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [itemName, setItemName] = useState('');
  const [unit, setUnit] = useState('');
  const [resolution, setResolution] = useState('returned');
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState('');
  const [failed, setFailed] = useState(false);
  const missions = data?.missions || [];
  const selected = missions.find(mission => mission.mission_id === missionId) || missions[0];
  const actionable = selected?.verification_status === 'verified' && selected?.status === 'active';
  useEffect(() => {
    const socket = getSocket(); const refresh = () => { void mutate(); };
    socket.on('goods_updated', refresh); socket.on('request_updated', refresh);
    return () => { socket.off('goods_updated', refresh); socket.off('request_updated', refresh); };
  }, [mutate]);
  function open(kind: Action['kind'], id: string, label: string, max?: number, initial?: number) {
    if (!selected) return;
    setAction({ kind, id, label, max, mission_id: selected.mission_id, operation_id: crypto.randomUUID() });
    setQuantity(initial == null ? '' : String(initial)); setReason(''); setItemName(''); setUnit(''); setFeedback('');
  }
  async function submit(event: FormEvent) {
    event.preventDefault(); if (!action || saving) return;
    setSaving(true); setFeedback('');
    try {
      if (action.kind === 'review') await api.patch(`/api/goods/deliveries/${action.id}/review`, { resolution, reason });
      else if (action.kind === 'need') await api.patch(`/api/goods/needs/${action.id}`, { quantity: Number(quantity), reason });
      else if (action.kind === 'add') await api.post('/api/goods/needs', { mission_id: action.mission_id, item_name: itemName, unit, quantity: Number(quantity), reason });
      else await api.post(`/api/goods/pledges/${action.id}/${action.kind}`, { quantity: Number(quantity), reason, operation_id: action.operation_id });
      await mutate(); setAction(null); setFailed(false); setFeedback('Operation recorded in the goods history.');
    } catch (error) { setFailed(true); setFeedback(apiError(error, 'The operation could not be saved. You can retry with the same details.')); }
    finally { setSaving(false); }
  }
  return <div className="page">
    <h1>Goods and deliveries</h1>
    <p className="opsMuted">Track required goods through pledging, receipt, dispatch, and recipient confirmation. Quantities stay in their original units.</p>
    {error && <p role="alert" className="opsError">Goods coordination could not be loaded.</p>}
    {isLoading && <p>Loading goods missions…</p>}
    <div className="opsActions"><select aria-label="Goods mission" value={selected?.mission_id || ''} onChange={event => { setMissionId(event.target.value); setAction(null); }} disabled={saving || !missions.length}>
      {missions.map(mission => <option key={mission.mission_id} value={mission.mission_id}>{mission.requester_name} · {mission.title} · {readable(mission.status)}</option>)}
    </select><button className="outline" onClick={() => mutate()} type="button">Refresh</button></div>
    {!isLoading && !error && !missions.length && <div className="opsNotice">No goods missions yet. <Link href="/requests">Review a goods request</Link> to confirm the need and open its item list.</div>}
    {selected && <>
      <div className="opsActions"><VerificationBadge status={selected.verification_status} /><span>{readable(selected.status)}</span><Link href={`/requests/${selected.origin_request_id}`}>Request and verification</Link><Link href={`/missions/${selected.mission_id}`}>Mission status</Link></div>
      {!actionable && <p className="opsNotice">Receiving and dispatching are available when this mission is active and its need is confirmed. Existing delivery disputes can still be reviewed.</p>}
      {feedback && <p role={failed ? 'alert' : 'status'} className={failed ? 'opsError' : ''}>{feedback}</p>}
      {action && <section className="opsCard" aria-label="Record goods operation"><h2>{action.label}</h2><form className="opsForm" onSubmit={submit}>
        {action.kind === 'add' && <><label>Item name<input required maxLength={120} value={itemName} onChange={event => setItemName(event.target.value)} /></label><label>Unit<input required maxLength={40} value={unit} onChange={event => setUnit(event.target.value)} placeholder="kg, sealed packs, blankets…" /></label></>}
        {action.kind !== 'review' && <label>{action.kind === 'need' ? 'New total required quantity' : 'Quantity for this operation'}<input type="number" min="0.01" step="0.01" max={action.max ?? 1000000} required value={quantity} onChange={event => setQuantity(event.target.value)} />{action.max != null && <small>Available for this action: {action.max}</small>}</label>}
        {action.kind === 'review' && <><p className="opsNotice">A different coordinator must review the disputed dispatch. Confirm delivery only after checking the handover evidence and speaking to the recipient.</p><label>Resolution<select value={resolution} onChange={event => setResolution(event.target.value)}><option value="returned">Goods returned to available stock</option><option value="confirmed">Delivery confirmed after investigation</option></select></label></>}
        <label>{action.kind === 'dispatch' ? 'Handover plan and evidence note' : 'Evidence checked and reason'}<textarea required minLength={10} maxLength={1500} rows={3} value={reason} onChange={event => setReason(event.target.value)} placeholder="Record what was checked, by whom, and the result" /></label>
        <div className="opsActions"><button type="submit" disabled={saving || reason.trim().length < 10}>{saving ? 'Saving…' : 'Record operation'}</button><button type="button" className="outline" disabled={saving} onClick={() => setAction(null)}>Cancel</button></div>
      </form></section>}
      <section className="section"><div className="opsActions"><h2>Needs and fulfillment</h2><button type="button" disabled={!actionable || saving} onClick={() => open('add', '', 'Add a confirmed need')}>Add item</button></div>
        <div className="tableWrap"><table><thead><tr><th>Item / unit</th><th>Required</th><th>Pledged</th><th>Received</th><th>Dispatched</th><th>Confirmed delivered</th><th>Remaining need</th><th>Action</th></tr></thead><tbody>
          {selected.needs.map(need => <tr key={need.need_id}><td>{need.item_name} ({need.unit})</td><td>{need.required_quantity}</td><td>{need.pledged_quantity}</td><td>{need.received_quantity}</td><td>{need.dispatched_quantity}</td><td>{need.delivered_quantity}</td><td>{Math.max(0, need.required_quantity - need.delivered_quantity)}</td><td><button type="button" className="outline" disabled={!actionable || saving} onClick={() => open('need', need.need_id, `Adjust required ${need.item_name}`, undefined, need.required_quantity)}>Adjust need</button></td></tr>)}
          {!selected.needs.length && <tr><td colSpan={8}>No goods needs recorded.</td></tr>}
        </tbody></table></div></section>
      <section className="section"><h2>Donor pledges and stock</h2><div className="tableWrap"><table><thead><tr><th>Donor / item</th><th>Availability and condition</th><th>Pledged / received / dispatched / delivered</th><th>Status</th><th>Operations</th></tr></thead><tbody>
        {selected.pledges.map(pledge => <tr key={pledge.donation_id}><td><strong>{pledge.donor_name}</strong><p>{pledge.item_name} ({pledge.unit})</p></td><td>{pledge.condition}<p>{pledge.availability_note}</p></td><td>{pledge.quantity} / {pledge.received_quantity} / {pledge.dispatched_quantity} / {pledge.delivered_quantity}</td><td>{readable(pledge.status)}</td><td><div className="opsActions"><button type="button" className="outline" disabled={!actionable || saving || pledge.status === 'cancelled' || pledge.quantity <= pledge.received_quantity} onClick={() => open('receive', pledge.donation_id, `Receive ${pledge.item_name}`, pledge.quantity - pledge.received_quantity)}>Receive</button><button type="button" disabled={!actionable || saving || pledge.status === 'cancelled' || pledge.received_quantity <= pledge.dispatched_quantity} onClick={() => open('dispatch', pledge.donation_id, `Dispatch ${pledge.item_name}`, pledge.received_quantity - pledge.dispatched_quantity)}>Dispatch</button></div></td></tr>)}
        {!selected.pledges.length && <tr><td colSpan={5}>No goods pledged yet.</td></tr>}
      </tbody></table></div></section>
      <section className="section"><h2>Deliveries and disputes</h2><p className="opsMuted">Recipients confirm receipt in the mobile app. A dispute requires review by a coordinator who did not dispatch it.</p>
        {selected.deliveries.map(delivery => <article className="opsCard" key={delivery.delivery_id}><div className="opsActions"><strong>{delivery.quantity} {delivery.unit} {delivery.item_name} → {delivery.recipient_name}</strong><span className={`statusBadge ${delivery.status === 'delivered' ? 'statusSuccess' : 'statusWarning'}`}>{readable(delivery.status)}</span></div><p>Dispatch note: {delivery.dispatch_note || 'Not recorded'}</p>{delivery.dispute_reason && <p className="opsNotice">Recipient dispute: {delivery.dispute_reason}</p>}{delivery.review_reason && <p>Review findings: {delivery.review_reason}</p>}<p className="opsMuted">Dispatched {new Date(delivery.created_at).toLocaleString()}{delivery.confirmed_at ? ` · Confirmed ${new Date(delivery.confirmed_at).toLocaleString()}` : ''}</p>{delivery.status === 'disputed' && <button type="button" disabled={saving} onClick={() => open('review', delivery.delivery_id, 'Review disputed delivery')}>Review dispute</button>}</article>)}
        {!selected.deliveries.length && <p>No dispatches yet.</p>}
      </section>
      <section className="section"><h2>Goods history</h2><ol className="opsTimeline">{selected.events.map((entry, index) => <li key={entry.event_id || index}><strong>{readable(entry.event_type)}</strong>{entry.quantity != null && <> · {entry.quantity}</>}<p>{entry.reason}</p><small>{new Date(entry.created_at).toLocaleString()} · {entry.actor_admin_id ? `Coordinator ${entry.actor_admin_id.slice(0, 8)}` : entry.actor_user_id ? `User ${entry.actor_user_id.slice(0, 8)}` : 'System'}</small></li>)}</ol></section>
    </>}
  </div>;
}
