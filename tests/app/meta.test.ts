import { describe, expect, it } from "vitest";
import { filterCards } from "../../app/src/shell/cardFilters";
import { ADD_DISABLED_MARKET, ADD_DISABLED_UNIQUE, deckEditOffer, deckSizeStatus } from "../../app/src/shell/deckRules";
import { applyStarter, freshAccount, guestRecord, validateDecks } from "../../app/src/shell/playerData";
import { stubUpdateView } from "../../app/src/updateScreen";
import { CardRegistry } from "../../src/catalog/index";
import catalogFile from "../../catalog/cards.json";

describe("atualização", () => {
  it("no dev segue direto e sem rede fica offline", () => {
    expect(stubUpdateView({ dev: true, online: true, preview: null }).phase).toBe("current");
    expect(stubUpdateView({ dev: false, online: false, preview: null }).phase).toBe("offline");
    expect(stubUpdateView({ dev: false, online: true, preview: "mandatory" })).toEqual({ phase: "mandatory", progress: 0.4 });
  });
});

describe("deck e coleção", () => {
  it("trava Lendária em 1 cópia, o mercado e o tamanho do modo", () => {
    expect(deckEditOffer({ owned: 2, inDeck: 1, rarity: "lendaria" }).add).toEqual({
      state: "disabled",
      reason: ADD_DISABLED_UNIQUE,
    });
    expect(deckEditOffer({ owned: 2, inDeck: 0, rarity: "comum", listed: true }).add).toEqual({
      state: "disabled",
      reason: ADD_DISABLED_MARKET,
    });
    expect(deckSizeStatus("classic", 20).valid).toBe(false);
    expect(deckSizeStatus("blitz", 20).valid).toBe(true);
  });

  it("o convidado não tem economia e o deck inicial cabe no modo", () => {
    const guest = guestRecord();
    expect(guest.economy).toBe(false);
    expect(guest.crystals).toBe(0);
    const classic = guest.decks.find((deck) => deck.mode === "classic");
    expect(classic?.cardIds.length).toBe(40);
    const chosen = applyStarter(freshAccount(), "vanguarda-do-reino");
    expect(chosen.starterChosen).toBe(true);
    expect(validateDecks(chosen.decks, () => "comum")).toBeNull();
  });

  it("filtra por raça, classe e nível", () => {
    const loaded = CardRegistry.fromJSON(JSON.stringify(catalogFile));
    if (!loaded.ok) {
      throw new Error("catálogo");
    }
    const dragons = filterCards(loaded.registry.all(), {
      query: "",
      kind: "monster",
      rarity: "all",
      tag: "all",
      race: "DRAGON",
      cardClass: "WARRIOR",
      level: 3,
    });
    expect(dragons.map((card) => card.id)).toContain("filhote-de-brasa");
  });
});
