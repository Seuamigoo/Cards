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
 * Chave da cópia física. O motor carimba `instanceId` (PR #16).
 * Se a carta ainda não tiver o campo, a chave descreve o lugar no BoardState.
 */
export function cardInstanceKey(card: Card, locus: CardLocus): string {
  const stamped = card.instanceId;
  if (stamped !== undefined && stamped.length > 0) {
    return stamped;
  }
  return fallbackKey(card.id, locus);
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
