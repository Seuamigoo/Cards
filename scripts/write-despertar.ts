import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { DESPERTAR_CARDS, DESPERTAR_PENDING, despertarImage, placeholderSvg } from "../src/catalog/despertar.ts";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const cardsDir = resolve(root, "assets/cards");
mkdirSync(cardsDir, { recursive: true });

const toJson = (card: (typeof DESPERTAR_CARDS)[number]) => ({
  id: card.id,
  name: card.name,
  rarity: card.rarity,
  kind: card.kind,
  ...(card.level !== undefined ? { level: card.level } : {}),
  ...(card.atk !== undefined ? { atk: card.atk } : {}),
  ...(card.def !== undefined ? { def: card.def } : {}),
  ...(card.tags !== undefined ? { tags: card.tags } : {}),
  ...(card.classTag !== undefined ? { class: card.classTag } : {}),
  ...(card.keywords !== undefined ? { keywords: card.keywords } : {}),
  effects: card.effects,
  ...(card.todo !== undefined ? { todo: card.todo } : {}),
  image: despertarImage(card),
});

for (const card of [...DESPERTAR_CARDS, ...DESPERTAR_PENDING]) {
  writeFileSync(resolve(cardsDir, `${card.id}.svg`), placeholderSvg(card), "utf8");
}

const document = {
  version: 1,
  publishedAt: "2026-11-17T00:00:00.000Z",
  cards: DESPERTAR_CARDS.map(toJson),
  pending: DESPERTAR_PENDING.map(toJson),
};

writeFileSync(resolve(root, "catalog/cards.json"), `${JSON.stringify(document, null, 2)}\n`, "utf8");
console.log(`cartas ${document.cards.length} pendentes ${document.pending.length}`);
