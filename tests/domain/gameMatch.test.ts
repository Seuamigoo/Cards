import { describe, expect, it } from "vitest";
import { EventBus, GameMatch, MODE_CONFIGS } from "../../src/domain/index";
import type {
  BoardState,
  GameEventMap,
  Phase,
  PhaseChangedEvent,
  PlayerState,
} from "../../src/domain/index";

const PHASES: readonly Phase[] = ["draw", "main1", "battle", "main2", "end", "draw"];

function advanceToEnd(match: GameMatch): void {
  for (let step = 0; step < 4; step += 1) {
    match.advancePhase();
  }
}

function cloneState(state: BoardState): BoardState {
  return {
    config: { ...state.config },
    players: [clonePlayer(state.players[0]), clonePlayer(state.players[1])],
    turn: state.turn,
    activePlayerIndex: state.activePlayerIndex,
    phase: state.phase,
    winner: state.winner,
  };
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    id: player.id,
    hp: player.hp,
    hand: [...player.hand],
    deck: [...player.deck],
    monsterZone: [...player.monsterZone],
    spellTrapZone: [...player.spellTrapZone],
    towerZone:
      player.towerZone === null
        ? null
        : {
            card: player.towerZone.card,
            hp: player.towerZone.hp,
            maxHp: player.towerZone.maxHp,
          },
    biomeZone: player.biomeZone,
    graveyard: [...player.graveyard],
    limbo: [...player.limbo],
    towerSummonedThisTurn: player.towerSummonedThisTurn,
    normalSummonedThisTurn: player.normalSummonedThisTurn,
    attackedThisTurn: [...player.attackedThisTurn],
  };
}

describe("GameMatch", () => {
  it("começa no turno 1, jogador 0 e fase draw, sem emitir eventos", () => {
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
      const match = new GameMatch("classic", ["lina", "kael"]);
      expect(emitted).toEqual([]);
      expect(match.getState().turn).toBe(1);
      expect(match.getState().activePlayerIndex).toBe(0);
      expect(match.getState().phase).toBe("draw");
      expect(match.getState().config).toEqual(MODE_CONFIGS.classic);
      expect(match.getState().players[0].hp).toBe(8000);
      expect(match.getState().players[1].id).toBe("kael");
    } finally {
      EventBus.prototype.emit = originalEmit;
    }
  });

  it("aplica overrides sem alterar MODE_CONFIGS", () => {
    const match = new GameMatch("blitz", ["lina", "kael"], { playerHp: 2500 });
    const state = match.getState();

    expect(state.config.mode).toBe("blitz");
    expect(state.config.playerHp).toBe(2500);
    expect(state.players[0].hp).toBe(2500);
    expect(state.players[1].hp).toBe(2500);
    expect(state.players[0].monsterZone).toHaveLength(3);
    expect(state.players[0].spellTrapZone).toHaveLength(3);
    expect(MODE_CONFIGS.blitz.playerHp).toBe(4000);
  });

  it("percorre a sequência de fases", () => {
    const match = new GameMatch("classic", ["lina", "kael"]);
    const seen: Phase[] = [match.getState().phase];

    for (let step = 0; step < 5; step += 1) {
      match.advancePhase();
      seen.push(match.getState().phase);
    }

    expect(seen).toEqual(PHASES);
  });

  it("alterna o jogador ativo e incrementa o turno em end → draw", () => {
    const match = new GameMatch("classic", ["lina", "kael"]);

    advanceToEnd(match);
    expect(match.getState().phase).toBe("end");
    expect(match.getState().turn).toBe(1);
    expect(match.getState().activePlayerIndex).toBe(0);

    match.advancePhase();
    expect(match.getState().phase).toBe("draw");
    expect(match.getState().turn).toBe(2);
    expect(match.getState().activePlayerIndex).toBe(1);

    advanceToEnd(match);
    match.advancePhase();
    expect(match.getState().phase).toBe("draw");
    expect(match.getState().turn).toBe(3);
    expect(match.getState().activePlayerIndex).toBe(0);
  });

  it("emite 5 phase:changed e 1 turn:started em 5 avanços", () => {
    const match = new GameMatch("blitz", ["lina", "kael"]);
    let phaseChanges = 0;
    let turnStarts = 0;

    match.events.on("phase:changed", () => {
      phaseChanges += 1;
    });
    match.events.on("turn:started", () => {
      turnStarts += 1;
    });

    for (let step = 0; step < 4; step += 1) {
      match.advancePhase();
    }
    expect(phaseChanges).toBe(4);
    expect(turnStarts).toBe(0);

    match.advancePhase();
    expect(phaseChanges).toBe(5);
    expect(turnStarts).toBe(1);
  });

  it("publica a virada com o novo turno e o novo jogador, nessa ordem", () => {
    const match = new GameMatch("classic", ["lina", "kael"]);
    const order: string[] = [];
    const phasePayloads: PhaseChangedEvent[] = [];

    match.events.on("phase:changed", (payload) => {
      order.push("phase:changed");
      phasePayloads.push(payload);
    });
    match.events.on("turn:started", (payload) => {
      order.push("turn:started");
      expect(payload).toEqual({ turn: 2, activePlayerIndex: 1 });
      expect(match.getState().phase).toBe("draw");
      expect(match.getState().turn).toBe(payload.turn);
      expect(match.getState().activePlayerIndex).toBe(payload.activePlayerIndex);
    });

    for (let step = 0; step < 4; step += 1) {
      match.advancePhase();
    }
    match.advancePhase();

    expect(phasePayloads).toEqual([
      { from: "draw", to: "main1", turn: 1, activePlayerIndex: 0 },
      { from: "main1", to: "battle", turn: 1, activePlayerIndex: 0 },
      { from: "battle", to: "main2", turn: 1, activePlayerIndex: 0 },
      { from: "main2", to: "end", turn: 1, activePlayerIndex: 0 },
      { from: "end", to: "draw", turn: 2, activePlayerIndex: 1 },
    ]);
    expect(order).toEqual([
      "phase:changed",
      "phase:changed",
      "phase:changed",
      "phase:changed",
      "phase:changed",
      "turn:started",
    ]);
  });

  it("faz o handler de phase:changed observar a fase nova", () => {
    const match = new GameMatch("classic", ["lina", "kael"]);
    const observed: Phase[] = [];

    match.events.on("phase:changed", (payload) => {
      observed.push(match.getState().phase);
      expect(match.getState().phase).toBe(payload.to);
      expect(match.getState().turn).toBe(payload.turn);
      expect(match.getState().activePlayerIndex).toBe(payload.activePlayerIndex);
    });

    match.advancePhase();
    expect(observed).toEqual(["main1"]);
  });

  it("mantém inalterado o estado obtido antes de advancePhase", () => {
    const match = new GameMatch("classic", ["lina", "kael"]);
    const before = match.getState();
    const snapshot = cloneState(before);

    const next = match.advancePhase();

    expect(before).toEqual(snapshot);
    expect(before.phase).toBe("draw");
    expect(before.turn).toBe(1);
    expect(before.activePlayerIndex).toBe(0);
    expect(next).not.toBe(before);
    expect(match.getState()).toBe(next);
    expect(match.getState().phase).toBe("main1");
  });

  it("mantém o estado anterior intacto na virada de turno", () => {
    const match = new GameMatch("classic", ["lina", "kael"]);
    advanceToEnd(match);

    const before = match.getState();
    const snapshot = cloneState(before);

    match.events.on("phase:changed", () => {
      expect(before.phase).toBe("end");
      expect(before.turn).toBe(1);
      expect(before.activePlayerIndex).toBe(0);
      expect(match.getState().phase).toBe("draw");
      expect(match.getState().turn).toBe(2);
      expect(match.getState().activePlayerIndex).toBe(1);
    });

    match.advancePhase();
    expect(before).toEqual(snapshot);
  });
});
