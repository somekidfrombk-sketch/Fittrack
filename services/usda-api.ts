import { UsdaFood } from '../types/foodLog';

const USDA_API_BASE =
  'https://api.nal.usda.gov/fdc/v1';
const USDA_DEVELOPMENT_KEY = 'DEMO_KEY';

type SearchNutrient = {
  nutrientId?: number;
  value?: number;
  amount?: number;
  nutrient?: { id?: number };
};

type SearchFood = {
  fdcId?: number;
  description?: string;
  brandName?: string;
  brandOwner?: string;
  gtinUpc?: string;
  servingSize?: number;
  servingSizeUnit?: string;
  householdServingFullText?: string;
  foodNutrients?: SearchNutrient[];
};

type SearchResponse = {
  foods?: SearchFood[];
};

const normalizedBarcode = (value: string) =>
  value.replace(/\D/g, '').replace(/^0+/, '');

const nutrientAmount = (
  food: SearchFood,
  nutrientIds: number[]
) => {
  const nutrient = food.foodNutrients?.find(
    (item) =>
      nutrientIds.includes(
        item.nutrientId ??
          item.nutrient?.id ??
          -1
      )
  );
  const value = nutrient?.value ?? nutrient?.amount;

  return typeof value === 'number' &&
    Number.isFinite(value)
    ? value
    : 0;
};

export async function lookupUsdaBarcode(
  barcode: string
): Promise<UsdaFood | null> {
  const digits = barcode.replace(/\D/g, '');

  if (!digits) {
    return null;
  }

  const parameters = new URLSearchParams({
    api_key: USDA_DEVELOPMENT_KEY,
    query: digits,
    dataType: 'Branded',
    pageSize: '25',
    sortBy: 'fdcId',
    sortOrder: 'desc',
  });
  const response = await fetch(
    `${USDA_API_BASE}/foods/search?${parameters}`
  );

  if (!response.ok) {
    throw new Error(
      `USDA lookup failed with status ${response.status}`
    );
  }

  const result =
    (await response.json()) as SearchResponse;
  const exactMatch = result.foods?.find(
    (food) =>
      normalizedBarcode(food.gtinUpc ?? '') ===
      normalizedBarcode(digits)
  );

  if (!exactMatch?.fdcId || !exactMatch.description) {
    return null;
  }

  const servingSize =
    typeof exactMatch.servingSize === 'number' &&
    exactMatch.servingSize > 0
      ? exactMatch.servingSize
      : 100;
  const servingUnit =
    exactMatch.servingSizeUnit || 'g';
  const brand =
    exactMatch.brandName ||
    exactMatch.brandOwner;

  return {
    id: String(exactMatch.fdcId),
    name: brand
      ? `${exactMatch.description} — ${brand}`
      : exactMatch.description,
    dataType: 'branded_food',
    caloriesPer100g: nutrientAmount(
      exactMatch,
      [1008, 2048, 2047]
    ),
    proteinPer100g: nutrientAmount(
      exactMatch,
      [1003]
    ),
    carbsPer100g: nutrientAmount(
      exactMatch,
      [1005]
    ),
    fatPer100g: nutrientAmount(
      exactMatch,
      [1004]
    ),
    portions: [
      {
        amount: 1,
        description:
          exactMatch.householdServingFullText ||
          `1 serving (${servingSize} ${servingUnit})`,
        gramWeight: servingSize,
      },
    ],
  };
}
