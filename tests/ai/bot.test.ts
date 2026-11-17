import { describe, expect, it } from "vitest";
import catalogFile from "../../catalog/cards.json";
import { chooseAction } from "../../src/ai/bot";
import { CardRegistry, buildDeck } from "../../src/catalog/index";
import {
  applyAction,
  createInitialState,
  createSeededRng,
  getLegalActions,
  resolveConfig,
} from "../../src/domain/index";
import type { BoardState, MonsterCard, PlayerIndex } from "../../src/domain/index";

function monster(id: string, atk: number): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", atk, def: 100 };
}

function arena(options: {
  phase?: BoardState["phase"];
  active?: PlayerIndex;
  hand?: MonsterCard[];
  own?: Array<MonsterCard | null>;
  enemy?: Array<MonsterCard | null>;
}): BoardState {
  const config = resolveConfig("classic", { monsterSlots: 2, playerHp: 8000 });
  const own = options.own ?? [null, null];
  const enemy = options.enemy ?? [null, null];
  const player = (id: string, zone: Array<MonsterCard | null>, hand: MonsterCard[]) => ({
    id,
    hp: 8000,
    hand,
    deck: [],
    monsterZone: zone,
    spellTrapZone: [null, null, null, null, null, null],
    towerZone: null,
    biomeZone: null,
    graveyard: [],
    limbo: [],
    towerSummonedThisTurn: false,
    normalSummonedThisTurn: false,
    attackedThisTurn: [false, false],
  });
  const active = options.active ?? 0;
  return {
    config,
    turn: 2,
    activePlayerIndex: active,
    phase: options.phase ?? "main1",
    winner: null,
    players: [
      player("lina", active === 0 ? own : enemy, active === 0 ? (options.hand ?? []) : []),
      player("kael", active === 1 ? own : enemy, active === 1 ? (options.hand ?? []) : []),
    ],
  };
}

describe("bot", () => {
  it("escolhe uma ação legal nos dois níveis", () => {
    const state = arena({
      hand: [monster("fraco", 1000), monster("forte", 2500)],
      own: [monster("campo", 1200), null],
    });
    for (const seed of [1, 7]) {
      const rng = createSeededRng(seed);
      for (const level of ["easy", "normal"] as const) {
        const action = chooseAction(state, 0, rng, level);
        expect(action).not.toBeNull();
        expect(getLegalActions(state, 0)).toContainEqual(action);
      }
    }
  });

  it("não age quando não há ações legais", () => {
    const state = arena({ hand: [monster("a", 1000)] });
    expect(chooseAction(state, 1, createSeededRng(1), "easy")).toBeNull();
    expect(chooseAction(state, 1, createSeededRng(1), "normal")).toBeNull();
  });

  it("no nível normal invoca o monstro de maior ATK", () => {
    const state = arena({ hand: [monster("fraco", 900), monster("forte", 2400)] });
    const action = chooseAction(state, 0, createSeededRng(3), "normal");
    expect(action?.type).toBe("summonMonster");
    if (action?.type === "summonMonster") {
      expect(state.players[0].hand[action.handIndex]?.id).toBe("forte");
    }
  });

  it("no nível normal ataca o jogador quando não há monstro inimigo", () => {
    const state = arena({
      phase: "battle",
      own: [monster("golpe", 1800), null],
    });
    const action = chooseAction(state, 0, createSeededRng(2), "normal");
    expect(action).not.toBeNull();
    expect(getLegalActions(state, 0)).toContainEqual(action);
    expect(action).toEqual({ type: "attack", attackerZoneIndex: 0, target: { kind: "player" } });
  });

  it("uma partida bot contra bot termina em até 40 turnos", () => {
    const loaded = CardRegistry.fromJSON(JSON.stringify(catalogFile));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    const ids: string[] = [];
    const source = loaded.registry.all().map((card) => card.id);
    while (ids.length < 40) {
      for (const id of source) {
        ids.push(id);
        if (ids.length === 40) {
          break;
        }
      }
    }
    const built = buildDeck(loaded.registry, ids);
    expect(built.ok).toBe(true);
    if (!built.ok) {
      return;
    }
    const config = resolveConfig("classic");
    let state = createInitialState(config, ["lina", "kael"], [built.cards, built.cards], createSeededRng(1));
    const rng = createSeededRng(2);
    let steps = 0;
    while (state.winner === null && state.turn <= 40 && steps < 800) {
      const action = chooseAction(state, state.activePlayerIndex, rng, "normal");
      expect(action).not.toBeNull();
      expect(getLegalActions(state, state.activePlayerIndex)).toContainEqual(action);
      if (action === null) {
        break;
      }
      const result = applyAction(state, state.activePlayerIndex, action);
      expect(result.ok).toBe(true);
      if (!result.ok) {
        break;
      }
      state = result.state;
      steps += 1;
    }
    expect(state.winner).not.toBeNull();
    expect(state.turn).toBeLessThanOrEqual(40);
  });
});
