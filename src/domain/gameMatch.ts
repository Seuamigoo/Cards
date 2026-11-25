import { applyAction, destroyTower as destroyTowerState } from "./actions";
import { scriptOf } from "./cardScripts";
import { effectiveAttack, effectiveDefense } from "./effects";
import type { CardOrigin } from "./eventBus";
import { hasKeyword } from "./rules";
import type { Action, ActionResult } from "./actions";
import { resolveConfig } from "./config";
import type { GameConfig, GameMode } from "./config";
import { EventBus } from "./eventBus";
import { nextPhase } from "./phases";
import { createSeededRng } from "./rng";
import type { Rng } from "./rng";
import type { AttackTarget } from "./combatRules";
import { cloneBoardState, createInitialState, opponentOf } from "./state";
import type { BoardState, Card, MonsterCard, PlayerIndex, PlayerState } from "./state";

export interface MatchSetup {
  readonly decks: readonly [readonly Card[], readonly Card[]];
  readonly lineageDecks?: readonly [readonly MonsterCard[], readonly MonsterCard[]];
  readonly rng?: Rng;
  readonly seed?: number;
}

export class GameMatch {
  readonly events = new EventBus();

  private state: BoardState;

  private cardRules: boolean;

  constructor(
    mode: GameMode,
    playerIds: readonly [string, string],
    overrides?: Partial<Omit<GameConfig, "mode">>,
    setup?: MatchSetup,
  ) {
    const config = resolveConfig(mode, overrides);
    this.cardRules = setup !== undefined;
    this.state = createInitialState(config, playerIds, setup?.decks, rngFrom(setup), setup?.lineageDecks);
    if (this.state.winner !== null) {
      this.events.emit("game:over", { winner: this.state.winner, reason: "deck_out" });
    }
  }

  static fromState(state: BoardState): GameMatch {
    const match = new GameMatch(state.config.mode, [
      state.players[0].id,
      state.players[1].id,
    ]);
    match.state = cloneBoardState(state);
    match.cardRules = true;
    return match;
  }

  getState(): BoardState {
    return this.state;
  }

  advancePhase(): BoardState {
    // Sem decks, a partida continua só no ciclo de fases já coberto pelos testes iniciais.
    if (!this.cardRules) {
      return this.advancePhaseLegacy();
    }
    const result = this.dispatch({ type: "advancePhase" });
    if (!result.ok) {
      return this.state;
    }
    return result.state;
  }

  dispatch(action: Action): ActionResult {
    const before = this.state;
    const result = applyAction(before, before.activePlayerIndex, action);
    if (!result.ok) {
      return result;
    }
    this.state = result.state;
    this.publish(before, result.state, action);
    return result;
  }

  destroyTower(playerIndex: PlayerIndex): ActionResult {
    const before = this.state;
    const result = destroyTowerState(before, playerIndex);
    if (!result.ok) {
      return result;
    }
    this.state = result.state;
    const tower = before.players[playerIndex].towerZone;
    if (tower !== null) {
      this.events.emit("tower:destroyed", {
        playerIndex,
        card: tower.card,
        def: tower.card.def + tower.defBonus + (tower.tempDef ?? 0),
        instanceId: tower.card.instanceId ?? "",
        cardId: tower.card.id,
      });
      this.publishSentCards(before, result.state);
    }
    return result;
  }

  private advancePhaseLegacy(): BoardState {
    const previous = this.state;
    const to = nextPhase(previous.phase);
    const turnAdvanced = previous.phase === "end";
    const turn = turnAdvanced ? previous.turn + 1 : previous.turn;
    const activePlayerIndex = turnAdvanced
      ? opponentOf(previous.activePlayerIndex)
      : previous.activePlayerIndex;

    const next: BoardState = Object.freeze({
      config: previous.config,
      players: previous.players,
      turn,
      activePlayerIndex,
      phase: to,
      winner: previous.winner,
    });
    this.state = next;

    this.events.emit("phase:changed", {
      from: previous.phase,
      to,
      turn,
      activePlayerIndex,
    });
    if (turnAdvanced) {
      this.events.emit("turn:started", {
        turn,
        activePlayerIndex,
      });
    }
    return next;
  }

  private publish(before: BoardState, after: BoardState, action: Action): void {
    switch (action.type) {
      case "advancePhase":
        this.publishPhase(before, after);
        return;
      case "summonMonster":
        this.publishSentCards(before, after);
        this.publishMonster(after, action.zoneIndex);
        this.publishEnteredEffects(after, before.activePlayerIndex, action.zoneIndex);
        this.publishStatDamage(before, after, "effect");
        this.publishPlayerDamage(before, after, "effect");
        this.publishGameOver(before, after, "player_hp");
        return;
      case "setSpellTrap":
        this.publishSpellTrap(before, after);
        return;
      case "summonTower":
        this.publishTowerReplacement(before, after);
        this.publishSentCards(before, after, ["tower"]);
        this.publishTowerSummon(after);
        this.publishTowerAura(after);
        return;
      case "playBiome":
        this.publishBiome(before, after);
        return;
      case "changePosition":
        this.publishPosition(before, after);
        return;
      case "converge":
        this.publishSentCards(before, after);
        this.publishMonster(after, action.zoneIndex);
        this.publishEnteredEffects(after, before.activePlayerIndex, action.zoneIndex);
        return;
      case "fuseBrasa":
        this.publishMonster(after, action.zoneIndex);
        this.publishFusion(after, action);
        return;
      case "activate":
        this.publishActivate(after, action.zoneIndex);
        return;
      case "attack":
        this.publishAttack(before, after, action.attackerZoneIndex, action.target);
        return;
      default: {
        const unexpected: never = action;
        throw new Error(`Ação inválida: ${String(unexpected)}.`);
      }
    }
  }

  private publishPhase(before: BoardState, after: BoardState): void {
    this.events.emit("phase:changed", {
      from: before.phase,
      to: after.phase,
      turn: after.turn,
      activePlayerIndex: after.activePlayerIndex,
    });
    this.publishSentCards(before, after);
    if (after.turn !== before.turn) {
      this.events.emit("turn:started", {
        turn: after.turn,
        activePlayerIndex: after.activePlayerIndex,
      });
    }
    const drawn = cardDrawnBetween(before, after);
    if (drawn !== null) {
      this.events.emit("card:drawn", {
        playerIndex: after.activePlayerIndex,
        card: drawn,
        turn: after.turn,
        instanceId: drawn.instanceId ?? "",
        cardId: drawn.id,
      });
    }
    this.publishGameOver(before, after, "deck_out");
  }

  private publishAttack(
    before: BoardState,
    after: BoardState,
    attackerZoneIndex: number,
    target: AttackTarget,
  ): void {
    const playerIndex = before.activePlayerIndex;
    const attacker = before.players[playerIndex].monsterZone[attackerZoneIndex];
    const attackerCard = attacker === null || attacker === undefined ? null : attacker.card;
    const targetCard = targetCardOf(before, opponentOf(playerIndex), target);
    this.events.emit("attack:declared", {
      playerIndex,
      attackerZoneIndex,
      target,
      instanceId: attackerCard?.instanceId ?? "",
      cardId: attackerCard?.id ?? "",
      targetInstanceId: targetCard?.instanceId ?? null,
      targetCardId: targetCard?.id ?? null,
    });
    this.publishBattleHit(before, attackerZoneIndex, target, attackerCard, targetCard);
    this.publishStatDamage(before, after, "battle");
    this.publishPlayerDamage(before, after, "battle");
    const fallen = [opponentOf(playerIndex), playerIndex] as const;
    this.publishDestroyedMonsters(before, after);
    this.publishSentCards(before, after, ["monster", "hand", "spelltrap", "biome"], fallen);
    this.publishReleased(before, after, fallen);
    this.publishSentCards(before, after, ["material"], fallen);
    this.publishTowerReplacement(before, after);
    this.publishSentCards(before, after, ["tower"]);
    this.publishGameOver(before, after, "player_hp");
  }

  private publishBattleHit(
    before: BoardState,
    attackerZoneIndex: number,
    target: AttackTarget,
    attackerCard: MonsterCard | null,
    targetCard: Card | null,
  ): void {
    const playerIndex = before.activePlayerIndex;
    const defender = opponentOf(playerIndex);
    const atk = effectiveAttack(before.players[playerIndex], attackerZoneIndex);
    if (target.kind === "tower" && targetCard !== null && atk > 0) {
      this.events.emit("damage:dealt", {
        playerIndex: defender,
        amount: atk,
        source: "battle",
        target: "tower",
        zoneIndex: null,
        instanceId: targetCard.instanceId ?? "",
        cardId: targetCard.id,
      });
      return;
    }
    if (target.kind !== "monster" || attackerCard === null) {
      return;
    }
    const defenderSlot = before.players[defender].monsterZone[target.zoneIndex];
    if (defenderSlot === null || defenderSlot === undefined) {
      return;
    }
    const defense = defenderSlot.position === "defense"
      ? effectiveDefense(before.players[defender], target.zoneIndex)
      : effectiveAttack(before.players[defender], target.zoneIndex);
    if (atk === defense) {
      return;
    }
    if (atk > defense) {
      const hits = defenderSlot.position === "attack" || hasKeyword(attackerCard, "perfurar");
      if (!hits || targetCard === null) {
        return;
      }
      this.events.emit("damage:dealt", {
        playerIndex: defender,
        amount: atk - defense,
        source: "battle",
        target: "monster",
        zoneIndex: target.zoneIndex,
        instanceId: targetCard.instanceId ?? "",
        cardId: targetCard.id,
      });
      return;
    }
    this.events.emit("damage:dealt", {
      playerIndex,
      amount: defense - atk,
      source: "battle",
      target: "monster",
      zoneIndex: attackerZoneIndex,
      instanceId: attackerCard.instanceId ?? "",
      cardId: attackerCard.id,
    });
  }

  private publishDestroyedMonster(
    before: BoardState,
    after: BoardState,
    playerIndex: PlayerIndex,
    zoneIndex: number,
  ): void {
    const card = before.players[playerIndex].monsterZone[zoneIndex];
    const next = after.players[playerIndex].monsterZone[zoneIndex];
    if (card === null || card === undefined || (next !== null && next !== undefined)) {
      return;
    }
    this.events.emit("monster:destroyed", {
      playerIndex,
      zoneIndex,
      card: card.card,
      instanceId: card.card.instanceId ?? "",
      cardId: card.card.id,
    });
  }

  private publishDestroyedMonsters(before: BoardState, after: BoardState): void {
    const attacker = before.activePlayerIndex;
    const order = [opponentOf(attacker), attacker] as const;
    for (const playerIndex of order) {
      before.players[playerIndex].monsterZone.forEach((_, zoneIndex) => {
        this.publishDestroyedMonster(before, after, playerIndex, zoneIndex);
      });
    }
  }

  private publishFusion(after: BoardState, action: Extract<Action, { type: "fuseBrasa" }>): void {
    const playerIndex = after.activePlayerIndex;
    const slot = after.players[playerIndex].monsterZone[action.zoneIndex];
    if (slot === null || slot === undefined) {
      return;
    }
    const materials = slot.materials ?? [];
    this.events.emit("monster:fused", {
      playerIndex,
      card: slot.card,
      zoneIndex: action.zoneIndex,
      position: slot.position,
      instanceId: slot.card.instanceId ?? "",
      cardId: slot.card.id,
      materials,
      materialInstanceIds: materials.map((card) => card.instanceId ?? ""),
    });
  }

  private publishReleased(before: BoardState, after: BoardState, players: readonly PlayerIndex[] = [0, 1]): void {
    for (const playerIndex of players) {
      before.players[playerIndex].monsterZone.forEach((slot, zoneIndex) => {
        const next = after.players[playerIndex].monsterZone[zoneIndex];
        if (slot === null || slot === undefined || (slot.materials?.length ?? 0) === 0 || next !== null) {
          return;
        }
        const materials = slot.materials ?? [];
        this.events.emit("materials:released", {
          playerIndex,
          zoneIndex,
          instanceId: slot.card.instanceId ?? "",
          cardId: slot.card.id,
          cards: [slot.card, ...materials],
          materialInstanceIds: materials.map((card) => card.instanceId ?? ""),
        });
      });
    }
  }

  private publishMonster(after: BoardState, zoneIndex: number): void {
    const playerIndex = after.activePlayerIndex;
    const slot = after.players[playerIndex].monsterZone[zoneIndex];
    if (slot === null || slot === undefined) {
      return;
    }
    this.events.emit("monster:summoned", {
      playerIndex,
      card: slot.card,
      zoneIndex,
      position: slot.position,
      instanceId: slot.card.instanceId ?? "",
      cardId: slot.card.id,
    });
  }

  private publishPosition(before: BoardState, after: BoardState): void {
    const playerIndex = before.activePlayerIndex;
    before.players[playerIndex].monsterZone.forEach((slot, zoneIndex) => {
      const next = after.players[playerIndex].monsterZone[zoneIndex];
      if (slot === null || slot === undefined || next === null || next === undefined || slot.position === next.position) {
        return;
      }
      this.events.emit("monster:position", {
        playerIndex,
        zoneIndex,
        position: next.position,
        instanceId: next.card.instanceId ?? "",
        cardId: next.card.id,
      });
    });
  }

  private publishSpellTrap(before: BoardState, after: BoardState): void {
    const playerIndex = after.activePlayerIndex;
    const previous = before.players[playerIndex].spellTrapZone;
    after.players[playerIndex].spellTrapZone.forEach((card, zoneIndex) => {
      const was = previous[zoneIndex];
      if (card === null || card === undefined || (was !== null && was !== undefined)) {
        return;
      }
      this.events.emit("spelltrap:set", {
        playerIndex,
        zoneIndex,
        card,
        instanceId: card.instanceId ?? "",
        cardId: card.id,
      });
    });
  }

  private publishEnteredEffects(after: BoardState, playerIndex: PlayerIndex, zoneIndex: number): void {
    const slot = after.players[playerIndex].monsterZone[zoneIndex];
    if (slot === null || slot === undefined) {
      return;
    }
    const script = scriptOf(slot.card.id);
    if (script?.onSummon !== undefined) {
      this.events.emit("effect:activated", {
        playerIndex,
        zoneIndex,
        instanceId: slot.card.instanceId ?? "",
        cardId: slot.card.id,
        kind: "onSummon",
      });
    }
    if (script?.aura !== undefined || script?.towerDef !== undefined) {
      this.events.emit("effect:activated", {
        playerIndex,
        zoneIndex,
        instanceId: slot.card.instanceId ?? "",
        cardId: slot.card.id,
        kind: "aura",
      });
    }
  }

  private publishActivate(after: BoardState, zoneIndex: number): void {
    const playerIndex = after.activePlayerIndex;
    const slot = after.players[playerIndex].monsterZone[zoneIndex];
    if (slot === null || slot === undefined) {
      return;
    }
    this.events.emit("effect:activated", {
      playerIndex,
      zoneIndex,
      instanceId: slot.card.instanceId ?? "",
      cardId: slot.card.id,
      kind: "activate",
    });
  }

  private publishTowerSummon(after: BoardState): void {
    const playerIndex = after.activePlayerIndex;
    const tower = after.players[playerIndex].towerZone;
    if (tower === null) {
      return;
    }
    this.events.emit("tower:summoned", {
      playerIndex,
      card: tower.card,
      def: tower.card.def + tower.defBonus,
      instanceId: tower.card.instanceId ?? "",
      cardId: tower.card.id,
    });
  }

  private publishTowerAura(after: BoardState): void {
    const playerIndex = after.activePlayerIndex;
    const tower = after.players[playerIndex].towerZone;
    if (tower === null || scriptOf(tower.card.id)?.aura === undefined) {
      return;
    }
    this.events.emit("effect:activated", {
      playerIndex,
      zoneIndex: null,
      instanceId: tower.card.instanceId ?? "",
      cardId: tower.card.id,
      kind: "aura",
    });
  }

  private publishTowerReplacement(before: BoardState, after: BoardState): void {
    for (const playerIndex of [0, 1] as const) {
      const previous = before.players[playerIndex].towerZone;
      const next = after.players[playerIndex].towerZone;
      if (previous !== null && (next === null || previous.card.instanceId !== next.card.instanceId)) {
        this.events.emit("tower:destroyed", {
          playerIndex,
          card: previous.card,
          def: previous.card.def + previous.defBonus + (previous.tempDef ?? 0),
          instanceId: previous.card.instanceId ?? "",
          cardId: previous.card.id,
        });
      }
    }
  }

  private publishBiome(before: BoardState, after: BoardState): void {
    const playerIndex = before.activePlayerIndex;
    const previous = before.players[playerIndex].biomeZone;
    const card = after.players[playerIndex].biomeZone;
    if (previous !== null) {
      this.events.emit("biome:left", {
        playerIndex,
        card: previous,
        instanceId: previous.instanceId ?? "",
        cardId: previous.id,
      });
    }
    this.publishSentCards(before, after);
    if (card === null) {
      return;
    }
    this.events.emit("biome:played", {
      playerIndex,
      card,
      replaced: previous,
      instanceId: card.instanceId ?? "",
      cardId: card.id,
    });
  }

  private publishSentCards(
    before: BoardState,
    after: BoardState,
    origins?: readonly CardOrigin[],
    players: readonly PlayerIndex[] = [0, 1],
  ): void {
    for (const playerIndex of players) {
      for (const card of addedCards(before.players[playerIndex].limbo, after.players[playerIndex].limbo)) {
        const origin = locateCard(before.players[playerIndex], card);
        if (origins !== undefined && !origins.includes(origin.from)) {
          continue;
        }
        this.events.emit("card:sent", {
          playerIndex,
          instanceId: card.instanceId ?? "",
          cardId: card.id,
          destination: "limbo",
          from: origin.from,
          zoneIndex: origin.zoneIndex,
        });
      }
      for (const card of addedCards(before.players[playerIndex].graveyard, after.players[playerIndex].graveyard)) {
        const origin = locateCard(before.players[playerIndex], card);
        if (origins !== undefined && !origins.includes(origin.from)) {
          continue;
        }
        this.events.emit("card:sent", {
          playerIndex,
          instanceId: card.instanceId ?? "",
          cardId: card.id,
          destination: "graveyard",
          from: origin.from,
          zoneIndex: origin.zoneIndex,
        });
      }
    }
  }

  private publishStatDamage(before: BoardState, after: BoardState, source: "battle" | "effect"): void {
    for (const playerIndex of [0, 1] as const) {
      const previousTower = before.players[playerIndex].towerZone;
      const nextTower = after.players[playerIndex].towerZone;
      if (previousTower !== null && nextTower !== null) {
        const drop = (previousTower.tempDef ?? 0) - (nextTower.tempDef ?? 0);
        if (drop > 0) {
          this.events.emit("damage:dealt", {
            playerIndex,
            amount: drop,
            source,
            target: "tower",
            zoneIndex: null,
            instanceId: nextTower.card.instanceId ?? "",
            cardId: nextTower.card.id,
          });
        }
      }
      before.players[playerIndex].monsterZone.forEach((slot, zoneIndex) => {
        const next = after.players[playerIndex].monsterZone[zoneIndex];
        if (slot === null || slot === undefined || next === null || next === undefined) {
          return;
        }
        const drop = (slot.tempAtk ?? 0) - (next.tempAtk ?? 0);
        if (drop > 0) {
          this.events.emit("damage:dealt", {
            playerIndex,
            amount: drop,
            source,
            target: "monster",
            zoneIndex,
            instanceId: next.card.instanceId ?? "",
            cardId: next.card.id,
          });
        }
      });
    }
  }

  private publishPlayerDamage(before: BoardState, after: BoardState, source: "battle" | "effect"): void {
    for (const index of [0, 1] as const) {
      const amount = before.players[index].hp - after.players[index].hp;
      if (amount > 0) {
        this.events.emit("damage:dealt", {
          playerIndex: index,
          amount,
          source,
          target: "player",
          zoneIndex: null,
          instanceId: null,
          cardId: null,
        });
      }
    }
  }

  private publishGameOver(
    before: BoardState,
    after: BoardState,
    reason: "deck_out" | "player_hp",
  ): void {
    if (before.winner !== null || after.winner === null) {
      return;
    }
    this.events.emit("game:over", { winner: after.winner, reason });
  }
}

function rngFrom(setup: MatchSetup | undefined): Rng | undefined {
  if (setup === undefined) {
    return undefined;
  }
  return setup.rng ?? createSeededRng(setup.seed ?? 1);
}

function cardDrawnBetween(before: BoardState, after: BoardState): Card | null {
  if (before.phase !== "end" || after.turn === before.turn) {
    return null;
  }
  const playerIndex = after.activePlayerIndex;
  const previousDeck = before.players[playerIndex].deck;
  const nextDeck = after.players[playerIndex].deck;
  if (nextDeck.length !== previousDeck.length - 1) {
    return null;
  }
  return previousDeck[previousDeck.length - 1] ?? null;
}

function addedCards(before: readonly Card[], after: readonly Card[]): readonly Card[] {
  if (after.length <= before.length) {
    return [];
  }
  return after.slice(before.length);
}

function locateCard(player: PlayerState, card: Card): { from: CardOrigin; zoneIndex: number | null } {
  const identity = card.instanceId;
  const monsterIndex = player.monsterZone.findIndex((slot) => slot !== null && slot.card.instanceId === identity);
  if (monsterIndex >= 0) {
    return { from: "monster", zoneIndex: monsterIndex };
  }
  for (let zoneIndex = 0; zoneIndex < player.monsterZone.length; zoneIndex += 1) {
    const slot = player.monsterZone[zoneIndex];
    if (slot !== null && slot !== undefined && (slot.materials ?? []).some((material) => material.instanceId === identity)) {
      return { from: "material", zoneIndex };
    }
  }
  const handIndex = player.hand.findIndex((item) => item.instanceId === identity);
  if (handIndex >= 0) {
    return { from: "hand", zoneIndex: handIndex };
  }
  if (player.towerZone !== null && player.towerZone.card.instanceId === identity) {
    return { from: "tower", zoneIndex: null };
  }
  if (player.biomeZone !== null && player.biomeZone.instanceId === identity) {
    return { from: "biome", zoneIndex: null };
  }
  const spellIndex = player.spellTrapZone.findIndex((item) => item !== null && item.instanceId === identity);
  if (spellIndex >= 0) {
    return { from: "spelltrap", zoneIndex: spellIndex };
  }
  return { from: "hand", zoneIndex: null };
}

function targetCardOf(state: BoardState, defender: PlayerIndex, target: AttackTarget): Card | null {
  switch (target.kind) {
    case "player":
      return null;
    case "tower":
      return state.players[defender].towerZone?.card ?? null;
    case "monster": {
      const slot = state.players[defender].monsterZone[target.zoneIndex];
      return slot === null || slot === undefined ? null : slot.card;
    }
    default: {
      const unexpected: never = target;
      throw new Error(`Alvo inválido: ${String(unexpected)}.`);
    }
  }
}
