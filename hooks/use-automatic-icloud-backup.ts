import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';

import { createAutomaticICloudBackup } from '../services/icloud-backup';

export function useAutomaticICloudBackup() {
  useEffect(() => {
    if (Platform.OS !== 'ios') return;

    const subscription = AppState.addEventListener('change', (nextState) => {
      if (nextState !== 'background') return;

      void createAutomaticICloudBackup()
        .catch((error) => console.warn('Automatic iCloud backup skipped:', error));
    });

    return () => subscription.remove();
  }, []);
}
