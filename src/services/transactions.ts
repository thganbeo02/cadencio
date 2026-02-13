import { db } from '../db/database';
import type { ActivityType, Transaction, TransactionDirection } from '../types';
import { makeId } from '../utils/id';
import { dateISOInTimeZone } from '../utils/dates';
import { addActivity } from './activities';

export type FrictionTag = 'need' | 'growth';

export interface CreateTransactionInput {
  amount: number;
  direction: TransactionDirection;
  categoryId: string;
  note?: string;
  tags?: string[];
  confirmedAt?: number;
  meta?: Transaction['meta'];
  dateISO?: string;
  suppressActivity?: boolean;
}

export interface CreateTransferInput {
  amount: number;
  fromZoneId: string;
  toZoneId: string;
  note?: string;
  dateISO?: string;
}

function uniqueTags(tags: string[] | undefined): string[] | undefined {
  if (!tags || tags.length === 0) return undefined;
  const out: string[] = [];
  const seen = new Set<string>();
  for (const t of tags) {
    const tag = t.trim();
    if (!tag) continue;
    if (seen.has(tag)) continue;
    seen.add(tag);
    out.push(tag);
  }
  return out.length ? out : undefined;
}

async function getTimezone(): Promise<string> {
  const settings = await db.settings.get('settings');
  return settings?.timezone ?? 'UTC';
}

export async function createTransaction(input: CreateTransactionInput): Promise<Transaction> {
  const now = new Date();
  const createdAt = now.getTime();
  const tz = await getTimezone();
  const dateISO = input.dateISO ?? dateISOInTimeZone(now, tz);

  const tx: Transaction = {
    id: makeId('tx'),
    dateISO,
    amount: Math.round(input.amount),
    direction: input.direction,
    categoryId: input.categoryId,
    note: input.note?.trim() ? input.note.trim() : undefined,
    tags: uniqueTags(input.tags),
    confirmedAt: input.confirmedAt,
    meta: input.meta,
    createdAt,
  };

  await db.transactions.add(tx);

  if (!input.suppressActivity && !tx.tags?.includes('internal_transfer')) {
    const activityType: ActivityType = 'transaction_added';
    const title = tx.categoryId === 'cat_obligations'
      ? 'Obligation logged'
      : tx.direction === 'IN'
        ? 'Income logged'
        : 'Expense recorded';
    await addActivity({
      type: activityType,
      title,
      amount: tx.amount,
      direction: tx.direction,
      meta: {
        note: tx.note,
        categoryId: tx.categoryId,
      },
      undo: { kind: 'transaction', txId: tx.id },
    });
  }
  return tx;
}

export async function createTransfer(input: CreateTransferInput): Promise<void> {
  const note = input.note?.trim() ? input.note.trim() : undefined;
  const outTx = await createTransaction({
    amount: input.amount,
    direction: 'OUT',
    categoryId: 'cat_transfer',
    note,
    tags: ['internal_transfer'],
    meta: { fromZoneId: input.fromZoneId, toZoneId: input.toZoneId },
    dateISO: input.dateISO,
    suppressActivity: true,
  });

  const inTx = await createTransaction({
    amount: input.amount,
    direction: 'IN',
    categoryId: 'cat_transfer',
    note,
    tags: ['internal_transfer'],
    meta: { fromZoneId: input.fromZoneId, toZoneId: input.toZoneId },
    dateISO: input.dateISO,
    suppressActivity: true,
  });

  await addActivity({
    type: 'transfer_created',
    title: 'Transfer created',
    amount: input.amount,
    meta: {
      fromZoneId: input.fromZoneId,
      toZoneId: input.toZoneId,
      note,
    },
    undo: { kind: 'transfer', txIds: [outTx.id, inTx.id] },
  });
}
