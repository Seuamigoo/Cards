import { describe, expect, it } from "vitest";
import { MODE_CONFIGS, resolveConfig } from "../../src/domain/index";
import type { GameConfig, WinCondition } from "../../src/domain/index";

const CLASSIC: GameConfig = {
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

const BLITZ: GameConfig = {
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

type NumericField = {
  [K in keyof GameConfig]: GameConfig[K] extends number ? K : never;
}[keyof GameConfig];

const NUMERIC_FIELDS = [
  "playerHp",
  "monsterSlots",
  "spellTrapSlots",
  "mainDeckMin",
  "mainDeckMax",
  "lineageDeckMax",
  "towerZones",
  "biomeZones",
  "openingHandSize",
  "handLimit",
  "defaultTowerHp",
] as const satisfies readonly NumericField[];

function withNumericOverride(
  field: NumericField,
  value: number,
): Partial<Omit<GameConfig, "mode">> {
  switch (field) {
    case "playerHp":
      return { playerHp: value };
    case "monsterSlots":
      return { monsterSlots: value };
    case "spellTrapSlots":
      return { spellTrapSlots: value };
    case "mainDeckMin":
      return { mainDeckMin: value };
    case "mainDeckMax":
      return { mainDeckMax: value };
    case "lineageDeckMax":
      return { lineageDeckMax: value };
    case "towerZones":
      return { towerZones: value };
    case "biomeZones":
      return { biomeZones: value };
    case "openingHandSize":
      return { openingHandSize: value };
    case "handLimit":
      return { handLimit: value };
    case "defaultTowerHp":
      return { defaultTowerHp: value };
    default: {
      const unexpected: never = field;
      throw new Error(`Campo numérico inesperado: ${String(unexpected)}.`);
    }
  }
}

describe("MODE_CONFIGS", () => {
  it("define o modo classic", () => {
    expect(MODE_CONFIGS.classic).toEqual(CLASSIC);
  });

  it("define o modo blitz", () => {
    expect(MODE_CONFIGS.blitz).toEqual(BLITZ);
  });
});

describe("resolveConfig", () => {
  it("devolve a configuração do modo quando não há override", () => {
    expect(resolveConfig("classic")).toEqual(CLASSIC);
    expect(resolveConfig("blitz")).toEqual(BLITZ);
    expect(resolveConfig("classic")).not.toBe(MODE_CONFIGS.classic);
  });

  it("aplica override válido e preserva o restante do modo", () => {
    const resolved = resolveConfig("blitz", {
      playerHp: 3500,
      handLimit: 5,
      mainDeckMin: 20,
      mainDeckMax: 28,
    });

    expect(resolved).toEqual({
      ...BLITZ,
      playerHp: 3500,
      handLimit: 5,
      mainDeckMax: 28,
    });
    expect(resolved.mode).toBe("blitz");
  });

  it("aceita mainDeckMin igual a mainDeckMax", () => {
    const resolved = resolveConfig("classic", {
      mainDeckMin: 45,
      mainDeckMax: 45,
    });
    expect(resolved.mainDeckMin).toBe(45);
    expect(resolved.mainDeckMax).toBe(45);
  });

  it.each(NUMERIC_FIELDS)("rejeita %s igual a 0", (field) => {
    expect(() => resolveConfig("classic", withNumericOverride(field, 0))).toThrow(
      new RegExp(field),
    );
  });

  it.each(NUMERIC_FIELDS)("rejeita %s negativo", (field) => {
    expect(() => resolveConfig("classic", withNumericOverride(field, -1))).toThrow(
      /inteiro maior que 0/,
    );
  });

  it.each(NUMERIC_FIELDS)("rejeita %s não inteiro", (field) => {
    expect(() => resolveConfig("classic", withNumericOverride(field, 1.5))).toThrow(
      /inteiro maior que 0/,
    );
    expect(() =>
      resolveConfig("classic", withNumericOverride(field, Number.NaN)),
    ).toThrow(/inteiro maior que 0/);
    expect(() =>
      resolveConfig("classic", withNumericOverride(field, Number.POSITIVE_INFINITY)),
    ).toThrow(/inteiro maior que 0/);
  });

  it("rejeita mainDeckMin maior que mainDeckMax", () => {
    expect(() =>
      resolveConfig("classic", { mainDeckMin: 50, mainDeckMax: 40 }),
    ).toThrow(/mainDeckMin \(50\) não pode ser maior que mainDeckMax \(40\)/);

    expect(() => resolveConfig("classic", { mainDeckMin: 61 })).toThrow(
      /mainDeckMin \(61\) não pode ser maior que mainDeckMax \(60\)/,
    );

    expect(() => resolveConfig("blitz", { mainDeckMax: 19 })).toThrow(
      /mainDeckMin \(20\) não pode ser maior que mainDeckMax \(19\)/,
    );
  });

  it("rejeita winCondition inválida", () => {
    expect(() =>
      resolveConfig("classic", {
        winCondition: "tower_collapse" as WinCondition,
      }),
    ).toThrow(/winCondition inválida: "tower_collapse"/);
  });

  it("não muta MODE_CONFIGS", () => {
    const classicBefore = { ...MODE_CONFIGS.classic };
    const blitzBefore = { ...MODE_CONFIGS.blitz };

    resolveConfig("classic", { playerHp: 1000, handLimit: 4 });
    expect(() => resolveConfig("blitz", { playerHp: -5 })).toThrow(Error);
    expect(() =>
      resolveConfig("classic", { winCondition: "invalid" as WinCondition }),
    ).toThrow(Error);

    expect(MODE_CONFIGS.classic).toEqual(classicBefore);
    expect(MODE_CONFIGS.blitz).toEqual(blitzBefore);
    expect(MODE_CONFIGS.classic.playerHp).toBe(8000);
    expect(MODE_CONFIGS.blitz.playerHp).toBe(4000);
  });
});
