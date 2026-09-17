import exercisesJson from '../../assets/exercises/exercises.en.json';
import { hammerStrengthExercises } from './hammerStrengthData';

export type LocalizedText = {
  en?: string;
  it?: string;
  tr?: string;
  es?: string;
  ru?: string;
  zh?: string;
  hi?: string;
  pl?: string;
  ko?: string;
  fr?: string;
  [key: string]: string | undefined;
};

export type LocalizedSteps = {
  en?: string[];
  it?: string[];
  tr?: string[];
  es?: string[];
  ru?: string[];
  zh?: string[];
  hi?: string[];
  pl?: string[];
  ko?: string[];
  fr?: string[];
  [key: string]: string[] | undefined;
};

export type ExerciseRecord = {
  id: string;
  name: string;

  category?: string;
  body_part?: string;
  equipment?: string;

  instructions?: LocalizedText;
  instruction_steps?: LocalizedSteps;

  muscle_group?: string;
  secondary_muscles?: string[];

  target?: string;

  image?: string;
  gif_url?: string;
  media_id?: string;

  created_at?: string;
  attribution?: string;
};

export const exercises = [
  ...(exercisesJson as ExerciseRecord[]),
  ...hammerStrengthExercises,
];

// Build immutable lookup data once instead of allocating strings per keystroke.
const searchIndex = exercises.map((exercise) => ({
  exercise,
  text: Array.from(new Set([
    exercise.name, exercise.category, exercise.body_part, exercise.target,
    exercise.muscle_group, exercise.equipment, ...(exercise.secondary_muscles ?? []),
  ].filter((value): value is string => Boolean(value))
    .map((value) => value.trim().toLowerCase()))).join(' '),
}));
const exercisesById = new Map<string, ExerciseRecord>();
for (const exercise of exercises) {
  if (!exercisesById.has(exercise.id)) exercisesById.set(exercise.id, exercise);
}

export function searchExercises(query: string) {
  const normalized = query.trim().toLowerCase();
  if (!normalized) return exercises;
  return searchIndex.filter((entry) => entry.text.includes(normalized)).map((entry) => entry.exercise);
}

export function getExerciseById(id: string) {
  return exercisesById.get(id);
}

export function getEnglishInstructions(
  exercise: ExerciseRecord
) {
  return (
    exercise.instruction_steps?.en ??
    []
  );
}

export function getEnglishInstructionText(
  exercise: ExerciseRecord
) {
  return (
    exercise.instructions?.en ?? ''
  );
}

export function getEquipmentOptions() {
  return Array.from(
    new Set(
      exercises
        .map(
          (exercise) =>
            exercise.equipment
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )
    )
  ).sort();
}

export function getCategoryOptions() {
  return Array.from(
    new Set(
      exercises
        .map(
          (exercise) =>
            exercise.category
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )
    )
  ).sort();
}

export function getTargetOptions() {
  return Array.from(
    new Set(
      exercises
        .map(
          (exercise) =>
            exercise.target
        )
        .filter(
          (
            value
          ): value is string =>
            Boolean(value)
        )
    )
  ).sort();
}

export const exerciseCount =
  exercises.length;
