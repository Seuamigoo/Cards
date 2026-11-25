import { STARTER_DECKS } from "../../../src/catalog/index";
import { BOX_CRYSTAL_PRICE, BOX_DRAW_COUNT, READY_DECK_CRYSTAL_PRICE, VENDOR_ESSENCE } from "./economy";

/**
 * Vitrine da loja. Dados de exemplo: não há compra, entrega nem pagamento.
 * A interface só carrega a vitrine. De propósito não existe método de compra.
 */
export interface ShopSource {
  load(): Promise<ShopShowcase>;
}

export const EXAMPLE_NOTICE =
  "Dados de exemplo. Nenhuma compra é concluída e não há pagamento em dinheiro.";

export interface ShopBox {
  readonly id: string;
  readonly name: string;
  readonly crystalPrice: number;
  readonly draws: number;
  /** Cada id entra uma vez. O sorteio de 5 cartas pode repetir. */
  readonly cardIds: readonly string[];
}

export interface ReadyDeckOffer {
  readonly deckId: string;
  readonly name: string;
  readonly crystalPrice: number;
  readonly cards: readonly { readonly cardId: string; readonly count: number }[];
}

export interface VendorOffer {
  readonly rarity: "epica" | "lendaria" | "mitica";
  readonly cardId: string | null;
  readonly stock: number;
  readonly priceEssence: number;
}

export interface MarketListing {
  readonly id: string;
  readonly cardId: string;
  readonly priceCrystals: number;
  /** Rótulo do anúncio, não o nome de uma pessoa. */
  readonly sellerLabel: string;
}

export interface ShopShowcase {
  readonly example: true;
  readonly notice: string;
  readonly boxes: readonly ShopBox[];
  readonly readyDecks: readonly ReadyDeckOffer[];
  readonly vendor: readonly VendorOffer[];
  readonly listings: readonly MarketListing[];
}

export function exampleShowcase(): ShopShowcase {
  return {
    example: true,
    notice: EXAMPLE_NOTICE,
    boxes: [
      {
        id: "caixa-despertar",
        name: "Caixa do Despertar",
        crystalPrice: BOX_CRYSTAL_PRICE,
        draws: BOX_DRAW_COUNT,
        cardIds: [
          "recruta-da-muralha",
          "arqueira-da-torre-norte",
          "escudeiro-juramentado",
          "filhote-de-brasa",
          "esqueleto-guardiao",
          "carnical-faminto",
          "diabrete-zombeteiro",
          "pocao-de-campanha",
          "lamina-sem-brasao",
          "cleriga-da-aurora",
          "mago-da-corte",
          "planicie-dourada",
          "pantano-das-lapides",
          "estratagema",
          "cidadela-do-rei",
          "capita-lyra-valmont",
          "serpe-das-cinzas",
          "chamado-do-limbo",
          "paladino-do-estandarte",
          "draconato-kaelthar",
          "rei-aldren",
        ],
      },
      {
        id: "caixa-fronteiras",
        name: "Caixa das Fronteiras",
        crystalPrice: BOX_CRYSTAL_PRICE,
        draws: BOX_DRAW_COUNT,
        cardIds: [
          "batedora-da-folhagem",
          "sentinela-do-bosque",
          "mineiro-da-forja-funda",
          "lobo-da-estepe",
          "larva-operaria",
          "lamina-do-crepusculo",
          "oraculo-das-copas",
          "escudo-de-bigorna",
          "sacerdote-das-runas",
          "arvore-sentinela",
          "fortaleza-da-montanha",
          "arqueira-mor-sylwen",
          "rei-ferreiro-thorvak",
          "leviatan-faminto",
          "rainha-ossuaria-morgala",
        ],
      },
    ],
    readyDecks: STARTER_DECKS.map((deck) => ({
      deckId: deck.id,
      name: deck.name,
      crystalPrice: READY_DECK_CRYSTAL_PRICE,
      cards: deck.counts
        .filter((entry) => entry.classic > 0)
        .map((entry) => ({ cardId: entry.cardId, count: entry.classic })),
    })),
    vendor: [
      { rarity: "epica", cardId: "paladino-do-estandarte", stock: 2, priceEssence: VENDOR_ESSENCE.epica },
      { rarity: "epica", cardId: "dragao-brasa", stock: 1, priceEssence: VENDOR_ESSENCE.epica },
      { rarity: "lendaria", cardId: "rei-aldren", stock: 1, priceEssence: VENDOR_ESSENCE.lendaria },
      { rarity: "lendaria", cardId: "rainha-ossuaria-morgala", stock: 1, priceEssence: VENDOR_ESSENCE.lendaria },
      { rarity: "mitica", cardId: null, stock: 0, priceEssence: VENDOR_ESSENCE.mitica },
    ],
    listings: [
      { id: "anuncio-recruta", cardId: "recruta-da-muralha", priceCrystals: 40, sellerLabel: "Mesa 12" },
      { id: "anuncio-escudeiro", cardId: "escudeiro-juramentado", priceCrystals: 80, sellerLabel: "Mesa 27" },
      { id: "anuncio-lamina", cardId: "lamina-sem-brasao", priceCrystals: 120, sellerLabel: "Mesa 41" },
      { id: "anuncio-serpe", cardId: "serpe-das-cinzas", priceCrystals: 400, sellerLabel: "Mesa 58" },
      { id: "anuncio-paladino", cardId: "paladino-do-estandarte", priceCrystals: 900, sellerLabel: "Mesa 63" },
      { id: "anuncio-rei", cardId: "rei-aldren", priceCrystals: 2200, sellerLabel: "Mesa 70" },
    ],
  };
}

export function createExampleShopSource(showcase: ShopShowcase = exampleShowcase()): ShopSource {
  return {
    async load() {
      return showcase;
    },
  };
}

export const exampleShop: ShopSource = createExampleShopSource();
