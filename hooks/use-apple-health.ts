import { useCallback, useState } from 'react';

import {
  getHealthAuthorizationStatus,
  getRecentHeartRate,
  getSleepData,
  getTodaySteps,
  requestHealthPermissions,
} from '../services/apple-health';
import type {
  AppleHealthConnectionStatus,
  HeartRateSample,
  SleepData,
} from '../types/appleHealth';

export function useAppleHealth() {
  const [status, setStatus] = useState<AppleHealthConnectionStatus>('checking');
  const [steps, setSteps] = useState<number | null>(null);
  const [heartRate, setHeartRate] = useState<HeartRateSample | null>(null);
  const [sleep, setSleep] = useState<SleepData>({ sessions: [], latestSleepDurationMinutes: null });
  const [loading, setLoading] = useState(false);

  const loadHealthData = useCallback(async () => {
    const authorization = await getHealthAuthorizationStatus();
    setStatus(authorization.status);
    if (authorization.status !== 'connected') {
      setSteps(null);
      setHeartRate(null);
      setSleep({ sessions: [], latestSleepDurationMinutes: null });
      return;
    }

    const [todaySteps, latestHeartRate, sleepData] = await Promise.all([
      getTodaySteps(),
      getRecentHeartRate(),
      getSleepData(),
    ]);
    setSteps(todaySteps);
    setHeartRate(latestHeartRate);
    setSleep(sleepData);
  }, []);

  const initialize = useCallback(async () => {
    setLoading(true);
    try {
      await loadHealthData();
    } finally {
      setLoading(false);
    }
  }, [loadHealthData]);

  const connect = useCallback(async () => {
    setLoading(true);
    try {
      const authorization = await requestHealthPermissions();
      setStatus(authorization.status);
      if (authorization.status === 'connected') {
        await loadHealthData();
      } else {
        setSteps(null);
        setHeartRate(null);
        setSleep({ sessions: [], latestSleepDurationMinutes: null });
      }
      return authorization;
    } finally {
      setLoading(false);
    }
  }, [loadHealthData]);

  return { status, steps, heartRate, sleep, loading, initialize, connect, refresh: initialize };
}
