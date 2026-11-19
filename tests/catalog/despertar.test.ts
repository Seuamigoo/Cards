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
    // A seção 13 diz "32 cartas", mas as tabelas nomeiam 33 do deck principal e os decks usam as 33.
    expect(DESPERTAR_CARDS).toHaveLength(33);
    expect(loaded.registry.all()).toHaveLength(33);
    expect(DESPERTAR_PENDING.map((card) => card.id)).toEqual(["draconato-kaelthar", "ceifador-carmesim"]);
    for (const card of DESPERTAR_PENDING) {
      expect(card.todo).toEqual(["Nível não consta no GDD v0.2."]);
      expect(card.level).toBeUndefined();
    }
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

  it("liga ao motor só as palavras-chave já resolvidas e marca o resto", () => {
    const wired = DESPERTAR_CARDS.flatMap((card) =>
      card.effects.filter((effect) => effect.implemented).map(() => card.id),
    );
    expect(wired.sort()).toEqual(
      ["arqueiro-espectral", "carnical-faminto", "escudeiro-juramentado", "lamina-sem-brasao", "rei-aldren"].sort(),
    );
    const spectral = DESPERTAR_CARDS.find((card) => card.id === "arqueiro-espectral");
    expect(spectral?.keywords).toEqual(["ataqueTorre"]);
    const rush = DESPERTAR_CARDS.find((card) => card.id === "lamina-sem-brasao");
    expect(rush?.keywords).toEqual(["impeto"]);
    const pending = DESPERTAR_CARDS.flatMap((card) => card.effects.filter((effect) => !effect.implemented));
    expect(pending.length).toBeGreaterThan(0);
    expect(pending.every((effect) => effect.implemented === false && effect.text.length > 0)).toBe(true);
  });
});
