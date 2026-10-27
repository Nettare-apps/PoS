/**
 * A tiny key-value port so the on-device storage adapters can run in the
 * browser (localStorage) and in tests (memory). Values are JSON.
 */
export interface KV {
  get<T>(key: string, fallback: T): T;
  set(key: string, value: unknown): void;
  remove(key: string): void;
}

export class MemoryKV implements KV {
  private map = new Map<string, string>();
  get<T>(key: string, fallback: T): T {
    const v = this.map.get(key);
    return v == null ? fallback : (JSON.parse(v) as T);
  }
  set(key: string, value: unknown): void {
    this.map.set(key, JSON.stringify(value));
  }
  remove(key: string): void {
    this.map.delete(key);
  }
}

/**
 * localStorage-backed KV. `onError` surfaces quota or access failures to the
 * UI — storage problems are flagged, never swallowed into silent data loss.
 */
export class LocalStorageKV implements KV {
  constructor(private onError: (message: string) => void = () => {}) {}
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v == null ? fallback : (JSON.parse(v) as T);
    } catch {
      return fallback;
    }
  }
  set(key: string, value: unknown): void {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch (e) {
      this.onError(`This device could not save "${key}" (${e instanceof Error ? e.message : 'storage error'}).`);
    }
  }
  remove(key: string): void {
    try {
      localStorage.removeItem(key);
    } catch {
      /* removing is best-effort */
    }
  }
}
