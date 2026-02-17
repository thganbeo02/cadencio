import { useEffect, useMemo, useState } from 'react';
import { db } from '../db/database';
import { useAppStore } from '../stores/useAppStore';
import type { ObligationPriority } from '../types';
import { makeId } from '../utils/id';

function clampDay(d: number): number {
  return Math.min(30, Math.max(0, d));
}

function safeInt(raw: string, fallback: number): number {
  const n = Number(raw);
  if (!Number.isFinite(n)) return fallback;
  return Math.round(n);
}

function formatCompactVND(amount: number): string {
  if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(1) + 'B';
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(0) + 'M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(0) + 'K';
  return String(Math.round(amount));
}

function formatNumberWithCommas(value: number): string {
  const n = Math.round(value);
  if (!Number.isFinite(n)) return '0';
  return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, '');
}

type Step = 1 | 2 | 3 | 4 | 5;

type DraftObligation = {
  id: string;
  name: string;
  amountRaw: string;
  priority: ObligationPriority;
};

type QuestKind = 'debt_cut' | 'earned_climb' | 'recovery_map';
type QuestTier = 1 | 2 | 3;

const DEFAULT_INCOME = 10_000_000;
const DEFAULT_CAP = 15_000_000;
const DEFAULT_OBLIGATION = 1_000_000;

export function OnboardingModal() {
  const { settings, updateSettings, setFocusMode } = useAppStore();
  const [step, setStep] = useState<Step>(1);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [incomeRaw, setIncomeRaw] = useState('');
  const [salaryDayRaw, setSalaryDayRaw] = useState('15');
  const [capRaw, setCapRaw] = useState(String(DEFAULT_CAP));

  const [drafts, setDrafts] = useState<DraftObligation[]>([
    { id: makeId('obl'), name: '', amountRaw: '', priority: 1 },
  ]);

  const [selfDebtRaw, setSelfDebtRaw] = useState('');
  const [activeQuestKind, setActiveQuestKind] = useState<QuestKind>('earned_climb');
  const [selectedQuest, setSelectedQuest] = useState<{ kind: QuestKind; tier: QuestTier } | null>(null);

  const income = useMemo(() => {
    const n = Number(incomeRaw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }, [incomeRaw]);

  const cap = useMemo(() => {
    const n = Number(capRaw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }, [capRaw]);

  const costPerHour = income > 0 ? income / 160 : 0;
  const dailyCap = cap > 0 ? cap / 30 : 0;
  const incomeDisplay = incomeRaw ? formatNumberWithCommas(Number(incomeRaw)) : '';
  const capDisplay = capRaw ? formatNumberWithCommas(Number(capRaw)) : '';
  const selfDebtDisplay = selfDebtRaw ? formatNumberWithCommas(Number(selfDebtRaw)) : '';
  const costPerHourDisplay = formatNumberWithCommas(costPerHour > 0 ? costPerHour : DEFAULT_INCOME / 160);
  const salaryDayValue = safeInt(salaryDayRaw, -1);
  const isSalaryDayValid = Number.isFinite(salaryDayValue) && salaryDayValue >= 0 && salaryDayValue <= 30;

  const cleanedObligations = useMemo(() => {
    return drafts
      .map((d) => ({
        id: d.id,
        name: d.name.trim(),
        amount: safeInt(d.amountRaw, 0),
        priority: d.priority,
      }))
      .filter((d) => d.name.length > 0);
  }, [drafts]);

  const hasObligationAmount = useMemo(() => {
    return drafts.some((d) => digitsOnly(d.amountRaw).length > 0);
  }, [drafts]);

  const obligationsSum = cleanedObligations.reduce((sum, o) => sum + (o.amount || DEFAULT_OBLIGATION), 0);
  const smallestObligation = cleanedObligations.length
    ? Math.min(...cleanedObligations.map((o) => o.amount || DEFAULT_OBLIGATION))
    : 0;

  const selfDebt = useMemo(() => {
    const n = Number(selfDebtRaw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }, [selfDebtRaw]);

  const questOptions = useMemo(() => {
    const effectiveIncome = income > 0 ? income : DEFAULT_INCOME;
    const effectiveCap = cap > 0 ? cap : DEFAULT_CAP;
    const surplus = Math.max(0, effectiveIncome - effectiveCap);
    const safeSurplus = Math.max(1_000_000, surplus);

    const baseDebt = Math.max(obligationsSum, DEFAULT_OBLIGATION);
    const debtTier1 = Math.max(0, Math.round(baseDebt * 0.2));
    const debtTier2 = Math.max(0, Math.round(baseDebt * 0.5));
    const debtTier3 = baseDebt;

    const earnedTier1 = safeSurplus * 1;
    const earnedTier2 = safeSurplus * 3;
    const earnedTier3 = safeSurplus * 6;

    const recoveryBaseDebt = Math.max(selfDebt || 0, obligationsSum, DEFAULT_OBLIGATION);
    const recoveryTier1 = recoveryBaseDebt + safeSurplus * 1;
    const recoveryTier2 = recoveryBaseDebt + safeSurplus * 3;
    const recoveryTier3 = recoveryBaseDebt + safeSurplus * 6;

    const canEstimate = income > 0 && cap > 0 && income > cap;
    const estimateMonths = (target: number) => (canEstimate ? Math.max(1, Math.ceil(target / safeSurplus)) : undefined);

    return {
      debt_cut: [
        {
          kind: 'debt_cut' as const,
          tier: 1 as const,
          title: 'First Cut',
          subtitle: 'Shrink what you owe fast',
          targetAmount: debtTier1,
          targetLabel: 'Target debt cleared',
          ruleTag: 'Debt Only',
          description: 'Progress only moves when you confirm obligation payments.',
          etaMonths: estimateMonths(debtTier1),
        },
        {
          kind: 'debt_cut' as const,
          tier: 2 as const,
          title: 'Half the Monster',
          subtitle: 'Cut total debt in half',
          targetAmount: debtTier2,
          targetLabel: 'Target debt cleared',
          ruleTag: 'Debt Only',
          description: 'A medium-length grind focused on pure debt reduction.',
          etaMonths: estimateMonths(debtTier2),
        },
        {
          kind: 'debt_cut' as const,
          tier: 3 as const,
          title: 'Debt Zero',
          subtitle: 'Close every obligation fully',
          targetAmount: debtTier3,
          targetLabel: 'Target debt cleared',
          ruleTag: 'Debt Only',
          description: 'Finish the loop completely. No obligations left standing.',
          etaMonths: estimateMonths(debtTier3),
        },
      ],
      earned_climb: [
        {
          kind: 'earned_climb' as const,
          tier: 1 as const,
          title: 'Surplus Month',
          subtitle: 'Prove one strong month of earned net',
          targetAmount: earnedTier1,
          targetLabel: 'Target earned net',
          ruleTag: 'Earned Net',
          description: 'Borrowed cash never advances this ring.',
          etaMonths: estimateMonths(earnedTier1),
        },
        {
          kind: 'earned_climb' as const,
          tier: 2 as const,
          title: 'Quarter-Year',
          subtitle: 'Three months of surplus momentum',
          targetAmount: earnedTier2,
          targetLabel: 'Target earned net',
          ruleTag: 'Earned Net',
          description: 'A balanced climb that rewards consistency.',
          etaMonths: estimateMonths(earnedTier2),
        },
        {
          kind: 'earned_climb' as const,
          tier: 3 as const,
          title: 'Half-Year',
          subtitle: 'Six months of surplus earned',
          targetAmount: earnedTier3,
          targetLabel: 'Target earned net',
          ruleTag: 'Earned Net',
          description: 'A serious commitment to sustained surplus.',
          etaMonths: estimateMonths(earnedTier3),
        },
      ],
      recovery_map: [
        {
          kind: 'recovery_map' as const,
          tier: 1 as const,
          title: 'Break Even',
          subtitle: 'Debt cleared on paper, clean slate',
          targetAmount: recoveryTier1,
          targetLabel: 'Target recovery score',
          ruleTag: 'Full Map',
          description: 'Score rises with earned net and debt cleared.',
          etaMonths: estimateMonths(recoveryTier1),
        },
        {
          kind: 'recovery_map' as const,
          tier: 2 as const,
          title: 'Safe Ground',
          subtitle: 'Debt cleared plus 3 month buffer',
          targetAmount: recoveryTier2,
          targetLabel: 'Target recovery score',
          ruleTag: 'Full Map',
          description: 'Add a safety buffer after clearing the debt line.',
          etaMonths: estimateMonths(recoveryTier2),
        },
        {
          kind: 'recovery_map' as const,
          tier: 3 as const,
          title: 'Shielded',
          subtitle: 'Debt cleared plus 6 month runway',
          targetAmount: recoveryTier3,
          targetLabel: 'Target recovery score',
          ruleTag: 'Full Map',
          description: 'Aim for stability beyond recovery.',
          etaMonths: estimateMonths(recoveryTier3),
        },
      ],
      metadata: {
        baseDebt,
        recoveryBaseDebt,
        shadowDebt: Math.max(0, (selfDebt || 0) - obligationsSum),
        effectiveCap,
        canEstimate,
      },
    };
  }, [cap, income, obligationsSum, selfDebt]);

  useEffect(() => {
    if (step !== 5) return;
    setSelectedQuest((current) => {
      if (current?.kind === activeQuestKind) return current;
      return { kind: activeQuestKind, tier: 2 };
    });
  }, [activeQuestKind, step]);

  async function saveStep1(skip: boolean) {
    if (!settings) return;
    const nextIncome = skip ? undefined : (income > 0 ? income : DEFAULT_INCOME);
    await updateSettings({ monthlyIncome: nextIncome });
  }

  async function saveStep2() {
    if (!settings) return;
    const salaryDay = clampDay(safeInt(salaryDayRaw, settings.salaryDay));
    const monthlyCap = safeInt(capRaw, settings.monthlyCap) || DEFAULT_CAP;
    await updateSettings({ salaryDay, monthlyCap });
  }

  async function saveStep3() {
    if (!settings) return;
    if (cleanedObligations.length === 0) return;

    await db.transaction('rw', db.obligations, async () => {
      for (const o of cleanedObligations) {
        const amount = o.amount > 0 ? o.amount : DEFAULT_OBLIGATION;
        await db.obligations.add({
          id: makeId('obl'),
          name: o.name,
          totalAmount: amount,
          priority: o.priority,
          cycles: [],
        });
      }
    });
  }

  async function saveStep4(skip: boolean) {
    if (!settings) return;
    const nextDebt = skip ? undefined : (selfDebt > 0 ? selfDebt : DEFAULT_INCOME);
    await updateSettings({ selfReportedDebt: nextDebt });
  }

  async function saveStep5() {
    if (!settings) return;
    if (!selectedQuest) throw new Error('Pick a quest to continue.');

    const options = questOptions[selectedQuest.kind];
    const selectedOption = options.find((opt) => opt.tier === selectedQuest.tier);
    if (!selectedOption) throw new Error('Pick a quest to continue.');

    const modeLabel = selectedQuest.kind === 'debt_cut'
      ? 'Debt Cut'
      : selectedQuest.kind === 'earned_climb'
        ? 'Earned Climb'
        : 'Recovery Map';
    const name = `${modeLabel}: ${selectedOption.title}`;
    const baselineAmount = selectedQuest.kind === 'debt_cut'
      ? questOptions.metadata.baseDebt
      : selectedQuest.kind === 'recovery_map'
        ? questOptions.metadata.recoveryBaseDebt
        : 0;
    const shadowDebt = selectedQuest.kind === 'recovery_map' ? questOptions.metadata.shadowDebt : 0;
    const questId = makeId('quest');

    await db.transaction('rw', db.quests, db.settings, async () => {
      await db.quests.add({
        id: questId,
        name,
        targetAmount: selectedOption.targetAmount,
        createdAt: Date.now(),
        kind: selectedQuest.kind,
        tier: selectedQuest.tier,
        baselineAmount,
        shadowDebt,
      });
      await db.settings.update('settings', { activeQuestId: questId, onboardingCompletedAt: Date.now() });
    });
  }

  async function next() {
    if (!settings) return;
    setIsSaving(true);
    setError(null);
    try {
      if (step === 1) {
        await saveStep1(false);
        setStep(2);
        return;
      }
      if (step === 2) {
        await saveStep2();
        setStep(3);
        return;
      }
      if (step === 3) {
        await saveStep3();
        setStep(4);
        return;
      }
      if (step === 4) {
        await saveStep4(false);
        setStep(5);
        return;
      }
      if (step === 5) {
        await saveStep5();
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setIsSaving(false);
    }
  }

  async function skip() {
    if (!settings) return;
    setIsSaving(true);
    setError(null);
    try {
      if (step === 1) {
        await saveStep1(true);
        setStep(2);
        return;
      }
      if (step === 4) {
        await saveStep4(true);
        setStep(5);
      }
    } catch {
      setError('Failed to skip.');
    } finally {
      setIsSaving(false);
    }
  }

  if (!settings) return null;

  const questTabs: Array<{ kind: QuestKind; label: string; hint: string }> = [
    { kind: 'debt_cut', label: 'Debt Cut', hint: 'Reduce what you owe' },
    { kind: 'earned_climb', label: 'Earned Climb', hint: 'Build earned net' },
    { kind: 'recovery_map', label: 'Recovery Map', hint: 'Debt + surplus journey' },
  ];

  const activeOptions = questOptions[activeQuestKind];

  return (
    <div className="onboarding-overlay">
      <div className={`onboarding-card ${step === 5 ? 'step-5' : ''}`}>
        <div className="onboarding-top">
          <div className="onboarding-step">Step {step} of 5</div>
          <div className="onboarding-dots">
            {Array.from({ length: 5 }).map((_, i) => (
              <span key={i} className={`dot ${i + 1 === step ? 'active' : ''}`} />
            ))}
          </div>
        </div>

        <div className="onboarding-body">
          {step === 1 ? (
            <>
              <div className="onboarding-center">
                <h2 className="onboarding-title">What comes in?</h2>
                <p className="onboarding-subtitle">Used to estimate cost-per-hour. We don't connect to banks.</p>
              </div>

              <div className="onboarding-section">
                <div className="onboarding-field">
                  <label className="onboarding-label-row" htmlFor="income">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="2" x2="12" y2="22" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Monthly Income
                  </label>
                  <div className="onboarding-input-icon">
                    <span className="onboarding-input-prefix">VND</span>
                    <input
                      id="income"
                      type="text"
                      inputMode="numeric"
                      className="onboarding-input-field num has-prefix"
                      placeholder="10,000,000"
                      value={incomeDisplay}
                      onChange={(e) => setIncomeRaw(digitsOnly(e.target.value))}
                    />
                  </div>
                </div>

                <div className="onboarding-info-card">
                  <div className="info-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <path d="M12 16v-4" />
                      <path d="M12 8h.01" />
                    </svg>
                  </div>
                  <div className="info-content">
                    <div className="info-title">
                      <span>Cost-per-hour:</span>
                      <span className="info-value num">{costPerHourDisplay} VND</span>
                    </div>
                    <p className="info-note">Calculated as income ÷ 160 (editable later)</p>
                  </div>
                </div>

                <div className="onboarding-footnote">This helps you see purchases in "hours worked"</div>
              </div>
            </>
          ) : null}

          {step === 2 ? (
            <>
              <div className="onboarding-center">
                <h2 className="onboarding-title">Set your rhythm</h2>
                <p className="onboarding-subtitle">Define your spending cycle and protective boundaries</p>
              </div>

              <div className="onboarding-section">
                <div className="onboarding-field">
                  <label className="onboarding-label-row" htmlFor="resetDay">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 2v4" />
                      <path d="M16 2v4" />
                      <rect width="18" height="18" x="3" y="4" rx="2" />
                      <path d="M3 10h18" />
                    </svg>
                    Reset Day - When your monthly spending budget resets
                  </label>
                  <div className="onboarding-input-icon">
                    <input
                      id="resetDay"
                      type="number"
                      className="onboarding-input-field num"
                      value={salaryDayRaw}
                      onChange={(e) => setSalaryDayRaw(e.target.value)}
                    />
                  </div>
                  {!isSalaryDayValid ? (
                    <p className="onboarding-helper">Enter a date between 0 to 30!</p>
                  ) : null}
                </div>

                <div className="onboarding-field">
                  <label className="onboarding-label-row" htmlFor="spendingCap">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <line x1="12" y1="2" x2="12" y2="22" />
                      <path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6" />
                    </svg>
                    Monthly Spending Cap
                  </label>
                  <div className="onboarding-input-icon">
                    <span className="onboarding-input-prefix">VND</span>
                    <input
                      id="spendingCap"
                      type="text"
                      inputMode="numeric"
                      className="onboarding-input-field num has-prefix"
                      value={capDisplay}
                      onChange={(e) => setCapRaw(digitsOnly(e.target.value))}
                    />
                  </div>
                  <p className="onboarding-helper">~ {formatNumberWithCommas(dailyCap > 0 ? dailyCap : DEFAULT_CAP / 30)} VND per day</p>
                </div>

                <div className="onboarding-toggle-list">
                  <div className="onboarding-toggle-card">
                    <div className="onboarding-toggle-text">
                      <div className="onboarding-toggle-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                        </svg>
                        Friction Screen
                      </div>
                      <div className="onboarding-toggle-desc">Pause before purchases: "Is this Need or Growth?"</div>
                    </div>
                    <button
                      className={`onboarding-switch ${settings.frictionEnabled ? 'is-on' : ''}`}
                      role="switch"
                      aria-checked={settings.frictionEnabled}
                      onClick={() => void updateSettings({ frictionEnabled: !settings.frictionEnabled })}
                    >
                      <span className="onboarding-switch-thumb" />
                    </button>
                  </div>

                  <div className="onboarding-toggle-card">
                    <div className="onboarding-toggle-text">
                      <div className="onboarding-toggle-title">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <path d="M2.062 12.348a1 1 0 0 1 0-.696 10.75 10.75 0 0 1 19.876 0 1 1 0 0 1 0 .696 10.75 10.75 0 0 1-19.876 0" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        Focus Mode
                      </div>
                      <div className="onboarding-toggle-desc">Hide currency symbols on passive screens</div>
                    </div>
                    <button
                      className={`onboarding-switch ${settings.focusMode ? 'is-on' : ''}`}
                      role="switch"
                      aria-checked={settings.focusMode}
                      onClick={() => setFocusMode(!settings.focusMode)}
                    >
                      <span className="onboarding-switch-thumb" />
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}

          {step === 3 ? (
            <>
              <div className="onboarding-center">
                <h2 className="onboarding-title">Who do you owe?</h2>
                <p className="onboarding-subtitle">List your debts and obligations</p>
              </div>

              <div className="onboarding-section">
                <div className="onboarding-obligations">
                  <div className="onboarding-obligation-card">
                    {drafts.map((d) => (
                      <div key={d.id} className="obligation-row">
                        <div className="obligation-field">
                          <label className="obligation-label">Name / Who</label>
                          <input
                            className="obligation-input"
                            placeholder="e.g., Student Loan, Credit Card"
                            value={d.name}
                            onChange={(e) => setDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, name: e.target.value } : x))}
                          />
                        </div>
                        <div className="obligation-field narrow">
                          <label className="obligation-label">Total Owed</label>
                          <div className="obligation-input-wrap">
                            <span>VND</span>
                            <input
                              type="text"
                              inputMode="numeric"
                              className="obligation-input num"
                              placeholder="5,000"
                              value={d.amountRaw ? formatNumberWithCommas(Number(d.amountRaw)) : ''}
                              onChange={(e) => setDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, amountRaw: digitsOnly(e.target.value) } : x))}
                            />
                          </div>
                        </div>
                        <div className="obligation-field narrow">
                          <label className="obligation-label">Priority</label>
                          <div className="obligation-priority">
                            {[1, 2, 3].map((p) => (
                              <button
                                key={p}
                                className={`priority-button ${d.priority === p ? 'active' : ''} p${p}`}
                                onClick={() => setDrafts((prev) => prev.map((x) => x.id === d.id ? { ...x, priority: p as ObligationPriority } : x))}
                              >
                                P{p}
                              </button>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))}

                    <button
                      className="onboarding-add"
                      onClick={() => setDrafts((prev) => [...prev, { id: makeId('obl'), name: '', amountRaw: '', priority: 3 }])}
                    >
                      + Add another
                    </button>
                  </div>
                </div>

                <div className="onboarding-info-banner">
                  <div className="banner-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="8" x2="12" y2="12" />
                      <line x1="12" y1="16" x2="12.01" y2="16" />
                    </svg>
                  </div>
                  <p>You'll plan payment schedules after onboarding.</p>
                </div>
              </div>
            </>
          ) : null}

          {step === 4 ? (
            <>
              <div className="onboarding-center">
                <h2 className="onboarding-title">Beyond what you've listed — how deep is it?</h2>
                <p className="onboarding-subtitle">Your total debt picture (optional)</p>
              </div>

              <div className="onboarding-section">
                <div className="onboarding-field">
                  <label className="onboarding-label-row" htmlFor="totalDebt">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <polyline points="22 17 13.5 8.5 8.5 13.5 2 7" />
                      <polyline points="16 17 22 17 22 11" />
                    </svg>
                    Total Debt Amount
                  </label>
                  <div className="onboarding-input-icon">
                    <span className="onboarding-input-prefix">VND</span>
                    <input
                      id="totalDebt"
                      type="text"
                      inputMode="numeric"
                      className="onboarding-input-field num has-prefix"
                      placeholder={formatNumberWithCommas(DEFAULT_INCOME)}
                      value={selfDebtDisplay}
                      onChange={(e) => setSelfDebtRaw(digitsOnly(e.target.value))}
                    />
                  </div>
                </div>

                  <div className="onboarding-info-card" style={{ padding: 20 }}>
                    <div className="info-icon lg">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </svg>
                  </div>
                    <div className="info-content">
                      <div className="info-title" style={{ color: '#4c1d95' }}>Your data stays private</div>
                      <p className="info-note" style={{ color: '#6b7280' }}>
                        This number never leaves your device. We use local storage only — no servers, no tracking, no sharing.
                      </p>
                    </div>
                </div>

                <div className="onboarding-footnote">Knowing the full picture helps you plan your path to freedom</div>
              </div>
            </>
          ) : null}

          {step === 5 ? (
            <>
              <div className="onboarding-center">
                <h2 className="onboarding-title">Choose your quest</h2>
                <p className="onboarding-subtitle">Select your first financial milestone</p>
              </div>

              <div className="onboarding-section">
                <div className="quest-tabs">
                  {questTabs.map((tab) => (
                    <button
                      key={tab.kind}
                      className={`tab-pill ${activeQuestKind === tab.kind ? 'active' : ''}`}
                      onClick={() => setActiveQuestKind(tab.kind)}
                    >
                      <span>{tab.label}</span>
                      <span className="quest-tab-hint">{tab.hint}</span>
                    </button>
                  ))}
                </div>

                <div className="onboarding-quest-grid">
                  {activeOptions.map((option) => {
                    const isSelected = selectedQuest?.kind === option.kind && selectedQuest?.tier === option.tier;
                    const stars = `${'★'.repeat(option.tier)}${'☆'.repeat(3 - option.tier)}`;
                    return (
                      <button
                        key={`${option.kind}-${option.tier}`}
                        className={`onboarding-quest-card ${isSelected ? 'active' : ''}`}
                        onClick={() => setSelectedQuest({ kind: option.kind, tier: option.tier })}
                      >
                        {option.tier === 2 ? <div className="quest-badge">Recommended</div> : null}
                        <div className="quest-card-top">
                          <span className="quest-stars">{stars}</span>
                          <span className="quest-rule-tag">{option.ruleTag}</span>
                        </div>
                        <div className="quest-icon">
                          {option.tier === 1 ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                            </svg>
                          ) : option.tier === 2 ? (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <circle cx="12" cy="12" r="10" />
                              <circle cx="12" cy="12" r="6" />
                              <circle cx="12" cy="12" r="2" />
                            </svg>
                          ) : (
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                              <path d="M11.562 3.266a.5.5 0 0 1 .876 0L15.39 8.87a1 1 0 0 0 1.516.294L21.183 5.5a.5.5 0 0 1 .798.519l-2.834 10.246a1 1 0 0 1-.956.734H5.81a1 1 0 0 1-.957-.734L2.02 6.02a.5.5 0 0 1 .798-.519l4.276 3.664a1 1 0 0 0 1.516-.294z" />
                              <path d="M5 21h14" />
                            </svg>
                          )}
                        </div>
                        <h3>{option.title}</h3>
                        <p>{option.subtitle}. {option.description}</p>
                        <div className="quest-meta">
                          <div>
                            <span>{option.targetLabel}</span>
                            <strong>{formatCompactVND(option.targetAmount)} VND</strong>
                          </div>
                          <div>
                            <span>Est. Timeline</span>
                            <strong>{option.etaMonths ? `${option.etaMonths}-${option.etaMonths + 1} months` : questOptions.metadata.canEstimate ? '—' : 'Add income + cap'}</strong>
                          </div>
                        </div>
                        {!questOptions.metadata.canEstimate ? (
                          <div className="quest-warning">Add income and cap to get accurate estimates.</div>
                        ) : null}
                      </button>
                    );
                  })}
                </div>
                <div className="onboarding-footnote">You can change your quest anytime from the dashboard</div>
              </div>
            </>
          ) : null}

          {error ? <div className="onboarding-error">{error}</div> : null}
        </div>

        <div className="onboarding-footer">
          <div className="footer-left">
            {step > 1 ? (
              <button className="onboarding-ghost" onClick={() => setStep((step - 1) as Step)}>Back</button>
            ) : null}
          </div>
          {step === 3 && hasObligationAmount ? (
            <div className="footer-middle">
              Total Obligations: <span className="num">{formatNumberWithCommas(obligationsSum)}</span> VND
            </div>
          ) : null}
          <div className="footer-right">
            {step === 1 ? (
              <div className="onboarding-action-group">
                <button className="onboarding-ghost" onClick={() => void skip()} disabled={isSaving}>Skip — add later</button>
                <button className="onboarding-primary" onClick={() => void next()} disabled={isSaving}>Next</button>
              </div>
            ) : null}
            {step === 4 ? (
              <div className="onboarding-action-group">
                <button className="onboarding-ghost" onClick={() => void skip()} disabled={isSaving}>Skip — set later from dashboard</button>
                <button className="onboarding-primary" onClick={() => void next()} disabled={isSaving}>Next</button>
              </div>
            ) : null}
            {step !== 1 && step !== 4 ? (
              <button className="onboarding-primary" onClick={() => void next()} disabled={isSaving || (step === 2 && !isSalaryDayValid)}>
                {step === 5 ? 'Finish' : 'Next'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
