import { describe, expect, it } from "vitest";
import { nextPhase } from "../../src/domain/index";
import type { Phase } from "../../src/domain/index";

const CYCLE: readonly Phase[] = ["draw", "main1", "battle", "main2", "end"];

describe("nextPhase", () => {
  it("percorre o ciclo completo e volta para draw", () => {
    let phase: Phase = "draw";
    const seen: Phase[] = [phase];

    for (let step = 0; step < CYCLE.length; step += 1) {
      phase = nextPhase(phase);
      seen.push(phase);
    }

    expect(seen).toEqual(["draw", "main1", "battle", "main2", "end", "draw"]);
  });

  it("liga cada fase à seguinte", () => {
    expect(nextPhase("draw")).toBe("main1");
    expect(nextPhase("main1")).toBe("battle");
    expect(nextPhase("battle")).toBe("main2");
    expect(nextPhase("main2")).toBe("end");
    expect(nextPhase("end")).toBe("draw");
  });
});
