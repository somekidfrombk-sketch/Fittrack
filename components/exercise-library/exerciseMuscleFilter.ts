import type { ExerciseRecord } from './exerciseData';
import type { MuscleFocusLabel } from './InteractiveMuscleMap';

export const muscleFocusOptions = [
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

export function exerciseMatchesMuscle(exercise: ExerciseRecord, muscleLabel: MuscleFocusLabel) {
  const option = muscleFocusOptions.find((item) => item.label === muscleLabel);
  if (!option) return false;

  // Catalog muscle_group and secondary_muscles can describe supporting muscles.
  // Prefer the actual target so a core movement does not appear under Shoulders.
  const primaryMuscles = exercise.isCustom
    ? exercise.muscleGroups?.length ? exercise.muscleGroups : [exercise.muscle_group || exercise.target || exercise.body_part || '']
    : [exercise.target || exercise.body_part || exercise.muscle_group || ''];
  return primaryMuscles.some((muscle) => option.terms.some((term) => muscle.toLowerCase().includes(term)));
}

export function getPrimaryMuscleFocuses(exercise: ExerciseRecord): MuscleFocusLabel[] {
  return muscleFocusOptions
    .filter((option) => exerciseMatchesMuscle(exercise, option.label))
    .map((option) => option.label);
}
