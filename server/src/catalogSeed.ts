import { readFileSync } from "node:fs";
import type { Prisma, PrismaClient } from "@prisma/client";
import { catalogDocument } from "./catalogDocument";

interface SeedEffect {
  readonly text: string;
  readonly implemented: boolean;
}

interface SeedCard {
  readonly id: string;
  readonly name: string;
  readonly rarity: string;
  readonly kind: string;
  readonly level?: number;
  readonly atk?: number;
  readonly def?: number;
  readonly tags?: readonly string[];
  readonly class?: string;
  readonly keywords?: readonly string[];
  readonly effects?: readonly SeedEffect[];
  readonly image?: { readonly src?: string };
}

export async function seedCatalog(prisma: PrismaClient): Promise<{ readonly inserted: number; readonly published: boolean }> {
  const file = JSON.parse(readFileSync(new URL("../../catalog/cards.json", import.meta.url), "utf8")) as { cards?: unknown };
  const cards = Array.isArray(file.cards) ? file.cards.filter(isSeedCard) : [];
  let inserted = 0;
  for (const card of cards) {
    const existing = await prisma.cardRecord.findUnique({ where: { id: card.id } });
    if (existing !== null) {
      continue;
    }
    await prisma.cardRecord.create({ data: toRecord(card) });
    inserted += 1;
  }
  const versions = await prisma.catalogVersion.count();
  if (versions > 0) {
    return { inserted, published: false };
  }
  const publishedCards = await prisma.cardRecord.findMany({ where: { status: "published" }, orderBy: { name: "asc" } });
  const publishedAt = new Date().toISOString();
  const json = catalogDocument(1, publishedAt, publishedCards);
  await prisma.catalogVersion.create({ data: { version: 1, publishedAt: new Date(publishedAt), json } });
  return { inserted, published: true };
}

function toRecord(card: SeedCard): Prisma.CardRecordCreateInput {
  return {
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    kind: card.kind,
    status: "published",
    effects: JSON.stringify(card.effects ?? []),
    ...(card.image?.src !== undefined ? { imagePath: card.image.src } : {}),
    ...(card.level !== undefined ? { level: card.level } : {}),
    ...(card.atk !== undefined ? { atk: card.atk } : {}),
    ...(card.def !== undefined ? { def: card.def } : {}),
    ...(card.tags !== undefined ? { tags: JSON.stringify(card.tags) } : {}),
    ...(card.keywords !== undefined ? { keywords: JSON.stringify(card.keywords) } : {}),
    ...(card.class !== undefined ? { cardClass: card.class } : {}),
  };
}

function isSeedCard(value: unknown): value is SeedCard {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const card = value as Partial<SeedCard>;
  return typeof card.id === "string" && typeof card.name === "string" && typeof card.rarity === "string" && typeof card.kind === "string";
}
