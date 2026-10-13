import { WorkoutHistoryEntry } from '../types/workoutHistory';
import { estimateWorkoutCalories } from './workout-calories';

export function workoutTimeFields(entry: WorkoutHistoryEntry) {
  const date = new Date(entry.date);
  const two = (value: number) => String(value).padStart(2, '0');
  return {
    day: `${date.getFullYear()}-${two(date.getMonth() + 1)}-${two(date.getDate())}`,
    time: `${two(date.getHours())}:${two(date.getMinutes())}`,
    durationMinutes: String(Math.round(entry.durationSeconds / 60)),
  };
}

export function editWorkoutTime(entry: WorkoutHistoryEntry, day: string, time: string, durationText: string): WorkoutHistoryEntry {
  const dateMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(day.trim());
  const timeMatch = /^([01]\d|2[0-3]):([0-5]\d)$/.exec(time.trim());
  const minutes = Number(durationText.trim());
  if (!dateMatch || !timeMatch || !/^\d+$/.test(durationText.trim()) || !Number.isSafeInteger(minutes) || minutes <= 0) {
    throw new Error('Enter a valid date, 24-hour time, and duration greater than zero.');
  }
  const year = Number(dateMatch[1]);
  const month = Number(dateMatch[2]);
  const dayNumber = Number(dateMatch[3]);
  const date = new Date(year, month - 1, dayNumber, Number(timeMatch[1]), Number(timeMatch[2]));
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== dayNumber ||
      date.getHours() !== Number(timeMatch[1]) || date.getMinutes() !== Number(timeMatch[2]) ||
      !Number.isFinite(minutes * 60)) {
    throw new Error('That date or time is not valid.');
  }
  const durationSeconds = Math.round(minutes * 60);
  return {
    ...entry,
    date: date.toISOString(),
    durationSeconds,
    caloriesBurned: entry.caloriesBurned !== undefined && entry.weightLbAtWorkout
      ? estimateWorkoutCalories({ weightLb: entry.weightLbAtWorkout, durationSeconds, intensity: entry.intensity ?? 'moderate' })
      : entry.caloriesBurned,
  };
}
