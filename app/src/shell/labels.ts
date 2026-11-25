import type { Card, CardRarity } from "../../../src/domain/index";

const RARITY_LABEL: Readonly<Record<CardRarity, string>> = {
  comum: "Comum",
  incomum: "Incomum",
  rara: "Rara",
  epica: "Épica",
  lendaria: "Lendária",
  mitica: "Mítica",
};

const KIND_LABEL: Readonly<Record<Card["kind"], string>> = {
  monster: "Monstro",
  spell: "Magia",
  trap: "Armadilha",
  tower: "Torre",
  biome: "Bioma",
};

export function rarityLabel(rarity: CardRarity): string {
  return RARITY_LABEL[rarity];
}

export function kindLabel(kind: Card["kind"]): string {
  return KIND_LABEL[kind];
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("pt-BR").format(value);
}

export function formatPercent(count: number, total: number): string {
  if (total <= 0) {
    return "0%";
  }
  return `${new Intl.NumberFormat("pt-BR", {
    minimumFractionDigits: 1,
    maximumFractionDigits: 1,
  }).format((count / total) * 100)}%`;
}

export function copyMark(count: number): string {
  return `x${count}`;
}

const TAG_LABEL: Readonly<Record<string, string>> = {
  HUMAN: "Humano",
  ELF: "Elfo",
  DWARF: "Anão",
  ANGEL: "Anjo",
  DEMON: "Demônio",
  DRAGON: "Dragão",
  UNDEAD: "Morto-vivo",
  AUTOMATON: "Autômato",
  BEAST: "Besta",
  ELEMENTAL: "Elemental",
  ABYSSAL: "Abissal",
  SWARM: "Enxame",
  WARRIOR: "Guerreiro",
  MAGE: "Mago",
  ARCHER: "Arqueiro",
  ASSASSIN: "Assassino",
  CLERIC: "Clérigo",
};

export function tagLabel(tag: string): string {
  return TAG_LABEL[tag] ?? tag;
}
