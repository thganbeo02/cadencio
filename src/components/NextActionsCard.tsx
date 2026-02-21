import { useEffect, useMemo, useState, type CSSProperties } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/database';
import type { Obligation, ObligationCycle } from '../types';
import { confirmObligationPaid, refreshMissedObligationCycles } from '../services/obligations';
import { dateISOInTimeZone, addDaysISO } from '../utils/dates';
import { Modal } from './Modal';
import { ObligationPlanningModal } from './ObligationPlanningModal';
import { digitsOnly } from '../utils/input';

type Row = {
  obligation: Obligation;
  cycle: ObligationCycle;
  dueISO: string;
};

function priorityLabel(priority: 1 | 2 | 3): { text: string; style: CSSProperties } {
  if (priority === 1) return { text: 'P1 CRITICAL', style: { backgroundColor: 'var(--danger)', color: '#fff' } };
  if (priority === 2) return { text: 'P2 HIGH', style: { backgroundColor: 'var(--warn)', color: '#fff' } };
  return { text: 'P3 STANDARD', style: { backgroundColor: 'var(--primary-soft)', color: 'var(--primary)' } };
}

export function NextActionsCard() {
  const [rows, setRows] = useState<Row[]>([]);
  const [needsPlanning, setNeedsPlanning] = useState(false);
  const [planOpen, setPlanOpen] = useState(false);
  const [confirm, setConfirm] = useState<{ obligationId: string; cycleId: string; name: string; plannedAmount: number } | null>(null);
  const [paidAmountRaw, setPaidAmountRaw] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    refreshMissedObligationCycles();
  }, []);

  useEffect(() => {
    const sub = liveQuery(async () => {
      const settings = await db.settings.get('settings');
      const tz = settings?.timezone ?? 'UTC';
      const nowISO = dateISOInTimeZone(new Date(), tz);
      const weekFromNow = addDaysISO(nowISO, 7);

      const obligations = await db.obligations.toArray();
      const unplanned = obligations.some((o) => o.totalAmount > 0 && o.cycles.length === 0);

      const flat: Row[] = [];
      for (const obl of obligations) {
        for (const cycle of obl.cycles) {
          if (cycle.status === 'PLANNED' && cycle.dueDateISO >= nowISO && cycle.dueDateISO <= weekFromNow) {
            flat.push({ obligation: obl, cycle, dueISO: cycle.dueDateISO });
          }
        }
      }
      return { flat, unplanned };
    }).subscribe(({ flat, unplanned }) => {
      setRows(flat);
      setNeedsPlanning(unplanned);
    });
    return () => sub.unsubscribe();
  }, []);

  const dueSoon = useMemo(() => rows.slice(0, 5), [rows]);

  async function doConfirmPaid() {
    if (!confirm) return;
    const n = Number(digitsOnly(paidAmountRaw));
    if (!Number.isFinite(n) || n <= 0) return;
    setIsSaving(true);
    try {
      await confirmObligationPaid(confirm.obligationId, confirm.cycleId, n);
      setConfirm(null);
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <div className="card">
        <div className="section-title">
          <h2>Next Actions</h2>
          <span className="small muted">Quest Log</span>
        </div>

        <div style={{ display: 'grid', gap: 12 }}>
          {needsPlanning ? (
            <div className="card soft" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <div>
                <div style={{ fontWeight: 700 }}>Plan your obligations</div>
                <div className="small muted">Set a payment plan so Salary Day Run knows what to do.</div>
              </div>
              <button className="pill primary" onClick={() => setPlanOpen(true)}>Plan</button>
            </div>
          ) : null}

          {dueSoon.length ? (
            <div className="card soft">
              <div className="small muted" style={{ marginBottom: 8 }}>Due soon</div>
              {dueSoon.map((r) => {
                const badge = priorityLabel(r.obligation.priority);
                return (
                  <div key={`${r.obligation.id}_${r.cycle.id}`} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span className="chip" style={badge.style}>{badge.text}</span>
                        <span className="small muted">Due {r.dueISO}</span>
                      </div>
                      <div style={{ fontWeight: 600 }}>{r.obligation.name}</div>
                    </div>
                    <button
                      className="pill"
                      onClick={() => {
                        setConfirm({ obligationId: r.obligation.id, cycleId: r.cycle.id, name: r.obligation.name, plannedAmount: r.cycle.amount });
                        setPaidAmountRaw(String(r.cycle.amount));
                      }}
                    >
                      Confirm Paid
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="card soft">
              <div className="small muted">No critical actions right now.</div>
            </div>
          )}
        </div>
      </div>

      {confirm ? (
        <Modal title="Confirm Paid" description="Have you paid this in your bank app?" onClose={() => setConfirm(null)}>
          <div className="card soft">
            <div style={{ fontWeight: 700 }}>{confirm.name}</div>
            <div className="small muted">Planned: <span className="num">{confirm.plannedAmount}</span> VND</div>
          </div>
          <div style={{ marginTop: 12 }}>
            <label className="small muted">Paid amount (VND)</label>
            <input className="input num" value={paidAmountRaw} onChange={(e) => setPaidAmountRaw(e.target.value)} />
          </div>
          <div className="cta-row">
            <button className="pill" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="pill primary" onClick={doConfirmPaid} disabled={isSaving}>Confirm</button>
          </div>
        </Modal>
      ) : null}

      {planOpen ? <ObligationPlanningModal onClose={() => setPlanOpen(false)} /> : null}
    </>
  );
}
