import { readCardImage } from "../catalog/image";
import { resolveConfig } from "../domain/config";
import type { GameMode, WinCondition } from "../domain/config";
import { cloneBoardState } from "../domain/state";
import type {
  BiomeCard,
  BoardState,
  Card,
  CardRarity,
  MonsterCard,
  Phase,
  PlayerIndex,
  PlayerState,
  SpellTrapCard,
  TowerCard,
  TowerInstance,
} from "../domain/state";
import { isRecord, migrate } from "./migrate";
import { SAVE_VERSION, persistFail, persistOk } from "./types";
import type { PersistResult, StorageAdapter } from "./types";

export function serializeMatch(state: BoardState): string {
  return JSON.stringify({ version: SAVE_VERSION, state });
}

export function deserializeMatch(json: string): PersistResult<BoardState> {
  const parsed = parseJson(json);
  if (!parsed.ok) {
    return parsed;
  }
  const migrated = migrate(parsed.value);
  if (!migrated.ok) {
    return migrated;
  }
  return parseMatchEnvelope(migrated.value);
}

export async function saveMatch(
  adapter: StorageAdapter,
  key: string,
  state: BoardState,
): Promise<void> {
  await adapter.set(key, serializeMatch(state));
}

export async function loadMatch(
  adapter: StorageAdapter,
  key: string,
): Promise<PersistResult<BoardState>> {
  const json = await adapter.get(key);
  if (json === null) {
    return persistFail("not_found", `Nenhum save em "${key}".`);
  }
  return deserializeMatch(json);
}

function parseJson(json: string): PersistResult<unknown> {
  try {
    return persistOk(JSON.parse(json) as unknown);
  } catch {
    return persistFail("corrupt", "JSON de partida corrompido.");
  }
}

function parseMatchEnvelope(value: unknown): PersistResult<BoardState> {
  if (!isRecord(value) || value.version !== SAVE_VERSION) {
    return persistFail("invalid", "Envelope de partida inválido.");
  }
  const state = parseBoard(value.state);
  if (state === null) {
    return persistFail("invalid", "Estado de partida inválido.");
  }
  return persistOk(cloneBoardState(state));
}

function parseBoard(value: unknown): BoardState | null {
  if (!isRecord(value) || !Array.isArray(value.players) || value.players.length !== 2) {
    return null;
  }
  const config = parseConfig(value.config);
  const phase = parsePhase(value.phase);
  const activePlayerIndex = parsePlayerIndex(value.activePlayerIndex);
  const winner = parseWinner(value.winner);
  const first = value.players[0];
  const second = value.players[1];
  if (
    config === null ||
    phase === null ||
    activePlayerIndex === null ||
    winner === undefined ||
    typeof value.turn !== "number" ||
    !Number.isInteger(value.turn) ||
    value.turn <= 0 ||
    first === undefined ||
    second === undefined
  ) {
    return null;
  }
  const players = [parsePlayer(first, config), parsePlayer(second, config)] as const;
  if (players[0] === null || players[1] === null) {
    return null;
  }
  return {
    config,
    players: [players[0], players[1]],
    turn: value.turn,
    activePlayerIndex,
    phase,
    winner,
  };
}

function parseConfig(value: unknown): BoardState["config"] | null {
  if (!isRecord(value) || (value.mode !== "classic" && value.mode !== "blitz")) {
    return null;
  }
  const mode: GameMode = value.mode;
  const numbers = {
    playerHp: value.playerHp,
    monsterSlots: value.monsterSlots,
    spellTrapSlots: value.spellTrapSlots,
    mainDeckMin: value.mainDeckMin,
    mainDeckMax: value.mainDeckMax,
    lineageDeckMax: value.lineageDeckMax,
    towerZones: value.towerZones,
    biomeZones: value.biomeZones,
    openingHandSize: value.openingHandSize,
    handLimit: value.handLimit,
    defaultTowerHp: value.defaultTowerHp,
  };
  if (Object.values(numbers).some((item) => typeof item !== "number")) {
    return null;
  }
  if (typeof value.winCondition !== "string") {
    return null;
  }
  try {
    return resolveConfig(mode, {
      playerHp: numbers.playerHp as number,
      monsterSlots: numbers.monsterSlots as number,
      spellTrapSlots: numbers.spellTrapSlots as number,
      mainDeckMin: numbers.mainDeckMin as number,
      mainDeckMax: numbers.mainDeckMax as number,
      lineageDeckMax: numbers.lineageDeckMax as number,
      towerZones: numbers.towerZones as number,
      biomeZones: numbers.biomeZones as number,
      openingHandSize: numbers.openingHandSize as number,
      handLimit: numbers.handLimit as number,
      defaultTowerHp: numbers.defaultTowerHp as number,
      winCondition: value.winCondition as WinCondition,
    });
  } catch {
    return null;
  }
}

function parsePlayer(value: unknown, config: BoardState["config"]): PlayerState | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    return null;
  }
  if (typeof value.hp !== "number" || !Number.isInteger(value.hp)) {
    return null;
  }
  if (
    typeof value.towerSummonedThisTurn !== "boolean" ||
    typeof value.normalSummonedThisTurn !== "boolean"
  ) {
    return null;
  }
  const hand = parseCardList(value.hand);
  const deck = parseCardList(value.deck);
  const graveyard = parseCardList(value.graveyard);
  const limbo = parseTowerList(value.limbo);
  const monsterZone = parseMonsterZone(value.monsterZone, config.monsterSlots);
  const spellTrapZone = parseSpellTrapZone(value.spellTrapZone, config.spellTrapSlots);
  const towerZone = parseTowerInstance(value.towerZone);
  const biomeZone = parseBiomeSlot(value.biomeZone);
  if (
    hand === null ||
    deck === null ||
    graveyard === null ||
    limbo === null ||
    monsterZone === null ||
    spellTrapZone === null ||
    towerZone === undefined ||
    biomeZone === undefined
  ) {
    return null;
  }
  return {
    id: value.id,
    hp: value.hp,
    hand,
    deck,
    monsterZone,
    spellTrapZone,
    towerZone,
    biomeZone,
    graveyard,
    limbo,
    towerSummonedThisTurn: value.towerSummonedThisTurn,
    normalSummonedThisTurn: value.normalSummonedThisTurn,
  };
}

function parseCardList(value: unknown): readonly Card[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const cards: Card[] = [];
  for (const entry of value) {
    const card = parseCard(entry);
    if (card === null) {
      return null;
    }
    cards.push(card);
  }
  return cards;
}

function parseTowerList(value: unknown): readonly TowerCard[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const cards: TowerCard[] = [];
  for (const entry of value) {
    const card = parseCard(entry);
    if (card === null || card.kind !== "tower") {
      return null;
    }
    cards.push(card);
  }
  return cards;
}

function parseMonsterZone(value: unknown, slots: number): readonly (MonsterCard | null)[] | null {
  if (!Array.isArray(value) || value.length !== slots) {
    return null;
  }
  const zone: (MonsterCard | null)[] = [];
  for (const entry of value) {
    if (entry === null) {
      zone.push(null);
      continue;
    }
    const card = parseCard(entry);
    if (card === null || card.kind !== "monster") {
      return null;
    }
    zone.push(card);
  }
  return zone;
}

function parseSpellTrapZone(
  value: unknown,
  slots: number,
): readonly (SpellTrapCard | null)[] | null {
  if (!Array.isArray(value) || value.length !== slots) {
    return null;
  }
  const zone: (SpellTrapCard | null)[] = [];
  for (const entry of value) {
    if (entry === null) {
      zone.push(null);
      continue;
    }
    const card = parseCard(entry);
    if (card === null || (card.kind !== "spell" && card.kind !== "trap")) {
      return null;
    }
    zone.push(card);
  }
  return zone;
}

function parseTowerInstance(value: unknown): TowerInstance | null | undefined {
  if (value === null) {
    return null;
  }
  if (!isRecord(value)) {
    return undefined;
  }
  const card = parseCard(value.card);
  if (
    card === null ||
    card.kind !== "tower" ||
    typeof value.hp !== "number" ||
    typeof value.maxHp !== "number"
  ) {
    return undefined;
  }
  return { card, hp: value.hp, maxHp: value.maxHp };
}

function parseBiomeSlot(value: unknown): BiomeCard | null | undefined {
  if (value === null) {
    return null;
  }
  const card = parseCard(value);
  if (card === null || card.kind !== "biome") {
    return undefined;
  }
  return card;
}

function parseCard(value: unknown): Card | null {
  if (!isRecord(value) || typeof value.id !== "string" || value.id.length === 0) {
    return null;
  }
  if (typeof value.name !== "string" || value.name.length === 0 || !isRarity(value.rarity)) {
    return null;
  }
  const base = { id: value.id, name: value.name, rarity: value.rarity };
  const card = (() => {
    switch (value.kind) {
      case "monster":
        return parseMonster(base, value);
      case "spell":
        return { ...base, kind: "spell" as const };
      case "trap":
        return { ...base, kind: "trap" as const };
      case "tower":
        return parseTower(base, value);
      case "biome":
        return { ...base, kind: "biome" as const };
      default:
        return null;
    }
  })();
  if (card === null) {
    return null;
  }
  return applyImage(card, value);
}

function applyImage<T extends Card>(card: T, value: Record<string, unknown>): T | null {
  if (!Object.hasOwn(value, "image")) {
    return card;
  }
  const image = readCardImage(value.image);
  if (image === null) {
    return null;
  }
  return { ...card, image };
}

function parseMonster(
  base: { readonly id: string; readonly name: string; readonly rarity: CardRarity },
  value: Record<string, unknown>,
): MonsterCard | null {
  if (typeof value.atk !== "number" || typeof value.def !== "number") {
    return null;
  }
  if (value.race !== undefined && typeof value.race !== "string") {
    return null;
  }
  if (value.class !== undefined && typeof value.class !== "string") {
    return null;
  }
  return {
    ...base,
    kind: "monster",
    atk: value.atk,
    def: value.def,
    ...(typeof value.race === "string" ? { race: value.race } : {}),
    ...(typeof value.class === "string" ? { class: value.class } : {}),
  };
}

function parseTower(
  base: { readonly id: string; readonly name: string; readonly rarity: CardRarity },
  value: Record<string, unknown>,
): TowerCard | null {
  if (value.hp !== undefined && typeof value.hp !== "number") {
    return null;
  }
  return {
    ...base,
    kind: "tower",
    ...(typeof value.hp === "number" ? { hp: value.hp } : {}),
  };
}

function isRarity(value: unknown): value is CardRarity {
  switch (value) {
    case "comum":
    case "incomum":
    case "rara":
    case "epica":
    case "lendaria":
    case "mitica":
      return true;
    default:
      return false;
  }
}

function parsePhase(value: unknown): Phase | null {
  switch (value) {
    case "draw":
    case "main1":
    case "battle":
    case "main2":
    case "end":
      return value;
    default:
      return null;
  }
}

function parsePlayerIndex(value: unknown): PlayerIndex | null {
  switch (value) {
    case 0:
    case 1:
      return value;
    default:
      return null;
  }
}

function parseWinner(value: unknown): PlayerIndex | null | undefined {
  if (value === null) {
    return null;
  }
  return parsePlayerIndex(value) ?? undefined;
}
