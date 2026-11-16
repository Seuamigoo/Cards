import { describe, expect, it } from "vitest";
import {
  EventBus,
  GameMatch,
  applyAction,
  destroyTower,
  getLegalActions,
  resolveConfig,
} from "../../src/domain/index";
import type {
  Action,
  BiomeCard,
  BoardState,
  Card,
  GameEventMap,
  MonsterCard,
  Rng,
  SpellCard,
  TowerCard,
  TrapCard,
} from "../../src/domain/index";

const identityRng: Rng = { next: () => 0.999 };

function monster(id: string, atk = 1000, def = 800): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", atk, def };
}

function spell(id: string): SpellCard {
  return { id, name: id, rarity: "incomum", kind: "spell" };
}

function trap(id: string): TrapCard {
  return { id, name: id, rarity: "rara", kind: "trap" };
}

function tower(id: string, hp?: number): TowerCard {
  return {
    id,
    name: id,
    rarity: "epica",
    kind: "tower",
    ...(hp !== undefined ? { hp } : {}),
  };
}

function biome(id: string): BiomeCard {
  return { id, name: id, rarity: "lendaria", kind: "biome" };
}

function matchWith(
  decks: readonly [readonly Card[], readonly Card[]],
  overrides?: Parameters<typeof resolveConfig>[1],
): GameMatch {
  return new GameMatch("classic", ["lina", "kael"], overrides, {
    decks,
    rng: identityRng,
  });
}

function toMain(match: GameMatch): BoardState {
  match.advancePhase();
  return match.getState();
}

describe("compra e derrota", () => {
  it("compra a mão inicial sem mutar o deck de entrada e sem comprar no turno 1 do jogador 0", () => {
    const source = [monster("m1"), monster("m2"), spell("s1"), trap("t1")];
    const snapshot = source.map((card) => ({ ...card }));
    const match = matchWith([source, source], { openingHandSize: 1 });
    const state = match.getState();

    expect(source).toEqual(snapshot);
    expect(state.players[0].hand.map((card) => card.id)).toEqual(["t1"]);
    expect(state.players[0].deck.map((card) => card.id)).toEqual(["m1", "m2", "s1"]);
    expect(state.winner).toBeNull();

    const drawn: string[] = [];
    match.events.on("card:drawn", (payload) => {
      drawn.push(payload.card.id);
    });
    match.advancePhase();
    expect(match.getState().phase).toBe("main1");
    expect(match.getState().players[0].deck).toHaveLength(3);
    expect(drawn).toEqual([]);
  });

  it("compra 1 carta ao entrar na fase draw dos turnos seguintes", () => {
    const cards = [monster("m1"), monster("m2"), monster("m3"), monster("m4")];
    const match = matchWith([cards, cards], { openingHandSize: 1 });
    const drawn: Array<{ player: number; card: string; turn: number }> = [];
    match.events.on("card:drawn", (payload) => {
      drawn.push({ player: payload.playerIndex, card: payload.card.id, turn: payload.turn });
      expect(match.getState().players[payload.playerIndex].hand.at(-1)?.id).toBe(payload.card.id);
    });

    for (let step = 0; step < 4; step += 1) {
      match.advancePhase();
    }
    expect(drawn).toEqual([]);
    match.advancePhase();

    expect(match.getState().turn).toBe(2);
    expect(match.getState().activePlayerIndex).toBe(1);
    expect(match.getState().players[1].deck.map((card) => card.id)).toEqual(["m1", "m2"]);
    expect(match.getState().players[1].hand.map((card) => card.id)).toEqual(["m4", "m3"]);
    expect(drawn).toEqual([{ player: 1, card: "m3", turn: 2 }]);
  });

  it("derrota quem compra com o deck vazio", () => {
    const cards = [monster("m1")];
    const match = matchWith([cards, cards], { openingHandSize: 1 });
    const order: string[] = [];
    match.events.on("phase:changed", () => {
      order.push("phase:changed");
      if (match.getState().turn === 2) {
        expect(match.getState().winner).toBe(0);
      }
    });
    match.events.on("turn:started", () => {
      order.push("turn:started");
    });
    match.events.on("card:drawn", () => {
      order.push("card:drawn");
    });
    match.events.on("game:over", (payload) => {
      order.push("game:over");
      expect(payload).toEqual({ winner: 0, reason: "deck_out" });
      expect(match.getState().winner).toBe(0);
    });

    for (let step = 0; step < 5; step += 1) {
      match.advancePhase();
    }

    expect(match.getState().phase).toBe("draw");
    expect(match.getState().turn).toBe(2);
    expect(match.getState().winner).toBe(0);
    expect(getLegalActions(match.getState(), 1)).toEqual([]);
    expect(match.advancePhase()).toBe(match.getState());
    expect(match.getState().turn).toBe(2);
    expect(order.filter((event) => event !== "phase:changed" && event !== "turn:started")).toEqual([
      "game:over",
    ]);
    expect(order.at(-3)).toBe("phase:changed");
    expect(order.at(-2)).toBe("turn:started");
    expect(order.at(-1)).toBe("game:over");
  });

  it("define o vencedor na mão inicial quando o deck não cobre a compra", () => {
    const emitted: Array<keyof GameEventMap> = [];
    const originalEmit = EventBus.prototype.emit;
    EventBus.prototype.emit = function spy<K extends keyof GameEventMap>(
      this: EventBus,
      event: K,
      payload: GameEventMap[K],
    ): void {
      emitted.push(event);
      originalEmit.call(this, event, payload);
    };

    try {
      const match = new GameMatch(
        "classic",
        ["lina", "kael"],
        { openingHandSize: 3 },
        {
          decks: [
            [monster("a"), monster("b")],
            [monster("c"), monster("d"), monster("e"), monster("f")],
          ],
          rng: identityRng,
        },
      );
      expect(match.getState().winner).toBe(1);
      expect(match.getState().players[0].hand).toHaveLength(2);
      expect(match.getState().players[0].deck).toEqual([]);
      expect(match.getState().players[1].hand).toHaveLength(3);
      expect(emitted).toEqual(["game:over"]);
    } finally {
      EventBus.prototype.emit = originalEmit;
    }
  });
});

describe("ações", () => {
  const deck = [
    monster("m1"),
    monster("m2"),
    spell("s1"),
    trap("t1"),
    tower("tw"),
    biome("b1"),
  ];

  function opened(): GameMatch {
    return matchWith([deck, deck], { openingHandSize: deck.length });
  }

  it("rejeita fase, jogador, zona ocupada e segunda invocação", () => {
    const match = opened();
    const initial = match.getState();
    const wrongPlayer = applyAction(initial, 1, { type: "advancePhase" });
    expect(wrongPlayer.ok).toBe(false);
    expect(initial.players[0].hand).toBe(match.getState().players[0].hand);

    const early = applyAction(initial, 0, { type: "summonMonster", handIndex: 5, zoneIndex: 0 });
    expect(early).toEqual({
      ok: false,
      error: "Invocações e posicionamentos só são permitidos em main1 ou main2.",
    });

    toMain(match);
    const summoned = match.dispatch({ type: "summonMonster", handIndex: 5, zoneIndex: 0 });
    expect(summoned.ok).toBe(true);
    const second = match.dispatch({ type: "summonMonster", handIndex: 4, zoneIndex: 1 });
    expect(second).toEqual({ ok: false, error: "Só é permitida uma invocação normal por turno." });
    expect(match.getState().players[0].monsterZone[1]).toBeNull();

    const crowded = matchWith(
      [
        [monster("only"), monster("extra")],
        [monster("foe1"), monster("foe2")],
      ],
      { openingHandSize: 2, monsterSlots: 1 },
    );
    toMain(crowded);
    expect(crowded.dispatch({ type: "summonMonster", handIndex: 1, zoneIndex: 0 }).ok).toBe(true);
    expect(crowded.dispatch({ type: "summonMonster", handIndex: 0, zoneIndex: 0 })).toEqual({
      ok: false,
      error: "A zona de monstro está ocupada.",
    });
  });

  it("seta magia e armadilha, joga bioma substituindo o anterior e respeita o hp da Torre", () => {
    const mine = [spell("s1"), trap("t1"), biome("b1"), biome("b2"), tower("plain"), tower("fixed", 2200)];
    const match = matchWith([mine, mine], { openingHandSize: 6, defaultTowerHp: 1500 });
    toMain(match);
    expect(match.getState().players[0].hand.map((card) => card.id)).toEqual([
      "fixed",
      "plain",
      "b2",
      "b1",
      "t1",
      "s1",
    ]);

    expect(match.dispatch({ type: "setSpellTrap", handIndex: 5, zoneIndex: 0 }).ok).toBe(true);
    expect(match.dispatch({ type: "setSpellTrap", handIndex: 4, zoneIndex: 0 })).toEqual({
      ok: false,
      error: "A zona de magia/armadilha está ocupada.",
    });
    expect(match.dispatch({ type: "setSpellTrap", handIndex: 4, zoneIndex: 1 }).ok).toBe(true);
    expect(match.getState().players[0].spellTrapZone[0]?.id).toBe("s1");
    expect(match.getState().players[0].spellTrapZone[1]?.id).toBe("t1");

    const biomes: string[] = [];
    match.events.on("biome:played", (payload) => {
      biomes.push(`${payload.card.id}:${payload.replaced?.id ?? "nenhum"}`);
      expect(match.getState().players[0].biomeZone?.id).toBe(payload.card.id);
    });
    expect(match.dispatch({ type: "playBiome", handIndex: 3 }).ok).toBe(true);
    expect(match.dispatch({ type: "playBiome", handIndex: 2 }).ok).toBe(true);
    expect(match.getState().players[0].biomeZone?.id).toBe("b2");
    expect(match.getState().players[0].graveyard.map((card) => card.id)).toEqual(["b1"]);
    expect(biomes).toEqual(["b1:nenhum", "b2:b1"]);

    const towers: number[] = [];
    match.events.on("tower:summoned", (payload) => {
      towers.push(payload.hp);
    });
    expect(match.dispatch({ type: "summonTower", handIndex: 1 }).ok).toBe(true);
    expect(match.getState().players[0].towerZone).toMatchObject({ hp: 1500, maxHp: 1500 });
    expect(towers).toEqual([1500]);
  });

  it("manda a Torre destruída ao limbo e permite invocar outra", () => {
    const mine = [tower("first", 1800), tower("second")];
    const match = matchWith([mine, mine], { openingHandSize: 2, defaultTowerHp: 1500 });
    toMain(match);
    expect(match.dispatch({ type: "summonTower", handIndex: 1 }).ok).toBe(true);
    expect(match.dispatch({ type: "summonTower", handIndex: 0 })).toEqual({
      ok: false,
      error: "A zona de Torre está ocupada.",
    });

    const destroyed = match.destroyTower(0);
    expect(destroyed.ok).toBe(true);
    expect(match.getState().players[0].towerZone).toBeNull();
    expect(match.getState().players[0].limbo.map((card) => card.id)).toEqual(["first"]);
    expect(match.getState().players[0].towerSummonedThisTurn).toBe(false);
    expect(match.dispatch({ type: "summonTower", handIndex: 0 }).ok).toBe(true);
    expect(match.getState().players[0].towerZone?.card.id).toBe("second");
    expect(match.getState().players[0].towerZone?.hp).toBe(1500);
  });

  it("descarta até o limite e zera as flags no fim do turno", () => {
    const cards = [monster("m1"), monster("m2"), monster("m3"), monster("m4")];
    const match = matchWith([cards, cards], { openingHandSize: 4, handLimit: 2 });
    toMain(match);
    expect(match.dispatch({ type: "summonMonster", handIndex: 3, zoneIndex: 0 }).ok).toBe(true);
    expect(match.getState().players[0].normalSummonedThisTurn).toBe(true);

    match.advancePhase();
    match.advancePhase();
    match.advancePhase();
    match.advancePhase();

    const player = match.getState().players[0];
    expect(match.getState().turn).toBe(2);
    expect(player.hand.map((card) => card.id)).toEqual(["m4", "m3"]);
    expect(player.graveyard.map((card) => card.id)).toEqual(["m2"]);
    expect(player.normalSummonedThisTurn).toBe(false);
    expect(player.towerSummonedThisTurn).toBe(false);
  });

  it("aplica todas as ações legais e preserva o estado anterior", () => {
    const match = opened();
    toMain(match);
    const state = match.getState();
    const hand = state.players[0].hand;
    const actions = getLegalActions(state, 0);
    expect(actions.some((action) => action.type === "summonMonster")).toBe(true);
    expect(actions.some((action) => action.type === "setSpellTrap")).toBe(true);
    expect(actions.some((action) => action.type === "summonTower")).toBe(true);
    expect(actions.some((action) => action.type === "playBiome")).toBe(true);

    for (const action of actions) {
      const result = applyAction(state, 0, action);
      expect(result.ok, JSON.stringify(action)).toBe(true);
    }

    const illegal: Action = { type: "summonMonster", handIndex: 0, zoneIndex: 0 };
    const rejected = applyAction(state, 0, illegal);
    expect(rejected.ok).toBe(false);
    expect(state.players[0].hand).toBe(hand);
    expect(match.getState()).toBe(state);
  });

  it("não emite nem altera o estado quando a ação é inválida", () => {
    const match = opened();
    toMain(match);
    const before = match.getState();
    const events: string[] = [];
    match.events.on("monster:summoned", () => {
      events.push("monster:summoned");
    });
    const result = match.dispatch({ type: "summonMonster", handIndex: 0, zoneIndex: 0 });
    expect(result.ok).toBe(false);
    expect(events).toEqual([]);
    expect(match.getState()).toBe(before);
  });

  it("emite monster:summoned com o estado já atualizado", () => {
    const match = opened();
    toMain(match);
    match.events.on("monster:summoned", (payload) => {
      expect(match.getState().players[0].monsterZone[payload.zoneIndex]?.id).toBe(payload.card.id);
    });
    const result = match.dispatch({ type: "summonMonster", handIndex: 5, zoneIndex: 2 });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state).toBe(match.getState());
    }
  });
});

describe("destroyTower", () => {
  it("falha sem Torre", () => {
    const cards = [monster("m1")];
    const match = matchWith([cards, cards], { openingHandSize: 1 });
    expect(destroyTower(match.getState(), 0)).toEqual({
      ok: false,
      error: "Não há Torre para destruir.",
    });
  });
});
