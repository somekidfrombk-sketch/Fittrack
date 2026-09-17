import { withStorageLock } from './storage-lock';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { RunEntry } from '../types/run';

const RUN_HISTORY_KEY = 'fittrack_run_history';

const isRunEntry = (value: unknown): value is RunEntry => {
  if (!value || typeof value !== 'object') return false;
  const entry = value as Partial<RunEntry>;
  return typeof entry.id === 'string' && typeof entry.profileId === 'string' &&
    typeof entry.startedAt === 'string' && typeof entry.completedAt === 'string' &&
    typeof entry.durationSeconds === 'number' && typeof entry.distanceMeters === 'number' &&
    typeof entry.caloriesBurned === 'number';
};

export async function loadRunHistory(profileId: string): Promise<RunEntry[]> {
  return withStorageLock(RUN_HISTORY_KEY, async () => {
    const saved = await AsyncStorage.getItem(RUN_HISTORY_KEY);
    if (!saved) return [];
    try {
      const parsed = JSON.parse(saved) as unknown;
      return Array.isArray(parsed)
        ? parsed.filter(isRunEntry).filter((entry) => entry.profileId === profileId)
        : [];
    } catch {
      throw new Error('Saved data could not be read. The original data has been preserved.');
    }
  });
}

export async function saveRun(entry: RunEntry): Promise<RunEntry[]> {
  return withStorageLock(RUN_HISTORY_KEY, async () => {
    const saved = await AsyncStorage.getItem(RUN_HISTORY_KEY);
    let allRuns: RunEntry[] = [];
    try {
      const parsed = saved ? (JSON.parse(saved) as unknown) : [];
      if (!Array.isArray(parsed)) throw new Error('Saved runs are invalid; original data preserved.');
      allRuns = Array.isArray(parsed) ? parsed.filter(isRunEntry) : [];
    } catch {
      throw new Error('Saved runs could not be read. The original data has been preserved.');
    }
    const updated = [entry, ...allRuns.filter((run) => run.profileId !== entry.profileId || run.id !== entry.id)];
    await AsyncStorage.setItem(RUN_HISTORY_KEY, JSON.stringify(updated));
    return updated.filter((run) => run.profileId === entry.profileId);
  });
}
