import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutExercise } from '../types/workout';
import type { WorkoutIntensity } from '../types/workoutHistory';
import { withStorageLock } from './storage-lock';

export type WorkoutSession = {
  startedAt: number;
  exercises: WorkoutExercise[];
  workoutIntensity: WorkoutIntensity;
  exerciseRestTimes: Record<string, number>;
  prSetIds: string[];
  restEndsAt: number | null;
};

function key(profileId: string) {
  if (!profileId) throw new Error('A profile is required to save a workout session.');
  return `fittrack_workout_session:${profileId}`;
}

export function saveWorkoutSession(profileId: string, session: WorkoutSession | null) {
  const storageKey = key(profileId);
  const snapshot = JSON.stringify(session);
  return withStorageLock(storageKey, () => AsyncStorage.setItem(storageKey, snapshot));
}

export function loadWorkoutSession(profileId: string): Promise<WorkoutSession | null> {
  const storageKey = key(profileId);
  return withStorageLock(storageKey, async () => {
    const raw = await AsyncStorage.getItem(storageKey);
    if (!raw) return null;
    const value = JSON.parse(raw) as WorkoutSession | null;
    if (value === null) return null;
    if (!value || !Number.isFinite(value.startedAt) || value.startedAt <= 0 ||
      !['light', 'moderate', 'vigorous'].includes(value.workoutIntensity) ||
      !Array.isArray(value.exercises) || !value.exercises.every(exercise =>
        exercise && typeof exercise.id === 'string' && typeof exercise.name === 'string' &&
        Array.isArray(exercise.sets) && exercise.sets.every(set => set &&
          typeof set.id === 'string' && typeof set.weight === 'string' &&
          typeof set.reps === 'string' && typeof set.completed === 'boolean')) ||
      !value.exerciseRestTimes || typeof value.exerciseRestTimes !== 'object' ||
      !Object.values(value.exerciseRestTimes).every(time => Number.isFinite(time) && time >= 0) ||
      !Array.isArray(value.prSetIds) || !value.prSetIds.every(id => typeof id === 'string') ||
      !(value.restEndsAt === null || Number.isFinite(value.restEndsAt))) {
      throw new Error('Saved workout session is invalid; original data preserved.');
    }
    return value;
  });
}
