import type { GameConfig } from "./config";

/** Placeholder de carta até o modelo completo existir. */
export interface Card {
  readonly id: string;
  readonly name: string;
}

export interface TowerInstance {
  readonly card: Card;
  readonly hp: number;
  readonly maxHp: number;
}

export interface PlayerState {
  readonly id: string;
  readonly hp: number;
  readonly hand: readonly Card[];
  readonly deck: readonly Card[];
  readonly monsterZone: readonly (Card | null)[];
  readonly spellTrapZone: readonly (Card | null)[];
  readonly towerZone: TowerInstance | null;
  readonly biomeZone: Card | null;
  readonly graveyard: readonly Card[];
}

export type Phase = "draw" | "main1" | "battle" | "main2" | "end";

export type PlayerIndex = 0 | 1;

export interface BoardState {
  readonly config: GameConfig;
  readonly players: readonly [PlayerState, PlayerState];
  readonly turn: number;
  readonly activePlayerIndex: PlayerIndex;
  readonly phase: Phase;
}

export function createInitialState(
  config: GameConfig,
  playerIds: readonly [string, string],
): BoardState {
  const state: BoardState = {
    config: Object.freeze({ ...config }),
    players: Object.freeze([
      createPlayer(playerIds[0], config),
      createPlayer(playerIds[1], config),
    ]),
    turn: 1,
    activePlayerIndex: 0,
    phase: "draw",
  };
  return Object.freeze(state);
}

function createPlayer(id: string, config: GameConfig): PlayerState {
  return Object.freeze({
    id,
    hp: config.playerHp,
    hand: Object.freeze<Card[]>([]),
    deck: Object.freeze<Card[]>([]),
    monsterZone: emptyZone(config.monsterSlots),
    spellTrapZone: emptyZone(config.spellTrapSlots),
    towerZone: null,
    biomeZone: null,
    graveyard: Object.freeze<Card[]>([]),
  });
}

function emptyZone(size: number): readonly (Card | null)[] {
  return Object.freeze(Array.from({ length: size }, () => null));
}
