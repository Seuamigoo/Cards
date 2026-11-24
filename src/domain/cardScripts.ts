export const DRAGAO_BRASA_ID = "dragao-brasa";
export const FILHOTE_BRASA_ID = "filhote-de-brasa";

export type OnSummon =
  | { readonly kind: "enemyTowerDef"; readonly amount: number }
  | { readonly kind: "draw"; readonly count: number; readonly ifAnotherTag?: string }
  | { readonly kind: "heal"; readonly amount: number; readonly perTag?: string }
  | { readonly kind: "damage"; readonly amount: number }
  | { readonly kind: "debuffOne"; readonly amount: number }
  | { readonly kind: "debuffAll"; readonly amount: number };

export interface GrantAura {
  readonly kind: "grant";
  readonly tag: string;
  readonly classTag?: string;
  readonly othersOnly: boolean;
  readonly atk?: number;
  readonly def?: number;
  readonly impeto?: boolean;
}

export interface SelfPerOther {
  readonly kind: "perOther";
  readonly tag: string;
  readonly atk: number;
  readonly max?: number;
}

export interface CardScript {
  readonly special?: "brasa";
  readonly onSummon?: OnSummon;
  readonly aura?: GrantAura | SelfPerOther;
  readonly towerDef?: number;
  readonly activateHeal?: number;
  readonly onBattleDestroy?: number;
  readonly onDestroyedInBattle?: number;
}

const towerHit = (amount: number): OnSummon => ({ kind: "enemyTowerDef", amount });
const drawOne: OnSummon = { kind: "draw", count: 1 };

export const CARD_SCRIPTS: Readonly<Record<string, CardScript>> = {
  [FILHOTE_BRASA_ID]: { onDestroyedInBattle: 300 },
  "batedora-da-folhagem": { onSummon: towerHit(300) },
  "sentinela-do-bosque": {},
  "oraculo-das-copas": { onSummon: drawOne },
  "arqueira-mor-sylwen": {
    aura: { kind: "grant", tag: "ELF", classTag: "ARCHER", othersOnly: true, atk: 200 },
  },
  "besteiro-de-pedra": { onSummon: towerHit(400) },
  "sacerdote-das-runas": { towerDef: 300 },
  "rei-ferreiro-thorvak": {
    aura: { kind: "grant", tag: "DWARF", othersOnly: true, def: 300 },
  },
  "querubim-vigia": { onSummon: { kind: "heal", amount: 300 } },
  "mensageira-da-aurora": { onSummon: drawOne },
  "arqueira-celeste": { onSummon: towerHit(500) },
  "serafim-justiceiro": { activateHeal: 500 },
  "torreta-mecanica": { onSummon: towerHit(300) },
  "calculista-de-cobre": { onSummon: { kind: "draw", count: 1, ifAnotherTag: "AUTOMATON" } },
  "colosso-de-aco": { aura: { kind: "perOther", tag: "AUTOMATON", atk: 200, max: 600 } },
  "xama-coruja": { activateHeal: 300 },
  "alfa-da-matilha": {
    aura: { kind: "grant", tag: "BEAST", othersOnly: true, atk: 200, impeto: true },
  },
  "fagulha-viva": { onSummon: { kind: "damage", amount: 200 } },
  "espirito-da-nevoa": { onSummon: { kind: "debuffOne", amount: 400 } },
  "ondina-da-fonte": { activateHeal: 400 },
  "tita-da-tempestade": { onSummon: { kind: "debuffAll", amount: 500 } },
  "bruxa-das-mares": { onSummon: { kind: "debuffOne", amount: 500 } },
  "assassino-abissal": { onBattleDestroy: 300 },
  "larva-operaria": { aura: { kind: "perOther", tag: "SWARM", atk: 100 } },
  "vespa-atiradora": { onSummon: towerHit(300) },
  "zeladora-da-colmeia": { onSummon: { kind: "heal", amount: 200, perTag: "SWARM" } },
  "rainha-da-colmeia": {
    aura: { kind: "grant", tag: "SWARM", othersOnly: true, atk: 200 },
  },
  "arvore-sentinela": {
    aura: { kind: "grant", tag: "ELF", othersOnly: false, atk: 200 },
  },
  "fortaleza-da-montanha": {
    aura: { kind: "grant", tag: "DWARF", othersOnly: false, def: 200 },
  },
};

export function scriptOf(cardId: string): CardScript | undefined {
  return CARD_SCRIPTS[cardId];
}

export function needsSummonTarget(cardId: string): boolean {
  return scriptOf(cardId)?.onSummon?.kind === "debuffOne";
}
