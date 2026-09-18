import { exercises } from '../exercise-library/exerciseData';
import { WorkoutHistoryEntry } from '../../types/workoutHistory';

export type MuscleRecency = {
  muscle: string;
  daysSince: number | null;
  lastWorkedAt: string | null;
  label: string;
};

const dayMs = 24 * 60 * 60 * 1000;

const muscleFocusOptions = [
  { label: 'Chest', terms: ['chest', 'pectorals'] },
  { label: 'Back', terms: ['back', 'lats', 'latissimus', 'rhomboids', 'traps', 'trapezius'] },
  { label: 'Shoulders', terms: ['shoulders', 'delts', 'deltoids', 'rotator cuff'] },
  { label: 'Biceps', terms: ['biceps'] },
  { label: 'Triceps', terms: ['triceps'] },
  { label: 'Forearms', terms: ['forearms', 'lower arms', 'wrist'] },
  { label: 'Core', terms: ['abs', 'abdominals', 'core', 'waist', 'obliques'] },
  { label: 'Glutes', terms: ['glutes', 'hip and glute'] },
  { label: 'Quadriceps', terms: ['quadriceps', 'quads'] },
  { label: 'Hamstrings', terms: ['hamstrings'] },
  { label: 'Calves', terms: ['calves', 'soleus', 'lower legs'] },
] as const;

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
  return Math.max(
    0,
    Math.floor(
      (startOfLocalDay(laterDate).getTime() -
        startOfLocalDay(earlierDate).getTime()) /
        dayMs
    )
  );
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

  const muscleText = [
    exercise.target,
    exercise.muscle_group,
    exercise.body_part,
    ...(exercise.secondary_muscles ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();

  const match = muscleFocusOptions.find((option) =>
    option.terms.some((term) =>
      muscleText.includes(term)
    )
  );

  return match?.label ?? null;
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
