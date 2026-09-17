import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { localDateKey } from '../utils/date';

// Refresh daily screens across midnight and when returning from background.
export function useLocalDate() {
  const [date, setDate] = useState(localDateKey);
  useEffect(() => {
    const refresh = () => setDate(localDateKey());
    const timer = setInterval(refresh, 30000);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, []);
  return date;
}
