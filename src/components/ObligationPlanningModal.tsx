import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/database';
import type { Obligation, ObligationPriority } from '../types';
import { useAppStore } from '../stores/useAppStore';
import { Modal } from './Modal';
import { scheduleObligation, type ObligationPlan } from '../services/obligations';
import { suggestObligationPlan } from '../services/obligationSuggestion';
import { dateISOInTimeZone } from '../utils/dates';

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

function formatNumberWithCommas(value: number | string, allowZero = false): string {
  const s = typeof value === 'number' ? Math.round(value).toString() : digitsOnly(value);
  if (s === '0' && !allowZero) return '';
  if (!s) return '';
  return s.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function clampDay(d: number): number {
  return Math.min(28, Math.max(1, Math.round(d)));
}

function priorityLabel(p: ObligationPriority): string {
  return p === 1 ? 'P1 Critical' : p === 2 ? 'P2 High' : 'P3 Standard';
}

function CurrencyInput({
  label,
  value,
  onChange,
  placeholder,
}: {
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="onboarding-field">
      <label className="onboarding-label">{label}</label>
      <div className="onboarding-input-icon">
        <span className="onboarding-input-prefix">VND</span>
        <input
          type="text"
          inputMode="numeric"
          className="onboarding-input-field num has-prefix"
          placeholder={placeholder}
          value={formatNumberWithCommas(value)}
          onChange={(e) => onChange(digitsOnly(e.target.value))}
        />
      </div>
    </div>
  );
}

export function ObligationPlanningModal({ onClose }: { onClose: () => void }) {
  const { settings } = useAppStore();
  const [obligations, setObligations] = useState<Obligation[] | null>(null);
  const [idx, setIdx] = useState(0);
  const [mode, setMode] = useState<'one_time' | 'monthly' | 'split'>('monthly');
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // AI Copilot state
  const [aiText, setAiText] = useState('');
  const [activeChip, setActiveChip] = useState('Best plan');

  // Manual input fields
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
      all.sort((a, b) => b.totalAmount - a.totalAmount);
      return all.filter((o) => o.totalAmount > 0 && o.cycles.length === 0);
    }).subscribe((res) => {
      setObligations(res);
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (!obligationsList.length) return;
    if (idx >= obligationsList.length) {
      setIdx(Math.max(0, obligationsList.length - 1));
    }
  }, [idx, obligationsList.length]);

  const obligationsList = obligations ?? [];
  const current = obligationsList[idx] ?? null;

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
    
    // Default mode based on suggestion
    if (suggestion?.kind === 'ONE_TIME') setMode('one_time');
    else if (suggestion?.kind === 'SPLIT') setMode('split');
    else setMode('monthly');

    setError(null);
    setAiText('');

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
  }, [settings, current, idx, suggestion?.kind]);

  if (!settings || obligations === null) {
    return (
      <Modal title="Plan your obligations" description="Loading..." onClose={onClose} cardClassName="planning-card">
        <div className="planning-body" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <div className="text-center">
            <div className="small muted">Syncing your ledger...</div>
          </div>
        </div>
      </Modal>
    );
  }

  if (obligationsList.length === 0) {
    return (
      <Modal title="Plan your obligations" description="All planned" onClose={onClose} cardClassName="planning-card">
        <div className="planning-body" style={{ display: 'grid', placeItems: 'center', height: '100%' }}>
          <div className="text-center">
            <div style={{ fontSize: 40, marginBottom: 16 }}>🛡️</div>
            <div className="planning-header-title">Everything is planned</div>
            <div className="small muted" style={{ marginTop: 8 }}>All your obligations have payment schedules.</div>
            <button className="onboarding-primary" style={{ marginTop: 24 }} onClick={onClose}>Back to Dashboard</button>
          </div>
        </div>
      </Modal>
    );
  }

  if (!current) {
    return (
      <Modal title="Plan your obligations" description="Error" onClose={onClose} cardClassName="planning-card">
        <div className="planning-body">
          <div className="onboarding-error">Something went wrong. Please close and try again.</div>
        </div>
      </Modal>
    );
  }

  async function saveAndNext() {
    if (!current) return;
    setIsSaving(true);
    setError(null);

    let plan: ObligationPlan;
    if (mode === 'one_time') {
      plan = { type: 'one_time', amount: Number(oneTimeAmountRaw), dueDateISO: oneTimeDueISO };
    } else if (mode === 'monthly') {
      plan = { type: 'monthly', monthlyAmount: Number(monthlyAmountRaw), dueDay: clampDay(Number(monthlyDueDayRaw)), startMonthISO: monthlyStartMonthISO };
    } else {
      plan = {
        type: 'split',
        upfrontAmount: Number(splitUpfrontAmountRaw),
        upfrontDueISO: splitUpfrontDueISO,
        monthlyAmount: Number(splitMonthlyAmountRaw),
        dueDay: clampDay(Number(splitDueDayRaw)),
        startMonthISO: splitStartMonthISO,
      };
    }

    try {
      await scheduleObligation(current.id, plan);
      if (obligationsList.length <= 1) {
        onClose();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to save plan.');
    } finally {
      setIsSaving(false);
    }
  }

  const isFirst = idx === 0;

  return (
    <Modal
      title="Plan your obligations"
      description={`${idx + 1} of ${obligationsList.length} · ${priorityLabel(current.priority)}`}
      onClose={onClose}
      cardClassName="planning-card"
      titleClassName="planning-header-title"
      descriptionClassName="planning-header-meta"
    >
      <div className="planning-body">
        {/* Summary Strip */}
        <div className="planning-summary">
          <div className="summary-left">
            <div className="summary-icon">
              {current.name.toLowerCase().includes('student') ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
                  <path d="M22 10v6M2 10l10-5 10 5-10 5z" />
                  <path d="M6 12v5c0 2 2 3 6 3s6-1 6-3v-5" />
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 24, height: 24 }}>
                  <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
                  <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
                </svg>
              )}
            </div>
            <div className="summary-info">
              <span className="summary-label">OBLIGATION</span>
              <span className="summary-name">{current.name}</span>
            </div>
          </div>
          <div className="summary-right">
            <div className="summary-label">REMAINING BALANCE</div>
            <div className="summary-name num">{formatNumberWithCommas(current.totalAmount, true)} <span style={{ fontSize: 12, opacity: 0.5 }}>VND</span></div>
          </div>
        </div>

        {/* AI Copilot */}
        <div className="copilot-section">
          <div className="copilot-head">
            <span className="copilot-label">AI Copilot ✨</span>
            <span className="copilot-beta">BETA</span>
          </div>
          <div className="copilot-input-row">
            <input
              className="copilot-input"
              placeholder="e.g., Pay this off by June, monthly under 2,000,000..."
              value={aiText}
              onChange={(e) => setAiText(e.target.value)}
            />
            <button className="copilot-apply" onClick={() => setError('AI Copilot functionality coming soon!')}>APPLY</button>
          </div>
          <div className="copilot-chips">
            {['Faster', 'Lower monthly', 'One-time', 'Split', 'Best plan'].map((chip) => (
              <button
                key={chip}
                className={`copilot-chip ${activeChip === chip ? 'active' : ''}`}
                onClick={() => {
                  setActiveChip(chip);
                  if (chip === 'Best plan' && suggestion) {
                     if (suggestion.kind === 'ONE_TIME') setMode('one_time');
                     else if (suggestion.kind === 'SPLIT') setMode('split');
                     else setMode('monthly');
                  }
                }}
              >
                {chip}
              </button>
            ))}
          </div>
        </div>

        {/* Plan Type */}
        <div className="plan-type-section">
          <span className="plan-type-label">Plan Type</span>
          <div className="plan-tabs">
            <button className={`plan-tab ${mode === 'one_time' ? 'active' : ''}`} onClick={() => setMode('one_time')}>One-time</button>
            <button className={`plan-tab ${mode === 'monthly' ? 'active' : ''}`} onClick={() => setMode('monthly')}>Monthly</button>
            <button className={`plan-tab ${mode === 'split' ? 'active' : ''}`} onClick={() => setMode('split')}>Split</button>
          </div>
        </div>

        {/* Fields */}
        <div className="planning-fields">
          {mode === 'one_time' && (
            <div className="onboarding-grid">
              <CurrencyInput
                label="Amount"
                value={oneTimeAmountRaw}
                onChange={setOneTimeAmountRaw}
                placeholder="10,000,000"
              />
              <div className="onboarding-field">
                <label className="onboarding-label">Target Date</label>
                <input className="onboarding-input-field num" type="date" value={oneTimeDueISO} onChange={(e) => setOneTimeDueISO(e.target.value)} />
              </div>
            </div>
          )}

          {mode === 'monthly' && (
            <div className="onboarding-grid" style={{ gridTemplateColumns: '1fr 0.6fr 0.8fr' }}>
              <CurrencyInput
                label="Monthly Amount"
                value={monthlyAmountRaw}
                onChange={setMonthlyAmountRaw}
                placeholder="2,000,000"
              />
              <div className="onboarding-field">
                <label className="onboarding-label">Due Day</label>
                <input className="onboarding-input-field num" value={monthlyDueDayRaw} onChange={(e) => setMonthlyDueDayRaw(e.target.value)} />
              </div>
              <div className="onboarding-field">
                <label className="onboarding-label">Start Month</label>
                <input className="onboarding-input-field num" type="month" value={monthlyStartMonthISO.slice(0, 7)} onChange={(e) => setMonthlyStartMonthISO(`${e.target.value}-01`)} />
              </div>
            </div>
          )}

          {mode === 'split' && (
            <div className="onboarding-section">
              <div className="onboarding-grid">
                <CurrencyInput
                  label="Upfront Amount"
                  value={splitUpfrontAmountRaw}
                  onChange={setSplitUpfrontAmountRaw}
                  placeholder="5,000,000"
                />
                <div className="onboarding-field">
                  <label className="onboarding-label">Upfront Date</label>
                  <input className="onboarding-input-field num" type="date" value={splitUpfrontDueISO} onChange={(e) => setSplitUpfrontDueISO(e.target.value)} />
                </div>
              </div>
              <div className="onboarding-grid" style={{ gridTemplateColumns: '1fr 0.6fr 0.8fr' }}>
                <CurrencyInput
                  label="Monthly Remainder"
                  value={splitMonthlyAmountRaw}
                  onChange={setSplitMonthlyAmountRaw}
                  placeholder="1,000,000"
                />
                <div className="onboarding-field">
                  <label className="onboarding-label">Due Day</label>
                  <input className="onboarding-input-field num" value={splitDueDayRaw} onChange={(e) => setSplitDueDayRaw(e.target.value)} />
                </div>
                <div className="onboarding-field">
                  <label className="onboarding-label">Start Month</label>
                  <input className="onboarding-input-field num" type="month" value={splitStartMonthISO.slice(0, 7)} onChange={(e) => setSplitStartMonthISO(`${e.target.value}-01`)} />
                </div>
              </div>
            </div>
          )}
        </div>

        {error ? <div className="onboarding-error" style={{ marginTop: 24 }}>{error}</div> : null}
      </div>

      {/* Footer */}
      <div className="planning-footer">
        <button
          className="onboarding-ghost"
          onClick={() => setIdx(idx - 1)}
          disabled={isFirst || isSaving}
        >
          Back
        </button>
        <div className="planning-actions">
          <button className="onboarding-ghost" onClick={() => void saveAndNext()} disabled={isSaving}>Save draft</button>
          <button className="onboarding-primary" onClick={() => void saveAndNext()} disabled={isSaving}>Confirm plan →</button>
        </div>
      </div>
    </Modal>
  );
}
