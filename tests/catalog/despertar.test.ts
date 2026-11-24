import { describe, expect, it } from "vitest";
import catalogFile from "../../catalog/cards.json";
import { CardRegistry, STARTER_DECKS, buildDeck, starterCardIds } from "../../src/catalog/index";
import { DESPERTAR_CARDS, DESPERTAR_PENDING } from "../../src/catalog/despertar";

describe("set Despertar", () => {
  it("registra as cartas nomeadas e os dois decks dentro do limite de cópias", () => {
    const loaded = CardRegistry.fromJSON(JSON.stringify(catalogFile));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(DESPERTAR_CARDS).toHaveLength(78);
    expect(loaded.registry.all()).toHaveLength(78);
    expect(DESPERTAR_PENDING).toHaveLength(0);
    expect(loaded.registry.get("draconato-kaelthar")).toMatchObject({ level: 7 });
    expect(loaded.registry.get("ceifador-carmesim")).toMatchObject({ level: 6 });
    expect(loaded.registry.get("dragao-brasa")).toMatchObject({ level: 7, atk: 1800, def: 2200 });
    for (const deck of STARTER_DECKS) {
      for (const mode of ["classic", "blitz"] as const) {
        const ids = starterCardIds(deck.id, mode);
        expect(ids).toHaveLength(mode === "classic" ? 40 : 20);
        const built = buildDeck(loaded.registry, [...ids]);
        expect(built.ok).toBe(true);
        const counts = new Map<string, number>();
        for (const id of ids) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
          const card = loaded.registry.get(id);
          expect(card).toBeDefined();
          const copies = counts.get(id) ?? 0;
          if (card?.rarity === "lendaria" || card?.rarity === "mitica") {
            expect(copies).toBeLessThanOrEqual(1);
          } else {
            expect(copies).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });

  it("marca efeitos do lote novo como implementados e mantém o texto antigo pendente", () => {
    const byId = new Map(DESPERTAR_CARDS.map((card) => [card.id, card]));
    expect(byId.get("batedora-da-folhagem")?.effects.every((effect) => effect.implemented)).toBe(true);
    expect(byId.get("alfa-da-matilha")?.effects.every((effect) => effect.implemented)).toBe(true);
    expect(byId.get("pocao-de-campanha")?.effects.every((effect) => effect.implemented)).toBe(false);
    expect(byId.get("recruta-da-muralha")?.flavor).toContain("Cidadela");
    expect(byId.get("mineiro-da-forja-funda")?.flavor?.length).toBeGreaterThan(0);
    expect(byId.get("engrenagem-sentinela")?.effects).toEqual([]);
  });
});
