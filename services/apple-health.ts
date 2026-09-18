import type {
  AppleHealthAuthorizationStatus,
  HeartRateSample,
  SleepData,
} from '../types/appleHealth';

const unavailableStatus: AppleHealthAuthorizationStatus = {
  available: false,
  requestNeeded: false,
  hasRequested: false,
  status: 'unavailable',
};

export async function initializeHealthKit() {
  return unavailableStatus;
}

export async function requestHealthPermissions() {
  return unavailableStatus;
}

export async function getTodaySteps(): Promise<number | null> {
  return null;
}

export async function getRecentHeartRate(): Promise<HeartRateSample | null> {
  return null;
}

export async function getSleepData(): Promise<SleepData> {
  return { sessions: [], latestSleepDurationMinutes: null };
}

export async function getHealthAuthorizationStatus() {
  return unavailableStatus;
}
