export type MealType =
  | 'breakfast'
  | 'lunch'
  | 'dinner'
  | 'snacks';

export type FoodLogEntry = {
  id: string;
  profileId: string;
  fdcId: string;
  foodName: string;
  meal: MealType;
  date: string;
  servingDescription: string;
  gramWeight: number;
  calories: number;
  protein: number;
  carbs: number;
  fat: number;
  createdAt: string;
};

export type UsdaFoodPortion = {
  amount: number;
  description: string;
  gramWeight: number;
};

export type UsdaFood = {
  id: string;
  name: string;
  dataType: string;
  caloriesPer100g: number;
  proteinPer100g: number;
  carbsPer100g: number;
  fatPer100g: number;
  portions: UsdaFoodPortion[];
};

export type SavedBarcodeProduct = {
  id: string;
  profileId: string;
  barcode: string;
  name: string;
  brand: string;
  servingDescription: string;
  servingGramWeight: number;
  caloriesPerServing: number;
  proteinPerServing: number;
  carbsPerServing: number;
  fatPerServing: number;
  packagePhotoUri?: string;
  nutritionPhotoUri?: string;
  createdAt: string;
  updatedAt: string;
};
