import AsyncStorage from '@react-native-async-storage/async-storage';

import { loadFoodFavorites } from './food-favorites-storage';
import { loadFoodLogs } from './food-log-storage';
import { loadPhonePedometerEnabled } from './health-connection-storage';
import { loadProfile } from './profile-storage';
import { loadRunNotificationDistance } from './run-notification-settings';
import { loadRunHistory } from './run-storage';
import { loadVitamins } from './vitamin-storage';
import { loadWorkoutHistory } from './workout-history-storage';
import { loadWorkoutPhotos } from './workout-photo-storage';
import { SavedBarcodeProduct } from '../types/foodLog';

const SAVED_PRODUCTS_KEY = 'fittrack_saved_barcode_products';
const STEP_PREFIX = 'fittrack_daily_steps:';

async function loadSavedProducts(profileId: string) {
  const raw = await AsyncStorage.getItem(SAVED_PRODUCTS_KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved custom foods could not be read.');
  return (parsed as SavedBarcodeProduct[])
    .filter((item) => item.profileId === profileId)
    .map(({ packagePhotoUri: _packagePhoto, nutritionPhotoUri: _nutritionPhoto, ...item }) => item);
}

async function loadDailySteps(profileId: string) {
  const prefix = `${STEP_PREFIX}${profileId}:`;
  const keys = (await AsyncStorage.getAllKeys()).filter((key) => key.startsWith(prefix));
  if (!keys.length) return [];
  const values = await AsyncStorage.multiGet(keys);
  return values
    .map(([key, value]) => ({
      date: key.slice(prefix.length),
      steps: Math.max(0, Math.floor(Number(value) || 0)),
    }))
    .sort((left, right) => left.date.localeCompare(right.date));
}

export async function createFitTrackExport() {
  const profile = await loadProfile();
  if (!profile?.id) throw new Error('Save your Profile before exporting data.');

  const profileId = profile.id;
  const [foodLogs, foodFavorites, workouts, activities, vitamins, customFoods, dailySteps, phonePedometerEnabled, runNotificationMiles] = await Promise.all([
    loadFoodLogs(profileId),
    loadFoodFavorites(profileId),
    loadWorkoutHistory(profileId),
    loadRunHistory(profileId),
    loadVitamins(profileId),
    loadSavedProducts(profileId),
    loadDailySteps(profileId),
    loadPhonePedometerEnabled(),
    loadRunNotificationDistance(profileId),
  ]);

  const workoutPhotos = (await Promise.all(workouts.map(async (workout) => ({
    workoutId: workout.id,
    photos: (await loadWorkoutPhotos(profileId, workout.id)).map(({ id, createdAt }) => ({ id, createdAt })),
  })))).filter((item) => item.photos.length > 0);

  const { avatarUri: _avatarUri, ...profileWithoutDevicePhoto } = profile;
  const exportData = {
    format: 'FitTrack user data export',
    schemaVersion: 1,
    exportedAt: new Date().toISOString(),
    units: {
      bodyWeight: 'lb',
      liftingWeight: 'lb',
      distance: 'meters unless a field says miles',
      calories: 'kcal',
      macros: 'grams',
      bodyMeasurements: 'inches',
    },
    noteForChatGPT: 'This is user-provided FitTrack data. Analyze it only according to the user request. Calorie burn values are estimates.',
    profile: profileWithoutDevicePhoto,
    nutrition: { foodLogs, favorites: foodFavorites, customBarcodeFoods: customFoods },
    exercise: { strengthWorkouts: workouts, runningAndCycling: activities },
    progressPhotos: {
      note: 'Photo files are not embedded. These records show which workouts have locally saved photos.',
      workouts: workoutPhotos,
    },
    vitamins,
    steps: dailySteps,
    settings: { phonePedometerEnabled, runNotificationMiles },
  };

  const date = new Date().toISOString().slice(0, 10);
  return {
    filename: `fittrack-export-${date}.json`,
    contents: JSON.stringify(exportData, null, 2),
  };
}
