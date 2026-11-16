import { describe, expect, it } from "vitest";
import catalogFile from "../../catalog/cards.json";
import { CardRegistry, CatalogCache, buildDeck, isNewer } from "../../src/catalog/index";
import { MemoryStorageAdapter } from "../../src/persistence/index";

const PLACEHOLDER = "assets/cards/placeholder.webp";

function envelope(cards: readonly unknown[], version = 1): string {
  return JSON.stringify({
    version,
    publishedAt: "2026-11-16T00:00:00.000Z",
    cards,
  });
}

function spell(id = "pacto", overrides: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id,
    name: "Pacto",
    rarity: "comum",
    kind: "spell",
    image: { src: PLACEHOLDER, alt: "Pacto" },
    ...overrides,
  };
}

describe("CardRegistry", () => {
  it("carrega o catálogo de exemplo", () => {
    const loaded = CardRegistry.fromJSON(JSON.stringify(catalogFile));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(loaded.registry.version()).toBe(1);
    expect(loaded.registry.publishedAt()).toBe("2026-11-16T00:00:00.000Z");
    expect(loaded.registry.all()).toHaveLength(6);
    expect(loaded.registry.byKind("monster")).toHaveLength(2);
    expect(loaded.registry.byKind("spell")).toHaveLength(1);
    expect(loaded.registry.byKind("trap")).toHaveLength(1);
    expect(loaded.registry.byKind("tower")).toHaveLength(1);
    expect(loaded.registry.byKind("biome")).toHaveLength(1);
    expect(loaded.registry.get("torre-aurora")).toMatchObject({ kind: "tower", hp: 4000 });
    expect(loaded.registry.get("ausente")).toBeUndefined();
    for (const card of loaded.registry.all()) {
      expect(card.image?.src).toBe(PLACEHOLDER);
    }
  });

  it("aceita caminho relativo e URL https", () => {
    const loaded = CardRegistry.fromJSON(
      envelope([
        spell("relativa"),
        spell("remota", { image: { src: "https://cdn.convergencia.dev/cartas/brasa.webp" } }),
      ]),
    );
    expect(loaded.ok).toBe(true);
  });

  it("rejeita id duplicado", () => {
    const loaded = CardRegistry.fromJSON(envelope([spell("igual"), spell("igual", { name: "Outra" })]));
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.errors).toEqual([
        expect.objectContaining({ index: 1, cardId: "igual", code: "duplicate_id" }),
      ]);
    }
  });

  it("rejeita imagem inválida", () => {
    const cases = ["", "cartas/brasa.gif", "http://cdn.exemplo/brasa.png", "https://", "/abs/brasa.png"];
    for (const src of cases) {
      const loaded = CardRegistry.fromJSON(envelope([spell("img", { image: { src } })]));
      expect(loaded.ok, src).toBe(false);
      if (!loaded.ok) {
        expect(loaded.errors.some((error) => error.code === "invalid_image")).toBe(true);
      }
    }
  });

  it("rejeita ATK e DEF que não são inteiros não negativos", () => {
    const loaded = CardRegistry.fromJSON(
      envelope([
        {
          id: "fraco",
          name: "Fraco",
          rarity: "comum",
          kind: "monster",
          atk: -1,
          def: 1.5,
          image: { src: PLACEHOLDER },
        },
      ]),
    );
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.errors).toEqual([
        expect.objectContaining({ cardId: "fraco", code: "invalid_stats" }),
      ]);
    }
  });

  it("monta um deck e aponta ids desconhecidos", () => {
    const loaded = CardRegistry.fromJSON(envelope([spell("a"), spell("b")]));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    const built = buildDeck(loaded.registry, ["b", "a"]);
    expect(built.ok).toBe(true);
    if (built.ok) {
      expect(built.cards.map((card) => card.id)).toEqual(["b", "a"]);
    }
    const missing = buildDeck(loaded.registry, ["a", "nao-existe", "tampouco"]);
    expect(missing).toEqual({
      ok: false,
      errors: [
        { code: "unknown_card", cardId: "nao-existe", index: 1 },
        { code: "unknown_card", cardId: "tampouco", index: 2 },
      ],
    });
  });

  it("rejeita catálogo corrompido", () => {
    const broken = CardRegistry.fromJSON("{");
    expect(broken.ok).toBe(false);
    if (!broken.ok) {
      expect(broken.errors[0]?.code).toBe("corrupt");
    }
    const shapeless = CardRegistry.fromJSON(JSON.stringify({ version: 1 }));
    expect(shapeless.ok).toBe(false);
    if (!shapeless.ok) {
      expect(shapeless.errors[0]?.code).toBe("corrupt");
    }
  });
});

describe("CatalogCache", () => {
  it("compara versões com isNewer", () => {
    expect(isNewer(1, null)).toBe(true);
    expect(isNewer(2, 1)).toBe(true);
    expect(isNewer(1, 1)).toBe(false);
    expect(isNewer(1, 2)).toBe(false);
  });

  it("guarda o catálogo baixado e só substitui quando a versão é mais nova", async () => {
    const adapter = new MemoryStorageAdapter();
    const remote = { current: envelope([spell("v1")], 1) };
    const calls: string[] = [];
    const cache = new CatalogCache(
      adapter,
      async (url) => {
        calls.push(url);
        return remote.current;
      },
      "https://cdn.convergencia.dev/catalog/cards.json",
    );

    const first = await cache.sync();
    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.registry.version()).toBe(1);
      expect(first.registry.get("v1")?.name).toBe("Pacto");
    }
    expect(calls).toHaveLength(1);

    const same = await cache.sync();
    expect(same.ok).toBe(true);
    if (same.ok) {
      expect(same.registry.version()).toBe(1);
    }
    expect(calls).toHaveLength(2);

    remote.current = envelope([spell("v2", { name: "Novo pacto" })], 2);
    const updated = await cache.sync();
    expect(updated.ok).toBe(true);
    if (updated.ok) {
      expect(updated.registry.version()).toBe(2);
      expect(updated.registry.get("v2")?.name).toBe("Novo pacto");
    }

    remote.current = envelope([spell("v1")], 1);
    const kept = await cache.sync();
    expect(kept.ok).toBe(true);
    if (kept.ok) {
      expect(kept.registry.version()).toBe(2);
      expect(kept.registry.get("v2")?.id).toBe("v2");
    }
  });

  it("não substitui um cache válido quando o download vem corrompido", async () => {
    const adapter = new MemoryStorageAdapter();
    const valid = envelope([spell("firme")], 3);
    await adapter.set("catalog:current", valid);
    let remote = "{";
    const cache = new CatalogCache(adapter, async () => remote, "https://cdn.convergencia.dev/catalog.json");
    const failed = await cache.sync();
    expect(failed.ok).toBe(false);
    expect(await adapter.get("catalog:current")).toBe(valid);

    remote = valid;
    const recovered = await cache.sync();
    expect(recovered.ok).toBe(true);
    if (recovered.ok) {
      expect(recovered.registry.get("firme")?.id).toBe("firme");
    }
  });
});
