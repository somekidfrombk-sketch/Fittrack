export type WorkoutSet = {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  exerciseLibraryId?: string;
  trackingMethod?: import('../components/exercise-library/exerciseData').ExerciseTrackingMethod;
  image?: string;
  sets: WorkoutSet[];
};
