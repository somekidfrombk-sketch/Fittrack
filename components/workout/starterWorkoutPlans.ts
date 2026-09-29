import type { WorkoutPlan } from '../../types/workoutPlan';

export const starterWorkoutPlans: WorkoutPlan[] = [
  {
    id: 'starter-rowing-intervals',
    name: 'Rowing Intervals',
    days: [],
    exercises: [{
      id: 'starter-rowing-machine',
      name: 'Rowing Machine',
      exerciseLibraryId: 'fittrack-rowing-machine',
      trackingMethod: 'distance_time',
      targetSets: '5',
      targetReps: '',
      restSeconds: 60,
    }],
  },
  {
    id: 'starter-cable-upper',
    name: 'Cable Upper Body',
    days: [],
    exercises: [
      { id: 'cable-fly', name: 'cable standing fly', exerciseLibraryId: '0227', muscleGroup: 'pectorals', targetSets: '3', targetReps: '10', restSeconds: 60 },
      { id: 'cable-row', name: 'cable seated row', exerciseLibraryId: '0861', muscleGroup: 'upper back', targetSets: '3', targetReps: '10', restSeconds: 60 },
      { id: 'cable-pulldown', name: 'cable lat pulldown full range of motion', exerciseLibraryId: '2330', muscleGroup: 'lats', targetSets: '3', targetReps: '10', restSeconds: 60 },
      { id: 'cable-lateral-raise', name: 'cable lateral raise', exerciseLibraryId: '0178', muscleGroup: 'delts', targetSets: '3', targetReps: '12', restSeconds: 60 },
      { id: 'cable-curl', name: 'cable curl', exerciseLibraryId: '0868', muscleGroup: 'biceps', targetSets: '3', targetReps: '12', restSeconds: 60 },
      { id: 'cable-triceps', name: 'cable triceps pushdown (v-bar)', exerciseLibraryId: '0241', muscleGroup: 'triceps', targetSets: '3', targetReps: '12', restSeconds: 60 },
    ],
  },
  {
    id: 'starter-cable-lower-core',
    name: 'Cable Lower Body & Core',
    days: [],
    exercises: [
      { id: 'cable-pull-through', name: 'cable pull through (with rope)', exerciseLibraryId: '0196', muscleGroup: 'glutes', targetSets: '3', targetReps: '12', restSeconds: 60 },
      { id: 'cable-hip-extension', name: 'cable standing hip extension', exerciseLibraryId: '0228', muscleGroup: 'glutes', targetSets: '3', targetReps: '12', restSeconds: 60 },
      { id: 'cable-crunch', name: 'cable kneeling crunch', exerciseLibraryId: '0175', muscleGroup: 'abs', targetSets: '3', targetReps: '12', restSeconds: 60 },
    ],
  },
];
