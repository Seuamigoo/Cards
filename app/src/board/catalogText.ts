import type { Card } from "../../../src/domain/index";

interface CatalogEffect {
  readonly text?: string;
}

interface CatalogCard {
  readonly id?: string;
  readonly effects?: readonly CatalogEffect[];
}

export interface CatalogDocument {
  readonly cards?: readonly CatalogCard[];
}

export function catalogEffectText(catalog: CatalogDocument): ReadonlyMap<string, string> {
  const texts = new Map<string, string>();
  for (const card of catalog.cards ?? []) {
    if (typeof card.id !== "string") {
      continue;
    }
    const lines = (card.effects ?? [])
      .map((effect) => effect.text)
      .filter((text): text is string => typeof text === "string" && text.length > 0);
    if (lines.length > 0) {
      texts.set(card.id, lines.join(" "));
    }
  }
  return texts;
}

export function faceCopy(card: Card, effects: ReadonlyMap<string, string>): { readonly effect: string | null; readonly flavor: string | null } {
  return {
    effect: effects.get(card.id) ?? null,
    flavor: card.flavor ?? null,
  };
}
