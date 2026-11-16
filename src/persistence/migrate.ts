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
    default:
      return persistFail("migration", `Sem migração a partir da versão ${version}.`);
  }
}

function migrateV0ToV1(raw: unknown): PersistResult<unknown> {
  if (!isRecord(raw)) {
    return persistFail("migration", "Save v0 inválido.");
  }
  if ("state" in raw) {
    return persistOk({ version: SAVE_VERSION, state: normalizeBoard(raw.state) });
  }
  if ("playerId" in raw) {
    return persistOk(normalizeProfile(raw));
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
  };
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
