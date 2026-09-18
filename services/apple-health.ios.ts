import {
  AuthorizationRequestStatus,
  CategoryValueSleepAnalysis,
  getMostRecentQuantitySample,
  getRequestStatusForAuthorization,
  isHealthDataAvailableAsync,
  queryCategorySamples,
  queryStatisticsForQuantity,
  requestAuthorization,
} from '@kingstinct/react-native-healthkit';

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

function sleepStage(value: CategoryValueSleepAnalysis): SleepStage {
  switch (value) {
    case CategoryValueSleepAnalysis.inBed:
      return 'in-bed';
    case CategoryValueSleepAnalysis.awake:
      return 'awake';
    case CategoryValueSleepAnalysis.asleepCore:
      return 'core';
    case CategoryValueSleepAnalysis.asleepDeep:
      return 'deep';
    case CategoryValueSleepAnalysis.asleepREM:
      return 'rem';
    case CategoryValueSleepAnalysis.asleep:
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
    const available = await isHealthDataAvailableAsync();
    if (!available) {
      return { available: false, requestNeeded: false, hasRequested: false, status: 'unavailable' };
    }

    const [requestStatus, hasRequested] = await Promise.all([
      getRequestStatusForAuthorization({ toRead: READ_TYPES }),
      loadAppleHealthRequested(),
    ]);
    const requestNeeded = requestStatus === AuthorizationRequestStatus.shouldRequest;

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

export async function requestHealthPermissions(): Promise<AppleHealthAuthorizationStatus> {
  const initialStatus = await getHealthAuthorizationStatus();
  if (!initialStatus.available) return initialStatus;

  try {
    const completed = await requestAuthorization({ toRead: READ_TYPES });
    if (!completed) return { ...initialStatus, status: 'error' };

    await saveAppleHealthRequested(true);
    return { available: true, requestNeeded: false, hasRequested: true, status: 'connected' };
  } catch (error) {
    console.error('Failed to request Apple Health access:', error);
    return { ...initialStatus, status: 'error' };
  }
}

export async function getTodaySteps(): Promise<number | null> {
  try {
    const result = await queryStatisticsForQuantity(
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
    const sample = await getMostRecentQuantitySample(
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
    const samples = await queryCategorySamples('HKCategoryTypeIdentifierSleepAnalysis', {
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
            stage: sleepStage(sample.value),
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
