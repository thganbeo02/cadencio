import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { seedDatabase } from './db/seed';
import { db } from './db/database';
import { useAppStore } from './stores/useAppStore';
import { useSettingsSync } from './hooks/useSettingsSync';
import { OnboardingModal } from './components/OnboardingModal';
import { ObligationPlanningModal } from './components/ObligationPlanningModal';
import { TransactionModal } from './components/TransactionModal';
import { TransferModal } from './components/TransferModal';
import { Modal } from './components/Modal';
import type { Obligation, ObligationCycle, Quest, Zone } from './types';
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

type ZoneItem = {
  id: string;
  name: string;
  amount: number;
  sign: string;
  tone: 'positive' | 'negative' | 'neutral';
  transferable: boolean;
  zoneId?: string;
};

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
  const [pendingObligationCount, setPendingObligationCount] = useState(0);
  const [moneyInMonth, setMoneyInMonth] = useState(0);
  const [moneyOutMonth, setMoneyOutMonth] = useState(0);
  const [obligationsRemaining, setObligationsRemaining] = useState(0);
  const [allObligations, setAllObligations] = useState<Obligation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneBalances, setZoneBalances] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [paidAmountRaw, setPaidAmountRaw] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [showObligationPlanner, setShowObligationPlanner] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionTab, setTransactionTab] = useState<'spend' | 'receive' | 'obligation'>('spend');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromZoneId, setTransferFromZoneId] = useState<string | undefined>(undefined);

  async function resetApp() {
    if (window.confirm("Reset all data and restart onboarding?")) {
      await db.delete();
      window.location.reload();
    }
  }

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
      const monthFromNow = addDaysISO(nowISO, 30);

      const obligations = await db.obligations.toArray();
      const rows: DueRow[] = [];
      for (const obligation of obligations) {
        for (const cycle of obligation.cycles) {
          if (cycle.status === 'PLANNED' && cycle.dueDateISO >= nowISO && cycle.dueDateISO <= monthFromNow) {
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
       const pending = obligations.filter((o) => o.totalAmount > 0 && o.cycles.length === 0).length;
       const txs = await db.transactions.toArray();
      const allZones = await db.zones.toArray();
      const paid = txs
        .filter((tx) => tx.tags?.includes('obligation_payment'))
        .reduce((sum, tx) => sum + tx.amount, 0);
      const target = activeQuest?.targetAmount ?? nextSettings?.selfReportedDebt ?? 0;
      const progress = target > 0 ? Math.min(paid / target, 1) : 0;

      const currentMonth = nowISO.slice(0, 7);
      const monthTxs = txs.filter((tx) => tx.dateISO.startsWith(currentMonth) && !tx.tags?.includes('internal_transfer'));
      const inMonth = monthTxs.filter((tx) => tx.direction === 'IN').reduce((sum, tx) => sum + tx.amount, 0);
      const outMonth = monthTxs.filter((tx) => tx.direction === 'OUT').reduce((sum, tx) => sum + tx.amount, 0);
      const obligationsTotal = obligations.reduce((sum, obl) => sum + obl.totalAmount, 0);

      const balances: Record<string, number> = {};
      allZones.forEach((zone) => {
        balances[zone.id] = 0;
      });

      for (const tx of txs) {
        const isTransfer = tx.tags?.includes('internal_transfer');
        const fromZoneId = tx.meta?.fromZoneId;
        const toZoneId = tx.meta?.toZoneId;

        if (isTransfer && fromZoneId && toZoneId) {
          if (tx.direction === 'OUT') {
            balances[fromZoneId] = (balances[fromZoneId] ?? 0) - tx.amount;
          }
          if (tx.direction === 'IN') {
            balances[toZoneId] = (balances[toZoneId] ?? 0) + tx.amount;
          }
          continue;
        }

        if (tx.direction === 'IN') {
          balances.zone_hq = (balances.zone_hq ?? 0) + tx.amount;
        }
        if (tx.direction === 'OUT') {
          balances.zone_hq = (balances.zone_hq ?? 0) - tx.amount;
        }
      }

      return { rows, activeQuest, progress, target, nowISO, pending, inMonth, outMonth, obligationsTotal, allZones, balances, obligations };
    }).subscribe(({ rows, activeQuest, progress, target, nowISO, pending, inMonth, outMonth, obligationsTotal, allZones, balances, obligations }) => {
      setDueRows(rows);
      setQuest(activeQuest ?? null);
      setQuestProgress(progress);
      setQuestTarget(target);
      setTodayISO(nowISO);
      setPendingObligationCount(pending);
      setMoneyInMonth(inMonth);
      setMoneyOutMonth(outMonth);
      setObligationsRemaining(obligationsTotal);
      setZones(allZones);
      setZoneBalances(balances);
      setAllObligations(obligations);
    });
    return () => sub.unsubscribe();
  }, []);

  const dueSoon = useMemo(() => dueRows.slice(0, 2), [dueRows]);
  const percent = Math.round(questProgress * 100);
  const ringRadius = 54;
  const circumference = 2 * Math.PI * ringRadius;
  const zoneItems = useMemo<ZoneItem[]>(() => {
    const derived: ZoneItem[] = [
      { id: 'money_in', name: 'Money In', amount: moneyInMonth, sign: '+', tone: 'positive', transferable: false },
      { id: 'money_out', name: 'Money Out', amount: moneyOutMonth, sign: '-', tone: 'negative', transferable: false },
      { id: 'obligations', name: 'Obligations', amount: obligationsRemaining, sign: '-', tone: 'negative', transferable: false },
    ];

    const assets: ZoneItem[] = zones
      .filter((zone) => zone.kind === 'asset')
      .map((zone) => {
        const raw = zoneBalances[zone.id] ?? 0;
        const tone = raw === 0 ? 'neutral' : raw > 0 ? 'positive' : 'negative';
        const sign = raw === 0 ? '' : raw > 0 ? '+' : '-';
        return {
          id: zone.id,
          name: zone.name,
          amount: Math.abs(raw),
          sign,
          tone,
          transferable: true,
          zoneId: zone.id,
        };
      });

    return [...derived, ...assets];
  }, [moneyInMonth, moneyOutMonth, obligationsRemaining, zones, zoneBalances]);

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
          <button
            className="pill primary"
            onClick={() => {
              setTransactionTab('spend');
              setShowTransactionModal(true);
            }}
          >
            + Add
          </button>
          <div className="pill ghost">⚙️</div>
        </div>
      </header>

      <aside className="sidebar">
        <div className="nav-item active" aria-label="Home">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 10.5L12 3l9 7.5" />
            <path d="M5 10v10a1 1 0 0 0 1 1h4v-6h4v6h4a1 1 0 0 0 1-1V10" />
          </svg>
        </div>
        <div className="nav-item" aria-label="Obligations">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M9 6h8" />
            <path d="M9 12h8" />
            <path d="M9 18h8" />
            <path d="M5 6h.01" />
            <path d="M5 12h.01" />
            <path d="M5 18h.01" />
          </svg>
        </div>
        <button
          className="nav-item"
          aria-label="Add"
          onClick={() => {
            setTransactionTab('spend');
            setShowTransactionModal(true);
          }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
        </button>
        <div className="nav-item" aria-label="Budget">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 7V5a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-2" />
            <path d="M7 7h6" />
            <path d="M16 12h5" />
            <path d="M16 16h5" />
            <path d="M16 12a2 2 0 1 0 0 4" />
          </svg>
        </div>
        <div className="nav-item" aria-label="Settings">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <circle cx="12" cy="12" r="3" />
            <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 1 1-4 0v-.09a1.65 1.65 0 0 0-1-1.51 1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 1 1 0-4h.09a1.65 1.65 0 0 0 1.51-1 1.65 1.65 0 0 0-.33-1.82l-.06-.06A2 2 0 1 1 7.04 3.3l.06.06a1.65 1.65 0 0 0 1.82.33h0A1.65 1.65 0 0 0 9.91 2.2V2a2 2 0 1 1 4 0v.09c0 .69.4 1.31 1.02 1.51h0a1.65 1.65 0 0 0 1.82-.33l.06-.06A2 2 0 1 1 20.7 7.04l-.06.06a1.65 1.65 0 0 0-.33 1.82v0A1.65 1.65 0 0 0 21.8 9.91H22a2 2 0 1 1 0 4h-.09c-.69 0-1.31.4-1.51 1.02z" />
          </svg>
        </div>
        <div style={{ flex: 1 }} />
        <button
          className="nav-item"
          aria-label="Reset System"
          onClick={() => void resetApp()}
          style={{ color: 'var(--danger)', opacity: 0.5 }}
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8" />
            <path d="M3 3v5h5" />
          </svg>
        </button>
      </aside>

      <main className="content">
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

            {allObligations.length > 0 ? (
              <div className="card stack-card">
                <div className="row-title">Plan your obligations</div>
                <div className="plan-list">
                  {[...allObligations]
                    .sort((a, b) => b.totalAmount - a.totalAmount)
                    .map((obl) => {
                      const isPlanned = obl.cycles.length > 0;
                      return (
                        <div key={obl.id} className="plan-item">
                          <div className="plan-item-left">
                            <div className="plan-item-name">{obl.name}</div>
                            <div className="plan-item-meta num">
                              {formatNumberWithCommas(obl.totalAmount)} VND
                            </div>
                          </div>
                          <div className="plan-item-right">
                            <span className={`chip ${isPlanned ? 'green' : 'red'}`}>
                              {isPlanned ? 'Planned' : 'Needs plan'}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                </div>
                {pendingObligationCount > 0 ? (
                  <div className="cta-row">
                    <button className="pill primary" onClick={() => setShowObligationPlanner(true)}>Plan →</button>
                  </div>
                ) : null}
              </div>
            ) : null}

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
              <div className="hero-content">
                <div className="hero-label">Main Quest</div>
                <div className="hero-title num">
                  {questTarget > 0 ? formatCompactVND(questTarget) : '100M'} Recovery
                </div>
                <p className="hero-subtitle">You are steadily climbing from your financial low point. Milestone 2 (75M) is 3M away.</p>
                <button className="pill hero-button">View Details</button>
              </div>
              <div className="hero-ring">
              <div className="progress-ring-container">
                <svg className="progress-ring" viewBox="0 0 160 160">
                  <circle
                    className="progress-ring-bg"
                    cx="80"
                    cy="80"
                    r={ringRadius}
                    strokeWidth="10"
                  />
                  <circle
                    className="progress-ring-circle"
                    cx="80"
                    cy="80"
                    r={ringRadius}
                    strokeWidth="10"
                    strokeDasharray={circumference}
                    strokeDashoffset={circumference * (1 - questProgress)}
                  />
                </svg>
                  <div className="progress-ring-content">
                    <span className="num" style={{ fontSize: '26px', fontWeight: 700, lineHeight: 1 }}>{formatCompactVND(Math.round(questProgress * (questTarget || 100_000_000)))}</span>
                    <span className="small muted" style={{ fontSize: '10px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '4px' }}>OF {formatCompactVND(questTarget || 100_000_000)}</span>
                  </div>
                </div>
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
                <h2>Zones</h2>
              </div>
              <div className="zones-stack">
                {zoneItems.map((zone) => (
                  <div key={zone.id} className="zone-card">
                    <div className="zone-card-head">
                      <div className="zone-label">{zone.name}</div>
                      {zone.transferable ? (
                        <button
                          className="zone-transfer"
                          onClick={() => {
                            setTransferFromZoneId(zone.zoneId);
                            setShowTransferModal(true);
                          }}
                        >
                          Transfer
                        </button>
                      ) : null}
                    </div>
                    <div className={`zone-amount num ${zone.tone}`}>
                      {zone.sign ? <span className="zone-sign">{zone.sign}</span> : null}
                      {formatNumberWithCommas(zone.amount)} <span className="zone-currency">VND</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="card">
              <div className="row-title" style={{ marginBottom: 16 }}>Last OUT</div>
              <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>≈ 1.4h</div>
              <div className="small muted">Based on your cost-per-hour</div>
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

      {showObligationPlanner ? (
        <ObligationPlanningModal onClose={() => setShowObligationPlanner(false)} />
      ) : null}

      {showTransactionModal ? (
        <TransactionModal
          onClose={() => setShowTransactionModal(false)}
          defaultTab={transactionTab}
        />
      ) : null}

      {showTransferModal ? (
        <TransferModal
          onClose={() => setShowTransferModal(false)}
          zones={zones}
          fromZoneId={transferFromZoneId}
        />
      ) : null}

      {settings && !settings.onboardingCompletedAt ? <OnboardingModal /> : null}
    </div>
  );
}
