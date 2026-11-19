import { describe, expect, it } from "vitest";
import { AGULHA_CARD_ID } from "../../src/domain/rules";
import { applyAction, getLegalActions, getLegalTargets, resolveConfig } from "../../src/domain/index";
import type { BoardState, MonsterCard, MonsterInstance } from "../../src/domain/index";

function monster(id: string, tags: readonly string[], keywords: MonsterCard["keywords"] = []): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", level: 4, atk: 1000, def: 1000, tags, keywords };
}

function placed(card: MonsterCard): MonsterInstance {
  return {
    card,
    position: "attack",
    summonedThisTurn: false,
    changedPositionThisTurn: false,
    attackedThisTurn: false,
  };
}

function ready(enableConvergence: boolean, agulha = false): BoardState {
  const config = resolveConfig("classic", { monsterSlots: 3, playerHp: 8000, enableConvergence });
  const human = placed(monster("humano", ["HUMAN", "WARRIOR"]));
  const dragon = placed(monster("dragao", ["DRAGON", "WARRIOR"]));
  const mestico = monster("draconato-kaelthar", ["HUMAN", "DRAGON", "WARRIOR"], ["perfurar"]);
  const player = (id: string, zone: (MonsterInstance | null)[], lineage: MonsterCard[]) => ({
    id,
    hp: 8000,
    hand: [monster("mão-dragao", ["DRAGON", "MAGE"])],
    deck: [],
    monsterZone: zone,
    spellTrapZone: [null, null, null, null, null, null],
    towerZone: agulha
      ? { card: { id: AGULHA_CARD_ID, name: "Agulha da Convergência", rarity: "rara" as const, kind: "tower" as const, def: 2000 }, defBonus: 0 }
      : null,
    biomeZone: null,
    graveyard: [],
    limbo: [],
    towerSummonedThisTurn: false,
    normalSummonedThisTurn: false,
    lineageDeck: lineage,
    convergedThisTurn: false,
  });
  return {
    config,
    turn: 2,
    activePlayerIndex: 0,
    phase: "main1",
    winner: null,
    players: [player("lina", [human, dragon, null], [mestico]), player("kael", [null, null, null], [])],
  };
}

const converge = {
  type: "converge" as const,
  lineageIndex: 0,
  zoneIndex: 2,
  position: "attack" as const,
  materialZoneIndexes: [0, 1],
};

describe("Convergência", () => {
  it("fica desligada por padrão e a ação é rejeitada", () => {
    expect(resolveConfig("classic").enableConvergence).toBe(false);
    expect(resolveConfig("blitz").enableConvergence).toBe(false);
    const state = ready(false);
    expect(getLegalActions(state, 0).some((action) => action.type === "converge")).toBe(false);
    const result = applyAction(state, 0, converge);
    expect(result).toEqual({ ok: false, error: "Convergência está desligada." });
    expect(state.players[0].lineageDeck).toHaveLength(1);
    expect(state.players[0].monsterZone[2]).toBeNull();
  });

  it("com a flag ligada invoca o Mestiço com um material de cada Raça matriz", () => {
    const state = ready(true);
    const legal = getLegalActions(state, 0).filter((action) => action.type === "converge");
    expect(legal).toContainEqual(converge);
    const result = applyAction(state, 0, converge);
    expect(result.ok).toBe(true);
    if (!result.ok) {
      return;
    }
    const player = result.state.players[0];
    expect(player.monsterZone[2]?.card.id).toBe("draconato-kaelthar");
    expect(player.monsterZone[2]?.position).toBe("attack");
    expect(player.monsterZone[2]?.summonedThisTurn).toBe(true);
    expect(player.monsterZone[0]).toBeNull();
    expect(player.monsterZone[1]).toBeNull();
    expect(player.limbo.map((card) => card.id)).toEqual(["humano", "dragao"]);
    expect(player.lineageDeck).toEqual([]);
    expect(player.normalSummonedThisTurn).toBe(false);
    expect(player.convergedThisTurn).toBe(true);
    expect(applyAction(result.state, 0, converge).ok).toBe(false);
    expect(getLegalActions(result.state, 0).some((action) => action.type === "converge")).toBe(false);
  });

  it("a Agulha permite um material da mão e, sem ela, essa ação não existe", () => {
    const closed = ready(true, false);
    expect(
      getLegalActions(closed, 0).some(
        (action) => action.type === "converge" && action.materialHandIndex !== undefined,
      ),
    ).toBe(false);
    expect(
      applyAction(closed, 0, { ...converge, materialZoneIndexes: [0], materialHandIndex: 0 }).ok,
    ).toBe(false);

    const open = ready(true, true);
    const fromHand = {
      type: "converge" as const,
      lineageIndex: 0,
      zoneIndex: 2,
      position: "defense" as const,
      materialZoneIndexes: [0],
      materialHandIndex: 0,
    };
    expect(getLegalActions(open, 0)).toContainEqual(fromHand);
    const result = applyAction(open, 0, fromHand);
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.state.players[0].monsterZone[2]?.card.id).toBe("draconato-kaelthar");
      expect(result.state.players[0].monsterZone[2]?.position).toBe("defense");
      expect(result.state.players[0].limbo.map((card) => card.id)).toEqual(["humano", "mão-dragao"]);
      expect(result.state.players[0].hand).toEqual([]);
    }
  });

  it("rejeita materiais que não cobrem as duas Raças matriz", () => {
    const state = ready(true);
    const result = applyAction(state, 0, { ...converge, materialZoneIndexes: [0, 0] });
    expect(result.ok).toBe(false);
  });

  it("Mestiço destruído vai ao Limbo e o Ceifador ataca no turno em que entra", () => {
    const config = resolveConfig("classic", { monsterSlots: 2, playerHp: 8000, enableConvergence: true });
    const ceifador = monster("ceifador-carmesim", ["UNDEAD", "DEMON", "ASSASSIN"], ["impeto"]);
    const undead = placed(monster("esqueleto", ["UNDEAD", "WARRIOR"]));
    const demon = monster("diabrete", ["DEMON", "ASSASSIN"]);
    const base = ready(true);
    const state: BoardState = {
      ...base,
      config,
      players: [
        {
          ...base.players[0],
          hand: [demon],
          monsterZone: [undead, null],
          lineageDeck: [ceifador],
          towerZone: {
            card: { id: AGULHA_CARD_ID, name: "Agulha da Convergência", rarity: "rara", kind: "tower", def: 2000 },
            defBonus: 0,
          },
        },
        {
          ...base.players[1],
          monsterZone: [null, null],
        },
      ],
    };
    const entered = applyAction(state, 0, {
      type: "converge",
      lineageIndex: 0,
      zoneIndex: 1,
      position: "attack",
      materialZoneIndexes: [0],
      materialHandIndex: 0,
    });
    expect(entered.ok).toBe(true);
    if (!entered.ok) {
      return;
    }
    const battle: BoardState = { ...entered.state, phase: "battle" };
    expect(getLegalTargets(battle, 0, 1)).toEqual([{ kind: "player" }]);

    const defender = placed(monster("draconato-kaelthar", ["HUMAN", "DRAGON", "WARRIOR"], ["perfurar"]));
    const struck: BoardState = {
      ...battle,
      players: [
        { ...battle.players[0], monsterZone: [placed({ ...monster("golpe", ["HUMAN", "WARRIOR"]), atk: 3000 }), null] },
        { ...battle.players[1], monsterZone: [{ ...defender, card: { ...defender.card, atk: 1000 } }, null] },
      ],
    };
    const destroyed = applyAction(struck, 0, { type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } });
    expect(destroyed.ok).toBe(true);
    if (destroyed.ok) {
      expect(destroyed.state.players[1].limbo.map((card) => card.id)).toEqual(["draconato-kaelthar"]);
      expect(destroyed.state.players[1].graveyard).toEqual([]);
    }
  });
});
