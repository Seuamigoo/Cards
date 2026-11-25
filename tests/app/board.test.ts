import { describe, expect, it } from "vitest";
import catalogFile from "../../catalog/cards.json";
import { CardRegistry } from "../../src/catalog/index";
import { GameMatch, getLegalActions } from "../../src/domain/index";
import type { Card, MonsterCard, Rng } from "../../src/domain/index";
import { bandFromCard, monsterBand, towerBand } from "../../app/src/board/bands";
import { cardInstanceKey } from "../../app/src/board/cardKey";
import { applyDuelInput, duelOffers, emptySelection, initialDuelView } from "../../app/src/board/duel";
import { brasaShowcase } from "../../app/src/board/showcase";

const orderedRng: Rng = { next: () => 0.999 };

function monster(id: string, level = 4): MonsterCard {
  return {
    id,
    name: id,
    rarity: "comum",
    kind: "monster",
    level,
    atk: 1000,
    def: 800,
    tags: ["HUMAN", "WARRIOR"],
    keywords: [],
  };
}

function deck(): Card[] {
  return [monster("a"), monster("b"), monster("c"), monster("d"), monster("e"), monster("f"), monster("g")];
}

function opened(mode: "classic" | "blitz" = "classic"): GameMatch {
  const cards = deck();
  const match = new GameMatch(mode, ["voce", "bot"], undefined, { decks: [cards, cards], rng: orderedRng });
  match.dispatch({ type: "advancePhase" });
  return match;
}

describe("chave da carta", () => {
  it("usa instanceId quando o motor carimbar a cópia", () => {
    const card = monster("recruta");
    const locus = { player: 0 as const, zone: "hand" as const, index: 2 };
    expect(cardInstanceKey(card, locus)).toBe("loc:0:hand:2:recruta");
    Object.defineProperty(card, "instanceId", { value: "inst-9" });
    expect(cardInstanceKey(card, locus)).toBe("inst-9");
  });

  it("separa materiais do monstro fundido", () => {
    const card = monster("filhote");
    expect(cardInstanceKey(card, { player: 1, zone: "material", index: 0, material: 2 })).toBe("loc:1:material:0:2:filhote");
  });
});

describe("faixa da carta", () => {
  it("mostra Atk e Def no monstro e DEF atual/impressa na Torre", () => {
    expect(monsterBand(1000, 1200)).toBe("Atk: 1000  Def: 1200");
    expect(towerBand(1800, 2200)).toBe("DEF: 1800/2200");
    expect(bandFromCard({ id: "pocao", name: "Poção", rarity: "comum", kind: "spell" }).kind).toBe("plain");
    expect(bandFromCard({ id: "torre", name: "Torre", rarity: "rara", kind: "tower", def: 2200 })).toEqual({
      kind: "tower",
      current: 2200,
      printed: 2200,
    });
  });
});

describe("ações do tabuleiro", () => {
  it("não repete o botão de invocar: o slot entra no rótulo e só depois da escolha", () => {
    const state = opened().getState();
    const handIndex = state.players[0].hand.findIndex((card) => card.kind === "monster");
    const idle = duelOffers(state, 0, emptySelection());
    expect(idle.pending.filter((item) => item.label.startsWith("Invocar"))).toEqual([]);
    expect(idle.monsterSlots.every((slot) => slot.role !== "summon")).toBe(true);

    const selected = duelOffers(state, 0, { handIndex, tributes: [], materials: [], zoneIndex: null });
    const destinations = selected.monsterSlots.filter((slot) => slot.role === "summon");
    expect(destinations.map((slot) => slot.label)).toEqual([
      "Invocar no slot 1",
      "Invocar no slot 2",
      "Invocar no slot 3",
      "Invocar no slot 4",
      "Invocar no slot 5",
      "Invocar no slot 6",
    ]);
    expect(new Set(destinations.map((slot) => slot.label)).size).toBe(destinations.length);
    expect(selected.pending.filter((item) => item.label.startsWith("Invocar"))).toEqual([]);

    const chosen = duelOffers(state, 0, { handIndex, tributes: [], materials: [], zoneIndex: 0 });
    const labels = chosen.pending.map((item) => item.label);
    expect(labels.filter((label) => label === "Ataque" || label === "Defesa")).toEqual(["Ataque", "Defesa"]);
    expect(labels.some((label) => /^Invocar (?!no slot \d+)/.test(label))).toBe(false);
    expect(labels.some((label) => label.startsWith("Invocar no slot") && label.includes("em"))).toBe(false);
  });

  it("segue a quantidade de slots do modo, sem número fixo", () => {
    const blitz = opened("blitz").getState();
    expect(blitz.config.monsterSlots).toBe(3);
    expect(blitz.config.spellTrapSlots).toBe(3);
    const offers = duelOffers(blitz, 0, emptySelection());
    expect(offers.monsterSlots).toHaveLength(3);
    expect(offers.opponentMonsterSlots).toHaveLength(3);
    expect(offers.spellSlots).toHaveLength(3);

    const custom = new GameMatch("classic", ["voce", "bot"], { monsterSlots: 4, spellTrapSlots: 2 }, {
      decks: [deck(), deck()],
      rng: orderedRng,
    });
    const customOffers = duelOffers(custom.getState(), 0, emptySelection());
    expect(customOffers.monsterSlots).toHaveLength(4);
    expect(customOffers.spellSlots).toHaveLength(2);
  });

  it("dispara a invocação do slot escolhido", () => {
    const state = opened().getState();
    const handIndex = state.players[0].hand.findIndex((card) => card.kind === "monster");
    const hand = applyDuelInput(state, 0, initialDuelView(), { type: "hand", index: handIndex });
    const slot = applyDuelInput(state, 0, hand.view, { type: "own-monster", zoneIndex: 2 });
    expect(slot.action).toBeNull();
    const attack = duelOffers(state, 0, slot.view.selection).pending.find((item) => item.label === "Ataque");
    expect(attack).toBeDefined();
    const done = applyDuelInput(state, 0, slot.view, { type: "pending", id: attack?.id ?? "" });
    expect(done.action).toMatchObject({ type: "summonMonster", zoneIndex: 2, position: "attack", handIndex });
    const dropped = applyDuelInput(state, 0, initialDuelView(), { type: "drop-monster", handIndex, zoneIndex: 1 });
    expect(dropped.action).toBeNull();
    expect(dropped.view.selection).toMatchObject({ handIndex, zoneIndex: 1 });
    const droppedLabels = duelOffers(state, 0, dropped.view.selection).pending.map((item) => item.label);
    expect(droppedLabels).toContain("Ataque");
    expect(droppedLabels).toContain("Defesa");
    expect(droppedLabels.some((label) => /^Invocar (?!no slot \d+)/.test(label))).toBe(false);
  });

  it("oferece cada alvo de ataque uma vez, vindo do motor", () => {
    const cards = deck();
    const match = new GameMatch("classic", ["voce", "bot"], undefined, { decks: [cards, cards], rng: orderedRng });
    match.dispatch({ type: "advancePhase" });
    const first = match.getState().players[0].hand.findIndex((card) => card.kind === "monster");
    match.dispatch({ type: "summonMonster", handIndex: first, zoneIndex: 0, position: "attack", tributeZoneIndexes: [] });
    endTurn(match);
    endTurn(match);
    match.dispatch({ type: "advancePhase" });
    match.dispatch({ type: "advancePhase" });
    const state = match.getState();
    expect(state.phase).toBe("battle");
    const legalTargets = getLegalActions(state, 0).filter((action) => action.type === "attack");
    expect(legalTargets.length).toBeGreaterThan(0);

    const idle = duelOffers(state, 0, emptySelection());
    expect(idle.attackPlayer).toBeNull();
    expect(idle.opponentMonsterSlots.every((slot) => slot.role !== "attack")).toBe(true);

    const aiming = duelOffers(state, 0, { handIndex: null, tributes: [], materials: [], zoneIndex: 0 });
    const attackLabels = [
      ...aiming.opponentMonsterSlots.filter((slot) => slot.role === "attack").map((slot) => slot.label),
      aiming.opponentTower.role === "attack" ? aiming.opponentTower.label : "",
      aiming.attackPlayer?.label ?? "",
    ].filter((label) => label.length > 0);
    expect(new Set(attackLabels).size).toBe(attackLabels.length);
    expect(attackLabels).toContain("Atacar o jogador");
    expect(aiming.pending.filter((item) => item.label.startsWith("Atacar"))).toEqual([]);
  });
});

describe("mesa do Dragão Brasa", () => {
  it("coloca o dragão com três materiais pelo dispatch do motor", () => {
    const loaded = CardRegistry.fromJSON(JSON.stringify(catalogFile));
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    const showcase = brasaShowcase(loaded.registry);
    expect(showcase.ok).toBe(true);
    if (!showcase.ok) {
      return;
    }
    const you = showcase.match.getState().players[0];
    const dragon = you.monsterZone.find((slot) => slot?.card.id === "dragao-brasa");
    expect(dragon?.materials?.map((card) => card.id)).toEqual(["filhote-de-brasa", "filhote-de-brasa", "filhote-de-brasa"]);
    expect(dragon?.position).toBe("attack");
    const foe = showcase.match.getState().players[1];
    expect(foe.monsterZone.some((slot) => slot?.position === "defense")).toBe(true);
    expect(you.towerZone).not.toBeNull();
    expect(you.biomeZone).not.toBeNull();
    expect(foe.limbo.length).toBeGreaterThan(0);
  });
});

function endTurn(match: GameMatch): void {
  const player = match.getState().activePlayerIndex;
  for (let step = 0; step < 8 && match.getState().activePlayerIndex === player && match.getState().winner === null; step += 1) {
    const result = match.dispatch({ type: "advancePhase" });
    if (!result.ok) {
      throw new Error(result.error);
    }
  }
}
