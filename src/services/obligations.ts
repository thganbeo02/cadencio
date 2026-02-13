import { db } from '../db/database';
import type { Obligation, ObligationCycle, ObligationPriority } from '../types';
import { makeId } from '../utils/id';
import { createTransaction } from './transactions';
import { dateISOInTimeZone } from '../utils/dates';
import { addActivity } from './activities';

export interface CreateObligationInput {
  name: string;
  totalAmount: number;
  priority: ObligationPriority;
}

export async function createObligation(input: CreateObligationInput): Promise<Obligation> {
  const name = input.name.trim();
  if (!name) throw new Error('Name is required');
  const totalAmount = Math.round(input.totalAmount);
  if (!Number.isFinite(totalAmount) || totalAmount <= 0) throw new Error('Amount must be > 0');

  const obl: Obligation = {
    id: makeId('obl'),
    name,
    totalAmount,
    priority: input.priority,
    cycles: [],
  };
  await db.obligations.add(obl);
  return obl;
}

export type ObligationPlan =
  | { type: 'one_time'; amount: number; dueDateISO: string }
  | { type: 'monthly'; monthlyAmount: number; dueDay: number; startMonthISO: string }
  | { type: 'split'; upfrontAmount: number; upfrontDueISO: string; monthlyAmount: number; dueDay: number; startMonthISO: string };

function addMonthsISO(ymISO: string, months: number): string {
  const [y = NaN, m = NaN] = ymISO.split('-').map((v) => Number(v));
  const now = new Date();
  const baseYear = Number.isFinite(y) ? y : now.getUTCFullYear();
  const baseMonth = Number.isFinite(m) ? m : now.getUTCMonth() + 1;
  const idx = baseYear * 12 + (baseMonth - 1) + months;
  const outYear = Math.floor(idx / 12);
  const outMonth = (idx % 12) + 1;
  return `${outYear}-${String(outMonth).padStart(2, '0')}-01`;
}

function dateWithDay(ymISO: string, day: number): string {
  const d = Math.min(28, Math.max(1, day));
  return `${ymISO.slice(0, 7)}-${String(d).padStart(2, '0')}`;
}

export async function scheduleObligation(obligationId: string, plan: ObligationPlan): Promise<void> {
  const obl = await db.obligations.get(obligationId);
  if (!obl) throw new Error('Obligation not found');
  if (obl.totalAmount <= 0) return;

  const prevCycles = obl.cycles.slice();
  const prevTotalAmount = obl.totalAmount;

  const newCycles: ObligationCycle[] = [];
  const total = obl.totalAmount;

  if (plan.type === 'one_time') {
    newCycles.push({
      id: makeId('cyc'),
      amount: Math.min(total, Math.round(plan.amount)),
      dueDateISO: plan.dueDateISO,
      cadence: 'one_time',
      status: 'PLANNED',
    });
  }

  if (plan.type === 'monthly') {
    let remaining = total;
    let cursor = plan.startMonthISO;
    let guard = 0;
    while (remaining > 0 && guard < 36) {
      const amt = Math.min(remaining, Math.round(plan.monthlyAmount));
      newCycles.push({
        id: makeId('cyc'),
        amount: amt,
        dueDateISO: dateWithDay(cursor, plan.dueDay),
        cadence: 'monthly',
        status: 'PLANNED',
      });
      remaining -= amt;
      cursor = addMonthsISO(cursor, 1);
      guard += 1;
    }
  }

  if (plan.type === 'split') {
    const upfront = Math.min(total, Math.round(plan.upfrontAmount));
    newCycles.push({
      id: makeId('cyc'),
      amount: upfront,
      dueDateISO: plan.upfrontDueISO,
      cadence: 'one_time',
      status: 'PLANNED',
    });

    let remaining = total - upfront;
    let cursor = plan.startMonthISO;
    let guard = 0;
    while (remaining > 0 && guard < 36) {
      const amt = Math.min(remaining, Math.round(plan.monthlyAmount));
      newCycles.push({
        id: makeId('cyc'),
        amount: amt,
        dueDateISO: dateWithDay(cursor, plan.dueDay),
        cadence: 'monthly',
        status: 'PLANNED',
      });
      remaining -= amt;
      cursor = addMonthsISO(cursor, 1);
      guard += 1;
    }
  }

  const merged = [...obl.cycles, ...newCycles].sort((a, b) => a.dueDateISO.localeCompare(b.dueDateISO));
  await db.obligations.update(obligationId, { cycles: merged });

  await addActivity({
    type: 'obligation_planned',
    title: 'Planned obligation',
    meta: {
      obligationName: obl.name,
      planType: plan.type,
    },
    undo: { kind: 'obligation_planned', obligationId, prevCycles, prevTotalAmount },
  });
}

export async function refreshMissedObligationCycles(now: Date = new Date()): Promise<void> {
  const settings = await db.settings.get('settings');
  const tz = settings?.timezone ?? 'UTC';
  const nowISO = dateISOInTimeZone(now, tz);
  const obligations = await db.obligations.toArray();

  const updates: Array<Promise<unknown>> = [];
  for (const obl of obligations) {
    let changed = false;
    const cycles = obl.cycles.map((c) => {
      if (c.status !== 'PAID' && c.dueDateISO < nowISO) {
        if (c.status !== 'MISSED') {
          changed = true;
          return { ...c, status: 'MISSED' as const };
        }
      }
      return c;
    });
    if (changed) updates.push(db.obligations.update(obl.id, { cycles }));
  }

  await Promise.all(updates);
}

export async function confirmObligationPaid(obligationId: string, cycleId: string, paidAmount: number): Promise<void> {
  await db.transaction('rw', db.obligations, db.transactions, db.settings, db.activities, async () => {
    const obl = await db.obligations.get(obligationId);
    if (!obl) throw new Error('Obligation not found');

    const cycle = obl.cycles.find((c) => c.id === cycleId);
    if (!cycle) throw new Error('Cycle not found');

    const prevCycle = { ...cycle };
    const prevTotalAmount = obl.totalAmount;

    const amount = Math.max(0, Math.round(paidAmount));
    if (!amount) throw new Error('Amount must be > 0');

    const now = Date.now();
    const settings = await db.settings.get('settings');
    const tz = settings?.timezone ?? 'UTC';
    const dateISO = dateISOInTimeZone(new Date(now), tz);

    const tx = await createTransaction({
      amount,
      direction: 'OUT',
      categoryId: 'cat_obligations',
      note: obl.name,
      tags: ['confirmed', 'obligation_payment'],
      confirmedAt: now,
      dateISO,
      meta: { relatedObligationCycleId: cycleId },
      suppressActivity: true,
    });

    const cycles = obl.cycles.map((c) =>
      c.id === cycleId
        ? { ...c, status: 'PAID' as const, confirmedAt: now, amount, autoCreatedTransactionId: tx.id }
        : c
    );

    await db.obligations.update(obligationId, {
      totalAmount: Math.max(obl.totalAmount - amount, 0),
      cycles,
    });

    await addActivity({
      type: 'confirmed_paid',
      title: 'Confirmed paid',
      amount,
      direction: 'OUT',
      meta: {
        obligationName: obl.name,
      },
      undo: {
        kind: 'confirmed_paid',
        obligationId,
        cycleId,
        prevCycle,
        prevTotalAmount,
        txId: tx.id,
      },
    });
  });
}
