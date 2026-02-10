import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/database';
import type { Obligation, ObligationPriority } from '../types';
import { useAppStore } from '../stores/useAppStore';
import { Modal } from './Modal';
import { scheduleObligation, type ObligationPlan } from '../services/obligations';
import { suggestObligationPlan } from '../services/obligationSuggestion';
import { dateISOInTimeZone } from '../utils/dates';

function formatCompactVND(amount: number): string {
  if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(1) + 'B';
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(0) + 'M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(0) + 'K';
  return String(Math.round(amount));
}

function priorityLabel(p: ObligationPriority): string {
  return p === 1 ? 'P1 Critical' : p === 2 ? 'P2 High' : 'P3 Standard';
}

function clampDay(d: number): number {
  return Math.min(28, Math.max(1, Math.round(d)));
}

export function ObligationPlanningModal({ onClose }: { onClose: () => void }) {
  const { settings } = useAppStore();
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<'suggested' | 'one_time' | 'monthly' | 'split'>('suggested');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [oneTimeAmountRaw, setOneTimeAmountRaw] = useState('');
  const [oneTimeDueISO, setOneTimeDueISO] = useState('');
  const [monthlyAmountRaw, setMonthlyAmountRaw] = useState('');
  const [monthlyDueDayRaw, setMonthlyDueDayRaw] = useState('15');
  const [monthlyStartMonthISO, setMonthlyStartMonthISO] = useState('');
  const [splitUpfrontAmountRaw, setSplitUpfrontAmountRaw] = useState('');
  const [splitUpfrontDueISO, setSplitUpfrontDueISO] = useState('');
  const [splitMonthlyAmountRaw, setSplitMonthlyAmountRaw] = useState('');
  const [splitDueDayRaw, setSplitDueDayRaw] = useState('15');
  const [splitStartMonthISO, setSplitStartMonthISO] = useState('');

  useEffect(() => {
    const sub = liveQuery(async () => {
      const all = await db.obligations.toArray();
      all.sort((a, b) => {
        if (a.priority !== b.priority) return a.priority - b.priority;
        return a.name.localeCompare(b.name);
      });
      return all.filter((o) => o.totalAmount > 0 && o.cycles.length === 0);
    }).subscribe(setObligations);
    return () => sub.unsubscribe();
  }, []);

  const current = obligations[idx];

  const suggestion = useMemo(() => {
    if (!settings || !current || !settings.monthlyIncome) return null;
    const todayISO = dateISOInTimeZone(new Date(), settings.timezone);
    return suggestObligationPlan({
      obligationTotal: current.totalAmount,
      priority: current.priority,
      monthlyIncome: settings.monthlyIncome,
      monthlyCap: settings.monthlyCap,
      existingMonthlyLoad: 0,
      salaryDay: settings.salaryDay,
      todayISO,
    });
  }, [settings, current]);

  useEffect(() => {
    if (!settings || !current) return;
    const todayISO = dateISOInTimeZone(new Date(), settings.timezone);
    setMode('suggested');
    setError(null);

    setOneTimeAmountRaw(String(current.totalAmount));
    setOneTimeDueISO(todayISO);

    setMonthlyAmountRaw(String(Math.max(50_000, Math.round(current.totalAmount / 6))));
    setMonthlyDueDayRaw(String(settings.salaryDay));
    setMonthlyStartMonthISO(todayISO.slice(0, 7) + '-01');

    setSplitUpfrontAmountRaw(String(Math.round(current.totalAmount * 0.3)));
    setSplitUpfrontDueISO(todayISO);
    setSplitMonthlyAmountRaw(String(Math.max(50_000, Math.round(current.totalAmount / 9))));
    setSplitDueDayRaw(String(settings.salaryDay));
    setSplitStartMonthISO(todayISO.slice(0, 7) + '-01');
  }, [settings, current, idx]);

  if (!settings) return null;

  if (!current) {
    return (
      <Modal title="Plan your obligations" description="All planned" onClose={onClose}>
        <div className="card soft">
          <div className="small muted">You're done. All obligations have a plan.</div>
        </div>
        <div className="cta-row">
          <button className="pill primary" onClick={onClose}>Close</button>
        </div>
      </Modal>
    );
  }

  async function saveAndNext(plan: ObligationPlan) {
    if (!current) return;
    setIsSaving(true);
    setError(null);
    try {
      await scheduleObligation(current.id, plan);
      const nextIdx = idx + 1;
      if (nextIdx >= obligations.length) onClose();
      else setIdx(nextIdx);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan.');
    } finally {
      setIsSaving(false);
    }
  }

  function planFromSuggested(): ObligationPlan | null {
    if (!suggestion || suggestion.kind === 'NONE') return null;
    if (suggestion.kind === 'ONE_TIME') return { type: 'one_time', amount: suggestion.amount, dueDateISO: suggestion.dueDateISO };
    if (suggestion.kind === 'MONTHLY') return { type: 'monthly', monthlyAmount: suggestion.monthlyAmount, dueDay: suggestion.dueDay, startMonthISO: suggestion.startMonthISO };
    return {
      type: 'split',
      upfrontAmount: suggestion.upfrontAmount,
      upfrontDueISO: suggestion.upfrontDueISO,
      monthlyAmount: suggestion.monthlyAmount,
      dueDay: suggestion.dueDay,
      startMonthISO: suggestion.startMonthISO,
    };
  }

  return (
    <Modal title="Plan your obligations" description={`${idx + 1} of ${obligations.length} · ${priorityLabel(current.priority)}`} onClose={onClose}>
      <div className="card soft" style={{ marginBottom: 12 }}>
        <div style={{ fontWeight: 700 }}>{current.name}</div>
        <div className="small muted">Remaining: <span className="num">{formatCompactVND(current.totalAmount)}</span> VND</div>
      </div>

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 12 }}>
        <button className={`pill ${mode === 'suggested' ? 'primary' : ''}`} onClick={() => setMode('suggested')}>Suggested</button>
        <button className={`pill ${mode === 'one_time' ? 'primary' : ''}`} onClick={() => setMode('one_time')}>One-time</button>
        <button className={`pill ${mode === 'monthly' ? 'primary' : ''}`} onClick={() => setMode('monthly')}>Monthly</button>
        <button className={`pill ${mode === 'split' ? 'primary' : ''}`} onClick={() => setMode('split')}>Split</button>
      </div>

      {mode === 'suggested' ? (
        <div className="card soft">
          {!suggestion ? (
            <div className="small muted">Add monthly income to unlock suggestions.</div>
          ) : suggestion.kind === 'NONE' ? (
            <div className="small muted">{suggestion.reason}</div>
          ) : (
            <>
              <div className="small muted">Suggested plan</div>
              <div style={{ fontWeight: 700, marginTop: 6 }}>
                {suggestion.kind === 'ONE_TIME' ? `One-time ${formatCompactVND(suggestion.amount)} on ${suggestion.dueDateISO}` : null}
                {suggestion.kind === 'MONTHLY' ? `Monthly ${formatCompactVND(suggestion.monthlyAmount)} on day ${suggestion.dueDay}` : null}
                {suggestion.kind === 'SPLIT' ? `Split: upfront ${formatCompactVND(suggestion.upfrontAmount)} then ${formatCompactVND(suggestion.monthlyAmount)}/mo` : null}
              </div>
              <div className="small muted" style={{ marginTop: 8 }}>Clears in ~{suggestion.clearsInMonths} months.</div>
              <button className="pill primary" style={{ marginTop: 12 }} onClick={() => {
                const p = planFromSuggested();
                if (p) void saveAndNext(p);
              }} disabled={isSaving}>Accept suggested</button>
            </>
          )}
        </div>
      ) : null}

      {mode === 'one_time' ? (
        <div className="card soft">
          <label className="small muted">Amount (VND)</label>
          <input className="input num" value={oneTimeAmountRaw} onChange={(e) => setOneTimeAmountRaw(e.target.value)} />
          <label className="small muted" style={{ marginTop: 8, display: 'block' }}>Due date</label>
          <input className="input num" type="date" value={oneTimeDueISO} onChange={(e) => setOneTimeDueISO(e.target.value)} />
          <button className="pill primary" style={{ marginTop: 12 }} onClick={() => void saveAndNext({ type: 'one_time', amount: Number(oneTimeAmountRaw), dueDateISO: oneTimeDueISO })} disabled={isSaving}>Save & next</button>
        </div>
      ) : null}

      {mode === 'monthly' ? (
        <div className="card soft">
          <label className="small muted">Monthly amount (VND)</label>
          <input className="input num" value={monthlyAmountRaw} onChange={(e) => setMonthlyAmountRaw(e.target.value)} />
          <div className="onboarding-grid" style={{ marginTop: 8 }}>
            <div>
              <label className="small muted">Due day (1-28)</label>
              <input className="input num" value={monthlyDueDayRaw} onChange={(e) => setMonthlyDueDayRaw(e.target.value)} />
            </div>
            <div>
              <label className="small muted">Start month</label>
              <input className="input num" type="month" value={monthlyStartMonthISO.slice(0, 7)} onChange={(e) => setMonthlyStartMonthISO(`${e.target.value}-01`)} />
            </div>
          </div>
          <button className="pill primary" style={{ marginTop: 12 }} onClick={() => void saveAndNext({ type: 'monthly', monthlyAmount: Number(monthlyAmountRaw), dueDay: clampDay(Number(monthlyDueDayRaw)), startMonthISO: monthlyStartMonthISO })} disabled={isSaving}>Save & next</button>
        </div>
      ) : null}

      {mode === 'split' ? (
        <div className="card soft">
          <label className="small muted">Upfront amount (VND)</label>
          <input className="input num" value={splitUpfrontAmountRaw} onChange={(e) => setSplitUpfrontAmountRaw(e.target.value)} />
          <label className="small muted" style={{ marginTop: 8, display: 'block' }}>Upfront due date</label>
          <input className="input num" type="date" value={splitUpfrontDueISO} onChange={(e) => setSplitUpfrontDueISO(e.target.value)} />
          <label className="small muted" style={{ marginTop: 8, display: 'block' }}>Monthly amount (VND)</label>
          <input className="input num" value={splitMonthlyAmountRaw} onChange={(e) => setSplitMonthlyAmountRaw(e.target.value)} />
          <div className="onboarding-grid" style={{ marginTop: 8 }}>
            <div>
              <label className="small muted">Due day (1-28)</label>
              <input className="input num" value={splitDueDayRaw} onChange={(e) => setSplitDueDayRaw(e.target.value)} />
            </div>
            <div>
              <label className="small muted">Start month</label>
              <input className="input num" type="month" value={splitStartMonthISO.slice(0, 7)} onChange={(e) => setSplitStartMonthISO(`${e.target.value}-01`)} />
            </div>
          </div>
          <button className="pill primary" style={{ marginTop: 12 }} onClick={() => void saveAndNext({
            type: 'split',
            upfrontAmount: Number(splitUpfrontAmountRaw),
            upfrontDueISO: splitUpfrontDueISO,
            monthlyAmount: Number(splitMonthlyAmountRaw),
            dueDay: clampDay(Number(splitDueDayRaw)),
            startMonthISO: splitStartMonthISO,
          })} disabled={isSaving}>Save & next</button>
        </div>
      ) : null}

      {error ? <div className="onboarding-error">{error}</div> : null}
    </Modal>
  );
}
