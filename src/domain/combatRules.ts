import { hasImpeto } from "./effects";
import { ignoresMonsterBlock, towerDefense } from "./rules";
import { opponentOf } from "./state";
import type { BoardState, MonsterInstance, PlayerIndex } from "./state";

export type AttackTarget =
  | { readonly kind: "monster"; readonly zoneIndex: number }
  | { readonly kind: "tower" }
  | { readonly kind: "player" };

export function getLegalTargets(
  state: BoardState,
  playerIndex: PlayerIndex,
  attackerZoneIndex: number,
): readonly AttackTarget[] {
  const attacker = declaredAttacker(state, playerIndex, attackerZoneIndex);
  if (attacker === null) {
    return [];
  }
  const opponent = state.players[opponentOf(playerIndex)];
  const monsters = tauntTargets(opponent.monsterZone);
  if (monsters.length > 0) {
    const targets: AttackTarget[] = monsters.map((zoneIndex) => ({ kind: "monster", zoneIndex }));
    if (ignoresMonsterBlock(attacker) && opponent.towerZone !== null) {
      targets.push({ kind: "tower" });
    }
    return targets;
  }
  const open: AttackTarget[] = [];
  if (opponent.towerZone !== null) {
    open.push({ kind: "tower" });
  }
  open.push({ kind: "player" });
  return open;
}

export function canDeclareAttack(
  state: BoardState,
  playerIndex: PlayerIndex,
  attackerZoneIndex: number,
): boolean {
  return declaredAttacker(state, playerIndex, attackerZoneIndex) !== null;
}

export function skipsBattle(state: BoardState): boolean {
  return state.turn === 1 && state.activePlayerIndex === 0 && state.phase === "main1";
}

function declaredAttacker(
  state: BoardState,
  playerIndex: PlayerIndex,
  attackerZoneIndex: number,
): MonsterInstance | null {
  if (state.winner !== null || state.phase !== "battle" || playerIndex !== state.activePlayerIndex) {
    return null;
  }
  if (state.turn === 1 && playerIndex === 0) {
    return null;
  }
  const zone = state.players[playerIndex].monsterZone;
  if (!Number.isInteger(attackerZoneIndex) || attackerZoneIndex < 0 || attackerZoneIndex >= zone.length) {
    return null;
  }
  const monster = zone[attackerZoneIndex];
  if (monster === null || monster === undefined) {
    return null;
  }
  if (monster.position !== "attack" || monster.attackedThisTurn) {
    return null;
  }
  if (monster.summonedThisTurn && !hasImpeto(state.players[playerIndex], attackerZoneIndex)) {
    return null;
  }
  return monster;
}

function tauntTargets(zone: readonly (MonsterInstance | null)[]): number[] {
  const present: number[] = [];
  const taunts: number[] = [];
  zone.forEach((slot, zoneIndex) => {
    if (slot === null) {
      return;
    }
    present.push(zoneIndex);
    if (slot.position === "defense" && slot.card.keywords.includes("provocar")) {
      taunts.push(zoneIndex);
    }
  });
  return taunts.length > 0 ? taunts : present;
}

export function effectiveTowerDefense(state: BoardState, playerIndex: PlayerIndex): number | null {
  const tower = state.players[playerIndex].towerZone;
  if (tower === null) {
    return null;
  }
  return towerDefense(tower);
}
