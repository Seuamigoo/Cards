import { DRAGAO_BRASA_ID, FILHOTE_BRASA_ID, scriptOf } from "./cardScripts";
import type { GrantAura } from "./cardScripts";
import { copyCard } from "./state";
import type { Card, MonsterCard, MonsterInstance, PlayerState, TowerInstance } from "./state";

export interface FieldView {
  readonly monsterZone: readonly (MonsterInstance | null)[];
  readonly towerZone: TowerInstance | null;
}

export interface FieldDraft extends FieldView {
  hp: number;
  hand: Card[];
  deck: Card[];
  monsterZone: (MonsterInstance | null)[];
  towerZone: TowerInstance | null;
  limbo: Card[];
  graveyard: Card[];
}

export function effectiveAttack(player: FieldView, zoneIndex: number): number {
  const slot = player.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return 0;
  }
  return slot.card.atk + (slot.tempAtk ?? 0) + materialAttack(slot) + auraAttack(player, zoneIndex);
}

export function effectiveDefense(player: FieldView, zoneIndex: number): number {
  const slot = player.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return 0;
  }
  return slot.card.def + auraDefense(player, zoneIndex);
}

export function effectiveTowerDefense(player: FieldView): number | null {
  if (player.towerZone === null) {
    return null;
  }
  let defense = player.towerZone.card.def + player.towerZone.defBonus + (player.towerZone.tempDef ?? 0);
  for (const slot of player.monsterZone) {
    if (slot !== null) {
      defense += scriptOf(slot.card.id)?.towerDef ?? 0;
    }
  }
  return defense;
}

export function hasImpeto(player: FieldView, zoneIndex: number): boolean {
  const slot = player.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return false;
  }
  if (slot.card.keywords.includes("impeto")) {
    return true;
  }
  return aurasFor(player, zoneIndex).some((aura) => aura.impeto === true);
}

export function clearTemporary(player: FieldDraft): void {
  player.monsterZone = player.monsterZone.map((slot) => {
    if (slot === null || slot.tempAtk === undefined) {
      return slot;
    }
    const { tempAtk, ...rest } = slot;
    void tempAtk;
    return rest;
  });
  if (player.towerZone !== null && player.towerZone.tempDef !== undefined) {
    const { tempDef, ...tower } = player.towerZone;
    void tempDef;
    player.towerZone = tower;
  }
}

export function removeMonster(owner: FieldDraft, opponent: FieldDraft | null, zoneIndex: number, reason: "battle" | "leave"): void {
  const slot = owner.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return;
  }
  const zone = [...owner.monsterZone];
  zone[zoneIndex] = null;
  owner.monsterZone = zone;
  const materials = slot.materials ?? [];
  if (reason === "battle" && opponent !== null) {
    const damage = scriptOf(slot.card.id)?.onDestroyedInBattle ?? 0;
    if (damage > 0) {
      opponent.hp -= damage;
    }
  }
  owner.limbo = [...owner.limbo, copyCard(slot.card), ...materials.map((card) => copyCard(card))];
}

export function onBattleDestroy(attacker: FieldDraft, defender: FieldDraft, attackerZoneIndex: number): void {
  const slot = attacker.monsterZone[attackerZoneIndex];
  if (slot === null || slot === undefined) {
    return;
  }
  const damage = scriptOf(slot.card.id)?.onBattleDestroy ?? 0;
  if (damage > 0) {
    defender.hp -= damage;
  }
}

export function applyOnSummon(owner: FieldDraft, opponent: FieldDraft, zoneIndex: number, targetZone: number | null): boolean {
  const slot = owner.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return false;
  }
  const summon = scriptOf(slot.card.id)?.onSummon;
  if (summon === undefined) {
    return false;
  }
  switch (summon.kind) {
    case "enemyTowerDef":
      shiftTower(opponent, -summon.amount);
      return false;
    case "draw":
      if (summon.ifAnotherTag !== undefined && !controlsAnother(owner, zoneIndex, summon.ifAnotherTag)) {
        return false;
      }
      return !drawCards(owner, summon.count);
    case "heal": {
      const times = summon.perTag === undefined ? 1 : countTag(owner, summon.perTag);
      owner.hp += summon.amount * times;
      return false;
    }
    case "damage":
      opponent.hp -= summon.amount;
      return opponent.hp <= 0;
    case "debuffOne":
      if (targetZone !== null) {
        shiftAttack(opponent, targetZone, -summon.amount);
      }
      return false;
    case "debuffAll":
      opponent.monsterZone.forEach((monster, index) => {
        if (monster !== null) {
          shiftAttack(opponent, index, -summon.amount);
        }
      });
      return false;
    default: {
      const unexpected: never = summon;
      throw new Error(`Efeito inválido: ${String(unexpected)}.`);
    }
  }
}

export function applyHeal(owner: FieldDraft, zoneIndex: number): void {
  const slot = owner.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return;
  }
  owner.hp += scriptOf(slot.card.id)?.activateHeal ?? 0;
  const zone = [...owner.monsterZone];
  zone[zoneIndex] = { ...slot, activatedThisTurn: true };
  owner.monsterZone = zone;
}

function materialAttack(slot: MonsterInstance): number {
  if (slot.card.id !== DRAGAO_BRASA_ID) {
    return 0;
  }
  return (slot.materials ?? []).filter((card) => card.id === FILHOTE_BRASA_ID).length * 300;
}

function auraAttack(player: FieldView, zoneIndex: number): number {
  return auraStat(player, zoneIndex, "atk");
}

function auraDefense(player: FieldView, zoneIndex: number): number {
  return auraStat(player, zoneIndex, "def");
}

function auraStat(player: FieldView, zoneIndex: number, stat: "atk" | "def"): number {
  const self = player.monsterZone[zoneIndex];
  if (self === null || self === undefined) {
    return 0;
  }
  let total = 0;
  const own = scriptOf(self.card.id)?.aura;
  if (own?.kind === "perOther" && stat === "atk") {
    const others = countTag(player, own.tag) - (self.card.tags.includes(own.tag) ? 1 : 0);
    const bonus = Math.max(0, others) * own.atk;
    total += own.max === undefined ? bonus : Math.min(own.max, bonus);
  }
  player.monsterZone.forEach((slot, index) => {
    if (slot === null) {
      return;
    }
    const aura = scriptOf(slot.card.id)?.aura;
    if (aura?.kind !== "grant" || !matchesGrant(self.card, aura, index === zoneIndex)) {
      return;
    }
    total += stat === "atk" ? aura.atk ?? 0 : aura.def ?? 0;
  });
  const towerAura = player.towerZone === null ? undefined : scriptOf(player.towerZone.card.id)?.aura;
  if (towerAura?.kind === "grant" && matchesGrant(self.card, towerAura, false)) {
    total += stat === "atk" ? towerAura.atk ?? 0 : towerAura.def ?? 0;
  }
  return total;
}

function aurasFor(player: FieldView, zoneIndex: number): GrantAura[] {
  const self = player.monsterZone[zoneIndex];
  if (self === null || self === undefined) {
    return [];
  }
  const found: GrantAura[] = [];
  player.monsterZone.forEach((slot, index) => {
    if (slot === null) {
      return;
    }
    const aura = scriptOf(slot.card.id)?.aura;
    if (aura?.kind === "grant" && matchesGrant(self.card, aura, index === zoneIndex)) {
      found.push(aura);
    }
  });
  const towerAura = player.towerZone === null ? undefined : scriptOf(player.towerZone.card.id)?.aura;
  if (towerAura?.kind === "grant" && matchesGrant(self.card, towerAura, false)) {
    found.push(towerAura);
  }
  return found;
}

function matchesGrant(card: MonsterCard, aura: GrantAura, isSelf: boolean): boolean {
  if (aura.othersOnly && isSelf) {
    return false;
  }
  if (!card.tags.includes(aura.tag)) {
    return false;
  }
  if (aura.classTag !== undefined && !card.tags.includes(aura.classTag)) {
    return false;
  }
  return true;
}

function countTag(player: FieldView, tag: string): number {
  return player.monsterZone.filter((slot) => slot !== null && slot.card.tags.includes(tag)).length;
}

function controlsAnother(player: FieldDraft, zoneIndex: number, tag: string): boolean {
  return player.monsterZone.some((slot, index) => index !== zoneIndex && slot !== null && slot.card.tags.includes(tag));
}

function drawCards(player: FieldDraft, count: number): boolean {
  for (let drawn = 0; drawn < count; drawn += 1) {
    const top = player.deck[player.deck.length - 1];
    if (top === undefined) {
      return false;
    }
    player.deck = player.deck.slice(0, -1);
    player.hand = [...player.hand, top];
  }
  return true;
}

function shiftTower(player: FieldDraft, amount: number): void {
  if (player.towerZone === null) {
    return;
  }
  player.towerZone = { ...player.towerZone, tempDef: (player.towerZone.tempDef ?? 0) + amount };
}

function shiftAttack(player: FieldDraft, zoneIndex: number, amount: number): void {
  const slot = player.monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return;
  }
  const zone = [...player.monsterZone];
  zone[zoneIndex] = { ...slot, tempAtk: (slot.tempAtk ?? 0) + amount };
  player.monsterZone = zone;
}

export function playerField(player: PlayerState): FieldDraft {
  return {
    hp: player.hp,
    hand: [...player.hand],
    deck: [...player.deck],
    monsterZone: [...player.monsterZone],
    towerZone: player.towerZone,
    limbo: [...player.limbo],
    graveyard: [...player.graveyard],
  };
}
