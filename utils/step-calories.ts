import { Gender } from '../types/profile';

const POUNDS_PER_KILOGRAM = 2.2046226218;
const INCHES_TO_METERS = 0.0254;
const WALKING_KCAL_PER_KG_KM = 0.5;

export function estimateStepCalories({
  steps,
  weightLb,
  heightInches,
  gender,
}: {
  steps: number;
  weightLb: number;
  heightInches: number;
  gender: Gender;
}) {
  if (
    !Number.isFinite(steps) ||
    steps <= 0 ||
    !Number.isFinite(weightLb) ||
    weightLb <= 0 ||
    !Number.isFinite(heightInches) ||
    heightInches <= 0
  ) {
    return 0;
  }

  const strideRatio = gender === 'female' ? 0.413 : 0.415;
  const strideMeters = heightInches * INCHES_TO_METERS * strideRatio;
  const distanceKm = (steps * strideMeters) / 1000;
  const weightKg = weightLb / POUNDS_PER_KILOGRAM;

  return Math.round(
    distanceKm * weightKg * WALKING_KCAL_PER_KG_KM
  );
}
