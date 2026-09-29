import { exercises, type ExerciseRecord, getExerciseById } from '../exercise-library/exerciseData';
import { getPrimaryMuscleFocuses } from '../exercise-library/exerciseMuscleFilter';
import type { WorkoutHistoryEntry, WorkoutHistoryExercise } from '../../types/workoutHistory';

export type MuscleRecency = {
  muscle: string;
  daysSince: number | null;
  lastWorkedAt: string | null;
  label: string;
};

const dayMs = 24 * 60 * 60 * 1000;

const exercisesByName = new Map(
  exercises.map((exercise) => [
    normalize(exercise.name),
    exercise,
  ])
);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

function startOfLocalDay(date: Date) {
  return new Date(
    date.getFullYear(),
    date.getMonth(),
    date.getDate()
  );
}

function daysBetweenDates(
  laterDate: Date,
  earlierDate: Date
) {
  const later = startOfLocalDay(laterDate);
  const earlier = startOfLocalDay(earlierDate);
  return Math.max(0, Math.round((
    Date.UTC(later.getFullYear(), later.getMonth(), later.getDate()) -
    Date.UTC(earlier.getFullYear(), earlier.getMonth(), earlier.getDate())
  ) / dayMs));
}

function formatMuscleRecency(
  muscle: string,
  daysSince: number | null,
) {
  if (daysSince === null) {
    return `No ${muscle} workouts yet`;
  }

  if (daysSince === 0) {
    return 'Worked today';
  }

  if (daysSince === 1) {
    return `1 day since ${muscle}`;
  }

  return `${daysSince} days since ${muscle}`;
}

export function getExerciseMuscleFocus(
  exerciseName: string
) {
  const exercise =
    exercisesByName.get(normalize(exerciseName));

  if (!exercise) {
    return null;
  }

  return getPrimaryMuscleFocuses(exercise)[0] ?? null;
}

function historyExerciseFocuses(exercise: WorkoutHistoryExercise, customById: Map<string, ExerciseRecord>) {
  if (exercise.muscleGroups?.length || exercise.muscleGroup) {
    return getPrimaryMuscleFocuses({
      id: exercise.exerciseLibraryId ?? exercise.id,
      name: exercise.name,
      muscle_group: exercise.muscleGroup,
      muscleGroups: exercise.muscleGroups,
      isCustom: true,
    });
  }
  const record = customById.get(exercise.exerciseLibraryId ?? '') ??
    getExerciseById(exercise.exerciseLibraryId ?? '') ??
    exercisesByName.get(normalize(exercise.name));
  return record ? getPrimaryMuscleFocuses(record) : [];
}

export function getRecentMuscleWorkouts(
  history: WorkoutHistoryEntry[],
  customExercises: ExerciseRecord[] = [],
  now = new Date()
): MuscleRecency[] {
  const customById = new Map(customExercises.map((exercise) => [exercise.id, exercise]));
  const latest = new Map<string, Date>();

  for (const workout of history) {
    const date = new Date(workout.date);
    if (Number.isNaN(date.getTime()) || startOfLocalDay(date) > startOfLocalDay(now)) continue;
    for (const exercise of workout.exercises) {
      if (!exercise.sets.some((set) => set.completed)) continue;
      for (const muscle of historyExerciseFocuses(exercise, customById)) {
        const previous = latest.get(muscle);
        if (!previous || date > previous) latest.set(muscle, date);
      }
    }
  }

  return [...latest.entries()]
    .sort(([leftMuscle, leftDate], [rightMuscle, rightDate]) =>
      rightDate.getTime() - leftDate.getTime() || leftMuscle.localeCompare(rightMuscle))
    .map(([muscle, date]) => ({
      muscle,
      daysSince: daysBetweenDates(now, date),
      lastWorkedAt: date.toISOString(),
      label: formatMuscleRecency(muscle, daysBetweenDates(now, date)),
    }));
}

export function getMuscleRecencyForExercise(
  exerciseName: string,
  history: WorkoutHistoryEntry[],
  now = new Date()
): MuscleRecency | null {
  const muscle =
    getExerciseMuscleFocus(exerciseName);

  if (!muscle) {
    return null;
  }

  let lastWorkedAt: Date | null = null;

  for (const workout of history) {
    const workoutDate = new Date(workout.date);

    if (Number.isNaN(workoutDate.getTime())) {
      continue;
    }

    const trainedMuscle =
      workout.exercises.some((exercise) => {
        const hasCompletedSet =
          exercise.sets.some(
            (set) => set.completed
          );

        return (
          hasCompletedSet &&
          getExerciseMuscleFocus(exercise.name) ===
            muscle
        );
      });

    if (
      trainedMuscle &&
      (!lastWorkedAt ||
        workoutDate.getTime() >
          lastWorkedAt.getTime())
    ) {
      lastWorkedAt = workoutDate;
    }
  }

  const daysSince = lastWorkedAt
    ? daysBetweenDates(now, lastWorkedAt)
    : null;

  return {
    muscle,
    daysSince,
    lastWorkedAt:
      lastWorkedAt?.toISOString() ?? null,
    label:
      formatMuscleRecency(
        muscle,
        daysSince
      ),
  };
}
