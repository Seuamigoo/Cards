import { describe, expect, it } from "vitest";
import { GameMatch, resolveConfig } from "../../src/domain/index";
import type {
  BiomeCard,
  BoardState,
  Card,
  GameEventMap,
  MonsterCard,
  MonsterInstance,
  PlayerState,
  Rng,
  SpellCard,
  TowerCard,
  TrapCard,
} from "../../src/domain/index";

const identityRng: Rng = { next: () => 0.999 };

function monster(
  id: string,
  atk = 1000,
  def = 800,
  level = 4,
  tags: readonly string[] = ["HUMAN", "WARRIOR"],
  keywords: MonsterCard["keywords"] = [],
): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", level, atk, def, tags, keywords };
}

function spell(id: string): SpellCard {
  return { id, name: id, rarity: "incomum", kind: "spell" };
}

function trap(id: string): TrapCard {
  return { id, name: id, rarity: "rara", kind: "trap" };
}

function tower(id: string, def = 1500): TowerCard {
  return { id, name: id, rarity: "epica", kind: "tower", def };
}

function biome(id: string): BiomeCard {
  return { id, name: id, rarity: "lendaria", kind: "biome" };
}

function placed(card: MonsterCard, position: MonsterInstance["position"] = "attack"): MonsterInstance {
  return { card, position, summonedThisTurn: false, changedPositionThisTurn: false, attackedThisTurn: false };
}

function board(options: {
  phase?: BoardState["phase"];
  turn?: number;
  active?: 0 | 1;
  ownZone?: readonly (MonsterInstance | null)[];
  enemyZone?: readonly (MonsterInstance | null)[];
  ownHand?: readonly Card[];
  enemyHand?: readonly Card[];
  ownTower?: TowerCard | null;
  enemyTower?: TowerCard | null;
  ownHp?: number;
  enemyHp?: number;
}): GameMatch {
  const config = resolveConfig("classic", { monsterSlots: 3, playerHp: 8000 });
  const zone = (slots: readonly (MonsterInstance | null)[] | undefined): (MonsterInstance | null)[] => {
    const filled = slots === undefined ? [] : [...slots];
    while (filled.length < config.monsterSlots) {
      filled.push(null);
    }
    return filled.slice(0, config.monsterSlots);
  };
  const player = (
    id: string,
    hp: number,
    hand: readonly Card[],
    monsters: readonly (MonsterInstance | null)[] | undefined,
    towerCard: TowerCard | null | undefined,
  ): PlayerState => ({
    id,
    hp,
    hand: [...hand],
    deck: [monster("compra", 0, 0, 1)],
    monsterZone: zone(monsters),
    spellTrapZone: Array.from({ length: config.spellTrapSlots }, () => null),
    towerZone: towerCard === undefined || towerCard === null ? null : { card: towerCard, defBonus: 0 },
    biomeZone: null,
    graveyard: [],
    limbo: [],
    towerSummonedThisTurn: false,
    normalSummonedThisTurn: false,
    lineageDeck: [],
    convergedThisTurn: false,
  });
  const state: BoardState = {
    config,
    turn: options.turn ?? 2,
    activePlayerIndex: options.active ?? 0,
    phase: options.phase ?? "main1",
    winner: null,
    players: [
      player("lina", options.ownHp ?? 8000, options.ownHand ?? [], options.ownZone, options.ownTower),
      player("kael", options.enemyHp ?? 8000, options.enemyHand ?? [], options.enemyZone, options.enemyTower),
    ],
  };
  return GameMatch.fromState(state);
}

function trace(match: GameMatch): string[] {
  const lines: string[] = [];
  const on = <K extends keyof GameEventMap>(name: K, detail: (payload: GameEventMap[K]) => string): void => {
    match.events.on(name, (payload) => {
      lines.push(`${name} ${detail(payload)}`);
    });
  };
  on("phase:changed", (payload) => `${payload.from}>${payload.to} t${payload.turn} p${payload.activePlayerIndex}`);
  on("turn:started", (payload) => `t${payload.turn} p${payload.activePlayerIndex}`);
  on("card:drawn", (payload) => `p${payload.playerIndex} ${payload.cardId} ${payload.instanceId}`);
  on("monster:summoned", (payload) => `p${payload.playerIndex} z${payload.zoneIndex} ${payload.position} ${payload.cardId} ${payload.instanceId}`);
  on("monster:position", (payload) => `p${payload.playerIndex} z${payload.zoneIndex} ${payload.position} ${payload.cardId} ${payload.instanceId}`);
  on("spelltrap:set", (payload) => `p${payload.playerIndex} z${payload.zoneIndex} ${payload.card.kind} ${payload.cardId} ${payload.instanceId}`);
  on("spelltrap:activated", (payload) => `p${payload.playerIndex} z${payload.zoneIndex} ${payload.cardId} ${payload.instanceId}`);
  on("effect:activated", (payload) => `p${payload.playerIndex} z${payload.zoneIndex ?? "torre"} ${payload.kind} ${payload.cardId} ${payload.instanceId}`);
  on("monster:fused", (payload) => `p${payload.playerIndex} z${payload.zoneIndex} ${payload.position} ${payload.cardId} ${payload.instanceId} [${payload.materialInstanceIds.join(",")}]`);
  on("materials:released", (payload) => `p${payload.playerIndex} z${payload.zoneIndex} ${payload.cardId} ${payload.instanceId} [${payload.materialInstanceIds.join(",")}]`);
  on("card:sent", (payload) => `p${payload.playerIndex} ${payload.destination} ${payload.from} z${payload.zoneIndex ?? "-"} ${payload.cardId} ${payload.instanceId}`);
  on("tower:summoned", (payload) => `p${payload.playerIndex} ${payload.cardId} ${payload.instanceId} def${payload.def}`);
  on("tower:destroyed", (payload) => `p${payload.playerIndex} ${payload.cardId} ${payload.instanceId}`);
  on("biome:played", (payload) => `p${payload.playerIndex} ${payload.cardId} ${payload.instanceId} era:${payload.replaced?.id ?? "nenhum"}`);
  on("biome:left", (payload) => `p${payload.playerIndex} ${payload.cardId} ${payload.instanceId}`);
  on("attack:declared", (payload) => `p${payload.playerIndex} z${payload.attackerZoneIndex} ${payload.cardId} ${payload.instanceId} -> ${payload.target.kind} ${payload.targetCardId ?? "-"} ${payload.targetInstanceId ?? "-"}`);
  on("monster:destroyed", (payload) => `p${payload.playerIndex} z${payload.zoneIndex} ${payload.cardId} ${payload.instanceId}`);
  on("damage:dealt", (payload) => `${payload.source} ${payload.target} p${payload.playerIndex} z${payload.zoneIndex ?? "-"} ${payload.amount} ${payload.cardId ?? "-"}`);
  on("game:over", (payload) => `${payload.reason} ${payload.winner}`);
  return lines;
}

function ok(result: { ok: boolean; error?: string }): void {
  expect(result.ok ? "ok" : result.error).toBe("ok");
}

describe("linha do tempo dos eventos", () => {
  it("invoca com posição, tributo ao Limbo, efeito e dano", () => {
    const spark = board({
      ownHand: [monster("fagulha-viva", 200, 200, 2, ["ELEMENTAL", "MAGE"])],
    });
    const sparkId = spark.getState().players[0].hand[0]?.instanceId ?? "";
    const sparkLines = trace(spark);
    ok(spark.dispatch({ type: "summonMonster", handIndex: 0, zoneIndex: 0, position: "defense", tributeZoneIndexes: [] }));
    expect(sparkLines).toEqual([
      `monster:summoned p0 z0 defense fagulha-viva ${sparkId}`,
      `effect:activated p0 z0 onSummon fagulha-viva ${sparkId}`,
      "damage:dealt effect player p1 z- 200 -",
    ]);
    expect(spark.getState().players[0].monsterZone[0]?.card.instanceId).toBe(sparkId);
    expect(spark.getState().players[1].hp).toBe(7800);

    const priest = board({
      ownHand: [monster("sacerdote-das-runas", 800, 1500, 4, ["DWARF", "CLERIC"])],
    });
    const priestId = priest.getState().players[0].hand[0]?.instanceId ?? "";
    const priestLines = trace(priest);
    ok(priest.dispatch({ type: "summonMonster", handIndex: 0, zoneIndex: 1, position: "attack", tributeZoneIndexes: [] }));
    expect(priestLines).toEqual([
      `monster:summoned p0 z1 attack sacerdote-das-runas ${priestId}`,
      `effect:activated p0 z1 aura sacerdote-das-runas ${priestId}`,
    ]);

    const scout = board({
      ownHand: [monster("batedora-da-folhagem", 900, 700, 3, ["ELF", "ARCHER"])],
      enemyTower: tower("torre", 2000),
    });
    const scoutId = scout.getState().players[0].hand[0]?.instanceId ?? "";
    const scoutLines = trace(scout);
    ok(scout.dispatch({ type: "summonMonster", handIndex: 0, zoneIndex: 2, position: "attack", tributeZoneIndexes: [] }));
    expect(scoutLines).toEqual([
      `monster:summoned p0 z2 attack batedora-da-folhagem ${scoutId}`,
      `effect:activated p0 z2 onSummon batedora-da-folhagem ${scoutId}`,
      "damage:dealt effect tower p1 z- 300 torre",
    ]);

    const mist = board({
      ownHand: [monster("espirito-da-nevoa", 400, 400, 2, ["ELEMENTAL", "MAGE"])],
      enemyZone: [placed(monster("alvo", 1000, 1000))],
    });
    const mistId = mist.getState().players[0].hand[0]?.instanceId ?? "";
    const mistLines = trace(mist);
    ok(mist.dispatch({
      type: "summonMonster",
      handIndex: 0,
      zoneIndex: 0,
      position: "attack",
      tributeZoneIndexes: [],
      effectTargetZoneIndex: 0,
    }));
    expect(mistLines).toEqual([
      `monster:summoned p0 z0 attack espirito-da-nevoa ${mistId}`,
      `effect:activated p0 z0 onSummon espirito-da-nevoa ${mistId}`,
      "damage:dealt effect monster p1 z0 400 alvo",
    ]);

    const tribute = board({
      ownZone: [placed(monster("oferta", 100, 100, 1))],
      ownHand: [monster("campeao", 2000, 1800, 5)],
    });
    const offered = tribute.getState().players[0].monsterZone[0];
    const champId = tribute.getState().players[0].hand[0]?.instanceId ?? "";
    const tributeLines = trace(tribute);
    ok(tribute.dispatch({
      type: "summonMonster",
      handIndex: 0,
      zoneIndex: 0,
      position: "defense",
      tributeZoneIndexes: [0],
    }));
    expect(tributeLines).toEqual([
      `card:sent p0 limbo monster z0 oferta ${offered?.card.instanceId ?? ""}`,
      `monster:summoned p0 z0 defense campeao ${champId}`,
    ]);
    expect(tributeLines.some((line) => line.startsWith("monster:destroyed"))).toBe(false);
  });

  it("muda a posição e coloca magia e armadilha sem ativá-las", () => {
    const match = board({
      ownZone: [placed(monster("guarda"))],
      ownHand: [spell("lamina"), trap("rede")],
    });
    const slot = match.getState().players[0].monsterZone[0];
    const lines = trace(match);
    ok(match.dispatch({ type: "changePosition", zoneIndex: 0 }));
    expect(lines).toEqual([
      `monster:position p0 z0 defense ${slot?.card.id ?? ""} ${slot?.card.instanceId ?? ""}`,
    ]);

    lines.length = 0;
    const spellId = match.getState().players[0].hand[0]?.instanceId ?? "";
    ok(match.dispatch({ type: "setSpellTrap", handIndex: 0, zoneIndex: 2 }));
    const trapId = match.getState().players[0].hand[0]?.instanceId ?? "";
    ok(match.dispatch({ type: "setSpellTrap", handIndex: 0, zoneIndex: 0 }));
    expect(lines).toEqual([
      `spelltrap:set p0 z2 spell lamina ${spellId}`,
      `spelltrap:set p0 z0 trap rede ${trapId}`,
    ]);
    expect(lines.some((line) => line.startsWith("spelltrap:activated"))).toBe(false);
  });

  it("ativa o efeito de uma vez por turno", () => {
    const healer = monster("serafim-justiceiro", 1400, 1600, 4, ["ANGEL", "CLERIC"]);
    const match = board({
      ownZone: [placed(healer)],
      ownHp: 7000,
    });
    const slot = match.getState().players[0].monsterZone[0];
    const lines = trace(match);
    ok(match.dispatch({ type: "activate", zoneIndex: 0 }));
    expect(lines).toEqual([
      `effect:activated p0 z0 activate serafim-justiceiro ${slot?.card.instanceId ?? ""}`,
    ]);
    expect(match.getState().players[0].hp).toBe(7500);
  });

  it("declara ataque e aplica dano, destruição e destino", () => {
    const direct = board({
      phase: "battle",
      ownZone: [placed(monster("golpe", 500, 0))],
      enemyHp: 2000,
    });
    const attacker = direct.getState().players[0].monsterZone[0];
    const directLines = trace(direct);
    ok(direct.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "player" } }));
    expect(directLines).toEqual([
      `attack:declared p0 z0 golpe ${attacker?.card.instanceId ?? ""} -> player - -`,
      "damage:dealt battle player p1 z- 500 -",
    ]);

    const lethal = board({
      phase: "battle",
      ownZone: [placed(monster("golpe", 500, 0))],
      enemyHp: 500,
    });
    const lethalLines = trace(lethal);
    ok(lethal.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "player" } }));
    expect(lethalLines.map((line) => line.split(" ")[0])).toEqual(["attack:declared", "damage:dealt", "game:over"]);
    expect(lethalLines[2]).toBe("game:over player_hp 0");

    const battle = board({
      phase: "battle",
      ownZone: [placed(monster("golpe", 1600, 1000))],
      enemyZone: [placed(monster("fraco", 900, 400))],
    });
    const strike = battle.getState().players[0].monsterZone[0];
    const victim = battle.getState().players[1].monsterZone[0];
    const battleLines = trace(battle);
    ok(battle.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } }));
    expect(battleLines).toEqual([
      `attack:declared p0 z0 golpe ${strike?.card.instanceId ?? ""} -> monster fraco ${victim?.card.instanceId ?? ""}`,
      "damage:dealt battle monster p1 z0 700 fraco",
      "damage:dealt battle player p1 z- 700 -",
      `monster:destroyed p1 z0 fraco ${victim?.card.instanceId ?? ""}`,
      `card:sent p1 graveyard monster z0 fraco ${victim?.card.instanceId ?? ""}`,
    ]);

    const defense = board({
      phase: "battle",
      ownZone: [placed(monster("golpe", 1500, 0))],
      enemyZone: [placed(monster("muro", 100, 1000), "defense")],
    });
    const wall = defense.getState().players[1].monsterZone[0];
    const defenseLines = trace(defense);
    ok(defense.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } }));
    expect(defenseLines.map((line) => line.split(" ")[0])).toEqual(["attack:declared", "monster:destroyed", "card:sent"]);
    expect(defenseLines[2]).toContain(`graveyard monster z0 muro ${wall?.card.instanceId ?? ""}`);

    const pierced = board({
      phase: "battle",
      ownZone: [placed(monster("agulha", 1500, 0, 4, ["HUMAN", "WARRIOR"], ["perfurar"]))],
      enemyZone: [placed(monster("muro", 100, 1000), "defense")],
    });
    const piercedLines = trace(pierced);
    ok(pierced.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } }));
    expect(piercedLines.map((line) => line.split(" ")[0])).toEqual([
      "attack:declared",
      "damage:dealt",
      "damage:dealt",
      "monster:destroyed",
      "card:sent",
    ]);
    expect(piercedLines[1]).toBe("damage:dealt battle monster p1 z0 500 muro");
    expect(piercedLines[4]).toContain("graveyard");

    const mixed = board({
      phase: "battle",
      ownZone: [placed(monster("golpe", 2000, 0))],
      enemyZone: [placed(monster("mestiço", 500, 500, 4, ["ELF", "BEAST", "WARRIOR"]))],
    });
    const mixedLines = trace(mixed);
    ok(mixed.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } }));
    expect(mixedLines.at(-1)).toContain("limbo monster z0 mestiço");

    const towerHit = board({
      phase: "battle",
      ownZone: [placed(monster("aríete", 1500, 0))],
      enemyTower: tower("cidadela", 1000),
    });
    const ram = towerHit.getState().players[0].monsterZone[0];
    const fort = towerHit.getState().players[1].towerZone;
    const towerLines = trace(towerHit);
    ok(towerHit.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "tower" } }));
    expect(towerLines).toEqual([
      `attack:declared p0 z0 aríete ${ram?.card.instanceId ?? ""} -> tower cidadela ${fort?.card.instanceId ?? ""}`,
      "damage:dealt battle tower p1 z- 1500 cidadela",
      `tower:destroyed p1 cidadela ${fort?.card.instanceId ?? ""}`,
      `card:sent p1 limbo tower z- cidadela ${fort?.card.instanceId ?? ""}`,
    ]);

    const bounce = board({
      phase: "battle",
      ownZone: [placed(monster("fraco", 400, 0))],
      enemyTower: tower("muralha", 1000),
    });
    const bounceLines = trace(bounce);
    ok(bounce.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "tower" } }));
    expect(bounceLines.map((line) => line.split(" ")[0])).toEqual(["attack:declared", "damage:dealt", "damage:dealt"]);
    expect(bounceLines[1]).toContain("battle tower");
    expect(bounceLines[2]).toBe("damage:dealt battle player p0 z- 600 -");

    const trade = board({
      phase: "battle",
      ownZone: [placed(monster("a", 1000, 0))],
      enemyZone: [placed(monster("b", 1000, 0))],
    });
    const tradeLines = trace(trade);
    ok(trade.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } }));
    expect(tradeLines.map((line) => line.split(" ")[0])).toEqual([
      "attack:declared",
      "monster:destroyed",
      "monster:destroyed",
      "card:sent",
      "card:sent",
    ]);
    expect(tradeLines[1]).toContain("p1 z0 b");
    expect(tradeLines[2]).toContain("p0 z0 a");
    expect(tradeLines[3]).toContain("graveyard monster z0 b");
    expect(tradeLines[4]).toContain("graveyard monster z0 a");

    const crash = board({
      phase: "battle",
      ownZone: [placed(monster("fraco", 400, 0))],
      enemyZone: [placed(monster("forte", 1200, 0))],
    });
    const crashLines = trace(crash);
    ok(crash.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } }));
    expect(crashLines.map((line) => line.split(" ")[0])).toEqual([
      "attack:declared",
      "damage:dealt",
      "damage:dealt",
      "monster:destroyed",
      "card:sent",
    ]);
    expect(crashLines[1]).toBe("damage:dealt battle monster p0 z0 800 fraco");
    expect(crashLines[2]).toBe("damage:dealt battle player p0 z- 800 -");
    expect(crashLines[3]).toContain("p0 z0 fraco");
  });

  it("coloca, substitui e destrói a Torre, e troca o bioma", () => {
    const match = board({
      ownHand: [tower("arvore-sentinela", 1800), tower("fortaleza", 2000), biome("floresta"), biome("deserto")],
      ownTower: tower("velha", 900),
    });
    const previous = match.getState().players[0].towerZone;
    const lines = trace(match);
    ok(match.dispatch({ type: "summonTower", handIndex: 0 }));
    const placedTower = match.getState().players[0].towerZone;
    expect(lines).toEqual([
      `tower:destroyed p0 velha ${previous?.card.instanceId ?? ""}`,
      `card:sent p0 limbo tower z- velha ${previous?.card.instanceId ?? ""}`,
      `tower:summoned p0 arvore-sentinela ${placedTower?.card.instanceId ?? ""} def1800`,
      `effect:activated p0 ztorre aura arvore-sentinela ${placedTower?.card.instanceId ?? ""}`,
    ]);

    lines.length = 0;
    const destroyed = match.destroyTower(0);
    ok(destroyed);
    expect(lines).toEqual([
      `tower:destroyed p0 arvore-sentinela ${placedTower?.card.instanceId ?? ""}`,
      `card:sent p0 limbo tower z- arvore-sentinela ${placedTower?.card.instanceId ?? ""}`,
    ]);

    lines.length = 0;
    const forest = match.getState().players[0].hand.find((card) => card.id === "floresta");
    const forestIndex = match.getState().players[0].hand.findIndex((card) => card.id === "floresta");
    ok(match.dispatch({ type: "playBiome", handIndex: forestIndex }));
    expect(lines).toEqual([`biome:played p0 floresta ${forest?.instanceId ?? ""} era:nenhum`]);

    lines.length = 0;
    const desert = match.getState().players[0].hand.find((card) => card.id === "deserto");
    const desertIndex = match.getState().players[0].hand.findIndex((card) => card.id === "deserto");
    ok(match.dispatch({ type: "playBiome", handIndex: desertIndex }));
    expect(lines).toEqual([
      `biome:left p0 floresta ${forest?.instanceId ?? ""}`,
      `card:sent p0 limbo biome z- floresta ${forest?.instanceId ?? ""}`,
      `biome:played p0 deserto ${desert?.instanceId ?? ""} era:floresta`,
    ]);
  });

  it("funde o Dragão Brasa e solta os materiais no Limbo sem disparar o Filhote", () => {
    const hatch = (): MonsterInstance => placed(monster("filhote-de-brasa", 1100, 900, 3, ["DRAGON", "WARRIOR"]));
    const match = board({
      ownZone: [hatch(), hatch(), hatch()],
      ownHand: [monster("dragao-brasa", 1800, 2200, 7, ["DRAGON", "WARRIOR"])],
    });
    const dragonId = match.getState().players[0].hand[0]?.instanceId ?? "";
    const materialIds = [0, 1, 2].map((index) => match.getState().players[0].monsterZone[index]?.card.instanceId ?? "");
    const lines = trace(match);
    ok(match.dispatch({
      type: "fuseBrasa",
      handIndex: 0,
      zoneIndex: 0,
      position: "attack",
      materialZoneIndexes: [0, 1, 2],
    }));
    expect(lines).toEqual([
      `monster:summoned p0 z0 attack dragao-brasa ${dragonId}`,
      `monster:fused p0 z0 attack dragao-brasa ${dragonId} [${materialIds.join(",")}]`,
    ]);
    expect(match.getState().players[0].hp).toBe(8000);
    expect(match.getState().players[1].hp).toBe(8000);

    const battle = GameMatch.fromState({
      ...match.getState(),
      phase: "battle",
      players: [
        {
          ...match.getState().players[1],
          monsterZone: [placed(monster("golpe", 3000, 0)), null, null],
        },
        match.getState().players[0],
      ],
    });
    const battleLines = trace(battle);
    ok(battle.dispatch({ type: "attack", attackerZoneIndex: 0, target: { kind: "monster", zoneIndex: 0 } }));
    expect(battleLines.map((line) => line.split(" ")[0])).toEqual([
      "attack:declared",
      "damage:dealt",
      "damage:dealt",
      "monster:destroyed",
      "card:sent",
      "materials:released",
      "card:sent",
      "card:sent",
      "card:sent",
    ]);
    expect(battleLines[4]).toContain(`limbo monster z0 dragao-brasa ${dragonId}`);
    expect(battleLines[5]).toContain(`[${materialIds.join(",")}]`);
    expect(battleLines.slice(6).map((line) => line.split(" ")[5])).toEqual(["filhote-de-brasa", "filhote-de-brasa", "filhote-de-brasa"]);
    expect(battleLines.slice(6).map((line) => line.split(" ")[6])).toEqual(materialIds);
    expect(battle.getState().players[0].hp).toBe(8000);
  });

  it("troca de fase e de turno, com descarte de mão antes da compra", () => {
    const cards = [monster("m1"), monster("m2"), monster("m3"), monster("m4")];
    const match = new GameMatch("classic", ["lina", "kael"], { openingHandSize: 1, handLimit: 6 }, {
      decks: [cards, cards],
      rng: identityRng,
    });
    const lines = trace(match);
    ok(match.dispatch({ type: "advancePhase" }));
    expect(lines).toEqual(["phase:changed draw>main1 t1 p0"]);

    for (let step = 0; step < 2; step += 1) {
      ok(match.dispatch({ type: "advancePhase" }));
    }
    lines.length = 0;
    ok(match.dispatch({ type: "advancePhase" }));
    const drawn = match.getState().players[1].hand.at(-1);
    expect(lines).toEqual([
      "phase:changed end>draw t2 p1",
      "turn:started t2 p1",
      `card:drawn p1 ${drawn?.id ?? ""} ${drawn?.instanceId ?? ""}`,
    ]);

    const crowded = new GameMatch("classic", ["lina", "kael"], { openingHandSize: 3, handLimit: 2 }, {
      decks: [cards, cards],
      rng: identityRng,
    });
    ok(crowded.dispatch({ type: "advancePhase" }));
    ok(crowded.dispatch({ type: "advancePhase" }));
    ok(crowded.dispatch({ type: "advancePhase" }));
    const beforeHand = crowded.getState().players[0].hand;
    const extras = beforeHand.slice(2);
    const discardLines = trace(crowded);
    ok(crowded.dispatch({ type: "advancePhase" }));
    expect(discardLines[0]).toBe("phase:changed end>draw t2 p1");
    expect(discardLines.slice(1, 1 + extras.length)).toEqual(
      extras.map((card) => `card:sent p0 limbo hand z${beforeHand.findIndex((item) => item.instanceId === card.instanceId)} ${card.id} ${card.instanceId ?? ""}`),
    );
    expect(discardLines.at(-2)).toBe("turn:started t2 p1");
    expect(discardLines.at(-1)).toContain("card:drawn p1");
  });
});
