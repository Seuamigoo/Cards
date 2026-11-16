export interface Rng {
  /** Número em [0, 1). */
  next(): number;
}

export function createSeededRng(seed: number): Rng {
  let state = seed | 0;
  return {
    next(): number {
      state = (state + 0x6d2b79f5) | 0;
      let t = Math.imul(state ^ (state >>> 15), 1 | state);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    },
  };
}

export function shuffle<T>(items: readonly T[], rng: Rng): T[] {
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = indexBelow(rng, index + 1);
    const current = copy[index];
    const other = copy[swapWith];
    if (current === undefined || other === undefined) {
      continue;
    }
    copy[index] = other;
    copy[swapWith] = current;
  }
  return copy;
}

function indexBelow(rng: Rng, exclusiveUpper: number): number {
  const roll = rng.next();
  if (!Number.isFinite(roll) || roll <= 0) {
    return 0;
  }
  const scaled = Math.floor(roll * exclusiveUpper);
  if (scaled >= exclusiveUpper) {
    return exclusiveUpper - 1;
  }
  return scaled;
}
