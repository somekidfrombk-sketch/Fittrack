import AsyncStorage from '@react-native-async-storage/async-storage';

const RUN_NOTIFICATION_SETTINGS_KEY = 'fittrack_run_notification_settings';
const DEFAULT_DISTANCE_MILES = 1;

type StoredSettings = Record<string, number | null>;

const readSettings = async (): Promise<StoredSettings> => {
  const saved = await AsyncStorage.getItem(RUN_NOTIFICATION_SETTINGS_KEY);
  if (!saved) return {};
  try {
    const parsed = JSON.parse(saved) as unknown;
    return parsed && typeof parsed === 'object' ? parsed as StoredSettings : {};
  } catch {
    return {};
  }
};

export async function loadRunNotificationDistance(profileId: string) {
  const settings = await readSettings();
  const value = settings[profileId];
  return value === null || (typeof value === 'number' && value > 0)
    ? value
    : DEFAULT_DISTANCE_MILES;
}

export async function saveRunNotificationDistance(
  profileId: string,
  distanceMiles: number | null
) {
  const settings = await readSettings();
  const value = distanceMiles === null
    ? null
    : Math.min(26.2, Math.max(0.1, distanceMiles));
  await AsyncStorage.setItem(
    RUN_NOTIFICATION_SETTINGS_KEY,
    JSON.stringify({ ...settings, [profileId]: value })
  );
  return value;
}
