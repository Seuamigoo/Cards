import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";
import { seedCatalog } from "../src/catalogSeed";
import { seedAdmin } from "../src/seed";

const prisma = new PrismaClient();
const png = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x00]);

describe("catálogo inicial", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("semeia uma vez, publica se o banco está vazio e não sobrescreve edição", async () => {
    const before = await prisma.catalogVersion.count();
    const first = await seedCatalog(prisma);
    const second = await seedCatalog(prisma);
    expect(first.inserted).toBeGreaterThan(0);
    expect(second.inserted).toBe(0);
    expect(second.published).toBe(false);
    if (before === 0) {
      expect(first.published).toBe(true);
    }
    const card = await prisma.cardRecord.findUnique({ where: { id: "recruta-da-muralha" } });
    expect(card?.id).toBe("recruta-da-muralha");
    await prisma.cardRecord.update({ where: { id: "recruta-da-muralha" }, data: { name: "Editado pelo Rick" } });
    await seedCatalog(prisma);
    const edited = await prisma.cardRecord.findUnique({ where: { id: "recruta-da-muralha" } });
    expect(edited?.name).toBe("Editado pelo Rick");
    expect(await prisma.cardRecord.count({ where: { id: "recruta-da-muralha" } })).toBe(1);
  });

  it("troca a imagem de uma carta existente e recusa USER", async () => {
    await seedCatalog(prisma);
    const email = process.env.ADMIN_EMAIL;
    const password = process.env.ADMIN_PASSWORD;
    if (email === undefined || password === undefined) {
      throw new Error("ADMIN_EMAIL e ADMIN_PASSWORD são obrigatórios.");
    }
    await seedAdmin(prisma, email, password);
    const app = await buildApp({ prisma });
    const created = await app.inject({
      method: "POST",
      url: "/auth/register",
      payload: { email: "editor@convergencia.local", username: "editor", password: "senha-segura", role: "ADMIN" },
    });
    expect(created.json()).toMatchObject({ role: "USER" });
    const userLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email: "editor@convergencia.local", password: "senha-segura" },
    });
    const userToken = (userLogin.json() as { accessToken: string }).accessToken;
    const denied = await app.inject({
      method: "POST",
      url: "/admin/cards/recruta-da-muralha/image",
      headers: { authorization: `Bearer ${userToken}`, ...multipart("recruta.png", png).headers },
      payload: multipart("recruta.png", png).body,
    });
    expect(denied.statusCode).toBe(403);

    const adminLogin = await app.inject({
      method: "POST",
      url: "/auth/login",
      payload: { email, password },
    });
    const adminToken = (adminLogin.json() as { accessToken: string }).accessToken;
    const uploaded = await app.inject({
      method: "POST",
      url: "/admin/cards/recruta-da-muralha/image",
      headers: { authorization: `Bearer ${adminToken}`, ...multipart("recruta.png", png).headers },
      payload: multipart("recruta.png", png).body,
    });
    expect(uploaded.statusCode).toBe(200);
    const body = uploaded.json() as { id: string; imagePath: string | null };
    expect(body.id).toBe("recruta-da-muralha");
    expect(body.imagePath).toBe("uploads/recruta-da-muralha.png");
    await app.close();
  });
});

function multipart(filename: string, content: Buffer): { readonly body: Buffer; readonly headers: { "content-type": string } } {
  const boundary = "----despertar";
  const body = Buffer.concat([
    Buffer.from(
      `--${boundary}\r\nContent-Disposition: form-data; name="image"; filename="${filename}"\r\nContent-Type: image/png\r\n\r\n`,
    ),
    content,
    Buffer.from(`\r\n--${boundary}--\r\n`),
  ]);
  return { body, headers: { "content-type": `multipart/form-data; boundary=${boundary}` } };
}
