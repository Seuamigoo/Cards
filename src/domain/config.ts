export type GameMode = "classic" | "blitz";

/**
 * Condição de vitória da partida.
 * Extensível por união, por exemplo:
 * `export type WinCondition = "player_hp" | "tower_collapse";`
 */
export type WinCondition = "player_hp";

export interface GameConfig {
  readonly mode: GameMode;
  readonly playerHp: number;
  readonly monsterSlots: number;
  readonly spellTrapSlots: number;
  readonly mainDeckMin: number;
  readonly mainDeckMax: number;
  readonly lineageDeckMax: number;
  readonly towerZones: number;
  readonly biomeZones: number;
  /** PROVISÓRIO (até GDD v0.2) */
  readonly openingHandSize: number;
  /** PROVISÓRIO (até GDD v0.2) */
  readonly handLimit: number;
  /** PROVISÓRIO (até GDD v0.2) */
  readonly defaultTowerHp: number;
  /** PROVISÓRIO (até GDD v0.2) */
  readonly winCondition: WinCondition;
}

const CLASSIC_CONFIG: GameConfig = {
  mode: "classic",
  playerHp: 8000,
  monsterSlots: 6,
  spellTrapSlots: 6,
  mainDeckMin: 40,
  mainDeckMax: 60,
  lineageDeckMax: 15,
  towerZones: 1,
  biomeZones: 1,
  openingHandSize: 5,
  handLimit: 7,
  defaultTowerHp: 4000,
  winCondition: "player_hp",
};

const BLITZ_CONFIG: GameConfig = {
  mode: "blitz",
  playerHp: 4000,
  monsterSlots: 3,
  spellTrapSlots: 3,
  mainDeckMin: 20,
  mainDeckMax: 30,
  lineageDeckMax: 5,
  towerZones: 1,
  biomeZones: 1,
  openingHandSize: 4,
  handLimit: 6,
  defaultTowerHp: 2000,
  winCondition: "player_hp",
};

export const MODE_CONFIGS: Readonly<Record<GameMode, GameConfig>> = Object.freeze({
  classic: Object.freeze(CLASSIC_CONFIG),
  blitz: Object.freeze(BLITZ_CONFIG),
});

export function resolveConfig(
  mode: GameMode,
  overrides?: Partial<Omit<GameConfig, "mode">>,
): GameConfig {
  assertGameMode(mode);
  const base = MODE_CONFIGS[mode];
  const resolved = copyConfig(mode, base, overrides);
  assertValidConfig(resolved);
  return Object.freeze(resolved);
}

function copyConfig(
  mode: GameMode,
  base: GameConfig,
  overrides: Partial<Omit<GameConfig, "mode">> | undefined,
): GameConfig {
  return {
    mode,
    playerHp: overrides?.playerHp ?? base.playerHp,
    monsterSlots: overrides?.monsterSlots ?? base.monsterSlots,
    spellTrapSlots: overrides?.spellTrapSlots ?? base.spellTrapSlots,
    mainDeckMin: overrides?.mainDeckMin ?? base.mainDeckMin,
    mainDeckMax: overrides?.mainDeckMax ?? base.mainDeckMax,
    lineageDeckMax: overrides?.lineageDeckMax ?? base.lineageDeckMax,
    towerZones: overrides?.towerZones ?? base.towerZones,
    biomeZones: overrides?.biomeZones ?? base.biomeZones,
    openingHandSize: overrides?.openingHandSize ?? base.openingHandSize,
    handLimit: overrides?.handLimit ?? base.handLimit,
    defaultTowerHp: overrides?.defaultTowerHp ?? base.defaultTowerHp,
    winCondition: overrides?.winCondition ?? base.winCondition,
  };
}

function assertValidConfig(config: GameConfig): void {
  assertPositiveInteger("playerHp", config.playerHp);
  assertPositiveInteger("monsterSlots", config.monsterSlots);
  assertPositiveInteger("spellTrapSlots", config.spellTrapSlots);
  assertPositiveInteger("mainDeckMin", config.mainDeckMin);
  assertPositiveInteger("mainDeckMax", config.mainDeckMax);
  assertPositiveInteger("lineageDeckMax", config.lineageDeckMax);
  assertPositiveInteger("towerZones", config.towerZones);
  assertPositiveInteger("biomeZones", config.biomeZones);
  assertPositiveInteger("openingHandSize", config.openingHandSize);
  assertPositiveInteger("handLimit", config.handLimit);
  assertPositiveInteger("defaultTowerHp", config.defaultTowerHp);

  if (config.mainDeckMin > config.mainDeckMax) {
    throw new Error(
      `mainDeckMin (${config.mainDeckMin}) não pode ser maior que mainDeckMax (${config.mainDeckMax}).`,
    );
  }

  assertWinCondition(config.winCondition);
}

function assertPositiveInteger(field: keyof GameConfig, value: unknown): void {
  if (typeof value !== "number" || !Number.isInteger(value) || value <= 0) {
    throw new Error(
      `Campo "${field}" deve ser um inteiro maior que 0. Recebido: ${formatReceived(value)}.`,
    );
  }
}

function assertWinCondition(value: unknown): asserts value is WinCondition {
  if (typeof value !== "string") {
    throw invalidWinCondition(value);
  }

  const candidate = value as WinCondition;
  switch (candidate) {
    case "player_hp":
      return;
    default: {
      const unexpected: never = candidate;
      throw invalidWinCondition(unexpected);
    }
  }
}

function invalidWinCondition(value: unknown): Error {
  return new Error(
    `winCondition inválida: ${formatReceived(value)}. Valor aceito: "player_hp".`,
  );
}

function assertGameMode(mode: GameMode): void {
  switch (mode) {
    case "classic":
    case "blitz":
      return;
    default: {
      const unexpected: never = mode;
      throw new Error(
        `Modo inválido: ${formatReceived(unexpected)}. Valores aceitos: "classic", "blitz".`,
      );
    }
  }
}

function formatReceived(value: unknown): string {
  if (typeof value === "number") {
    return Object.is(value, -0) ? "-0" : String(value);
  }
  return JSON.stringify(value) ?? "undefined";
}
