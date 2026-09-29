import type { ExerciseRecord } from './exerciseData';

export const curatedExercises: ExerciseRecord[] = [
  {
    id: 'fittrack-rowing-machine',
    name: 'Rowing Machine',
    category: 'cardio',
    body_part: 'cardio',
    target: 'cardiovascular system',
    muscle_group: 'full body',
    equipment: 'rowing machine',
    trackingMethod: 'distance_time',
    instructions: {
      en: 'Sit tall with feet secured and arms extended. Drive through your legs, then lean back slightly and pull the handle toward your lower chest. Return by extending your arms, hinging forward, then bending your knees. Log distance and time for each interval.',
    },
  },
];
