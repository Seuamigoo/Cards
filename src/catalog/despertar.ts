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
  readonly flavor?: string;
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
  flavor?: string,
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
    ...(flavor !== undefined ? { flavor } : {}),
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
  monster("recruta-da-muralha", "Recruta da Muralha", "comum", 2, "HUMAN", "WARRIOR", 1000, 1200, [], [], "Recém-treinado, mas já pronto pra batalha, vestindo o sol da Cidadela."),
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
    wired("Quando é destruído em batalha: o jogador oponente perde 300 HP."),
  ]),
  monster("serpe-das-cinzas", "Serpe das Cinzas", "rara", 5, "DRAGON", "MAGE", 2000, 1500, [
    pending("Ao ser invocada: 1 monstro inimigo perde 500 ATK até o fim do turno."),
  ]),
  monster(
    "esqueleto-guardiao",
    "Esqueleto Guardião",
    "comum",
    2,
    "UNDEAD",
    "WARRIOR",
    800,
    1400,
    [],
    [],
    "Há tanto tempo no posto que o próprio túmulo o esqueceu.",
  ),
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
  {
    id: "dragao-brasa",
    name: "Dragão Brasa",
    rarity: "epica",
    kind: "monster",
    level: 7,
    atk: 1800,
    def: 2200,
    tags: ["DRAGON", "WARRIOR"],
    classTag: "WARRIOR",
    keywords: [],
    effects: [wired("Não pode ser invocado normalmente. Se você controla 3 Filhotes de Brasa no campo, invoque este card da mão e os 3 se fundem a ele como materiais. Ganha +300 ATK por Filhote fundido. Quando vai pro Limbo, os materiais vão junto.")],
  },
  {
    id: "draconato-kaelthar",
    name: "Draconato Kaelthar",
    rarity: "epica",
    kind: "monster",
    level: 7,
    atk: 2400,
    def: 2000,
    tags: ["HUMAN", "DRAGON", "WARRIOR"],
    classTag: "WARRIOR",
    keywords: ["perfurar"],
    effects: [pending("Os Humanos que você controla ganham +200 ATK."), wired("Perfurar.")],
  },
  {
    id: "ceifador-carmesim",
    name: "Ceifador Carmesim",
    rarity: "epica",
    kind: "monster",
    level: 6,
    atk: 2300,
    def: 1500,
    tags: ["UNDEAD", "DEMON", "ASSASSIN"],
    classTag: "ASSASSIN",
    keywords: ["impeto"],
    effects: [wired("Ímpeto."), pending("Quando destrói um monstro em batalha: o jogador oponente perde 300 HP.")],
  },
  {
    id: "arvore-sentinela",
    name: "Árvore-Sentinela",
    rarity: "rara",
    kind: "tower",
    def: 1800,
    effects: [wired("Seus Elfos ganham +200 ATK.")],
  },
  {
    id: "fortaleza-da-montanha",
    name: "Fortaleza da Montanha",
    rarity: "rara",
    kind: "tower",
    def: 2600,
    effects: [wired("Seus Anões ganham +200 DEF.")],
  },
  monster("batedora-da-folhagem", "Batedora da Folhagem", "comum", 2, "ELF", "ARCHER", 1000, 600, [wired("Ao ser invocada: a Torre inimiga perde 300 DEF até o fim do turno.")]),
  monster("sentinela-do-bosque", "Sentinela do Bosque", "comum", 3, "ELF", "WARRIOR", 900, 1500, [wired("Provocar.")], ["provocar"]),
  monster("lamina-do-crepusculo", "Lâmina do Crepúsculo", "incomum", 3, "ELF", "ASSASSIN", 1300, 700, [wired("Ímpeto.")], ["impeto"]),
  monster("oraculo-das-copas", "Oráculo das Copas", "incomum", 4, "ELF", "MAGE", 1300, 1100, [wired("Ao ser invocado: compre 1 carta.")]),
  monster("arqueira-mor-sylwen", "Arqueira-Mor Sylwen", "epica", 6, "ELF", "ARCHER", 2200, 1600, [wired("Pode atacar a Torre inimiga mesmo havendo monstros inimigos. Os outros Elfos Arqueiros que você controla ganham +200 ATK.")], ["ataqueTorre"]),
  monster("mineiro-da-forja-funda", "Mineiro da Forja Funda", "comum", 2, "DWARF", "WARRIOR", 800, 1300, [], [], "Desce onde a forja não esfria e sobe com o ferro ainda quente."),
  monster("besteiro-de-pedra", "Besteiro de Pedra", "comum", 3, "DWARF", "ARCHER", 1200, 1000, [wired("Ao ser invocado: a Torre inimiga perde 400 DEF até o fim do turno.")]),
  monster("escudo-de-bigorna", "Escudo de Bigorna", "incomum", 4, "DWARF", "WARRIOR", 1000, 1800, [wired("Provocar.")], ["provocar"]),
  monster("sacerdote-das-runas", "Sacerdote das Runas", "incomum", 4, "DWARF", "CLERIC", 900, 1500, [wired("Enquanto estiver em campo, sua Torre ganha +300 DEF.")]),
  monster("rei-ferreiro-thorvak", "Rei-Ferreiro Thorvak", "epica", 7, "DWARF", "WARRIOR", 2400, 2800, [wired("Provocar. Os outros Anões que você controla ganham +300 DEF.")], ["provocar"]),
  monster("querubim-vigia", "Querubim Vigia", "comum", 2, "ANGEL", "CLERIC", 700, 1100, [wired("Ao ser invocado: você recupera 300 HP.")]),
  monster("guardiao-alado", "Guardião Alado", "comum", 3, "ANGEL", "WARRIOR", 1000, 1400, [wired("Provocar.")], ["provocar"]),
  monster("mensageira-da-aurora", "Mensageira da Aurora", "incomum", 4, "ANGEL", "MAGE", 1200, 1200, [wired("Ao ser invocada: compre 1 carta.")]),
  monster("arqueira-celeste", "Arqueira Celeste", "incomum", 4, "ANGEL", "ARCHER", 1500, 1000, [wired("Ao ser invocada: a Torre inimiga perde 500 DEF até o fim do turno.")]),
  monster("serafim-justiceiro", "Serafim Justiceiro", "epica", 6, "ANGEL", "WARRIOR", 2300, 1900, [wired("Perfurar. 1x por turno, na sua Main: você recupera 500 HP.")], ["perfurar"]),
  monster("engrenagem-sentinela", "Engrenagem Sentinela", "comum", 1, "AUTOMATON", "WARRIOR", 600, 1200, [], [], "Gira no mesmo lugar há anos, e ainda não perdeu o compasso."),
  monster("torreta-mecanica", "Torreta Mecânica", "comum", 3, "AUTOMATON", "ARCHER", 1200, 900, [wired("Ao ser invocada: a Torre inimiga perde 300 DEF até o fim do turno.")]),
  monster("calculista-de-cobre", "Calculista de Cobre", "incomum", 3, "AUTOMATON", "MAGE", 900, 1200, [wired("Ao ser invocado: se você controla outro Autômato, compre 1 carta.")]),
  monster("golem-de-latao", "Golem de Latão", "incomum", 4, "AUTOMATON", "WARRIOR", 1400, 1700, [wired("Provocar.")], ["provocar"]),
  monster("colosso-de-aco", "Colosso de Aço", "epica", 7, "AUTOMATON", "WARRIOR", 2500, 2700, [wired("Ganha +200 ATK por cada outro Autômato que você controla (máx. +600).")]),
  monster("lobo-da-estepe", "Lobo da Estepe", "comum", 2, "BEAST", "ASSASSIN", 1100, 500, [wired("Ímpeto.")], ["impeto"]),
  monster("xama-coruja", "Xamã-Coruja", "comum", 3, "BEAST", "CLERIC", 800, 1200, [wired("1x por turno, na sua Main: você recupera 300 HP.")]),
  monster("javali-encouracado", "Javali Encouraçado", "comum", 3, "BEAST", "WARRIOR", 1200, 1300, [wired("Perfurar.")], ["perfurar"]),
  monster("pantera-das-sombras", "Pantera das Sombras", "incomum", 4, "BEAST", "ASSASSIN", 1600, 800, [wired("Ímpeto.")], ["impeto"]),
  monster("alfa-da-matilha", "Alfa da Matilha", "epica", 6, "BEAST", "WARRIOR", 2200, 1500, [wired("As outras Bestas que você controla ganham +200 ATK e Ímpeto.")]),
  monster("fagulha-viva", "Fagulha Viva", "comum", 2, "ELEMENTAL", "ASSASSIN", 1000, 600, [wired("Ao ser invocada: o jogador oponente perde 200 HP.")]),
  monster("muralha-de-rocha", "Muralha de Rocha", "comum", 3, "ELEMENTAL", "WARRIOR", 700, 1700, [wired("Provocar.")], ["provocar"]),
  monster("espirito-da-nevoa", "Espírito da Névoa", "incomum", 3, "ELEMENTAL", "MAGE", 1100, 1100, [wired("Ao ser invocado: 1 monstro inimigo perde 400 ATK até o fim do turno.")]),
  monster("ondina-da-fonte", "Ondina da Fonte", "incomum", 4, "ELEMENTAL", "CLERIC", 1000, 1500, [wired("1x por turno, na sua Main: você recupera 400 HP.")]),
  monster("tita-da-tempestade", "Titã da Tempestade", "epica", 7, "ELEMENTAL", "MAGE", 2600, 2200, [wired("Ao ser invocado: todos os monstros inimigos perdem 500 ATK até o fim do turno.")]),
  monster("enguia-abissal", "Enguia Abissal", "comum", 2, "ABYSSAL", "ASSASSIN", 1000, 500, [wired("Ímpeto.")], ["impeto"]),
  monster("guardiao-das-fossas", "Guardião das Fossas", "comum", 3, "ABYSSAL", "WARRIOR", 900, 1500, [wired("Provocar.")], ["provocar"]),
  monster("bruxa-das-mares", "Bruxa das Marés", "incomum", 4, "ABYSSAL", "MAGE", 1300, 1100, [wired("Ao ser invocada: 1 monstro inimigo perde 500 ATK até o fim do turno.")]),
  monster("assassino-abissal", "Assassino Abissal", "incomum", 4, "ABYSSAL", "ASSASSIN", 1600, 700, [wired("Ímpeto. Quando destrói um monstro em batalha: o jogador oponente perde 300 HP.")], ["impeto"]),
  monster("leviatan-faminto", "Leviatã Faminto", "epica", 7, "ABYSSAL", "WARRIOR", 2700, 2100, [wired("Perfurar.")], ["perfurar"]),
  monster("larva-operaria", "Larva Operária", "comum", 1, "SWARM", "WARRIOR", 500, 500, [wired("Ganha +100 ATK por cada outro Enxame que você controla.")]),
  monster("zangao-picador", "Zangão Picador", "comum", 2, "SWARM", "ASSASSIN", 900, 400, [wired("Ímpeto.")], ["impeto"]),
  monster("vespa-atiradora", "Vespa Atiradora", "comum", 3, "SWARM", "ARCHER", 1100, 700, [wired("Ao ser invocada: a Torre inimiga perde 300 DEF até o fim do turno.")]),
  monster("zeladora-da-colmeia", "Zeladora da Colmeia", "incomum", 3, "SWARM", "CLERIC", 600, 1200, [wired("Ao ser invocada: você recupera 200 HP por cada Enxame que você controla.")]),
  monster("rainha-da-colmeia", "Rainha da Colmeia", "epica", 6, "SWARM", "MAGE", 2000, 1800, [wired("Os outros Enxames que você controla ganham +200 ATK.")]),
];

export const DESPERTAR_PENDING: readonly DespertarCard[] = [];

const RACE_LABEL: Readonly<Record<string, string>> = {
  HUMAN: "Humano",
  DRAGON: "Dragão",
  UNDEAD: "Morto-Vivo",
  DEMON: "Demônio",
  ELF: "Elfo",
  DWARF: "Anão",
  ANGEL: "Anjo",
  AUTOMATON: "Autômato",
  BEAST: "Besta",
  ELEMENTAL: "Elemental",
  ABYSSAL: "Abissal",
  SWARM: "Enxame",
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
