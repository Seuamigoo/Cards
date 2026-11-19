import type { MonsterCard, MonsterInstance, TowerInstance } from "./state";

export const CLASS_TAGS = ["WARRIOR", "MAGE", "ARCHER", "ASSASSIN", "CLERIC"] as const;

export const AGULHA_CARD_ID = "agulha-da-convergencia";

const CLASS_TAG_SET = new Set<string>(CLASS_TAGS);

export function parentRaces(card: MonsterCard): readonly string[] {
  return card.tags.filter((tag) => !CLASS_TAG_SET.has(tag));
}

export function isMestico(card: MonsterCard): boolean {
  return parentRaces(card).length === 2;
}

export function materialsCoverParents(
  parents: readonly string[],
  materialRaces: readonly (readonly string[])[],
): boolean {
  if (parents.length !== 2 || materialRaces.length !== 2) {
    return false;
  }
  const [first, second] = parents;
  const [left, right] = materialRaces;
  if (first === undefined || second === undefined || left === undefined || right === undefined) {
    return false;
  }
  const covers = (races: readonly string[], parent: string): boolean => races.includes(parent);
  return (covers(left, first) && covers(right, second)) || (covers(left, second) && covers(right, first));
}

export function tributesRequired(level: number): number {
  if (level <= 4) {
    return 0;
  }
  if (level <= 6) {
    return 1;
  }
  return 2;
}

export function towerDefense(tower: TowerInstance): number {
  return tower.card.def + tower.defBonus;
}

export function hasKeyword(card: MonsterCard, keyword: MonsterCard["keywords"][number]): boolean {
  return card.keywords.includes(keyword);
}

export function ignoresMonsterBlock(monster: MonsterInstance): boolean {
  return hasKeyword(monster.card, "ataqueTorre") || monster.siege === true;
}

export function combinations(indexes: readonly number[], size: number): number[][] {
  if (size === 0) {
    return [[]];
  }
  const found: number[][] = [];
  const walk = (start: number, chosen: number[]): void => {
    if (chosen.length === size) {
      found.push([...chosen]);
      return;
    }
    for (let index = start; index < indexes.length; index += 1) {
      const zone = indexes[index];
      if (zone === undefined) {
        continue;
      }
      chosen.push(zone);
      walk(index + 1, chosen);
      chosen.pop();
    }
  };
  walk(0, []);
  return found;
}
