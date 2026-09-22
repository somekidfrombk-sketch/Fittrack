import AsyncStorage from '@react-native-async-storage/async-storage';
import type { ExerciseRecord, ExerciseTrackingMethod } from '../components/exercise-library/exerciseData';
import { withStorageLock } from './storage-lock';

const KEY = 'fittrack_custom_exercises:v1';
const methods: ExerciseTrackingMethod[] = [
  'weight_reps', 'reps', 'duration', 'distance', 'distance_time', 'bodyweight_reps', 'none',
];

function isCustomExercise(value: unknown): value is ExerciseRecord {
  if (!value || typeof value !== 'object') return false;
  const item = value as Partial<ExerciseRecord>;
  return item.isCustom === true && typeof item.id === 'string' && typeof item.name === 'string' &&
    typeof item.muscle_group === 'string' && typeof item.equipment === 'string' &&
    typeof item.category === 'string' && methods.includes(item.trackingMethod as ExerciseTrackingMethod) &&
    (item.image === undefined || typeof item.image === 'string') &&
    (item.instructions === undefined || typeof item.instructions?.en === 'string');
}

async function readCustomExercises() {
  const raw = await AsyncStorage.getItem(KEY);
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed) || !parsed.every(isCustomExercise)) {
    throw new Error('Custom exercise data is invalid; original data preserved.');
  }
  return parsed;
}

export function loadCustomExercises(): Promise<ExerciseRecord[]> {
  return withStorageLock(KEY, readCustomExercises);
}

export function saveCustomExercises(exercises: ExerciseRecord[]) {
  return withStorageLock(KEY, async () => {
    await readCustomExercises();
    await AsyncStorage.setItem(KEY, JSON.stringify(exercises));
  });
}
