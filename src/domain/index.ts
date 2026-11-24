export { MODE_CONFIGS, resolveConfig } from "./config";
export type { GameConfig, GameMode, WinCondition } from "./config";

export { cloneBoardState, copyCard, createInitialState, opponentOf } from "./state";
export type {
  BiomeCard,
  BoardState,
  Card,
  CardImage,
  CardRarity,
  BattlePosition,
  Keyword,
  MonsterCard,
  MonsterInstance,
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

export { tributesRequired, towerDefense } from "./rules";
export { effectiveAttack, effectiveTowerDefense } from "./effects";
export { getLegalTargets } from "./combatRules";
export type { AttackTarget } from "./combatRules";
export { applyAction, destroyTower, getLegalActions } from "./actions";
export type { Action, ActionResult } from "./actions";

export { EventBus } from "./eventBus";
export type {
  BiomePlayedEvent,
  CardDrawnEvent,
  GameEventMap,
  AttackDeclaredEvent,
  DamageDealtEvent,
  GameOverEvent,
  GameOverReason,
  MonsterDestroyedEvent,
  MaterialsReleasedEvent,
  MonsterFusedEvent,
  MonsterSummonedEvent,
  PhaseChangedEvent,
  TowerDestroyedEvent,
  TowerSummonedEvent,
  TurnStartedEvent,
} from "./eventBus";

export { GameMatch } from "./gameMatch";
export type { MatchSetup } from "./gameMatch";
