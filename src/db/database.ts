import Dexie, { type Table } from 'dexie';
import type { Activity, Category, Obligation, Quest, SettingsRecord, Transaction, Zone } from '../types';

class CadencioDatabase extends Dexie {
  transactions!: Table<Transaction, string>;
  categories!: Table<Category, string>;
  zones!: Table<Zone, string>;
  obligations!: Table<Obligation, string>;
  quests!: Table<Quest, string>;
  settings!: Table<SettingsRecord, string>;
  activities!: Table<Activity, string>;

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

db.version(2).stores({
  transactions: 'id, dateISO, direction, categoryId, createdAt',
  categories: 'id, name, type, isFavorite',
  zones: 'id, kind, createdAt',
  obligations: 'id, priority',
  quests: 'id, createdAt',
  settings: 'id',
});

db.version(3).stores({
  transactions: 'id, dateISO, direction, categoryId, createdAt',
  categories: 'id, name, type, isFavorite',
  zones: 'id, kind, createdAt',
  obligations: 'id, priority',
  quests: 'id, createdAt',
  settings: 'id',
  activities: 'id, type, createdAt',
});
