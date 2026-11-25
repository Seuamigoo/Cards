import type { GameEventMap } from "./eventBus";
import type {
  BiomeCard,
  BoardState,
  Card,
  MonsterInstance,
  Phase,
  PlayerIndex,
  SpellTrapCard,
  TowerInstance,
} from "./state";

export interface HiddenSlot {
  readonly hidden: true;
}

export interface HiddenMonster {
  readonly hidden: true;
  readonly position: MonsterInstance["position"];
}

export interface VisiblePlayer {
  readonly id: string;
  readonly hp: number;
  readonly handCount: number;
  readonly hand: readonly (Card | HiddenSlot)[];
  readonly deckCount: number;
  readonly monsterZone: readonly (MonsterInstance | HiddenMonster | null)[];
  readonly spellTrapZone: readonly (SpellTrapCard | HiddenSlot | null)[];
  readonly towerZone: TowerInstance | null;
  readonly biomeZone: BiomeCard | null;
  readonly limbo: readonly Card[];
}

export interface PlayerView {
  readonly viewerId: string;
  readonly viewerIndex: PlayerIndex;
  readonly turn: number;
  readonly phase: Phase;
  readonly activePlayerIndex: PlayerIndex;
  readonly winner: PlayerIndex | null;
  readonly players: readonly [VisiblePlayer, VisiblePlayer];
}

export type GameEvent = {
  [K in keyof GameEventMap]: { readonly type: K; readonly payload: GameEventMap[K] };
}[keyof GameEventMap];

export type RedactedGameEvent =
  | GameEvent
  | {
      readonly type: "card:drawn";
      readonly payload: { readonly playerIndex: PlayerIndex; readonly turn: number; readonly hidden: true };
    }
  | {
      readonly type: "spelltrap:set";
      readonly payload: {
        readonly playerIndex: PlayerIndex;
        readonly zoneIndex: number;
        readonly instanceId: string;
        readonly hidden: true;
      };
    };

export function getPlayerView(state: BoardState, playerId: string): PlayerView {
  const viewerIndex = indexOf(state, playerId);
  return {
    viewerId: playerId,
    viewerIndex,
    turn: state.turn,
    phase: state.phase,
    activePlayerIndex: state.activePlayerIndex,
    winner: state.winner,
    players: [visiblePlayer(state, 0, viewerIndex), visiblePlayer(state, 1, viewerIndex)],
  };
}

export function redactEventFor(event: GameEvent, playerId: string, state: BoardState): RedactedGameEvent {
  const viewer = indexOf(state, playerId);
  switch (event.type) {
    case "card:drawn":
      if (event.payload.playerIndex === viewer) {
        return event;
      }
      return {
        type: "card:drawn",
        payload: { playerIndex: event.payload.playerIndex, turn: event.payload.turn, hidden: true },
      };
    case "spelltrap:set":
      if (event.payload.playerIndex === viewer) {
        return event;
      }
      return {
        type: "spelltrap:set",
        payload: {
          playerIndex: event.payload.playerIndex,
          zoneIndex: event.payload.zoneIndex,
          instanceId: event.payload.instanceId,
          hidden: true,
        },
      };
    default:
      return event;
  }
}

function visiblePlayer(state: BoardState, index: PlayerIndex, viewer: PlayerIndex): VisiblePlayer {
  const player = state.players[index];
  const own = index === viewer;
  return {
    id: player.id,
    hp: player.hp,
    handCount: player.hand.length,
    hand: own ? player.hand : player.hand.map(() => ({ hidden: true })),
    deckCount: player.deck.length,
    monsterZone: player.monsterZone.map((slot) => {
      if (slot === null) {
        return null;
      }
      if (!own && slot.faceDown === true) {
        return { hidden: true, position: slot.position };
      }
      return slot;
    }),
    spellTrapZone: player.spellTrapZone.map((slot) => {
      if (slot === null) {
        return null;
      }
      if (!own) {
        return { hidden: true };
      }
      return slot;
    }),
    towerZone: player.towerZone,
    biomeZone: player.biomeZone,
    limbo: player.limbo,
  };
}

function indexOf(state: BoardState, playerId: string): PlayerIndex {
  if (state.players[0].id === playerId) {
    return 0;
  }
  if (state.players[1].id === playerId) {
    return 1;
  }
  throw new Error(`Jogador desconhecido: ${playerId}.`);
}
