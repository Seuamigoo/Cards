import { resolve } from "node:path";
import cors from "@fastify/cors";
import cookie from "@fastify/cookie";
import multipart from "@fastify/multipart";
import rateLimit from "@fastify/rate-limit";
import fastifyStatic from "@fastify/static";
import { PrismaClient } from "@prisma/client";
import type { Prisma } from "@prisma/client";
import Fastify from "fastify";
import type { FastifyReply, FastifyRequest } from "fastify";
import { z } from "zod";
import { catalogDocument, validateCatalog } from "./catalogDocument";
import { readEnv } from "./env";
import type { ServerEnv } from "./env";
import { imageExtension } from "./imageStorage";
import type { ImageStorage } from "./imageStorage";
import { LocalImageStorage } from "./imageStorage";
import { hashPassword, verifyPassword } from "./passwords";
import { hashToken, newRefreshToken, readAccess, signAccess } from "./tokens";
import type { AccessClaims } from "./tokens";

const MAX_IMAGE_BYTES = 2 * 1024 * 1024;
const kinds = ["monster", "spell", "trap", "tower", "biome"] as const;
const rarities = ["comum", "incomum", "rara", "epica", "lendaria", "mitica"] as const;

const credentials = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const registerBody = credentials.extend({
  username: z.string().min(3).max(24),
});

const cardBody = z.object({
  name: z.string().min(1),
  rarity: z.enum(rarities),
  kind: z.enum(kinds),
  atk: z.number().int().nonnegative().optional(),
  def: z.number().int().nonnegative().optional(),
  hp: z.number().int().nonnegative().optional(),
  race: z.string().min(1).optional(),
  class: z.string().min(1).optional(),
  status: z.enum(["draft", "published"]).optional(),
});

const profileBody = z.object({
  version: z.number().int().nonnegative(),
  playerId: z.string(),
  name: z.string().min(1),
  collection: z.array(z.object({ cardId: z.string().min(1), quantity: z.number().int().positive() })),
  decks: z.array(
    z.object({
      id: z.string().min(1),
      name: z.string().min(1),
      mode: z.enum(["classic", "blitz"]),
      cardIds: z.array(z.string()),
    }),
  ),
  stats: z.object({
    wins: z.number().int().nonnegative(),
    losses: z.number().int().nonnegative(),
    matchesPlayed: z.number().int().nonnegative(),
  }),
  updatedAt: z.string().min(1),
});

export interface BuildOptions {
  readonly env?: ServerEnv;
  readonly prisma?: PrismaClient;
  readonly images?: ImageStorage;
  readonly uploadsDir?: string;
}

export async function buildApp(options: BuildOptions = {}) {
  const env = options.env ?? readEnv();
  const prisma = options.prisma ?? new PrismaClient({ datasources: { db: { url: env.databaseUrl } } });
  const uploadsDir = options.uploadsDir ?? resolve(process.cwd(), "server/uploads");
  const images = options.images ?? new LocalImageStorage(uploadsDir);
  const app = Fastify({ logger: false });
  app.addHook("onClose", async () => {
    await prisma.$disconnect();
  });
  await app.register(cors, { origin: env.corsOrigin, credentials: true });
  await app.register(cookie);
  await app.register(multipart, { limits: { fileSize: MAX_IMAGE_BYTES } });
  await app.register(rateLimit, { global: false });
  await app.register(fastifyStatic, { root: uploadsDir, prefix: "/uploads/" });

  app.get("/health", async () => ({ ok: true }));

  app.post("/auth/register", async (request, reply) => {
    const body = registerBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Dados inválidos." });
    }
    const passwordHash = await hashPassword(body.data.password);
    try {
      const user = await prisma.user.create({
        data: {
          email: body.data.email.toLowerCase(),
          username: body.data.username,
          passwordHash,
          role: "player",
        },
      });
      return reply.code(201).send({ id: user.id, email: user.email, username: user.username, role: user.role });
    } catch {
      return reply.code(409).send({ error: "Email ou usuário já existe." });
    }
  });

  app.post("/auth/login", { config: { rateLimit: { max: 10, timeWindow: "1 minute" } } }, async (request, reply) => {
    const body = credentials.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Dados inválidos." });
    }
    const user = await prisma.user.findUnique({ where: { email: body.data.email.toLowerCase() } });
    const valid = user !== null && (await verifyPassword(body.data.password, user.passwordHash));
    if (user === null || !valid || !isRole(user.role)) {
      return reply.code(401).send({ error: "Credenciais inválidas." });
    }
    const accessToken = signAccess({ sub: user.id, role: user.role, username: user.username }, env.accessSecret);
    await issueRefresh(prisma, reply, user.id, env);
    return { accessToken, role: user.role, username: user.username };
  });

  app.post("/auth/refresh", async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (token === undefined) {
      return reply.code(401).send({ error: "Sessão ausente." });
    }
    const current = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (current === null || current.expiresAt.getTime() < Date.now() || !isRole(current.user.role)) {
      return reply.code(401).send({ error: "Sessão ausente." });
    }
    await prisma.refreshToken.delete({ where: { id: current.id } });
    const accessToken = signAccess(
      { sub: current.user.id, role: current.user.role, username: current.user.username },
      env.accessSecret,
    );
    await issueRefresh(prisma, reply, current.user.id, env);
    return { accessToken, role: current.user.role, username: current.user.username };
  });

  app.post("/auth/logout", async (request, reply) => {
    const token = request.cookies.refresh_token;
    if (token !== undefined) {
      await prisma.refreshToken.deleteMany({ where: { tokenHash: hashToken(token) } });
    }
    reply.clearCookie("refresh_token", { path: "/" });
    return { ok: true };
  });

  app.get("/catalog/latest", async (_request, reply) => {
    const latest = await prisma.catalogVersion.findFirst({ orderBy: { version: "desc" } });
    if (latest === null) {
      return reply.code(404).send({ error: "Nenhum catálogo publicado." });
    }
    return { version: latest.version };
  });

  app.get("/catalog/:version", async (request, reply) => {
    const version = Number((request.params as { version: string }).version);
    if (!Number.isInteger(version)) {
      return reply.code(400).send({ error: "Versão inválida." });
    }
    const found = await prisma.catalogVersion.findUnique({ where: { version } });
    if (found === null) {
      return reply.code(404).send({ error: "Catálogo não encontrado." });
    }
    return reply.type("application/json").send(found.json);
  });

  app.get("/me/profile", async (request, reply) => {
    const claims = await requireUser(request, reply, env);
    if (claims === null) {
      return;
    }
    const profile = await prisma.playerProfile.findUnique({ where: { userId: claims.sub } });
    if (profile === null) {
      return emptyProfile(claims);
    }
    const parsed = JSON.parse(profile.json) as unknown;
    return parsed;
  });

  app.put("/me/profile", async (request, reply) => {
    const claims = await requireUser(request, reply, env);
    if (claims === null) {
      return;
    }
    const body = profileBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Perfil inválido." });
    }
    const stored = { ...body.data, playerId: claims.sub, updatedAt: new Date().toISOString() };
    await prisma.playerProfile.upsert({
      where: { userId: claims.sub },
      create: { userId: claims.sub, json: JSON.stringify(stored) },
      update: { json: JSON.stringify(stored) },
    });
    return stored;
  });

  app.get("/admin/cards", async (request, reply) => {
    if ((await requireAdmin(request, reply, env)) === null) {
      return;
    }
    return prisma.cardRecord.findMany({ orderBy: { createdAt: "desc" } });
  });

  app.post("/admin/cards", async (request, reply) => {
    if ((await requireAdmin(request, reply, env)) === null) {
      return;
    }
    const body = cardBody.safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Carta inválida." });
    }
    const created = await prisma.cardRecord.create({
      data: {
        ...optionalCardFields(body.data),
        status: body.data.status ?? "draft",
      },
    });
    return reply.code(201).send(created);
  });

  app.patch("/admin/cards/:id", async (request, reply) => {
    if ((await requireAdmin(request, reply, env)) === null) {
      return;
    }
    const id = (request.params as { id: string }).id;
    const body = cardBody.partial().safeParse(request.body);
    if (!body.success) {
      return reply.code(400).send({ error: "Carta inválida." });
    }
    try {
      return await prisma.cardRecord.update({ where: { id }, data: cardPatch(body.data) });
    } catch {
      return reply.code(404).send({ error: "Carta não encontrada." });
    }
  });

  app.delete("/admin/cards/:id", async (request, reply) => {
    if ((await requireAdmin(request, reply, env)) === null) {
      return;
    }
    const id = (request.params as { id: string }).id;
    const current = await prisma.cardRecord.findUnique({ where: { id } });
    if (current === null) {
      return reply.code(404).send({ error: "Carta não encontrada." });
    }
    if (current.status !== "draft") {
      return reply.code(409).send({ error: "Só rascunhos podem ser apagados." });
    }
    await prisma.cardRecord.delete({ where: { id } });
    return { ok: true };
  });

  app.post("/admin/cards/:id/image", async (request, reply) => {
    if ((await requireAdmin(request, reply, env)) === null) {
      return;
    }
    const id = (request.params as { id: string }).id;
    const current = await prisma.cardRecord.findUnique({ where: { id } });
    if (current === null) {
      return reply.code(404).send({ error: "Carta não encontrada." });
    }
    let file: Awaited<ReturnType<typeof request.file>>;
    try {
      file = await request.file();
    } catch {
      return reply.code(413).send({ error: "Imagem acima de 2 MB." });
    }
    if (file === undefined) {
      return reply.code(400).send({ error: "Imagem ausente." });
    }
    const bytes = await file.toBuffer();
    const extension = imageExtension(bytes, file.mimetype);
    if (extension === null) {
      return reply.code(400).send({ error: "Imagem inválida. Use png, jpg ou webp." });
    }
    const imagePath = await images.save(id, extension, bytes);
    return prisma.cardRecord.update({ where: { id }, data: { imagePath } });
  });

  app.post("/admin/catalog/publish", async (request, reply) => {
    if ((await requireAdmin(request, reply, env)) === null) {
      return;
    }
    const cards = await prisma.cardRecord.findMany({ where: { status: "published" }, orderBy: { name: "asc" } });
    const latest = await prisma.catalogVersion.findFirst({ orderBy: { version: "desc" } });
    const version = (latest?.version ?? 0) + 1;
    const publishedAt = new Date().toISOString();
    const json = catalogDocument(version, publishedAt, cards);
    const validated = validateCatalog(json);
    if (!validated.ok) {
      return reply.code(422).send({ error: "Catálogo inválido.", errors: validated.errors });
    }
    const saved = await prisma.catalogVersion.create({ data: { version, publishedAt: new Date(publishedAt), json } });
    return { version: saved.version, publishedAt };
  });

  return app;
}

function optionalCardFields(input: z.infer<typeof cardBody>): Prisma.CardRecordCreateInput {
  return {
    name: input.name,
    rarity: input.rarity,
    kind: input.kind,
    ...(input.atk !== undefined ? { atk: input.atk } : {}),
    ...(input.def !== undefined ? { def: input.def } : {}),
    ...(input.hp !== undefined ? { hp: input.hp } : {}),
    ...(input.race !== undefined ? { race: input.race } : {}),
    ...(input.class !== undefined ? { cardClass: input.class } : {}),
  };
}

function cardPatch(input: {
  readonly name?: string | undefined;
  readonly rarity?: (typeof rarities)[number] | undefined;
  readonly kind?: (typeof kinds)[number] | undefined;
  readonly atk?: number | undefined;
  readonly def?: number | undefined;
  readonly hp?: number | undefined;
  readonly race?: string | undefined;
  readonly class?: string | undefined;
  readonly status?: "draft" | "published" | undefined;
}): Prisma.CardRecordUpdateInput {
  const data: Prisma.CardRecordUpdateInput = {};
  if (input.name !== undefined) {
    data.name = input.name;
  }
  if (input.rarity !== undefined) {
    data.rarity = input.rarity;
  }
  if (input.kind !== undefined) {
    data.kind = input.kind;
  }
  if (input.atk !== undefined) {
    data.atk = input.atk;
  }
  if (input.def !== undefined) {
    data.def = input.def;
  }
  if (input.hp !== undefined) {
    data.hp = input.hp;
  }
  if (input.race !== undefined) {
    data.race = input.race;
  }
  if (input.class !== undefined) {
    data.cardClass = input.class;
  }
  if (input.status !== undefined) {
    data.status = input.status;
  }
  return data;
}

async function issueRefresh(prisma: PrismaClient, reply: FastifyReply, userId: string, env: ServerEnv): Promise<void> {
  const refresh = newRefreshToken();
  await prisma.refreshToken.create({
    data: {
      userId,
      tokenHash: refresh.tokenHash,
      expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 14),
    },
  });
  reply.setCookie("refresh_token", refresh.token, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    secure: env.nodeEnv === "production",
  });
}

async function requireUser(request: FastifyRequest, reply: FastifyReply, env: ServerEnv): Promise<AccessClaims | null> {
  const header = request.headers.authorization;
  const token = header?.startsWith("Bearer ") ? header.slice(7) : "";
  const claims = token.length > 0 ? readAccess(token, env.accessSecret) : null;
  if (claims === null) {
    await reply.code(401).send({ error: "Não autenticado." });
    return null;
  }
  return claims;
}

async function requireAdmin(request: FastifyRequest, reply: FastifyReply, env: ServerEnv): Promise<AccessClaims | null> {
  const claims = await requireUser(request, reply, env);
  if (claims === null) {
    return null;
  }
  if (claims.role !== "admin") {
    await reply.code(403).send({ error: "Acesso de admin necessário." });
    return null;
  }
  return claims;
}

function isRole(role: string): role is "player" | "admin" {
  switch (role) {
    case "player":
    case "admin":
      return true;
    default:
      return false;
  }
}

function emptyProfile(claims: AccessClaims) {
  return {
    version: 1,
    playerId: claims.sub,
    name: claims.username,
    collection: [],
    decks: [],
    stats: { wins: 0, losses: 0, matchesPlayed: 0 },
    updatedAt: new Date().toISOString(),
  };
}
