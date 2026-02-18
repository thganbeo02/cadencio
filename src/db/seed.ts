import { db } from './database';
import type { Category, Settings, SettingsRecord, Zone } from '../types';

const DEFAULT_CATEGORIES: Category[] = [
  { id: 'cat_food', name: 'Food & Drink', type: 'OUT', icon: '🍜', isFavorite: true },
  { id: 'cat_transport', name: 'Transport', type: 'OUT', icon: '🚗' },
  { id: 'cat_rent', name: 'Housing', type: 'OUT', icon: '🏠' },
  { id: 'cat_health', name: 'Health', type: 'OUT', icon: '💊' },
  { id: 'cat_obligations', name: 'Obligations', type: 'OUT', icon: '📋' },
  { id: 'cat_salary', name: 'Salary', type: 'IN', icon: '💰', isFavorite: true },
  { id: 'cat_debt', name: 'Borrowed', type: 'IN', icon: '🧾' },
  { id: 'cat_transfer', name: 'Transfer', type: 'OUT', icon: '🔁' },
  { id: 'cat_other', name: 'Other', type: 'OUT', icon: '📦' },
];

const DEFAULT_ZONES: Zone[] = [
  { id: 'zone_hq', name: 'Money In', kind: 'asset', createdAt: Date.now() },
];

const DEFAULT_SETTINGS: Settings = {
  focusMode: true,
  frictionEnabled: true,
  monthlyIncome: undefined,
  hoursPerWeek: 40,
  monthlyCap: 15_000_000,
  salaryDay: 15,
  timezone: (() => {
    try {
      return Intl.DateTimeFormat().resolvedOptions().timeZone;
    } catch {
      return 'UTC';
    }
  })(),
  selfReportedDebt: undefined,
  activeQuestId: undefined,
  onboardingCompletedAt: undefined,
};

export async function seedDatabase(): Promise<void> {
  const [categoryCount, zoneCount, settingsRecord] = await Promise.all([
    db.categories.count(),
    db.zones.count(),
    db.settings.get('settings'),
  ]);

  if (categoryCount === 0) {
    await db.categories.bulkAdd(DEFAULT_CATEGORIES);
  }

  if (zoneCount === 0) {
    await db.zones.bulkAdd(DEFAULT_ZONES);
  }
  const hq = await db.zones.get('zone_hq');
  if (hq && hq.name !== 'Money In') {
    await db.zones.update('zone_hq', { name: 'Money In' });
  }

  if (!settingsRecord) {
    const record: SettingsRecord = { id: 'settings', ...DEFAULT_SETTINGS };
    await db.settings.put(record);
  }
}
