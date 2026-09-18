import { withStorageLock } from './storage-lock';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { VitaminEntry, VitaminFoodTiming } from '../types/vitamin';

const VITAMIN_STORAGE_KEY = 'fittrack_vitamins';

function isFoodTiming(value: unknown): value is VitaminFoodTiming {
  return value === 'with-food' || value === 'without-food' || value === 'either';
}

function normalizeVitaminEntry(item: VitaminEntry): VitaminEntry {
  const now = new Date().toISOString();
  return {
    ...item,
    id: String(item.id),
    profileId: String(item.profileId),
    name: typeof item.name === 'string' ? item.name : '',
    dose: typeof item.dose === 'string' ? item.dose : '',
    unit: typeof item.unit === 'string' ? item.unit : undefined,
    servings: typeof item.servings === 'string' ? item.servings : '1',
    frequency: typeof item.frequency === 'string' ? item.frequency : 'Daily',
    preferredTime: typeof item.preferredTime === 'string' ? item.preferredTime : item.time,
    time: typeof item.time === 'string' ? item.time : '08:00',
    foodTiming: isFoodTiming(item.foodTiming) ? item.foodTiming : 'either',
    guidance: typeof item.guidance === 'string' ? item.guidance : '',
    notes: typeof item.notes === 'string' ? item.notes : '',
    referenceId: typeof item.referenceId === 'string' ? item.referenceId : undefined,
    reminderEnabled: Boolean(item.reminderEnabled),
    notificationId: typeof item.notificationId === 'string' ? item.notificationId : undefined,
    takenDates: Array.isArray(item.takenDates) ? item.takenDates.filter((date): date is string => typeof date === 'string') : [],
    createdAt: typeof item.createdAt === 'string' ? item.createdAt : now,
    updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : undefined,
  };
}

async function loadAllVitamins(): Promise<VitaminEntry[]> {
  const saved = await AsyncStorage.getItem(VITAMIN_STORAGE_KEY);
  if (!saved) return [];
  try {
    const parsed: unknown = JSON.parse(saved);
    if (!Array.isArray(parsed)) throw new Error('Saved collection is invalid; original data preserved.');
    return parsed.map((item) => normalizeVitaminEntry(item as VitaminEntry));
  } catch {
    throw new Error('Saved data could not be read. The original data has been preserved.');
  }
}

export async function loadVitamins(profileId: string) {
  return withStorageLock(VITAMIN_STORAGE_KEY, async () => {
    return (await loadAllVitamins()).filter((item) => item.profileId === profileId);
  });
}

export async function saveVitamin(entry: VitaminEntry) {
  return withStorageLock(VITAMIN_STORAGE_KEY, async () => {
    const all = await loadAllVitamins();
    const normalized = normalizeVitaminEntry({ ...entry, updatedAt: new Date().toISOString() });
    const updated = [normalized, ...all.filter((item) => item.profileId !== normalized.profileId || item.id !== normalized.id)];
    await AsyncStorage.setItem(VITAMIN_STORAGE_KEY, JSON.stringify(updated));
    return updated.filter((item) => item.profileId === normalized.profileId);
  });
}

export async function removeVitamin(profileId: string, vitaminId: string) {
  return withStorageLock(VITAMIN_STORAGE_KEY, async () => {
    const all = await loadAllVitamins();
    const updated = all.filter((item) => item.profileId !== profileId || item.id !== vitaminId);
    await AsyncStorage.setItem(VITAMIN_STORAGE_KEY, JSON.stringify(updated));
    return updated.filter((item) => item.profileId === profileId);
  });
}
