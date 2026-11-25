import type { CardRegistry } from "../../../src/catalog/index";
import { GameMatch } from "../../../src/domain/index";
import type { Action, Card, Rng } from "../../../src/domain/index";

const orderedRng: Rng = { next: () => 0.999 };

/**
 * Partida clássica em que o Dragão Brasa entra com 3 materiais.
 * Só usa o dispatch do motor, para a UI mostrar `materials` de verdade.
 */
export function brasaShowcase(registry: CardRegistry): { readonly ok: true; readonly match: GameMatch } | { readonly ok: false; readonly error: string } {
  const cards = takeAll(registry, [
    "dragao-brasa",
    "filhote-de-brasa",
    "cidadela-do-rei",
    "planicie-dourada",
    "pocao-de-campanha",
    "recruta-da-muralha",
    "esqueleto-guardiao",
    "necropole-silente",
    "pantano-das-lapides",
    "lamina-afiada",
    "muralha-de-escudos",
    "diabrete-zombeteiro",
  ]);
  if (cards === null) {
    return { ok: false, error: "O catálogo não tem as cartas da mesa do Dragão Brasa." };
  }
  const card = (id: string): Card => {
    const found = cards.get(id);
    if (found === undefined) {
      throw new Error(`Carta ausente: ${id}.`);
    }
    return found;
  };
  const filhote = card("filhote-de-brasa");
  const yours: Card[] = [
    card("recruta-da-muralha"),
    card("pocao-de-campanha"),
    card("planicie-dourada"),
    card("cidadela-do-rei"),
    filhote,
    filhote,
    filhote,
    card("dragao-brasa"),
  ];
  const theirs: Card[] = [
    card("diabrete-zombeteiro"),
    card("muralha-de-escudos"),
    card("pantano-das-lapides"),
    card("lamina-afiada"),
    card("esqueleto-guardiao"),
    card("pantano-das-lapides"),
    card("necropole-silente"),
    card("esqueleto-guardiao"),
  ];
  const match = new GameMatch("classic", ["voce", "bot"], undefined, {
    decks: [yours, theirs],
    rng: orderedRng,
  });
  try {
    const error = script(match);
    if (error !== null) {
      return { ok: false, error };
    }
    return { ok: true, match };
  } catch (caught) {
    const message = caught instanceof Error ? caught.message : "A mesa do Dragão Brasa falhou.";
    return { ok: false, error: message };
  }
}

function script(match: GameMatch): string | null {
  let error = toMain(match);
  if (error !== null) {
    return error;
  }
  error = summonNamed(match, 0, "filhote-de-brasa", 0, "defense");
  if (error !== null) {
    return error;
  }
  error = act(match, { type: "summonTower", handIndex: handIndex(match, "cidadela-do-rei") });
  if (error !== null) {
    return error;
  }
  error = endTurn(match);
  if (error !== null) {
    return error;
  }

  error = toMain(match);
  if (error !== null) {
    return error;
  }
  error = summonNamed(match, 1, "esqueleto-guardiao", 0, "defense");
  if (error !== null) {
    return error;
  }
  error = act(match, { type: "summonTower", handIndex: handIndex(match, "necropole-silente") });
  if (error !== null) {
    return error;
  }
  error = act(match, { type: "playBiome", handIndex: handIndex(match, "pantano-das-lapides") });
  if (error !== null) {
    return error;
  }
  error = act(match, { type: "playBiome", handIndex: handIndex(match, "pantano-das-lapides") });
  if (error !== null) {
    return error;
  }
  error = endTurn(match);
  if (error !== null) {
    return error;
  }

  error = toMain(match);
  if (error !== null) {
    return error;
  }
  error = act(match, { type: "playBiome", handIndex: handIndex(match, "planicie-dourada") });
  if (error !== null) {
    return error;
  }
  error = summonNamed(match, 0, "filhote-de-brasa", 1, "attack");
  if (error !== null) {
    return error;
  }
  error = endTurn(match);
  if (error !== null) {
    return error;
  }

  error = toMain(match);
  if (error !== null) {
    return error;
  }
  error = act(match, { type: "setSpellTrap", handIndex: handIndex(match, "muralha-de-escudos"), zoneIndex: 0 });
  if (error !== null) {
    return error;
  }
  error = endTurn(match);
  if (error !== null) {
    return error;
  }

  error = toMain(match);
  if (error !== null) {
    return error;
  }
  error = summonNamed(match, 0, "filhote-de-brasa", 2, "attack");
  if (error !== null) {
    return error;
  }
  return act(match, {
    type: "fuseBrasa",
    handIndex: handIndex(match, "dragao-brasa"),
    zoneIndex: 0,
    position: "attack",
    materialZoneIndexes: [0, 1, 2],
  });
}

function summonNamed(
  match: GameMatch,
  player: 0 | 1,
  cardId: string,
  zoneIndex: number,
  position: "attack" | "defense",
): string | null {
  if (match.getState().activePlayerIndex !== player) {
    return "A mesa mudou de jogador antes da invocação.";
  }
  return act(match, {
    type: "summonMonster",
    handIndex: handIndex(match, cardId),
    zoneIndex,
    position,
    tributeZoneIndexes: [],
  });
}

function toMain(match: GameMatch): string | null {
  if (match.getState().phase === "draw") {
    const error = act(match, { type: "advancePhase" });
    if (error !== null) {
      return error;
    }
  }
  const phase = match.getState().phase;
  if (phase !== "main1" && phase !== "main2") {
    return `A mesa não chegou na fase principal (${phase}).`;
  }
  return null;
}

function endTurn(match: GameMatch): string | null {
  const player = match.getState().activePlayerIndex;
  for (let step = 0; step < 8; step += 1) {
    if (match.getState().activePlayerIndex !== player || match.getState().winner !== null) {
      return null;
    }
    const error = act(match, { type: "advancePhase" });
    if (error !== null) {
      return error;
    }
  }
  return "A mesa não conseguiu encerrar o turno.";
}

function handIndex(match: GameMatch, cardId: string): number {
  const index = match.getState().players[match.getState().activePlayerIndex].hand.findIndex((card) => card.id === cardId);
  if (index < 0) {
    throw new Error(`A mão não tem ${cardId}.`);
  }
  return index;
}

function act(match: GameMatch, action: Action): string | null {
  const result = match.dispatch(action);
  return result.ok ? null : result.error;
}

function takeAll(registry: CardRegistry, ids: readonly string[]): Map<string, Card> | null {
  const cards = new Map<string, Card>();
  for (const id of ids) {
    const card = registry.get(id);
    if (card === undefined) {
      return null;
    }
    cards.set(id, card);
  }
  return cards;
}
