import Dexie, { type Table } from 'dexie';
import type { Category, Obligation, Quest, SettingsRecord, Transaction } from '../types';

class CadencioDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  obligations!: Table<Obligation, string>;
  quests!: Table<Quest, string>;
  settings!: Table<SettingsRecord, string>;

  constructor() {
    super('CadencioDB');
  }
}

export const db = new CadencioDatabase();

db.version(1).stores({
  transactions: 'id, dateISO, direction, categoryId, createdAt',
  categories: 'id, name, type, isFavorite',
  obligations: 'id, priority',
  quests: 'id, createdAt',
  settings: 'id',
});
