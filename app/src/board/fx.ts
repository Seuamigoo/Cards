import type { GameMatch } from "../../../src/domain/index";
import type { PlayerIndex } from "../../../src/domain/index";

/** Efeito visual curto, ligado a um evento do EventBus. O estado já está atualizado quando o evento sai. */
export type BoardFx =
  | { readonly kind: "summon" | "attack" | "effect" | "destroy" | "fuse" | "position"; readonly instanceId: string }
  | { readonly kind: "pile"; readonly player: PlayerIndex; readonly pile: "limbo" | "graveyard" };

export function watchDuel(match: GameMatch, push: (fx: BoardFx) => void): () => void {
  const offs = [
    match.events.on("monster:summoned", (event) => push({ kind: "summon", instanceId: event.instanceId })),
    match.events.on("monster:position", (event) => push({ kind: "position", instanceId: event.instanceId })),
    match.events.on("monster:fused", (event) => push({ kind: "fuse", instanceId: event.instanceId })),
    match.events.on("attack:declared", (event) => push({ kind: "attack", instanceId: event.instanceId })),
    match.events.on("effect:activated", (event) => push({ kind: "effect", instanceId: event.instanceId })),
    match.events.on("spelltrap:activated", (event) => push({ kind: "effect", instanceId: event.instanceId })),
    match.events.on("spelltrap:set", (event) => push({ kind: "summon", instanceId: event.instanceId })),
    match.events.on("monster:destroyed", (event) => push({ kind: "destroy", instanceId: event.instanceId })),
    match.events.on("tower:summoned", (event) => push({ kind: "summon", instanceId: event.instanceId })),
    match.events.on("tower:destroyed", (event) => push({ kind: "destroy", instanceId: event.instanceId })),
    match.events.on("biome:played", (event) => push({ kind: "summon", instanceId: event.instanceId })),
    match.events.on("card:sent", (event) => push({ kind: "pile", player: event.playerIndex, pile: event.destination })),
  ];
  return () => {
    for (const off of offs) {
      off();
    }
  };
}

export function fxClass(instanceId: string, fx: readonly BoardFx[]): string {
  for (let index = fx.length - 1; index >= 0; index -= 1) {
    const cue = fx[index];
    if (cue === undefined || cue.kind === "pile" || cue.instanceId !== instanceId) {
      continue;
    }
    switch (cue.kind) {
      case "summon":
        return "fx-summon";
      case "attack":
        return "fx-attack";
      case "effect":
        return "fx-effect";
      case "destroy":
        return "fx-destroy";
      case "fuse":
        return "fx-fuse";
      case "position":
        return "fx-position";
      default: {
        const unexpected: never = cue;
        return String(unexpected);
      }
    }
  }
  return "";
}
