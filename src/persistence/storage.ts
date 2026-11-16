import type { StorageAdapter } from "./types";

export class MemoryStorageAdapter implements StorageAdapter {
  private readonly values = new Map<string, string>();

  async get(key: string): Promise<string | null> {
    return this.values.get(key) ?? null;
  }

  async set(key: string, value: string): Promise<void> {
    this.values.set(key, value);
  }

  async remove(key: string): Promise<void> {
    this.values.delete(key);
  }
}

interface KeyValueStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

export class LocalStorageAdapter implements StorageAdapter {
  private readonly storage: KeyValueStorage;

  constructor(storage?: KeyValueStorage) {
    const resolved = storage ?? readLocalStorage();
    if (resolved === null) {
      throw new Error("localStorage indisponível neste ambiente.");
    }
    this.storage = resolved;
  }

  async get(key: string): Promise<string | null> {
    return this.storage.getItem(key);
  }

  async set(key: string, value: string): Promise<void> {
    this.storage.setItem(key, value);
  }

  async remove(key: string): Promise<void> {
    this.storage.removeItem(key);
  }
}

export function tryCreateLocalStorageAdapter(): LocalStorageAdapter | null {
  const storage = readLocalStorage();
  if (storage === null) {
    return null;
  }
  return new LocalStorageAdapter(storage);
}

function readLocalStorage(): KeyValueStorage | null {
  const candidate = (globalThis as { localStorage?: unknown }).localStorage;
  if (typeof candidate !== "object" || candidate === null) {
    return null;
  }
  const storage = candidate as Partial<KeyValueStorage>;
  if (
    typeof storage.getItem !== "function" ||
    typeof storage.setItem !== "function" ||
    typeof storage.removeItem !== "function"
  ) {
    return null;
  }
  return candidate as KeyValueStorage;
}
