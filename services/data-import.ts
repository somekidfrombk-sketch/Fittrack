import AsyncStorage from '@react-native-async-storage/async-storage';

const SAVED_PRODUCTS_KEY = 'fittrack_saved_barcode_products';
const FOOD_LOGS_KEY = 'fittrack_food_logs';
const FOOD_FAVORITES_KEY = 'fittrack_food_favorites';
const PHONE_PEDOMETER_KEY = 'fittrack_phone_pedometer_enabled';
const PROFILE_KEY = 'fittrack_user_profile';
const ACTIVE_PROFILE_ID_KEY = 'fittrack_active_profile_id';
const RUN_HISTORY_KEY = 'fittrack_run_history';
const RUN_NOTIFICATION_SETTINGS_KEY = 'fittrack_run_notification_settings';
const VITAMINS_KEY = 'fittrack_vitamins';
const WORKOUT_HISTORY_KEY = 'fittrack_workout_history';
const STEP_PREFIX = 'fittrack_daily_steps';

export type FitTrackImportResult = {
  profileId: string;
  importedKeys: number;
  importedSteps: number;
  importedWorkouts: number;
  importedFoodLogs: number;
};

type FitTrackExportFile = {
  format?: string;
  schemaVersion?: number;
  profile?: { id?: unknown; [key: string]: unknown };
  nutrition?: {
    foodLogs?: unknown;
    favorites?: unknown;
    customBarcodeFoods?: unknown;
  };
  exercise?: {
    strengthWorkouts?: unknown;
    runningAndCycling?: unknown;
  };
  vitamins?: unknown;
  steps?: unknown;
  settings?: {
    phonePedometerEnabled?: unknown;
    runNotificationMiles?: unknown;
  };
};

function assertArray(
  value: unknown,
  label: string
) {
  if (!Array.isArray(value)) {
    throw new Error(`${label} is missing or invalid.`);
  }

  return value;
}

function stringify(value: unknown) {
  return JSON.stringify(value ?? []);
}

function profileIdFromExport(
  parsed: FitTrackExportFile
) {
  const profileId = parsed.profile?.id;
  if (typeof profileId !== 'string' || !profileId.trim()) {
    throw new Error('This file does not contain a FitTrack profile ID.');
  }

  return profileId;
}

function validateFitTrackExport(
  parsed: unknown
): FitTrackExportFile {
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('Choose a valid FitTrack JSON export file.');
  }

  const exportFile = parsed as FitTrackExportFile;
  if (
    exportFile.format !== 'FitTrack user data export' ||
    exportFile.schemaVersion !== 1
  ) {
    throw new Error('This file is not a supported FitTrack export.');
  }

  profileIdFromExport(exportFile);
  assertArray(exportFile.nutrition?.foodLogs, 'Food logs');
  assertArray(exportFile.nutrition?.favorites, 'Food favorites');
  assertArray(exportFile.nutrition?.customBarcodeFoods, 'Custom foods');
  assertArray(exportFile.exercise?.strengthWorkouts, 'Workout history');
  assertArray(exportFile.exercise?.runningAndCycling, 'Run history');
  assertArray(exportFile.vitamins, 'Vitamins');
  assertArray(exportFile.steps, 'Steps');

  return exportFile;
}

function stepPairs(
  profileId: string,
  steps: unknown[]
) {
  return steps.flatMap((entry) => {
    if (!entry || typeof entry !== 'object') {
      return [];
    }

    const item = entry as {
      date?: unknown;
      steps?: unknown;
    };
    if (typeof item.date !== 'string') {
      return [];
    }

    const count = Math.max(
      0,
      Math.floor(Number(item.steps) || 0)
    );

    return [[
      `${STEP_PREFIX}:${profileId}:${item.date}`,
      String(count),
    ]] as [string, string][];
  });
}

async function removeExistingProfileSteps(
  profileId: string
) {
  const prefix = `${STEP_PREFIX}:${profileId}:`;
  const keys = (await AsyncStorage.getAllKeys()).filter(
    (key) => key.startsWith(prefix)
  );

  if (keys.length > 0) {
    await AsyncStorage.multiRemove(keys);
  }
}

export async function importFitTrackExport(
  contents: string
): Promise<FitTrackImportResult> {
  const parsed = validateFitTrackExport(
    JSON.parse(contents)
  );
  const profileId = profileIdFromExport(parsed);

  const foodLogs = assertArray(
    parsed.nutrition?.foodLogs,
    'Food logs'
  );
  const foodFavorites = assertArray(
    parsed.nutrition?.favorites,
    'Food favorites'
  );
  const customFoods = assertArray(
    parsed.nutrition?.customBarcodeFoods,
    'Custom foods'
  );
  const workouts = assertArray(
    parsed.exercise?.strengthWorkouts,
    'Workout history'
  );
  const runs = assertArray(
    parsed.exercise?.runningAndCycling,
    'Run history'
  );
  const vitamins = assertArray(
    parsed.vitamins,
    'Vitamins'
  );
  const steps = assertArray(parsed.steps, 'Steps');

  const runNoticeSettings =
    parsed.settings?.runNotificationMiles === undefined
      ? {}
      : { [profileId]: parsed.settings.runNotificationMiles };

  const storagePairs: [string, string][] = [
    [PROFILE_KEY, JSON.stringify(parsed.profile)],
    [ACTIVE_PROFILE_ID_KEY, profileId],
    [FOOD_LOGS_KEY, stringify(foodLogs)],
    [FOOD_FAVORITES_KEY, stringify(foodFavorites)],
    [SAVED_PRODUCTS_KEY, stringify(customFoods)],
    [WORKOUT_HISTORY_KEY, stringify(workouts)],
    [RUN_HISTORY_KEY, stringify(runs)],
    [VITAMINS_KEY, stringify(vitamins)],
    [PHONE_PEDOMETER_KEY, String(Boolean(parsed.settings?.phonePedometerEnabled))],
    [RUN_NOTIFICATION_SETTINGS_KEY, JSON.stringify(runNoticeSettings)],
    ...stepPairs(profileId, steps),
  ];

  await removeExistingProfileSteps(profileId);
  await AsyncStorage.multiSet(storagePairs);

  return {
    profileId,
    importedKeys: storagePairs.length,
    importedSteps: steps.length,
    importedWorkouts: workouts.length,
    importedFoodLogs: foodLogs.length,
  };
}