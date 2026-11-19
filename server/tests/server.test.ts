import { PrismaClient } from "@prisma/client";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { seedAdmin } from "../src/seed";

const prisma = new PrismaClient();
const png = Buffer.from([
  0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00,
]);
const gif = Buffer.from("GIF89a", "ascii");

async function tokenFor(email: string, password: string): Promise<string> {
  const app = await buildApp({ prisma });
  const response = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password },
  });
  await app.close();
  const body = response.json() as { accessToken: string };
  return body.accessToken;
}

describe("servidor", () => {
  beforeAll(async () => {
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (email === undefined || password === undefined) {
      throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios.");
    }
    const seeded = await seedAdmin(prisma, email, password);
    expect(seeded === "created" || seeded === "unchanged").toBe(true);
  });

  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("cadastra e entra, e rejeita senha errada", async () => {
    const app = await buildApp({ prisma });
    const created = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "ana@convergencia.local", username: "ana", password: "senha-segura" },
    });
    expect(created.statusCode).toBe(201);
    const login = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@convergencia.local", password: "senha-segura" },
    });
    expect(login.statusCode).toBe(200);
    expect(login.json()).toMatchObject({ role: "USER", username: "ana" });
    const denied = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "ana@convergencia.local", password: "errada-demais" },
    });
    expect(denied.statusCode).toBe(401);
    await app.close();
  });

  it("bloqueia admin para jogador e libera para admin", async () => {
    const app = await buildApp({ prisma });
    const player = await tokenFor("ana@convergencia.local", "senha-segura");
    const forbidden = await app.inject({
      method: "GET",
      url: "/admin/cards",
      headers: { authorization: `Bearer ${player}` },
    });
    expect(forbidden.statusCode).toBe(403);
    const admin = await tokenFor("admin@convergencia.local", "senha-admin-teste");
    const allowed = await app.inject({
      method: "GET",
      url: "/admin/cards",
      headers: { authorization: `Bearer ${admin}` },
    });
    expect(allowed.statusCode).toBe(200);
    await app.close();
  });

  it("rejeita upload inválido e publica um catálogo válido", async () => {
    const app = await buildApp({ prisma });
    const admin = await tokenFor("admin@convergencia.local", "senha-admin-teste");
    const headers = { authorization: `Bearer ${admin}` };
    const created = await app.inject({
      method: "POST",
      url: "/admin/cards",
      headers,
      payload: { name: "Sentinela de Bruma", rarity: "comum", kind: "monster", level: 4, atk: 1000, def: 1000, tags: ["HUMAN", "WARRIOR"] },
    });
    expect(created.statusCode).toBe(201);
    const id = (created.json() as { id: string }).id;
    const gifUpload = await app.inject({
      method: "POST",
      url: `/admin/cards/${id}/image`,
      headers: { ...headers, ...multipartHeader("bruma.gif", gif, "image/gif").headers },
      payload: multipartHeader("bruma.gif", gif, "image/gif").body,
    });
    expect(gifUpload.statusCode).toBe(400);
    const pngUpload = await app.inject({
      method: "POST",
      url: `/admin/cards/${id}/image`,
      headers: { ...headers, ...multipartHeader("bruma.png", png, "image/png").headers },
      payload: multipartHeader("bruma.png", png, "image/png").body,
    });
    expect(pngUpload.statusCode).toBe(200);

    const broken = await app.inject({
      method: "POST",
      url: "/admin/cards",
      headers,
      payload: { name: "Sem números", rarity: "rara", kind: "monster", status: "published" },
    });
    const brokenId = (broken.json() as { id: string }).id;
    await app.inject({
      method: "PATCH",
      url: `/admin/cards/${brokenId}`,
      headers,
      payload: { status: "published" },
    });
    const rejected = await app.inject({ method: "POST", url: "/admin/catalog/publish", headers });
    expect(rejected.statusCode).toBe(422);

    await app.inject({
      method: "PATCH",
      url: `/admin/cards/${brokenId}`,
      headers,
      payload: { status: "draft" },
    });
    await app.inject({
      method: "PATCH",
      url: `/admin/cards/${id}`,
      headers,
      payload: { status: "published" },
    });
    const published = await app.inject({ method: "POST", url: "/admin/catalog/publish", headers });
    expect(published.statusCode).toBe(200);
    const latest = await app.inject({ method: "GET", url: "/catalog/latest" });
    const version = (latest.json() as { version: number }).version;
    expect(version).toBeGreaterThan(0);
    const document = await app.inject({ method: "GET", url: `/catalog/${version}` });
    expect(document.json()).toMatchObject({ version });
    await app.close();
  });

  it("cadastra USER mesmo com role ADMIN no corpo e reserva as rotas de admin", async () => {
    const app = await buildApp({ prisma });
    const created = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: {
        email: "intruso@convergencia.local",
        username: "intruso",
        password: "senha-segura",
        role: "ADMIN",
        isAdmin: true,
      },
    });
    expect(created.statusCode).toBe(201);
    expect(created.json()).toMatchObject({ role: "USER" });
    const stored = await prisma.user.findUnique({ where: { email: "intruso@convergencia.local" } });
    expect(stored?.role).toBe("USER");

    const userToken = await tokenFor("intruso@convergencia.local", "senha-segura");
    const userHeaders = { authorization: `Bearer ${userToken}` };
    const deniedPublish = await app.inject({ method: "POST", url: "/admin/catalog/publish", headers: userHeaders });
    expect(deniedPublish.statusCode).toBe(403);
    const deniedUpload = await app.inject({
      method: "POST",
      url: "/admin/cards/carta-alheia/image",
      headers: { ...userHeaders, ...multipartHeader("x.png", png, "image/png").headers },
      payload: multipartHeader("x.png", png, "image/png").body,
    });
    expect(deniedUpload.statusCode).toBe(403);

    const email = process.env.ADMIN_EMAIL ?? "";
    const password = process.env.ADMIN_PASSWORD ?? "";
    expect(await seedAdmin(prisma, email, password)).toBe("unchanged");
    expect(await prisma.user.count({ where: { email } })).toBe(1);
    expect((await prisma.user.findUnique({ where: { email } }))?.role).toBe("ADMIN");

    const admin = await tokenFor(email, password);
    const headers = { authorization: `Bearer ${admin}` };
    const card = await app.inject({
      method: "POST",
      url: "/admin/cards",
      headers,
      payload: { name: "Selo", rarity: "comum", kind: "spell", status: "published" },
    });
    expect(card.statusCode).toBe(201);
    const id = (card.json() as { id: string }).id;
    const image = await app.inject({
      method: "POST",
      url: `/admin/cards/${id}/image`,
      headers: { ...headers, ...multipartHeader("selo.png", png, "image/png").headers },
      payload: multipartHeader("selo.png", png, "image/png").body,
    });
    expect(image.statusCode).toBe(200);
    const published = await app.inject({ method: "POST", url: "/admin/catalog/publish", headers });
    expect(published.statusCode).toBe(200);
    await app.close();
  });
});

function multipartHeader(filename: string, content: Buffer, mime: string): {
  readonly body: Buffer;
  readonly headers: { "content-type": string };
} {
  const boundary = "----convergencia";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: ${mime}\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}
