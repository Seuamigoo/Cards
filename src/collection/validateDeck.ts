import { STARTER_DECKS } from "../catalog/decks";
import { DESPERTAR_CARDS } from "../catalog/despertar";
import { MODE_CONFIGS } from "../domain/config";
import type { GameMode } from "../domain/config";

export interface CollectionCard {
  readonly cardId: string;
  readonly quantity: number;
}

export interface DeckCard {
  readonly cardId: string;
  readonly qty: number;
}

export interface DeckDraft {
  readonly name: string;
  readonly cards: readonly DeckCard[];
  readonly lineage?: readonly DeckCard[] | null;
}

export interface DeckValidation {
  readonly valid: boolean;
  readonly size: number;
  readonly errors: readonly string[];
}

export interface GuestDeck {
  readonly id: string;
  readonly name: string;
  readonly mode: GameMode;
  readonly cards: readonly DeckCard[];
  readonly isActive: boolean;
  readonly lineage: null;
}

const RARITY = new Map(DESPERTAR_CARDS.map((card) => [card.id, card.rarity]));

export function validateDeck(
  deck: DeckDraft,
  mode: GameMode,
  collection: readonly CollectionCard[],
): DeckValidation {
  const errors: string[] = [];
  const limits = MODE_CONFIGS[mode];
  const owned = new Map(collection.map((entry) => [entry.cardId, entry.quantity]));
  const totals = new Map<string, number>();
  let size = 0;
  for (const entry of deck.cards) {
    if (!Number.isInteger(entry.qty) || entry.qty <= 0) {
      errors.push(`Quantidade inválida de ${entry.cardId}.`);
      continue;
    }
    size += entry.qty;
    totals.set(entry.cardId, (totals.get(entry.cardId) ?? 0) + entry.qty);
  }
  if (size < limits.mainDeckMin || size > limits.mainDeckMax) {
    errors.push(`O deck ${mode} tem ${size} cartas; o permitido é de ${limits.mainDeckMin} a ${limits.mainDeckMax}.`);
  }
  for (const [cardId, qty] of totals) {
    const rarity = RARITY.get(cardId);
    if (rarity === undefined) {
      errors.push(`Carta desconhecida: ${cardId}.`);
      continue;
    }
    const cap = rarity === "lendaria" || rarity === "mitica" ? 1 : 3;
    if (qty > cap) {
      errors.push(cap === 1 ? `${cardId} aceita só 1 cópia.` : `${cardId} passa de 3 cópias.`);
    }
    const have = owned.get(cardId) ?? 0;
    if (qty > have) {
      errors.push(`${cardId} pede ${qty} e a coleção tem ${have}.`);
    }
  }
  const lineageSize = lineageCount(deck.lineage, errors);
  if (lineageSize > limits.lineageDeckMax) {
    errors.push(`A linhagem tem ${lineageSize} cartas; o modo ${mode} reserva até ${limits.lineageDeckMax}.`);
  }
  return { valid: errors.length === 0, size, errors };
}

export function starterCards(starterId: string, mode: GameMode): readonly DeckCard[] | null {
  const starter = STARTER_DECKS.find((item) => item.id === starterId);
  if (starter === undefined) {
    return null;
  }
  return starter.counts
    .filter((entry) => entry[mode] > 0)
    .map((entry) => ({ cardId: entry.cardId, qty: entry[mode] }));
}

export function guestCollection(): readonly CollectionCard[] {
  const totals = new Map<string, number>();
  for (const starter of STARTER_DECKS) {
    for (const entry of starter.counts) {
      const qty = Math.max(entry.classic, entry.blitz);
      totals.set(entry.cardId, Math.max(totals.get(entry.cardId) ?? 0, qty));
    }
  }
  return [...totals.entries()].map(([cardId, quantity]) => ({ cardId, quantity }));
}

export function guestDecks(mode: GameMode): readonly GuestDeck[] {
  return STARTER_DECKS.map((starter) => ({
    id: `${starter.id}:${mode}`,
    name: starter.name,
    mode,
    cards: starterCards(starter.id, mode) ?? [],
    isActive: true,
    lineage: null,
  }));
}

function lineageCount(lineage: readonly DeckCard[] | null | undefined, errors: string[]): number {
  if (lineage == null) {
    return 0;
  }
  let size = 0;
  for (const entry of lineage) {
    if (!Number.isInteger(entry.qty) || entry.qty <= 0) {
      errors.push(`Quantidade inválida na linhagem de ${entry.cardId}.`);
      continue;
    }
    size += entry.qty;
  }
  return size;
}
