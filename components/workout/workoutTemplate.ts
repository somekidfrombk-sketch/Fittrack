import type { WorkoutHistoryEntry } from '../../types/workoutHistory';
import type { WorkoutExercise } from '../../types/workout';
import type { WorkoutPlan } from '../../types/workoutPlan';

export function exercisesFromHistoryTemplate(
  entry: WorkoutHistoryEntry,
  createId: () => string
): WorkoutExercise[] {
  return entry.exercises.map((exercise) => ({
    id: createId(),
    name: exercise.name,
    exerciseLibraryId: exercise.exerciseLibraryId,
    muscleGroup: exercise.muscleGroup,
    ...(exercise.muscleGroups?.length ? { muscleGroups: exercise.muscleGroups } : {}),
    trackingMethod: exercise.trackingMethod,
    sets: exercise.sets.map((set) => ({
      id: createId(),
      weight: set.weight,
      reps: set.reps,
      completed: false,
    })),
  }));
}

export function planFromHistoryTemplate(
  entry: WorkoutHistoryEntry,
  name: string,
  createId: () => string
): WorkoutPlan {
  return {
    id: createId(),
    name: name.trim(),
    days: [],
    exercises: entry.exercises.map((exercise) => ({
      id: createId(),
      name: exercise.name,
      exerciseLibraryId: exercise.exerciseLibraryId,
      muscleGroup: exercise.muscleGroup,
      ...(exercise.muscleGroups?.length ? { muscleGroups: exercise.muscleGroups } : {}),
      trackingMethod: exercise.trackingMethod,
      targetSets: String(exercise.sets.length || 1),
      targetReps: exercise.trackingMethod && !['weight_reps', 'reps', 'bodyweight_reps'].includes(exercise.trackingMethod)
        ? ''
        : exercise.sets.find((set) => Number(set.reps) > 0)?.reps ?? '10',
      restSeconds: 60,
    })),
  };
}
