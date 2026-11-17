import { applyAction, getLegalActions } from "../domain/actions";
import type { Action } from "../domain/actions";
import type { Rng } from "../domain/rng";
import { opponentOf } from "../domain/state";
import type { BoardState, PlayerIndex } from "../domain/state";

export type BotLevel = "easy" | "normal";

export function chooseAction(
  state: BoardState,
  playerIndex: PlayerIndex,
  rng: Rng,
  level: BotLevel,
): Action | null {
  const legal = getLegalActions(state, playerIndex);
  if (legal.length === 0) {
    return null;
  }
  switch (level) {
    case "easy":
      return pick(preferred(legal), rng);
    case "normal":
      return chooseNormal(state, playerIndex, legal, rng);
    default: {
      const unexpected: never = level;
      throw new Error(`Nível inválido: ${String(unexpected)}.`);
    }
  }
}

export function playTurn(
  state: BoardState,
  playerIndex: PlayerIndex,
  rng: Rng,
  level: BotLevel,
): BoardState {
  let current = state;
  const phase = state.phase;
  for (let step = 0; step < 40; step += 1) {
    if (current.winner !== null || current.activePlayerIndex !== playerIndex || current.phase !== phase) {
      return current;
    }
    const action = chooseAction(current, playerIndex, rng, level);
    if (action === null) {
      return current;
    }
    const result = applyAction(current, playerIndex, action);
    if (!result.ok) {
      return current;
    }
    current = result.state;
  }
  return current;
}

function chooseNormal(
  state: BoardState,
  playerIndex: PlayerIndex,
  legal: readonly Action[],
  rng: Rng,
): Action {
  // PROVISÓRIO: a heurística não olha DEF, custo nem tags.
  const summon = strongestSummon(state, playerIndex, legal);
  if (summon !== null) {
    return summon;
  }
  const tower = legal.find((action) => action.type === "summonTower");
  if (tower !== undefined && state.players[playerIndex].towerZone === null) {
    return tower;
  }
  const biome = legal.find((action) => action.type === "playBiome");
  if (biome !== undefined && state.players[playerIndex].biomeZone === null) {
    return biome;
  }
  const spell = legal.find((action) => action.type === "setSpellTrap");
  if (spell !== undefined) {
    return spell;
  }
  const attack = bestAttack(state, playerIndex, legal);
  if (attack !== null) {
    return attack;
  }
  return legal.find((action) => action.type === "advancePhase") ?? pick(legal, rng);
}

function strongestSummon(
  state: BoardState,
  playerIndex: PlayerIndex,
  legal: readonly Action[],
): Action | null {
  let best: Action | null = null;
  let bestAtk = -1;
  for (const action of legal) {
    if (action.type !== "summonMonster") {
      continue;
    }
    const card = state.players[playerIndex].hand[action.handIndex];
    if (card?.kind === "monster" && action.position === "attack" && card.atk > bestAtk) {
      best = action;
      bestAtk = card.atk;
    }
  }
  return best;
}

function bestAttack(state: BoardState, playerIndex: PlayerIndex, legal: readonly Action[]): Action | null {
  const opponent = opponentOf(playerIndex);
  let winning: Action | null = null;
  let winningGap = 0;
  let safe: Action | null = null;
  let direct: Action | null = null;
  for (const action of legal) {
    if (action.type !== "attack") {
      continue;
    }
    const attacker = state.players[playerIndex].monsterZone[action.attackerZoneIndex];
    if (attacker === null || attacker === undefined) {
      continue;
    }
    const atk = attacker.card.atk;
    switch (action.target.kind) {
      case "monster": {
        const defender = state.players[opponent].monsterZone[action.target.zoneIndex];
        if (defender === null || defender === undefined) {
          break;
        }
        const defense = defender.position === "defense" ? defender.card.def : defender.card.atk;
        if (atk > defense && atk - defense > winningGap) {
          winning = action;
          winningGap = atk - defense;
        } else if (atk >= defense && safe === null) {
          safe = action;
        }
        break;
      }
      case "tower":
      case "player":
        direct ??= action;
        break;
      default: {
        const unexpected: never = action.target;
        throw new Error(`Alvo inválido: ${String(unexpected)}.`);
      }
    }
  }
  return winning ?? direct ?? safe;
}

function preferred(legal: readonly Action[]): readonly Action[] {
  const proactive = legal.filter((action) => action.type !== "advancePhase");
  return proactive.length > 0 ? proactive : legal;
}

function pick<T>(items: readonly T[], rng: Rng): T {
  const index = Math.min(items.length - 1, Math.max(0, Math.floor(rng.next() * items.length)));
  const item = items[index];
  if (item === undefined) {
    throw new Error("Não há ação para escolher.");
  }
  return item;
}
