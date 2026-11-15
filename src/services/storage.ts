const memoryStorage = new Map<string, string>();

function hasBrowserStorage(): boolean {
  try {
    return typeof window !== 'undefined' && typeof window.localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function readStorageJson<T>(key: string, fallback: T): T {
  try {
    const raw = hasBrowserStorage()
      ? window.localStorage.getItem(key)
      : memoryStorage.get(key) ?? null;
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function writeStorageJson<T>(key: string, value: T): void {
  try {
    const serialized = JSON.stringify(value);
    if (hasBrowserStorage()) {
      window.localStorage.setItem(key, serialized);
    } else {
      memoryStorage.set(key, serialized);
    }
  } catch {
    // Ignore quota or restricted storage errors
  }
}

export function clearStorageKey(key: string): void {
  try {
    if (hasBrowserStorage()) {
      window.localStorage.removeItem(key);
    } else {
      memoryStorage.delete(key);
    }
  } catch {
    // Ignore storage removal errors
  }
}
