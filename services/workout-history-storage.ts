import { withStorageLock } from './storage-lock';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { WorkoutHistoryEntry } from '../types/workoutHistory';

const WORKOUT_HISTORY_KEY =
  'fittrack_workout_history';

async function loadAllWorkoutHistory(): Promise<
  WorkoutHistoryEntry[]
> {
  const savedHistory =
    await AsyncStorage.getItem(
      WORKOUT_HISTORY_KEY
    );

  if (!savedHistory) {
    return [];
  }

  const parsed: unknown =
    JSON.parse(savedHistory);
  if (!Array.isArray(parsed)) throw new Error('Saved collection is invalid; original data preserved.');

  return Array.isArray(parsed)
    ? (parsed as WorkoutHistoryEntry[])
    : [];
}

export async function loadWorkoutHistory(
  profileId: string
) {
  return withStorageLock(WORKOUT_HISTORY_KEY, async () => {
    const history = await loadAllWorkoutHistory();
    let migrated = false;
    const migratedHistory = history.map(
      (entry) => {
        if (!entry.profileId) {
          migrated = true;
          return { ...entry, profileId };
        }
        return entry;
      }
    );

    if (migrated) {
      await AsyncStorage.setItem(
        WORKOUT_HISTORY_KEY,
        JSON.stringify(migratedHistory)
      );
    }

    return migratedHistory.filter(
      (entry) =>
        entry.profileId === profileId
    );
  });
}

export async function saveWorkoutHistory(
  profileId: string,
  history: WorkoutHistoryEntry[]
) {
  return withStorageLock(WORKOUT_HISTORY_KEY, async () => {
    const allHistory =
      await loadAllWorkoutHistory();
    const otherProfiles = allHistory.filter(
      (entry) =>
        entry.profileId &&
        entry.profileId !== profileId
    );

    await AsyncStorage.setItem(
      WORKOUT_HISTORY_KEY,
      JSON.stringify([
        ...history,
        ...otherProfiles,
      ])
    );
  });
}
