import { effectiveAttack, effectiveTowerDefense } from "../../../src/domain/index";
import { effectiveDefense } from "../../../src/domain/effects";
import type { Card, PlayerState } from "../../../src/domain/index";

export type NameBand =
  | { readonly kind: "monster"; readonly level: number; readonly atk: number; readonly def: number }
  | { readonly kind: "tower"; readonly current: number; readonly printed: number }
  | { readonly kind: "plain" };

export function monsterBand(atk: number, def: number): string {
  return `Atk: ${atk}  Def: ${def}`;
}

/** A Torre não tem HP no motor. A faixa mostra a DEF efetiva e a DEF impressa. */
export function towerBand(current: number, printed: number): string {
  return `DEF: ${current}/${printed}`;
}

export function bandFromCard(card: Card): NameBand {
  switch (card.kind) {
    case "monster":
      return { kind: "monster", level: card.level, atk: card.atk, def: card.def };
    case "tower":
      return { kind: "tower", current: card.def, printed: card.def };
    case "spell":
    case "trap":
    case "biome":
      return { kind: "plain" };
    default: {
      const unexpected: never = card;
      return unexpected;
    }
  }
}

export function fieldMonsterBand(player: PlayerState, zoneIndex: number): NameBand | null {
  const slot = player.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return null;
  }
  return {
    kind: "monster",
    level: slot.card.level,
    atk: effectiveAttack(player, zoneIndex),
    def: effectiveDefense(player, zoneIndex),
  };
}

export function fieldTowerBand(player: PlayerState): NameBand | null {
  if (player.towerZone === null) {
    return null;
  }
  const current = effectiveTowerDefense(player);
  if (current === null) {
    return null;
  }
  return { kind: "tower", current, printed: player.towerZone.card.def };
}
