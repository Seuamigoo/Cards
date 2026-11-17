import { describe, expect, it } from "vitest";
import catalogFile from "../../catalog/cards.json";
import { CardRegistry, STARTER_DECKS, starterCardIds } from "../../src/catalog/index";
import {
  GameMatch,
  applyAction,
  getLegalTargets,
  resolveConfig,
} from "../../src/domain/index";
import type { BoardState, Keyword, MonsterCard, MonsterInstance } from "../../src/domain/index";

function monster(
  id: string,
  atk: number,
  def: number,
  level = 4,
  keywords: readonly Keyword[] = [],
): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", level, atk, def, tags: ["HUMAN", "WARRIOR"], keywords };
}

function slot(
  card: MonsterCard,
  position: MonsterInstance["position"] = "attack",
  flags: Partial<Pick<MonsterInstance, "summonedThisTurn" | "attackedThisTurn" | "siege">> = {},
): MonsterInstance {
  return {
    card,
    position,
    summonedThisTurn: flags.summonedThisTurn ?? false,
    changedPositionThisTurn: false,
    attackedThisTurn: flags.attackedThisTurn ?? false,
    ...(flags.siege === true ? { siege: true } : {}),
  };
}

function board(attacker: MonsterInstance | null, defender: MonsterInstance | null, towerDef: number | null = null): BoardState {
  const config = resolveConfig("classic", { monsterSlots: 2, playerHp: 8000 });
  const player = (id: string, zone: MonsterInstance | null, tower: number | null) => ({
    id,
    hp: 8000,
    hand: [] as MonsterCard[],
    deck: [] as MonsterCard[],
    monsterZone: [zone, null],
    spellTrapZone: [null, null, null, null, null, null],
    towerZone: tower === null ? null : { card: { id: "torre", name: "Torre", rarity: "rara" as const, kind: "tower" as const, def: tower }, defBonus: 0 },
    biomeZone: null,
    graveyard: [],
    limbo: [],
    towerSummonedThisTurn: false,
    normalSummonedThisTurn: false,
  });
  return {
    config,
    turn: 2,
    activePlayerIndex: 0,
    phase: "battle",
    winner: null,
    players: [player("lina", attacker, null), player("kael", defender, towerDef)],
  };
}

describe("regras do GDD", () => {
  it("bloqueia a Torre e o jogador enquanto houver monstro inimigo, com gancho impresso", () => {
    const blocked = board(slot(monster("a", 1800, 1000)), slot(monster("d", 1000, 1000)), 2000);
    expect(getLegalTargets(blocked, 0, 0)).toEqual([{ kind: "monster", zoneIndex: 0 }]);

    const spectral = board(
      slot(monster("arco", 1500, 900, 4, ["ataqueTorre"])),
      slot(monster("d", 1000, 1000)),
      2000,
    );
    expect(getLegalTargets(spectral, 0, 0)).toEqual([
      { kind: "monster", zoneIndex: 0 },
      { kind: "tower" },
    ]);

    const siege = board(slot(monster("a", 1800, 1000), "attack", { siege: true }), slot(monster("d", 900, 900)), 2000);
    expect(getLegalTargets(siege, 0, 0).some((target) => target.kind === "tower")).toBe(true);
  });

  it("resolve ATK contra DEF, empate e Perfurar", () => {
    const higher = applyAction(
      board(slot(monster("a", 1800, 1000)), slot(monster("d", 2000, 1000), "defense")),
      0,
      { type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } },
    );
    expect(higher.ok).toBe(true);
    if (higher.ok) {
      expect(higher.state.players[1].monsterZone[0]).toBeNull();
      expect(higher.state.players[1].hp).toBe(8000);
      expect(higher.state.players[0].hp).toBe(8000);
    }

    const lower = applyAction(
      board(slot(monster("a", 900, 1000)), slot(monster("d", 2000, 1600), "defense")),
      0,
      { type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } },
    );
    expect(lower.ok).toBe(true);
    if (lower.ok) {
      expect(lower.state.players[0].monsterZone[0]?.card.id).toBe("a");
      expect(lower.state.players[0].hp).toBe(7300);
      expect(lower.state.players[1].monsterZone[0]?.card.id).toBe("d");
    }

    const tied = applyAction(
      board(slot(monster("a", 1400, 1000)), slot(monster("d", 2000, 1400), "defense")),
      0,
      { type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } },
    );
    expect(tied.ok).toBe(true);
    if (tied.ok) {
      expect(tied.state.players[0].hp).toBe(8000);
      expect(tied.state.players[1].hp).toBe(8000);
      expect(tied.state.players[0].monsterZone[0]).not.toBeNull();
      expect(tied.state.players[1].monsterZone[0]).not.toBeNull();
    }

    const pierce = applyAction(
      board(slot(monster("a", 1800, 1000, 4, ["perfurar"])), slot(monster("d", 2000, 1000), "defense")),
      0,
      { type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } },
    );
    expect(pierce.ok).toBe(true);
    if (pierce.ok) {
      expect(pierce.state.players[1].hp).toBe(7200);
      expect(pierce.state.players[1].monsterZone[0]).toBeNull();
    }
  });

  it("impede ataque no turno da entrada, em Defesa e força Provocar", () => {
    const sick = board(slot(monster("a", 1500, 1000), "attack", { summonedThisTurn: true }), null, null);
    expect(getLegalTargets(sick, 0, 0)).toEqual([]);
    const rush = board(
      slot(monster("a", 1500, 1000, 4, ["impeto"]), "attack", { summonedThisTurn: true }),
      null,
      null,
    );
    expect(getLegalTargets(rush, 0, 0)).toEqual([{ kind: "player" }]);
    const defending = board(slot(monster("a", 1500, 1000), "defense"), null, null);
    expect(getLegalTargets(defending, 0, 0)).toEqual([]);

    const open = board(slot(monster("a", 1800, 1000)), slot(monster("wall", 800, 1600, 4, ["provocar"]), "defense"));
    const taunt: BoardState = {
      ...open,
      players: [
        open.players[0],
        {
          ...open.players[1],
          monsterZone: [slot(monster("wall", 800, 1600, 4, ["provocar"]), "defense"), slot(monster("soft", 500, 500))],
        },
      ],
    };
    expect(getLegalTargets(taunt, 0, 0)).toEqual([{ kind: "monster", zoneIndex: 0 }]);
  });

  it("cobra tributo pelo nível, uma invocação normal e posição escolhida", () => {
    const config = resolveConfig("classic", { monsterSlots: 3 });
    const state = board(slot(monster("t1", 800, 800, 2)), slot(monster("t2", 800, 800, 2)));
    const ready: BoardState = {
      ...state,
      config,
      phase: "main1",
      players: [
        {
          ...state.players[0],
          hand: [monster("alto", 2600, 2600, 8), monster("medio", 2000, 1500, 6), monster("baixo", 1000, 1000, 4)],
          monsterZone: [slot(monster("t1", 800, 800, 2)), slot(monster("t2", 800, 800, 2)), null],
        },
        { ...state.players[1], monsterZone: [null, null] },
      ],
    };
    const missing = applyAction(ready, 0, {
      type: "summonMonster",
      handIndex: 0,
      zoneIndex: 2,
      position: "attack",
      tributeZoneIndexes: [],
    });
    expect(missing.ok).toBe(false);
    const placed = applyAction(ready, 0, {
      type: "summonMonster",
      handIndex: 2,
      zoneIndex: 2,
      position: "defense",
      tributeZoneIndexes: [],
    });
    expect(placed.ok).toBe(true);
    if (!placed.ok) {
      return;
    }
    expect(placed.state.players[0].monsterZone[2]?.position).toBe("defense");
    expect(placed.state.players[0].monsterZone[2]?.summonedThisTurn).toBe(true);
    const again = applyAction(placed.state, 0, {
      type: "summonMonster",
      handIndex: 0,
      zoneIndex: 2,
      position: "attack",
      tributeZoneIndexes: [0, 1],
    });
    expect(again.ok).toBe(false);

    const freed = applyAction(ready, 0, {
      type: "summonMonster",
      handIndex: 1,
      zoneIndex: 0,
      position: "attack",
      tributeZoneIndexes: [0],
    });
    expect(freed.ok).toBe(true);
    if (freed.ok) {
      expect(freed.state.players[0].limbo.map((card) => card.id)).toEqual(["t1"]);
      expect(freed.state.players[0].monsterZone[0]?.card.id).toBe("medio");
    }
    const two = applyAction(ready, 0, {
      type: "summonMonster",
      handIndex: 0,
      zoneIndex: 2,
      position: "attack",
      tributeZoneIndexes: [0, 1],
    });
    expect(two.ok).toBe(true);
    if (two.ok) {
      expect(two.state.players[0].monsterZone[2]?.card.level).toBe(8);
      expect(two.state.players[0].limbo.map((card) => card.id)).toEqual(["t1", "t2"]);
    }
  });

  it("o primeiro jogador não compra e não batalha no turno 1", () => {
    const card = monster("a", 1000, 1000);
    const match = new GameMatch("classic", ["lina", "kael"], { openingHandSize: 1, mainDeckMin: 1, mainDeckMax: 4 }, {
      decks: [[card, card], [card, card]],
      rng: { next: () => 0.999 },
    });
    expect(match.getState().players[0].hand).toHaveLength(1);
    expect(match.getState().players[0].deck).toHaveLength(1);
    match.advancePhase();
    expect(match.getState().phase).toBe("main1");
    match.advancePhase();
    expect(match.getState().phase).toBe("main2");
    expect(match.getState().turn).toBe(1);
  });

  it("substitui a Torre sem gastar a invocação normal e sem dar vitória", () => {
    const tower = { id: "cidadela", name: "Cidadela", rarity: "rara" as const, kind: "tower" as const, def: 2200 };
    const other = { ...tower, id: "necropole", name: "Necrópole", def: 2000 };
    const state = board(null, null, 2200);
    const ready: BoardState = {
      ...state,
      phase: "main1",
      players: [
        {
          ...state.players[0],
          hand: [other, monster("a", 1000, 1000)],
          towerZone: { card: tower, defBonus: 0 },
        },
        state.players[1],
      ],
    };
    const replaced = applyAction(ready, 0, { type: "summonTower", handIndex: 0 });
    expect(replaced.ok).toBe(true);
    if (!replaced.ok) {
      return;
    }
    expect(replaced.state.players[0].towerZone?.card.id).toBe("necropole");
    expect(replaced.state.players[0].limbo.map((card) => card.id)).toEqual(["cidadela"]);
    expect(replaced.state.winner).toBeNull();
    const summoned = applyAction(replaced.state, 0, {
      type: "summonMonster",
      handIndex: 0,
      zoneIndex: 0,
      position: "attack",
      tributeZoneIndexes: [],
    });
    expect(summoned.ok).toBe(true);
    const secondTower = applyAction(replaced.state, 0, { type: "summonTower", handIndex: 0 });
    expect(secondTower.ok).toBe(false);
  });

  it("os decks iniciais têm 40 e 20 cartas e respeitam o limite de cópias", () => {
    const loaded = CardRegistry.fromJSON(JSON.stringify(catalogFile));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    const classes = new Set(["WARRIOR", "MAGE", "ARCHER", "ASSASSIN", "CLERIC"]);
    for (const card of loaded.registry.byKind("monster")) {
      if (card.kind !== "monster") {
        continue;
      }
      const classTags = card.tags.filter((tag) => classes.has(tag));
      expect(classTags.length).toBeGreaterThan(0);
      expect(card.tags.includes("ROGUE")).toBe(false);
    }
    for (const deck of STARTER_DECKS) {
      for (const mode of ["classic", "blitz"] as const) {
        const ids = starterCardIds(deck.id, mode);
        expect(ids).toHaveLength(mode === "classic" ? 40 : 20);
        const counts = new Map<string, number>();
        for (const id of ids) {
          counts.set(id, (counts.get(id) ?? 0) + 1);
          const card = loaded.registry.get(id);
          expect(card).toBeDefined();
          if (card?.rarity === "lendaria" || card?.rarity === "mitica") {
            expect(counts.get(id)).toBeLessThanOrEqual(1);
          } else {
            expect(counts.get(id)).toBeLessThanOrEqual(3);
          }
        }
      }
    }
  });
});
