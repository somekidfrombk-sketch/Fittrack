import AsyncStorage from '@react-native-async-storage/async-storage';

const PHONE_PEDOMETER_KEY = 'fittrack_phone_pedometer_enabled';
const APPLE_HEALTH_REQUESTED_KEY = 'fittrack_apple_health_requested';

export async function loadPhonePedometerEnabled() {
  return (await AsyncStorage.getItem(PHONE_PEDOMETER_KEY)) === 'true';
}

export async function savePhonePedometerEnabled(enabled: boolean) {
  await AsyncStorage.setItem(PHONE_PEDOMETER_KEY, String(enabled));
}

export async function loadAppleHealthRequested() {
  return (await AsyncStorage.getItem(APPLE_HEALTH_REQUESTED_KEY)) === 'true';
}

export async function saveAppleHealthRequested(requested: boolean) {
  await AsyncStorage.setItem(APPLE_HEALTH_REQUESTED_KEY, String(requested));
}
