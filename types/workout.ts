export type WorkoutSet = {
  id: string;
  weight: string;
  reps: string;
  completed: boolean;
};

export type WorkoutExercise = {
  id: string;
  name: string;
  sets: WorkoutSet[];
};