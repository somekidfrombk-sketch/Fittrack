import AsyncStorage from '@react-native-async-storage/async-storage';

import { FoodLogEntry } from '../types/foodLog';

const FOOD_LOG_STORAGE_KEY =
  'fittrack_food_logs';

async function loadAllFoodLogs() {
  const savedLogs =
    await AsyncStorage.getItem(
      FOOD_LOG_STORAGE_KEY
    );

  if (!savedLogs) {
    return [];
  }

  const parsed: unknown = JSON.parse(savedLogs);

  return Array.isArray(parsed)
    ? (parsed as FoodLogEntry[])
    : [];
}

export async function loadFoodLogs(
  profileId: string
) {
  const logs = await loadAllFoodLogs();

  return logs.filter(
    (entry) =>
      entry.profileId === profileId
  );
}

export async function addFoodLog(
  entry: FoodLogEntry
) {
  const logs = await loadAllFoodLogs();
  const updatedLogs = [...logs, entry];

  await AsyncStorage.setItem(
    FOOD_LOG_STORAGE_KEY,
    JSON.stringify(updatedLogs)
  );

  return updatedLogs.filter(
    (item) =>
      item.profileId === entry.profileId
  );
}

export async function removeFoodLog(
  profileId: string,
  entryId: string
) {
  const logs = await loadAllFoodLogs();
  const updatedLogs = logs.filter(
    (entry) => entry.id !== entryId
  );

  await AsyncStorage.setItem(
    FOOD_LOG_STORAGE_KEY,
    JSON.stringify(updatedLogs)
  );

  return updatedLogs.filter(
    (entry) =>
      entry.profileId === profileId
  );
}
