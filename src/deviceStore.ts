// Device storage that never throws: blocked or full storage (privacy modes, quota) and unreadable
// JSON count as "nothing stored". The storage is passed as a getter, since even reading
// `localStorage` can throw when storage is blocked.

/** The stored JSON value under `key`, or null when there is none or it cannot be read. */
export function readJson(storage: () => Storage | null, key: string): unknown {
  try {
    const raw = storage()?.getItem(key);
    return raw ? (JSON.parse(raw) as unknown) : null;
  } catch {
    return null;
  }
}

/** Stores `value` as JSON under `key`; false when the storage refused it. */
export function writeJson(storage: () => Storage | null, key: string, value: unknown): boolean {
  try {
    storage()?.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}
