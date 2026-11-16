import type { Phase, PlayerIndex } from "./state";

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

export interface GameEventMap {
  "phase:changed": PhaseChangedEvent;
  "turn:started": TurnStartedEvent;
}

type Handler<K extends keyof GameEventMap> = (payload: GameEventMap[K]) => void;

export class EventBus {
  private readonly handlers: {
    [K in keyof GameEventMap]: Set<Handler<K>>;
  } = {
    "phase:changed": new Set(),
    "turn:started": new Set(),
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
      default: {
        const unexpected: never = event;
        throw new Error(`Evento desconhecido: ${String(unexpected)}.`);
      }
    }
  }
}
