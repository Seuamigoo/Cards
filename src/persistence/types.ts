export const SAVE_VERSION = 1;

export interface StorageAdapter {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  remove(key: string): Promise<void>;
}

export type PersistenceErrorCode = "corrupt" | "invalid" | "not_found" | "migration";

export interface PersistenceError {
  readonly code: PersistenceErrorCode;
  readonly message: string;
}

export type PersistResult<T> =
  | { readonly ok: true; readonly value: T }
  | { readonly ok: false; readonly error: PersistenceError };

export function persistOk<T>(value: T): PersistResult<T> {
  return { ok: true, value };
}

export function persistFail(code: PersistenceErrorCode, message: string): PersistResult<never> {
  return { ok: false, error: { code, message } };
}
