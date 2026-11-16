export {
  MODE_CONFIGS,
  resolveConfig,
} from "./config";
export type { GameConfig, GameMode, WinCondition } from "./config";

export { createInitialState } from "./state";
export type {
  BoardState,
  Card,
  Phase,
  PlayerIndex,
  PlayerState,
  TowerInstance,
} from "./state";

export { nextPhase } from "./phases";

export { EventBus } from "./eventBus";
export type {
  GameEventMap,
  PhaseChangedEvent,
  TurnStartedEvent,
} from "./eventBus";

export { GameMatch } from "./gameMatch";
