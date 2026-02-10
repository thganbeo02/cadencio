import { create } from 'zustand';
import { db } from '../db/database';
import type { Settings, SettingsRecord } from '../types';

interface AppState {
  settings: SettingsRecord | undefined;
  isLoading: boolean;
  loadSettings: () => Promise<void>;
  updateSettings: (updates: Partial<Settings>) => Promise<void>;
  setFocusMode: (value: boolean) => void;
}

export const useAppStore = create<AppState>((set, get) => ({
  settings: undefined,
  isLoading: true,

  loadSettings: async () => {
    const settings = await db.settings.get('settings');
    if (settings) set({ settings });
    set({ isLoading: false });
  },

  updateSettings: async (updates: Partial<Settings>) => {
    const current = get().settings;
    if (!current) return;
    const next = { ...current, ...updates } as SettingsRecord;
    await db.settings.update('settings', updates);
    set({ settings: next });
  },

  setFocusMode: (value: boolean) => {
    void get().updateSettings({ focusMode: value });
  },
}));
