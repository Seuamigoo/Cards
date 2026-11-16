export { MODE_CONFIGS, resolveConfig } from "./config";
export type { GameConfig, GameMode, WinCondition } from "./config";

export { cloneBoardState, copyCard, createInitialState, opponentOf } from "./state";
export type {
  BiomeCard,
  BoardState,
  Card,
  CardRarity,
  MonsterCard,
  Phase,
  PlayerIndex,
  PlayerState,
  SpellCard,
  SpellTrapCard,
  TowerCard,
  TowerInstance,
  TrapCard,
} from "./state";

export { nextPhase } from "./phases";

export { createSeededRng, shuffle } from "./rng";
export type { Rng } from "./rng";

export { applyAction, destroyTower, getLegalActions } from "./actions";
export type { Action, ActionResult } from "./actions";

export { EventBus } from "./eventBus";
export type {
  BiomePlayedEvent,
  CardDrawnEvent,
  GameEventMap,
  GameOverEvent,
  GameOverReason,
  MonsterSummonedEvent,
  PhaseChangedEvent,
  TowerDestroyedEvent,
  TowerSummonedEvent,
  TurnStartedEvent,
} from "./eventBus";

export { GameMatch } from "./gameMatch";
export type { MatchSetup } from "./gameMatch";
