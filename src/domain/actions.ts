import { canDeclareAttack, getLegalTargets, skipsBattle } from "./combatRules";
import type { AttackTarget } from "./combatRules";
import { nextPhase } from "./phases";
import { AGULHA_CARD_ID, combinations, hasKeyword, isMestico, materialsCoverParents, parentRaces, towerDefense, tributesRequired } from "./rules";
import { copyCard, opponentOf } from "./state";
import type {
  BattlePosition,
  BiomeCard,
  BoardState,
  Card,
  MonsterCard,
  MonsterInstance,
  Phase,
  PlayerIndex,
  PlayerState,
  SpellTrapCard,
  TowerInstance,
} from "./state";

export type Action =
  | { readonly type: "advancePhase" }
  | {
      readonly type: "summonMonster";
      readonly handIndex: number;
      readonly zoneIndex: number;
      readonly position: BattlePosition;
      readonly tributeZoneIndexes: readonly number[];
    }
  | { readonly type: "changePosition"; readonly zoneIndex: number }
  | { readonly type: "setSpellTrap"; readonly handIndex: number; readonly zoneIndex: number }
  | { readonly type: "summonTower"; readonly handIndex: number }
  | { readonly type: "playBiome"; readonly handIndex: number }
  | {
      readonly type: "converge";
      readonly lineageIndex: number;
      readonly zoneIndex: number;
      readonly position: BattlePosition;
      readonly materialZoneIndexes: readonly number[];
      readonly materialHandIndex?: number;
    }
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
  monsterZone: (MonsterInstance | null)[];
  spellTrapZone: (SpellTrapCard | null)[];
  towerZone: TowerInstance | null;
  biomeZone: BiomeCard | null;
  graveyard: Card[];
  limbo: Card[];
  towerSummonedThisTurn: boolean;
  normalSummonedThisTurn: boolean;
  lineageDeck: MonsterCard[];
  convergedThisTurn: boolean;
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
        if (!player.normalSummonedThisTurn) {
          actions.push(...listSummons(player, handIndex, card));
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
        if (!player.towerSummonedThisTurn) {
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

  if (state.config.enableConvergence) {
    actions.push(...listConvergence(player));
  }

  player.monsterZone.forEach((slot, zoneIndex) => {
    if (slot !== null && !slot.summonedThisTurn && !slot.attackedThisTurn && !slot.changedPositionThisTurn) {
      actions.push({ type: "changePosition", zoneIndex });
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
      return applySummonMonster(state, playerIndex, action);
    case "changePosition":
      return applyChangePosition(state, playerIndex, action.zoneIndex);
    case "setSpellTrap":
      return applySetSpellTrap(state, playerIndex, action.handIndex, action.zoneIndex);
    case "summonTower":
      return applySummonTower(state, playerIndex, action.handIndex);
    case "playBiome":
      return applyPlayBiome(state, playerIndex, action.handIndex);
    case "converge":
      return applyConverge(state, playerIndex, action);
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
  return success(commitBoard(state, replacePlayer(state.players, playerIndex, commitPlayer(draft))));
}

function applyAdvance(state: BoardState): ActionResult {
  const to = skipsBattle(state) ? "main2" : nextPhase(state.phase);
  if (state.phase !== "end") {
    return success(commitBoard(state, state.players, { phase: to }));
  }

  const endingIndex = state.activePlayerIndex;
  const ending = draftOf(state.players[endingIndex]);
  discardToHandLimit(ending, state.config.handLimit);
  ending.normalSummonedThisTurn = false;
  ending.towerSummonedThisTurn = false;
  ending.convergedThisTurn = false;
  ending.monsterZone = ending.monsterZone.map((slot) =>
    slot === null
      ? null
      : {
          ...slot,
          summonedThisTurn: false,
          changedPositionThisTurn: false,
          attackedThisTurn: false,
        },
  );
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

function applySummonMonster(state: BoardState, playerIndex: PlayerIndex, action: Extract<Action, { type: "summonMonster" }>): ActionResult {
  const phaseError = mainPhaseError(state.phase);
  if (phaseError !== null) {
    return failure(phaseError);
  }
  const player = state.players[playerIndex];
  const card = cardAt(player, action.handIndex);
  if (card === null) {
    return failure("Índice de carta inválido.");
  }
  if (card.kind !== "monster") {
    return failure("A carta escolhida não é um monstro.");
  }
  if (action.position !== "attack" && action.position !== "defense") {
    return failure("Posição de invocação inválida.");
  }
  if (!action.tributeZoneIndexes.includes(action.zoneIndex)) {
    const occupied = emptyZoneError(player.monsterZone, action.zoneIndex, "monstro");
    if (occupied !== null) {
      return failure(occupied);
    }
  }
  if (player.normalSummonedThisTurn) {
    return failure("Só é permitida uma invocação normal por turno.");
  }
  const tributeError = validateTributes(player, card, action.zoneIndex, action.tributeZoneIndexes);
  if (tributeError !== null) {
    return failure(tributeError);
  }

  const draft = draftOf(player);
  const summoned = copyCard(card);
  draft.hand = withoutIndex(draft.hand, action.handIndex);
  const zoneSlots = [...draft.monsterZone];
  for (const tribute of action.tributeZoneIndexes) {
    const tributeSlot = zoneSlots[tribute];
    if (tributeSlot === null || tributeSlot === undefined) {
      return failure("Tributo inválido.");
    }
    zoneSlots[tribute] = null;
    draft.limbo = [...draft.limbo, copyCard(tributeSlot.card)];
  }
  zoneSlots[action.zoneIndex] = {
    card: summoned,
    position: action.position,
    summonedThisTurn: true,
    changedPositionThisTurn: false,
    attackedThisTurn: false,
  };
  draft.monsterZone = zoneSlots;
  draft.normalSummonedThisTurn = true;
  return success(commitBoard(state, replacePlayer(state.players, playerIndex, commitPlayer(draft))));
}

function applyChangePosition(state: BoardState, playerIndex: PlayerIndex, zoneIndex: number): ActionResult {
  const phaseError = mainPhaseError(state.phase);
  if (phaseError !== null) {
    return failure(phaseError);
  }
  const slot = state.players[playerIndex].monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return failure("Não há monstro nessa zona.");
  }
  if (slot.summonedThisTurn || slot.attackedThisTurn || slot.changedPositionThisTurn) {
    return failure("Esse monstro não pode mudar de posição.");
  }
  const draft = draftOf(state.players[playerIndex]);
  const zone = [...draft.monsterZone];
  zone[zoneIndex] = {
    ...slot,
    position: slot.position === "attack" ? "defense" : "attack",
    changedPositionThisTurn: true,
  };
  draft.monsterZone = zone;
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

  const draft = draftOf(player);
  if (draft.towerZone !== null) {
    draft.limbo = [...draft.limbo, copyCard(draft.towerZone.card)];
  }
  draft.hand = withoutIndex(draft.hand, handIndex);
  draft.towerZone = { card: copyCard(card), defBonus: 0 };
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
    draft.limbo = [...draft.limbo, draft.biomeZone];
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
  markAttacked(attacker, attackerZoneIndex);

  switch (target.kind) {
    case "monster":
      resolveMonsterBattle(attacker, defender, attackerZoneIndex, target.zoneIndex);
      break;
    case "tower":
      resolveTowerAttack(attacker, defender, attackerZoneIndex);
      break;
    case "player":
      defender.hp -= attackerCard.card.atk;
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
  const attackerSlot = attacker.monsterZone[attackerZoneIndex];
  const defenderSlot = defender.monsterZone[defenderZoneIndex];
  if (attackerSlot === null || attackerSlot === undefined || defenderSlot === null || defenderSlot === undefined) {
    return;
  }
  const atk = attackerSlot.card.atk;
  const defense = defenderSlot.position === "defense" ? defenderSlot.card.def : defenderSlot.card.atk;
  if (atk === defense) {
    if (defenderSlot.position === "attack") {
      destroyMonster(attacker, attackerZoneIndex);
      destroyMonster(defender, defenderZoneIndex);
    }
    return;
  }
  if (atk > defense) {
    if (defenderSlot.position === "attack") {
      defender.hp -= atk - defense;
    } else if (hasKeyword(attackerSlot.card, "perfurar")) {
      defender.hp -= atk - defense;
    }
    destroyMonster(defender, defenderZoneIndex);
    return;
  }
  attacker.hp -= defense - atk;
  if (defenderSlot.position === "attack") {
    destroyMonster(attacker, attackerZoneIndex);
  }
}

function resolveTowerAttack(attacker: DraftPlayer, defender: DraftPlayer, attackerZoneIndex: number): void {
  const attackerSlot = attacker.monsterZone[attackerZoneIndex];
  if (attackerSlot === null || attackerSlot === undefined || defender.towerZone === null) {
    return;
  }
  const atk = attackerSlot.card.atk;
  const defense = towerDefense(defender.towerZone);
  if (atk > defense) {
    defender.limbo = [...defender.limbo, copyCard(defender.towerZone.card)];
    defender.towerZone = null;
    return;
  }
  if (atk < defense) {
    attacker.hp -= defense - atk;
  }
}

function destroyMonster(player: DraftPlayer, zoneIndex: number): void {
  const slot = player.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return;
  }
  const zone = [...player.monsterZone];
  zone[zoneIndex] = null;
  player.monsterZone = zone;
  if (isMestico(slot.card)) {
    player.limbo = [...player.limbo, slot.card];
    return;
  }
  player.graveyard = [...player.graveyard, slot.card];
}

function markAttacked(player: DraftPlayer, zoneIndex: number): void {
  const slot = player.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return;
  }
  const zone = [...player.monsterZone];
  zone[zoneIndex] = { ...slot, attackedThisTurn: true };
  player.monsterZone = zone;
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
  player.limbo = [...player.limbo, ...discarded];
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
    lineageDeck: [...player.lineageDeck],
    convergedThisTurn: player.convergedThisTurn,
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
    lineageDeck: draft.lineageDeck,
    convergedThisTurn: draft.convergedThisTurn,
  };
}

function applyConverge(
  state: BoardState,
  playerIndex: PlayerIndex,
  action: Extract<Action, { type: "converge" }>,
): ActionResult {
  if (!state.config.enableConvergence) {
    return failure("Convergência está desligada.");
  }
  const phaseError = mainPhaseError(state.phase);
  if (phaseError !== null) {
    return failure(phaseError);
  }
  const player = state.players[playerIndex];
  if (player.convergedThisTurn) {
    return failure("Só é permitida uma Convergência por turno.");
  }
  const mestico = player.lineageDeck[action.lineageIndex];
  if (mestico === undefined || !isMestico(mestico)) {
    return failure("O Deck de Linhagem não tem esse Mestiço.");
  }
  if (action.position !== "attack" && action.position !== "defense") {
    return failure("Posição de invocação inválida.");
  }
  const materials = readConvergenceMaterials(player, mestico, action);
  if (!materials.ok) {
    return failure(materials.error);
  }

  const draft = draftOf(player);
  const zoneSlots = [...draft.monsterZone];
  for (const zoneIndex of materials.zoneIndexes) {
    const slot = zoneSlots[zoneIndex];
    if (slot === null || slot === undefined) {
      return failure("Material de Convergência inválido.");
    }
    zoneSlots[zoneIndex] = null;
    draft.limbo = [...draft.limbo, copyCard(slot.card)];
  }
  if (materials.handIndex !== null) {
    const handCard = draft.hand[materials.handIndex];
    if (handCard === undefined || handCard.kind !== "monster") {
      return failure("Material de Convergência inválido.");
    }
    draft.hand = withoutIndex(draft.hand, materials.handIndex);
    draft.limbo = [...draft.limbo, copyCard(handCard)];
  }
  zoneSlots[action.zoneIndex] = {
    card: copyCard(mestico),
    position: action.position,
    summonedThisTurn: true,
    changedPositionThisTurn: false,
    attackedThisTurn: false,
  };
  draft.monsterZone = zoneSlots;
  draft.lineageDeck = withoutIndex(draft.lineageDeck, action.lineageIndex);
  draft.convergedThisTurn = true;
  return success(commitBoard(state, replacePlayer(state.players, playerIndex, commitPlayer(draft))));
}

function readConvergenceMaterials(
  player: PlayerState,
  mestico: MonsterCard,
  action: Extract<Action, { type: "converge" }>,
): { ok: true; zoneIndexes: readonly number[]; handIndex: number | null } | { ok: false; error: string } {
  const handIndex = action.materialHandIndex ?? null;
  const zoneIndexes = action.materialZoneIndexes;
  const fromHand = handIndex !== null;
  if (fromHand && !hasAgulha(player)) {
    return { ok: false, error: "Sem a Agulha da Convergência, os dois materiais vêm do campo." };
  }
  if (zoneIndexes.length !== (fromHand ? 1 : 2) || new Set(zoneIndexes).size !== zoneIndexes.length) {
    return { ok: false, error: "Convergência exige dois materiais, um de cada Raça matriz." };
  }
  const races: string[][] = [];
  for (const zoneIndex of zoneIndexes) {
    const slot = player.monsterZone[zoneIndex];
    if (slot === null || slot === undefined) {
      return { ok: false, error: "Material de Convergência inválido." };
    }
    races.push([...parentRaces(slot.card)]);
  }
  if (handIndex !== null) {
    const handCard = cardAt(player, handIndex);
    if (handCard === null || handCard.kind !== "monster") {
      return { ok: false, error: "Material de Convergência inválido." };
    }
    races.push([...parentRaces(handCard)]);
  }
  if (!materialsCoverParents(parentRaces(mestico), races)) {
    return { ok: false, error: "Os materiais precisam ser um de cada Raça matriz." };
  }
  const occupied = emptyZoneError(player.monsterZone, action.zoneIndex, "monstro");
  if (occupied !== null && !zoneIndexes.includes(action.zoneIndex)) {
    return { ok: false, error: occupied };
  }
  return { ok: true, zoneIndexes, handIndex };
}

function hasAgulha(player: PlayerState): boolean {
  return player.towerZone?.card.id === AGULHA_CARD_ID;
}

function listConvergence(player: PlayerState): Action[] {
  if (player.convergedThisTurn) {
    return [];
  }
  const actions: Action[] = [];
  const agulha = hasAgulha(player);
  player.lineageDeck.forEach((card, lineageIndex) => {
    if (!isMestico(card)) {
      return;
    }
    const parents = parentRaces(card);
    const field = player.monsterZone.flatMap((slot, index) =>
      slot === null ? [] : [{ index, races: parentRaces(slot.card) }],
    );
    for (let left = 0; left < field.length; left += 1) {
      for (let right = left + 1; right < field.length; right += 1) {
        const first = field[left];
        const second = field[right];
        if (first === undefined || second === undefined) {
          continue;
        }
        if (!materialsCoverParents(parents, [first.races, second.races])) {
          continue;
        }
        pushConvergence(player, actions, lineageIndex, [first.index, second.index]);
      }
    }
    if (!agulha) {
      return;
    }
    player.hand.forEach((handCard, handIndex) => {
      if (handCard.kind !== "monster") {
        return;
      }
      const handRaces = parentRaces(handCard);
      for (const material of field) {
        if (!materialsCoverParents(parents, [material.races, handRaces])) {
          continue;
        }
        pushConvergence(player, actions, lineageIndex, [material.index], handIndex);
      }
    });
  });
  return actions;
}

function pushConvergence(
  player: PlayerState,
  actions: Action[],
  lineageIndex: number,
  materialZoneIndexes: readonly number[],
  materialHandIndex?: number,
): void {
  const vacated = new Set(materialZoneIndexes);
  player.monsterZone.forEach((slot, zoneIndex) => {
    if (slot !== null && !vacated.has(zoneIndex)) {
      return;
    }
    for (const position of ["attack", "defense"] as const) {
      actions.push({
        type: "converge",
        lineageIndex,
        zoneIndex,
        position,
        materialZoneIndexes,
        ...(materialHandIndex !== undefined ? { materialHandIndex } : {}),
      });
    }
  });
}

function listSummons(player: PlayerState, handIndex: number, card: MonsterCard): Action[] {
  const needed = tributesRequired(card.level);
  const occupied = player.monsterZone.flatMap((slot, index) => (slot === null ? [] : [index]));
  const actions: Action[] = [];
  for (const tributeZoneIndexes of combinations(occupied, needed)) {
    const tributeSet = new Set(tributeZoneIndexes);
    player.monsterZone.forEach((slot, zoneIndex) => {
      if (slot !== null && !tributeSet.has(zoneIndex)) {
        return;
      }
      for (const position of ["attack", "defense"] as const) {
        actions.push({ type: "summonMonster", handIndex, zoneIndex, position, tributeZoneIndexes });
      }
    });
  }
  return actions;
}

function validateTributes(
  player: PlayerState,
  card: MonsterCard,
  zoneIndex: number,
  tributes: readonly number[],
): string | null {
  const needed = tributesRequired(card.level);
  if (tributes.length !== needed || new Set(tributes).size !== tributes.length) {
    return "Tributos insuficientes para o nível do monstro.";
  }
  for (const tribute of tributes) {
    if (!Number.isInteger(tribute) || tribute < 0 || tribute >= player.monsterZone.length || player.monsterZone[tribute] === null) {
      return "Tributo inválido.";
    }
  }
  const zone = emptyZoneError(player.monsterZone, zoneIndex, "monstro");
  if (zone !== null && !tributes.includes(zoneIndex)) {
    return zone;
  }
  if (zone !== null && tributes.includes(zoneIndex)) {
    return null;
  }
  return zone;
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
