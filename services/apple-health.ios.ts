declare const require: (
  id: string
) => HealthKitModule;

type HealthKitModule = {
  AuthorizationRequestStatus: {
    shouldRequest: number;
  };
  CategoryValueSleepAnalysis: {
    inBed: number;
    awake: number;
    asleepCore: number;
    asleepDeep: number;
    asleepREM: number;
    asleep: number;
  };
  getMostRecentQuantitySample: (
    type: string,
    unit: string
  ) => Promise<{
    quantity: number;
    endDate: Date | string;
  } | null>;
  getRequestStatusForAuthorization: (
    request: { toRead: readonly string[] }
  ) => Promise<number>;
  isHealthDataAvailableAsync: () => Promise<boolean>;
  queryCategorySamples: (
    type: string,
    options: {
      filter: {
        date: {
          startDate: Date;
          endDate: Date;
        };
      };
      limit: number;
      ascending: boolean;
    }
  ) => Promise<{
    uuid: string;
    startDate: Date | string;
    endDate: Date | string;
    value: number;
  }[]>;
  queryStatisticsForQuantity: (
    type: string,
    options: string[],
    query: {
      filter: {
        date: {
          startDate: Date;
          endDate: Date;
          strictStartDate: boolean;
          strictEndDate: boolean;
        };
      };
      unit: string;
    }
  ) => Promise<{
    sumQuantity?: { quantity: number } | null;
  }>;
  requestAuthorization: (
    request: { toRead: readonly string[] }
  ) => Promise<boolean>;
};

let healthKitModule:
  | HealthKitModule
  | null
  | undefined;

function getHealthKitModule() {
  if (healthKitModule !== undefined) {
    return healthKitModule;
  }

  try {
    healthKitModule = require(
      '@kingstinct/react-native-healthkit'
    );
  } catch (error) {
    console.warn(
      'Apple Health native module is not available in this build:',
      error
    );
    healthKitModule = null;
  }

  return healthKitModule;
}
import type {
  AppleHealthAuthorizationStatus,
  HeartRateSample,
  SleepData,
  SleepSession,
  SleepStage,
} from '../types/appleHealth';
import {
  loadAppleHealthRequested,
  saveAppleHealthRequested,
} from './health-connection-storage';

const READ_TYPES = [
  'HKQuantityTypeIdentifierHeartRate',
  'HKQuantityTypeIdentifierStepCount',
  'HKCategoryTypeIdentifierSleepAnalysis',
] as const;

function startOfToday() {
  const date = new Date();
  date.setHours(0, 0, 0, 0);
  return date;
}

function sleepStage(
  value: number,
  categories: HealthKitModule['CategoryValueSleepAnalysis']
): SleepStage {
  switch (value) {
    case categories.inBed:
      return 'in-bed';
    case categories.awake:
      return 'awake';
    case categories.asleepCore:
      return 'core';
    case categories.asleepDeep:
      return 'deep';
    case categories.asleepREM:
      return 'rem';
    case categories.asleep:
      return 'asleep';
    default:
      return 'unknown';
  }
}

function calculateLatestSleepDuration(sessions: SleepSession[]) {
  const asleep = sessions
    .filter((session) => !['awake', 'in-bed', 'unknown'].includes(session.stage))
    .map((session) => ({
      start: new Date(session.startTime).getTime(),
      end: new Date(session.endTime).getTime(),
    }))
    .filter((session) => Number.isFinite(session.start) && Number.isFinite(session.end) && session.end > session.start)
    .sort((a, b) => b.end - a.end);

  if (asleep.length === 0) return null;

  const latestEnd = asleep[0].end;
  const episodeStartLimit = latestEnd - 18 * 60 * 60 * 1000;
  const candidates = asleep
    .filter((session) => session.end >= episodeStartLimit && session.start <= latestEnd)
    .sort((a, b) => b.end - a.end);
  const latestEpisode: { start: number; end: number }[] = [];
  let episodeStart = latestEnd;
  const maximumStageGapMs = 90 * 60 * 1000;
  for (const interval of candidates) {
    if (episodeStart - interval.end > maximumStageGapMs) break;
    latestEpisode.push(interval);
    episodeStart = Math.min(episodeStart, interval.start);
  }

  const merged: { start: number; end: number }[] = [];
  for (const interval of latestEpisode.sort((a, b) => a.start - b.start)) {
    const previous = merged[merged.length - 1];
    if (previous && interval.start <= previous.end) {
      previous.end = Math.max(previous.end, interval.end);
    } else {
      merged.push({ ...interval });
    }
  }

  const totalMs = merged.reduce((total, interval) => total + interval.end - interval.start, 0);
  return Math.round(totalMs / 60000);
}

export async function getHealthAuthorizationStatus(): Promise<AppleHealthAuthorizationStatus> {
  try {
    const healthKit = getHealthKitModule();
    if (!healthKit) {
      return { available: false, requestNeeded: false, hasRequested: false, status: 'unavailable' };
    }

    const available = await healthKit.isHealthDataAvailableAsync();
    if (!available) {
      return { available: false, requestNeeded: false, hasRequested: false, status: 'unavailable' };
    }

    const [requestStatus, hasRequested] = await Promise.all([
      healthKit.getRequestStatusForAuthorization({ toRead: READ_TYPES }),
      loadAppleHealthRequested(),
    ]);
    const requestNeeded = requestStatus === healthKit.AuthorizationRequestStatus.shouldRequest;

    return {
      available: true,
      requestNeeded,
      hasRequested,
      status: requestNeeded || !hasRequested ? 'not-requested' : 'connected',
    };
  } catch (error) {
    console.error('Failed to check Apple Health availability:', error);
    return { available: true, requestNeeded: false, hasRequested: false, status: 'error' };
  }
}

export async function initializeHealthKit() {
  return getHealthAuthorizationStatus();
}

function healthAuthorizationError(error: unknown): string {
  const message = typeof error === 'string' ? error
    : error && typeof error === 'object' && 'message' in error
      ? String(error.message) : 'HealthKit returned an unknown error.';
  if (/entitlement|provision|code.?sign/i.test(message)) {
    return 'iOS rejected this installed app because its signing permissions do not allow HealthKit. The app must be signed with a provisioning profile that includes HealthKit. Opening Settings or rebuilding the same unsigned IPA will not fix the signing permissions.\n\nNative error: ' + message;
  }
  return 'The Apple Health permission request failed.\n\nNative error: ' + message;
}

export async function requestHealthPermissions(): Promise<AppleHealthAuthorizationStatus> {
  const unavailable: AppleHealthAuthorizationStatus = {
    available: false, requestNeeded: false, hasRequested: false, status: 'unavailable',
  };
  try {
    const healthKit = getHealthKitModule();
    if (!healthKit || !(await healthKit.isHealthDataAvailableAsync())) return unavailable;

    // A user-initiated request must not depend on a stored connection flag or a status query.
    const completed = await healthKit.requestAuthorization({ toRead: READ_TYPES });
    if (!completed) {
      return { available: true, requestNeeded: false, hasRequested: false, status: 'error',
        errorMessage: 'iOS did not complete the Apple Health permission request. Unlock your iPhone and try again.' };
    }
    try {
      await saveAppleHealthRequested(true);
    } catch (error) {
      // Local storage failure does not mean the native authorization request failed.
      console.warn('Could not save the Apple Health request flag:', error);
    }
    return { available: true, requestNeeded: false, hasRequested: true, status: 'connected' };
  } catch (error) {
    console.error('Failed to request Apple Health access:', error);
    return { available: true, requestNeeded: false, hasRequested: false, status: 'error',
      errorMessage: healthAuthorizationError(error) };
  }
}

export async function getTodaySteps(): Promise<number | null> {
  try {
    const healthKit = getHealthKitModule();
    if (!healthKit) return null;

    const result = await healthKit.queryStatisticsForQuantity(
      'HKQuantityTypeIdentifierStepCount',
      ['cumulativeSum'],
      {
        filter: {
          date: {
            startDate: startOfToday(),
            endDate: new Date(),
            strictStartDate: true,
            strictEndDate: true,
          },
        },
        unit: 'count',
      }
    );
    return result.sumQuantity ? Math.max(0, Math.round(result.sumQuantity.quantity)) : null;
  } catch (error) {
    console.error('Failed to read Apple Health steps:', error);
    return null;
  }
}

export async function getRecentHeartRate(): Promise<HeartRateSample | null> {
  try {
    const healthKit = getHealthKitModule();
    if (!healthKit) return null;

    const sample = await healthKit.getMostRecentQuantitySample(
      'HKQuantityTypeIdentifierHeartRate',
      'count/min'
    );
    if (!sample) return null;
    return {
      beatsPerMinute: Math.round(sample.quantity),
      timestamp: new Date(sample.endDate).toISOString(),
    };
  } catch (error) {
    console.error('Failed to read Apple Health heart rate:', error);
    return null;
  }
}

export async function getSleepData(): Promise<SleepData> {
  try {
    const now = new Date();
    const from = new Date(now);
    from.setDate(from.getDate() - 14);
    const healthKit = getHealthKitModule();
    if (!healthKit) return { sessions: [], latestSleepDurationMinutes: null };

    const samples = await healthKit.queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
      filter: { date: { startDate: from, endDate: now } },
      limit: 500,
      ascending: false,
    });

    const sessions = Array.from(
      new Map(
        samples.map((sample) => {
          const start = new Date(sample.startDate);
          const end = new Date(sample.endDate);
          const session: SleepSession = {
            id: sample.uuid,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            durationMinutes: Math.max(0, Math.round((end.getTime() - start.getTime()) / 60000)),
            stage: sleepStage(sample.value, healthKit.CategoryValueSleepAnalysis),
          };
          return [session.id, session] as const;
        })
      ).values()
    ).sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime());

    return { sessions, latestSleepDurationMinutes: calculateLatestSleepDuration(sessions) };
  } catch (error) {
    console.error('Failed to read Apple Health sleep:', error);
    return { sessions: [], latestSleepDurationMinutes: null };
  }
}
