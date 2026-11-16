import type { StorageAdapter } from "../persistence/types";
import { CardRegistry } from "./registry";
import type { CardRegistryResult } from "./registry";

export type FetchCatalog = (url: string) => Promise<string>;

export function isNewer(remoteVersion: number, cachedVersion: number | null): boolean {
  return cachedVersion === null || remoteVersion > cachedVersion;
}

export class CatalogCache {
  constructor(
    private readonly adapter: StorageAdapter,
    private readonly fetchCatalog: FetchCatalog,
    private readonly url: string,
    private readonly key = "catalog:current",
  ) {}

  async read(): Promise<CardRegistryResult | { readonly ok: true; readonly registry: null }> {
    const stored = await this.adapter.get(this.key);
    if (stored === null) {
      return { ok: true, registry: null };
    }
    return CardRegistry.fromJSON(stored);
  }

  async sync(): Promise<CardRegistryResult> {
    let text: string;
    try {
      text = await this.fetchCatalog(this.url);
    } catch {
      return {
        ok: false,
        errors: [
          {
            index: -1,
            cardId: null,
            code: "corrupt",
            message: "Falha ao baixar o catálogo.",
          },
        ],
      };
    }
    const remote = CardRegistry.fromJSON(text);
    if (!remote.ok) {
      return remote;
    }
    const cached = await this.read();
    if (
      cached.ok &&
      cached.registry !== null &&
      !isNewer(remote.registry.version(), cached.registry.version())
    ) {
      return { ok: true, registry: cached.registry };
    }
    await this.adapter.set(this.key, text);
    return remote;
  }
}
