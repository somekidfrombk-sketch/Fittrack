import { withStorageLock } from './storage-lock';
import AsyncStorage from '@react-native-async-storage/async-storage';

import { FoodFavorite, UsdaFood } from '../types/foodLog';

const FOOD_FAVORITES_KEY = 'fittrack_food_favorites';

async function loadAllFavorites(): Promise<FoodFavorite[]> {
  const saved = await AsyncStorage.getItem(FOOD_FAVORITES_KEY);
  if (!saved) return [];
  try {
    const parsed: unknown = JSON.parse(saved);
  if (!Array.isArray(parsed)) throw new Error('Saved collection is invalid; original data preserved.');
    return Array.isArray(parsed) ? (parsed as FoodFavorite[]) : [];
  } catch {
    throw new Error('Saved data could not be read. The original data has been preserved.');
  }
}

export async function loadFoodFavorites(profileId: string) {
  return withStorageLock(FOOD_FAVORITES_KEY, async () => {
    return (await loadAllFavorites()).filter((item) => item.profileId === profileId);
  });
}

export async function addFoodFavorite(profileId: string, food: UsdaFood) {
  return withStorageLock(FOOD_FAVORITES_KEY, async () => {
    const favorites = await loadAllFavorites();
    const existing = favorites.find(
      (item) => item.profileId === profileId && item.food.id === food.id
    );
    const updated = existing
      ? favorites
      : [{ id: `favorite-${Date.now()}`, profileId, food, createdAt: new Date().toISOString() }, ...favorites];
    await AsyncStorage.setItem(FOOD_FAVORITES_KEY, JSON.stringify(updated));
    return updated.filter((item) => item.profileId === profileId);
  });
}

export async function removeFoodFavorite(profileId: string, foodId: string) {
  return withStorageLock(FOOD_FAVORITES_KEY, async () => {
    const favorites = await loadAllFavorites();
    const updated = favorites.filter(
      (item) => !(item.profileId === profileId && item.food.id === foodId)
    );
    await AsyncStorage.setItem(FOOD_FAVORITES_KEY, JSON.stringify(updated));
    return updated.filter((item) => item.profileId === profileId);
  });
}