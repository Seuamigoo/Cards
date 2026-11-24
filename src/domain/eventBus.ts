import type { AttackTarget } from "./combatRules";
import type { BattlePosition, Phase, PlayerIndex } from "./state";
import type { BiomeCard, Card, MonsterCard, SpellTrapCard, TowerCard } from "./state";

export type CardDestination = "limbo" | "graveyard";
export type CardOrigin = "monster" | "hand" | "tower" | "biome" | "spelltrap" | "material";
export type DamageTarget = "player" | "monster" | "tower";
export type EffectKind = "onSummon" | "activate" | "aura";

export interface PhaseChangedEvent {
  readonly from: Phase;
  readonly to: Phase;
  readonly turn: number;
  readonly activePlayerIndex: PlayerIndex;
}

export interface TurnStartedEvent {
  readonly turn: number;
  readonly activePlayerIndex: PlayerIndex;
}

export interface CardDrawnEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: Card;
  readonly turn: number;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface MonsterSummonedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: MonsterCard;
  readonly zoneIndex: number;
  readonly position: BattlePosition;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface MonsterPositionEvent {
  readonly playerIndex: PlayerIndex;
  readonly zoneIndex: number;
  readonly position: BattlePosition;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface SpellTrapSetEvent {
  readonly playerIndex: PlayerIndex;
  readonly zoneIndex: number;
  readonly card: SpellTrapCard;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface SpellTrapActivatedEvent {
  readonly playerIndex: PlayerIndex;
  readonly zoneIndex: number;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface EffectActivatedEvent {
  readonly playerIndex: PlayerIndex;
  readonly zoneIndex: number | null;
  readonly instanceId: string;
  readonly cardId: string;
  readonly kind: EffectKind;
}

export interface MonsterFusedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: MonsterCard;
  readonly zoneIndex: number;
  readonly position: BattlePosition;
  readonly instanceId: string;
  readonly cardId: string;
  readonly materials: readonly MonsterCard[];
  readonly materialInstanceIds: readonly string[];
}

export interface MaterialsReleasedEvent {
  readonly playerIndex: PlayerIndex;
  readonly zoneIndex: number;
  readonly instanceId: string;
  readonly cardId: string;
  readonly cards: readonly MonsterCard[];
  readonly materialInstanceIds: readonly string[];
}

export interface CardSentEvent {
  readonly playerIndex: PlayerIndex;
  readonly instanceId: string;
  readonly cardId: string;
  readonly destination: CardDestination;
  readonly from: CardOrigin;
  readonly zoneIndex: number | null;
}

export interface TowerSummonedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: TowerCard;
  readonly def: number;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface TowerDestroyedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: TowerCard;
  readonly def: number;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface BiomePlayedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: BiomeCard;
  readonly replaced: BiomeCard | null;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface BiomeLeftEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: BiomeCard;
  readonly instanceId: string;
  readonly cardId: string;
}

export type GameOverReason = "deck_out" | "player_hp";

export interface AttackDeclaredEvent {
  readonly playerIndex: PlayerIndex;
  readonly attackerZoneIndex: number;
  readonly target: AttackTarget;
  readonly instanceId: string;
  readonly cardId: string;
  readonly targetInstanceId: string | null;
  readonly targetCardId: string | null;
}

export interface MonsterDestroyedEvent {
  readonly playerIndex: PlayerIndex;
  readonly zoneIndex: number;
  readonly card: MonsterCard;
  readonly instanceId: string;
  readonly cardId: string;
}

export interface DamageDealtEvent {
  readonly playerIndex: PlayerIndex;
  readonly amount: number;
  readonly source: "battle" | "effect";
  readonly target: DamageTarget;
  readonly zoneIndex: number | null;
  readonly instanceId: string | null;
  readonly cardId: string | null;
}

export interface GameOverEvent {
  readonly winner: PlayerIndex;
  readonly reason: GameOverReason;
}

export interface GameEventMap {
  "phase:changed": PhaseChangedEvent;
  "turn:started": TurnStartedEvent;
  "card:drawn": CardDrawnEvent;
  "monster:summoned": MonsterSummonedEvent;
  "monster:position": MonsterPositionEvent;
  "spelltrap:set": SpellTrapSetEvent;
  "spelltrap:activated": SpellTrapActivatedEvent;
  "effect:activated": EffectActivatedEvent;
  "monster:fused": MonsterFusedEvent;
  "materials:released": MaterialsReleasedEvent;
  "card:sent": CardSentEvent;
  "tower:summoned": TowerSummonedEvent;
  "tower:destroyed": TowerDestroyedEvent;
  "biome:played": BiomePlayedEvent;
  "biome:left": BiomeLeftEvent;
  "game:over": GameOverEvent;
  "attack:declared": AttackDeclaredEvent;
  "monster:destroyed": MonsterDestroyedEvent;
  "damage:dealt": DamageDealtEvent;
}

type Handler<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

export class EventBus {
  private readonly handlers: {
    [K in keyof GameEventMap]: Set<Handler<K>>;
  } = {
    "phase:changed": new Set(),
    "turn:started": new Set(),
    "card:drawn": new Set(),
    "monster:summoned": new Set(),
    "monster:position": new Set(),
    "spelltrap:set": new Set(),
    "spelltrap:activated": new Set(),
    "effect:activated": new Set(),
    "monster:fused": new Set(),
    "materials:released": new Set(),
    "card:sent": new Set(),
    "tower:summoned": new Set(),
    "tower:destroyed": new Set(),
    "biome:played": new Set(),
    "biome:left": new Set(),
    "game:over": new Set(),
    "attack:declared": new Set(),
    "monster:destroyed": new Set(),
    "damage:dealt": new Set(),
  };

  on<K extends keyof GameEventMap>(event: K, handler: Handler<K>): () => void {
    const handlers = this.handlersFor(event);
    handlers.add(handler);
    return () => {
      handlers.delete(handler);
    };
  }

  emit<K extends keyof GameEventMap>(event: K, payload: GameEventMap[K]): void {
    const snapshot = [...this.handlersFor(event)];
    for (const handler of snapshot) {
      handler(payload);
    }
  }

  private handlersFor<K extends keyof GameEventMap>(event: K): Set<Handler<K>> {
    switch (event) {
      case "phase:changed":
        return this.handlers["phase:changed"] as Set<Handler<K>>;
      case "turn:started":
        return this.handlers["turn:started"] as Set<Handler<K>>;
      case "card:drawn":
        return this.handlers["card:drawn"] as Set<Handler<K>>;
      case "monster:summoned":
        return this.handlers["monster:summoned"] as Set<Handler<K>>;
      case "monster:position":
        return this.handlers["monster:position"] as Set<Handler<K>>;
      case "spelltrap:set":
        return this.handlers["spelltrap:set"] as Set<Handler<K>>;
      case "spelltrap:activated":
        return this.handlers["spelltrap:activated"] as Set<Handler<K>>;
      case "effect:activated":
        return this.handlers["effect:activated"] as Set<Handler<K>>;
      case "monster:fused":
        return this.handlers["monster:fused"] as Set<Handler<K>>;
      case "materials:released":
        return this.handlers["materials:released"] as Set<Handler<K>>;
      case "card:sent":
        return this.handlers["card:sent"] as Set<Handler<K>>;
      case "tower:summoned":
        return this.handlers["tower:summoned"] as Set<Handler<K>>;
      case "tower:destroyed":
        return this.handlers["tower:destroyed"] as Set<Handler<K>>;
      case "biome:played":
        return this.handlers["biome:played"] as Set<Handler<K>>;
      case "biome:left":
        return this.handlers["biome:left"] as Set<Handler<K>>;
      case "game:over":
        return this.handlers["game:over"] as Set<Handler<K>>;
      case "attack:declared":
        return this.handlers["attack:declared"] as Set<Handler<K>>;
      case "monster:destroyed":
        return this.handlers["monster:destroyed"] as Set<Handler<K>>;
      case "damage:dealt":
        return this.handlers["damage:dealt"] as Set<Handler<K>>;
      default: {
        const unexpected: never = event;
        throw new Error(`Evento desconhecido: ${String(unexpected)}.`);
      }
    }
  }
}
