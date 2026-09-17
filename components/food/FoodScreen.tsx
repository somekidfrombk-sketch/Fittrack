import { useLocalDate } from '../../hooks/use-local-date';
import { useCallback, useDeferredValue, useMemo, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';
import {
  BarcodeScanningResult,
  CameraView,
  useCameraPermissions,
} from 'expo-camera';
import * as ImagePicker from 'expo-image-picker';

import usdaCatalog from '../../assets/data/usda-foods.json';
import { colors } from '../../constants/theme';
import { addFoodFavorite, loadFoodFavorites, removeFoodFavorite } from '../../services/food-favorites-storage';
import { addFoodLog, loadFoodLogs, removeFoodLog } from '../../services/food-log-storage';
import { loadProfile } from '../../services/profile-storage';
import {
  findSavedBarcodeProduct,
  persistProductPhoto,
  saveBarcodeProduct,
  savedProductToFood,
} from '../../services/saved-barcode-products';
import { lookupUsdaBarcode } from '../../services/usda-api';
import { FoodFavorite, FoodLogEntry, MealType, SavedBarcodeProduct, UsdaFood } from '../../types/foodLog';
import { ProfileData } from '../../types/profile';

const foods = usdaCatalog.foods as UsdaFood[];
const foodSearchIndex = foods.map((food) => ({ food, name: food.name.toLocaleLowerCase() }));
const meals: { value: MealType; label: string }[] = [
  { value: 'breakfast', label: 'Breakfast' },
  { value: 'lunch', label: 'Lunch' },
  { value: 'dinner', label: 'Dinner' },
  { value: 'snacks', label: 'Snacks' },
];

const targetNumber = (value?: string) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
};

const roundMacro = (value: number) => Math.round(value * 10) / 10;

export default function FoodScreen() {
  const [profile, setProfile] = useState<Partial<ProfileData> | null>(null);
  const [logs, setLogs] = useState<FoodLogEntry[]>([]);
  const [favorites, setFavorites] = useState<FoodFavorite[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [query, setQuery] = useState('');
  const deferredQuery = useDeferredValue(query);
  const [foodTab, setFoodTab] = useState<'search' | 'favorites'>('search');
  const [selectedFood, setSelectedFood] = useState<UsdaFood | null>(null);
  const [selectedMeal, setSelectedMeal] = useState<MealType>('breakfast');
  const [grams, setGrams] = useState('100');
  const [servingDescription, setServingDescription] = useState('100 g');
  const [servingCount, setServingCount] = useState('1');
  const [portionGramWeight, setPortionGramWeight] = useState(100);
  const [showCustomFood, setShowCustomFood] = useState(false);
  const [customName, setCustomName] = useState('');
  const [customServing, setCustomServing] = useState('1 serving');
  const [customCalories, setCustomCalories] = useState('');
  const [customProtein, setCustomProtein] = useState('');
  const [customCarbs, setCustomCarbs] = useState('');
  const [customFat, setCustomFat] = useState('');
  const [cameraPermission, requestCameraPermission] =
    useCameraPermissions();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanLocked, setScanLocked] = useState(false);
  const [barcodeLoading, setBarcodeLoading] = useState(false);
  const [pendingBarcode, setPendingBarcode] = useState('');
  const [customBrand, setCustomBrand] = useState('');
  const [customServingGrams, setCustomServingGrams] = useState('');
  const [packagePhotoUri, setPackagePhotoUri] = useState('');
  const [nutritionPhotoUri, setNutritionPhotoUri] = useState('');

  useFocusEffect(
    useCallback(() => {
      let active = true;
      const loadData = async () => {
        try {
          const savedProfile = await loadProfile();
          const [savedLogs, savedFavorites] = savedProfile?.id
            ? await Promise.all([
                loadFoodLogs(savedProfile.id),
                loadFoodFavorites(savedProfile.id),
              ])
            : [[], []];
          if (active) {
            setProfile(savedProfile);
            setLogs(savedLogs);
            setFavorites(savedFavorites);
          }
        } catch (error) {
          console.error('Failed to load food data:', error);
        } finally {
          if (active) setLoaded(true);
        }
      };
      setLoaded(false);
      loadData();
      return () => {
        active = false;
      };
    }, [])
  );

  const today = useLocalDate();
  const todayLogs = useMemo(
    () => logs.filter((entry) => entry.date === today),
    [logs, today]
  );
  const totals = useMemo(
    () => todayLogs.reduce(
      (sum, entry) => ({
        calories: sum.calories + entry.calories,
        protein: sum.protein + entry.protein,
        carbs: sum.carbs + entry.carbs,
        fat: sum.fat + entry.fat,
      }),
      { calories: 0, protein: 0, carbs: 0, fat: 0 }
    ),
    [todayLogs]
  );
  const targets = {
    calories: targetNumber(profile?.calorieTarget),
    protein: targetNumber(profile?.proteinTarget),
    carbs: targetNumber(profile?.carbTarget),
    fat: targetNumber(profile?.fatTarget),
  };

  const searchResults = useMemo(() => {
    const terms = deferredQuery.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
    if (terms.length === 0) return [];
    const matches: UsdaFood[] = [];
    for (const entry of foodSearchIndex) {
      if (terms.every((term) => entry.name.includes(term))) matches.push(entry.food);
      if (matches.length === 20) break;
    }
    return matches;
  }, [deferredQuery]);

  const selectedNutrition = useMemo(() => {
    const gramWeight = Number(grams);
    if (!selectedFood || !Number.isFinite(gramWeight) || gramWeight <= 0) return null;
    const factor = gramWeight / 100;
    return {
      gramWeight,
      calories: Math.round(selectedFood.caloriesPer100g * factor),
      protein: roundMacro(selectedFood.proteinPer100g * factor),
      carbs: roundMacro(selectedFood.carbsPer100g * factor),
      fat: roundMacro(selectedFood.fatPer100g * factor),
    };
  }, [grams, selectedFood]);

  const selectFood = (food: UsdaFood) => {
    const portion = food.portions[0];
    setSelectedFood(food);
    const defaultGrams = portion?.gramWeight ?? 100;
    setGrams(String(defaultGrams));
    setServingCount('1');
    setPortionGramWeight(defaultGrams);
    setServingDescription(portion?.description ?? '100 g');
  };

  const isFavorite = (foodId: string) =>
    favorites.some((item) => item.food.id === foodId);

  const toggleFavorite = async (food: UsdaFood) => {
    if (!profile?.id) {
      Alert.alert('Save Your Profile', 'Save your Profile before adding favorites.');
      return;
    }
    try {
      setFavorites(
        isFavorite(food.id)
          ? await removeFoodFavorite(profile.id, food.id)
          : await addFoodFavorite(profile.id, food)
      );
    } catch (error) {
      console.error('Failed to update favorite:', error);
      Alert.alert('Favorite Not Saved', 'Please try again.');
    }
  };
  const logSelectedFood = async () => {
    if (!profile?.id) {
      Alert.alert('Save Your Profile', 'Save your Profile before logging food.');
      return;
    }
    if (!selectedFood || !selectedNutrition) {
      Alert.alert('Invalid Serving', 'Choose a food and enter a positive serving weight.');
      return;
    }
    const entry: FoodLogEntry = {
      id: `food-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      profileId: profile.id,
      fdcId: selectedFood.id,
      foodName: selectedFood.name,
      meal: selectedMeal,
      date: today,
      servingDescription:
        servingCount && servingDescription !== 'Custom serving'
          ? `${servingCount} × ${servingDescription}`
          : servingDescription,
      gramWeight: selectedNutrition.gramWeight,
      calories: selectedNutrition.calories,
      protein: selectedNutrition.protein,
      carbs: selectedNutrition.carbs,
      fat: selectedNutrition.fat,
      createdAt: new Date().toISOString(),
    };
    try {
      setLogs(await addFoodLog(entry));
      setSelectedFood(null);
      setQuery('');
    } catch (error) {
      console.error('Failed to log food:', error);
      Alert.alert('Save Failed', 'The food entry could not be saved.');
    }
  };

  const deleteEntry = async (entryId: string) => {
    if (!profile?.id) return;
    try {
      setLogs(await removeFoodLog(profile.id, entryId));
    } catch (error) {
      console.error('Failed to remove food:', error);
      Alert.alert('Delete Failed', 'The food entry could not be removed.');
    }
  };

  const buildCustomFavorite = (): UsdaFood | null => {
    const name = customName.trim();
    const calories = Number(customCalories);
    const protein = Number(customProtein || 0);
    const carbs = Number(customCarbs || 0);
    const fat = Number(customFat || 0);
    if (!name) {
      Alert.alert('Food Name Required', 'Enter a name before saving this favorite.');
      return null;
    }
    if (![calories, protein, carbs, fat].every((value) => Number.isFinite(value) && value >= 0)) {
      Alert.alert('Check Nutrition', 'Enter valid calories, protein, carbs, and fat.');
      return null;
    }
    const enteredGrams = Number(customServingGrams);
    const gramWeight = Number.isFinite(enteredGrams) && enteredGrams > 0 ? enteredGrams : 100;
    const per100g = 100 / gramWeight;
    const favoriteKey = `${customBrand}-${name}`
      .toLocaleLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '');
    return {
      id: `custom-${favoriteKey}`,
      name: customBrand.trim() ? `${customBrand.trim()} · ${name}` : name,
      dataType: 'Custom food',
      caloriesPer100g: calories * per100g,
      proteinPer100g: protein * per100g,
      carbsPer100g: carbs * per100g,
      fatPer100g: fat * per100g,
      portions: [{
        amount: 1,
        description: customServing.trim() || '1 serving',
        gramWeight,
      }],
    };
  };

  const saveCustomFavorite = async () => {
    if (!profile?.id) {
      Alert.alert('Save Your Profile', 'Save your Profile before adding favorites.');
      return;
    }
    const food = buildCustomFavorite();
    if (!food) return;
    try {
      setFavorites(await addFoodFavorite(profile.id, food));
      setFoodTab('favorites');
      setShowCustomFood(false);
      Alert.alert('Favorite Saved', `${food.name} was added to Favorite Foods.`);
    } catch (error) {
      console.error('Failed to save custom favorite:', error);
      Alert.alert('Favorite Not Saved', 'Please try again.');
    }
  };
  const logCustomFood = async () => {
    if (!profile?.id) {
      Alert.alert('Save Your Profile', 'Save your Profile before logging food.');
      return;
    }

    const calories = Number(customCalories);
    const protein = Number(customProtein || 0);
    const carbs = Number(customCarbs || 0);
    const fat = Number(customFat || 0);
    const macroValues = [protein, carbs, fat];

    if (!customName.trim()) {
      Alert.alert('Food Name Required', 'Enter a name for the custom food.');
      return;
    }

    if (!Number.isFinite(calories) || calories < 0) {
      Alert.alert('Invalid Calories', 'Enter a valid calorie amount of zero or more.');
      return;
    }

    if (macroValues.some((value) => !Number.isFinite(value) || value < 0)) {
      Alert.alert('Invalid Macros', 'Protein, carbs, and fat must be zero or positive numbers.');
      return;
    }

    const entryId = `food-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    const entry: FoodLogEntry = {
      id: entryId,
      profileId: profile.id,
      fdcId: `custom-${entryId}`,
      foodName: customName.trim(),
      meal: selectedMeal,
      date: today,
      servingDescription: customServing.trim() || '1 serving',
      gramWeight: 0,
      calories: Math.round(calories),
      protein: roundMacro(protein),
      carbs: roundMacro(carbs),
      fat: roundMacro(fat),
      createdAt: new Date().toISOString(),
    };

    try {
      setLogs(await addFoodLog(entry));
      setCustomName('');
      setCustomServing('1 serving');
      setCustomCalories('');
      setCustomProtein('');
      setCustomCarbs('');
      setCustomFat('');
      setShowCustomFood(false);
    } catch (error) {
      console.error('Failed to log custom food:', error);
      Alert.alert('Save Failed', 'The custom food could not be saved.');
    }
  };

  const openScanner = async () => {
    let permission = cameraPermission;

    if (!permission?.granted) {
      permission = await requestCameraPermission();
    }

    if (!permission.granted) {
      Alert.alert(
        'Camera Permission Needed',
        'Allow camera access in Settings to scan product barcodes.'
      );
      return;
    }

    setScanLocked(false);
    setScannerOpen(true);
  };

  const handleBarcodeScanned = async (
    result: BarcodeScanningResult
  ) => {
    if (scanLocked || barcodeLoading) {
      return;
    }

    setScanLocked(true);
    setBarcodeLoading(true);

    try {
      if (profile?.id) {
        const savedProduct =
          await findSavedBarcodeProduct(
            profile.id,
            result.data
          );

        if (savedProduct) {
          selectFood(
            savedProductToFood(savedProduct)
          );
          setScannerOpen(false);
          setQuery('');
          return;
        }
      }

      const product = await lookupUsdaBarcode(
        result.data
      );

      if (!product) {
        setScannerOpen(false);
        setPendingBarcode(result.data);
        setShowCustomFood(true);
        setCustomName('');
        setCustomBrand('');
        setCustomServing('1 serving');
        setCustomServingGrams('');
        setCustomCalories('');
        setCustomProtein('');
        setCustomCarbs('');
        setCustomFat('');
        setPackagePhotoUri('');
        setNutritionPhotoUri('');
        return;
      }

      selectFood(product);
      setScannerOpen(false);
      setShowCustomFood(false);
      setQuery('');
    } catch (error) {
      console.error('Barcode lookup failed:', error);
      setScannerOpen(false);
      Alert.alert(
        'Lookup Failed',
        'The USDA demonstration service could not be reached or its request limit was exceeded. Try again later or add a custom food.'
      );
    } finally {
      setBarcodeLoading(false);
    }
  };

  const captureProductPhoto = async (
    kind: 'package' | 'nutrition',
    source: 'camera' | 'library'
  ) => {
    if (!profile?.id || !pendingBarcode) {
      return;
    }

    if (source === 'camera') {
      const permission =
        await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          'Camera Permission Needed',
          'Allow camera access to photograph packaging.'
        );
        return;
      }
    }

    const options: ImagePicker.ImagePickerOptions = {
        mediaTypes: ['images'],
        quality: 0.7,
      };
    const result = source === 'camera'
      ? await ImagePicker.launchCameraAsync(options)
      : await ImagePicker.launchImageLibraryAsync(options);

    if (result.canceled) {
      return;
    }

    try {
      const savedUri = persistProductPhoto(
        result.assets[0].uri,
        profile.id,
        pendingBarcode,
        kind
      );

      if (kind === 'package') {
        setPackagePhotoUri(savedUri);
      } else {
        setNutritionPhotoUri(savedUri);
      }
    } catch (error) {
      console.error('Failed to save product photo:', error);
      Alert.alert(
        'Photo Save Failed',
        'The packaging photo could not be saved.'
      );
    }
  };

  const chooseProductPhoto = (
    kind: 'package' | 'nutrition'
  ) => {
    Alert.alert(
      kind === 'package'
        ? 'Package Photo'
        : 'Nutrition Label',
      'Take a new photo or choose an existing image.',
      [
        {
          text: 'Take Photo',
          onPress: () =>
            captureProductPhoto(kind, 'camera'),
        },
        {
          text: 'Choose Photo',
          onPress: () =>
            captureProductPhoto(kind, 'library'),
        },
        { text: 'Cancel', style: 'cancel' },
      ]
    );
  };

  const saveScannedProduct = async () => {
    if (!profile?.id || !pendingBarcode) {
      return;
    }

    const calories = Number(customCalories);
    const servingGrams = Number(
      customServingGrams || 100
    );
    const protein = Number(customProtein || 0);
    const carbs = Number(customCarbs || 0);
    const fat = Number(customFat || 0);

    if (!customName.trim()) {
      Alert.alert('Product Name Required', 'Enter the product name from the package.');
      return;
    }

    if (!Number.isFinite(calories) || calories < 0) {
      Alert.alert('Invalid Calories', 'Enter the calories shown for one serving.');
      return;
    }

    if (
      !Number.isFinite(servingGrams) ||
      servingGrams <= 0 ||
      [protein, carbs, fat].some(
        (value) => !Number.isFinite(value) || value < 0
      )
    ) {
      Alert.alert('Invalid Nutrition', 'Serving grams and macros must be valid positive values.');
      return;
    }

    const timestamp = new Date().toISOString();
    const product: SavedBarcodeProduct = {
      id: `saved-barcode-${pendingBarcode}`,
      profileId: profile.id,
      barcode: pendingBarcode,
      name: customName.trim(),
      brand: customBrand.trim(),
      servingDescription: customServing.trim() || '1 serving',
      servingGramWeight: servingGrams,
      caloriesPerServing: Math.round(calories),
      proteinPerServing: roundMacro(protein),
      carbsPerServing: roundMacro(carbs),
      fatPerServing: roundMacro(fat),
      packagePhotoUri: packagePhotoUri || undefined,
      nutritionPhotoUri: nutritionPhotoUri || undefined,
      createdAt: timestamp,
      updatedAt: timestamp,
    };

    try {
      await saveBarcodeProduct(product);
      selectFood(savedProductToFood(product));
      setPendingBarcode('');
      setShowCustomFood(false);
      Alert.alert(
        'Product Saved',
        'Future scans of this barcode will use your saved product details.'
      );
    } catch (error) {
      console.error('Failed to save barcode product:', error);
      Alert.alert('Save Failed', 'The scanned product could not be saved.');
    }
  };

  if (!loaded) {
    return <View style={styles.loadingContainer}><Text style={styles.body}>Loading food tracker…</Text></View>;
  }

  return (
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
      <Text style={styles.brand}>FITTRACK</Text>
      <Text style={styles.title}>Food</Text>
      <Text style={styles.subtitle}>Today · USDA nutrition data</Text>

      {!profile?.id || targets.calories === 0 ? (
        <View style={styles.card}>
          <Text style={styles.cardTitle}>Save your nutrition targets</Text>
          <Text style={styles.body}>Complete and save your Profile before logging food.</Text>
        </View>
      ) : (
        <>
          <View style={styles.calorieCard}>
            <Text style={styles.cardLabel}>CALORIES</Text>
            <Text style={styles.largeValue}>{Math.round(totals.calories).toLocaleString()}</Text>
            <Text style={styles.targetText}>of {targets.calories.toLocaleString()} kcal</Text>
            <View style={styles.divider} />
            <Text style={styles.remainingLabel}>Remaining</Text>
            <Text style={styles.remainingValue}>{Math.max(0, Math.round(targets.calories - totals.calories)).toLocaleString()}</Text>
          </View>

          <View style={styles.macroRow}>
            {[
              { label: 'PROTEIN', eaten: totals.protein, target: targets.protein },
              { label: 'CARBS', eaten: totals.carbs, target: targets.carbs },
              { label: 'FAT', eaten: totals.fat, target: targets.fat },
            ].map((macro) => (
              <View key={macro.label} style={styles.macroCard}>
                <Text style={styles.cardLabel}>{macro.label}</Text>
                <Text style={styles.macroValue}>{roundMacro(macro.eaten)} g</Text>
                <Text style={styles.targetText}>of {macro.target} g</Text>
                <Text style={styles.macroRemaining}>{roundMacro(Math.max(0, macro.target - macro.eaten))} g left</Text>
              </View>
            ))}
          </View>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>Add Food</Text>
            <View style={styles.foodTabRow}>
              <Pressable
                style={[styles.foodTabButton, foodTab === 'search' && styles.foodTabButtonSelected]}
                onPress={() => setFoodTab('search')}
              >
                <Text style={[styles.foodTabText, foodTab === 'search' && styles.foodTabTextSelected]}>Search</Text>
              </Pressable>
              <Pressable
                style={[styles.foodTabButton, foodTab === 'favorites' && styles.foodTabButtonSelected]}
                onPress={() => {
                  setFoodTab('favorites');
                  setShowCustomFood(false);
                  setScannerOpen(false);
                }}
              >
                <Text style={[styles.foodTabText, foodTab === 'favorites' && styles.foodTabTextSelected]}>
                  Favorites ({favorites.length})
                </Text>
              </Pressable>
            </View>

            {foodTab === 'search' ? (
              <>
                <Pressable style={styles.scanButton} onPress={openScanner}>
                  <Text style={styles.scanButtonText}>▣ Scan Product Barcode</Text>
                </Pressable>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  placeholder="Search USDA foods"
                  placeholderTextColor={colors.lightMuted}
                  returnKeyType="search"
                  style={styles.input}
                />
                {searchResults.map((food) => (
                  <View key={food.id} style={styles.favoriteRow}>
                    <Pressable style={[styles.searchResult, styles.favoriteFood]} onPress={() => selectFood(food)}>
                      <Text style={styles.foodName}>{food.name}</Text>
                      <Text style={styles.foodMeta}>{Math.round(food.caloriesPer100g)} kcal per 100 g</Text>
                    </Pressable>
                    <Pressable
                      accessibilityLabel={`${isFavorite(food.id) ? 'Remove' : 'Add'} ${food.name} ${isFavorite(food.id) ? 'from' : 'to'} favorites`}
                      style={styles.favoriteStarButton}
                      onPress={() => void toggleFavorite(food)}
                    >
                      <Text style={[styles.favoriteStar, !isFavorite(food.id) && styles.favoriteStarEmpty]}>
                        {isFavorite(food.id) ? '★' : '☆'}
                      </Text>
                    </Pressable>
                  </View>
                ))}
                {query.trim() && searchResults.length === 0 ? <Text style={styles.helperText}>No USDA foods found.</Text> : null}
                <Pressable
                  style={styles.customToggle}
                  onPress={() => {
                    setShowCustomFood((current) => !current);
                    setSelectedFood(null);
                    setPendingBarcode('');
                  }}
                >
                  <Text style={styles.customToggleText}>
                    {showCustomFood ? 'Hide Custom Food' : '+ Add Custom Food'}
                  </Text>
                </Pressable>
              </>
            ) : favorites.length === 0 ? (
              <Text style={styles.emptyFavorites}>No favorites yet. Use Search or create a custom food, then tap the star.</Text>
            ) : (
              favorites.map((favorite) => (
                <View key={favorite.id} style={styles.favoriteRow}>
                  <Pressable style={styles.favoriteFood} onPress={() => selectFood(favorite.food)}>
                    <Text style={styles.foodName}>{favorite.food.name}</Text>
                    <Text style={styles.foodMeta}>
                      {favorite.food.portions[0]?.description ?? '100 g'} · {Math.round(favorite.food.caloriesPer100g * ((favorite.food.portions[0]?.gramWeight ?? 100) / 100))} kcal
                    </Text>
                  </Pressable>
                  <Pressable
                    accessibilityLabel={`Remove ${favorite.food.name} from favorites`}
                    style={styles.favoriteStarButton}
                    onPress={() => void toggleFavorite(favorite.food)}
                  >
                    <Text style={styles.favoriteStar}>★</Text>
                  </Pressable>
                </View>
              ))
            )}
          </View>

          {scannerOpen ? (
            <View style={styles.scannerCard}>
              <Text style={styles.scannerTitle}>
                {barcodeLoading ? 'Looking up product…' : 'Center the barcode in the camera'}
              </Text>
              <CameraView
                active={scannerOpen && !barcodeLoading}
                facing="back"
                barcodeScannerSettings={{
                  barcodeTypes: ['ean13', 'ean8', 'upc_a', 'upc_e'],
                }}
                onBarcodeScanned={
                  scanLocked ? undefined : handleBarcodeScanned
                }
                style={styles.camera}
              />
              <Pressable
                style={styles.cancelScanButton}
                onPress={() => setScannerOpen(false)}
              >
                <Text style={styles.cancelScanText}>Cancel Scan</Text>
              </Pressable>
            </View>
          ) : null}

          {showCustomFood ? (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>
                {pendingBarcode ? 'Save Scanned Product' : 'Custom Food'}
              </Text>
              {pendingBarcode ? (
                <View style={styles.barcodeNotice}>
                  <Text style={styles.barcodeNoticeTitle}>USDA match not found</Text>
                  <Text style={styles.foodMeta}>Barcode: {pendingBarcode}</Text>
                  <Text style={styles.foodMeta}>Confirm the Nutrition Facts values for one serving.</Text>
                </View>
              ) : null}
              <Text style={styles.fieldLabel}>FOOD NAME</Text>
              <TextInput value={customName} onChangeText={setCustomName} placeholder="Homemade chicken sandwich" placeholderTextColor={colors.lightMuted} style={styles.input} />
              {pendingBarcode ? (
                <>
                  <Text style={styles.fieldLabel}>BRAND</Text>
                  <TextInput value={customBrand} onChangeText={setCustomBrand} placeholder="Brand name" placeholderTextColor={colors.lightMuted} style={styles.input} />
                </>
              ) : null}
              <Text style={styles.fieldLabel}>SERVING</Text>
              <TextInput value={customServing} onChangeText={setCustomServing} placeholder="1 serving" placeholderTextColor={colors.lightMuted} style={styles.input} />
              {pendingBarcode ? (
                <>
                  <Text style={styles.fieldLabel}>SERVING WEIGHT (G)</Text>
                  <TextInput value={customServingGrams} onChangeText={(value) => setCustomServingGrams(value.replace(/[^0-9.]/g, ''))} placeholder="Grams per serving" placeholderTextColor={colors.lightMuted} keyboardType="decimal-pad" style={styles.input} />
                </>
              ) : null}
              <Text style={styles.fieldLabel}>CALORIES</Text>
              <TextInput value={customCalories} onChangeText={(value) => setCustomCalories(value.replace(/[^0-9.]/g, ''))} placeholder="Calories" placeholderTextColor={colors.lightMuted} keyboardType="decimal-pad" style={styles.input} />
              <View style={styles.customMacroRow}>
                {[
                  { label: 'PROTEIN (G)', value: customProtein, setter: setCustomProtein },
                  { label: 'CARBS (G)', value: customCarbs, setter: setCustomCarbs },
                  { label: 'FAT (G)', value: customFat, setter: setCustomFat },
                ].map((field) => (
                  <View key={field.label} style={styles.customMacroField}>
                    <Text style={styles.fieldLabel}>{field.label}</Text>
                    <TextInput value={field.value} onChangeText={(value) => field.setter(value.replace(/[^0-9.]/g, ''))} placeholder="0" placeholderTextColor={colors.lightMuted} keyboardType="decimal-pad" style={styles.input} />
                  </View>
                ))}
              </View>
              {pendingBarcode ? (
                <>
                  <Text style={styles.fieldLabel}>PACKAGING PHOTOS</Text>
                  <View style={styles.photoRow}>
                    <Pressable style={styles.photoButton} onPress={() => chooseProductPhoto('package')}>
                      <Text style={styles.photoButtonText}>{packagePhotoUri ? 'Retake Package' : 'Photo of Package'}</Text>
                    </Pressable>
                    <Pressable style={styles.photoButton} onPress={() => chooseProductPhoto('nutrition')}>
                      <Text style={styles.photoButtonText}>{nutritionPhotoUri ? 'Retake Label' : 'Nutrition Label'}</Text>
                    </Pressable>
                  </View>
                  <View style={styles.photoRow}>
                    {packagePhotoUri ? <Image source={{ uri: packagePhotoUri }} style={styles.productPhoto} /> : null}
                    {nutritionPhotoUri ? <Image source={{ uri: nutritionPhotoUri }} style={styles.productPhoto} /> : null}
                  </View>
                </>
              ) : null}
              <Text style={styles.fieldLabel}>MEAL</Text>
              <View style={styles.optionWrap}>
                {meals.map((meal) => (
                  <Pressable key={meal.value} style={[styles.mealButton, selectedMeal === meal.value && styles.mealButtonSelected]} onPress={() => setSelectedMeal(meal.value)}>
                    <Text style={[styles.mealButtonText, selectedMeal === meal.value && styles.mealButtonTextSelected]}>{meal.label}</Text>
                  </Pressable>
                ))}
              </View>
              {!pendingBarcode ? (
                <Pressable style={styles.favoriteSaveButton} onPress={() => void saveCustomFavorite()}>
                  <Text style={styles.favoriteSaveButtonText}>☆ Save to Favorites</Text>
                </Pressable>
              ) : null}
              <Pressable style={styles.addButton} onPress={pendingBarcode ? saveScannedProduct : logCustomFood}>
                <Text style={styles.addButtonText}>
                  {pendingBarcode ? 'Save Product & Continue' : 'Add Custom Food'}
                </Text>
              </Pressable>
            </View>
          ) : null}

          {selectedFood ? (
            <View style={styles.card}>
              <View style={styles.selectedFoodHeader}>
                <Text style={[styles.cardTitle, styles.selectedFoodTitle]}>{selectedFood.name}</Text>
                <Pressable
                  accessibilityLabel={`${isFavorite(selectedFood.id) ? 'Remove from' : 'Add to'} favorites`}
                  style={styles.favoriteStarButton}
                  onPress={() => void toggleFavorite(selectedFood)}
                >
                  <Text style={[styles.favoriteStar, !isFavorite(selectedFood.id) && styles.favoriteStarEmpty]}>
                    {isFavorite(selectedFood.id) ? '★' : '☆'}
                  </Text>
                </Pressable>
              </View>
              <Text style={styles.smallHeading}>SERVING</Text>
              <View style={styles.optionWrap}>
                <Pressable style={[styles.optionButton, servingDescription === '100 g' && styles.optionButtonSelected]} onPress={() => { setGrams('100'); setServingCount('1'); setPortionGramWeight(100); setServingDescription('100 g'); }}>
                  <Text style={styles.optionText}>100 g</Text>
                </Pressable>
                {selectedFood.portions.slice(0, 5).map((portion, index) => (
                  <Pressable key={`${portion.description}-${index}`} style={[styles.optionButton, servingDescription === portion.description && styles.optionButtonSelected]} onPress={() => { setGrams(String(portion.gramWeight)); setServingCount('1'); setPortionGramWeight(portion.gramWeight); setServingDescription(portion.description); }}>
                    <Text style={styles.optionText}>{portion.description} · {portion.gramWeight} g</Text>
                  </Pressable>
                ))}
              </View>
              <Text style={styles.smallHeading}>NUMBER OF SERVINGS</Text>
              <TextInput
                value={servingCount}
                onChangeText={(value) => {
                  const cleaned = value.replace(/[^0-9.]/g, '');
                  setServingCount(cleaned);
                  const count = Number(cleaned);
                  setGrams(
                    Number.isFinite(count) && count > 0
                      ? String(roundMacro(portionGramWeight * count))
                      : ''
                  );
                }}
                placeholder="Example: 0.5"
                placeholderTextColor={colors.lightMuted}
                keyboardType="decimal-pad"
                style={styles.input}
              />
              <Text style={styles.servingHint}>
                Fractions are allowed. Current total: {grams || '0'} g
              </Text>
              <Text style={styles.smallHeading}>OR EDIT TOTAL GRAMS</Text>
              <TextInput value={grams} onChangeText={(value) => { setGrams(value.replace(/[^0-9.]/g, '')); setServingCount(''); setServingDescription('Custom serving'); }} keyboardType="decimal-pad" style={styles.input} />
              <Text style={styles.smallHeading}>MEAL</Text>
              <View style={styles.optionWrap}>
                {meals.map((meal) => (
                  <Pressable key={meal.value} style={[styles.mealButton, selectedMeal === meal.value && styles.mealButtonSelected]} onPress={() => setSelectedMeal(meal.value)}>
                    <Text style={[styles.mealButtonText, selectedMeal === meal.value && styles.mealButtonTextSelected]}>{meal.label}</Text>
                  </Pressable>
                ))}
              </View>
              {selectedNutrition ? <Text style={styles.previewText}>{selectedNutrition.calories} kcal · {selectedNutrition.protein} g protein · {selectedNutrition.carbs} g carbs · {selectedNutrition.fat} g fat</Text> : null}
              <Pressable style={styles.addButton} onPress={logSelectedFood}><Text style={styles.addButtonText}>Add to Today</Text></Pressable>
            </View>
          ) : null}

          {meals.map((meal) => {
            const entries = todayLogs.filter((entry) => entry.meal === meal.value);
            return (
              <View key={meal.value} style={styles.card}>
                <Text style={styles.cardTitle}>{meal.label}</Text>
                {entries.length === 0 ? <Text style={styles.body}>No food logged.</Text> : entries.map((entry) => (
                  <View key={entry.id} style={styles.logRow}>
                    <View style={styles.logDetails}>
                      <Text style={styles.foodName}>{entry.foodName}</Text>
                      <Text style={styles.foodMeta}>
                        {entry.servingDescription}
                        {entry.gramWeight > 0 ? ` · ${entry.gramWeight} g` : ''}
                        {' · '}{entry.calories} kcal
                      </Text>
                    </View>
                    <Pressable accessibilityLabel={`Remove ${entry.foodName}`} onPress={() => deleteEntry(entry.id)}><Text style={styles.removeText}>Remove</Text></Pressable>
                  </View>
                ))}
              </View>
            );
          })}
          <Text style={styles.sourceNote}>Nutrition source: USDA FoodData Central. Values use the selected edible gram weight and are saved with each log entry.</Text>
        </>
      )}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background },
  container: { flexGrow: 1, padding: 20, paddingTop: 60, paddingBottom: 110, backgroundColor: colors.background },
  brand: { fontSize: 12, fontWeight: '900', letterSpacing: 2, color: colors.muted },
  title: { fontSize: 34, fontWeight: '900', color: colors.text, marginTop: 4 },
  subtitle: { fontSize: 16, color: colors.muted, marginTop: 6, marginBottom: 20 },
  card: { backgroundColor: colors.surface, borderRadius: 20, padding: 18, marginBottom: 14 },
  cardTitle: { fontSize: 18, fontWeight: '900', color: colors.text, marginBottom: 10 },
  body: { fontSize: 14, lineHeight: 21, color: colors.muted },
  calorieCard: { backgroundColor: colors.surface, borderRadius: 22, padding: 22, marginBottom: 14 },
  cardLabel: { fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.lightMuted },
  largeValue: { marginTop: 5, fontSize: 48, fontWeight: '900', color: colors.text },
  targetText: { marginTop: 2, fontSize: 12, color: colors.muted },
  divider: { height: 1, backgroundColor: colors.soft2, marginVertical: 18 },
  remainingLabel: { fontSize: 11, fontWeight: '800', color: colors.muted },
  remainingValue: { marginTop: 2, fontSize: 30, fontWeight: '900', color: colors.text },
  macroRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 14 },
  macroCard: { flexGrow: 1, flexBasis: 95, backgroundColor: colors.surface, borderRadius: 18, padding: 16 },
  macroValue: { marginTop: 5, fontSize: 23, fontWeight: '900', color: colors.text },
  macroRemaining: { marginTop: 9, fontSize: 11, color: colors.lightMuted },
  input: { backgroundColor: colors.soft2, borderRadius: 12, paddingHorizontal: 13, paddingVertical: 12, color: colors.text, fontWeight: '700' },
  searchResult: { paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: colors.soft2 },
  favoriteRow: { flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: colors.soft2 },
  favoriteFood: { flex: 1, paddingRight: 10 },
  favoriteStarButton: { minWidth: 44, minHeight: 44, alignItems: 'center', justifyContent: 'center' },
  favoriteStar: { color: '#F5A623', fontSize: 25, fontWeight: '900' },
  favoriteStarEmpty: { color: colors.lightMuted },
  selectedFoodHeader: { flexDirection: 'row', alignItems: 'flex-start' },
  selectedFoodTitle: { flex: 1, paddingRight: 8 },
  foodName: { fontSize: 13, fontWeight: '800', color: colors.text },
  foodMeta: { marginTop: 3, fontSize: 11, color: colors.muted },
  helperText: { marginTop: 12, fontSize: 12, color: colors.lightMuted },
  customToggle: { marginTop: 14, backgroundColor: colors.soft2, borderRadius: 12, paddingVertical: 12, alignItems: 'center' },
  customToggleText: { fontSize: 13, fontWeight: '900', color: colors.text },
  foodTabRow: { flexDirection: 'row', gap: 8, marginBottom: 14 },
  foodTabButton: { flex: 1, minHeight: 44, borderRadius: 12, backgroundColor: colors.soft2, alignItems: 'center', justifyContent: 'center' },
  foodTabButtonSelected: { backgroundColor: colors.text },
  foodTabText: { color: colors.muted, fontSize: 13, fontWeight: '900' },
  foodTabTextSelected: { color: colors.surface },
  emptyFavorites: { paddingVertical: 18, color: colors.muted, fontSize: 13, lineHeight: 19, textAlign: 'center' },
  scanButton: { marginBottom: 12, backgroundColor: colors.text, borderRadius: 12, paddingVertical: 13, alignItems: 'center' },
  scanButtonText: { color: colors.surface, fontSize: 13, fontWeight: '900' },
  scannerCard: { backgroundColor: colors.surface, borderRadius: 20, padding: 16, marginBottom: 14, overflow: 'hidden' },
  scannerTitle: { fontSize: 14, fontWeight: '900', color: colors.text, marginBottom: 12, textAlign: 'center' },
  camera: { height: 280, borderRadius: 16, overflow: 'hidden' },
  cancelScanButton: { marginTop: 12, backgroundColor: colors.soft2, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  cancelScanText: { color: colors.text, fontSize: 12, fontWeight: '900' },
  fieldLabel: { marginTop: 12, marginBottom: 6, fontSize: 10, fontWeight: '900', letterSpacing: 1, color: colors.lightMuted },
  barcodeNotice: { backgroundColor: colors.soft2, borderRadius: 12, padding: 12, marginBottom: 4 },
  barcodeNoticeTitle: { fontSize: 13, fontWeight: '900', color: colors.text },
  customMacroRow: { flexDirection: 'row', gap: 8 },
  customMacroField: { flex: 1 },
  photoRow: { flexDirection: 'row', gap: 10 },
  photoButton: { flex: 1, backgroundColor: colors.soft2, borderRadius: 12, paddingVertical: 11, alignItems: 'center' },
  photoButtonText: { fontSize: 11, fontWeight: '900', color: colors.text },
  productPhoto: { flex: 1, height: 140, borderRadius: 12, marginTop: 10, backgroundColor: colors.soft2 },
  smallHeading: { marginTop: 14, marginBottom: 8, fontSize: 10, fontWeight: '900', letterSpacing: 1.2, color: colors.lightMuted },
  servingHint: { marginTop: 7, fontSize: 11, color: colors.lightMuted },
  optionWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  optionButton: { backgroundColor: colors.soft2, borderRadius: 10, paddingHorizontal: 10, paddingVertical: 9 },
  optionButtonSelected: { backgroundColor: colors.soft },
  optionText: { fontSize: 11, fontWeight: '800', color: colors.text },
  mealButton: { flexGrow: 1, backgroundColor: colors.soft2, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, alignItems: 'center' },
  mealButtonSelected: { backgroundColor: colors.text },
  mealButtonText: { fontSize: 11, fontWeight: '800', color: colors.muted },
  mealButtonTextSelected: { color: colors.surface },
  previewText: { marginTop: 16, fontSize: 12, lineHeight: 18, color: colors.muted },
  favoriteSaveButton: { marginTop: 16, backgroundColor: colors.soft, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  favoriteSaveButtonText: { color: colors.text, fontWeight: '900', fontSize: 14 },
  addButton: { marginTop: 10, backgroundColor: colors.text, borderRadius: 13, paddingVertical: 13, alignItems: 'center' },
  addButtonText: { color: colors.surface, fontWeight: '900', fontSize: 14 },
  logRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.soft2 },
  logDetails: { flex: 1 },
  removeText: { fontSize: 11, fontWeight: '800', color: colors.muted },
  sourceNote: { marginTop: 4, fontSize: 10, lineHeight: 15, color: colors.lightMuted },
});
