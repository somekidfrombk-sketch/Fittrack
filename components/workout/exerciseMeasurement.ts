import {
  ExerciseRecord,
  exercises,
} from '../exercise-library/exerciseData';

export type ExerciseMeasurementKind =
  | 'weighted'
  | 'bodyweight'
  | 'duration'
  | 'distance';

export type ExerciseMeasurement = {
  kind: ExerciseMeasurementKind;
  primaryLabel: string;
  secondaryLabel: string | null;
  primaryPlaceholder: string;
  secondaryPlaceholder: string | null;
  primaryKeyboard:
    | 'decimal-pad'
    | 'number-pad';
  secondaryKeyboard:
    | 'decimal-pad'
    | 'number-pad'
    | null;
};

const exerciseByName = new Map(
  exercises.map((exercise) => [
    normalize(exercise.name),
    exercise,
  ])
);

function normalize(value: string) {
  return value.trim().toLowerCase();
}

export function getExerciseByName(
  exerciseName: string
) {
  return (
    exerciseByName.get(normalize(exerciseName)) ??
    null
  );
}

function metadataText(
  exercise: ExerciseRecord | null
) {
  if (!exercise) {
    return '';
  }

  return [
    exercise.name,
    exercise.category,
    exercise.body_part,
    exercise.equipment,
    exercise.target,
    exercise.muscle_group,
    ...(exercise.secondary_muscles ?? []),
  ]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
}

function usesExternalWeight(
  text: string
) {
  return [
    'barbell',
    'dumbbell',
    'kettlebell',
    'cable',
    'lever',
    'sled',
    'smith',
    'weighted',
    'ez barbell',
    'hammer strength',
    'medicine ball',
    'resistance band',
  ].some((term) => text.includes(term));
}

function usesBodyweight(
  text: string
) {
  return [
    'push-up',
    'push up',
    'pull-up',
    'pull up',
    'chin-up',
    'chin up',
    'dip',
    'body weight',
    'bodyweight',
    'calisthenics',
    'suspended',
  ].some((term) => text.includes(term));
}

function usesDuration(
  text: string
) {
  return [
    'plank',
    'hold',
    'stretch',
    'isometric',
    'pose',
  ].some((term) => text.includes(term));
}

function usesDistance(
  text: string
) {
  return [
    'cardio',
    'run',
    'walk',
    'cycling',
    'bike',
    'rowing',
    'elliptical',
    'treadmill',
    'distance',
  ].some((term) => text.includes(term));
}

export function getExerciseMeasurement(
  exerciseName: string
): ExerciseMeasurement {
  const text = metadataText(
    getExerciseByName(exerciseName)
  );

  if (usesDistance(text)) {
    return {
      kind: 'distance',
      primaryLabel: 'DISTANCE',
      secondaryLabel: 'TIME',
      primaryPlaceholder: 'mi',
      secondaryPlaceholder: 'min',
      primaryKeyboard: 'decimal-pad',
      secondaryKeyboard: 'decimal-pad',
    };
  }

  if (
    usesDuration(text) &&
    !usesExternalWeight(text)
  ) {
    return {
      kind: 'duration',
      primaryLabel: 'TIME',
      secondaryLabel: null,
      primaryPlaceholder: 'sec',
      secondaryPlaceholder: null,
      primaryKeyboard: 'number-pad',
      secondaryKeyboard: null,
    };
  }

  if (
    usesBodyweight(text) &&
    !usesExternalWeight(text)
  ) {
    return {
      kind: 'bodyweight',
      primaryLabel: 'REPS',
      secondaryLabel: null,
      primaryPlaceholder: '0',
      secondaryPlaceholder: null,
      primaryKeyboard: 'number-pad',
      secondaryKeyboard: null,
    };
  }

  return {
    kind: 'weighted',
    primaryLabel: 'WEIGHT',
    secondaryLabel: 'REPS',
    primaryPlaceholder: '0',
    secondaryPlaceholder: '0',
    primaryKeyboard: 'decimal-pad',
    secondaryKeyboard: 'number-pad',
  };
}
