export type Weekday =
  | 'Sunday'
  | 'Monday'
  | 'Tuesday'
  | 'Wednesday'
  | 'Thursday'
  | 'Friday'
  | 'Saturday';

export type PlannedExercise = {
  id: string;
  name: string;

  targetSets: string;
  targetReps: string;

  restSeconds: number;
};

export type WorkoutPlan = {
  id: string;

  name: string;

  days: Weekday[];

  exercises: PlannedExercise[];
};
