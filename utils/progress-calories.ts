export type ProgressCalorieEntry = { date: string; caloriesBurned?: number };
type CalorieAverage = { average: number | null; workoutCount: number };

function startOfWeek(date: Date) {
  const start = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  start.setDate(start.getDate() - ((start.getDay() + 6) % 7));
  return start;
}

function averageForRange(
  history: ProgressCalorieEntry[],
  start: Date,
  end: Date
): CalorieAverage {
  const calories = history
    .filter((entry) => {
      const date = new Date(entry.date);
      return !Number.isNaN(date.getTime()) && date >= start && date <= end;
    })
    .map((entry) => entry.caloriesBurned)
    .filter((value): value is number =>
      typeof value === 'number' && Number.isFinite(value) && value >= 0
    );

  return {
    average: calories.length
      ? Math.round(calories.reduce((total, value) => total + value, 0) / calories.length)
      : null,
    workoutCount: calories.length,
  };
}

export function calculateProgressCalorieAverages(
  history: ProgressCalorieEntry[],
  now = new Date()
) {
  return {
    week: averageForRange(history, startOfWeek(now), now),
    month: averageForRange(history, new Date(now.getFullYear(), now.getMonth(), 1), now),
  };
}
