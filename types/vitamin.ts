export type VitaminFoodTiming = 'with-food' | 'without-food' | 'either';

export type NutrientCategory = 'Vitamins' | 'Minerals' | 'Sports Nutrition';

export type NutrientSolubility = 'fat-soluble' | 'water-soluble' | 'not-applicable';

export type NutrientEvidenceSource = {
  label: string;
  url: string;
};

export type NutrientReference = {
  id: string;
  name: string;
  alternativeNames: string[];
  category: NutrientCategory;
  shortDescription: string;
  functions: string[];
  trainingAndRecovery: string;
  foodSources: string[];
  recommendedIntake: string;
  units: string[];
  solubility: NutrientSolubility;
  preferredAdministration: VitaminFoodTiming;
  timing: string;
  interactions: string[];
  safetyNotes: string[];
  upperLimit: string;
  supplementationGuidance: string;
  evidenceSources: NutrientEvidenceSource[];
};

export type VitaminEntry = {
  id: string;
  profileId: string;
  name: string;
  dose: string;
  unit?: string;
  servings?: string;
  frequency?: string;
  preferredTime?: string;
  time: string;
  foodTiming: VitaminFoodTiming;
  guidance: string;
  notes?: string;
  referenceId?: string;
  reminderEnabled: boolean;
  notificationId?: string;
  takenDates: string[];
  createdAt: string;
  updatedAt?: string;
};
