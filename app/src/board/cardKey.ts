import type { Card, PlayerIndex } from "../../../src/domain/index";

export type CardLocus =
  | {
      readonly player: PlayerIndex;
      readonly zone: "hand" | "deck" | "limbo" | "graveyard" | "lineage";
      readonly index: number;
    }
  | { readonly player: PlayerIndex; readonly zone: "monster" | "spell"; readonly index: number }
  | { readonly player: PlayerIndex; readonly zone: "material"; readonly index: number; readonly material: number }
  | { readonly player: PlayerIndex; readonly zone: "tower" | "biome" };

/**
 * Chave de uma cópia física na UI.
 * O PR #16 (não mergeado) carimba `instanceId` na carta e o preserva na cópia.
 * Enquanto a main não tiver esse campo, a chave descreve o lugar no BoardState.
 * Quando `instanceId` existir, ele passa na frente do fallback — é o único ponto para trocar.
 */
export function cardInstanceKey(card: Card, locus: CardLocus): string {
  const stamped = readInstanceId(card);
  if (stamped !== null) {
    return stamped;
  }
  return fallbackKey(card.id, locus);
}

function readInstanceId(card: Card): string | null {
  if (!Object.hasOwn(card, "instanceId")) {
    return null;
  }
  const value = (card as Card & { readonly instanceId?: unknown }).instanceId;
  if (typeof value !== "string" || value.length === 0) {
    return null;
  }
  return value;
}

function fallbackKey(cardId: string, locus: CardLocus): string {
  switch (locus.zone) {
    case "material":
      return `loc:${locus.player}:material:${locus.index}:${locus.material}:${cardId}`;
    case "tower":
    case "biome":
      return `loc:${locus.player}:${locus.zone}:${cardId}`;
    case "hand":
    case "deck":
    case "limbo":
    case "graveyard":
    case "lineage":
    case "monster":
    case "spell":
      return `loc:${locus.player}:${locus.zone}:${locus.index}:${cardId}`;
    default: {
      const unexpected: never = locus;
      return String(unexpected);
    }
  }
}
