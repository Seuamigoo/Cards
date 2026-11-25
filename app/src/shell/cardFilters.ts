import type { Card, CardRarity } from "../../../src/domain/index";

export type KindFilter = "all" | Card["kind"];
export type RarityFilter = "all" | CardRarity;

export const RACES = ["HUMAN", "ELF", "DWARF", "ANGEL", "DEMON", "DRAGON", "UNDEAD", "AUTOMATON", "BEAST", "ELEMENTAL", "ABYSSAL", "SWARM"] as const;
export const CLASSES = ["WARRIOR", "MAGE", "ARCHER", "ASSASSIN", "CLERIC"] as const;

export type RaceFilter = "all" | (typeof RACES)[number];
export type ClassFilter = "all" | (typeof CLASSES)[number];

export interface CardFilter {
  readonly query: string;
  readonly kind: KindFilter;
  readonly rarity: RarityFilter;
  readonly tag: string;
  readonly race: RaceFilter;
  readonly cardClass: ClassFilter;
  readonly level: "all" | number;
}

export const EMPTY_CARD_FILTER: CardFilter = {
  query: "",
  kind: "all",
  rarity: "all",
  tag: "all",
  race: "all",
  cardClass: "all",
  level: "all",
};

const KIND_ORDER: readonly Card["kind"][] = ["monster", "spell", "trap", "tower", "biome"];

export function filterCards(cards: readonly Card[], filter: CardFilter): readonly Card[] {
  const query = filter.query.trim().toLocaleLowerCase("pt-BR");
  return cards.filter((card) => {
    if (filter.kind !== "all" && card.kind !== filter.kind) {
      return false;
    }
    if (filter.rarity !== "all" && card.rarity !== filter.rarity) {
      return false;
    }
    if (filter.tag !== "all" && !cardTags(card).includes(filter.tag)) {
      return false;
    }
    if (filter.race !== "all" && cardRace(card) !== filter.race) {
      return false;
    }
    if (filter.cardClass !== "all" && cardClass(card) !== filter.cardClass) {
      return false;
    }
    if (filter.level !== "all" && cardLevel(card) !== filter.level) {
      return false;
    }
    if (query.length > 0 && !card.name.toLocaleLowerCase("pt-BR").includes(query)) {
      return false;
    }
    return true;
  });
}

export function cardTags(card: Card): readonly string[] {
  if (card.kind !== "monster") {
    return [];
  }
  return card.tags;
}

export function cardRace(card: Card): string | null {
  if (card.kind !== "monster") {
    return null;
  }
  return card.tags.find((tag) => (RACES as readonly string[]).includes(tag)) ?? null;
}

export function cardClass(card: Card): string | null {
  if (card.kind !== "monster") {
    return null;
  }
  return card.tags.find((tag) => (CLASSES as readonly string[]).includes(tag)) ?? null;
}

export function cardLevel(card: Card): number | null {
  if (card.kind !== "monster") {
    return null;
  }
  return card.level;
}

export function tagsIn(cards: readonly Card[]): readonly string[] {
  const tags = new Set<string>();
  for (const card of cards) {
    for (const tag of cardTags(card)) {
      tags.add(tag);
    }
  }
  return [...tags].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

export function kindChoices(): readonly Card["kind"][] {
  return KIND_ORDER;
}

export function asKindFilter(value: string): KindFilter {
  switch (value) {
    case "all":
    case "monster":
    case "spell":
    case "trap":
    case "tower":
    case "biome":
      return value;
    default:
      return "all";
  }
}

export function asRaceFilter(value: string): RaceFilter {
  switch (value) {
    case "all":
    case "HUMAN":
    case "ELF":
    case "DWARF":
    case "ANGEL":
    case "DEMON":
    case "DRAGON":
    case "UNDEAD":
    case "AUTOMATON":
    case "BEAST":
    case "ELEMENTAL":
    case "ABYSSAL":
    case "SWARM":
      return value;
    default:
      return "all";
  }
}

export function asClassFilter(value: string): ClassFilter {
  switch (value) {
    case "all":
    case "WARRIOR":
    case "MAGE":
    case "ARCHER":
    case "ASSASSIN":
    case "CLERIC":
      return value;
    default:
      return "all";
  }
}

export function asLevelFilter(value: string): CardFilter["level"] {
  if (value === "all") {
    return "all";
  }
  const level = Number(value);
  if (Number.isInteger(level) && level >= 1 && level <= 8) {
    return level;
  }
  return "all";
}

export function asRarityFilter(value: string): RarityFilter {
  switch (value) {
    case "all":
    case "comum":
    case "incomum":
    case "rara":
    case "epica":
    case "lendaria":
    case "mitica":
      return value;
    default:
      return "all";
  }
}
