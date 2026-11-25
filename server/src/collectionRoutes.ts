import type { Prisma, PrismaClient } from "@prisma/client";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { STARTER_DECKS } from "../../src/catalog/decks";
import { starterCards, validateDeck } from "../../src/collection/index";
import type { CollectionCard, DeckCard, DeckDraft } from "../../src/collection/index";
import type { GameMode } from "../../src/domain/config";
import type { ServerEnv } from "./env";
import { readAccess } from "./tokens";
import type { AccessClaims } from "./tokens";

const cardRef = z.object({
  cardId: z.string().min(1),
  qty: z.number().int().positive(),
});

const deckBody = z.object({
  name: z.string().trim().min(1).max(40),
  mode: z.enum(["classic", "blitz"]),
  cards: z.array(cardRef),
  isActive: z.boolean().optional(),
  lineage: z.array(cardRef).nullable().optional(),
});

const starterBody = z.object({
  starterId: z.string().min(1),
});

export interface DeckResponse {
  readonly id: string;
  readonly name: string;
  readonly mode: GameMode;
  readonly cards: readonly DeckCard[];
  readonly isActive: boolean;
  readonly lineage: readonly DeckCard[] | null;
}

export async function registerCollection(
  app: FastifyInstance,
  prisma: PrismaClient,
  env: ServerEnv,
): Promise<void> {
  app.get("/collection", async (request, reply) => {
    const claims = await requireUser(request, reply, env);
    if (claims === null) {
      return;
    }
    return { cards: await readCollection(prisma, claims.sub) };
  });

  app.get("/decks", async (request, reply) => {
    const claims = await requireUser(request, reply, env);
    if (claims === null) {
      return;
    }
    const rows = await prisma.deck.findMany({ where: { userId: claims.sub }, orderBy: { createdAt: "asc" } });
    return { decks: rows.map(toDeck) };
  });

  app.post("/decks", async (request, reply) => {
    const claims = await requireUser(request, reply, env);
    if (claims === null) {
      return;
    }
    const parsed = deckBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Deck inválido." });
    }
    const draft = toDraft(parsed.data);
    const collection = await readCollection(prisma, claims.sub);
    const check = validateDeck(draft, parsed.data.mode, collection);
    if (!check.valid) {
      return reply.code(400).send(check);
    }
    const created = await prisma.$transaction(async (tx) => {
      if (parsed.data.isActive === true) {
        await tx.deck.updateMany({
          where: { userId: claims.sub, mode: parsed.data.mode },
          data: { isActive: false },
        });
      }
      return tx.deck.create({
        data: deckData(claims.sub, parsed.data.name, parsed.data.mode, draft, parsed.data.isActive === true),
      });
    });
    return reply.code(201).send(toDeck(created));
  });

  app.put("/decks/:id", async (request, reply) => {
    const claims = await requireUser(request, reply, env);
    if (claims === null) {
      return;
    }
    const id = (request.params as { id?: string }).id ?? "";
    const current = await prisma.deck.findFirst({ where: { id, userId: claims.sub } });
    if (current === null) {
      return reply.code(404).send({ error: "Deck não encontrado." });
    }
    const parsed = deckBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Deck inválido." });
    }
    const draft = toDraft(parsed.data);
    const collection = await readCollection(prisma, claims.sub);
    const check = validateDeck(draft, parsed.data.mode, collection);
    if (!check.valid) {
      return reply.code(400).send(check);
    }
    const updated = await prisma.$transaction(async (tx) => {
      if (parsed.data.isActive === true) {
        await tx.deck.updateMany({
          where: { userId: claims.sub, mode: parsed.data.mode, id: { not: id } },
          data: { isActive: false },
        });
      }
      return tx.deck.update({
        where: { id },
        data: deckData(claims.sub, parsed.data.name, parsed.data.mode, draft, parsed.data.isActive === true),
      });
    });
    return toDeck(updated);
  });

  app.post("/starter", async (request, reply) => {
    const claims = await requireUser(request, reply, env);
    if (claims === null) {
      return;
    }
    const parsed = starterBody.safeParse(request.body);
    if (!parsed.success) {
      return reply.code(400).send({ error: "Deck inicial inválido." });
    }
    const starter = STARTER_DECKS.find((item) => item.id === parsed.data.starterId);
    if (starter === undefined) {
      return reply.code(404).send({ error: "Deck inicial desconhecido." });
    }
    const user = await prisma.user.findUnique({ where: { id: claims.sub } });
    if (user === null) {
      return reply.code(401).send({ error: "Não autenticado." });
    }
    if (user.starterId !== null) {
      return reply.code(409).send({ error: "O deck inicial já foi escolhido." });
    }
    const classic = starterCards(starter.id, "classic") ?? [];
    const blitz = starterCards(starter.id, "blitz") ?? [];
    const cards = collectionFrom(starter.counts);
    await prisma.$transaction(async (tx) => {
      await tx.user.update({ where: { id: claims.sub }, data: { starterId: starter.id } });
      await tx.collectionItem.createMany({
        data: cards.map((entry) => ({ userId: claims.sub, cardId: entry.cardId, quantity: entry.quantity })),
      });
      await tx.deck.create({
        data: deckData(claims.sub, starter.name, "classic", { name: starter.name, cards: classic }, true),
      });
      await tx.deck.create({
        data: deckData(claims.sub, starter.name, "blitz", { name: starter.name, cards: blitz }, true),
      });
    });
    const decks = await prisma.deck.findMany({ where: { userId: claims.sub }, orderBy: { createdAt: "asc" } });
    return {
      starterId: starter.id,
      collection: { cards },
      decks: decks.map(toDeck),
    };
  });
}

function collectionFrom(
  counts: readonly { readonly cardId: string; readonly classic: number; readonly blitz: number }[],
): CollectionCard[] {
  return counts
    .map((entry) => ({ cardId: entry.cardId, quantity: Math.max(entry.classic, entry.blitz) }))
    .filter((entry) => entry.quantity > 0);
}

function toDraft(body: z.infer<typeof deckBody>): DeckDraft {
  return {
    name: body.name,
    cards: body.cards,
    ...(body.lineage !== undefined ? { lineage: body.lineage } : {}),
  };
}

function deckData(
  userId: string,
  name: string,
  mode: GameMode,
  draft: DeckDraft,
  isActive: boolean,
): Prisma.DeckUncheckedCreateInput {
  return {
    userId,
    name,
    mode,
    cards: JSON.stringify(draft.cards),
    isActive,
    lineage: draft.lineage == null ? null : JSON.stringify(draft.lineage),
  };
}

function toDeck(row: { id: string; name: string; mode: string; cards: string; isActive: boolean; lineage: string | null }): DeckResponse {
  const mode: GameMode = row.mode === "blitz" ? "blitz" : "classic";
  return {
    id: row.id,
    name: row.name,
    mode,
    cards: parseCards(row.cards),
    isActive: row.isActive,
    lineage: row.lineage === null ? null : parseCards(row.lineage),
  };
}

function parseCards(json: string): DeckCard[] {
  const parsed = JSON.parse(json) as unknown;
  if (!Array.isArray(parsed)) {
    return [];
  }
  const cards: DeckCard[] = [];
  for (const entry of parsed) {
    if (typeof entry !== "object" || entry === null) {
      continue;
    }
    const cardId = "cardId" in entry ? entry.cardId : undefined;
    const qty = "qty" in entry ? entry.qty : undefined;
    if (typeof cardId === "string" && typeof qty === "number") {
      cards.push({ cardId, qty });
    }
  }
  return cards;
}

async function readCollection(prisma: PrismaClient, userId: string): Promise<CollectionCard[]> {
  const rows = await prisma.collectionItem.findMany({ where: { userId }, orderBy: { cardId: "asc" } });
  return rows.map((row) => ({ cardId: row.cardId, quantity: row.quantity }));
}

async function requireUser(
  request: FastifyRequest,
  reply: FastifyReply,
  env: ServerEnv,
): Promise<AccessClaims | null> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const claims = token.length > 0 ? readAccess(token, env.accessSecret) : null;
  if (claims === null) {
    await reply.code(401).send({ error: "Não autenticado." });
    return null;
  }
  return claims;
}
