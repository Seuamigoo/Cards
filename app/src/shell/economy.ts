import type { CardRarity } from "../../../src/domain/index";

/**
 * Números da proposta de economia.
 * A vitrine que usa estes números é de exemplo: não debita saldo nem cobra dinheiro.
 * Comum 20–100 e Mítica 2000–10000 são o piso e o teto citados.
 * As faixas intermediárias seguem a mesma escala até a tabela fechada.
 */
export const BOX_CRYSTAL_PRICE = 250;
export const BOX_DRAW_COUNT = 5;
export const READY_DECK_CRYSTAL_PRICE = 1000;
export const MARKET_FEE_RATE = 0.1;

export const RARITY_ORDER = ["comum", "incomum", "rara", "epica", "lendaria", "mitica"] as const;

export const MARKET_BANDS: Readonly<Record<CardRarity, { readonly min: number; readonly max: number }>> = {
  comum: { min: 20, max: 100 },
  incomum: { min: 60, max: 300 },
  rara: { min: 150, max: 800 },
  epica: { min: 400, max: 2000 },
  lendaria: { min: 800, max: 5000 },
  mitica: { min: 2000, max: 10000 },
};

export const SALVAGE_ESSENCE: Readonly<Record<CardRarity, number>> = {
  comum: 5,
  incomum: 15,
  rara: 50,
  epica: 150,
  lendaria: 400,
  mitica: 1000,
};

/** Vendedor especial: só Essência, e só Épica, Lendária e Mítica. */
export const VENDOR_ESSENCE: Readonly<Record<"epica" | "lendaria" | "mitica", number>> = {
  epica: 1500,
  lendaria: 4000,
  mitica: 10000,
};

export interface RarityShare {
  readonly rarity: CardRarity;
  readonly count: number;
  readonly total: number;
}

export interface MarketSplit {
  readonly fee: number;
  readonly sellerReceives: number;
}

export function chancesForRarities(rarities: readonly CardRarity[]): readonly RarityShare[] {
  const counts = new Map<CardRarity, number>(RARITY_ORDER.map((rarity) => [rarity, 0]));
  for (const rarity of rarities) {
    const current = counts.get(rarity);
    counts.set(rarity, (current ?? 0) + 1);
  }
  return RARITY_ORDER.map((rarity) => ({
    rarity,
    count: counts.get(rarity) ?? 0,
    total: rarities.length,
  }));
}

export function chancesByRarity(
  cardIds: readonly string[],
  rarityOf: (cardId: string) => CardRarity,
): readonly RarityShare[] {
  return chancesForRarities(cardIds.map((cardId) => rarityOf(cardId)));
}

export function priceWithinBand(rarity: CardRarity, price: number): boolean {
  const band = MARKET_BANDS[rarity];
  return Number.isInteger(price) && price >= band.min && price <= band.max;
}

/** Taxa de 10%, arredondada para baixo, em Cristais inteiros. */
export function marketSplit(price: number): MarketSplit {
  if (!Number.isInteger(price) || price < 0) {
    throw new Error("Preço inválido.");
  }
  const fee = Math.floor(price * MARKET_FEE_RATE);
  return { fee, sellerReceives: price - fee };
}
