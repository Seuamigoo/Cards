import { describe, expect, it } from "vitest";
import { GameMatch, getPlayerView, redactEventFor, resolveConfig } from "../../src/domain/index";
import type { BoardState, MonsterCard, MonsterInstance } from "../../src/domain/index";

function monster(id: string): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", level: 4, atk: 1000, def: 800, tags: ["HUMAN", "WARRIOR"], keywords: [] };
}

function stateWithSecrets(): BoardState {
  const config = resolveConfig("classic", { monsterSlots: 2 });
  const faceDown: MonsterInstance = {
    card: monster("segredo"),
    position: "defense",
    summonedThisTurn: false,
    changedPositionThisTurn: false,
    attackedThisTurn: false,
    faceDown: true,
  };
  const visible: MonsterInstance = {
    card: monster("guarda"),
    position: "defense",
    summonedThisTurn: false,
    changedPositionThisTurn: false,
    attackedThisTurn: false,
  };
  const player = (id: string, zone: (MonsterInstance | null)[]) => ({
    id,
    hp: 8000,
    hand: [monster("na-mao")],
    deck: [monster("no-deck"), monster("fundo")],
    monsterZone: zone,
    spellTrapZone: [
      { id: "armadilha", name: "Armadilha", rarity: "rara" as const, kind: "trap" as const },
      null,
      null,
      null,
      null,
      null,
    ],
    towerZone: null,
    biomeZone: null,
    graveyard: [],
    limbo: [monster("publico")],
    towerSummonedThisTurn: false,
    normalSummonedThisTurn: false,
    lineageDeck: [],
    convergedThisTurn: false,
  });
  return {
    config,
    turn: 2,
    activePlayerIndex: 0,
    phase: "main1",
    winner: null,
    players: [player("lina", [faceDown, visible]), player("kael", [null, null])],
  };
}

describe("visão do jogador", () => {
  it("esconde mão, deck e carta baixada do oponente e deixa o Limbo público", () => {
    const state = stateWithSecrets();
    const view = getPlayerView(state, "kael");
    const opponent = view.players[0];
    const self = view.players[1];
    expect(opponent.handCount).toBe(1);
    expect(opponent.hand).toEqual([{ hidden: true }]);
    expect(opponent.deckCount).toBe(2);
    expect(JSON.stringify(opponent)).not.toContain("na-mao");
    expect(JSON.stringify(opponent)).not.toContain("no-deck");
    expect(JSON.stringify(opponent.spellTrapZone)).not.toContain("armadilha");
    expect(opponent.monsterZone[0]).toEqual({ hidden: true, position: "defense" });
    expect(opponent.monsterZone[1]).toMatchObject({ card: { id: "guarda" } });
    expect(opponent.limbo.map((card) => card.id)).toEqual(["publico"]);
    expect(self.hand.map((card) => ("id" in card ? card.id : ""))).toEqual(["na-mao"]);
    expect(self.spellTrapZone[0]).toMatchObject({ id: "armadilha" });
  });

  it("não revela cardId de compra nem de carta baixada para o oponente", () => {
    const state = stateWithSecrets();
    const drawn = redactEventFor(
      {
        type: "card:drawn",
        payload: { playerIndex: 0, card: monster("comprada"), turn: 2, instanceId: "inst-1", cardId: "comprada" },
      },
      "kael",
      state,
    );
    expect(drawn.payload).toEqual({ playerIndex: 0, turn: 2, hidden: true });
    expect(JSON.stringify(drawn)).not.toContain("comprada");

    const ownDraw = redactEventFor(
      {
        type: "card:drawn",
        payload: { playerIndex: 1, card: monster("minha"), turn: 2, instanceId: "inst-2", cardId: "minha" },
      },
      "kael",
      state,
    );
    expect(ownDraw.type === "card:drawn" && "cardId" in ownDraw.payload ? ownDraw.payload.cardId : "").toBe("minha");

    const set = redactEventFor(
      {
        type: "spelltrap:set",
        payload: {
          playerIndex: 0,
          zoneIndex: 2,
          card: { id: "lamina", name: "Lâmina", rarity: "incomum", kind: "spell" },
          instanceId: "inst-3",
          cardId: "lamina",
        },
      },
      "kael",
      state,
    );
    expect(set.payload).toEqual({ playerIndex: 0, zoneIndex: 2, instanceId: "inst-3", hidden: true });
    expect(JSON.stringify(set)).not.toContain("lamina");

    const activated = redactEventFor(
      {
        type: "spelltrap:activated",
        payload: { playerIndex: 0, zoneIndex: 2, instanceId: "inst-3", cardId: "lamina", owner: 0 },
      },
      "kael",
      state,
    );
    expect(activated.type === "spelltrap:activated" && activated.payload.cardId).toBe("lamina");
  });
});

describe("turno 1 com GameMatch", () => {
  it("a partida abre sem compra extra no primeiro avanço", () => {
    const cards = [monster("m1"), monster("m2"), monster("m3"), monster("m4"), monster("m5"), monster("m6")];
    const match = new GameMatch("classic", ["lina", "kael"], { openingHandSize: 5 }, {
      decks: [cards, cards],
      rng: { next: () => 0.999 },
    });
    expect(match.getState().phase).toBe("draw");
    const deck = match.getState().players[0].deck.length;
    match.advancePhase();
    expect(match.getState().players[0].deck).toHaveLength(deck);
  });
});
