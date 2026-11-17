import { randomInt } from "node:crypto";
import { buildDeck, CardRegistry } from "../../src/catalog/index";
import { MODE_CONFIGS } from "../../src/domain/config";
import type { GameMode } from "../../src/domain/config";
import { GameMatch } from "../../src/domain/gameMatch";
import type { Action, BoardState, Card, PlayerIndex } from "../../src/domain/index";

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

export interface Seat {
  userId: string;
  username: string;
  mode: GameMode | null;
  deck: readonly Card[] | null;
}

export interface Room {
  code: string;
  status: "lobby" | "playing" | "finished";
  seats: [Seat | null, Seat | null];
  match: GameMatch | null;
  resultRecorded: boolean;
}

export type ClientMessage =
  | { readonly type: "create" }
  | { readonly type: "join"; readonly code: string }
  | { readonly type: "rejoin"; readonly code: string }
  | { readonly type: "chooseDeck"; readonly mode: GameMode; readonly cardIds: readonly string[] }
  | { readonly type: "start" }
  | { readonly type: "action"; readonly action: Action };

export class MemoryRoomStore {
  private readonly rooms = new Map<string, Room>();

  create(userId: string, username: string): Room {
    const room: Room = {
      code: this.freshCode(),
      status: "lobby",
      seats: [{ userId, username, mode: null, deck: null }, null],
      match: null,
      resultRecorded: false,
    };
    this.rooms.set(room.code, room);
    return room;
  }

  findByUser(userId: string): Room | null {
    for (const room of this.rooms.values()) {
      if (room.seats.some((seat) => seat?.userId === userId) && room.status !== "finished") {
        return room;
      }
    }
    return null;
  }

  get(code: string): Room | null {
    return this.rooms.get(code.toUpperCase()) ?? null;
  }

  private freshCode(): string {
    let code = "";
    do {
      code = Array.from({ length: 6 }, () => ALPHABET[randomInt(ALPHABET.length)] ?? "A").join("");
    } while (this.rooms.has(code));
    return code;
  }
}

export function seatIndex(room: Room, userId: string): PlayerIndex | null {
  if (room.seats[0]?.userId === userId) {
    return 0;
  }
  if (room.seats[1]?.userId === userId) {
    return 1;
  }
  return null;
}

export function joinRoom(room: Room, userId: string, username: string): string | null {
  if (seatIndex(room, userId) !== null) {
    return null;
  }
  if (room.seats[1] !== null) {
    return "Sala cheia.";
  }
  if (room.status !== "lobby") {
    return "A sala já começou.";
  }
  room.seats[1] = { userId, username, mode: null, deck: null };
  return null;
}

export function chooseDeck(room: Room, userId: string, mode: GameMode, cardIds: readonly string[], catalogJson: string): string | null {
  const seat = seatIndex(room, userId);
  if (seat === null || room.seats[seat] === null) {
    return "Você não está nesta sala.";
  }
  const limits = MODE_CONFIGS[mode];
  if (cardIds.length < limits.mainDeckMin || cardIds.length > limits.mainDeckMax) {
    return `O modo ${mode} exige entre ${limits.mainDeckMin} e ${limits.mainDeckMax} cartas.`;
  }
  const parsed = CardRegistry.fromJSON(catalogJson);
  if (!parsed.ok) {
    return "Catálogo publicado inválido.";
  }
  const built = buildDeck(parsed.registry, cardIds);
  if (!built.ok) {
    return `Carta desconhecida: ${built.errors[0]?.cardId ?? ""}.`;
  }
  const current = room.seats[seat];
  room.seats[seat] = { ...current, mode, deck: built.cards };
  return null;
}

export function startRoom(room: Room, userId: string): string | null {
  if (room.seats[0]?.userId !== userId) {
    return "Só quem criou a sala pode começar.";
  }
  const first = room.seats[0];
  const second = room.seats[1];
  if (first?.deck === null || first?.deck === undefined || second?.deck === null || second?.deck === undefined) {
    return "Os dois jogadores precisam escolher um deck.";
  }
  if (first.mode === null || second.mode === null || first.mode !== second.mode) {
    return "Os decks precisam usar o mesmo modo.";
  }
  room.match = new GameMatch(first.mode, [first.userId, second.userId], undefined, {
    decks: [first.deck, second.deck],
    seed: randomInt(1, 1_000_000_000),
  });
  room.status = "playing";
  return null;
}

export function playAction(room: Room, userId: string, action: Action): string | null {
  if (room.match === null || room.status !== "playing") {
    return "A partida não está em andamento.";
  }
  const seat = seatIndex(room, userId);
  if (seat === null) {
    return "Você não está nesta sala.";
  }
  if (seat !== room.match.getState().activePlayerIndex) {
    return "Não é a sua vez.";
  }
  const result = room.match.dispatch(action);
  if (!result.ok) {
    return result.error;
  }
  if (room.match.getState().winner !== null) {
    room.status = "finished";
  }
  return null;
}

export function publicState(state: BoardState, you: PlayerIndex) {
  return {
    you,
    turn: state.turn,
    phase: state.phase,
    winner: state.winner,
    activePlayerIndex: state.activePlayerIndex,
    players: state.players.map((player, index) => ({
      id: player.id,
      hp: player.hp,
      hand: index === you ? player.hand : [],
      deck: index === you ? player.deck : [],
      deckCount: player.deck.length,
      monsterZone: player.monsterZone,
      spellTrapZone: player.spellTrapZone,
      towerZone: player.towerZone,
      biomeZone: player.biomeZone,
      graveyard: player.graveyard,
      limbo: player.limbo,
    })),
  };
}
