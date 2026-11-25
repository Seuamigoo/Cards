import { describe, expect, it } from "vitest";
import { INITIAL_SCREEN, aiDuelRequest, homeEntries, pvpHint, showDragonTable } from "../../app/src/home";

describe("tela inicial", () => {
  it("abre na entrada e só libera Batalhar no menu", () => {
    expect(INITIAL_SCREEN).toBe("gate");
    const ready = homeEntries().filter((entry) => entry.ready).map((entry) => entry.id);
    expect(ready).toEqual(["battle"]);
    expect(homeEntries().filter((entry) => !entry.ready).every((entry) => entry.hint === "em breve")).toBe(true);
  });

  it("pede o duelo só com modo e dificuldade, e esconde o Dragão fora do dev", () => {
    expect(aiDuelRequest("blitz", "normal")).toEqual({ mode: "blitz", level: "normal" });
    expect(showDragonTable(false)).toBe(false);
    expect(showDragonTable(true)).toBe(true);
    expect(pvpHint(true)).toBe("Faça login.");
    expect(pvpHint(false)).toBe("em breve");
  });
});
