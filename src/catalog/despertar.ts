import type { Keyword } from "../domain/state";

export interface PrintedEffect {
  readonly text: string;
  readonly implemented: boolean;
}

export interface DespertarCard {
  readonly id: string;
  readonly name: string;
  readonly rarity: "comum" | "incomum" | "rara" | "epica" | "lendaria" | "mitica";
  readonly kind: "monster" | "spell" | "trap" | "tower" | "biome";
  readonly level?: number;
  readonly atk?: number;
  readonly def?: number;
  readonly tags?: readonly string[];
  readonly keywords?: readonly Keyword[];
  readonly classTag?: string;
  readonly effects: readonly PrintedEffect[];
  readonly todo?: readonly string[];
}

const effect = (text: string, implemented: boolean): PrintedEffect => ({ text, implemented });
const pending = (text: string): PrintedEffect => effect(text, false);
const wired = (text: string): PrintedEffect => effect(text, true);

function monster(
  id: string,
  name: string,
  rarity: DespertarCard["rarity"],
  level: number,
  race: string,
  classTag: string,
  atk: number,
  def: number,
  effects: readonly PrintedEffect[],
  keywords: readonly Keyword[] = [],
): DespertarCard {
  return {
    id,
    name,
    rarity,
    kind: "monster",
    level,
    atk,
    def,
    tags: [race, classTag],
    classTag,
    keywords,
    effects,
  };
}

export const DESPERTAR_CARDS: readonly DespertarCard[] = [
  {
    id: "cidadela-do-rei",
    name: "Cidadela do Rei",
    rarity: "rara",
    kind: "tower",
    def: 2200,
    effects: [pending("Humanos que você controla ganham +200 ATK/DEF por cada Humano no seu campo (máx. +800).")],
  },
  {
    id: "necropole-silente",
    name: "Necrópole Silente",
    rarity: "rara",
    kind: "tower",
    def: 2000,
    effects: [pending("1x por turno, na sua Main: invoque do seu Limbo 1 Morto-Vivo Nível 2 ou menor em Defesa. Ele não pode atacar neste turno.")],
  },
  {
    id: "planicie-dourada",
    name: "Planície Dourada",
    rarity: "incomum",
    kind: "biome",
    effects: [pending("Todos os Humanos ganham +200 DEF.")],
  },
  {
    id: "pantano-das-lapides",
    name: "Pântano das Lápides",
    rarity: "incomum",
    kind: "biome",
    effects: [pending("Todos os Mortos-Vivos ganham +200 ATK. Todos os Anjos perdem 200 ATK.")],
  },
  monster("recruta-da-muralha", "Recruta da Muralha", "comum", 2, "HUMAN", "WARRIOR", 1000, 1200, []),
  monster("arqueira-da-torre-norte", "Arqueira da Torre Norte", "comum", 3, "HUMAN", "ARCHER", 1200, 800, [
    pending("Ao ser invocada: a Torre inimiga perde 400 DEF até o fim do turno."),
  ]),
  monster("escudeiro-juramentado", "Escudeiro Juramentado", "comum", 3, "HUMAN", "WARRIOR", 800, 1600, [wired("Provocar.")], ["provocar"]),
  monster("lamina-sem-brasao", "Lâmina Sem Brasão", "incomum", 3, "HUMAN", "ASSASSIN", 1300, 600, [wired("Ímpeto.")], ["impeto"]),
  monster("cleriga-da-aurora", "Clériga da Aurora", "incomum", 4, "HUMAN", "CLERIC", 1000, 1400, [
    pending("1x por turno, na sua Main: você recupera 500 HP."),
  ]),
  monster("mago-da-corte", "Mago da Corte", "incomum", 4, "HUMAN", "MAGE", 1400, 1000, [
    pending("Ao ser invocado: se você controla uma Torre, compre 1 carta."),
  ]),
  monster("capita-lyra-valmont", "Capitã Lyra Valmont", "rara", 4, "HUMAN", "WARRIOR", 1700, 1000, [
    pending("Os outros Humanos que você controla ganham +100 ATK."),
  ]),
  monster("paladino-do-estandarte", "Paladino do Estandarte", "epica", 6, "HUMAN", "WARRIOR", 2300, 2000, [
    pending("Enquanto estiver em campo, sua Torre ganha +500 DEF."),
  ]),
  monster(
    "rei-aldren",
    "Rei Aldren, o Último Bastião",
    "lendaria",
    8,
    "HUMAN",
    "WARRIOR",
    2600,
    2600,
    [pending("Ganha +200 ATK por cada outro Humano que você controla."), wired("Provocar.")],
    ["provocar"],
  ),
  monster("filhote-de-brasa", "Filhote de Brasa", "comum", 3, "DRAGON", "WARRIOR", 1100, 900, [
    pending("Quando é destruído em batalha: o jogador oponente perde 300 HP."),
  ]),
  monster("serpe-das-cinzas", "Serpe das Cinzas", "rara", 5, "DRAGON", "MAGE", 2000, 1500, [
    pending("Ao ser invocada: 1 monstro inimigo perde 500 ATK até o fim do turno."),
  ]),
  monster("esqueleto-guardiao", "Esqueleto Guardião", "comum", 2, "UNDEAD", "WARRIOR", 800, 1400, []),
  monster("carnical-faminto", "Carniçal Faminto", "comum", 3, "UNDEAD", "ASSASSIN", 1300, 700, [wired("Ímpeto.")], ["impeto"]),
  monster("acolita-do-ossuario", "Acólita do Ossuário", "incomum", 3, "UNDEAD", "CLERIC", 700, 1200, [
    pending("1x por turno, na sua Main: mande 1 carta da mão pro Limbo e compre 1."),
  ]),
  monster(
    "arqueiro-espectral",
    "Arqueiro Espectral",
    "incomum",
    4,
    "UNDEAD",
    "ARCHER",
    1500,
    900,
    [wired("Pode atacar a Torre inimiga mesmo havendo monstros inimigos.")],
    ["ataqueTorre"],
  ),
  monster("necromante-velka", "Necromante Velka", "rara", 4, "UNDEAD", "MAGE", 1400, 1100, [
    pending("1x por turno, na sua Main: invoque do seu Limbo 1 Morto-Vivo Nível 2 ou menor em Defesa."),
  ]),
  monster("cavaleiro-sem-tumulo", "Cavaleiro Sem Túmulo", "epica", 6, "UNDEAD", "WARRIOR", 2200, 1800, [
    pending("Quando vai pro Limbo: invoque do seu Limbo 1 Morto-Vivo Nível 4 ou menor."),
  ]),
  monster("rainha-ossuaria-morgala", "Rainha Ossuária Mórgala", "lendaria", 8, "UNDEAD", "MAGE", 2700, 2400, [
    pending("Enquanto estiver em campo, os monstros inimigos perdem 400 ATK."),
  ]),
  monster("diabrete-zombeteiro", "Diabrete Zombeteiro", "comum", 2, "DEMON", "ASSASSIN", 900, 500, [
    pending("Ao ser invocado: o jogador oponente perde 200 HP."),
  ]),
  monster("algoz-do-abismo", "Algoz do Abismo", "rara", 5, "DEMON", "WARRIOR", 2100, 1300, [
    pending("1x por turno: pague 500 HP para ganhar +500 ATK até o fim do turno."),
  ]),
  { id: "pocao-de-campanha", name: "Poção de Campanha", rarity: "comum", kind: "spell", effects: [pending("Você recupera 1000 HP.")] },
  { id: "reforco-de-muralha", name: "Reforço de Muralha", rarity: "comum", kind: "spell", effects: [pending("Sua Torre ganha +800 DEF até o fim do próximo turno do oponente.")] },
  { id: "lamina-afiada", name: "Lâmina Afiada", rarity: "comum", kind: "spell", effects: [pending("Equipamento: o monstro equipado ganha +400 ATK.")] },
  { id: "estratagema", name: "Estratagema", rarity: "incomum", kind: "spell", effects: [pending("Compre 2 cartas e depois mande 1 da mão pro Limbo.")] },
  {
    id: "ariete-de-cerco",
    name: "Aríete de Cerco",
    rarity: "incomum",
    kind: "spell",
    effects: [pending("Equipamento: 1x por turno, o monstro equipado pode atacar a Torre inimiga mesmo havendo monstros inimigos.")],
  },
  { id: "chamado-do-limbo", name: "Chamado do Limbo", rarity: "rara", kind: "spell", effects: [pending("Invoque do seu Limbo 1 monstro Nível 4 ou menor.")] },
  {
    id: "muralha-de-escudos",
    name: "Muralha de Escudos",
    rarity: "comum",
    kind: "trap",
    effects: [pending("Quando um monstro inimigo declara ataque: o monstro atacado ganha +800 DEF até o fim do turno.")],
  },
  {
    id: "fosso-de-estacas",
    name: "Fosso de Estacas",
    rarity: "incomum",
    kind: "trap",
    effects: [pending("Quando um monstro inimigo com 1500 ATK ou menos declara ataque: destrua esse monstro.")],
  },
  {
    id: "contra-ataque",
    name: "Contra-Ataque",
    rarity: "rara",
    kind: "trap",
    effects: [pending("Quando um monstro inimigo ataca sua Torre ou você diretamente: anule o ataque e o jogador oponente perde HP igual à metade do ATK do atacante.")],
  },
];

export const DESPERTAR_PENDING: readonly DespertarCard[] = [
  {
    id: "draconato-kaelthar",
    name: "Draconato Kaelthar",
    rarity: "epica",
    kind: "monster",
    atk: 2400,
    def: 2000,
    tags: ["HUMAN", "DRAGON", "WARRIOR"],
    classTag: "WARRIOR",
    keywords: ["perfurar"],
    effects: [pending("Os Humanos que você controla ganham +200 ATK."), wired("Perfurar.")],
    todo: ["Nível não consta no GDD v0.2."],
  },
  {
    id: "ceifador-carmesim",
    name: "Ceifador Carmesim",
    rarity: "epica",
    kind: "monster",
    atk: 2300,
    def: 1500,
    tags: ["UNDEAD", "DEMON", "ASSASSIN"],
    classTag: "ASSASSIN",
    keywords: ["impeto"],
    effects: [wired("Ímpeto."), pending("Quando destrói um monstro em batalha: o jogador oponente perde 300 HP.")],
    todo: ["Nível não consta no GDD v0.2."],
  },
];

const RACE_LABEL: Readonly<Record<string, string>> = {
  HUMAN: "Humano",
  DRAGON: "Dragão",
  UNDEAD: "Morto-Vivo",
  DEMON: "Demônio",
};

const CLASS_LABEL: Readonly<Record<string, string>> = {
  WARRIOR: "Guerreiro",
  MAGE: "Mago",
  ARCHER: "Arqueiro",
  ASSASSIN: "Assassino",
  CLERIC: "Clérigo",
};

export function placeholderSvg(card: DespertarCard): string {
  const races = (card.tags ?? []).filter((tag) => tag !== card.classTag).map((tag) => RACE_LABEL[tag] ?? tag);
  const classLabel = card.classTag !== undefined ? CLASS_LABEL[card.classTag] ?? card.classTag : kindLabel(card.kind);
  const line = races.length > 0 ? `${races.join(" + ")} / ${classLabel}` : classLabel;
  const stats = statLine(card);
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="320" height="460" viewBox="0 0 320 460">
  <rect width="320" height="460" rx="18" fill="#1c2430"/>
  <rect x="16" y="16" width="288" height="428" rx="12" fill="#121820" stroke="#d7c4a3" stroke-width="2"/>
  <text x="160" y="78" text-anchor="middle" fill="#f4efe6" font-family="sans-serif" font-size="22">${escapeXml(card.name)}</text>
  <text x="160" y="118" text-anchor="middle" fill="#d7c4a3" font-family="sans-serif" font-size="16">${escapeXml(line)}</text>
  <text x="160" y="400" text-anchor="middle" fill="#f4efe6" font-family="sans-serif" font-size="18">${escapeXml(stats)}</text>
</svg>
`;
}

function kindLabel(kind: DespertarCard["kind"]): string {
  switch (kind) {
    case "monster":
      return "Monstro";
    case "spell":
      return "Magia";
    case "trap":
      return "Armadilha";
    case "tower":
      return "Torre";
    case "biome":
      return "Bioma";
    default: {
      const unexpected: never = kind;
      return unexpected;
    }
  }
}

function statLine(card: DespertarCard): string {
  if (card.kind === "monster" && card.atk !== undefined && card.def !== undefined) {
    const level = card.level !== undefined ? `Nv ${card.level} · ` : "";
    return `${level}ATK ${card.atk} / DEF ${card.def}`;
  }
  if (card.kind === "tower" && card.def !== undefined) {
    return `DEF ${card.def}`;
  }
  return kindLabel(card.kind);
}

function escapeXml(value: string): string {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;");
}

export function despertarImage(card: DespertarCard): { readonly src: string; readonly alt: string } {
  return { src: `assets/cards/${card.id}.svg`, alt: card.name };
}
