import { opponentOf } from "./state";
import type { BoardState, PlayerIndex } from "./state";

export type AttackTarget =
  | { readonly kind: "monster"; readonly zoneIndex: number }
  | { readonly kind: "tower" }
  | { readonly kind: "player" };

/**
 * PROVISÓRIO: se o oponente controla monstro, só esses monstros são alvos.
 * Sem monstro, a Torre (se existir) e o jogador podem ser atacados.
 * Defesa fica para depois: todo monstro está em posição de ataque.
 */
export function getLegalTargets(
  state: BoardState,
  playerIndex: PlayerIndex,
  attackerZoneIndex: number,
): readonly AttackTarget[] {
  if (!canDeclareAttack(state, playerIndex, attackerZoneIndex)) {
    return [];
  }
  const opponent = state.players[opponentOf(playerIndex)];
  const monsters: AttackTarget[] = [];
  opponent.monsterZone.forEach((slot, zoneIndex) => {
    if (slot !== null) {
      monsters.push({ kind: "monster", zoneIndex });
    }
  });
  if (monsters.length > 0) {
    return monsters;
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
  if (state.winner !== null || state.phase !== "battle" || playerIndex !== state.activePlayerIndex) {
    return false;
  }
  if (state.turn === 1 && playerIndex === 0) {
    return false;
  }
  const attacker = state.players[playerIndex];
  if (!Number.isInteger(attackerZoneIndex) || attackerZoneIndex < 0 || attackerZoneIndex >= attacker.monsterZone.length) {
    return false;
  }
  if (attacker.monsterZone[attackerZoneIndex] === null) {
    return false;
  }
  return attacker.attackedThisTurn[attackerZoneIndex] !== true;
}
