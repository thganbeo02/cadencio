import { db } from './database';
import type { Settings, SettingsRecord, Zone } from '../types';
import { DEFAULT_CATEGORIES } from '../constants/categories';

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
  const [zoneCount, settingsRecord] = await Promise.all([
    db.zones.count(),
    db.settings.get('settings'),
  ]);

  await db.categories.bulkPut(DEFAULT_CATEGORIES);

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
