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
export type { Action, ActionResult, SpellTrapTarget } from "./actions";
export { getPlayerView, redactEventFor } from "./playerView";
export type { GameEvent, HiddenMonster, HiddenSlot, PlayerView, RedactedGameEvent, VisiblePlayer } from "./playerView";

export { EventBus } from "./eventBus";
export type {
  BiomeLeftEvent,
  BiomePlayedEvent,
  CardDestination,
  CardDrawnEvent,
  CardOrigin,
  CardSentEvent,
  DamageTarget,
  EffectActivatedEvent,
  EffectKind,
  GameEventMap,
  AttackDeclaredEvent,
  DamageDealtEvent,
  GameOverEvent,
  GameOverReason,
  MaterialsReleasedEvent,
  MonsterDestroyedEvent,
  MonsterFusedEvent,
  MonsterPositionEvent,
  MonsterSummonedEvent,
  PhaseChangedEvent,
  SpellTrapActivatedEvent,
  SpellTrapActivatedTarget,
  SpellTrapSetEvent,
  TowerDestroyedEvent,
  TowerSummonedEvent,
  TurnStartedEvent,
} from "./eventBus";

export { GameMatch } from "./gameMatch";
export type { MatchSetup } from "./gameMatch";
