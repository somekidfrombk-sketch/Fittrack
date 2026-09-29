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
  muscleGroup?: string;
  muscleGroups?: string[];
  trackingMethod?: import('../components/exercise-library/exerciseData').ExerciseTrackingMethod;
  image?: string;
  comment?: string;
  sets: WorkoutSet[];
};
