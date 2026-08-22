import { WorkoutIntensity } from '../types/workoutHistory';

const POUNDS_PER_KILOGRAM = 2.2046226218;

const MET_BY_INTENSITY: Record<WorkoutIntensity, number> = {
  light: 3.5,
  moderate: 5,
  vigorous: 6,
};

export function estimateWorkoutCalories({
  weightLb,
  durationSeconds,
  intensity,
}: {
  weightLb: number;
  durationSeconds: number;
  intensity: WorkoutIntensity;
}) {
  if (
    !Number.isFinite(weightLb) ||
    weightLb <= 0 ||
    !Number.isFinite(durationSeconds) ||
    durationSeconds <= 0
  ) {
    return 0;
  }

  const weightKg = weightLb / POUNDS_PER_KILOGRAM;
  const durationMinutes = durationSeconds / 60;
  const caloriesPerMinute =
    (MET_BY_INTENSITY[intensity] * 3.5 * weightKg) / 200;

  return Math.round(caloriesPerMinute * durationMinutes);
}
