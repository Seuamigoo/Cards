import type { Phase } from "./state";

export function nextPhase(phase: Phase): Phase {
  switch (phase) {
    case "draw":
      return "main1";
    case "main1":
      return "battle";
    case "battle":
      return "main2";
    case "main2":
      return "end";
    case "end":
      return "draw";
    default: {
      const unexpected: never = phase;
      throw new Error(`Fase inválida: ${String(unexpected)}.`);
    }
  }
}
