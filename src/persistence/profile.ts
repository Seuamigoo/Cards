import { MODE_CONFIGS } from "../domain/config";
import type { GameMode } from "../domain/config";
import { isRecord, migrate } from "./migrate";
import { SAVE_VERSION, persistFail, persistOk } from "./types";
import type { PersistResult, StorageAdapter } from "./types";

export interface CollectionEntry {
  readonly cardId: string;
  readonly quantity: number;
}

export interface DeckList {
  readonly id: string;
  readonly name: string;
  readonly mode: GameMode;
  readonly cardIds: readonly string[];
}

export interface PlayerStats {
  readonly wins: number;
  readonly losses: number;
  readonly matchesPlayed: number;
}

export interface PlayerProfile {
  readonly version: number;
  readonly playerId: string;
  readonly name: string;
  readonly collection: readonly CollectionEntry[];
  readonly decks: readonly DeckList[];
  readonly stats: PlayerStats;
  readonly updatedAt: string;
}

export type MatchResult = "win" | "loss";

export class ProfileRepository {
  constructor(
    private readonly adapter: StorageAdapter,
    private readonly clock: () => string = () => new Date().toISOString(),
  ) {}

  async load(playerId: string): Promise<PersistResult<PlayerProfile>> {
    if (playerId.length === 0) {
      return persistFail("invalid", "playerId vazio.");
    }
    const key = profileKey(playerId);
    const json = await this.adapter.get(key);
    if (json === null) {
      const created = this.defaultProfile(playerId);
      await this.adapter.set(key, JSON.stringify(created));
      return persistOk(created);
    }
    const parsed = parseStoredProfile(json, playerId);
    if (!parsed.ok) {
      return parsed;
    }
    if (json !== JSON.stringify(parsed.value)) {
      await this.adapter.set(key, JSON.stringify(parsed.value));
    }
    return parsed;
  }

  async save(profile: PlayerProfile): Promise<PersistResult<PlayerProfile>> {
    const stored = this.touch(profile);
    const parsed = parseProfile(stored, stored.playerId);
    if (!parsed.ok) {
      return parsed;
    }
    await this.adapter.set(profileKey(parsed.value.playerId), JSON.stringify(parsed.value));
    return parsed;
  }

  async recordMatchResult(
    playerId: string,
    result: MatchResult,
  ): Promise<PersistResult<PlayerProfile>> {
    const loaded = await this.load(playerId);
    if (!loaded.ok) {
      return loaded;
    }
    const stats = nextStats(loaded.value.stats, result);
    return this.save({ ...loaded.value, stats });
  }

  async addCards(
    playerId: string,
    cards: readonly CollectionEntry[],
  ): Promise<PersistResult<PlayerProfile>> {
    const loaded = await this.load(playerId);
    if (!loaded.ok) {
      return loaded;
    }
    const collection = mergeCollection(loaded.value.collection, cards);
    if (collection === null) {
      return persistFail("invalid", "Entrada de coleção inválida.");
    }
    return this.save({ ...loaded.value, collection });
  }

  async saveDeck(playerId: string, deck: DeckList): Promise<PersistResult<PlayerProfile>> {
    const sizeError = deckSizeError(deck);
    if (sizeError !== null) {
      return persistFail("invalid", sizeError);
    }
    if (deck.id.length === 0 || deck.name.trim().length === 0) {
      return persistFail("invalid", "Deck sem id ou nome.");
    }
    if (deck.cardIds.some((cardId) => cardId.length === 0)) {
      return persistFail("invalid", "Deck com cardId vazio.");
    }
    const loaded = await this.load(playerId);
    if (!loaded.ok) {
      return loaded;
    }
    const next = loaded.value.decks.filter((entry) => entry.id !== deck.id);
    next.push({
      id: deck.id,
      name: deck.name.trim(),
      mode: deck.mode,
      cardIds: [...deck.cardIds],
    });
    return this.save({ ...loaded.value, decks: next });
  }

  async deleteDeck(playerId: string, deckId: string): Promise<PersistResult<PlayerProfile>> {
    const loaded = await this.load(playerId);
    if (!loaded.ok) {
      return loaded;
    }
    if (!loaded.value.decks.some((deck) => deck.id === deckId)) {
      return persistFail("not_found", `Deck "${deckId}" não encontrado.`);
    }
    return this.save({
      ...loaded.value,
      decks: loaded.value.decks.filter((deck) => deck.id !== deckId),
    });
  }

  private defaultProfile(playerId: string): PlayerProfile {
    return {
      version: SAVE_VERSION,
      playerId,
      name: playerId,
      collection: [],
      decks: [],
      stats: { wins: 0, losses: 0, matchesPlayed: 0 },
      updatedAt: this.clock(),
    };
  }

  private touch(profile: PlayerProfile): PlayerProfile {
    return { ...profile, version: SAVE_VERSION, updatedAt: this.clock() };
  }
}

function profileKey(playerId: string): string {
  return `profile:${playerId}`;
}

function parseStoredProfile(json: string, playerId: string): PersistResult<PlayerProfile> {
  let raw: unknown;
  try {
    raw = JSON.parse(json) as unknown;
  } catch {
    return persistFail("corrupt", "JSON de perfil corrompido.");
  }
  const migrated = migrate(raw);
  if (!migrated.ok) {
    return migrated;
  }
  return parseProfile(migrated.value, playerId);
}

function parseProfile(value: unknown, expectedPlayerId: string): PersistResult<PlayerProfile> {
  if (!isRecord(value) || value.version !== SAVE_VERSION) {
    return persistFail("invalid", "Perfil inválido.");
  }
  if (value.playerId !== expectedPlayerId || typeof value.name !== "string" || value.name.length === 0) {
    return persistFail("invalid", "Identidade do perfil inválida.");
  }
  if (typeof value.updatedAt !== "string" || value.updatedAt.length === 0) {
    return persistFail("invalid", "updatedAt inválido.");
  }
  const collection = parseCollection(value.collection);
  const decks = parseDecks(value.decks);
  const stats = parseStats(value.stats);
  if (collection === null || decks === null || stats === null) {
    return persistFail("invalid", "Conteúdo do perfil inválido.");
  }
  return persistOk({
    version: SAVE_VERSION,
    playerId: expectedPlayerId,
    name: value.name,
    collection,
    decks,
    stats,
    updatedAt: value.updatedAt,
  });
}

function parseCollection(value: unknown): readonly CollectionEntry[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const entries: CollectionEntry[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.cardId !== "string" || entry.cardId.length === 0) {
      return null;
    }
    if (typeof entry.quantity !== "number" || !Number.isInteger(entry.quantity) || entry.quantity <= 0) {
      return null;
    }
    if (seen.has(entry.cardId)) {
      return null;
    }
    seen.add(entry.cardId);
    entries.push({ cardId: entry.cardId, quantity: entry.quantity });
  }
  return entries;
}

function parseDecks(value: unknown): readonly DeckList[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const seen = new Set<string>();
  const decks: DeckList[] = [];
  for (const entry of value) {
    if (!isRecord(entry) || typeof entry.id !== "string" || entry.id.length === 0) {
      return null;
    }
    if (typeof entry.name !== "string" || entry.name.length === 0) {
      return null;
    }
    if (!isGameMode(entry.mode) || !Array.isArray(entry.cardIds)) {
      return null;
    }
    if (seen.has(entry.id)) {
      return null;
    }
    const cardIds: string[] = [];
    for (const cardId of entry.cardIds) {
      if (typeof cardId !== "string" || cardId.length === 0) {
        return null;
      }
      cardIds.push(cardId);
    }
    seen.add(entry.id);
    decks.push({ id: entry.id, name: entry.name, mode: entry.mode, cardIds });
  }
  return decks;
}

function parseStats(value: unknown): PlayerStats | null {
  if (!isRecord(value)) {
    return null;
  }
  if (
    !isCount(value.wins) ||
    !isCount(value.losses) ||
    !isCount(value.matchesPlayed)
  ) {
    return null;
  }
  return { wins: value.wins, losses: value.losses, matchesPlayed: value.matchesPlayed };
}

function isCount(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isGameMode(value: unknown): value is GameMode {
  switch (value) {
    case "classic":
    case "blitz":
      return true;
    default:
      return false;
  }
}

function nextStats(stats: PlayerStats, result: MatchResult): PlayerStats {
  switch (result) {
    case "win":
      return { wins: stats.wins + 1, losses: stats.losses, matchesPlayed: stats.matchesPlayed + 1 };
    case "loss":
      return { wins: stats.wins, losses: stats.losses + 1, matchesPlayed: stats.matchesPlayed + 1 };
    default: {
      const unexpected: never = result;
      throw new Error(`Resultado inválido: ${String(unexpected)}.`);
    }
  }
}

function mergeCollection(
  current: readonly CollectionEntry[],
  added: readonly CollectionEntry[],
): readonly CollectionEntry[] | null {
  const quantities = new Map<string, number>();
  for (const entry of current) {
    quantities.set(entry.cardId, entry.quantity);
  }
  for (const entry of added) {
    if (entry.cardId.length === 0 || !Number.isInteger(entry.quantity) || entry.quantity <= 0) {
      return null;
    }
    quantities.set(entry.cardId, (quantities.get(entry.cardId) ?? 0) + entry.quantity);
  }
  return [...quantities.entries()].map(([cardId, quantity]) => ({ cardId, quantity }));
}

function deckSizeError(deck: DeckList): string | null {
  if (!isGameMode(deck.mode)) {
    return "Modo de deck inválido.";
  }
  const limits = MODE_CONFIGS[deck.mode];
  const size = deck.cardIds.length;
  if (size < limits.mainDeckMin || size > limits.mainDeckMax) {
    return `Deck "${deck.name}" tem ${size} cartas; o modo ${deck.mode} exige entre ${limits.mainDeckMin} e ${limits.mainDeckMax}.`;
  }
  return null;
}
