import { applyAction, destroyTower as destroyTowerState } from "./actions";
import type { Action, ActionResult } from "./actions";
import { resolveConfig } from "./config";
import type { GameConfig, GameMode } from "./config";
import { EventBus } from "./eventBus";
import { nextPhase } from "./phases";
import { createSeededRng } from "./rng";
import type { Rng } from "./rng";
import { cloneBoardState, createInitialState, opponentOf } from "./state";
import type { BoardState, Card, PlayerIndex } from "./state";

export interface MatchSetup {
  readonly decks: readonly [readonly Card[], readonly Card[]];
  readonly rng?: Rng;
  readonly seed?: number;
}

export class GameMatch {
  readonly events = new EventBus();

  private state: BoardState;

  private cardRules: boolean;

  constructor(
    mode: GameMode,
    playerIds: readonly [string, string],
    overrides?: Partial<Omit<GameConfig, "mode">>,
    setup?: MatchSetup,
  ) {
    const config = resolveConfig(mode, overrides);
    this.cardRules = setup !== undefined;
    this.state = createInitialState(config, playerIds, setup?.decks, rngFrom(setup));
    if (this.state.winner !== null) {
      this.events.emit("game:over", { winner: this.state.winner, reason: "deck_out" });
    }
  }

  static fromState(state: BoardState): GameMatch {
    const match = new GameMatch(state.config.mode, [
      state.players[0].id,
      state.players[1].id,
    ]);
    match.state = cloneBoardState(state);
    match.cardRules = true;
    return match;
  }

  getState(): BoardState {
    return this.state;
  }

  advancePhase(): BoardState {
    // Sem decks, a partida continua só no ciclo de fases já coberto pelos testes iniciais.
    if (!this.cardRules) {
      return this.advancePhaseLegacy();
    }
    const result = this.dispatch({ type: "advancePhase" });
    if (!result.ok) {
      return this.state;
    }
    return result.state;
  }

  dispatch(action: Action): ActionResult {
    const before = this.state;
    const result = applyAction(before, before.activePlayerIndex, action);
    if (!result.ok) {
      return result;
    }
    this.state = result.state;
    this.publish(before, result.state, action);
    return result;
  }

  destroyTower(playerIndex: PlayerIndex): ActionResult {
    const before = this.state;
    const result = destroyTowerState(before, playerIndex);
    if (!result.ok) {
      return result;
    }
    this.state = result.state;
    const tower = before.players[playerIndex].towerZone;
    if (tower !== null) {
      this.events.emit("tower:destroyed", {
        playerIndex,
        card: tower.card,
        hp: tower.hp,
        maxHp: tower.maxHp,
      });
    }
    return result;
  }

  private advancePhaseLegacy(): BoardState {
    const previous = this.state;
    const to = nextPhase(previous.phase);
    const turnAdvanced = previous.phase === "end";
    const turn = turnAdvanced ? previous.turn + 1 : previous.turn;
    const activePlayerIndex = turnAdvanced
      ? opponentOf(previous.activePlayerIndex)
      : previous.activePlayerIndex;

    const next: BoardState = Object.freeze({
      config: previous.config,
      players: previous.players,
      turn,
      activePlayerIndex,
      phase: to,
      winner: previous.winner,
    });
    this.state = next;

    this.events.emit("phase:changed", {
      from: previous.phase,
      to,
      turn,
      activePlayerIndex,
    });
    if (turnAdvanced) {
      this.events.emit("turn:started", {
        turn,
        activePlayerIndex,
      });
    }
    return next;
  }

  private publish(before: BoardState, after: BoardState, action: Action): void {
    switch (action.type) {
      case "advancePhase":
        this.publishPhase(before, after);
        return;
      case "summonMonster":
        this.publishMonster(before, action.handIndex, action.zoneIndex);
        return;
      case "setSpellTrap":
        return;
      case "summonTower":
        this.publishTowerSummon(after);
        return;
      case "playBiome":
        this.publishBiome(before, after);
        return;
      default: {
        const unexpected: never = action;
        throw new Error(`Ação inválida: ${String(unexpected)}.`);
      }
    }
  }

  private publishPhase(before: BoardState, after: BoardState): void {
    this.events.emit("phase:changed", {
      from: before.phase,
      to: after.phase,
      turn: after.turn,
      activePlayerIndex: after.activePlayerIndex,
    });
    if (after.turn !== before.turn) {
      this.events.emit("turn:started", {
        turn: after.turn,
        activePlayerIndex: after.activePlayerIndex,
      });
    }
    const drawn = cardDrawnBetween(before, after);
    if (drawn !== null) {
      this.events.emit("card:drawn", {
        playerIndex: after.activePlayerIndex,
        card: drawn,
        turn: after.turn,
      });
    }
    this.publishGameOver(before, after);
  }

  private publishMonster(before: BoardState, handIndex: number, zoneIndex: number): void {
    const playerIndex = before.activePlayerIndex;
    const card = before.players[playerIndex].hand[handIndex];
    if (card === undefined || card.kind !== "monster") {
      return;
    }
    this.events.emit("monster:summoned", { playerIndex, card, zoneIndex });
  }

  private publishTowerSummon(after: BoardState): void {
    const playerIndex = after.activePlayerIndex;
    const tower = after.players[playerIndex].towerZone;
    if (tower === null) {
      return;
    }
    this.events.emit("tower:summoned", {
      playerIndex,
      card: tower.card,
      hp: tower.hp,
      maxHp: tower.maxHp,
    });
  }

  private publishBiome(before: BoardState, after: BoardState): void {
    const playerIndex = before.activePlayerIndex;
    const card = after.players[playerIndex].biomeZone;
    if (card === null) {
      return;
    }
    this.events.emit("biome:played", {
      playerIndex,
      card,
      replaced: before.players[playerIndex].biomeZone,
    });
  }

  private publishGameOver(before: BoardState, after: BoardState): void {
    if (before.winner !== null || after.winner === null) {
      return;
    }
    this.events.emit("game:over", { winner: after.winner, reason: "deck_out" });
  }
}

function rngFrom(setup: MatchSetup | undefined): Rng | undefined {
  if (setup === undefined) {
    return undefined;
  }
  return setup.rng ?? createSeededRng(setup.seed ?? 1);
}

function cardDrawnBetween(before: BoardState, after: BoardState): Card | null {
  if (before.phase !== "end" || after.turn === before.turn) {
    return null;
  }
  const playerIndex = after.activePlayerIndex;
  const previousDeck = before.players[playerIndex].deck;
  const nextDeck = after.players[playerIndex].deck;
  if (nextDeck.length !== previousDeck.length - 1) {
    return null;
  }
  return previousDeck[previousDeck.length - 1] ?? null;
}
