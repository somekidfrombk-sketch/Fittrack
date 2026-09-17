import { useLocalDate } from './use-local-date';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { Pedometer } from 'expo-sensors';

import { loadSavedSteps, saveSteps } from '../services/step-storage';
import { startOfLocalDay } from '../utils/date';

export type StepStatus =
  | 'checking'
  | 'active'
  | 'denied'
  | 'unavailable';

export function useDailySteps(profileId: string, enabled: boolean) {
  const date = useLocalDate();
  const [steps, setSteps] = useState(0);
  const [status, setStatus] = useState<StepStatus>('checking');

  useEffect(() => {
    if (!profileId || !enabled) {
      setSteps(0);
      setStatus('unavailable');
      return;
    }

    let mounted = true;
    let subscription: ReturnType<typeof Pedometer.watchStepCount> | null = null;

    const startTracking = async () => {
      try {
        if (Platform.OS === 'web' || !(await Pedometer.isAvailableAsync())) {
          if (mounted) setStatus('unavailable');
          return;
        }

        const permission = await Pedometer.requestPermissionsAsync();
        if (!permission.granted) {
          if (mounted) setStatus('denied');
          return;
        }

        let startingSteps = await loadSavedSteps(profileId, date);

        if (Platform.OS === 'ios') {
          const result = await Pedometer.getStepCountAsync(
            startOfLocalDay(),
            new Date()
          );
          startingSteps = result.steps;
        }

        if (!mounted) return;
        setSteps(startingSteps);
        setStatus('active');

        subscription = Pedometer.watchStepCount((result) => {
          const updatedSteps = startingSteps + result.steps;
          if (mounted) setSteps(updatedSteps);
          if (Platform.OS === 'android') {
            void saveSteps(profileId, date, updatedSteps).catch((error) => console.error('Failed to save steps:', error));
          }
        });
      } catch (error) {
        console.error('Failed to track steps:', error);
        if (mounted) setStatus('unavailable');
      }
    };

    void startTracking();

    return () => {
      mounted = false;
      subscription?.remove();
    };
  }, [date, enabled, profileId]);

  return { steps, status };
}
