import { db } from '../db/database';
import type { Transaction, TransactionDirection } from '../types';
import { makeId } from '../utils/id';
import { dateISOInTimeZone } from '../utils/dates';

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
  return tx;
}

export async function createTransfer(input: CreateTransferInput): Promise<void> {
  const note = input.note?.trim() ? input.note.trim() : undefined;
  await createTransaction({
    amount: input.amount,
    direction: 'OUT',
    categoryId: 'cat_transfer',
    note,
    tags: ['internal_transfer'],
    meta: { fromZoneId: input.fromZoneId, toZoneId: input.toZoneId },
    dateISO: input.dateISO,
  });

  await createTransaction({
    amount: input.amount,
    direction: 'IN',
    categoryId: 'cat_transfer',
    note,
    tags: ['internal_transfer'],
    meta: { fromZoneId: input.fromZoneId, toZoneId: input.toZoneId },
    dateISO: input.dateISO,
  });
}
