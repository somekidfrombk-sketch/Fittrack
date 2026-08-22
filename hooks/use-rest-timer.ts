import {
  useCallback,
  useEffect,
  useState,
} from 'react';
import { Vibration } from 'react-native';

export function useRestTimer() {
  const [secondsLeft, setSecondsLeft] =
    useState(0);
  const [active, setActive] =
    useState(false);
  const [complete, setComplete] =
    useState(false);

  useEffect(() => {
    if (!active) {
      return;
    }

    const timer = setInterval(() => {
      setSecondsLeft((current) => {
        if (current <= 1) {
          clearInterval(timer);
          setActive(false);
          setComplete(true);
          Vibration.vibrate([
            0,
            250,
            150,
            250,
          ]);
          return 0;
        }

        return current - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [active]);

  const start = useCallback(
    (seconds: number) => {
      const safeSeconds = Math.min(
        600,
        Math.max(
          0,
          Math.floor(seconds)
        )
      );

      setComplete(false);
      setSecondsLeft(safeSeconds);
      setActive(safeSeconds > 0);
    },
    []
  );

  const reset = useCallback(() => {
    setSecondsLeft(0);
    setActive(false);
    setComplete(false);
  }, []);

  return {
    secondsLeft,
    active,
    complete,
    start,
    reset,
  };
}
