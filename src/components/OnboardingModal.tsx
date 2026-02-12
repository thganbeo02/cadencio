import { useMemo, useState } from 'react';
import { db } from '../db/database';
import { useAppStore } from '../stores/useAppStore';
import type { ObligationPriority } from '../types';
import { makeId } from '../utils/id';

function clampDay(d: number): number {
  return Math.min(28, Math.max(1, d));
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
  const [selectedTier, setSelectedTier] = useState<1 | 2 | 3 | null>(null);

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

  const obligationsSum = cleanedObligations.reduce((sum, o) => sum + (o.amount || DEFAULT_OBLIGATION), 0);
  const smallestObligation = cleanedObligations.length
    ? Math.min(...cleanedObligations.map((o) => o.amount || DEFAULT_OBLIGATION))
    : 0;

  const selfDebt = useMemo(() => {
    const n = Number(selfDebtRaw);
    return Number.isFinite(n) && n > 0 ? Math.round(n) : 0;
  }, [selfDebtRaw]);

  const tiers = useMemo(() => {
    if (selfDebt > 0) {
      const tier2 = selfDebt;
      const tier3 = selfDebt + 100_000_000;
      const baseTier1 = smallestObligation > 0 ? smallestObligation + 5_000_000 : 30_000_000;
      const tier1 = Math.min(Math.max(30_000_000, baseTier1), tier2);
      return { tier1, tier2, tier3 };
    }

    const baseline = cap > 0 ? cap : DEFAULT_CAP;
    return {
      tier1: baseline * 3,
      tier2: baseline * 6,
      tier3: baseline * 12,
    };
  }, [selfDebt, cap, smallestObligation]);

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
    if (!selectedTier) throw new Error('Pick a quest to continue.');

    const targetAmount = selectedTier === 1 ? tiers.tier1 : selectedTier === 2 ? tiers.tier2 : tiers.tier3;
    const name = selectedTier === 1 ? 'First Shield' : selectedTier === 2 ? 'The Reckoning' : "Cadencio's Ambition";
    const questId = makeId('quest');

    await db.transaction('rw', db.quests, db.settings, async () => {
      await db.quests.add({ id: questId, name, targetAmount, createdAt: Date.now() });
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
                    Reset Day
                  </label>
                  <div className="onboarding-input-icon">
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M8 2v4" />
                      <path d="M16 2v4" />
                      <rect width="18" height="18" x="3" y="4" rx="2" />
                      <path d="M3 10h18" />
                    </svg>
                    <input
                      id="resetDay"
                      type="number"
                      className="onboarding-input-field num"
                      value={salaryDayRaw}
                      onChange={(e) => setSalaryDayRaw(e.target.value)}
                    />
                  </div>
                  <p className="onboarding-helper">When your monthly spending budget resets</p>
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
                <div className="onboarding-quest-grid">
                  {[1, 2, 3].map((tier) => (
                    <button
                      key={tier}
                      className={`onboarding-quest-card ${selectedTier === tier ? 'active' : ''}`}
                      onClick={() => setSelectedTier(tier as 1 | 2 | 3)}
                    >
                      {tier === 2 ? <div className="quest-badge">Recommended</div> : null}
                      <div className="quest-icon">
                        {tier === 1 ? (
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                            <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                          </svg>
                        ) : tier === 2 ? (
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
                      <h3>{tier === 1 ? 'First Shield' : tier === 2 ? 'The Reckoning' : "Cadencio's Ambition"}</h3>
                      <p>
                        {tier === 1
                          ? 'Build your emergency fund foundation'
                          : tier === 2
                            ? 'Tackle your highest-priority debt'
                            : 'Complete financial independence'}
                      </p>
                      <div className="quest-meta">
                        <div>
                          <span>Target</span>
                          <strong>{formatCompactVND(tier === 1 ? tiers.tier1 : tier === 2 ? tiers.tier2 : tiers.tier3)} VND</strong>
                        </div>
                        <div>
                          <span>Est. Timeline</span>
                          <strong>{tier === 1 ? '3 months' : tier === 2 ? '8 months' : '18 months'}</strong>
                        </div>
                      </div>
                    </button>
                  ))}
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
          {step === 3 ? (
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
              <button className="onboarding-primary" onClick={() => void next()} disabled={isSaving}>
                {step === 5 ? 'Finish' : 'Next'}
              </button>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}
