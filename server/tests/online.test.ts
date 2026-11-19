import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { hashPassword } from "../src/passwords";

const prisma = new PrismaClient();

describe("online", () => {
  beforeAll(async () => {
    await prisma.user.create({
      data: {
        email: "mesa@convergencia.local",
        username: "mesa",
        passwordHash: await hashPassword("senha-admin-teste"),
        role: "ADMIN",
      },
    });
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cria sala, esconde a mão do oponente e retoma na reconexão", async () => {
    const app = await buildApp({ prisma });
    const admin = await login(app, "mesa@convergencia.local", "senha-admin-teste");
    const createdCard = await app.inject({
      method: "POST",
      url: "/admin/cards",
      headers: { authorization: `Bearer ${admin}` },
      payload: { name: "Colosso", rarity: "rara", kind: "monster", level: 4, atk: 8000, def: 1000, tags: ["HUMAN", "WARRIOR"], status: "published" },
    });
    const cardId = (createdCard.json() as { id: string }).id;
    const published = await app.inject({
      method: "POST",
      url: "/admin/catalog/publish",
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(published.statusCode).toBe(200);

    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "lina@convergencia.local", username: "lina", password: "senha-segura" },
    });
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "kael@convergencia.local", username: "kael", password: "senha-segura" },
    });
    const lina = await login(app, "lina@convergencia.local", "senha-segura");
    const kael = await login(app, "kael@convergencia.local", "senha-segura");
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const first = track(await connect(port, lina));
    const second = track(await connect(port, kael));
    first.socket.send(JSON.stringify({ type: "create" }));
    const created = await first.find((message) => message.type === "room");
    const code = created.code;
    second.socket.send(JSON.stringify({ type: "join", code }));
    await second.find((message) => message.type === "room");
    const deck = { type: "chooseDeck", mode: "blitz", cardIds: Array.from({ length: 20 }, () => cardId) };
    first.socket.send(JSON.stringify(deck));
    second.socket.send(JSON.stringify(deck));
    await first.find((message) => message.type === "room" && message.seats[0]?.ready === true);
    await second.find((message) => message.type === "room" && message.seats[1]?.ready === true);
    first.socket.send(JSON.stringify({ type: "start" }));
    const state = await first.find((message) => message.type === "state");
    const hidden = await second.find((message) => message.type === "state");
    const own = state.state.players[0];
    const hiddenOpponent = hidden.state.players[0];
    expect(own).toBeDefined();
    expect(hiddenOpponent).toBeDefined();
    expect(own?.hand.length).toBeGreaterThan(0);
    expect(hiddenOpponent?.hand).toEqual([]);
    expect(hiddenOpponent?.deck).toEqual([]);
    expect(hiddenOpponent?.deckCount).toBeGreaterThan(0);

    second.socket.send(JSON.stringify({ type: "action", action: { type: "advancePhase" } }));
    const denied = await second.find((message) => message.type === "error");
    expect(denied.message).toMatch(/vez/);
    const turn = state.state.turn;
    first.socket.close();
    const again = track(await connect(port, lina));
    again.socket.send(JSON.stringify({ type: "rejoin", code }));
    const resumed = await again.find((message) => message.type === "state");
    expect(resumed.state.turn).toBe(turn);
    first.socket.close();
    second.socket.close();
    again.socket.close();
    await app.close();
  });

  it("grava vitória e derrota uma única vez", async () => {
    const app = await buildApp({ prisma });
    const admin = await login(app, "mesa@convergencia.local", "senha-admin-teste");
    const createdCard = await app.inject({
      method: "POST",
      url: "/admin/cards",
      headers: { authorization: `Bearer ${admin}` },
      payload: { name: "Colosso Final", rarity: "mitica", kind: "monster", level: 4, atk: 8000, def: 0, tags: ["HUMAN", "WARRIOR"], status: "published" },
    });
    const cardId = (createdCard.json() as { id: string }).id;
    await app.inject({
      method: "POST",
      url: "/admin/catalog/publish",
      headers: { authorization: `Bearer ${admin}` },
    });
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "nara@convergencia.local", username: "nara", password: "senha-segura" },
    });
    await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "davi@convergencia.local", username: "davi", password: "senha-segura" },
    });
    const nara = await login(app, "nara@convergencia.local", "senha-segura");
    const davi = await login(app, "davi@convergencia.local", "senha-segura");
    await app.listen({ port: 0, host: "127.0.0.1" });
    const address = app.server.address();
    const port = typeof address === "object" && address !== null ? address.port : 0;
    const first = track(await connect(port, nara));
    const second = track(await connect(port, davi));
    first.socket.send(JSON.stringify({ type: "create" }));
    const created = await first.find((message) => message.type === "room");
    second.socket.send(JSON.stringify({ type: "join", code: created.code }));
    await second.find((message) => message.type === "room");
    const deck = { type: "chooseDeck", mode: "blitz", cardIds: Array.from({ length: 20 }, () => cardId) };
    first.socket.send(JSON.stringify(deck));
    second.socket.send(JSON.stringify(deck));
    await first.find((message) => message.type === "room" && message.seats[0]?.ready === true);
    await second.find((message) => message.type === "room" && message.seats[1]?.ready === true);
    first.socket.send(JSON.stringify({ type: "start" }));
    await first.find((message) => message.type === "state");

    await act(first, { type: "advancePhase" });
    await act(first, { type: "summonMonster", handIndex: 0, zoneIndex: 0, position: "attack", tributeZoneIndexes: [] });
    for (let step = 0; step < 3; step += 1) {
      await act(first, { type: "advancePhase" });
    }
    for (let step = 0; step < 5; step += 1) {
      await act(second, { type: "advancePhase" });
    }
    await act(first, { type: "advancePhase" });
    await act(first, { type: "advancePhase" });
    const finished = await act(first, { type: "attack", attackerZoneIndex: 0, target: { kind: "player" } });
    expect(finished.state.winner).toBe(0);

    const winner = await app.inject({ method: "GET", url: "/me/profile", headers: { authorization: `Bearer ${nara}` } });
    const loser = await app.inject({ method: "GET", url: "/me/profile", headers: { authorization: `Bearer ${davi}` } });
    expect(winner.json()).toMatchObject({ stats: { wins: 1, losses: 0, matchesPlayed: 1 } });
    expect(loser.json()).toMatchObject({ stats: { wins: 0, losses: 1, matchesPlayed: 1 } });

    await act(first, { type: "advancePhase" });
    const winnerAgain = await app.inject({ method: "GET", url: "/me/profile", headers: { authorization: `Bearer ${nara}` } });
    expect(winnerAgain.json()).toMatchObject({ stats: { wins: 1, matchesPlayed: 1 } });
    first.socket.close();
    second.socket.close();
    await app.close();
  });
});

async function act(
  client: ReturnType<typeof track>,
  action: {
    type: string;
    handIndex?: number;
    zoneIndex?: number;
    position?: string;
    tributeZoneIndexes?: readonly number[];
    attackerZoneIndex?: number;
    target?: { kind: string };
  },
): Promise<LiveMessage> {
  const cursor = client.size();
  client.socket.send(JSON.stringify({ type: "action", action }));
  return client.findAfter(cursor, (message) => message.type === "state" || message.type === "error");
}

async function login(app: Awaited<ReturnType<typeof buildApp>>, email: string, password: string): Promise<string> {
  const response = await app.inject({ method: "POST", url: "/auth/login", payload: { email, password } });
  return (response.json() as { accessToken: string }).accessToken;
}

function connect(port: number, token: string): Promise<WebSocket> {
  const socket = new WebSocket(`ws://127.0.0.1:${port}/ws?token=${encodeURIComponent(token)}`);
  return new Promise((resolve, reject) => {
    socket.addEventListener("open", () => resolve(socket));
    socket.addEventListener("error", () => reject(new Error("websocket")));
  });
}

interface LiveMessage {
  type: string;
  message: string;
  code: string;
  seats: Array<{ ready?: boolean } | null>;
  state: { turn: number; winner: number | null; players: Array<{ hand: unknown[]; deck: unknown[]; deckCount: number }> };
}

function track(socket: WebSocket): {
  socket: WebSocket;
  size(): number;
  find(predicate: (message: LiveMessage) => boolean): Promise<LiveMessage>;
  findAfter(cursor: number, predicate: (message: LiveMessage) => boolean): Promise<LiveMessage>;
} {
  const messages: LiveMessage[] = [];
  socket.addEventListener("message", (event) => {
    void readMessage(event.data).then((message) => {
      messages.push(message);
    });
  });
  async function scan(from: number, predicate: (message: LiveMessage) => boolean): Promise<LiveMessage> {
    const started = Date.now();
    while (Date.now() - started < 4000) {
      const found = messages.slice(from).find(predicate);
      if (found !== undefined) {
        return found;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 20);
      });
    }
    throw new Error(`tempo esgotado: ${JSON.stringify(messages)}`);
  }
  return {
    socket,
    size: () => messages.length,
    find: (predicate) => scan(0, predicate),
    findAfter: (cursor, predicate) => scan(cursor, predicate),
  };
}

async function readMessage(data: unknown): Promise<LiveMessage> {
  const text = typeof data === "string" ? data : await (data as Blob).text();
  return JSON.parse(text) as LiveMessage;
}
