import { UserContextSnapshot } from './userContext';

export type WorkoutHistorySet = {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
};

export type WorkoutHistoryExercise = {
  id: string;
  name: string;
  trackingMethod?: import('../components/exercise-library/exerciseData').ExerciseTrackingMethod;
  exerciseLibraryId?: string;
  sets: WorkoutHistorySet[];
};

export type WorkoutIntensity =
  | 'light'
  | 'moderate'
  | 'vigorous';

export type WorkoutHistoryEntry = {
  id: string;

  profileId: string;

  date: string;

  durationSeconds: number;

  totalVolume: number;

  completedSets: number;

  caloriesBurned?: number;

  intensity?: WorkoutIntensity;

  weightLbAtWorkout?: number;

  userContext?: UserContextSnapshot;

  exercises: WorkoutHistoryExercise[];
};
