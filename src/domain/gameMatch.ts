import { resolveConfig } from "./config";
import type { GameConfig, GameMode } from "./config";
import { EventBus } from "./eventBus";
import { nextPhase } from "./phases";
import { createInitialState } from "./state";
import type { BoardState, PlayerIndex } from "./state";

export class GameMatch {
  readonly events = new EventBus();

  private state: BoardState;

  constructor(
    mode: GameMode,
    playerIds: readonly [string, string],
    overrides?: Partial<Omit<GameConfig, "mode">>,
  ) {
    const config = resolveConfig(mode, overrides);
    this.state = createInitialState(config, playerIds);
  }

  getState(): BoardState {
    return this.state;
  }

  advancePhase(): BoardState {
    const previous = this.state;
    const to = nextPhase(previous.phase);
    const turnAdvanced = previous.phase === "end";
    const turn = turnAdvanced ? previous.turn + 1 : previous.turn;
    const activePlayerIndex = turnAdvanced
      ? otherPlayer(previous.activePlayerIndex)
      : previous.activePlayerIndex;

    const next: BoardState = Object.freeze({
      config: previous.config,
      players: previous.players,
      turn,
      activePlayerIndex,
      phase: to,
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
}

function otherPlayer(index: PlayerIndex): PlayerIndex {
  switch (index) {
    case 0:
      return 1;
    case 1:
      return 0;
    default: {
      const unexpected: never = index;
      throw new Error(`Índice de jogador inválido: ${String(unexpected)}.`);
    }
  }
}
