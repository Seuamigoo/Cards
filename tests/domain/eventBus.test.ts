import { describe, expect, it } from "vitest";
import { EventBus } from "../../src/domain/index";
import type { PhaseChangedEvent, TurnStartedEvent } from "../../src/domain/index";

const phaseChanged: PhaseChangedEvent = {
  from: "draw",
  to: "main1",
  turn: 1,
  activePlayerIndex: 0,
};

const turnStarted: TurnStartedEvent = {
  turn: 2,
  activePlayerIndex: 1,
};

describe("EventBus", () => {
  it("chama os handlers inscritos no evento emitido", () => {
    const bus = new EventBus();
    const phases: PhaseChangedEvent[] = [];
    const turns: TurnStartedEvent[] = [];

    bus.on("phase:changed", (payload) => {
      phases.push(payload);
    });
    bus.on("phase:changed", (payload) => {
      phases.push(payload);
    });
    bus.on("turn:started", (payload) => {
      turns.push(payload);
    });

    bus.emit("phase:changed", phaseChanged);

    expect(phases).toEqual([phaseChanged, phaseChanged]);
    expect(turns).toEqual([]);

    bus.emit("turn:started", turnStarted);
    expect(turns).toEqual([turnStarted]);
  });

  it("para de chamar o handler depois do unsubscribe", () => {
    const bus = new EventBus();
    const seen: number[] = [];
    const unsubscribe = bus.on("turn:started", (payload) => {
      seen.push(payload.turn);
    });

    bus.emit("turn:started", turnStarted);
    unsubscribe();
    bus.emit("turn:started", { turn: 3, activePlayerIndex: 0 });

    expect(seen).toEqual([2]);
  });

  it("remove só o handler cancelado", () => {
    const bus = new EventBus();
    const kept: string[] = [];
    const dropped: string[] = [];

    const unsubscribe = bus.on("phase:changed", () => {
      dropped.push("dropped");
    });
    bus.on("phase:changed", () => {
      kept.push("kept");
    });

    unsubscribe();
    bus.emit("phase:changed", phaseChanged);

    expect(dropped).toEqual([]);
    expect(kept).toEqual(["kept"]);
  });

  it("não falha ao emitir sem handlers", () => {
    const bus = new EventBus();
    expect(() => bus.emit("turn:started", turnStarted)).not.toThrow();
  });
});
