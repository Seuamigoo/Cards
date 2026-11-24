import { describe, expect, it } from "vitest";
import { applyAction, effectiveAttack, effectiveTowerDefense, getLegalActions, resolveConfig } from "../../src/domain/index";
import type { BoardState, MonsterCard, MonsterInstance, TowerInstance } from "../../src/domain/index";

function monster(id: string, atk: number, def: number, tags: readonly string[], level = 4): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", level, atk, def, tags, keywords: [] };
}

function placed(card: MonsterCard, summonedThisTurn = false): MonsterInstance {
  return { card, position: "attack", summonedThisTurn, changedPositionThisTurn: false, attackedThisTurn: false };
}

function tower(def = 2000): TowerInstance {
  return { card: { id: "torre", name: "Torre", rarity: "rara", kind: "tower", def }, defBonus: 0 };
}

function field(slots: number, own: (MonsterInstance | null)[], hand: MonsterCard[], enemyTower = false): BoardState {
  const config = resolveConfig("classic", { monsterSlots: slots, playerHp: 8000 });
  const blanks = Array.from({ length: slots }, () => null);
  const player = (id: string, zone: (MonsterInstance | null)[], cards: MonsterCard[], withTower: boolean) => ({
    id,
    hp: 8000,
    hand: cards,
    deck: [monster("compra", 0, 0, ["HUMAN", "WARRIOR"], 1)],
    monsterZone: zone.length === slots ? zone : [...zone, ...blanks].slice(0, slots),
    spellTrapZone: Array.from({ length: config.spellTrapSlots }, () => null),
    towerZone: withTower ? tower() : null,
    biomeZone: null,
    graveyard: [],
    limbo: [],
    towerSummonedThisTurn: false,
    normalSummonedThisTurn: false,
    lineageDeck: [],
    convergedThisTurn: false,
  });
  return {
    config,
    turn: 2,
    activePlayerIndex: 0,
    phase: "main1",
    winner: null,
    players: [player("lina", own, hand, false), player("kael", blanks, [], enemyTower)],
  };
}

function filhote(): MonsterCard {
  return monster("filhote-de-brasa", 1100, 900, ["DRAGON", "WARRIOR"], 3);
}

function dragon(): MonsterCard {
  return { ...monster("dragao-brasa", 1800, 2200, ["DRAGON", "WARRIOR"], 7), rarity: "epica" };
}

describe("lote v0.3", () => {
  it.each([3, 6])("funde o Dragão Brasa com 3 Filhotes em %i slots sem gastar a invocação normal", (slots) => {
    const hatchlings = [placed(filhote()), placed(filhote()), placed(filhote())];
    const state = field(slots, hatchlings, [dragon(), monster("engrenagem-sentinela", 600, 1200, ["AUTOMATON", "WARRIOR"], 1)]);
    const legal = getLegalActions(state, 0).filter((action) => action.type === "fuseBrasa");
    expect(legal.length).toBeGreaterThan(0);
    expect(getLegalActions(state, 0).some((action) => action.type === "summonMonster" && state.players[0].hand[action.handIndex]?.id === "dragao-brasa")).toBe(false);
    const fused = applyAction(state, 0, { type: "fuseBrasa", handIndex: 0, zoneIndex: 0, position: "attack", materialZoneIndexes: [0, 1, 2] });
    expect(fused.ok).toBe(true);
    if (!fused.ok) {
      return;
    }
    const player = fused.state.players[0];
    expect(player.normalSummonedThisTurn).toBe(false);
    expect(player.monsterZone[1]).toBeNull();
    expect(player.monsterZone[2]).toBeNull();
    expect(player.monsterZone[0]?.card.id).toBe("dragao-brasa");
    expect(player.monsterZone[0]?.materials?.map((card) => card.id)).toEqual(["filhote-de-brasa", "filhote-de-brasa", "filhote-de-brasa"]);
    expect(player.hp).toBe(8000);
    expect(effectiveAttack(player, 0)).toBe(2700);
    expect(applyAction(fused.state, 0, { type: "summonMonster", handIndex: 0, zoneIndex: 1, position: "attack", tributeZoneIndexes: [] }).ok).toBe(true);
    expect(applyAction(fused.state, 0, { type: "fuseBrasa", handIndex: 0, zoneIndex: 1, position: "attack", materialZoneIndexes: [0, 1, 2] }).ok).toBe(false);
  });

  it("não dispara o Filhote na fusão nem quando o Dragão vai ao Limbo, e solta 4 cartas", () => {
    const state = field(3, [placed(filhote())], []);
    const battle: BoardState = {
      ...state,
      phase: "battle",
      players: [
        { ...state.players[0], monsterZone: [placed(monster("golpe", 2000, 0, ["HUMAN", "WARRIOR"])), null, null] },
        { ...state.players[1], monsterZone: [placed(filhote()), null, null] },
      ],
    };
    const struck = applyAction(battle, 0, { type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } });
    expect(struck.ok).toBe(true);
    if (struck.ok) {
      expect(struck.state.players[0].hp).toBe(7700);
    }

    const fused = applyAction(
      field(3, [placed(filhote()), placed(filhote()), placed(filhote())], [dragon()]),
      0,
      { type: "fuseBrasa", handIndex: 0, zoneIndex: 0, position: "attack", materialZoneIndexes: [0, 1, 2] },
    );
    expect(fused.ok).toBe(true);
    if (!fused.ok) {
      return;
    }
    expect(fused.state.players[0].hp).toBe(8000);
    expect(fused.state.players[1].hp).toBe(8000);
    const leaving: BoardState = {
      ...fused.state,
      phase: "battle",
      players: [
        {
          ...fused.state.players[1],
          monsterZone: [placed(monster("golpe", 3000, 0, ["HUMAN", "WARRIOR"])), null, null],
        },
        fused.state.players[0],
      ],
    };
    const released = applyAction({ ...leaving, activePlayerIndex: 0 }, 0, {
      type: "attack",
      attackerZoneIndex: 0,
      target: { kind: "monster", zoneIndex: 0 },
    });
    expect(released.ok).toBe(true);
    if (released.ok) {
      expect(released.state.players[1].limbo.map((card) => card.id)).toEqual([
        "dragao-brasa",
        "filhote-de-brasa",
        "filhote-de-brasa",
        "filhote-de-brasa",
      ]);
      expect(released.state.players[0].hp).toBe(8000);
    }
  });

  it("recalcula bônus de tag na entrada e na saída e expira modificadores na End Phase", () => {
    const alfa = placed(monster("alfa-da-matilha", 2200, 1500, ["BEAST", "WARRIOR"], 6));
    const lobo = placed(monster("lobo-da-estepe", 1100, 500, ["BEAST", "ASSASSIN"], 2));
    const together = field(6, [alfa, lobo], []);
    expect(effectiveAttack(together.players[0], 1)).toBe(1300);
    const alone = field(6, [lobo], []);
    expect(effectiveAttack(alone.players[0], 0)).toBe(1100);

    const sacerdote = placed(monster("sacerdote-das-runas", 900, 1500, ["DWARF", "CLERIC"]));
    const withPriest = field(6, [sacerdote], []);
    const boosted: BoardState = {
      ...withPriest,
      players: [{ ...withPriest.players[0], towerZone: tower(2600) }, withPriest.players[1]],
    };
    expect(effectiveTowerDefense(boosted.players[0])).toBe(2900);
    const gone: BoardState = {
      ...boosted,
      phase: "battle",
      activePlayerIndex: 1,
      players: [
        boosted.players[0],
        { ...boosted.players[1], monsterZone: [placed(monster("golpe", 4000, 0, ["HUMAN", "WARRIOR"])), null, null, null, null, null] },
      ],
    };
    const removed = applyAction(gone, 1, { type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } });
    expect(removed.ok).toBe(true);
    if (removed.ok) {
      expect(effectiveTowerDefense(removed.state.players[0])).toBe(2600);
    }
    const packed = field(6, [alfa, lobo], []);
    const split: BoardState = {
      ...packed,
      phase: "battle",
      activePlayerIndex: 1,
      players: [
        packed.players[0],
        { ...packed.players[1], monsterZone: [placed(monster("golpe", 4000, 0, ["HUMAN", "WARRIOR"])), null, null, null, null, null] },
      ],
    };
    expect(effectiveAttack(split.players[0], 1)).toBe(1300);
    const after = applyAction(split, 1, { type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } });
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(effectiveAttack(after.state.players[0], 1)).toBe(1100);
    }

    const summon = applyAction(field(6, [], [monster("batedora-da-folhagem", 1000, 600, ["ELF", "ARCHER"], 2)], true), 0, {
      type: "summonMonster",
      handIndex: 0,
      zoneIndex: 0,
      position: "attack",
      tributeZoneIndexes: [],
    });
    expect(summon.ok).toBe(true);
    if (!summon.ok) {
      return;
    }
    expect(summon.state.players[1].towerZone?.card.def).toBe(2000);
    expect(effectiveTowerDefense(summon.state.players[1])).toBe(1700);
    const ended = applyAction({ ...summon.state, phase: "main2" }, 0, { type: "advancePhase" });
    expect(ended.ok).toBe(true);
    if (ended.ok) {
      expect(ended.state.phase).toBe("end");
      expect(effectiveTowerDefense(ended.state.players[1])).toBe(2000);
    }
  });
});
