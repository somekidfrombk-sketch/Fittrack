import { withStorageLock } from './storage-lock';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { VitaminEntry } from '../types/vitamin';

const VITAMIN_STORAGE_KEY = 'fittrack_vitamins';

async function loadAllVitamins(): Promise<VitaminEntry[]> {
  const saved = await AsyncStorage.getItem(VITAMIN_STORAGE_KEY);
  if (!saved) return [];
  try {
    const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Saved collection is invalid; original data preserved.');
    return Array.isArray(parsed) ? (parsed as VitaminEntry[]) : [];
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
    const updated = [entry, ...all.filter((item) => item.profileId !== entry.profileId || item.id !== entry.id)];
    await AsyncStorage.setItem(VITAMIN_STORAGE_KEY, JSON.stringify(updated));
    return updated.filter((item) => item.profileId === entry.profileId);
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