export type NutritionGoal =
  | 'maintain'
  | 'lose'
  | 'gain';

export type MacroTargets = {
  proteinTarget: number;
  carbTarget: number;
  fatTarget: number;
};

type MacroTargetInput = {
  calorieTarget: number;
  weightLb: number;
  goal: NutritionGoal;
  activityLevel:
    | 'sedentary'
    | 'light'
    | 'moderate'
    | 'very';
};

const CALORIES_PER_GRAM = {
  protein: 4,
  carbs: 4,
  fat: 9,
} as const;

const proteinGramsPerPound: Record<
  MacroTargetInput['activityLevel'],
  number
> = {
  sedentary: 0.36,
  light: 0.64,
  moderate: 0.73,
  very: 0.9,
};

const ADULT_MACRO_RANGES = {
  protein: { minimum: 0.1, maximum: 0.35 },
  carbs: { minimum: 0.45, maximum: 0.65 },
  fat: { minimum: 0.2, maximum: 0.35 },
} as const;

export const calculateMacroTargets = ({
  calorieTarget,
  weightLb,
  goal,
  activityLevel,
}: MacroTargetInput): MacroTargets | null => {
  if (
    !Number.isFinite(calorieTarget) ||
    !Number.isFinite(weightLb) ||
    calorieTarget <= 0 ||
    weightLb <= 0
  ) {
    return null;
  }

  const goalProteinAdjustment =
    goal === 'maintain' ? 0 : 0.1;

  const desiredProtein = Math.round(
    weightLb *
      Math.min(
        0.9,
        proteinGramsPerPound[
          activityLevel
        ] + goalProteinAdjustment
      )
  );

  const minimumProtein = Math.ceil(
    (calorieTarget *
      ADULT_MACRO_RANGES.protein.minimum) /
      CALORIES_PER_GRAM.protein
  );

  const maximumProtein = Math.floor(
    (calorieTarget *
      ADULT_MACRO_RANGES.protein.maximum) /
      CALORIES_PER_GRAM.protein
  );

  const desiredFat = Math.round(
    (calorieTarget * 0.25) /
      CALORIES_PER_GRAM.fat
  );

  let bestTargets: MacroTargets | null =
    null;
  let bestScore =
    Number.POSITIVE_INFINITY;

  for (
    let protein = minimumProtein;
    protein <= maximumProtein;
    protein += 1
  ) {
    const caloriesAfterProtein =
      calorieTarget -
      protein *
        CALORIES_PER_GRAM.protein;

    const maximumFat = Math.floor(
      (calorieTarget *
        ADULT_MACRO_RANGES.fat.maximum) /
        CALORIES_PER_GRAM.fat
    );

    for (
      let fat = 0;
      fat <= maximumFat;
      fat += 1
    ) {
      const fatCalories =
        fat *
        CALORIES_PER_GRAM.fat;
      const carbCalories =
        caloriesAfterProtein -
        fatCalories;

      if (
        carbCalories < 0 ||
        carbCalories %
          CALORIES_PER_GRAM.carbs !==
          0
      ) {
        continue;
      }

      const proteinShare =
        (protein * 4) /
        calorieTarget;
      const carbShare =
        carbCalories /
        calorieTarget;
      const fatShare =
        fatCalories /
        calorieTarget;

      if (
        proteinShare <
          ADULT_MACRO_RANGES.protein.minimum ||
        proteinShare >
          ADULT_MACRO_RANGES.protein.maximum ||
        carbShare <
          ADULT_MACRO_RANGES.carbs.minimum ||
        carbShare >
          ADULT_MACRO_RANGES.carbs.maximum ||
        fatShare <
          ADULT_MACRO_RANGES.fat.minimum ||
        fatShare >
          ADULT_MACRO_RANGES.fat.maximum
      ) {
        continue;
      }

      const score =
        Math.abs(
          protein - desiredProtein
        ) * 10 +
        Math.abs(fat - desiredFat);

      if (score < bestScore) {
        bestScore = score;
        bestTargets = {
          proteinTarget: protein,
          carbTarget:
            carbCalories /
            CALORIES_PER_GRAM.carbs,
          fatTarget: fat,
        };
      }
    }
  }

  return bestTargets;
};

export const calculateMacroCalories = (
  targets: MacroTargets
) =>
  targets.proteinTarget *
    CALORIES_PER_GRAM.protein +
  targets.carbTarget *
    CALORIES_PER_GRAM.carbs +
  targets.fatTarget *
    CALORIES_PER_GRAM.fat;
