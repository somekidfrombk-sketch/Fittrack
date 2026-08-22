import { WorkoutExercise } from '../../types/workout';

export function createId() {
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function formatTime(seconds: number) {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }

  return `${minutes}:${String(secs).padStart(2, '0')}`;
}

export function calculateVolume(exercises: WorkoutExercise[]) {
  return exercises.reduce(
    (exerciseTotal, exercise) =>
      exerciseTotal +
      exercise.sets.reduce(
        (setTotal, set) =>
          setTotal + (Number(set.weight) || 0) * (Number(set.reps) || 0),
        0
      ),
    0
  );
}

export function countCompletedSets(exercises: WorkoutExercise[]) {
  return exercises.reduce(
    (count, exercise) =>
      count +
      exercise.sets.filter(
        (set) => Number(set.weight) > 0 && Number(set.reps) > 0
      ).length,
    0
  );
}
