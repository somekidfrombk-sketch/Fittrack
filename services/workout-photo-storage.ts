import AsyncStorage from '@react-native-async-storage/async-storage';
import { ImagePickerAsset } from 'expo-image-picker';
import { withStorageLock } from './storage-lock';
import { deleteWorkoutPhotoFile, persistWorkoutPhoto } from './workout-photo-files';

export type WorkoutPhoto = {
  id: string;
  profileId: string;
  workoutId: string;
  location: string;
  createdAt: string;
};

const keyFor = (profileId: string, workoutId: string) =>
  `fittrack_workout_photos:${profileId}:${workoutId}`;

async function read(key: string): Promise<WorkoutPhoto[]> {
  const raw = await AsyncStorage.getItem(key);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Unable to read saved workout photos.');
  return parsed as WorkoutPhoto[];
}

export function loadWorkoutPhotos(profileId: string, workoutId: string) {
  const key = keyFor(profileId, workoutId);
  return withStorageLock(key, () => read(key));
}

export function addWorkoutPhoto(profileId: string, workoutId: string, asset: ImagePickerAsset) {
  const key = keyFor(profileId, workoutId);
  return withStorageLock(key, async () => {
    const photos = await read(key);
    const id = `photo-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    const location = await persistWorkoutPhoto(asset, id);
    const photo = { id, profileId, workoutId, location, createdAt: new Date().toISOString() };
    try {
      const updated = [...photos, photo];
      await AsyncStorage.setItem(key, JSON.stringify(updated));
      return updated;
    } catch (error) {
      await deleteWorkoutPhotoFile(location).catch(() => undefined);
      throw error;
    }
  });
}

export function removeWorkoutPhoto(profileId: string, workoutId: string, photoId: string) {
  const key = keyFor(profileId, workoutId);
  return withStorageLock(key, async () => {
    const photos = await read(key);
    const photo = photos.find((item) => item.id === photoId);
    const updated = photos.filter((item) => item.id !== photoId);
    await AsyncStorage.setItem(key, JSON.stringify(updated));
    if (photo) await deleteWorkoutPhotoFile(photo.location).catch(console.warn);
    return updated;
  });
}
