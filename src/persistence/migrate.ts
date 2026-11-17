import { SAVE_VERSION, persistFail, persistOk } from "./types";
import type { PersistResult } from "./types";

export const MIGRATED_TIMESTAMP = "1970-01-01T00:00:00.000Z";

export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

export function migrate(raw: unknown): PersistResult<unknown> {
  if (!isRecord(raw) || !("version" in raw)) {
    return persistFail("corrupt", "Save sem versão de schema.");
  }
  const version = raw.version;
  if (typeof version !== "number" || !Number.isInteger(version) || version < 0) {
    return persistFail("corrupt", "Versão de save inválida.");
  }
  if (version > SAVE_VERSION) {
    return persistFail(
      "migration",
      `Versão ${version} é mais nova que o schema ${SAVE_VERSION}.`,
    );
  }

  let current: unknown = raw;
  let currentVersion = version;
  while (currentVersion < SAVE_VERSION) {
    const stepped = step(currentVersion, current);
    if (!stepped.ok) {
      return stepped;
    }
    current = stepped.value;
    currentVersion += 1;
  }
  return persistOk(current);
}

function step(version: number, raw: unknown): PersistResult<unknown> {
  switch (version) {
    case 0:
      return migrateV0ToV1(raw);
    case 1:
      return migrateV1ToV2(raw);
    default:
      return persistFail("migration", `Sem migração a partir da versão ${version}.`);
  }
}

function migrateV0ToV1(raw: unknown): PersistResult<unknown> {
  if (!isRecord(raw)) {
    return persistFail("migration", "Save v0 inválido.");
  }
  if ("state" in raw) {
    return persistOk({ version: 1, state: normalizeBoard(raw.state) });
  }
  if ("playerId" in raw) {
    return persistOk({ ...normalizeProfile(raw), version: 1 });
  }
  return persistFail("migration", "Save v0 sem partida ou perfil.");
}

function normalizeBoard(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const players = Array.isArray(value.players) ? value.players.map(normalizePlayer) : value.players;
  return {
    ...value,
    players,
    winner: "winner" in value ? value.winner : null,
  };
}

function normalizePlayer(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  return {
    ...value,
    limbo: "limbo" in value ? value.limbo : [],
    towerSummonedThisTurn: "towerSummonedThisTurn" in value ? value.towerSummonedThisTurn : false,
    normalSummonedThisTurn: "normalSummonedThisTurn" in value ? value.normalSummonedThisTurn : false,
    attackedThisTurn: "attackedThisTurn" in value ? value.attackedThisTurn : [],
  };
}

function migrateV1ToV2(raw: unknown): PersistResult<unknown> {
  if (!isRecord(raw)) {
    return persistFail("migration", "Save v1 inválido.");
  }
  if ("state" in raw) {
    return persistOk({ version: SAVE_VERSION, state: upgradeBoard(raw.state) });
  }
  if ("playerId" in raw) {
    return persistOk({ ...raw, version: SAVE_VERSION });
  }
  return persistFail("migration", "Save v1 sem partida ou perfil.");
}

function upgradeBoard(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const config = isRecord(value.config) ? { ...value.config } : value.config;
  if (isRecord(config)) {
    delete config.defaultTowerHp;
  }
  const players = Array.isArray(value.players) ? value.players.map(upgradePlayer) : value.players;
  return { ...value, config, players };
}

function upgradePlayer(value: unknown): unknown {
  if (!isRecord(value)) {
    return value;
  }
  const next = { ...value };
  delete next.attackedThisTurn;
  if (Array.isArray(next.monsterZone)) {
    next.monsterZone = next.monsterZone.map(upgradeMonsterSlot);
  }
  next.towerZone = upgradeTower(next.towerZone);
  return next;
}

function upgradeMonsterSlot(value: unknown): unknown {
  if (value === null || !isRecord(value)) {
    return value;
  }
  if ("card" in value && "position" in value) {
    return value;
  }
  if (value.kind === "monster") {
    return {
      card: {
        ...value,
        level: typeof value.level === "number" ? value.level : 1,
        tags: Array.isArray(value.tags) ? value.tags : [],
        keywords: Array.isArray(value.keywords) ? value.keywords : [],
      },
      position: "attack",
      summonedThisTurn: false,
      changedPositionThisTurn: false,
      attackedThisTurn: false,
    };
  }
  return value;
}

function upgradeTower(value: unknown): unknown {
  if (value === null || !isRecord(value) || !isRecord(value.card)) {
    return value;
  }
  const card = { ...value.card };
  if (typeof card.def !== "number") {
    card.def = typeof card.hp === "number" ? card.hp : 0;
  }
  delete card.hp;
  return { card, defBonus: typeof value.defBonus === "number" ? value.defBonus : 0 };
}

function normalizeProfile(raw: Record<string, unknown>): Record<string, unknown> {
  const stats = isRecord(raw.stats) ? raw.stats : {};
  return {
    ...raw,
    version: SAVE_VERSION,
    collection: raw.collection ?? [],
    decks: raw.decks ?? [],
    stats: {
      wins: typeof stats.wins === "number" ? stats.wins : 0,
      losses: typeof stats.losses === "number" ? stats.losses : 0,
      matchesPlayed: typeof stats.matchesPlayed === "number" ? stats.matchesPlayed : 0,
    },
    updatedAt: typeof raw.updatedAt === "string" ? raw.updatedAt : MIGRATED_TIMESTAMP,
  };
}
