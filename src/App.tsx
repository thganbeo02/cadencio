import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { seedDatabase } from './db/seed';
import { db } from './db/database';
import { useAppStore } from './stores/useAppStore';
import { useSettingsSync } from './hooks/useSettingsSync';
import { OnboardingModal } from './components/OnboardingModal';
import { Modal } from './components/Modal';
import type { Obligation, ObligationCycle, Quest } from './types';
import { addDaysISO, dateISOInTimeZone } from './utils/dates';
import { confirmObligationPaid } from './services/obligations';

type DueRow = {
  obligation: Obligation;
  cycle: ObligationCycle;
  dueISO: string;
};

type ConfirmState = {
  obligationId: string;
  cycleId: string;
  name: string;
  plannedAmount: number;
};

function formatCompactVND(amount: number): string {
  if (amount >= 1_000_000_000) return (amount / 1_000_000_000).toFixed(1) + 'B';
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(0) + 'M';
  if (amount >= 1_000) return (amount / 1_000).toFixed(0) + 'K';
  return String(Math.round(amount));
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function formatDueLabel(nowISO: string, dueISO: string): string {
  const diff = daysBetweenISO(nowISO, dueISO);
  if (diff <= 0) return 'Due today';
  if (diff === 1) return 'Due in 1 day';
  return `Due in ${diff} days`;
}

function priorityLabel(priority: 1 | 2 | 3): string {
  if (priority === 1) return 'P1 CRITICAL';
  if (priority === 2) return 'P2 HIGH';
  return 'P3 STANDARD';
}

export default function App() {
  const { settings, loadSettings, isLoading } = useAppStore();
  useSettingsSync();
  const [dueRows, setDueRows] = useState<DueRow[]>([]);
  const [quest, setQuest] = useState<Quest | null>(null);
  const [questProgress, setQuestProgress] = useState(0);
  const [questTarget, setQuestTarget] = useState(0);
  const [todayISO, setTodayISO] = useState('');
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [paidAmountRaw, setPaidAmountRaw] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const init = async () => {
      await seedDatabase();
      await loadSettings();
    };
    init();
  }, [loadSettings]);

  useEffect(() => {
    const sub = liveQuery(async () => {
      const nextSettings = await db.settings.get('settings');
      const tz = nextSettings?.timezone ?? 'UTC';
      const nowISO = dateISOInTimeZone(new Date(), tz);
      const weekFromNow = addDaysISO(nowISO, 7);

      const obligations = await db.obligations.toArray();
      const rows: DueRow[] = [];
      for (const obligation of obligations) {
        for (const cycle of obligation.cycles) {
          if (cycle.status === 'PLANNED' && cycle.dueDateISO >= nowISO && cycle.dueDateISO <= weekFromNow) {
            rows.push({ obligation, cycle, dueISO: cycle.dueDateISO });
          }
        }
      }
      rows.sort((a, b) => {
        const diff = a.dueISO.localeCompare(b.dueISO);
        if (diff !== 0) return diff;
        return a.obligation.priority - b.obligation.priority;
      });

      const activeQuest = nextSettings?.activeQuestId ? await db.quests.get(nextSettings.activeQuestId) : undefined;
      const txs = await db.transactions.toArray();
      const paid = txs
        .filter((tx) => tx.tags?.includes('obligation_payment'))
        .reduce((sum, tx) => sum + tx.amount, 0);
      const target = activeQuest?.targetAmount ?? nextSettings?.selfReportedDebt ?? 0;
      const progress = target > 0 ? Math.min(paid / target, 1) : 0;

      return { rows, activeQuest, progress, target, nowISO };
    }).subscribe(({ rows, activeQuest, progress, target, nowISO }) => {
      setDueRows(rows);
      setQuest(activeQuest ?? null);
      setQuestProgress(progress);
      setQuestTarget(target);
      setTodayISO(nowISO);
    });
    return () => sub.unsubscribe();
  }, []);

  const dueSoon = useMemo(() => dueRows.slice(0, 2), [dueRows]);
  const percent = Math.round(questProgress * 100);
  const ringRadius = 54;
  const circumference = 2 * Math.PI * ringRadius;

  async function doConfirmPaid() {
    if (!confirm) return;
    const n = Number(paidAmountRaw);
    if (!Number.isFinite(n) || n <= 0) return;
    setIsSaving(true);
    try {
      await confirmObligationPaid(confirm.obligationId, confirm.cycleId, n);
      setConfirm(null);
    } finally {
      setIsSaving(false);
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">🛡️</div>
          <div className="small muted">Loading Cadencio...</div>
        </div>
      </div>
    );
  }

  return (
    <div className="app-shell">
      <header className="top-bar">
        <div className="brand">
          <div className="brand-badge">👑</div>
          <div>
            <h1>Cadencio</h1>
          </div>
        </div>
        <div className="top-actions">
          <div className="pill">Month <span className="num">Feb 2026</span> ▼</div>
          <div className="pill">Focus Mode</div>
          <button className="pill primary">+ Add</button>
          <div className="pill ghost">⚙️</div>
        </div>
      </header>

      <aside className="sidebar">
        <div className="nav-item active">🏠 Home</div>
        <div className="nav-item">📋 Obligations</div>
        <div className="nav-item">🎯 Budget</div>
        <div className="nav-item">⚙️ Settings</div>
      </aside>

      <main className="content">
        <div className="status-banner">
          <div className="status-row">
            <div className="status-title">🟡 1 obligation due in 3 days</div>
            <div className="status-chips">
              <span className="chip yellow">Due soon</span>
              <span className="chip">Cap 78%</span>
              <span className="chip">Streak 12</span>
            </div>
          </div>
        </div>

        <div className="dashboard-grid">
          <section className="column left-col no-scrollbar">
            <div className="card stack-card">
              <div className="section-title">
                <h2>Due Soon</h2>
                <span className="chip">{dueRows.length} TOTAL</span>
              </div>
              <div className="due-list">
                {dueSoon.length ? (
                  dueSoon.map((row) => (
                    <div key={`${row.obligation.id}_${row.cycle.id}`} className="due-item">
                      <div className="due-item-top">
                        <div>
                          <div className="due-label">{priorityLabel(row.obligation.priority)}</div>
                          <div className="due-title">{row.obligation.name} — {formatCompactVND(row.cycle.amount)} VND</div>
                        </div>
                        <button className="icon-button" aria-label="Edit obligation">✎</button>
                      </div>
                      <button
                        className="due-button"
                        onClick={() => {
                          setConfirm({
                            obligationId: row.obligation.id,
                            cycleId: row.cycle.id,
                            name: row.obligation.name,
                            plannedAmount: row.cycle.amount,
                          });
                          setPaidAmountRaw(String(row.cycle.amount));
                        }}
                      >
                        Confirm Paid
                      </button>
                      <div className="due-meta">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <circle cx="12" cy="12" r="10" />
                          <polyline points="12 6 12 12 16 14" />
                        </svg>
                        <span>{todayISO ? formatDueLabel(todayISO, row.dueISO) : `Due ${row.dueISO}`}</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="small muted">No upcoming obligations.</div>
                )}
              </div>
            </div>

            <div className="card stack-card">
              <div className="row-title">Plan your obligations</div>
              <div className="small muted">Set up a payment plan so Salary Day Run knows what to do.</div>
              <div className="cta-row">
                <button className="pill primary">Plan →</button>
              </div>
            </div>

            <div className="card stack-card inactive">
              <div className="row-title">Salary Day Run</div>
              <div className="small muted">Inactive. Shows when you are within the reset window.</div>
              <div className="checklist">
                <div className="check-item">• Pay P1 obligations</div>
                <div className="check-item">• Pay P2 obligations</div>
                <div className="check-item">• Log savings transfer</div>
              </div>
            </div>
          </section>

          <section className="column middle-col no-scrollbar">
            <div className="card hero-card">
              <div className="hero-left">
                <div className="progress-ring-container">
                  <svg className="progress-ring" viewBox="0 0 120 120">
                    <circle
                      className="progress-ring-bg"
                      cx="60"
                      cy="60"
                      r={ringRadius}
                      strokeWidth="8"
                    />
                    <circle
                      className="progress-ring-circle"
                      cx="60"
                      cy="60"
                      r={ringRadius}
                      strokeWidth="8"
                      strokeDasharray={circumference}
                      strokeDashoffset={circumference * (1 - questProgress)}
                    />
                  </svg>
                  <div className="progress-ring-content">
                    <span className="num" style={{ fontSize: '28px', fontWeight: 700, lineHeight: 1 }}>{percent}%</span>
                    <span className="small muted" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.06em', marginTop: '4px' }}>Progress</span>
                  </div>
                </div>
              </div>
              <div className="hero-right">
                <div className="hero-badge">Tier 3 · Builder</div>
                <h3>{quest?.name ?? 'Recovery Quest'}</h3>
                <p className="small muted">Progress updates on confirmed payments and savings transfers.</p>
                {questTarget > 0 ? (
                  <div className="small muted">Target · <span className="num">{formatCompactVND(questTarget)} VND</span></div>
                ) : null}
                <div className="small muted">Streak signal · • • •</div>
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <h2>Discipline Heatmap</h2>
                <div className="heatmap-legend">
                  <span style={{ background: '#ede9ff' }} />
                  <span style={{ background: '#d8d0ff' }} />
                  <span style={{ background: '#b7a7ff' }} />
                  <span style={{ background: '#8f7bff' }} />
                </div>
              </div>
              <div className="heatmap">
                {Array.from({ length: 42 }).map((_, i) => {
                  const colors = ['#ede9ff', '#d8d0ff', '#b7a7ff', '#8f7bff', '#6b5bff'];
                  const level = (i * 3) % colors.length;
                  return <span key={i} style={{ background: colors[level] }} />;
                })}
              </div>
              <div className="heatmap-footer">
                <span>6 WEEKS AGO</span>
                <span>PRESENT</span>
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <h2>Monthly Cap</h2>
                <span className="small muted">78% used</span>
              </div>
              <div className="progress-bar" style={{ marginBottom: 12 }}>
                <span style={{ width: '78%' }} />
              </div>
              <div className="mini-bars">
                <div className="mini-bar" style={{ width: '42%' }} />
                <div className="mini-bar" style={{ width: '30%' }} />
                <div className="mini-bar" style={{ width: '18%' }} />
                <div className="mini-bar" style={{ width: '12%' }} />
              </div>
            </div>
          </section>

          <section className="column right-col no-scrollbar">
            <div className="card">
              <div className="section-title">
                <h2>Quick Add</h2>
                <button className="pill primary">+ Add</button>
              </div>
              <div className="quick-stack">
                <button className="pill quick spend">Spend</button>
                <button className="pill quick receive">Receive</button>
                <button className="pill quick obligation">Obligation</button>
              </div>
            </div>

            <div className="card">
              <div className="small muted">Last OUT</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>≈ 1.4h</div>
              <div className="small muted">Based on your cost-per-hour</div>
            </div>

            <div className="card">
              <div className="section-title">
                <h2>Zones</h2>
                <button className="pill ghost">Manage</button>
              </div>
              <div className="zone-list">
                <div className="zone-row"><span>HQ</span><span className="num">12.5k</span></div>
                <div className="zone-row"><span>Spend</span><span className="num">3.1k</span></div>
                <div className="zone-row"><span>Savings</span><span className="num">8.8k</span></div>
                <div className="zone-row"><span>Emergency</span><span className="num">5.4k</span></div>
              </div>
            </div>
          </section>
        </div>
      </main>

      {confirm ? (
        <Modal title="Confirm Paid" description="Have you paid this in your bank app?" onClose={() => setConfirm(null)}>
          <div className="card soft">
            <div style={{ fontWeight: 700 }}>{confirm.name}</div>
            <div className="small muted">Planned: <span className="num">{formatCompactVND(confirm.plannedAmount)}</span> VND</div>
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

      {settings && !settings.onboardingCompletedAt ? <OnboardingModal /> : null}
    </div>
  );
}
