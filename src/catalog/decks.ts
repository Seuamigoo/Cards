export interface StarterDeck {
  readonly id: string;
  readonly name: string;
  readonly counts: readonly { readonly cardId: string; readonly classic: number; readonly blitz: number }[];
}

export const STARTER_DECKS: readonly StarterDeck[] = [
  {
    id: "vanguarda-do-reino",
    name: "Vanguarda do Reino",
    counts: [
      { cardId: "cidadela-do-rei", classic: 3, blitz: 2 },
      { cardId: "planicie-dourada", classic: 2, blitz: 1 },
      { cardId: "recruta-da-muralha", classic: 3, blitz: 2 },
      { cardId: "arqueira-da-torre-norte", classic: 3, blitz: 2 },
      { cardId: "escudeiro-juramentado", classic: 3, blitz: 2 },
      { cardId: "lamina-sem-brasao", classic: 2, blitz: 1 },
      { cardId: "cleriga-da-aurora", classic: 2, blitz: 1 },
      { cardId: "mago-da-corte", classic: 2, blitz: 1 },
      { cardId: "capita-lyra-valmont", classic: 2, blitz: 1 },
      { cardId: "paladino-do-estandarte", classic: 2, blitz: 1 },
      { cardId: "rei-aldren", classic: 1, blitz: 0 },
      { cardId: "filhote-de-brasa", classic: 3, blitz: 2 },
      { cardId: "serpe-das-cinzas", classic: 2, blitz: 1 },
      { cardId: "pocao-de-campanha", classic: 1, blitz: 0 },
      { cardId: "reforco-de-muralha", classic: 2, blitz: 1 },
      { cardId: "lamina-afiada", classic: 2, blitz: 1 },
      { cardId: "estratagema", classic: 1, blitz: 0 },
      { cardId: "ariete-de-cerco", classic: 1, blitz: 0 },
      { cardId: "fosso-de-estacas", classic: 1, blitz: 0 },
      { cardId: "muralha-de-escudos", classic: 2, blitz: 1 },
    ],
  },
  {
    id: "marcha-da-necropole",
    name: "Marcha da Necrópole",
    counts: [
      { cardId: "necropole-silente", classic: 3, blitz: 2 },
      { cardId: "pantano-das-lapides", classic: 2, blitz: 1 },
      { cardId: "esqueleto-guardiao", classic: 3, blitz: 2 },
      { cardId: "carnical-faminto", classic: 3, blitz: 2 },
      { cardId: "acolita-do-ossuario", classic: 2, blitz: 1 },
      { cardId: "arqueiro-espectral", classic: 3, blitz: 2 },
      { cardId: "necromante-velka", classic: 2, blitz: 1 },
      { cardId: "cavaleiro-sem-tumulo", classic: 2, blitz: 1 },
      { cardId: "rainha-ossuaria-morgala", classic: 1, blitz: 0 },
      { cardId: "diabrete-zombeteiro", classic: 3, blitz: 2 },
      { cardId: "algoz-do-abismo", classic: 2, blitz: 1 },
      { cardId: "pocao-de-campanha", classic: 1, blitz: 0 },
      { cardId: "reforco-de-muralha", classic: 1, blitz: 0 },
      { cardId: "lamina-afiada", classic: 2, blitz: 0 },
      { cardId: "estratagema", classic: 2, blitz: 1 },
      { cardId: "chamado-do-limbo", classic: 2, blitz: 1 },
      { cardId: "fosso-de-estacas", classic: 2, blitz: 1 },
      { cardId: "contra-ataque", classic: 2, blitz: 1 },
      { cardId: "muralha-de-escudos", classic: 2, blitz: 1 },
    ],
  },
];

export function starterCardIds(deckId: string, mode: "classic" | "blitz"): readonly string[] {
  const deck = STARTER_DECKS.find((item) => item.id === deckId);
  if (deck === undefined) {
    return [];
  }
  return deck.counts.flatMap((entry) => Array.from({ length: entry[mode] }, () => entry.cardId));
}
