import { useEffect, useMemo, useState } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/database';
import { Modal } from './Modal';
import { ObligationPlanningModal } from './ObligationPlanningModal';
import { confirmObligationPaid, recordObligationBorrow, refreshMissedObligationCycles } from '../services/obligations';
import type { Obligation, ObligationCycle } from '../types';
import { dateISOInTimeZone } from '../utils/dates';
import { digitsOnly } from '../utils/input';
import { formatCompactVND, formatNumberWithCommas } from '../utils/money';

type TabKey = 'unplanned' | 'upcoming' | 'overdue' | 'paid' | 'all';

type CycleRow = {
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

type BorrowTarget = 'new' | string;

function formatVnd(amount: number, options?: { compact?: boolean; isFocus?: boolean }): string {
  if (options?.isFocus) return '****';
  const abs = Math.abs(amount);
  return options?.compact ? formatCompactVND(abs) : formatNumberWithCommas(abs);
}

function daysBetweenISO(fromISO: string, toISO: string): number {
  const from = new Date(`${fromISO}T00:00:00Z`).getTime();
  const to = new Date(`${toISO}T00:00:00Z`).getTime();
  return Math.round((to - from) / 86_400_000);
}

function formatShortDate(dateISO: string, referenceISO: string): string {
  const date = new Date(`${dateISO}T00:00:00Z`);
  const reference = new Date(`${referenceISO}T00:00:00Z`);
  const includeYear = date.getUTCFullYear() !== reference.getUTCFullYear();
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: includeYear ? 'numeric' : undefined,
  });
}

export function ObligationsPage({
  isFocusMode,
  timezone,
}: {
  isFocusMode: boolean;
  timezone: string;
}) {
  const [tab, setTab] = useState<TabKey>('unplanned');
  const [obligations, setObligations] = useState<Obligation[]>([]);
  const [showPlanner, setShowPlanner] = useState(false);
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [paidAmountRaw, setPaidAmountRaw] = useState('');
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const [borrowOpen, setBorrowOpen] = useState(false);
  const [borrowTarget, setBorrowTarget] = useState<BorrowTarget>('new');
  const [borrowName, setBorrowName] = useState('');
  const [borrowPriority, setBorrowPriority] = useState<1 | 2 | 3>(2);
  const [borrowAmountRaw, setBorrowAmountRaw] = useState('');
  const [borrowError, setBorrowError] = useState<string | null>(null);
  const [borrowNote, setBorrowNote] = useState('');
  const [isBorrowSaving, setIsBorrowSaving] = useState(false);
  const [selectedObligationId, setSelectedObligationId] = useState<string | null>(null);

  const nowISO = useMemo(() => dateISOInTimeZone(new Date(), timezone), [timezone]);

  useEffect(() => {
    refreshMissedObligationCycles();
  }, []);

  useEffect(() => {
    const sub = liveQuery(async () => db.obligations.toArray()).subscribe((rows) => {
      setObligations(rows);
    });
    return () => sub.unsubscribe();
  }, []);

  useEffect(() => {
    if (!obligations.length) {
      setSelectedObligationId(null);
      return;
    }
    if (selectedObligationId && obligations.some((o) => o.id === selectedObligationId)) return;
    setSelectedObligationId(obligations[0]?.id ?? null);
  }, [obligations, selectedObligationId]);

  useEffect(() => {
    if (!borrowOpen) return;
    setBorrowTarget('new');
    setBorrowName('');
    setBorrowPriority(2);
    setBorrowAmountRaw('');
    setBorrowNote('');
    setBorrowError(null);
  }, [borrowOpen]);

  const unplanned = useMemo(
    () => obligations.filter((obl) => obl.totalAmount > 0 && obl.cycles.length === 0),
    [obligations]
  );

  const selectedObligation = useMemo(
    () => obligations.find((obl) => obl.id === selectedObligationId) ?? null,
    [obligations, selectedObligationId]
  );

  const upcomingRows = useMemo(() => {
    const rows: CycleRow[] = [];
    for (const obligation of obligations) {
      for (const cycle of obligation.cycles) {
        if (cycle.status === 'PLANNED' && cycle.dueDateISO >= nowISO) {
          rows.push({ obligation, cycle, dueISO: cycle.dueDateISO });
        }
      }
    }
    rows.sort((a, b) => {
      const diff = a.dueISO.localeCompare(b.dueISO);
      if (diff !== 0) return diff;
      return a.obligation.priority - b.obligation.priority;
    });
    return rows;
  }, [obligations, nowISO]);

  const overdueRows = useMemo(() => {
    const rows: CycleRow[] = [];
    for (const obligation of obligations) {
      for (const cycle of obligation.cycles) {
        if (cycle.status !== 'PAID' && cycle.dueDateISO < nowISO) {
          rows.push({ obligation, cycle, dueISO: cycle.dueDateISO });
        }
      }
    }
    rows.sort((a, b) => {
      const diff = a.dueISO.localeCompare(b.dueISO);
      if (diff !== 0) return diff;
      return a.obligation.priority - b.obligation.priority;
    });
    return rows;
  }, [obligations, nowISO]);

  const paidRows = useMemo(() => {
    const rows: CycleRow[] = [];
    for (const obligation of obligations) {
      for (const cycle of obligation.cycles) {
        if (cycle.status !== 'PAID') continue;
        const confirmedISO = cycle.confirmedAt
          ? dateISOInTimeZone(new Date(cycle.confirmedAt), timezone)
          : cycle.dueDateISO;
        if (daysBetweenISO(confirmedISO, nowISO) > 90) continue;
        rows.push({ obligation, cycle, dueISO: confirmedISO });
      }
    }
    rows.sort((a, b) => b.dueISO.localeCompare(a.dueISO));
    return rows;
  }, [obligations, nowISO, timezone]);

  const allSorted = useMemo(() => {
    return obligations
      .slice()
      .sort((a, b) => a.priority - b.priority || a.name.localeCompare(b.name));
  }, [obligations]);

  async function submitConfirmPaid() {
    if (!confirm) return;
    const n = Number(digitsOnly(paidAmountRaw));
    if (!Number.isFinite(n) || n <= 0) {
      setConfirmError('Enter a valid amount.');
      return;
    }
    setIsSaving(true);
    setConfirmError(null);
    try {
      await confirmObligationPaid(confirm.obligationId, confirm.cycleId, n);
      setConfirm(null);
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'Failed to confirm paid.');
    } finally {
      setIsSaving(false);
    }
  }

  async function submitBorrow() {
    const amount = Number(digitsOnly(borrowAmountRaw));
    if (!Number.isFinite(amount) || amount <= 0) {
      setBorrowError('Enter a valid amount.');
      return;
    }

    setBorrowError(null);
    setIsBorrowSaving(true);
    try {
      await recordObligationBorrow({
        obligationId: borrowTarget === 'new' ? undefined : borrowTarget,
        name: borrowTarget === 'new' ? borrowName : undefined,
        priority: borrowTarget === 'new' ? borrowPriority : undefined,
        amount,
        note: borrowNote,
      });
      setBorrowOpen(false);
    } catch (e) {
      setBorrowError(e instanceof Error ? e.message : 'Failed to log borrowed amount.');
    } finally {
      setIsBorrowSaving(false);
    }
  }

  function renderEmpty(message: string) {
    return (
      <div className="card soft">
        <div className="small muted">{message}</div>
      </div>
    );
  }

  function handleCardKey(event: React.KeyboardEvent, onActivate: () => void) {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      onActivate();
    }
  }

  function renderCycleCard(
    row: CycleRow,
    options: { showAction: boolean; danger?: boolean; statusLabel: string; statusNote: string }
  ) {
    const activate = () => setSelectedObligationId(row.obligation.id);
    return (
      <div
        key={`${row.obligation.id}_${row.cycle.id}`}
        className={`obligation-card obligation-card-cycle ${options.danger ? 'is-danger' : ''}`}
        onClick={activate}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => handleCardKey(event, activate)}
      >
        <div className="obligation-left">
          <span className={`priority-pill p${row.obligation.priority}`}>P{row.obligation.priority}</span>
          <div>
            <div className="obligation-name">{row.obligation.name}</div>
            <div className="small muted">Due {formatShortDate(row.cycle.dueDateISO, nowISO)}</div>
          </div>
        </div>
        <div className="obligation-middle">
          <div className="obligation-meta-label">PAYMENT</div>
          <div className="obligation-amount num">
            {formatVnd(row.cycle.amount, { isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}
          </div>
        </div>
        <div className="obligation-right">
          <div className="obligation-status">
            <span className={`status-pill ${options.danger ? 'danger' : options.statusLabel === 'PAID' ? 'neutral' : 'soft'}`}>
              {options.statusLabel}
            </span>
            <div className="small muted">{options.statusNote}</div>
          </div>
          {options.showAction ? (
            <button
              className="pill"
              onClick={(event) => {
                event.stopPropagation();
                setConfirm({
                  obligationId: row.obligation.id,
                  cycleId: row.cycle.id,
                  name: row.obligation.name,
                  plannedAmount: row.cycle.amount,
                });
                setPaidAmountRaw(String(row.cycle.amount));
                setConfirmError(null);
              }}
            >
              Confirm Paid
            </button>
          ) : (
            <span className="small muted">Paid</span>
          )}
        </div>
      </div>
    );
  }

  function renderObligationCard(obl: Obligation) {
    const hasOverdue = obl.cycles.some((c) => c.status !== 'PAID' && c.dueDateISO < nowISO);
    const nextCycle = obl.cycles
      .filter((c) => c.status === 'PLANNED' && c.dueDateISO >= nowISO)
      .sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO))[0];
    const isPlanned = obl.cycles.length > 0;
    const status = hasOverdue ? 'OVERDUE' : isPlanned ? 'PLANNED' : 'UNPLANNED';
    const statusNote = hasOverdue
      ? 'Past due cycle'
      : isPlanned
        ? nextCycle
          ? `Next due ${formatShortDate(nextCycle.dueDateISO, nowISO)}`
          : 'On schedule'
        : 'No payment cycles set';

    const activate = () => setSelectedObligationId(obl.id);
    return (
      <div
        key={obl.id}
        className={`obligation-card ${selectedObligationId === obl.id ? 'is-active' : ''}`}
        onClick={activate}
        role="button"
        tabIndex={0}
        onKeyDown={(event) => handleCardKey(event, activate)}
      >
        <div className="obligation-left">
          <span className={`priority-pill p${obl.priority}`}>P{obl.priority}</span>
          <div>
            <div className="obligation-name">{obl.name}</div>
            <div className="obligation-amount num">
              {formatVnd(obl.totalAmount, { isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}
            </div>
          </div>
        </div>
        <div className="obligation-right">
          <div className="obligation-status">
            <span className={`status-pill ${status === 'OVERDUE' ? 'danger' : status === 'PLANNED' ? 'soft' : 'neutral'}`}>
              {status}
            </span>
            <div className="small muted">{statusNote}</div>
          </div>
          <button
            className="pill"
            onClick={(event) => {
              event.stopPropagation();
              setShowPlanner(true);
            }}
          >
            {isPlanned ? 'Adjust plan →' : 'Plan →'}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="obligations-page">
      <div className="obligations-header">
        <div className="obligations-title">
          <h2>Obligations</h2>
          <div className="obligations-subtitle muted">Your Debt Book · Tracking personal debt and upcoming payments</div>
        </div>
        <button className="pill primary" onClick={() => setBorrowOpen(true)}>
          + Borrowed
        </button>
      </div>

      <div className="obligations-tabs">
        <button className={`tab-pill ${tab === 'all' ? 'active' : ''}`} onClick={() => setTab('all')}>
          All <span className="count-pill">{allSorted.length}</span>
        </button>
        <button className={`tab-pill ${tab === 'unplanned' ? 'active' : ''}`} onClick={() => setTab('unplanned')}>
          Unplanned <span className="count-pill danger">{unplanned.length}</span>
        </button>
        <button className={`tab-pill ${tab === 'upcoming' ? 'active' : ''}`} onClick={() => setTab('upcoming')}>
          Upcoming <span className="count-pill">{upcomingRows.length}</span>
        </button>
        <button className={`tab-pill ${tab === 'overdue' ? 'active' : ''}`} onClick={() => setTab('overdue')}>
          Overdue <span className="count-pill warn">{overdueRows.length}</span>
        </button>
        <button className={`tab-pill ${tab === 'paid' ? 'active' : ''}`} onClick={() => setTab('paid')}>
          Paid <span className="count-pill">{paidRows.length}</span>
        </button>
      </div>

      <div className="obligations-layout">
        <div className="obligations-body">
          {tab === 'unplanned' && (
            <>
              <div className="obligation-nudge">
                <div>
                  <div className="obligation-nudge-title">Unplanned obligations need their first cycle.</div>
                  <div className="small muted">Plan even one payment to turn uncertainty into a timeline.</div>
                </div>
                <div className="obligation-nudge-meter">
                  <div className="obligation-nudge-bar">
                    <div
                      className="obligation-nudge-fill"
                      style={{ width: `${Math.min(100, Math.round((unplanned.length / Math.max(1, obligations.length)) * 100))}%` }}
                    />
                  </div>
                  <div className="small muted">{unplanned.length} of {obligations.length} unplanned</div>
                </div>
              </div>
              <div className="obligation-list">
                {unplanned.length === 0
                  ? renderEmpty('No unplanned obligations. You are fully scheduled.')
                  : unplanned.map((obl) => renderObligationCard(obl))}
              </div>
            </>
          )}

          {tab === 'upcoming' && (
            <div className="obligation-list">
              {upcomingRows.length === 0
                ? renderEmpty('No upcoming payments in the pipeline.')
              : upcomingRows.map((row) =>
                renderCycleCard(row, {
                  showAction: true,
                  statusLabel: 'UPCOMING',
                  statusNote: 'Next due',
                })
              )}
          </div>
        )}

          {tab === 'overdue' && (
            <div className="obligation-list">
              {overdueRows.length === 0
                ? renderEmpty('No overdue obligations. You are on time.')
              : overdueRows.map((row) =>
                renderCycleCard(row, {
                  showAction: true,
                  danger: true,
                  statusLabel: 'OVERDUE',
                  statusNote: 'Needs confirmation',
                })
              )}
          </div>
        )}

          {tab === 'paid' && (
            <div className="obligation-list">
              {paidRows.length === 0
                ? renderEmpty('No recent payments yet. Confirm your first win.')
              : paidRows.map((row) =>
                renderCycleCard(row, {
                  showAction: false,
                  statusLabel: 'PAID',
                  statusNote: 'Confirmed',
                })
              )}
          </div>
        )}

          {tab === 'all' && (
            <div className="obligation-list">
              {allSorted.length === 0
                ? renderEmpty('No obligations logged yet.')
                : allSorted.map((obl) => renderObligationCard(obl))}
            </div>
          )}
        </div>

        <aside className="obligations-detail">
          {selectedObligation ? (
            <div className="card obligation-detail-card">
              <div className="detail-header">
                <div>
                  <div className="detail-title">{selectedObligation.name}</div>
                </div>
                <span className={`priority-pill p${selectedObligation.priority}`}>P{selectedObligation.priority}</span>
              </div>

              <div className="detail-balance">
                <div className="small muted">Remaining balance</div>
                <div className="detail-amount num">
                  {formatVnd(selectedObligation.totalAmount, { isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}
                </div>
              </div>

              <div className="detail-actions">
                <button className="pill" onClick={() => setShowPlanner(true)}>
                  {selectedObligation.cycles.length ? 'Adjust plan' : 'Plan'}
                </button>
                <button className="pill primary" onClick={() => setBorrowOpen(true)}>
                  Add borrowed
                </button>
              </div>

              <div className="detail-section">
                <div className="detail-section-title">Payment cycles</div>
                {selectedObligation.cycles.length ? (
                  <div className="detail-cycle-list">
                    {selectedObligation.cycles
                      .slice()
                      .sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO))
                      .map((cycle) => (
                        <div key={cycle.id} className="detail-cycle-row">
                          <div>
                            <div className="detail-cycle-title">{formatShortDate(cycle.dueDateISO, nowISO)}</div>
                            <div className="small muted">{cycle.status}</div>
                          </div>
                          <div className="detail-cycle-amount num">
                            {formatVnd(cycle.amount, { isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}
                          </div>
                          {cycle.status !== 'PAID' ? (
                            <button
                              className="pill"
                              onClick={() => {
                                setConfirm({
                                  obligationId: selectedObligation.id,
                                  cycleId: cycle.id,
                                  name: selectedObligation.name,
                                  plannedAmount: cycle.amount,
                                });
                                setPaidAmountRaw(String(cycle.amount));
                                setConfirmError(null);
                              }}
                            >
                              Confirm
                            </button>
                          ) : (
                            <span className="small muted">Paid</span>
                          )}
                        </div>
                      ))}
                  </div>
                ) : (
                  <div className="card soft">
                    <div className="small muted">No payment cycles set yet.</div>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div className="card soft">
              <div className="small muted">Select an obligation to see details.</div>
            </div>
          )}
        </aside>
      </div>

      {showPlanner ? <ObligationPlanningModal onClose={() => setShowPlanner(false)} /> : null}

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
          {confirmError ? <div className="small" style={{ color: '#ef4444', marginTop: 8 }}>{confirmError}</div> : null}
          <div className="cta-row">
            <button className="pill" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="pill primary" onClick={submitConfirmPaid} disabled={isSaving}>Confirm</button>
          </div>
        </Modal>
      ) : null}

      {borrowOpen ? (
        <Modal title="Borrowed / New debt" description="Log new borrowed cash and keep the quest honest." onClose={() => setBorrowOpen(false)}>
          <div className="onboarding-section" style={{ marginBottom: 8 }}>
            <div className="onboarding-field">
              <label className="onboarding-label">Where does this debt belong?</label>
              <select
                className="transaction-select"
                value={borrowTarget}
                onChange={(e) => setBorrowTarget(e.target.value)}
              >
                <option value="new">Create new obligation</option>
                {obligations.map((obl) => (
                  <option key={obl.id} value={obl.id}>{obl.name}</option>
                ))}
              </select>
            </div>

            {borrowTarget === 'new' ? (
              <>
                <div className="onboarding-field">
                  <label className="onboarding-label">Name / Who</label>
                  <input
                    className="onboarding-input-field"
                    placeholder="e.g., Student Loan"
                    value={borrowName}
                    onChange={(e) => setBorrowName(e.target.value)}
                  />
                </div>
                <div className="onboarding-field">
                  <label className="onboarding-label">Priority</label>
                  <div className="obligation-priority">
                    {[1, 2, 3].map((p) => (
                      <button
                        key={p}
                        className={`priority-button ${borrowPriority === p ? 'active' : ''} p${p}`}
                        onClick={() => setBorrowPriority(p as 1 | 2 | 3)}
                      >
                        P{p}
                      </button>
                    ))}
                  </div>
                </div>
              </>
            ) : null}

            <div className="onboarding-field">
              <label className="onboarding-label">Borrowed amount</label>
              <div className="onboarding-input-icon">
                <span className="onboarding-input-prefix">VND</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="onboarding-input-field num has-prefix"
                  placeholder="5,000,000"
                  value={borrowAmountRaw ? formatNumberWithCommas(Number(borrowAmountRaw)) : ''}
                  onChange={(e) => setBorrowAmountRaw(digitsOnly(e.target.value))}
                />
              </div>
            </div>

            <div className="onboarding-field">
              <label className="onboarding-label">Note (optional)</label>
              <input
                className="transaction-note"
                placeholder="Optional note"
                value={borrowNote}
                onChange={(e) => setBorrowNote(e.target.value)}
              />
            </div>
          </div>

          {borrowError ? <div className="onboarding-error">{borrowError}</div> : null}
          <div className="cta-row">
            <button className="pill" onClick={() => setBorrowOpen(false)}>Cancel</button>
            <button className="pill primary" onClick={submitBorrow} disabled={isBorrowSaving}>Log borrowed</button>
          </div>
        </Modal>
      ) : null}
    </div>
  );
}
