import { PrismaClient } from "@prisma/client";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app";

const prisma = new PrismaClient();

async function tokenFor(email: string): Promise<string> {
  const app = await buildApp({ prisma });
  const created = await app.inject({
    method: "POST",
    url: "/auth/register",
    payload: { email, username: email.split("@")[0], password: "senha-segura" },
  });
  expect(created.statusCode).toBe(201);
  const login = await app.inject({
    method: "POST",
    url: "/auth/login",
    payload: { email, password: "senha-segura" },
  });
  await app.close();
  return (login.json() as { accessToken: string }).accessToken;
}

describe("coleção e decks", () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it("não entrega deck no cadastro e só aceita um deck inicial", async () => {
    const token = await tokenFor("bia@convergencia.local");
    const app = await buildApp({ prisma });
    const headers = { authorization: `Bearer ${token}` };
    const empty = await app.inject({ method: "GET", url: "/collection", headers });
    expect(empty.json()).toEqual({ cards: [] });
    const noDecks = await app.inject({ method: "GET", url: "/decks", headers });
    expect(noDecks.json()).toEqual({ decks: [] });

    const chosen = await app.inject({
      method: "POST",
      url: "/starter",
      headers,
      payload: { starterId: "vanguarda-do-reino" },
    });
    expect(chosen.statusCode).toBe(200);
    const body = chosen.json() as {
      starterId: string;
      collection: { cards: { cardId: string; quantity: number }[] };
      decks: { mode: string; isActive: boolean; cards: { qty: number }[]; lineage: null }[];
    };
    expect(body.starterId).toBe("vanguarda-do-reino");
    expect(body.decks.map((deck) => deck.mode).sort()).toEqual(["blitz", "classic"]);
    expect(body.decks.every((deck) => deck.isActive && deck.lineage === null)).toBe(true);
    expect(body.collection.cards.find((card) => card.cardId === "recruta-da-muralha")?.quantity).toBe(3);
    const classic = body.decks.find((deck) => deck.mode === "classic");
    expect(classic?.cards.reduce((sum, card) => sum + card.qty, 0)).toBe(40);

    const again = await app.inject({
      method: "POST",
      url: "/starter",
      headers,
      payload: { starterId: "marcha-da-necropole" },
    });
    expect(again.statusCode).toBe(409);
    await app.close();
  });

  it("grava e recusa deck pela validação compartilhada", async () => {
    const token = await tokenFor("caio@convergencia.local");
    const app = await buildApp({ prisma });
    const headers = { authorization: `Bearer ${token}` };
    await app.inject({
      method: "POST",
      url: "/starter",
      headers,
      payload: { starterId: "marcha-da-necropole" },
    });
    const listed = await app.inject({ method: "GET", url: "/decks", headers });
    const classic = (listed.json() as { decks: { id: string; mode: string; cards: { cardId: string; qty: number }[] }[] }).decks
      .find((deck) => deck.mode === "classic");
    if (classic === undefined) {
      throw new Error("deck clássico ausente");
    }
    const renamed = await app.inject({
      method: "PUT",
      url: `/decks/${classic.id}`,
      headers,
      payload: { name: "Marcha editada", mode: "classic", cards: classic.cards, isActive: true },
    });
    expect(renamed.statusCode).toBe(200);
    expect(renamed.json()).toMatchObject({ name: "Marcha editada", isActive: true, lineage: null });

    const rejected = await app.inject({
      method: "POST",
      url: "/decks",
      headers,
      payload: { name: "Ilegal", mode: "blitz", cards: [{ cardId: "recruta-da-muralha", qty: 3 }] },
    });
    expect(rejected.statusCode).toBe(400);
    expect(rejected.json()).toMatchObject({ valid: false });
    await app.close();
  });
});
