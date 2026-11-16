import { describe, expect, it } from "vitest";
import { MODE_CONFIGS, createInitialState } from "../../src/domain/index";
import type { PlayerState } from "../../src/domain/index";

type AssertNoTowerHp = "towerHp" extends keyof PlayerState ? never : true;

describe("createInitialState", () => {
  it("não declara towerHp em PlayerState", () => {
    const noTowerHp: AssertNoTowerHp = true;
    expect(noTowerHp).toBe(true);
  });

  it.each(["classic", "blitz"] as const)(
    "monta o estado inicial do modo %s",
    (mode) => {
      const config = MODE_CONFIGS[mode];
      const state = createInitialState(config, ["lina", "kael"]);

      expect(state.config).toEqual(config);
      expect(state.config).not.toBe(config);
      expect(state.turn).toBe(1);
      expect(state.activePlayerIndex).toBe(0);
      expect(state.phase).toBe("draw");
      expect(state.players).toHaveLength(2);

      for (const [index, player] of state.players.entries()) {
        expect(player.id).toBe(index === 0 ? "lina" : "kael");
        expect(player.hp).toBe(config.playerHp);
        expect(player).not.toHaveProperty("towerHp");
        expect(player.hand).toEqual([]);
        expect(player.deck).toEqual([]);
        expect(player.graveyard).toEqual([]);
        expect(player.monsterZone).toHaveLength(config.monsterSlots);
        expect(player.spellTrapZone).toHaveLength(config.spellTrapSlots);
        expect(player.monsterZone.every((slot) => slot === null)).toBe(true);
        expect(player.spellTrapZone.every((slot) => slot === null)).toBe(true);
        expect(player.towerZone).toBeNull();
        expect(player.biomeZone).toBeNull();
      }

      const [first, second] = state.players;
      expect(first.monsterZone).not.toBe(second.monsterZone);
      expect(first.spellTrapZone).not.toBe(second.spellTrapZone);
      expect(first.hand).not.toBe(second.hand);
      expect(first.deck).not.toBe(second.deck);
      expect(first.graveyard).not.toBe(second.graveyard);
    },
  );
});
