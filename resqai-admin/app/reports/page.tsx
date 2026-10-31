'use client';

import { useRef, useState } from 'react';
import api from '@/lib/api';
import { apiError, downloadCsv, readable } from '@/lib/operations';

interface GoodsRow { item_name: string; unit: string; required_quantity: number; pledged_quantity: number; received_quantity: number; dispatched_quantity: number; delivered_quantity: number }
interface Report { narrative: string; statistics: Record<string, number | null>; goods: GoodsRow[]; generated_at: string; source: string }

export default function ReportsPage() {
  const [report, setReport] = useState<Report | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const lock = useRef(false);
  async function generate() {
    if (lock.current) return;
    lock.current = true; setLoading(true); setError('');
    try { setReport((await api.get('/api/admin/dashboard/report')).data); }
    catch (error) { setError(apiError(error, 'Unable to generate the report. The previous report, if shown, is unchanged.')); }
    finally { lock.current = false; setLoading(false); }
  }
  function exportCsv() {
    if (!report) return;
    const rows: Array<Array<string | number | null>> = [
      ['ResQAI operational report', report.generated_at], ['Source', report.source], [], ['Metric', 'Value'],
      ...Object.entries(report.statistics).map(([key, value]) => [readable(key), value]), [],
      ['Item', 'Unit', 'Required', 'Pledged', 'Received', 'Dispatched', 'Confirmed delivered'],
      ...report.goods.map(item => [item.item_name, item.unit, item.required_quantity, item.pledged_quantity, item.received_quantity, item.dispatched_quantity, item.delivered_quantity]),
    ];
    downloadCsv(`resqai-operations-${report.generated_at.slice(0, 10)}.csv`, rows);
  }
  return <div className="page"><h1>Operational reports</h1>
    <p className="opsMuted">A database summary of review workload, response progress, and goods fulfillment. No quantities with different units are combined.</p>
    <div className="opsActions noPrint"><button type="button" disabled={loading} onClick={generate}>{loading ? 'Generating…' : 'Generate current report'}</button><button type="button" className="outline" disabled={!report || loading} onClick={exportCsv}>Download CSV</button><button type="button" className="outline" disabled={!report || loading} onClick={() => window.print()}>Print / Save PDF</button></div>
    {error && <p role="alert" className="opsError">{error}</p>}
    {report ? <>
      <section className="section"><h2>Current situation</h2><p>{report.narrative}</p><p className="opsMuted">{report.source} · Generated {new Date(report.generated_at).toLocaleString()}</p></section>
      <section className="section"><h2>Response and verification</h2><div className="tableWrap"><table><thead><tr><th>Metric</th><th>Value</th></tr></thead><tbody>{Object.entries(report.statistics).map(([key, value]) => <tr key={key}><td>{readable(key)}</td><td>{value ?? 'No completed records yet'}</td></tr>)}</tbody></table></div><p className="opsMuted">Average times are in minutes and use completed records. Priority 4–5 reports still pending are counted as urgent waiting. Confirmed deliveries include recipient confirmations and documented dispute decisions.</p></section>
      <section className="section"><h2>Goods by item and unit</h2><div className="tableWrap"><table><thead><tr><th>Item</th><th>Unit</th><th>Required</th><th>Pledged</th><th>Received</th><th>Dispatched</th><th>Confirmed delivered</th></tr></thead><tbody>{report.goods.map((item, index) => <tr key={index}><td>{item.item_name}</td><td>{item.unit}</td><td>{item.required_quantity}</td><td>{item.pledged_quantity}</td><td>{item.received_quantity}</td><td>{item.dispatched_quantity}</td><td>{item.delivered_quantity}</td></tr>)}{!report.goods.length && <tr><td colSpan={7}>No goods needs recorded.</td></tr>}</tbody></table></div></section>
    </> : <p>Generate a report to view the current database totals and download the results.</p>}
  </div>;
}
