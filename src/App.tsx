import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { liveQuery } from 'dexie';
import { seedDatabase } from './db/seed';
import { db } from './db/database';
import { useAppStore } from './stores/useAppStore';
import { useSettingsSync } from './hooks/useSettingsSync';
import { OnboardingModal } from './components/OnboardingModal';
import { ObligationPlanningModal } from './components/ObligationPlanningModal';
import { TransactionModal } from './components/TransactionModal';
import { TransferModal } from './components/TransferModal';
import { ZonesManagerModal } from './components/ZonesManagerModal';
import { Modal } from './components/Modal';
import type { Activity, Obligation, ObligationCycle, Zone } from './types';
import { addDaysISO, dateISOInTimeZone } from './utils/dates';
import { confirmObligationPaid, createObligation } from './services/obligations';
import { undoActivities } from './services/activities';

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
  system?: boolean;
};

type QuestKind = 'debt_cut' | 'earned_climb' | 'recovery_map';

type HeatmapDay = {
  dateISO: string;
  amount: number;
};

function digitsOnly(raw: string): string {
  return raw.replace(/[^\d]/g, '');
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

function formatMillions(amount: number): string {
  const n = amount / 1_000_000;
  if (!Number.isFinite(n)) return '0.0M';
  return `${n.toFixed(1)}M`;
}

function formatVnd(amount: number, options?: { compact?: boolean; isFocus?: boolean; showSign?: boolean }): string {
  if (options?.isFocus) return '****';
  const abs = Math.abs(amount);
  const base = options?.compact ? formatCompactVND(abs) : formatNumberWithCommas(abs);
  if (!options?.showSign) return base;
  const sign = amount < 0 ? '-' : amount > 0 ? '+' : '';
  return `${sign}${base}`;
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

function heatmapLevel(amount: number, dailyCap: number): number {
  if (!Number.isFinite(amount) || amount <= 0) return 0;
  if (!Number.isFinite(dailyCap) || dailyCap <= 0) return 0;
  const ratio = amount / dailyCap;
  if (ratio <= 0.5) return 1;
  if (ratio <= 0.9) return 2;
  if (ratio <= 1.1) return 3;
  return 4;
}

function weekdayIndex(dateISO: string): number {
  const day = new Date(`${dateISO}T00:00:00Z`).getUTCDay();
  return (day + 6) % 7;
}

export default function App() {
  const { settings, loadSettings, isLoading, setFocusMode } = useAppStore();
  useSettingsSync();
  const [dueRows, setDueRows] = useState<DueRow[]>([]);
  const [questProgress, setQuestProgress] = useState(0);
  const [questProgressAmount, setQuestProgressAmount] = useState(0);
  const [questTarget, setQuestTarget] = useState(0);
  const [questNet, setQuestNet] = useState(0);
  const [questEarnedNet, setQuestEarnedNet] = useState(0);
  const [borrowedPrincipal, setBorrowedPrincipal] = useState(0);
  const [questNetIn, setQuestNetIn] = useState(0);
  const [questNetOut, setQuestNetOut] = useState(0);
  const [questNetHistory, setQuestNetHistory] = useState<number[]>([]);
  const [questKind, setQuestKind] = useState<QuestKind>('earned_climb');
  const [questName, setQuestName] = useState('Main Quest');
  const [questBaseline, setQuestBaseline] = useState(0);
  const [questTier, setQuestTier] = useState<1 | 2 | 3 | undefined>(undefined);
  const [questShadowDebt, setQuestShadowDebt] = useState(0);
  const [infoTip, setInfoTip] = useState<{ kind: 'quest' | 'heatmap' | 'cap' | 'zones' } | null>(null);
  const [infoTipPos, setInfoTipPos] = useState<{ top: number; left: number; placement: 'top' | 'bottom' } | null>(null);
  const questInfoRef = useRef<HTMLButtonElement | null>(null);
  const heatmapInfoRef = useRef<HTMLButtonElement | null>(null);
  const capInfoRef = useRef<HTMLButtonElement | null>(null);
  const zonesInfoRef = useRef<HTMLButtonElement | null>(null);
  const infoTipRef = useRef<HTMLDivElement | null>(null);
  const [todayISO, setTodayISO] = useState('');
  const [pendingObligationCount, setPendingObligationCount] = useState(0);
  const [moneyInMonth, setMoneyInMonth] = useState(0);
  const [moneyOutMonth, setMoneyOutMonth] = useState(0);
  const [spendOutMonth, setSpendOutMonth] = useState(0);
  const [obligationsRemaining, setObligationsRemaining] = useState(0);
  const [allObligations, setAllObligations] = useState<Obligation[]>([]);
  const [zones, setZones] = useState<Zone[]>([]);
  const [zoneBalances, setZoneBalances] = useState<Record<string, number>>({});
  const [confirm, setConfirm] = useState<ConfirmState | null>(null);
  const [paidAmountRaw, setPaidAmountRaw] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [confirmError, setConfirmError] = useState<string | null>(null);
  const [showObligationPlanner, setShowObligationPlanner] = useState(false);
  const [showTransactionModal, setShowTransactionModal] = useState(false);
  const [transactionTab, setTransactionTab] = useState<'spend' | 'receive'>('spend');
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferFromZoneId, setTransferFromZoneId] = useState<string | undefined>(undefined);
  const [recentActivities, setRecentActivities] = useState<Activity[]>([]);
  const [undoError, setUndoError] = useState<string | null>(null);
  const [showQuestDetails, setShowQuestDetails] = useState(false);
  const [showZonesManager, setShowZonesManager] = useState(false);
  const [lastOutAmount, setLastOutAmount] = useState(0);
  const [lastOutHours, setLastOutHours] = useState(0);
  const [costPerHour, setCostPerHour] = useState(0);
  const isFocusMode = settings?.focusMode ?? false;
  const [heatmapRange, setHeatmapRange] = useState<30 | 60 | 90>(30);
  const [heatmapDays, setHeatmapDays] = useState<HeatmapDay[]>([]);
  const [showAddObligationModal, setShowAddObligationModal] = useState(false);
  const [newObligationName, setNewObligationName] = useState('');
  const [newObligationAmountRaw, setNewObligationAmountRaw] = useState('');
  const [newObligationPriority, setNewObligationPriority] = useState<1 | 2 | 3>(2);
  const [newObligationError, setNewObligationError] = useState<string | null>(null);

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
       const nonTransfer = txs.filter((tx) => !tx.tags?.includes('internal_transfer'));
       const netIn = nonTransfer.filter((tx) => tx.direction === 'IN').reduce((sum, tx) => sum + tx.amount, 0);
       const netOut = nonTransfer.filter((tx) => tx.direction === 'OUT').reduce((sum, tx) => sum + tx.amount, 0);
       const net = netIn - netOut;
       const debtPrincipalIn = nonTransfer
         .filter((tx) => tx.direction === 'IN' && tx.tags?.includes('debt_principal'))
         .reduce((sum, tx) => sum + tx.amount, 0);
       const earnedIn = netIn - debtPrincipalIn;
       const earnedNet = earnedIn - netOut;
       const obligationsTotal = obligations.reduce((sum, obl) => sum + obl.totalAmount, 0);
       const questKind = (activeQuest?.kind ?? 'earned_climb') as QuestKind;
        const questBaseline = activeQuest?.baselineAmount ?? obligationsTotal;
        const questShadowDebt = activeQuest?.shadowDebt ?? 0;
        const target = activeQuest?.targetAmount ?? nextSettings?.selfReportedDebt ?? 0;
        let progressAmount = 0;
        let progress = 0;
        if (questKind === 'debt_cut') {
          const start = questBaseline > 0 ? questBaseline : obligationsTotal;
          const span = Math.max(1, target);
          const reduced = Math.max(0, start - obligationsTotal);
          progressAmount = Math.min(reduced, span);
          progress = Math.min(progressAmount / span, 1);
        } else if (questKind === 'recovery_map') {
          const currentDebt = obligationsTotal + questShadowDebt;
          const recoveryScore = earnedNet - currentDebt;
          const span = Math.max(1, target);
          const shifted = recoveryScore + questBaseline;
          progressAmount = Math.max(0, Math.min(shifted, span));
          progress = Math.min(progressAmount / span, 1);
        } else {
          progressAmount = Math.max(0, Math.min(earnedNet, target));
          progress = target > 0 ? Math.min(progressAmount / target, 1) : 0;
        }

      const days: string[] = [];
      for (let i = 29; i >= 0; i -= 1) {
        days.push(addDaysISO(nowISO, -i));
      }
      const dailyNet: Record<string, number> = {};
      for (const day of days) dailyNet[day] = 0;
      for (const tx of nonTransfer) {
        const current = dailyNet[tx.dateISO];
        if (current !== undefined) {
          dailyNet[tx.dateISO] = current + (tx.direction === 'IN' ? tx.amount : -tx.amount);
        }
      }
      const netHistory = days.map((day) => dailyNet[day] ?? 0);

       const currentMonth = nowISO.slice(0, 7);
       const monthTxs = txs.filter((tx) => tx.dateISO.startsWith(currentMonth) && !tx.tags?.includes('internal_transfer'));
       const inMonth = monthTxs.filter((tx) => tx.direction === 'IN').reduce((sum, tx) => sum + tx.amount, 0);
       const outMonth = monthTxs.filter((tx) => tx.direction === 'OUT').reduce((sum, tx) => sum + tx.amount, 0);
       const spendMonth = monthTxs
         .filter((tx) => tx.direction === 'OUT' && tx.categoryId !== 'cat_obligations')
         .reduce((sum, tx) => sum + tx.amount, 0);
       const questName = activeQuest?.name ?? 'Main Quest';
       const questTier = activeQuest?.tier;

       const heatmapWindow = 90;
       const onboardingISO = nextSettings?.onboardingCompletedAt
         ? dateISOInTimeZone(new Date(nextSettings.onboardingCompletedAt), tz)
         : '';
       const windowStart = addDaysISO(nowISO, -(heatmapWindow - 1));
       const clampedStart = onboardingISO && onboardingISO > windowStart
         ? onboardingISO
         : windowStart;
       const heatmapStart = clampedStart > nowISO ? nowISO : clampedStart;
       const heatmapSpan = Math.max(0, daysBetweenISO(heatmapStart, nowISO));
       const heatmapMap: Record<string, number> = {};
       for (let i = 0; i <= heatmapSpan; i += 1) {
         const day = addDaysISO(heatmapStart, i);
         heatmapMap[day] = 0;
       }
        for (const tx of nonTransfer) {
          if (tx.direction !== 'OUT') continue;
          if (tx.categoryId === 'cat_obligations') continue;
          const current = heatmapMap[tx.dateISO];
          if (current !== undefined) {
            heatmapMap[tx.dateISO] = current + tx.amount;
          }
        }
       const heatmap = Object.keys(heatmapMap)
         .sort((a, b) => a.localeCompare(b))
         .map((dateISO) => ({ dateISO, amount: heatmapMap[dateISO] ?? 0 }));

      const hourly = nextSettings?.monthlyIncome && nextSettings?.hoursPerWeek
        ? nextSettings.monthlyIncome / (nextSettings.hoursPerWeek * 4)
        : 0;
      const lastOutTx = nonTransfer
        .filter((tx) => tx.direction === 'OUT')
        .sort((a, b) => b.createdAt - a.createdAt)[0];
      const lastOutValue = lastOutTx?.amount ?? 0;
      const lastOutTime = hourly > 0 ? lastOutValue / hourly : 0;

       const activities = await db.activities.orderBy('createdAt').reverse().limit(5).toArray();

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

       return { rows, progress, progressAmount, target, net, earnedNet, debtPrincipalIn, netIn, netOut, netHistory, nowISO, pending, inMonth, outMonth, spendMonth, obligationsTotal, allZones, balances, obligations, activities, lastOutValue, lastOutTime, hourly, heatmap, questKind, questName, questBaseline, questTier, questShadowDebt };
     }).subscribe(({ rows, progress, progressAmount, target, net, earnedNet, debtPrincipalIn, netIn, netOut, netHistory, nowISO, pending, inMonth, outMonth, spendMonth, obligationsTotal, allZones, balances, obligations, activities, lastOutValue, lastOutTime, hourly, heatmap, questKind, questName, questBaseline, questTier, questShadowDebt }) => {
      setDueRows(rows);
      setQuestProgress(progress);
      setQuestProgressAmount(progressAmount);
      setQuestTarget(target);
      setQuestNet(net);
      setQuestEarnedNet(earnedNet);
      setBorrowedPrincipal(debtPrincipalIn);
      setQuestNetIn(netIn);
      setQuestNetOut(netOut);
      setQuestNetHistory(netHistory);
      setQuestKind(questKind);
      setQuestName(questName);
      setQuestBaseline(questBaseline);
      setQuestTier(questTier);
      setQuestShadowDebt(questShadowDebt);
      setTodayISO(nowISO);
      setPendingObligationCount(pending);
      setMoneyInMonth(inMonth);
      setMoneyOutMonth(outMonth);
      setSpendOutMonth(spendMonth);
      setObligationsRemaining(obligationsTotal);
      setZones(allZones);
      setZoneBalances(balances);
      setAllObligations(obligations);
      setRecentActivities(activities);
      setLastOutAmount(lastOutValue);
      setLastOutHours(lastOutTime);
      setCostPerHour(hourly);
      setHeatmapDays(heatmap);
    });
    return () => sub.unsubscribe();
  }, []);

  const dueSoon = useMemo(() => dueRows.slice(0, 2), [dueRows]);
  const percent = Math.round(questProgress * 100);
  const ringRadius = 54;
  const circumference = 2 * Math.PI * ringRadius;
  const zoneItems = useMemo<ZoneItem[]>(() => {
    const zoneHqBalance = zoneBalances.zone_hq ?? 0;
    const hqTone = zoneHqBalance === 0 ? 'neutral' : zoneHqBalance > 0 ? 'positive' : 'negative';
    const hqSign = zoneHqBalance === 0 ? '' : zoneHqBalance > 0 ? '+' : '-';
    const moneyInTone = moneyInMonth === 0 ? 'neutral' : 'positive';
    const moneyInSign = moneyInMonth > 0 ? '+' : '';
    const derived: ZoneItem[] = [
      { id: 'money_in', name: 'Money In', amount: moneyInMonth, sign: moneyInSign, tone: moneyInTone, transferable: true, zoneId: 'zone_hq', system: true },
      { id: 'money_out', name: 'Money Out', amount: moneyOutMonth, sign: '-', tone: 'negative', transferable: false, system: true },
      { id: 'obligations', name: 'Obligations', amount: obligationsRemaining, sign: '-', tone: 'negative', transferable: false, system: true },
    ];

    const assets: ZoneItem[] = zones
      .filter((zone) => zone.kind === 'asset' && zone.id !== 'zone_hq')
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
    const n = Number(digitsOnly(paidAmountRaw));
    if (!Number.isFinite(n) || n <= 0) {
      setConfirmError('Enter a valid amount.');
      return;
    }
    setIsSaving(true);
    try {
      await confirmObligationPaid(confirm.obligationId, confirm.cycleId, n);
      setConfirm(null);
      setConfirmError(null);
      setPaidAmountRaw('');
    } catch (e) {
      setConfirmError(e instanceof Error ? e.message : 'Failed to confirm payment.');
    } finally {
      setIsSaving(false);
    }
  }

  function resetNewObligationForm() {
    setNewObligationName('');
    setNewObligationAmountRaw('');
    setNewObligationPriority(2);
    setNewObligationError(null);
  }

  async function saveNewObligation() {
    const name = newObligationName.trim();
    const amount = Number(digitsOnly(newObligationAmountRaw));
    if (!name) {
      setNewObligationError('Enter an obligation name.');
      return;
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setNewObligationError('Enter a valid amount.');
      return;
    }

    setIsSaving(true);
    setNewObligationError(null);
    try {
      await createObligation({ name, totalAmount: amount, priority: newObligationPriority });
      setShowAddObligationModal(false);
      resetNewObligationForm();
    } catch (e) {
      setNewObligationError(e instanceof Error ? e.message : 'Failed to add obligation.');
    } finally {
      setIsSaving(false);
    }
  }

  async function undoRecentActivities() {
    if (!recentActivities.length) return;
    setUndoError(null);
    try {
      const latest = await db.activities.orderBy('createdAt').reverse().limit(1).toArray();
      const latestId = latest[0]?.id;
      const currentId = recentActivities[0]?.id;
      if (!latestId || !currentId || latestId !== currentId) {
        setUndoError('Recent actions changed. Refresh to undo latest.');
        return;
      }
      await undoActivities([currentId]);
    } catch (e) {
      setUndoError(e instanceof Error ? e.message : 'Failed to undo actions.');
    }
  }

  function formatActivityDate(ts: number): string {
    return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  }

  function activityTitle(activity: Activity): string {
    if (activity.type === 'transaction_added') {
      const id = activity.meta?.categoryId ?? '';
      if (id === 'cat_food') return 'Food';
      if (id === 'cat_transport') return 'Transport';
      if (id === 'cat_utilities') return 'Utilities';
      if (id === 'cat_fun') return 'Fun';
      if (id === 'cat_growth') return 'Growth';
      if (id === 'cat_salary') return 'Salary';
      if (id === 'cat_freelance') return 'Freelance';
      if (id === 'cat_gift') return 'Gift';
      if (id === 'cat_refund') return 'Refund';
      if (id === 'cat_debt') return 'Borrowed';
      if (id === 'cat_obligations') return 'Obligations';
      return activity.title;
    }
    return activity.title;
  }

  function activityBadge(activity: Activity): string {
    if (activity.type === 'obligation_planned') return 'PLAN';
    if (activity.type === 'confirmed_paid') return 'PAID';
    if (activity.type === 'transfer_created') return 'MOVE';
    if (activity.type === 'transaction_added') return activity.direction === 'IN' ? 'IN' : 'OUT';
    return 'ACT';
  }

  function activityAmount(activity: Activity): string {
    if (!activity.amount) return '';
    if (isFocusMode) return '****';
    return `${formatMillions(activity.amount)} VND`;
  }

  const questProgressTarget = questKind === 'debt_cut'
    ? Math.max(1, questTarget)
    : questTarget || 0;
  const questRemaining = Math.max(0, questProgressTarget - questProgressAmount);
  const questProgressLabel = questKind === 'debt_cut'
    ? 'Debt Reduced'
    : questKind === 'recovery_map'
      ? 'Recovery Score'
      : 'Earned Net';
  const questTargetLabel = questKind === 'debt_cut'
    ? 'Target debt cleared'
    : questKind === 'recovery_map'
      ? 'Target recovery score'
      : 'Target earned net';
  const questTierStars = questTier ? `${'★'.repeat(questTier)}${'☆'.repeat(3 - questTier)}` : '';
  const questHeroSubtitle = questKind === 'debt_cut'
    ? 'Every Confirm Paid shrinks your remaining debt.'
    : questKind === 'recovery_map'
      ? 'Score rises with earned net and falls with remaining debt.'
      : 'Earned net ignores borrowed cash so progress stays honest.';
  const questHeroTargetLine = isFocusMode
    ? 'Focus Mode hides amounts on passive screens.'
    : questKind === 'recovery_map'
      ? ''
      : `${questTargetLabel}: ${formatVnd(questTarget || 0, { compact: true })} VND`;
  const questRemainingLabel = questKind === 'debt_cut'
    ? 'Reduction remaining'
    : questKind === 'recovery_map'
      ? 'Score remaining'
      : 'Remaining to target';
  const questProgressTargetDisplay = questProgressTarget > 0
    ? formatVnd(questProgressTarget, { compact: true, isFocus: isFocusMode })
    : isFocusMode
      ? '****'
      : '—';
  const questProgressAmountDisplay = formatVnd(questProgressAmount, { compact: true, isFocus: isFocusMode });
  const questBaselineDisplay = formatVnd(questBaseline, { compact: true, isFocus: isFocusMode });
  const questShadowDebtDisplay = formatVnd(questShadowDebt, { compact: true, isFocus: isFocusMode });
  const maxNetAbs = Math.max(1, ...questNetHistory.map((v) => Math.abs(v)));
  const dailyCap = settings?.monthlyCap ? settings.monthlyCap / 30 : 0;
  const heatmapSlice = heatmapDays.slice(-heatmapRange);
  const heatmapStart = heatmapSlice[0]?.dateISO ?? '';
  const heatmapEnd = heatmapSlice[heatmapSlice.length - 1]?.dateISO ?? '';
  const heatmapCells = useMemo(() => {
    const firstDay = heatmapSlice[0];
    if (!firstDay) return [] as Array<HeatmapDay | null>;
    const blanks = weekdayIndex(firstDay.dateISO);
    const cells: Array<HeatmapDay | null> = [];
    for (let i = 0; i < blanks; i += 1) cells.push(null);
    heatmapSlice.forEach((day) => cells.push(day));
    const remainder = cells.length % 7;
    if (remainder !== 0) {
      for (let i = 0; i < 7 - remainder; i += 1) cells.push(null);
    }
    return cells;
  }, [heatmapSlice]);
  const streak = dailyCap > 0
    ? heatmapSlice.reduceRight((acc, day) => (day.amount <= dailyCap && acc !== -1 ? acc + 1 : -1), 0)
    : 0;
  const streakCount = streak === -1 ? 0 : streak;
  const cap = settings?.monthlyCap ?? 0;
  const capPercent = cap > 0 ? Math.min(100, Math.round((spendOutMonth / cap) * 100)) : 0;
  const weeklyCap = cap > 0 ? cap / 4 : 0;
  const last28 = heatmapDays.slice(-28);
  const weeklySpends = [0, 0, 0, 0];
  last28.forEach((day, idx) => {
    const bucket = Math.floor(idx / 7);
    if (bucket >= 0 && bucket < 4) {
      weeklySpends[bucket] = (weeklySpends[bucket] ?? 0) + day.amount;
    }
  });
  const weeklyPercents = weeklySpends.map((amt) => (weeklyCap > 0 ? Math.min(100, Math.round((amt / weeklyCap) * 100)) : 0));
  const netMonth = moneyInMonth - moneyOutMonth;
  const netPosition = questNet - obligationsRemaining;

  useLayoutEffect(() => {
    if (!infoTip) return;
    const anchor = infoTip.kind === 'quest'
      ? questInfoRef.current
      : infoTip.kind === 'heatmap'
        ? heatmapInfoRef.current
        : infoTip.kind === 'cap'
          ? capInfoRef.current
          : zonesInfoRef.current;

    const update = () => {
      if (!anchor || !infoTipRef.current) return;
      const anchorRect = anchor.getBoundingClientRect();
      const tipRect = infoTipRef.current.getBoundingClientRect();
      const gap = 10;
      const viewportWidth = window.innerWidth;
      const viewportHeight = window.innerHeight;
      const centeredLeft = anchorRect.left + anchorRect.width / 2 - tipRect.width / 2;
      const clampedLeft = Math.max(8, Math.min(centeredLeft, viewportWidth - tipRect.width - 8));
      const placeBelow = anchorRect.bottom + gap + tipRect.height <= viewportHeight - 8;
      const top = placeBelow
        ? anchorRect.bottom + gap
        : Math.max(8, anchorRect.top - gap - tipRect.height);
      setInfoTipPos({ top, left: clampedLeft, placement: placeBelow ? 'bottom' : 'top' });
    };

    update();
    const onScroll = () => update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', onScroll, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', onScroll, true);
    };
  }, [infoTip?.kind]);

  useEffect(() => {
    if (!infoTip) return;
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (infoTipRef.current?.contains(target)) return;
      if (questInfoRef.current?.contains(target)) return;
      if (heatmapInfoRef.current?.contains(target)) return;
      if (capInfoRef.current?.contains(target)) return;
      if (zonesInfoRef.current?.contains(target)) return;
      setInfoTip(null);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setInfoTip(null);
    };
    document.addEventListener('pointerdown', onPointerDown, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('pointerdown', onPointerDown, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [infoTip]);

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
          <button
            className={`pill ${isFocusMode ? 'primary' : ''}`}
            onClick={() => setFocusMode(!isFocusMode)}
          >
            Focus Mode
          </button>
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
                           <div className="due-title">{row.obligation.name} — {formatVnd(row.cycle.amount, { compact: true, isFocus: isFocusMode })} {isFocusMode ? '' : 'VND'}</div>
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
                          setConfirmError(null);
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
              <div className="plan-list">
                {allObligations.length ? (
                  [...allObligations]
                    .sort((a, b) => {
                      const aPlanned = a.cycles.length > 0;
                      const bPlanned = b.cycles.length > 0;
                      if (aPlanned !== bPlanned) return aPlanned ? 1 : -1;
                      return b.totalAmount - a.totalAmount;
                    })
                    .map((obl) => {
                      const isPlanned = obl.cycles.length > 0;
                      return (
                        <div key={obl.id} className="plan-item">
                          <div className="plan-item-left">
                            <div className="plan-item-name">{obl.name}</div>
                            <div className="plan-item-meta num">
                              {formatVnd(obl.totalAmount, { isFocus: isFocusMode })} {isFocusMode ? '' : 'VND'}
                            </div>
                          </div>
                          <div className="plan-item-right">
                            <span className={`chip ${isPlanned ? 'green' : 'red'}`}>
                              {isPlanned ? 'Planned' : 'Needs plan'}
                            </span>
                          </div>
                        </div>
                      );
                    })
                ) : (
                  <div className="small muted">No obligations yet. Add one to start planning.</div>
                )}
              </div>
              <button className="onboarding-add" onClick={() => setShowAddObligationModal(true)}>+ Add another</button>
              {pendingObligationCount > 0 ? (
                <div className="cta-row">
                  <button className="pill primary" onClick={() => setShowObligationPlanner(true)}>Plan →</button>
                </div>
              ) : null}
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
              <div className="hero-card-inner">
                <div className="hero-content">
                  <div className="hero-label-row">
                    <div className="hero-label">Main Quest</div>
                    <button
                      className="info-button"
                      type="button"
                      ref={questInfoRef}
                      onClick={() => setInfoTip((current) => (current?.kind === 'quest' ? null : { kind: 'quest' }))}
                      title="How quest progress is calculated"
                      aria-label="Quest info"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </button>
                  </div>
                  <div className="hero-title num">{questName}</div>
                  <p className="hero-subtitle">
                    {questHeroSubtitle}
                    {questTierStars ? ` Difficulty ${questTierStars}.` : ''}
                  </p>
                  {questHeroTargetLine ? <div className="hero-meta">{questHeroTargetLine}</div> : null}
                  <button className="pill hero-button" onClick={() => setShowQuestDetails(true)}>View Details</button>
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
                      {isFocusMode ? (
                        <span className="num" style={{ fontSize: '36px', fontWeight: 700, lineHeight: 1 }}>{percent}%</span>
                      ) : (
                        <>
                          <span className="num" style={{ fontSize: '36px', fontWeight: 700, lineHeight: 1 }}>{questProgressAmountDisplay}</span>
                          <span className="small muted" style={{ fontSize: '16px', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.08em', marginTop: '6px' }}>OF {questProgressTargetDisplay}</span>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <div>
                  <div className="title-with-info">
                    <h2>Discipline Heatmap</h2>
                    <button
                      className="info-button"
                      type="button"
                      ref={heatmapInfoRef}
                      onClick={() => setInfoTip((current) => (current?.kind === 'heatmap' ? null : { kind: 'heatmap' }))}
                      title="How the heatmap is calculated"
                      aria-label="Heatmap info"
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <circle cx="12" cy="12" r="10" />
                        <line x1="12" y1="16" x2="12" y2="12" />
                        <line x1="12" y1="8" x2="12.01" y2="8" />
                      </svg>
                    </button>
                  </div>
                  <div className="small muted">Streak: <span className="num">{streakCount}</span> days</div>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ display: 'flex', gap: 6 }}>
                    {[30, 60, 90].map((range) => (
                      <button
                        key={range}
                        className={`tab-pill ${heatmapRange === range ? 'active' : ''}`}
                        onClick={() => setHeatmapRange(range as 30 | 60 | 90)}
                        style={{ padding: '6px 12px', fontSize: 12 }}
                      >
                        {range}d
                      </button>
                    ))}
                  </div>
                  <div className="heatmap-legend">
                    <span style={{ background: '#ede9ff' }} />
                    <span style={{ background: '#d8d0ff' }} />
                    <span style={{ background: '#b7a7ff' }} />
                    <span style={{ background: '#8f7bff' }} />
                    <span style={{ background: '#6b5bff' }} />
                  </div>
                </div>
              </div>
              <div className="heatmap-scroll">
                <div className="heatmap-content">
                  <div className="heatmap">
                    {heatmapCells.map((day, idx) => {
                      if (!day) return <span key={`blank-${idx}`} className="heatmap-empty" />;
                      const colors = ['#ede9ff', '#d8d0ff', '#b7a7ff', '#8f7bff', '#6b5bff'];
                      const level = heatmapLevel(day.amount, dailyCap);
                      const title = isFocusMode
                        ? `${day.dateISO}: ****`
                        : dailyCap > 0
                          ? `${day.dateISO}: ${formatNumberWithCommas(day.amount)} / ${formatNumberWithCommas(Math.round(dailyCap))} VND`
                          : `${day.dateISO}: ${formatNumberWithCommas(day.amount)} VND`;
                      return <span key={day.dateISO} style={{ background: colors[level] }} title={title} />;
                    })}
                  </div>
                  <div className="heatmap-footer">
                    <span>{heatmapStart ? heatmapStart : '...'}</span>
                    <span>{heatmapEnd ? heatmapEnd : '...'}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="card">
              <div className="section-title">
                <div className="title-with-info">
                  <h2>Monthly Cap</h2>
                  <button
                    className="info-button"
                    type="button"
                    ref={capInfoRef}
                    onClick={() => setInfoTip((current) => (current?.kind === 'cap' ? null : { kind: 'cap' }))}
                    title="How monthly cap is calculated"
                    aria-label="Monthly cap info"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button>
                </div>
                <span className="small muted" style={{ color: capPercent >= 100 ? '#ef4444' : capPercent >= 80 ? '#f59e0b' : undefined }}>
                  {capPercent}% used
                </span>
              </div>
              <div className="progress-bar" style={{ marginBottom: 12 }}>
                <span style={{ width: `${capPercent}%` }} />
              </div>
              <div className="small muted" style={{ marginBottom: 10 }}>
                {cap > 0 ? (
                  <span className="num">
                    {isFocusMode ? '**** / ****' : `${formatCompactVND(spendOutMonth)} / ${formatCompactVND(cap)} VND`}
                  </span>
                ) : (
                  'Set a monthly cap to track usage.'
                )}
              </div>
              <div className="mini-bars">
                {weeklyPercents.map((pct, idx) => (
                  <div key={idx} className="mini-bar" style={{ width: `${pct}%` }} />
                ))}
              </div>
            </div>
          </section>

          <section className="column right-col no-scrollbar">
            <div className="card">
              <div className="section-title">
                <div className="title-with-info">
                  <h2>Zones</h2>
                  <button
                    className="info-button"
                    type="button"
                    ref={zonesInfoRef}
                    onClick={() => setInfoTip((current) => (current?.kind === 'zones' ? null : { kind: 'zones' }))}
                    title="What zones are"
                    aria-label="Zones info"
                  >
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <circle cx="12" cy="12" r="10" />
                      <line x1="12" y1="16" x2="12" y2="12" />
                      <line x1="12" y1="8" x2="12.01" y2="8" />
                    </svg>
                  </button>
                </div>
                <div className="zones-header-actions">
                  <button className="action-link" onClick={() => setShowZonesManager(true)}>Edit</button>
                </div>
              </div>
              <div className="zones-stack">
                {zoneItems.map((zone) => (
                  <div key={zone.id} className={`zone-card ${zone.system ? 'system' : ''}`}>
                    <div className="zone-card-head">
                      <div className="zone-label-row">
                        <div className="zone-label">{zone.name}</div>
                        {zone.system ? <span className="zone-system-tag">System</span> : null}
                      </div>
                      {zone.transferable ? (
                        <button
                          className="action-link"
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
                      {!isFocusMode && zone.sign ? <span className="zone-sign">{zone.sign}</span> : null}
                      {isFocusMode ? '****' : formatNumberWithCommas(zone.amount)} {isFocusMode ? null : <span className="zone-currency">VND</span>}
                    </div>
                  </div>
                ))}
                {zoneItems.length <= 3 ? (
                  <div className="small muted" style={{ paddingLeft: 4 }}>
                    Add zones like Bank, Cash, or Savings to start transferring.{' '}
                    <button className="action-link" onClick={() => setShowZonesManager(true)}>Add zones</button>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="card">
              <div className="row-title">Last OUT</div>
              {lastOutAmount > 0 ? (
                <>
                  <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
                    {lastOutHours > 0 ? `≈ ${lastOutHours.toFixed(1)}h` : `${formatVnd(lastOutAmount, { isFocus: isFocusMode })}${isFocusMode ? '' : ' VND'}`}
                  </div>
                  <div className="small muted">
                    {lastOutHours > 0
                      ? isFocusMode
                        ? 'Based on your cost-per-hour'
                        : `Based on your cost-per-hour (${formatNumberWithCommas(Math.round(costPerHour))} VND/h)`
                      : 'Set monthly income to see cost-per-hour'}
                  </div>
                </>
              ) : (
                <div className="small muted">No recent OUT transactions.</div>
              )}
            </div>

            <div className="card">
              <div className="section-title no-wrap" style={{ alignItems: 'center' }}>
                <h2>Recent Actions</h2>
                <button
                  className="action-link"
                  onClick={() => void undoRecentActivities()}
                  disabled={!recentActivities.length}
                >
                  Undo latest
                </button>
              </div>
              <div className="recent-actions">
                {recentActivities.length ? (
                  recentActivities.map((activity) => (
                    <div key={activity.id} className="recent-action-row">
                      <div className={`recent-action-badge type-${activity.type} ${activity.direction === 'IN' ? 'dir-in' : activity.direction === 'OUT' ? 'dir-out' : ''}`}>
                        {activityBadge(activity)}
                      </div>
                      <div className="recent-action-body">
                        <div className="recent-action-title">{activityTitle(activity)}</div>
                        <div className="recent-action-meta">
                          <span>{formatActivityDate(activity.createdAt)}</span>
                        </div>
                      </div>
                      <div className="recent-action-amount num">{activityAmount(activity)}</div>
                    </div>
                  ))
                ) : (
                  <div className="small muted">No recent actions yet.</div>
                )}
              </div>
              {undoError ? <div className="small" style={{ color: '#ef4444', marginTop: 8 }}>{undoError}</div> : null}
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
          {confirmError ? <div className="small" style={{ color: '#ef4444', marginTop: 8 }}>{confirmError}</div> : null}
          <div className="cta-row">
            <button className="pill" onClick={() => setConfirm(null)}>Cancel</button>
            <button className="pill primary" onClick={doConfirmPaid} disabled={isSaving}>Confirm</button>
          </div>
        </Modal>
      ) : null}

      {showQuestDetails ? (
        <Modal title="Quest Details" description="Your progress toward the main quest." onClose={() => setShowQuestDetails(false)}>
            <div className="card soft" style={{ marginBottom: 12 }}>
            <div className="small muted">{questProgressLabel}</div>
            <div className="num" style={{ fontSize: 22, fontWeight: 700 }}>
              {questProgressAmountDisplay} out of {questProgressTargetDisplay}
            </div>
            <div className="small muted" style={{ marginTop: 4 }}>{percent}% complete</div>
          </div>
            <div className="card soft" style={{ marginBottom: 12 }}>
              <div className="small muted">{questRemainingLabel}</div>
              <div className="num" style={{ fontSize: 18, fontWeight: 700 }}>{formatVnd(questRemaining, { compact: true, isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}</div>
              <div className="small muted" style={{ marginTop: 6 }}>30-day net trend</div>
              <div className="quest-sparkline">
              {questNetHistory.map((value, idx) => {
                const height = 6 + Math.round((Math.abs(value) / maxNetAbs) * 22);
                const color = value < 0 ? '#ef4444' : value > 0 ? '#10b981' : '#d1d5db';
                return <span key={idx} style={{ height, background: color }} />;
              })}
            </div>
          </div>
          <div className="quest-details-grid">
            <div className="quest-detail">
              <div className="small muted">This Month</div>
              <div className="num" style={{ color: moneyInMonth - moneyOutMonth < 0 ? '#ef4444' : '#10b981' }}>
                {formatVnd(moneyInMonth - moneyOutMonth, { compact: true, isFocus: isFocusMode, showSign: true })}{isFocusMode ? '' : ' VND'}
              </div>
            </div>
            <div className="quest-detail">
              <div className="small muted">Cashflow Net</div>
              <div className="num" style={{ color: questNet < 0 ? '#ef4444' : '#10b981' }}>
                {formatVnd(questNet, { compact: true, isFocus: isFocusMode, showSign: true })}{isFocusMode ? '' : ' VND'}
              </div>
            </div>
            <div className="quest-detail">
              <div className="small muted">Earned Net</div>
              <div className="num" style={{ color: questEarnedNet < 0 ? '#ef4444' : '#10b981' }}>
                {formatVnd(questEarnedNet, { compact: true, isFocus: isFocusMode, showSign: true })}{isFocusMode ? '' : ' VND'}
              </div>
            </div>
            <div className="quest-detail">
              <div className="small muted">Borrowed Principal</div>
              <div className="num">{formatVnd(borrowedPrincipal, { compact: true, isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}</div>
            </div>
            <div className="quest-detail">
              <div className="small muted">Debt Remaining</div>
              <div className="num">{formatVnd(obligationsRemaining, { compact: true, isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}</div>
            </div>
            <div className="quest-detail">
              <div className="small muted">Net Position</div>
              <div className="num" style={{ color: netPosition < 0 ? '#ef4444' : '#10b981' }}>
                {formatVnd(netPosition, { compact: true, isFocus: isFocusMode, showSign: true })}{isFocusMode ? '' : ' VND'}
              </div>
            </div>
            <div className="quest-detail">
              <div className="small muted">Total In</div>
              <div className="num">{formatVnd(questNetIn, { compact: true, isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}</div>
            </div>
            <div className="quest-detail">
              <div className="small muted">Total Out</div>
              <div className="num">{formatVnd(questNetOut, { compact: true, isFocus: isFocusMode })}{isFocusMode ? '' : ' VND'}</div>
            </div>
          </div>
        </Modal>
      ) : null}

      {infoTip ? (
        <div
          ref={infoTipRef}
          className={`info-tooltip ${infoTipPos?.placement === 'top' ? 'is-top' : 'is-bottom'}`}
          role="tooltip"
          style={infoTipPos ? { top: infoTipPos.top, left: infoTipPos.left } : undefined}
        >
          {infoTip.kind === 'quest' ? (
            <>
              <div className="info-tooltip-title">Main Quest</div>
              <div className="info-tooltip-body">
                <div className="small muted" style={{ marginBottom: 8 }}>Quest type: <span className="num">{questKind.replace('_', ' ')}</span></div>
                {questKind === 'debt_cut' ? (
                  <>
                    <div className="small muted">We track how much debt you have cleared.</div>
                    <div className="small muted" style={{ marginTop: 6 }}>Started at: <span className="num">{questBaselineDisplay}</span></div>
                    <div className="small muted">Current remaining: <span className="num">{formatVnd(obligationsRemaining, { compact: true, isFocus: isFocusMode })}</span></div>
                  </>
                ) : questKind === 'recovery_map' ? (
                  <>
                    <div className="small muted">Recovery score = earned net minus remaining debt.</div>
                    <div className="small muted" style={{ marginTop: 6 }}>Earned net: <span className="num">{formatVnd(questEarnedNet, { compact: true, isFocus: isFocusMode })}</span></div>
                    <div className="small muted">Remaining debt: <span className="num">{formatVnd(obligationsRemaining, { compact: true, isFocus: isFocusMode })}</span></div>
                    {questShadowDebt > 0 ? <div className="small muted">Shadow debt: <span className="num">{questShadowDebtDisplay}</span></div> : null}
                  </>
                ) : (
                  <>
                    <div className="small muted">Earned net = income minus spending, excluding borrowed cash.</div>
                    <div className="small muted" style={{ marginTop: 6 }}>Earned net so far: <span className="num">{formatVnd(questEarnedNet, { compact: true, isFocus: isFocusMode })}</span></div>
                    <div className="small muted">Borrowed excluded: <span className="num">{formatVnd(borrowedPrincipal, { compact: true, isFocus: isFocusMode })}</span></div>
                  </>
                )}
                <div className="small muted" style={{ marginTop: 10 }}>Transfers never affect quest progress.</div>
              </div>
            </>
          ) : null}

          {infoTip.kind === 'heatmap' ? (
            <>
              <div className="info-tooltip-title">Discipline Heatmap</div>
              <div className="info-tooltip-body">
                <div className="small muted">Each square is one day of spending.</div>
                <div className="small muted" style={{ marginTop: 6 }}>Daily spend = OUT transactions, excluding obligations and transfers.</div>
                <div className="small muted" style={{ marginTop: 6 }}>Daily cap = monthly cap ÷ 30.</div>
                <div className="small muted" style={{ marginTop: 6 }}>When you’re new, the range starts on your onboarding day instead of showing empty history.</div>
              </div>
            </>
          ) : null}

          {infoTip.kind === 'cap' ? (
            <>
              <div className="info-tooltip-title">Monthly Cap</div>
              <div className="info-tooltip-body">
                <div className="small muted">This shows how much of your monthly cap you have used.</div>
                <div className="small muted" style={{ marginTop: 6 }}>Cap: <span className="num">{formatVnd(cap, { compact: true, isFocus: isFocusMode })}</span></div>
                <div className="small muted">Spent this month: <span className="num">{formatVnd(spendOutMonth, { compact: true, isFocus: isFocusMode })}</span></div>
                <div className="small muted" style={{ marginTop: 6 }}>Obligations and transfers are excluded.</div>
              </div>
            </>
          ) : null}

          {infoTip.kind === 'zones' ? (
            <>
              <div className="info-tooltip-title">Zones</div>
              <div className="info-tooltip-body">
                <div className="small muted">Zones are buckets you move money between.</div>
                <div className="small muted" style={{ marginTop: 6 }}>Money In, Money Out, and Obligations are system defaults.</div>
                <div className="small muted" style={{ marginTop: 6 }}>Add zones like Bank, Cash, or Savings to track where your money sits.</div>
                <div className="small muted" style={{ marginTop: 6 }}>Transfers never affect your quest, heatmap, or cap.</div>
              </div>
            </>
          ) : null}
        </div>
      ) : null}

      {showAddObligationModal ? (
        <Modal
          title="Add obligation"
          description="Log who you owe and the remaining balance."
          onClose={() => {
            setShowAddObligationModal(false);
            resetNewObligationForm();
          }}
        >
          <div className="onboarding-section" style={{ marginBottom: 8 }}>
            <div className="onboarding-field">
              <label className="onboarding-label">Name / Who</label>
              <input
                className="onboarding-input-field"
                placeholder="e.g., Student Loan"
                value={newObligationName}
                onChange={(e) => setNewObligationName(e.target.value)}
              />
            </div>
            <div className="onboarding-field">
              <label className="onboarding-label">Total Owed</label>
              <div className="onboarding-input-icon">
                <span className="onboarding-input-prefix">VND</span>
                <input
                  type="text"
                  inputMode="numeric"
                  className="onboarding-input-field num has-prefix"
                  placeholder="5,000,000"
                  value={newObligationAmountRaw ? formatNumberWithCommas(Number(newObligationAmountRaw)) : ''}
                  onChange={(e) => setNewObligationAmountRaw(digitsOnly(e.target.value))}
                />
              </div>
            </div>
            <div className="onboarding-field">
              <label className="onboarding-label">Priority</label>
              <div className="obligation-priority">
                {[1, 2, 3].map((p) => (
                  <button
                    key={p}
                    className={`priority-button ${newObligationPriority === p ? 'active' : ''} p${p}`}
                    onClick={() => setNewObligationPriority(p as 1 | 2 | 3)}
                  >
                    P{p}
                  </button>
                ))}
              </div>
            </div>
            <div className="small muted">Log new borrowed cash from the Receive tab if it happens today.</div>
          </div>
          {newObligationError ? <div className="onboarding-error">{newObligationError}</div> : null}
          <div className="cta-row">
            <button className="pill" onClick={() => {
              setShowAddObligationModal(false);
              resetNewObligationForm();
            }}>Cancel</button>
            <button className="pill primary" onClick={() => void saveNewObligation()} disabled={isSaving}>Add obligation</button>
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
          zoneBalances={zoneBalances}
          fromZoneId={transferFromZoneId}
        />
      ) : null}

      {showZonesManager ? (
        <ZonesManagerModal
          zones={zones}
          zoneBalances={zoneBalances}
          onClose={() => setShowZonesManager(false)}
        />
      ) : null}

      {settings && !settings.onboardingCompletedAt ? <OnboardingModal /> : null}
    </div>
  );
}
