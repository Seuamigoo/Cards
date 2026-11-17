import { canDeclareAttack, getLegalTargets } from "./combatRules";
import type { AttackTarget } from "./combatRules";
import { nextPhase } from "./phases";
import { copyCard, opponentOf } from "./state";
import type {
  BiomeCard,
  BoardState,
  Card,
  MonsterCard,
  Phase,
  PlayerIndex,
  PlayerState,
  SpellTrapCard,
  TowerCard,
  TowerInstance,
} from "./state";

export type Action =
  | { readonly type: "advancePhase" }
  | { readonly type: "summonMonster"; readonly handIndex: number; readonly zoneIndex: number }
  | { readonly type: "setSpellTrap"; readonly handIndex: number; readonly zoneIndex: number }
  | { readonly type: "summonTower"; readonly handIndex: number }
  | { readonly type: "playBiome"; readonly handIndex: number }
  | {
      readonly type: "attack";
      readonly attackerZoneIndex: number;
      readonly target: AttackTarget;
    };

export type ActionResult =
  | { readonly ok: true; readonly state: BoardState }
  | { readonly ok: false; readonly error: string };

interface DraftPlayer {
  id: string;
  hp: number;
  hand: Card[];
  deck: Card[];
  monsterZone: (MonsterCard | null)[];
  spellTrapZone: (SpellTrapCard | null)[];
  towerZone: TowerInstance | null;
  biomeZone: BiomeCard | null;
  graveyard: Card[];
  limbo: TowerCard[];
  towerSummonedThisTurn: boolean;
  normalSummonedThisTurn: boolean;
  attackedThisTurn: boolean[];
}

export function getLegalActions(state: BoardState, playerIndex: PlayerIndex): readonly Action[] {
  if (state.winner !== null || playerIndex !== state.activePlayerIndex) {
    return [];
  }

  const actions: Action[] = [{ type: "advancePhase" }];
  if (state.phase === "battle") {
    state.players[playerIndex].monsterZone.forEach((slot, zoneIndex) => {
      if (slot === null) {
        return;
      }
      for (const target of getLegalTargets(state, playerIndex, zoneIndex)) {
        actions.push({ type: "attack", attackerZoneIndex: zoneIndex, target });
      }
    });
    return actions;
  }
  if (!isMainPhase(state.phase)) {
    return actions;
  }

  const player = state.players[playerIndex];
  player.hand.forEach((card, handIndex) => {
    switch (card.kind) {
      case "monster":
        // PROVISÓRIO: uma invocação normal por turno; custo e tags Raça×Classe vêm depois.
        if (!player.normalSummonedThisTurn) {
          player.monsterZone.forEach((slot, zoneIndex) => {
            if (slot === null) {
              actions.push({ type: "summonMonster", handIndex, zoneIndex });
            }
          });
        }
        return;
      case "spell":
      case "trap":
        player.spellTrapZone.forEach((slot, zoneIndex) => {
          if (slot === null) {
            actions.push({ type: "setSpellTrap", handIndex, zoneIndex });
          }
        });
        return;
      case "tower":
        // PROVISÓRIO: no máximo uma Torre por turno, e só com a zona vazia.
        if (player.towerZone === null && !player.towerSummonedThisTurn) {
          actions.push({ type: "summonTower", handIndex });
        }
        return;
      case "biome":
        actions.push({ type: "playBiome", handIndex });
        return;
      default: {
        const unexpected: never = card;
        throw new Error(`Carta inválida: ${String(unexpected)}.`);
      }
    }
  });

  return actions;
}

export function applyAction(
  state: BoardState,
  playerIndex: PlayerIndex,
  action: Action,
): ActionResult {
  if (state.winner !== null) {
    return failure("A partida já terminou.");
  }
  if (playerIndex !== state.activePlayerIndex) {
    return failure("Só o jogador ativo pode agir.");
  }

  switch (action.type) {
    case "advancePhase":
      return applyAdvance(state);
    case "summonMonster":
      return applySummonMonster(state, playerIndex, action.handIndex, action.zoneIndex);
    case "setSpellTrap":
      return applySetSpellTrap(state, playerIndex, action.handIndex, action.zoneIndex);
    case "summonTower":
      return applySummonTower(state, playerIndex, action.handIndex);
    case "playBiome":
      return applyPlayBiome(state, playerIndex, action.handIndex);
    case "attack":
      return applyAttack(state, playerIndex, action.attackerZoneIndex, action.target);
    default: {
      const unexpected: never = action;
      throw new Error(`Ação inválida: ${String(unexpected)}.`);
    }
  }
}

export function destroyTower(state: BoardState, playerIndex: PlayerIndex): ActionResult {
  if (state.winner !== null) {
    return failure("A partida já terminou.");
  }
  const current = state.players[playerIndex].towerZone;
  if (current === null) {
    return failure("Não há Torre para destruir.");
  }

  const draft = draftOf(state.players[playerIndex]);
  draft.limbo = [...draft.limbo, copyCard(current.card)];
  draft.towerZone = null;
  // PROVISÓRIO: destruir a Torre libera outra invocação de Torre neste turno.
  draft.towerSummonedThisTurn = false;
  return success(commitBoard(state, replacePlayer(state.players, playerIndex, commitPlayer(draft))));
}

function applyAdvance(state: BoardState): ActionResult {
  const to = nextPhase(state.phase);
  if (state.phase !== "end") {
    return success(commitBoard(state, state.players, { phase: to }));
  }

  const endingIndex = state.activePlayerIndex;
  const ending = draftOf(state.players[endingIndex]);
  discardToHandLimit(ending, state.config.handLimit);
  ending.normalSummonedThisTurn = false;
  ending.towerSummonedThisTurn = false;
  ending.attackedThisTurn = ending.monsterZone.map(() => false);
  let players = replacePlayer(state.players, endingIndex, commitPlayer(ending));

  const nextIndex = opponentOf(endingIndex);
  const nextTurn = state.turn + 1;
  let winner: PlayerIndex | null = null;
  if (!skipsDrawStep(nextTurn, nextIndex)) {
    const drawing = draftOf(players[nextIndex]);
    const drawn = drawTop(drawing);
    if (!drawn.ok) {
      winner = opponentOf(nextIndex);
    }
    players = replacePlayer(players, nextIndex, commitPlayer(drawing));
  }

  return success(
    commitBoard(state, players, {
      turn: nextTurn,
      activePlayerIndex: nextIndex,
      phase: to,
      winner,
    }),
  );
}

function applySummonMonster(
  state: BoardState,
  playerIndex: PlayerIndex,
  handIndex: number,
  zoneIndex: number,
): ActionResult {
  const phaseError = mainPhaseError(state.phase);
  if (phaseError !== null) {
    return failure(phaseError);
  }
  const player = state.players[playerIndex];
  const card = cardAt(player, handIndex);
  if (card === null) {
    return failure("Índice de carta inválido.");
  }
  if (card.kind !== "monster") {
    return failure("A carta escolhida não é um monstro.");
  }
  const zone = emptyZoneError(player.monsterZone, zoneIndex, "monstro");
  if (zone !== null) {
    return failure(zone);
  }
  // PROVISÓRIO: uma invocação normal por turno; custo e tags Raça×Classe vêm depois.
  if (player.normalSummonedThisTurn) {
    return failure("Só é permitida uma invocação normal por turno.");
  }

  const draft = draftOf(player);
  const summoned = copyCard(card);
  draft.hand = withoutIndex(draft.hand, handIndex);
  const zoneSlots = [...draft.monsterZone];
  zoneSlots[zoneIndex] = summoned;
  draft.monsterZone = zoneSlots;
  draft.normalSummonedThisTurn = true;
  return success(commitBoard(state, replacePlayer(state.players, playerIndex, commitPlayer(draft))));
}

function applySetSpellTrap(
  state: BoardState,
  playerIndex: PlayerIndex,
  handIndex: number,
  zoneIndex: number,
): ActionResult {
  const phaseError = mainPhaseError(state.phase);
  if (phaseError !== null) {
    return failure(phaseError);
  }
  const player = state.players[playerIndex];
  const card = cardAt(player, handIndex);
  if (card === null) {
    return failure("Índice de carta inválido.");
  }
  if (card.kind !== "spell" && card.kind !== "trap") {
    return failure("A carta escolhida não é magia nem armadilha.");
  }
  const zone = emptyZoneError(player.spellTrapZone, zoneIndex, "magia/armadilha");
  if (zone !== null) {
    return failure(zone);
  }

  const draft = draftOf(player);
  const setCard = copyCard(card);
  draft.hand = withoutIndex(draft.hand, handIndex);
  const zoneSlots = [...draft.spellTrapZone];
  zoneSlots[zoneIndex] = setCard;
  draft.spellTrapZone = zoneSlots;
  return success(commitBoard(state, replacePlayer(state.players, playerIndex, commitPlayer(draft))));
}

function applySummonTower(
  state: BoardState,
  playerIndex: PlayerIndex,
  handIndex: number,
): ActionResult {
  const phaseError = mainPhaseError(state.phase);
  if (phaseError !== null) {
    return failure(phaseError);
  }
  const player = state.players[playerIndex];
  if (player.towerZone !== null) {
    return failure("A zona de Torre está ocupada.");
  }
  // PROVISÓRIO: no máximo uma Torre por turno, e só com a zona vazia.
  if (player.towerSummonedThisTurn) {
    return failure("Só é permitida uma Torre por turno.");
  }
  const card = cardAt(player, handIndex);
  if (card === null) {
    return failure("Índice de carta inválido.");
  }
  if (card.kind !== "tower") {
    return failure("A carta escolhida não é uma Torre.");
  }

  const hp = card.hp ?? state.config.defaultTowerHp;
  const draft = draftOf(player);
  draft.hand = withoutIndex(draft.hand, handIndex);
  draft.towerZone = { card: copyCard(card), hp, maxHp: hp };
  draft.towerSummonedThisTurn = true;
  return success(commitBoard(state, replacePlayer(state.players, playerIndex, commitPlayer(draft))));
}

function applyPlayBiome(
  state: BoardState,
  playerIndex: PlayerIndex,
  handIndex: number,
): ActionResult {
  const phaseError = mainPhaseError(state.phase);
  if (phaseError !== null) {
    return failure(phaseError);
  }
  const player = state.players[playerIndex];
  const card = cardAt(player, handIndex);
  if (card === null) {
    return failure("Índice de carta inválido.");
  }
  if (card.kind !== "biome") {
    return failure("A carta escolhida não é um Bioma.");
  }

  const draft = draftOf(player);
  if (draft.biomeZone !== null) {
    draft.graveyard = [...draft.graveyard, draft.biomeZone];
  }
  draft.hand = withoutIndex(draft.hand, handIndex);
  draft.biomeZone = copyCard(card);
  return success(commitBoard(state, replacePlayer(state.players, playerIndex, commitPlayer(draft))));
}

function applyAttack(
  state: BoardState,
  playerIndex: PlayerIndex,
  attackerZoneIndex: number,
  target: AttackTarget,
): ActionResult {
  if (state.phase !== "battle") {
    return failure("Ataques só são permitidos na fase battle.");
  }
  if (!canDeclareAttack(state, playerIndex, attackerZoneIndex)) {
    return failure("Este monstro não pode atacar.");
  }
  const allowed = getLegalTargets(state, playerIndex, attackerZoneIndex);
  if (!allowed.some((candidate) => sameTarget(candidate, target))) {
    return failure("Alvo de ataque inválido.");
  }
  const attackerCard = state.players[playerIndex].monsterZone[attackerZoneIndex];
  if (attackerCard === null || attackerCard === undefined) {
    return failure("Este monstro não pode atacar.");
  }

  const opponentIndex = opponentOf(playerIndex);
  const attacker = draftOf(state.players[playerIndex]);
  const defender = draftOf(state.players[opponentIndex]);
  attacker.attackedThisTurn[attackerZoneIndex] = true;

  switch (target.kind) {
    case "monster":
      resolveMonsterBattle(attacker, defender, attackerZoneIndex, target.zoneIndex);
      break;
    case "tower":
      resolveTowerAttack(attackerCard.atk, defender);
      break;
    case "player":
      defender.hp -= attackerCard.atk;
      break;
    default: {
      const unexpected: never = target;
      throw new Error(`Alvo inválido: ${String(unexpected)}.`);
    }
  }

  let winner = state.winner;
  if (attacker.hp <= 0 || defender.hp <= 0) {
    winner = attacker.hp <= 0 && defender.hp > 0 ? opponentIndex : playerIndex;
  }
  return success(
    commitBoard(state, replacePlayer(replacePlayer(state.players, playerIndex, commitPlayer(attacker)), opponentIndex, commitPlayer(defender)), {
      winner,
    }),
  );
}

function resolveMonsterBattle(
  attacker: DraftPlayer,
  defender: DraftPlayer,
  attackerZoneIndex: number,
  defenderZoneIndex: number,
): void {
  const attackerCard = attacker.monsterZone[attackerZoneIndex];
  const defenderCard = defender.monsterZone[defenderZoneIndex];
  if (attackerCard === null || attackerCard === undefined || defenderCard === null || defenderCard === undefined) {
    return;
  }
  if (attackerCard.atk === defenderCard.atk) {
    destroyMonster(attacker, attackerZoneIndex);
    destroyMonster(defender, defenderZoneIndex);
    return;
  }
  if (attackerCard.atk > defenderCard.atk) {
    defender.hp -= attackerCard.atk - defenderCard.atk;
    destroyMonster(defender, defenderZoneIndex);
    return;
  }
  attacker.hp -= defenderCard.atk - attackerCard.atk;
  destroyMonster(attacker, attackerZoneIndex);
}

function resolveTowerAttack(atk: number, defender: DraftPlayer): void {
  if (defender.towerZone === null) {
    return;
  }
  const nextHp = defender.towerZone.hp - atk;
  if (nextHp <= 0) {
    defender.limbo = [...defender.limbo, copyCard(defender.towerZone.card)];
    defender.towerZone = null;
    // PROVISÓRIO: destruir a Torre libera outra invocação de Torre neste turno.
    defender.towerSummonedThisTurn = false;
    return;
  }
  defender.towerZone = { ...defender.towerZone, hp: nextHp };
}

function destroyMonster(player: DraftPlayer, zoneIndex: number): void {
  const card = player.monsterZone[zoneIndex];
  if (card === null || card === undefined) {
    return;
  }
  const zone = [...player.monsterZone];
  zone[zoneIndex] = null;
  player.monsterZone = zone;
  player.graveyard = [...player.graveyard, card];
}

function sameTarget(left: AttackTarget, right: AttackTarget): boolean {
  switch (left.kind) {
    case "monster":
      return right.kind === "monster" && right.zoneIndex === left.zoneIndex;
    case "tower":
      return right.kind === "tower";
    case "player":
      return right.kind === "player";
    default: {
      const unexpected: never = left;
      throw new Error(`Alvo inválido: ${String(unexpected)}.`);
    }
  }
}

function skipsDrawStep(turn: number, playerIndex: PlayerIndex): boolean {
  return turn === 1 && playerIndex === 0;
}

function discardToHandLimit(player: DraftPlayer, handLimit: number): void {
  if (player.hand.length <= handLimit) {
    return;
  }
  const kept = player.hand.slice(0, handLimit);
  const discarded = player.hand.slice(handLimit);
  player.hand = kept;
  player.graveyard = [...player.graveyard, ...discarded];
}

function drawTop(player: DraftPlayer): { ok: true; card: Card } | { ok: false } {
  const top = player.deck[player.deck.length - 1];
  if (top === undefined) {
    return { ok: false };
  }
  player.deck = player.deck.slice(0, -1);
  player.hand = [...player.hand, top];
  return { ok: true, card: top };
}

function mainPhaseError(phase: Phase): string | null {
  if (isMainPhase(phase)) {
    return null;
  }
  return "Invocações e posicionamentos só são permitidos em main1 ou main2.";
}

function isMainPhase(phase: Phase): boolean {
  switch (phase) {
    case "main1":
    case "main2":
      return true;
    case "draw":
    case "battle":
    case "end":
      return false;
    default: {
      const unexpected: never = phase;
      throw new Error(`Fase inválida: ${String(unexpected)}.`);
    }
  }
}

function cardAt(player: PlayerState, handIndex: number): Card | null {
  if (!Number.isInteger(handIndex) || handIndex < 0 || handIndex >= player.hand.length) {
    return null;
  }
  return player.hand[handIndex] ?? null;
}

function emptyZoneError(
  zone: readonly unknown[],
  zoneIndex: number,
  label: string,
): string | null {
  if (!Number.isInteger(zoneIndex) || zoneIndex < 0 || zoneIndex >= zone.length) {
    return "Índice de zona inválido.";
  }
  if (zone[zoneIndex] !== null) {
    return `A zona de ${label} está ocupada.`;
  }
  return null;
}

function withoutIndex<T>(items: readonly T[], index: number): T[] {
  return [...items.slice(0, index), ...items.slice(index + 1)];
}

function draftOf(player: PlayerState): DraftPlayer {
  return {
    id: player.id,
    hp: player.hp,
    hand: [...player.hand],
    deck: [...player.deck],
    monsterZone: [...player.monsterZone],
    spellTrapZone: [...player.spellTrapZone],
    towerZone: player.towerZone,
    biomeZone: player.biomeZone,
    graveyard: [...player.graveyard],
    limbo: [...player.limbo],
    towerSummonedThisTurn: player.towerSummonedThisTurn,
    normalSummonedThisTurn: player.normalSummonedThisTurn,
    attackedThisTurn: [...player.attackedThisTurn],
  };
}

function commitPlayer(draft: DraftPlayer): PlayerState {
  return {
    id: draft.id,
    hp: draft.hp,
    hand: draft.hand,
    deck: draft.deck,
    monsterZone: draft.monsterZone,
    spellTrapZone: draft.spellTrapZone,
    towerZone: draft.towerZone,
    biomeZone: draft.biomeZone,
    graveyard: draft.graveyard,
    limbo: draft.limbo,
    towerSummonedThisTurn: draft.towerSummonedThisTurn,
    normalSummonedThisTurn: draft.normalSummonedThisTurn,
    attackedThisTurn: draft.attackedThisTurn,
  };
}

function replacePlayer(
  players: readonly [PlayerState, PlayerState],
  index: PlayerIndex,
  player: PlayerState,
): readonly [PlayerState, PlayerState] {
  switch (index) {
    case 0:
      return [player, players[1]];
    case 1:
      return [players[0], player];
    default: {
      const unexpected: never = index;
      throw new Error(`Índice de jogador inválido: ${String(unexpected)}.`);
    }
  }
}

function commitBoard(
  state: BoardState,
  players: readonly [PlayerState, PlayerState],
  patch: {
    readonly turn?: number;
    readonly activePlayerIndex?: PlayerIndex;
    readonly phase?: Phase;
    readonly winner?: PlayerIndex | null;
  } = {},
): BoardState {
  return Object.freeze({
    config: state.config,
    players: freezePair(players[0], players[1]),
    turn: patch.turn ?? state.turn,
    activePlayerIndex: patch.activePlayerIndex ?? state.activePlayerIndex,
    phase: patch.phase ?? state.phase,
    winner: patch.winner === undefined ? state.winner : patch.winner,
  });
}

function freezePair(first: PlayerState, second: PlayerState): readonly [PlayerState, PlayerState] {
  return Object.freeze([first, second]) as readonly [PlayerState, PlayerState];
}

function success(state: BoardState): ActionResult {
  return { ok: true, state: sealPlayers(state) };
}

function sealPlayers(state: BoardState): BoardState {
  return Object.freeze({
    ...state,
    players: freezePair(sealDraftPlayer(state.players[0]), sealDraftPlayer(state.players[1])),
  });
}

function sealDraftPlayer(player: PlayerState): PlayerState {
  return Object.freeze({
    ...player,
    hand: Object.freeze([...player.hand]),
    deck: Object.freeze([...player.deck]),
    monsterZone: Object.freeze([...player.monsterZone]),
    spellTrapZone: Object.freeze([...player.spellTrapZone]),
    towerZone: player.towerZone === null ? null : Object.freeze({ ...player.towerZone }),
    graveyard: Object.freeze([...player.graveyard]),
    limbo: Object.freeze([...player.limbo]),
  });
}

function failure(error: string): ActionResult {
  return { ok: false, error };
}
