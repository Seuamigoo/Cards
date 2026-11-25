export const SERVER_STORAGE_KEY = "convergencia.server";

export interface ServerStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export function normalizeServerInput(input: string): string {
  const trimmed = input.trim();
  if (trimmed.length === 0) {
    return "";
  }
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  return withScheme.replace(/\/+$/, "");
}

export function serverFieldValue(buildUrl: string, stored: string | null): string {
  if (stored !== null && stored.trim().length > 0) {
    return stored.trim();
  }
  return buildUrl.trim();
}

export function serverBase(buildUrl: string, stored: string | null): string {
  return normalizeServerInput(serverFieldValue(buildUrl, stored));
}

export function readStoredServer(store: ServerStore): string | null {
  return store.getItem(SERVER_STORAGE_KEY);
}

export function rememberServer(store: ServerStore, input: string): string {
  const normalized = normalizeServerInput(input);
  store.setItem(SERVER_STORAGE_KEY, normalized);
  return normalized;
}

export async function probeServer(base: string, fetchImpl: typeof fetch): Promise<string | null> {
  const target = `${base}/health`;
  try {
    const response = await fetchImpl(target, { method: "GET" });
    if (!response.ok) {
      return unreachable();
    }
    const body = (await response.json()) as { ok?: unknown };
    if (body.ok !== true) {
      return unreachable();
    }
    return null;
  } catch {
    return unreachable();
  }
}

function unreachable(): string {
  return "Não foi possível falar com o servidor. Confira o endereço e se ele está ligado na rede.";
}
