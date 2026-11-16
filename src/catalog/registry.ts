import { copyCard } from "../domain/state";
import type { Card, CardRarity } from "../domain/state";
import { readCardImage } from "./image";

export interface CardCatalog {
  readonly version: number;
  readonly publishedAt: string;
  readonly cards: readonly CardDefinition[];
}

export type CardDefinition = Card;

export type CardErrorCode =
  | "corrupt"
  | "duplicate_id"
  | "invalid_kind"
  | "invalid_rarity"
  | "invalid_stats"
  | "invalid_image"
  | "invalid_card";

export interface CardValidationError {
  readonly index: number;
  readonly cardId: string | null;
  readonly code: CardErrorCode;
  readonly message: string;
}

export type CardRegistryResult =
  | { readonly ok: true; readonly registry: CardRegistry }
  | { readonly ok: false; readonly errors: readonly CardValidationError[] };

export interface UnknownCardError {
  readonly code: "unknown_card";
  readonly cardId: string;
  readonly index: number;
}

export type BuildDeckResult =
  | { readonly ok: true; readonly cards: readonly Card[] }
  | { readonly ok: false; readonly errors: readonly UnknownCardError[] };

const RARITIES = ["comum", "incomum", "rara", "epica", "lendaria", "mitica"] as const;
const KINDS = ["monster", "spell", "trap", "tower", "biome"] as const;

type CardKind = (typeof KINDS)[number];

export class CardRegistry {
  private constructor(
    private readonly catalogVersion: number,
    private readonly published: string,
    private readonly cards: readonly Card[],
    private readonly byId: ReadonlyMap<string, Card>,
  ) {}

  static fromJSON(json: string): CardRegistryResult {
    let raw: unknown;
    try {
      raw = JSON.parse(json) as unknown;
    } catch {
      return fail([issue(-1, null, "corrupt", "JSON de catálogo corrompido.")]);
    }
    if (!isRecord(raw) || !Array.isArray(raw.cards)) {
      return fail([issue(-1, null, "corrupt", "Catálogo sem lista de cartas.")]);
    }
    if (!isVersion(raw.version) || typeof raw.publishedAt !== "string" || raw.publishedAt.length === 0) {
      return fail([issue(-1, null, "corrupt", "Versão ou data de publicação inválida.")]);
    }

    const errors: CardValidationError[] = [];
    const cards: Card[] = [];
    const seen = new Set<string>();
    raw.cards.forEach((entry, index) => {
      const parsed = parseDefinition(entry, index, seen);
      errors.push(...parsed.errors);
      if (parsed.card !== null) {
        cards.push(parsed.card);
        seen.add(parsed.card.id);
      }
    });
    if (errors.length > 0) {
      return fail(errors);
    }
    const byId = new Map(cards.map((card) => [card.id, card]));
    return {
      ok: true,
      registry: new CardRegistry(raw.version, raw.publishedAt, cards, byId),
    };
  }

  get(id: string): Card | undefined {
    return this.byId.get(id);
  }

  all(): readonly Card[] {
    return this.cards;
  }

  byKind(kind: Card["kind"]): readonly Card[] {
    return this.cards.filter((card) => card.kind === kind);
  }

  version(): number {
    return this.catalogVersion;
  }

  publishedAt(): string {
    return this.published;
  }
}

export function buildDeck(registry: CardRegistry, cardIds: readonly string[]): BuildDeckResult {
  const errors: UnknownCardError[] = [];
  const cards: Card[] = [];
  cardIds.forEach((cardId, index) => {
    const card = registry.get(cardId);
    if (card === undefined) {
      errors.push({ code: "unknown_card", cardId, index });
      return;
    }
    cards.push(copyCard(card));
  });
  if (errors.length > 0) {
    return { ok: false, errors };
  }
  return { ok: true, cards };
}

function parseDefinition(
  value: unknown,
  index: number,
  seen: ReadonlySet<string>,
): { readonly card: Card | null; readonly errors: readonly CardValidationError[] } {
  if (!isRecord(value)) {
    return { card: null, errors: [issue(index, null, "invalid_card", "Carta inválida.")] };
  }
  const cardId = typeof value.id === "string" && value.id.length > 0 ? value.id : null;
  const errors: CardValidationError[] = [];
  if (cardId === null) {
    errors.push(issue(index, null, "invalid_card", "Carta sem id."));
  }
  if (typeof value.name !== "string" || value.name.length === 0) {
    errors.push(issue(index, cardId, "invalid_card", "Carta sem nome."));
  }
  if (!isRarity(value.rarity)) {
    errors.push(issue(index, cardId, "invalid_rarity", "Raridade inválida."));
  }
  if (!isKind(value.kind)) {
    errors.push(issue(index, cardId, "invalid_kind", "Tipo de carta inválido."));
  }
  if (Object.hasOwn(value, "image") && readCardImage(value.image) === null) {
    errors.push(issue(index, cardId, "invalid_image", "Imagem inválida."));
  }
  if (value.kind === "monster" && !hasNonNegativeIntegers(value, ["atk", "def"])) {
    errors.push(issue(index, cardId, "invalid_stats", "ATK e DEF precisam ser inteiros maiores ou iguais a zero."));
  }
  if (value.kind === "tower" && value.hp !== undefined && !isNonNegativeInteger(value.hp)) {
    errors.push(issue(index, cardId, "invalid_stats", "HP da Torre precisa ser um inteiro maior ou igual a zero."));
  }
  if (cardId !== null && seen.has(cardId)) {
    errors.push(issue(index, cardId, "duplicate_id", `Id duplicado: ${cardId}.`));
  }
  if (errors.length > 0 || cardId === null || typeof value.name !== "string" || !isRarity(value.rarity) || !isKind(value.kind)) {
    return { card: null, errors };
  }
  const card = buildCard(value, cardId, value.name, value.rarity, value.kind);
  if (card === null) {
    return { card: null, errors: [issue(index, cardId, "invalid_card", "Carta inválida.")] };
  }
  return { card, errors: [] };
}

function buildCard(
  value: Record<string, unknown>,
  id: string,
  name: string,
  rarity: CardRarity,
  kind: CardKind,
): Card | null {
  const image = Object.hasOwn(value, "image") ? readCardImage(value.image) : undefined;
  if (Object.hasOwn(value, "image") && image === null) {
    return null;
  }
  const base = {
    id,
    name,
    rarity,
    ...(image !== undefined && image !== null ? { image } : {}),
  };
  switch (kind) {
    case "monster":
      if (!isNonNegativeInteger(value.atk) || !isNonNegativeInteger(value.def)) {
        return null;
      }
      if (value.race !== undefined && typeof value.race !== "string") {
        return null;
      }
      if (value.class !== undefined && typeof value.class !== "string") {
        return null;
      }
      return {
        ...base,
        kind,
        atk: value.atk,
        def: value.def,
        ...(typeof value.race === "string" ? { race: value.race } : {}),
        ...(typeof value.class === "string" ? { class: value.class } : {}),
      };
    case "spell":
    case "trap":
    case "biome":
      return { ...base, kind };
    case "tower":
      if (value.hp !== undefined && !isNonNegativeInteger(value.hp)) {
        return null;
      }
      return {
        ...base,
        kind,
        ...(isNonNegativeInteger(value.hp) ? { hp: value.hp } : {}),
      };
    default: {
      const unexpected: never = kind;
      throw new Error(`Tipo inválido: ${String(unexpected)}.`);
    }
  }
}

function hasNonNegativeIntegers(value: Record<string, unknown>, keys: readonly string[]): boolean {
  return keys.every((key) => isNonNegativeInteger(value[key]));
}

function isNonNegativeInteger(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isVersion(value: unknown): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0;
}

function isRarity(value: unknown): value is CardRarity {
  return typeof value === "string" && (RARITIES as readonly string[]).includes(value);
}

function isKind(value: unknown): value is CardKind {
  return typeof value === "string" && (KINDS as readonly string[]).includes(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function issue(
  index: number,
  cardId: string | null,
  code: CardErrorCode,
  message: string,
): CardValidationError {
  return { index, cardId, code, message };
}

function fail(errors: readonly CardValidationError[]): CardRegistryResult {
  return { ok: false, errors };
}
