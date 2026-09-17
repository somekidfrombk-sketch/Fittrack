// Serialize read-modify-write operations for each storage key. Failed writes
// must not block later saves, and unrelated collections can save independently.
const pending = new Map<string, Promise<unknown>>();

export function withStorageLock<T>(key: string, operation: () => Promise<T>): Promise<T> {
  const previous = pending.get(key) ?? Promise.resolve();
  const next = previous.catch(() => undefined).then(operation);
  pending.set(key, next);
  void next.finally(() => {
    if (pending.get(key) === next) pending.delete(key);
  }).catch(() => undefined);
  return next;
}
