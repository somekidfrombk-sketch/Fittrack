import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Vibration } from 'react-native';

export function useRestTimer() {
  const [secondsLeft, setSecondsLeft] = useState(0);
  const [active, setActive] = useState(false);
  const [complete, setComplete] = useState(false);
  const deadline = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;
    const refresh = () => {
      if (deadline.current === null) return;
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setSecondsLeft(remaining);
      if (remaining === 0) {
        deadline.current = null;
        setActive(false);
        setComplete(true);
        Vibration.vibrate([0, 250, 150, 250]);
      }
    };
    refresh();
    const timer = setInterval(refresh, 250);
    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [active]);

  const start = useCallback((seconds: number) => {
    const safeSeconds = Number.isFinite(seconds)
      ? Math.min(600, Math.max(0, Math.floor(seconds)))
      : 0;
    deadline.current = safeSeconds > 0 ? Date.now() + safeSeconds * 1000 : null;
    setComplete(false);
    setSecondsLeft(safeSeconds);
    setActive(safeSeconds > 0);
  }, []);

  const reset = useCallback(() => {
    deadline.current = null;
    setSecondsLeft(0);
    setActive(false);
    setComplete(false);
  }, []);

  return { secondsLeft, active, complete, start, reset };
}
