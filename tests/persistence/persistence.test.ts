import { describe, expect, it } from "vitest";
import { GameMatch, createInitialState, resolveConfig } from "../../src/domain/index";
import type { MonsterCard, Rng } from "../../src/domain/index";
import {
  LocalStorageAdapter,
  MemoryStorageAdapter,
  ProfileRepository,
  SAVE_VERSION,
  deserializeMatch,
  loadMatch,
  migrate,
  saveMatch,
  serializeMatch,
  tryCreateLocalStorageAdapter,
} from "../../src/persistence/index";

const identityRng: Rng = { next: () => 0.999 };

function monster(id: string): MonsterCard {
  return { id, name: id, rarity: "comum", kind: "monster", level: 4, atk: 100, def: 100, tags: ["HUMAN", "WARRIOR"], keywords: [] };
}

function deckIds(size: number, prefix: string): string[] {
  return Array.from({ length: size }, (_, index) => `${prefix}-${index}`);
}

describe("partida", () => {
  it("salva, carrega e continua sem alterar a partida original", async () => {
    const cards = [monster("m1"), monster("m2")];
    const match = new GameMatch("classic", ["lina", "kael"], { openingHandSize: 2 }, {
      decks: [cards, cards],
      rng: identityRng,
    });
    match.advancePhase();
    expect(match.dispatch({ type: "summonMonster", handIndex: 1, zoneIndex: 0, position: "attack", tributeZoneIndexes: [] }).ok).toBe(true);
    const saved = match.getState();

    const adapter = new MemoryStorageAdapter();
    await saveMatch(adapter, "partida-1", saved);
    const loaded = await loadMatch(adapter, "partida-1");
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) {
      return;
    }
    expect(loaded.value).toEqual(saved);

    const resumed = GameMatch.fromState(loaded.value);
    expect(resumed.getState()).toEqual(saved);
    expect(resumed.getState()).not.toBe(saved);
    expect(resumed.getState().players[0].monsterZone[0]?.card.id).toBe("m1");
    expect(resumed.dispatch({ type: "advancePhase" }).ok).toBe(true);
    expect(resumed.getState().phase).toBe("main2");
    expect(match.getState()).toEqual(saved);
    expect(match.getState().phase).toBe("main1");
  });

  it("rejeita JSON corrompido e versão futura", () => {
    expect(deserializeMatch("{").ok).toBe(false);
    expect(deserializeMatch("null").ok).toBe(false);
    const future = deserializeMatch(JSON.stringify({ version: SAVE_VERSION + 1, state: {} }));
    expect(future.ok).toBe(false);
    if (!future.ok) {
      expect(future.error.code).toBe("migration");
    }
    const broken = deserializeMatch(JSON.stringify({ version: SAVE_VERSION, state: { turn: "x" } }));
    expect(broken.ok).toBe(false);
    if (!broken.ok) {
      expect(broken.error.code).toBe("invalid");
    }
  });

  it("migra um save v0 para o schema atual", () => {
    const config = resolveConfig("blitz");
    const state = createInitialState(config, ["lina", "kael"]);
    const raw = JSON.parse(serializeMatch(state)) as {
      version: number;
      state: {
        winner?: unknown;
        players: Array<Record<string, unknown>>;
      };
    };
    raw.version = 0;
    delete raw.state.winner;
    for (const player of raw.state.players) {
      delete player.limbo;
      delete player.towerSummonedThisTurn;
      delete player.normalSummonedThisTurn;
    }

    const migrated = migrate(raw);
    expect(migrated.ok).toBe(true);
    const loaded = deserializeMatch(JSON.stringify(raw));
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value).toEqual(state);
      expect(loaded.value.winner).toBeNull();
      expect(loaded.value.players[0].limbo).toEqual([]);
      expect(loaded.value.players[0].normalSummonedThisTurn).toBe(false);
    }
  });
});

describe("perfil", () => {
  function repository(adapter: MemoryStorageAdapter): ProfileRepository {
    let tick = 0;
    return new ProfileRepository(adapter, () => {
      tick += 1;
      return `2026-01-01T00:00:0${tick}.000Z`;
    });
  }

  it("cria o perfil padrão e registra o resultado da partida", async () => {
    const adapter = new MemoryStorageAdapter();
    const repo = repository(adapter);
    const created = await repo.load("ana");
    expect(created.ok).toBe(true);
    if (!created.ok) {
      return;
    }
    expect(created.value).toMatchObject({
      version: SAVE_VERSION,
      playerId: "ana",
      name: "ana",
      collection: [],
      decks: [],
      stats: { wins: 0, losses: 0, matchesPlayed: 0 },
    });

    expect((await repo.recordMatchResult("ana", "win")).ok).toBe(true);
    expect((await repo.recordMatchResult("ana", "loss")).ok).toBe(true);
    const reloaded = await repository(adapter).load("ana");
    expect(reloaded.ok).toBe(true);
    if (reloaded.ok) {
      expect(reloaded.value.stats).toEqual({ wins: 1, losses: 1, matchesPlayed: 2 });
    }
  });

  it("soma cartas, grava deck válido e rejeita deck fora do tamanho", async () => {
    const adapter = new MemoryStorageAdapter();
    const repo = repository(adapter);
    const added = await repo.addCards("ana", [
      { cardId: "m1", quantity: 2 },
      { cardId: "m1", quantity: 1 },
    ]);
    expect(added.ok).toBe(true);
    if (added.ok) {
      expect(added.value.collection).toEqual([{ cardId: "m1", quantity: 3 }]);
    }

    const invalid = await repo.saveDeck("ana", {
      id: "curto",
      name: "Curto",
      mode: "blitz",
      cardIds: deckIds(3, "c"),
    });
    expect(invalid.ok).toBe(false);
    if (!invalid.ok) {
      expect(invalid.error.code).toBe("invalid");
      expect(invalid.error.message).toMatch(/entre 20 e 30/);
    }

    const saved = await repo.saveDeck("ana", {
      id: "principal",
      name: "Principal",
      mode: "blitz",
      cardIds: deckIds(20, "b"),
    });
    expect(saved.ok).toBe(true);
    expect((await repo.deleteDeck("ana", "ausente")).ok).toBe(false);
    expect((await repo.deleteDeck("ana", "principal")).ok).toBe(true);
    const after = await repo.load("ana");
    expect(after.ok).toBe(true);
    if (after.ok) {
      expect(after.value.decks).toEqual([]);
      expect(after.value.collection).toEqual([{ cardId: "m1", quantity: 3 }]);
    }
  });

  it("rejeita JSON corrompido sem substituir o perfil", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set("profile:ana", "{");
    const loaded = await repository(adapter).load("ana");
    expect(loaded.ok).toBe(false);
    if (!loaded.ok) {
      expect(loaded.error.code).toBe("corrupt");
    }
    expect(await adapter.get("profile:ana")).toBe("{");
  });

  it("migra um perfil v0", async () => {
    const adapter = new MemoryStorageAdapter();
    await adapter.set(
      "profile:ana",
      JSON.stringify({
        version: 0,
        playerId: "ana",
        name: "Ana",
        collection: [{ cardId: "m1", quantity: 1 }],
        decks: [],
      }),
    );
    const loaded = await repository(adapter).load("ana");
    expect(loaded.ok).toBe(true);
    if (loaded.ok) {
      expect(loaded.value.version).toBe(SAVE_VERSION);
      expect(loaded.value.name).toBe("Ana");
      expect(loaded.value.stats).toEqual({ wins: 0, losses: 0, matchesPlayed: 0 });
      expect(loaded.value.collection).toEqual([{ cardId: "m1", quantity: 1 }]);
    }
  });
});

describe("LocalStorageAdapter", () => {
  it("usa um armazenamento explícito e só cria o adapter global quando localStorage existe", async () => {
    const values = new Map<string, string>();
    const adapter = new LocalStorageAdapter({
      getItem: (key) => values.get(key) ?? null,
      setItem: (key, value) => {
        values.set(key, value);
      },
      removeItem: (key) => {
        values.delete(key);
      },
    });
    await adapter.set("chave", "valor");
    expect(await adapter.get("chave")).toBe("valor");
    await adapter.remove("chave");
    expect(await adapter.get("chave")).toBeNull();

    const globalAdapter = tryCreateLocalStorageAdapter();
    if (globalAdapter === null) {
      expect(() => new LocalStorageAdapter()).toThrow(/localStorage/);
      return;
    }
    await globalAdapter.set("convergencia-teste", "1");
    expect(await globalAdapter.get("convergencia-teste")).toBe("1");
    await globalAdapter.remove("convergencia-teste");
  });
});
