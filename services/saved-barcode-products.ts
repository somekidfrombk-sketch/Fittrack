import AsyncStorage from '@react-native-async-storage/async-storage';
import { Directory, File, Paths } from 'expo-file-system';

import {
  SavedBarcodeProduct,
  UsdaFood,
} from '../types/foodLog';

const STORAGE_KEY =
  'fittrack_saved_barcode_products';

const normalizeBarcode = (barcode: string) =>
  barcode.replace(/\D/g, '').replace(/^0+/, '');

async function loadAllProducts() {
  const saved = await AsyncStorage.getItem(
    STORAGE_KEY
  );

  if (!saved) return [];

  const parsed: unknown = JSON.parse(saved);
  return Array.isArray(parsed)
    ? (parsed as SavedBarcodeProduct[])
    : [];
}

export async function findSavedBarcodeProduct(
  profileId: string,
  barcode: string
) {
  const products = await loadAllProducts();
  const normalized = normalizeBarcode(barcode);

  return (
    products.find(
      (product) =>
        product.profileId === profileId &&
        normalizeBarcode(product.barcode) ===
          normalized
    ) ?? null
  );
}

export async function saveBarcodeProduct(
  product: SavedBarcodeProduct
) {
  const products = await loadAllProducts();
  const normalized = normalizeBarcode(
    product.barcode
  );
  const remaining = products.filter(
    (item) =>
      !(
        item.profileId === product.profileId &&
        normalizeBarcode(item.barcode) ===
          normalized
      )
  );

  await AsyncStorage.setItem(
    STORAGE_KEY,
    JSON.stringify([
      ...remaining,
      product,
    ])
  );
}

export function savedProductToFood(
  product: SavedBarcodeProduct
): UsdaFood {
  const gramWeight =
    product.servingGramWeight > 0
      ? product.servingGramWeight
      : 100;
  const factor = 100 / gramWeight;

  return {
    id: product.id,
    name: product.brand
      ? `${product.name} — ${product.brand}`
      : product.name,
    dataType: 'saved_barcode_product',
    caloriesPer100g:
      product.caloriesPerServing * factor,
    proteinPer100g:
      product.proteinPerServing * factor,
    carbsPer100g:
      product.carbsPerServing * factor,
    fatPer100g:
      product.fatPerServing * factor,
    portions: [
      {
        amount: 1,
        description:
          product.servingDescription,
        gramWeight,
      },
    ],
  };
}

export function persistProductPhoto(
  temporaryUri: string,
  profileId: string,
  barcode: string,
  kind: 'package' | 'nutrition'
) {
  const directory = new Directory(
    Paths.document,
    'fittrack-products',
    profileId,
    normalizeBarcode(barcode)
  );
  directory.create({
    idempotent: true,
    intermediates: true,
  });

  const source = new File(temporaryUri);
  const extension =
    source.extension || '.jpg';
  const destination = new File(
    directory,
    `${kind}-${Date.now()}${extension}`
  );
  source.copy(destination);
  return destination.uri;
}
