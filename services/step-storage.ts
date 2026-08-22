import AsyncStorage from '@react-native-async-storage/async-storage';

const STEP_STORAGE_PREFIX = 'fittrack_daily_steps';

function storageKey(profileId: string, date: string) {
  return `${STEP_STORAGE_PREFIX}:${profileId}:${date}`;
}

export async function loadSavedSteps(profileId: string, date: string) {
  const value = await AsyncStorage.getItem(storageKey(profileId, date));
  const steps = Number(value);
  return Number.isFinite(steps) && steps > 0 ? Math.floor(steps) : 0;
}

export async function saveSteps(
  profileId: string,
  date: string,
  steps: number
) {
  await AsyncStorage.setItem(
    storageKey(profileId, date),
    String(Math.max(0, Math.floor(steps)))
  );
}
