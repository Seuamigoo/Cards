import { MODE_CONFIGS } from "../../../src/domain/index";
import type { CardRarity, GameMode } from "../../../src/domain/index";

/** Limite de cópias da mesma carta no deck de batalha, nesta tela. */
export const DECK_COPY_LIMIT = 3;

export const ADD_DISABLED_NO_COPIES = "Cópias insuficientes.";
export const ADD_DISABLED_LIMIT = "Limite de 3 cópias da mesma carta por deck.";
export const ADD_DISABLED_UNIQUE = "Lendária e Mítica: só 1 cópia por deck.";
export const ADD_DISABLED_MARKET = "Esta carta está anunciada no mercado.";

export function copyLimit(rarity: CardRarity): number {
  switch (rarity) {
    case "lendaria":
    case "mitica":
      return 1;
    case "comum":
    case "incomum":
    case "rara":
    case "epica":
      return DECK_COPY_LIMIT;
    default: {
      const unexpected: never = rarity;
      return unexpected;
    }
  }
}

export function deckSizeStatus(mode: GameMode, size: number): { readonly valid: boolean; readonly reason: string | null } {
  const limits = MODE_CONFIGS[mode];
  const name = mode === "classic" ? "Clássico" : "Blitz";
  if (size < limits.mainDeckMin || size > limits.mainDeckMax) {
    return {
      valid: false,
      reason: `O deck ${name} precisa ter de ${limits.mainDeckMin} a ${limits.mainDeckMax} cartas. Este tem ${size}.`,
    };
  }
  return { valid: true, reason: null };
}

export type AddOffer =
  | { readonly state: "hidden" }
  | { readonly state: "disabled"; readonly reason: string }
  | { readonly state: "enabled" };

export interface DeckEditOffer {
  readonly add: AddOffer;
  readonly remove: boolean;
}

export type DeckMutation =
  | { readonly ok: true; readonly deck: readonly string[] }
  | { readonly ok: false; readonly reason: string };

export function copiesInDeck(deck: readonly string[], cardId: string): number {
  return deck.filter((id) => id === cardId).length;
}

/**
 * Adicionar aparece quando a carta não está no deck.
 * Remover aparece quando está.
 * Os dois aparecem quando ainda há cópias fora do deck.
 * No limite, Adicionar continua visível se houver cópia sobrando, mas desabilitado.
 */
export function deckEditOffer(input: {
  readonly owned: number;
  readonly inDeck: number;
  readonly rarity: CardRarity;
  readonly listed?: boolean;
}): DeckEditOffer {
  assertCount(input.owned, "cópias possuídas");
  assertCount(input.inDeck, "cópias no deck");
  const inDeck = input.inDeck > 0;
  const spare = input.owned > input.inDeck;
  const showAdd = !inDeck || spare;
  const remove = inDeck;
  if (input.listed === true) {
    return {
      add: showAdd ? { state: "disabled", reason: ADD_DISABLED_MARKET } : { state: "hidden" },
      remove: false,
    };
  }
  if (!showAdd) {
    return { add: { state: "hidden" }, remove };
  }
  if (!spare) {
    return { add: { state: "disabled", reason: ADD_DISABLED_NO_COPIES }, remove };
  }
  const limit = copyLimit(input.rarity);
  if (input.inDeck >= limit) {
    return {
      add: { state: "disabled", reason: limit === 1 ? ADD_DISABLED_UNIQUE : ADD_DISABLED_LIMIT },
      remove,
    };
  }
  return { add: { state: "enabled" }, remove };
}

export function addCopy(
  deck: readonly string[],
  cardId: string,
  owned: number,
  rarity: CardRarity,
  listed = false,
): DeckMutation {
  assertCardId(cardId);
  const offer = deckEditOffer({ owned, inDeck: copiesInDeck(deck, cardId), rarity, listed });
  switch (offer.add.state) {
    case "enabled":
      return { ok: true, deck: [...deck, cardId] };
    case "disabled":
      return { ok: false, reason: offer.add.reason };
    case "hidden":
      return { ok: false, reason: ADD_DISABLED_NO_COPIES };
    default: {
      const unexpected: never = offer.add;
      return { ok: false, reason: String(unexpected) };
    }
  }
}

export function removeCopy(deck: readonly string[], cardId: string): DeckMutation {
  assertCardId(cardId);
  const index = deck.lastIndexOf(cardId);
  if (index < 0) {
    return { ok: false, reason: "Esta carta não está no deck." };
  }
  return { ok: true, deck: deck.filter((_, item) => item !== index) };
}

function assertCount(value: number, label: string): void {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`Quantidade inválida de ${label}.`);
  }
}

function assertCardId(cardId: string): void {
  if (cardId.length === 0) {
    throw new Error("Carta inválida.");
  }
}
