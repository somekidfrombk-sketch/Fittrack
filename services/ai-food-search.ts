export type AiParsedFoodItem = {
  searchTerm: string;
  quantity: number;
  unit: string;
  preparation: string;
  brand: string;
};

type AiFoodSearchResponse = {
  originalQuery: string;
  items: AiParsedFoodItem[];
  error?: string;
};

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const publishableKey =
  process.env.EXPO_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

const isConfiguredValue = (value?: string) =>
  Boolean(value && !value.startsWith('PASTE_'));

export async function parseFoodSearch(
  query: string
): Promise<AiParsedFoodItem[]> {
  if (
    !isConfiguredValue(supabaseUrl) ||
    !isConfiguredValue(publishableKey)
  ) {
    throw new Error(
      'FitTrack is missing its Supabase connection settings.'
    );
  }

  const response = await fetch(
    `${supabaseUrl}/functions/v1/hyper-worker`,
    {
      method: 'POST',
      headers: {
        apikey: publishableKey!,
        Authorization: `Bearer ${publishableKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ query }),
    }
  );
  const result = (await response.json()) as AiFoodSearchResponse;

  if (!response.ok) {
    throw new Error(
      result.error || 'AI food search is unavailable.'
    );
  }

  return Array.isArray(result.items) ? result.items : [];
}
