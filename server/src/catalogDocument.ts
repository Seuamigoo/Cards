import { CardRegistry } from "../../src/catalog/index";
import type { CardValidationError } from "../../src/catalog/index";
import type { CardRecord } from "@prisma/client";

export function catalogDocument(version: number, publishedAt: string, cards: readonly CardRecord[]): string {
  return JSON.stringify({
    version,
    publishedAt,
    cards: cards.map(toDefinition),
  });
}

export function validateCatalog(json: string): { ok: true } | { ok: false; errors: readonly CardValidationError[] } {
  const parsed = CardRegistry.fromJSON(json);
  if (!parsed.ok) {
    return parsed;
  }
  return { ok: true };
}

function toDefinition(card: CardRecord): Record<string, unknown> {
  return {
    id: card.id,
    name: card.name,
    rarity: card.rarity,
    kind: card.kind,
    ...(card.atk !== null ? { atk: card.atk } : {}),
    ...(card.def !== null ? { def: card.def } : {}),
    ...(card.hp !== null ? { hp: card.hp } : {}),
    ...(card.race !== null ? { race: card.race } : {}),
    ...(card.cardClass !== null ? { class: card.cardClass } : {}),
    ...(card.imagePath !== null ? { image: { src: card.imagePath, alt: card.name } } : {}),
  };
}
