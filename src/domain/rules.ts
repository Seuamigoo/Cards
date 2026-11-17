import type { MonsterCard, MonsterInstance, TowerInstance } from "./state";

export const CLASS_TAGS = ["WARRIOR", "MAGE", "ARCHER", "ASSASSIN", "CLERIC"] as const;

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
