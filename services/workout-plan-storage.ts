import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WorkoutPlan } from '../types/workoutPlan';
import { withStorageLock } from './storage-lock';

const key = (profileId: string) => `fittrack_workout_plans:${profileId}`;

async function readWorkoutPlans(profileId: string): Promise<WorkoutPlan[]> {
  const raw = await AsyncStorage.getItem(key(profileId));
  if (!raw) return [];
  const parsed: unknown = JSON.parse(raw);
  if (!Array.isArray(parsed)) throw new Error('Saved workout plans are invalid; original data preserved.');
  return parsed as WorkoutPlan[];
}

export function loadWorkoutPlans(profileId: string): Promise<WorkoutPlan[]> {
  return withStorageLock(key(profileId), () => readWorkoutPlans(profileId));
}

export function saveWorkoutPlans(profileId: string, plans: WorkoutPlan[]) {
  return withStorageLock(key(profileId), async () => {
    await readWorkoutPlans(profileId);
    await AsyncStorage.setItem(key(profileId), JSON.stringify(plans));
  });
}

// Read inside the lock so simultaneous edits/deletions use the latest plans.
export function updateWorkoutPlans(profileId: string, update: (plans: WorkoutPlan[]) => WorkoutPlan[]) {
  return withStorageLock(key(profileId), async () => {
    const next = update(await readWorkoutPlans(profileId));
    await AsyncStorage.setItem(key(profileId), JSON.stringify(next));
    return next;
  });
}
