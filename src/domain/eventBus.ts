import type { AttackTarget } from "./combatRules";
import type { Phase, PlayerIndex } from "./state";
import type { BiomeCard, Card, MonsterCard, TowerCard } from "./state";

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
}

export interface MonsterSummonedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: MonsterCard;
  readonly zoneIndex: number;
}

export interface TowerSummonedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: TowerCard;
  readonly def: number;
}

export interface TowerDestroyedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: TowerCard;
  readonly def: number;
}

export interface BiomePlayedEvent {
  readonly playerIndex: PlayerIndex;
  readonly card: BiomeCard;
  readonly replaced: BiomeCard | null;
}

export type GameOverReason = "deck_out" | "player_hp";

export interface AttackDeclaredEvent {
  readonly playerIndex: PlayerIndex;
  readonly attackerZoneIndex: number;
  readonly target: AttackTarget;
}

export interface MonsterDestroyedEvent {
  readonly playerIndex: PlayerIndex;
  readonly zoneIndex: number;
  readonly card: MonsterCard;
}

export interface DamageDealtEvent {
  readonly playerIndex: PlayerIndex;
  readonly amount: number;
  readonly source: "battle";
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
  "tower:summoned": TowerSummonedEvent;
  "tower:destroyed": TowerDestroyedEvent;
  "biome:played": BiomePlayedEvent;
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
    "tower:summoned": new Set(),
    "tower:destroyed": new Set(),
    "biome:played": new Set(),
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
      case "tower:summoned":
        return this.handlers["tower:summoned"] as Set<Handler<K>>;
      case "tower:destroyed":
        return this.handlers["tower:destroyed"] as Set<Handler<K>>;
      case "biome:played":
        return this.handlers["biome:played"] as Set<Handler<K>>;
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
