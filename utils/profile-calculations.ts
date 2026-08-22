import {
  ActivityLevel,
  Gender,
  Goal,
  LossRate,
  ProfileData,
} from '../types/profile';
import {
  calculateMacroTargets,
  MacroTargets,
} from './nutrition';

const POUNDS_TO_KILOGRAMS =
  0.45359237;
const INCHES_TO_CENTIMETERS = 2.54;

const activityMultipliers: Record<
  ActivityLevel,
  number
> = {
  sedentary: 1.2,
  light: 1.375,
  moderate: 1.55,
  very: 1.725,
};

const lossDeficits: Record<
  LossRate,
  number
> = {
  '0.5': 250,
  '1': 500,
  '1.5': 750,
  '2': 1000,
};

export type ProfileMetrics = {
  heightInches: number;
  heightCm: number;
  weightLb: number;
  weightKg: number;
  bmi: number | null;
  bodyFat: number | null;
  bmr: number | null;
  maintenanceCalories: number | null;
  calorieTarget: number | null;
  macros: MacroTargets | null;
};

const positiveNumber = (value: string) => {
  const parsed = Number(value);

  return Number.isFinite(parsed) &&
    parsed > 0
    ? parsed
    : 0;
};

export function calculateBmi(
  weightLb: number,
  heightInches: number
) {
  if (
    weightLb <= 0 ||
    heightInches <= 0
  ) {
    return null;
  }

  const result =
    (weightLb * 703) /
    Math.pow(heightInches, 2);

  return Number.isFinite(result)
    ? result
    : null;
}

type BodyFatInput = {
  gender: Gender;
  heightInches: number;
  neck: number;
  waist: number;
  hip: number;
};

export function calculateBodyFat({
  gender,
  heightInches,
  neck,
  waist,
  hip,
}: BodyFatInput) {
  if (
    heightInches <= 0 ||
    neck <= 0 ||
    waist <= 0
  ) {
    return null;
  }

  let result: number;

  if (gender === 'male') {
    if (waist <= neck) {
      return null;
    }

    result =
      86.01 *
        Math.log10(waist - neck) -
      70.041 *
        Math.log10(heightInches) +
      36.76;
  } else {
    const circumference =
      waist + hip - neck;

    if (hip <= 0 || circumference <= 0) {
      return null;
    }

    result =
      163.205 *
        Math.log10(circumference) -
      97.684 *
        Math.log10(heightInches) -
      78.387;
  }

  return Number.isFinite(result) &&
    result > 0 &&
    result < 100
    ? result
    : null;
}

type BmrInput = {
  gender: Gender;
  age: number;
  heightCm: number;
  weightKg: number;
};

export function calculateBmr({
  gender,
  age,
  heightCm,
  weightKg,
}: BmrInput) {
  if (
    !Number.isFinite(age) ||
    age < 18 ||
    age > 120 ||
    heightCm <= 0 ||
    weightKg <= 0
  ) {
    return null;
  }

  const base =
    10 * weightKg +
    6.25 * heightCm -
    5 * age;

  return gender === 'male'
    ? base + 5
    : base - 161;
}

export function calculateMaintenanceCalories(
  bmr: number | null,
  activityLevel: ActivityLevel
) {
  if (bmr === null) {
    return null;
  }

  return Math.round(
    bmr *
      activityMultipliers[activityLevel]
  );
}

type CalorieTargetInput = {
  bmr: number | null;
  maintenanceCalories: number | null;
  goal: Goal;
  lossRate: LossRate;
};

export function calculateCalorieTarget({
  bmr,
  maintenanceCalories,
  goal,
  lossRate,
}: CalorieTargetInput) {
  if (
    bmr === null ||
    maintenanceCalories === null
  ) {
    return null;
  }

  if (goal === 'maintain') {
    return maintenanceCalories;
  }

  if (goal === 'gain') {
    return maintenanceCalories + 250;
  }

  return Math.max(
    Math.round(bmr),
    maintenanceCalories -
      lossDeficits[lossRate]
  );
}

export function calculateProfileMetrics(
  profile: ProfileData
): ProfileMetrics {
  const feet = Number(
    profile.heightFeet
  );
  const inches = Number(
    profile.heightInches
  );
  const heightInches =
    (Number.isFinite(feet) ? feet : 0) *
      12 +
    (Number.isFinite(inches)
      ? inches
      : 0);
  const heightCm =
    heightInches > 0
      ? heightInches *
        INCHES_TO_CENTIMETERS
      : 0;
  const weightLb = positiveNumber(
    profile.weight
  );
  const weightKg =
    weightLb * POUNDS_TO_KILOGRAMS;
  const age = Number(profile.age);
  const bmr = calculateBmr({
    gender: profile.gender,
    age,
    heightCm,
    weightKg,
  });
  const maintenanceCalories =
    calculateMaintenanceCalories(
      bmr,
      profile.activityLevel
    );
  const calorieTarget =
    calculateCalorieTarget({
      bmr,
      maintenanceCalories,
      goal: profile.goal,
      lossRate: profile.lossRate,
    });
  const macros =
    calorieTarget === null
      ? null
      : calculateMacroTargets({
          calorieTarget,
          weightLb,
          goal: profile.goal,
          activityLevel:
            profile.activityLevel,
        });

  return {
    heightInches,
    heightCm,
    weightLb,
    weightKg,
    bmi: calculateBmi(
      weightLb,
      heightInches
    ),
    bodyFat: calculateBodyFat({
      gender: profile.gender,
      heightInches,
      neck: positiveNumber(profile.neck),
      waist: positiveNumber(profile.waist),
      hip: positiveNumber(profile.hip),
    }),
    bmr,
    maintenanceCalories,
    calorieTarget,
    macros,
  };
}
