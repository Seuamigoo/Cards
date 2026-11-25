import { STARTER_DECKS, starterCardIds } from "../../../src/catalog/index";
import type { CardRarity, GameMode } from "../../../src/domain/index";
import { copyLimit, deckSizeStatus } from "./deckRules";

/**
 * Formato previsto do servidor:
 * GET /collection -> CartaQuantidade[]
 * GET /decks -> DeckGravado[]
 * PUT /decks -> a validação fica no servidor; o exemplo aplica a mesma regra local.
 */
export interface CartaQuantidade {
  readonly carta: string;
  readonly quantidade: number;
}

export interface DeckGravado {
  readonly id: string;
  readonly name: string;
  readonly mode: GameMode;
  readonly cardIds: readonly string[];
}

export interface Movimento {
  readonly id: string;
  readonly kind: "compra" | "abertura" | "venda";
  readonly text: string;
  readonly crystals: number;
  readonly essence: number;
}

export interface PlayerRecord {
  readonly example: true;
  readonly economy: boolean;
  readonly crystals: number;
  readonly essence: number;
  readonly collection: readonly CartaQuantidade[];
  readonly decks: readonly DeckGravado[];
  readonly starterChosen: boolean;
  readonly marketLocked: readonly string[];
  readonly ledger: readonly Movimento[];
}

export interface PlayerDataService {
  load(): Promise<PlayerRecord>;
  saveDecks(
    decks: readonly DeckGravado[],
    rarityOf: (cardId: string) => CardRarity | null,
  ): Promise<{ readonly ok: true; readonly record: PlayerRecord } | { readonly ok: false; readonly motivo: string }>;
  chooseStarter(starterId: string): Promise<PlayerRecord>;
}

const EXAMPLE_LEDGER: readonly Movimento[] = [
  { id: "ex-1", kind: "compra", text: "Deck Vanguarda do Reino", crystals: -1000, essence: 0 },
  { id: "ex-2", kind: "abertura", text: "Caixa do Despertar", crystals: -250, essence: 0 },
  { id: "ex-3", kind: "venda", text: "Poção de Campanha", crystals: 0, essence: 5 },
];

export function guestRecord(): PlayerRecord {
  const quantities = new Map<string, number>();
  for (const starter of STARTER_DECKS) {
    for (const entry of starter.counts) {
      quantities.set(entry.cardId, Math.max(quantities.get(entry.cardId) ?? 0, entry.classic));
    }
  }
  return {
    example: true,
    economy: false,
    crystals: 0,
    essence: 0,
    collection: [...quantities.entries()].map(([carta, quantidade]) => ({ carta, quantidade })),
    decks: STARTER_DECKS.flatMap((starter) => decksOf(starter.id)),
    starterChosen: true,
    marketLocked: [],
    ledger: [],
  };
}

export function freshAccount(): PlayerRecord {
  return {
    example: true,
    economy: true,
    crystals: 3200,
    essence: 2400,
    collection: [],
    decks: [],
    starterChosen: false,
    marketLocked: ["rei-aldren"],
    ledger: EXAMPLE_LEDGER,
  };
}

export function applyStarter(record: PlayerRecord, starterId: string): PlayerRecord {
  const starter = STARTER_DECKS.find((item) => item.id === starterId);
  if (starter === undefined) {
    return record;
  }
  return {
    ...record,
    starterChosen: true,
    collection: starter.counts
      .filter((entry) => entry.classic > 0)
      .map((entry) => ({ carta: entry.cardId, quantidade: entry.classic })),
    decks: decksOf(starter.id),
  };
}

export function createExamplePlayerData(initial: PlayerRecord = freshAccount()): PlayerDataService {
  let current = initial;
  return {
    async load() {
      return current;
    },
    async saveDecks(decks, rarityOf) {
      const motivo = validateDecks(decks, rarityOf);
      if (motivo !== null) {
        return { ok: false, motivo };
      }
      current = { ...current, decks: decks.map((deck) => ({ ...deck, cardIds: [...deck.cardIds] })) };
      return { ok: true, record: current };
    },
    async chooseStarter(starterId) {
      current = applyStarter(current, starterId);
      return current;
    },
  };
}

export function validateDecks(
  decks: readonly DeckGravado[],
  rarityOf: (cardId: string) => CardRarity | null,
): string | null {
  for (const deck of decks) {
    const size = deckSizeStatus(deck.mode, deck.cardIds.length);
    if (!size.valid) {
      return size.reason;
    }
    const counts = new Map<string, number>();
    for (const cardId of deck.cardIds) {
      counts.set(cardId, (counts.get(cardId) ?? 0) + 1);
    }
    for (const [cardId, count] of counts) {
      const rarity = rarityOf(cardId);
      if (rarity === null) {
        return "O deck tem uma carta desconhecida.";
      }
      if (count > copyLimit(rarity)) {
        return rarity === "lendaria" || rarity === "mitica"
          ? "Lendária e Mítica: só 1 cópia por deck."
          : "Limite de 3 cópias da mesma carta por deck.";
      }
    }
  }
  return null;
}

function decksOf(starterId: string): readonly DeckGravado[] {
  const starter = STARTER_DECKS.find((item) => item.id === starterId);
  const name = starter?.name ?? starterId;
  return [
    { id: `${starterId}-classic`, name, mode: "classic", cardIds: [...starterCardIds(starterId, "classic")] },
    { id: `${starterId}-blitz`, name, mode: "blitz", cardIds: [...starterCardIds(starterId, "blitz")] },
  ];
}
