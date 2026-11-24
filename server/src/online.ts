import websocket from "@fastify/websocket";
import type { PrismaClient } from "@prisma/client";
import type { FastifyInstance } from "fastify";
import type { Action } from "../../src/domain/index";
import type { ServerEnv } from "./env";
import { MemoryRoomStore, chooseDeck, joinRoom, playAction, publicState, seatIndex, startRoom } from "./rooms";
import type { ClientMessage, Room } from "./rooms";
import { readAccess } from "./tokens";

interface Socket {
  readonly OPEN: number;
  readyState: number;
  send(data: string): void;
  close(): void;
  on(event: "message", listener: (raw: Buffer | string) => void): void;
  on(event: "close", listener: () => void): void;
}

interface Connection {
  readonly socket: Socket;
  readonly userId: string;
  readonly username: string;
}

export async function registerOnline(app: FastifyInstance, prisma: PrismaClient, env: ServerEnv): Promise<void> {
  const store = new MemoryRoomStore();
  const sockets = new Map<string, Set<Connection>>();
  await app.register(websocket);

  app.get("/ws", { websocket: true }, (socket, request) => {
    const url = new URL(request.url, "http://127.0.0.1");
    const claims = readAccess(url.searchParams.get("token") ?? "", env.accessSecret);
    if (claims === null) {
      socket.close();
      return;
    }
    const connection = { socket, userId: claims.sub, username: claims.username };
    socket.on("message", (raw: Buffer | string) => {
      void onMessage(String(raw), connection);
    });
    socket.on("close", () => {
      for (const group of sockets.values()) {
        group.delete(connection);
      }
    });

    async function onMessage(raw: string, current: Connection): Promise<void> {
      const message = parseMessage(raw);
      if (message === null) {
        send(current.socket, { type: "error", message: "Mensagem inválida." });
        return;
      }
      switch (message.type) {
        case "create": {
          const room = store.create(current.userId, current.username);
          track(room.code, current);
          broadcast(room);
          return;
        }
        case "join":
        case "rejoin": {
          const room = store.get(message.code);
          if (room === null) {
            send(current.socket, { type: "error", message: "Sala não encontrada." });
            return;
          }
          if (message.type === "join") {
            const error = joinRoom(room, current.userId, current.username);
            if (error !== null) {
              send(current.socket, { type: "error", message: error });
              return;
            }
          } else if (seatIndex(room, current.userId) === null) {
            send(current.socket, { type: "error", message: "Você não está nesta sala." });
            return;
          }
          track(room.code, current);
          broadcast(room);
          return;
        }
        case "chooseDeck": {
          const room = store.findByUser(current.userId);
          if (room === null) {
            send(current.socket, { type: "error", message: "Você não está nesta sala." });
            return;
          }
          const latest = await prisma.catalogVersion.findFirst({ orderBy: { version: "desc" } });
          if (latest === null) {
            send(current.socket, { type: "error", message: "Nenhum catálogo publicado." });
            return;
          }
          const error = chooseDeck(room, current.userId, message.mode, message.cardIds, latest.json);
          if (error !== null) {
            send(current.socket, { type: "error", message: error });
            return;
          }
          broadcast(room);
          return;
        }
        case "start": {
          const room = store.findByUser(current.userId);
          if (room === null) {
            send(current.socket, { type: "error", message: "Você não está nesta sala." });
            return;
          }
          const error = startRoom(room, current.userId);
          if (error !== null) {
            send(current.socket, { type: "error", message: error });
            return;
          }
          broadcast(room);
          return;
        }
        case "action": {
          const room = store.findByUser(current.userId);
          if (room === null) {
            send(current.socket, { type: "error", message: "Você não está nesta sala." });
            return;
          }
          const error = playAction(room, current.userId, message.action);
          if (error !== null) {
            send(current.socket, { type: "error", message: error });
            return;
          }
          if (room.status === "finished") {
            await recordResult(prisma, room);
          }
          broadcast(room);
          return;
        }
        default: {
          const unexpected: never = message;
          send(current.socket, { type: "error", message: `Mensagem inválida: ${String(unexpected)}.` });
        }
      }
    }

    function track(code: string, current: Connection): void {
      const group = sockets.get(code) ?? new Set<Connection>();
      group.add(current);
      sockets.set(code, group);
    }

    function broadcast(room: Room): void {
      const group = sockets.get(room.code);
      if (group === undefined) {
        return;
      }
      for (const current of group) {
        const you = seatIndex(room, current.userId);
        if (you === null) {
          continue;
        }
        send(current.socket, {
          type: "room",
          code: room.code,
          status: room.status,
          seats: room.seats.map((seat) => (seat === null ? null : { username: seat.username, ready: seat.deck !== null })),
        });
        if (room.match !== null) {
          send(current.socket, { type: "state", state: publicState(room.match.getState(), you) });
        }
        if (room.status === "finished" && room.match?.getState().winner !== null && room.match !== null) {
          send(current.socket, { type: "finished", winner: room.match.getState().winner, you });
        }
      }
    }
  });
}

async function recordResult(prisma: PrismaClient, room: Room): Promise<void> {
  if (room.resultRecorded || room.match === null || room.match.getState().winner === null) {
    return;
  }
  room.resultRecorded = true;
  const winner = room.match.getState().winner;
  for (const [index, seat] of room.seats.entries()) {
    if (seat === null) {
      continue;
    }
    await addStat(prisma, seat.userId, seat.username, index === winner);
  }
}

async function addStat(prisma: PrismaClient, userId: string, username: string, won: boolean): Promise<void> {
  const existing = await prisma.playerProfile.findUnique({ where: { userId } });
  const profile = existing === null
    ? {
        version: 1,
        playerId: userId,
        name: username,
        collection: [],
        decks: [],
        stats: { wins: 0, losses: 0, matchesPlayed: 0 },
        updatedAt: new Date().toISOString(),
      }
    : (JSON.parse(existing.json) as {
        version: number;
        playerId: string;
        name: string;
        collection: unknown[];
        decks: unknown[];
        stats: { wins: number; losses: number; matchesPlayed: number };
        updatedAt: string;
      });
  profile.playerId = userId;
  profile.stats.wins += won ? 1 : 0;
  profile.stats.losses += won ? 0 : 1;
  profile.stats.matchesPlayed += 1;
  profile.updatedAt = new Date().toISOString();
  const json = JSON.stringify(profile);
  await prisma.playerProfile.upsert({
    where: { userId },
    create: { userId, json },
    update: { json },
  });
}

function parseMessage(raw: string): ClientMessage | null {
  try {
    const value = JSON.parse(raw) as Partial<ClientMessage>;
    switch (value.type) {
      case "create":
      case "start":
        return { type: value.type };
      case "join":
      case "rejoin":
        return typeof value.code === "string" ? { type: value.type, code: value.code } : null;
      case "chooseDeck":
        return Array.isArray(value.cardIds) && (value.mode === "classic" || value.mode === "blitz")
          ? { type: "chooseDeck", mode: value.mode, cardIds: value.cardIds.filter((id): id is string => typeof id === "string") }
          : null;
      case "action":
        return isAction(value.action) ? { type: "action", action: value.action } : null;
      default:
        return null;
    }
  } catch {
    return null;
  }
}

function isAction(value: unknown): value is Action {
  if (typeof value !== "object" || value === null || !("type" in value)) {
    return false;
  }
  const type = (value as { type: unknown }).type;
  switch (type) {
    case "advancePhase":
    case "summonMonster":
    case "setSpellTrap":
    case "summonTower":
    case "playBiome":
    case "changePosition":
    case "converge":
    case "fuseBrasa":
    case "activate":
    case "attack":
      return true;
    default:
      return false;
  }
}

function send(socket: Socket, payload: unknown): void {
  if (socket.readyState === socket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}
