import { describe, expect, it } from "vitest";
import {
  GameMatch,
  applyAction,
  getLegalActions,
  getLegalTargets,
  resolveConfig,
} from "../../src/domain/index";
import type { AttackTarget, BoardState, MonsterCard, PlayerIndex } from "../../src/domain/index";

function monster(id: string, atk: number, def = 0): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", atk, def };
}

function towerCard(id: string) {
  return { id, name: id, rarity: "epica" as const, kind: "tower" as const, hp: 1000 };
}

function battleState(options: {
  turn?: number;
  active?: PlayerIndex;
  phase?: BoardState["phase"];
  attacker?: MonsterCard | null;
  defender?: MonsterCard | null;
  towerHp?: number | null;
  attackerHp?: number;
  defenderHp?: number;
  attacked?: boolean;
}): BoardState {
  const config = resolveConfig("classic", { playerHp: 8000, monsterSlots: 2 });
  const flags = [options.attacked === true, false];
  const attackerZone = [options.attacker ?? null, null];
  const defenderZone = [options.defender ?? null, null];
  const base = {
    hand: [],
    deck: [],
    spellTrapZone: [null, null, null, null, null, null],
    biomeZone: null,
    graveyard: [],
    limbo: [],
    towerSummonedThisTurn: false,
    normalSummonedThisTurn: false,
  };
  return {
    config,
    turn: options.turn ?? 2,
    activePlayerIndex: options.active ?? 0,
    phase: options.phase ?? "battle",
    winner: null,
    players: [
      {
        ...base,
        id: "lina",
        hp: options.attackerHp ?? 8000,
        monsterZone: options.active === 1 ? defenderZone : attackerZone,
        towerZone: null,
        attackedThisTurn: options.active === 1 ? [false, false] : flags,
      },
      {
        ...base,
        id: "kael",
        hp: options.defenderHp ?? 8000,
        monsterZone: options.active === 1 ? attackerZone : defenderZone,
        towerZone:
          options.towerHp === undefined || options.towerHp === null
            ? null
            : { card: towerCard("torre"), hp: options.towerHp, maxHp: options.towerHp },
        attackedThisTurn: options.active === 1 ? flags : [false, false],
      },
    ],
  };
}

function attack(target: AttackTarget) {
  return { type: "attack" as const, attackerZoneIndex: 0, target };
}

describe("combate", () => {
  it("rejeita ataque fora de battle e no turno 1 do jogador 0", () => {
    const draw = battleState({ phase: "draw", attacker: monster("a", 1000) });
    expect(getLegalTargets(draw, 0, 0)).toEqual([]);
    expect(applyAction(draw, 0, attack({ kind: "player" })).ok).toBe(false);

    const firstTurn = battleState({ turn: 1, attacker: monster("a", 1000) });
    expect(getLegalTargets(firstTurn, 0, 0)).toEqual([]);
    expect(getLegalActions(firstTurn, 0).some((action) => action.type === "attack")).toBe(false);
  });

  it("só aponta monstros quando o oponente controla algum", () => {
    const state = battleState({
      attacker: monster("a", 1800),
      defender: monster("d", 1000),
      towerHp: 2000,
    });
    expect(getLegalTargets(state, 0, 0)).toEqual([{ kind: "monster", zoneIndex: 0 }]);
    expect(applyAction(state, 0, attack({ kind: "player" })).ok).toBe(false);
    expect(applyAction(state, 0, attack({ kind: "tower" })).ok).toBe(false);
  });

  it("permite Torre e jogador quando não há monstro inimigo", () => {
    const withTower = battleState({ attacker: monster("a", 1500), towerHp: 2000 });
    expect(getLegalTargets(withTower, 0, 0)).toEqual([{ kind: "tower" }, { kind: "player" }]);
    const open = battleState({ attacker: monster("a", 1500), towerHp: null });
    expect(getLegalTargets(open, 0, 0)).toEqual([{ kind: "player" }]);
  });

  it("destrói o monstro de menor ATK e aplica a diferença no HP do dono", () => {
    const state = battleState({
      attacker: monster("a", 1800),
      defender: monster("d", 1000),
      attackerHp: 5000,
      defenderHp: 5000,
    });
    const result = applyAction(state, 0, attack({ kind: "monster", zoneIndex: 0 }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.players[1].monsterZone[0]).toBeNull();
    expect(result.state.players[1].graveyard.map((card) => card.id)).toEqual(["d"]);
    expect(result.state.players[1].hp).toBe(4200);
    expect(result.state.players[0].hp).toBe(5000);
    expect(result.state.players[0].monsterZone[0]?.id).toBe("a");
    expect(state.players[1].hp).toBe(5000);
    expect(state.players[1].monsterZone[0]?.id).toBe("d");
  });

  it("destrói os dois monstros no empate sem alterar HP", () => {
    const state = battleState({
      attacker: monster("a", 1200),
      defender: monster("d", 1200),
    });
    const result = applyAction(state, 0, attack({ kind: "monster", zoneIndex: 0 }));
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    expect(result.state.players[0].monsterZone[0]).toBeNull();
    expect(result.state.players[1].monsterZone[0]).toBeNull();
    expect(result.state.players[0].graveyard.map((card) => card.id)).toEqual(["a"]);
    expect(result.state.players[1].graveyard.map((card) => card.id)).toEqual(["d"]);
    expect(result.state.players[0].hp).toBe(8000);
    expect(result.state.players[1].hp).toBe(8000);
  });

  it("impede o segundo ataque do mesmo monstro", () => {
    const state = battleState({ attacker: monster("a", 1000), towerHp: null });
    const first = applyAction(state, 0, attack({ kind: "player" }));
    expect(first.ok).toBe(true);
    if (!first.ok) {
      return;
    }
    expect(getLegalTargets(first.state, 0, 0)).toEqual([]);
    expect(applyAction(first.state, 0, attack({ kind: "player" })).ok).toBe(false);
  });

  it("reduz a Torre e manda a carta ao limbo quando o hp chega a 0", () => {
    const scratched = battleState({ attacker: monster("a", 400), towerHp: 1000 });
    const partial = applyAction(scratched, 0, attack({ kind: "tower" }));
    expect(partial.ok).toBe(true);
    if (!partial.ok) {
      return;
    }
    expect(partial.state.players[1].towerZone?.hp).toBe(600);
    expect(partial.state.players[1].limbo).toEqual([]);

    const lethal = battleState({ attacker: monster("a", 1000), towerHp: 1000 });
    const destroyed = applyAction(lethal, 0, attack({ kind: "tower" }));
    expect(destroyed.ok).toBe(true);
    if (!destroyed.ok) {
      return;
    }
    expect(destroyed.state.players[1].towerZone).toBeNull();
    expect(destroyed.state.players[1].limbo.map((card) => card.id)).toEqual(["torre"]);
    expect(destroyed.state.players[1].towerSummonedThisTurn).toBe(false);
  });

  it("ataque direto reduz o HP e encerra a partida em player_hp", () => {
    const state = battleState({
      attacker: monster("a", 500),
      defenderHp: 500,
      towerHp: null,
    });
    const events: string[] = [];
    const match = GameMatch.fromState(state);
    match.events.on("attack:declared", () => {
      events.push("declared");
      expect(match.getState().players[1].hp).toBe(0);
    });
    match.events.on("damage:dealt", (payload) => {
      events.push(`damage:${payload.playerIndex}:${payload.amount}`);
    });
    match.events.on("game:over", (payload) => {
      events.push(`over:${payload.reason}`);
    });
    const result = match.dispatch(attack({ kind: "player" }));
    expect(result.ok).toBe(true);
    expect(match.getState().winner).toBe(0);
    expect(getLegalActions(match.getState(), 0)).toEqual([]);
    expect(events).toEqual(["declared", "damage:1:500", "over:player_hp"]);
  });

  it("aplica todas as ações legais de battle sem mudar o estado de origem", () => {
    const state = battleState({
      attacker: monster("a", 1600),
      defender: monster("d", 900),
    });
    const actions = getLegalActions(state, 0);
    expect(actions.some((action) => action.type === "attack")).toBe(true);
    for (const action of actions) {
      expect(applyAction(state, 0, action).ok).toBe(true);
    }
    expect(state.players[1].hp).toBe(8000);
  });

  it("não altera a partida sem deck ao avançar fases", () => {
    const match = new GameMatch("classic", ["lina", "kael"]);
    match.advancePhase();
    match.advancePhase();
    expect(match.getState().phase).toBe("battle");
    expect(match.getState().turn).toBe(1);
    expect(getLegalActions(match.getState(), 0)).toEqual([{ type: "advancePhase" }]);
  });
});
