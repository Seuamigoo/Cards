import { describe, expect, it } from "vitest";
import { INITIAL_SCREEN, aiDuelRequest, homeEntries, pvpHint, showDragonTable } from "../../app/src/home";

describe("tela inicial", () => {
  it("abre na entrada e só libera Batalhar no menu", () => {
    expect(INITIAL_SCREEN).toBe("gate");
    expect(homeEntries("account").every((entry) => entry.ready)).toBe(true);
    expect(homeEntries("guest").filter((entry) => entry.ready).map((entry) => entry.id)).toEqual(["battle", "collection"]);
    expect(homeEntries("offline").filter((entry) => entry.ready).map((entry) => entry.id)).toEqual(["battle"]);
  });

  it("pede o duelo só com modo e dificuldade, e esconde o Dragão fora do dev", () => {
    expect(aiDuelRequest("blitz", "normal")).toEqual({ mode: "blitz", level: "normal" });
    expect(showDragonTable(false)).toBe(false);
    expect(showDragonTable(true)).toBe(true);
    expect(pvpHint(true)).toBe("Faça login.");
    expect(pvpHint(false)).toBe("em breve");
  });
});
