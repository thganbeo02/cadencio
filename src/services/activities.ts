import { db } from '../db/database';
import type { Activity, ActivityUndo } from '../types';
import { makeId } from '../utils/id';

export type ActivityInput = Omit<Activity, 'id' | 'createdAt'> & { createdAt?: number };

export async function addActivity(input: ActivityInput): Promise<Activity> {
  const activity: Activity = {
    id: makeId('act'),
    createdAt: input.createdAt ?? Date.now(),
    type: input.type,
    title: input.title,
    amount: input.amount,
    direction: input.direction,
    meta: input.meta,
    undo: input.undo,
  };
  await db.activities.add(activity);
  return activity;
}

export async function undoActivities(activityIds: string[]): Promise<void> {
  if (!activityIds.length) return;
  const activities = await db.activities.bulkGet(activityIds);
  const ordered = activities
    .filter((a): a is Activity => Boolean(a))
    .sort((a, b) => b.createdAt - a.createdAt);

  await db.transaction('rw', db.activities, db.transactions, db.obligations, async () => {
    for (const activity of ordered) {
      const undo = activity.undo as ActivityUndo | undefined;
      if (!undo) continue;

      if (undo.kind === 'transaction') {
        await db.transactions.delete(undo.txId);
      }

      if (undo.kind === 'transfer') {
        await db.transactions.bulkDelete(undo.txIds);
      }

      if (undo.kind === 'obligation_planned') {
        const obl = await db.obligations.get(undo.obligationId);
        if (obl) {
          await db.obligations.update(undo.obligationId, {
            cycles: undo.prevCycles,
            totalAmount: undo.prevTotalAmount,
          });
        }
      }

      if (undo.kind === 'confirmed_paid') {
        await db.transactions.delete(undo.txId);
        const obl = await db.obligations.get(undo.obligationId);
        if (obl) {
          const restored = obl.cycles.map((c) => (c.id === undo.cycleId ? undo.prevCycle : c));
          await db.obligations.update(undo.obligationId, {
            cycles: restored,
            totalAmount: undo.prevTotalAmount,
          });
        }
      }
    }

    await db.activities.bulkDelete(activityIds);
  });
}
