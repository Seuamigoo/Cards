import type { GameConfig } from "./config";
import { createSeededRng, shuffle } from "./rng";
import type { Rng } from "./rng";

export type CardRarity = "comum" | "incomum" | "rara" | "epica" | "lendaria" | "mitica";

export interface CardImage {
  readonly src: string;
  readonly alt?: string;
}

interface CardBase {
  readonly id: string;
  readonly name: string;
  readonly rarity: CardRarity;
  readonly image?: CardImage;
}

export interface MonsterCard extends CardBase {
  readonly kind: "monster";
  readonly atk: number;
  readonly def: number;
  /** PROVISÓRIO (até GDD v0.2): tags de raça ainda não afetam regras. */
  readonly race?: string;
  /** PROVISÓRIO (até GDD v0.2): tags de classe ainda não afetam regras. */
  readonly class?: string;
}

export interface SpellCard extends CardBase {
  readonly kind: "spell";
}

export interface TrapCard extends CardBase {
  readonly kind: "trap";
}

export interface TowerCard extends CardBase {
  readonly kind: "tower";
  /** PROVISÓRIO (até GDD v0.2): sem hp, a Torre usa config.defaultTowerHp. */
  readonly hp?: number;
}

export interface BiomeCard extends CardBase {
  readonly kind: "biome";
}

export type Card = MonsterCard | SpellCard | TrapCard | TowerCard | BiomeCard;

export type SpellTrapCard = SpellCard | TrapCard;

export interface TowerInstance {
  readonly card: TowerCard;
  readonly hp: number;
  readonly maxHp: number;
}

export interface PlayerState {
  readonly id: string;
  readonly hp: number;
  readonly hand: readonly Card[];
  readonly deck: readonly Card[];
  readonly monsterZone: readonly (MonsterCard | null)[];
  readonly spellTrapZone: readonly (SpellTrapCard | null)[];
  readonly towerZone: TowerInstance | null;
  readonly biomeZone: BiomeCard | null;
  readonly graveyard: readonly Card[];
  readonly limbo: readonly TowerCard[];
  readonly towerSummonedThisTurn: boolean;
  readonly normalSummonedThisTurn: boolean;
  /** PROVISÓRIO: um booleano por slot; todo monstro entra em posição de ataque. */
  readonly attackedThisTurn: readonly boolean[];
}

export type Phase = "draw" | "main1" | "battle" | "main2" | "end";

export type PlayerIndex = 0 | 1;

export interface BoardState {
  readonly config: GameConfig;
  readonly players: readonly [PlayerState, PlayerState];
  readonly turn: number;
  readonly activePlayerIndex: PlayerIndex;
  readonly phase: Phase;
  readonly winner: PlayerIndex | null;
}

export function opponentOf(index: PlayerIndex): PlayerIndex {
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

export function copyCard<T extends Card>(card: T): T {
  const image = imagePart(card);
  switch (card.kind) {
    case "monster":
      return {
        id: card.id,
        name: card.name,
        rarity: card.rarity,
        ...image,
        kind: "monster",
        atk: card.atk,
        def: card.def,
        ...(card.race !== undefined ? { race: card.race } : {}),
        ...(card.class !== undefined ? { class: card.class } : {}),
      } as T;
    case "spell":
      return { id: card.id, name: card.name, rarity: card.rarity, ...image, kind: "spell" } as T;
    case "trap":
      return { id: card.id, name: card.name, rarity: card.rarity, ...image, kind: "trap" } as T;
    case "tower":
      return {
        id: card.id,
        name: card.name,
        rarity: card.rarity,
        ...image,
        kind: "tower",
        ...(card.hp !== undefined ? { hp: card.hp } : {}),
      } as T;
    case "biome":
      return { id: card.id, name: card.name, rarity: card.rarity, ...image, kind: "biome" } as T;
    default: {
      const unexpected: never = card;
      throw new Error(`Carta inválida: ${String(unexpected)}.`);
    }
  }
}

function imagePart(card: Card): { image: CardImage } | Record<string, never> {
  if (card.image === undefined) {
    return {};
  }
  return {
    image: {
      src: card.image.src,
      ...(card.image.alt !== undefined ? { alt: card.image.alt } : {}),
    },
  };
}

export function createInitialState(
  config: GameConfig,
  playerIds: readonly [string, string],
  decks?: readonly [readonly Card[], readonly Card[]],
  rng?: Rng,
): BoardState {
  const random = rng ?? createSeededRng(1);
  const first = createPlayer(playerIds[0], config, decks?.[0], random);
  const second = createPlayer(playerIds[1], config, decks?.[1], random);
  let winner: PlayerIndex | null = null;
  if (decks !== undefined && first.lost) {
    winner = 1;
  } else if (decks !== undefined && second.lost) {
    winner = 0;
  }

  return sealBoard({
    config: { ...config },
    players: [first.player, second.player],
    turn: 1,
    activePlayerIndex: 0,
    phase: "draw",
    winner,
  });
}

export function cloneBoardState(state: BoardState): BoardState {
  return sealBoard({
    config: { ...state.config },
    players: [clonePlayer(state.players[0]), clonePlayer(state.players[1])],
    turn: state.turn,
    activePlayerIndex: state.activePlayerIndex,
    phase: state.phase,
    winner: state.winner,
  });
}

function createPlayer(
  id: string,
  config: GameConfig,
  deck: readonly Card[] | undefined,
  rng: Rng,
): { readonly player: PlayerState; readonly lost: boolean } {
  if (deck === undefined) {
    return { player: emptyPlayer(id, config, [], []), lost: false };
  }

  const shuffled = shuffle(deck.map((card) => copyCard(card)), rng);
  const hand: Card[] = [];
  let lost = false;
  for (let drawn = 0; drawn < config.openingHandSize; drawn += 1) {
    const card = shuffled.pop();
    if (card === undefined) {
      lost = true;
      break;
    }
    hand.push(card);
  }
  return { player: emptyPlayer(id, config, hand, shuffled), lost };
}

function emptyPlayer(
  id: string,
  config: GameConfig,
  hand: readonly Card[],
  deck: readonly Card[],
): PlayerState {
  return {
    id,
    hp: config.playerHp,
    hand,
    deck,
    monsterZone: emptySlots<MonsterCard>(config.monsterSlots),
    spellTrapZone: emptySlots<SpellTrapCard>(config.spellTrapSlots),
    towerZone: null,
    biomeZone: null,
    graveyard: [],
    limbo: [],
    towerSummonedThisTurn: false,
    normalSummonedThisTurn: false,
    attackedThisTurn: emptySlots<boolean>(config.monsterSlots).map(() => false),
  };
}

function clonePlayer(player: PlayerState): PlayerState {
  return {
    ...player,
    hand: player.hand.map((card) => copyCard(card)),
    deck: player.deck.map((card) => copyCard(card)),
    monsterZone: player.monsterZone.map((slot) => (slot === null ? null : copyCard(slot))),
    spellTrapZone: player.spellTrapZone.map((slot) => (slot === null ? null : copyCard(slot))),
    towerZone:
      player.towerZone === null
        ? null
        : {
            card: copyCard(player.towerZone.card),
            hp: player.towerZone.hp,
            maxHp: player.towerZone.maxHp,
          },
    biomeZone: player.biomeZone === null ? null : copyCard(player.biomeZone),
    graveyard: player.graveyard.map((card) => copyCard(card)),
    limbo: player.limbo.map((card) => copyCard(card)),
  };
}

function emptySlots<T>(size: number): readonly (T | null)[] {
  return Array.from({ length: size }, () => null);
}

function sealBoard(state: BoardState): BoardState {
  const players = Object.freeze([
    sealPlayer(state.players[0]),
    sealPlayer(state.players[1]),
  ]) as readonly [PlayerState, PlayerState];
  return Object.freeze({
    ...state,
    config: Object.freeze({ ...state.config }),
    players,
  });
}

function sealPlayer(player: PlayerState): PlayerState {
  return Object.freeze({
    ...player,
    hand: Object.freeze([...player.hand]),
    deck: Object.freeze([...player.deck]),
    monsterZone: Object.freeze([...player.monsterZone]),
    spellTrapZone: Object.freeze([...player.spellTrapZone]),
    towerZone: player.towerZone === null ? null : Object.freeze({ ...player.towerZone }),
    graveyard: Object.freeze([...player.graveyard]),
    limbo: Object.freeze([...player.limbo]),
    attackedThisTurn: Object.freeze([...player.attackedThisTurn]),
  });
}
