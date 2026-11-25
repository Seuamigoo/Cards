import { describe, expect, it } from "vitest";
import { guestCollection, guestDecks, validateDeck } from "../../src/collection/index";

describe("validateDeck", () => {
  it("aceita os dois decks iniciais do convidado no clássico e no blitz", () => {
    const collection = guestCollection();
    for (const mode of ["classic", "blitz"] as const) {
      const decks = guestDecks(mode);
      expect(decks).toHaveLength(2);
      for (const deck of decks) {
        const result = validateDeck(deck, mode, collection);
        expect(result.errors, deck.name).toEqual([]);
        expect(result.valid).toBe(true);
        expect(result.size).toBe(mode === "classic" ? 40 : 20);
      }
    }
  });

  it("recusa cópia extra, carta lendária repetida, coleção insuficiente e tamanho fora do modo", () => {
    const collection = [
      { cardId: "recruta-da-muralha", quantity: 3 },
      { cardId: "rei-aldren", quantity: 1 },
    ];
    const tooMany = validateDeck(
      { name: "Cheio", cards: [{ cardId: "recruta-da-muralha", qty: 4 }] },
      "blitz",
      collection,
    );
    expect(tooMany.valid).toBe(false);
    expect(tooMany.errors.some((error) => error.includes("3 cópias"))).toBe(true);

    const legendary = validateDeck(
      { name: "Rei", cards: [{ cardId: "rei-aldren", qty: 2 }] },
      "blitz",
      [{ cardId: "rei-aldren", quantity: 2 }],
    );
    expect(legendary.errors.some((error) => error.includes("1 cópia"))).toBe(true);

    const missing = validateDeck(
      { name: "Sem carta", cards: [{ cardId: "recruta-da-muralha", qty: 2 }] },
      "blitz",
      [{ cardId: "recruta-da-muralha", quantity: 1 }],
    );
    expect(missing.errors.some((error) => error.includes("coleção tem 1"))).toBe(true);

    const short = validateDeck(
      { name: "Curto", cards: [{ cardId: "recruta-da-muralha", qty: 3 }] },
      "classic",
      collection,
    );
    expect(short.size).toBe(3);
    expect(short.errors.some((error) => error.includes("40 a 60"))).toBe(true);

    const lineage = validateDeck(
      {
        name: "Linhagem",
        cards: guestDecks("blitz")[0]?.cards ?? [],
        lineage: [{ cardId: "filhote-de-brasa", qty: 6 }],
      },
      "blitz",
      guestCollection(),
    );
    expect(lineage.errors.some((error) => error.includes("até 5"))).toBe(true);
  });
});
