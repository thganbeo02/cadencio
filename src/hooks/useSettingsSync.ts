import { useEffect } from 'react';
import { liveQuery } from 'dexie';
import { db } from '../db/database';
import { useAppStore } from '../stores/useAppStore';

export function useSettingsSync() {
  useEffect(() => {
    const sub = liveQuery(() => db.settings.get('settings')).subscribe((settings) => {
      if (!settings) return;
      useAppStore.setState({ settings });
    });
    return () => sub.unsubscribe();
  }, []);
}
