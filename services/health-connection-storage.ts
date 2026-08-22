import AsyncStorage from '@react-native-async-storage/async-storage';

const PHONE_PEDOMETER_KEY = 'fittrack_phone_pedometer_enabled';

export async function loadPhonePedometerEnabled() {
  return (await AsyncStorage.getItem(PHONE_PEDOMETER_KEY)) === 'true';
}

export async function savePhonePedometerEnabled(enabled: boolean) {
  await AsyncStorage.setItem(PHONE_PEDOMETER_KEY, String(enabled));
}
