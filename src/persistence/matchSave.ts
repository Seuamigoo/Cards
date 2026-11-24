import { readCardImage } from "../catalog/image";
import { resolveConfig } from "../domain/config";
import type { GameMode, WinCondition } from "../domain/config";
import { cloneBoardState } from "../domain/state";
import type {
  BiomeCard,
  BoardState,
  Card,
  CardRarity,
  Keyword,
  MonsterCard,
  MonsterInstance,
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
  };
  if (typeof value.enableConvergence !== "boolean") {
    return null;
  }
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
      winCondition: value.winCondition as WinCondition,
      enableConvergence: value.enableConvergence === true,
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
    typeof value.normalSummonedThisTurn !== "boolean" ||
    typeof value.convergedThisTurn !== "boolean"
  ) {
    return null;
  }
  const hand = parseCardList(value.hand);
  const deck = parseCardList(value.deck);
  const graveyard = parseCardList(value.graveyard);
  const limbo = parseCardList(value.limbo);
  const monsterZone = parseMonsterZone(value.monsterZone, config.monsterSlots);
  const spellTrapZone = parseSpellTrapZone(value.spellTrapZone, config.spellTrapSlots);
  const towerZone = parseTowerInstance(value.towerZone);
  const biomeZone = parseBiomeSlot(value.biomeZone);
  const lineageDeck = parseLineageDeck(value.lineageDeck);
  if (
    hand === null ||
    deck === null ||
    graveyard === null ||
    limbo === null ||
    monsterZone === null ||
    spellTrapZone === null ||
    towerZone === undefined ||
    biomeZone === undefined ||
    lineageDeck === null
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
    lineageDeck,
    convergedThisTurn: value.convergedThisTurn,
  };
}

function parseLineageDeck(value: unknown): readonly MonsterCard[] | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const cards: MonsterCard[] = [];
  for (const entry of value) {
    const card = parseCard(entry);
    if (card === null || card.kind !== "monster") {
      return null;
    }
    cards.push(card);
  }
  return cards;
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

function parseMonsterZone(value: unknown, slots: number): readonly (MonsterInstance | null)[] | null {
  if (!Array.isArray(value) || value.length !== slots) {
    return null;
  }
  const zone: (MonsterInstance | null)[] = [];
  for (const entry of value) {
    if (entry === null) {
      zone.push(null);
      continue;
    }
    if (!isRecord(entry) || (entry.position !== "attack" && entry.position !== "defense")) {
      return null;
    }
    const card = parseCard(entry.card);
    if (card === null || card.kind !== "monster") {
      return null;
    }
    if (
      typeof entry.summonedThisTurn !== "boolean" ||
      typeof entry.changedPositionThisTurn !== "boolean" ||
      typeof entry.attackedThisTurn !== "boolean"
    ) {
      return null;
    }
    if (entry.siege !== undefined && entry.siege !== true) {
      return null;
    }
    const materials = readMaterials(entry.materials);
    if (!materials.ok) {
      return null;
    }
    if (entry.tempAtk !== undefined && typeof entry.tempAtk !== "number") {
      return null;
    }
    zone.push({
      card,
      position: entry.position,
      summonedThisTurn: entry.summonedThisTurn,
      changedPositionThisTurn: entry.changedPositionThisTurn,
      attackedThisTurn: entry.attackedThisTurn,
      ...(entry.siege === true ? { siege: true } : {}),
      ...(materials.cards !== undefined ? { materials: materials.cards } : {}),
      ...(typeof entry.tempAtk === "number" ? { tempAtk: entry.tempAtk } : {}),
      ...(entry.activatedThisTurn === true ? { activatedThisTurn: true } : {}),
    });
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
    typeof value.defBonus !== "number"
  ) {
    return undefined;
  }
  return { card, defBonus: value.defBonus };
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
  const base = {
    id: value.id,
    name: value.name,
    rarity: value.rarity,
    ...(typeof value.instanceId === "string" && value.instanceId.length > 0 ? { instanceId: value.instanceId } : {}),
  };
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
  const imaged = applyImage(card, value);
  if (imaged === null) {
    return null;
  }
  if (typeof value.flavor !== "string" || value.flavor.length === 0) {
    return imaged;
  }
  return { ...imaged, flavor: value.flavor };
}

function readMaterials(value: unknown): { ok: true; cards?: MonsterCard[] } | { ok: false } {
  if (value === undefined) {
    return { ok: true };
  }
  if (!Array.isArray(value)) {
    return { ok: false };
  }
  const cards: MonsterCard[] = [];
  for (const entry of value) {
    const card = parseCard(entry);
    if (card === null || card.kind !== "monster") {
      return { ok: false };
    }
    cards.push(card);
  }
  return cards.length > 0 ? { ok: true, cards } : { ok: true };
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
  if (typeof value.level !== "number" || typeof value.atk !== "number" || typeof value.def !== "number") {
    return null;
  }
  if (!Array.isArray(value.tags) || value.tags.some((tag) => typeof tag !== "string")) {
    return null;
  }
  if (!Array.isArray(value.keywords) || value.keywords.some((keyword) => !isKeyword(keyword))) {
    return null;
  }
  return {
    ...base,
    kind: "monster",
    level: value.level,
    atk: value.atk,
    def: value.def,
    tags: value.tags,
    keywords: value.keywords,
  };
}

function parseTower(
  base: { readonly id: string; readonly name: string; readonly rarity: CardRarity },
  value: Record<string, unknown>,
): TowerCard | null {
  if (typeof value.def !== "number") {
    return null;
  }
  return {
    ...base,
    kind: "tower",
    def: value.def,
  };
}

function isKeyword(value: unknown): value is Keyword {
  switch (value) {
    case "impeto":
    case "provocar":
    case "perfurar":
    case "ataqueTorre":
      return true;
    default:
      return false;
  }
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
