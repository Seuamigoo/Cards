import type { BotLevel } from "../../src/ai/bot";
import type { GameMode } from "../../src/domain/index";

/** A primeira rota do app. O duelo só abre depois de Batalhar. */
export const INITIAL_SCREEN = "gate";

export type HomeEntryId = "battle" | "deck" | "collection" | "shop" | "profile";

export interface HomeEntry {
  readonly id: HomeEntryId;
  readonly label: string;
  readonly ready: boolean;
  readonly hint: string | null;
}

export function homeEntries(): readonly HomeEntry[] {
  return [
    { id: "battle", label: "Batalhar", ready: true, hint: null },
    { id: "deck", label: "Organizar deck", ready: false, hint: "em breve" },
    { id: "collection", label: "Coleção", ready: false, hint: "em breve" },
    { id: "shop", label: "Loja", ready: false, hint: "em breve" },
    { id: "profile", label: "Perfil", ready: false, hint: "em breve" },
  ];
}

export interface AiDuelRequest {
  readonly mode: GameMode;
  readonly level: BotLevel;
}

/**
 * Único pedido de J x IA.
 * Quando o duelo passar a nascer só com modo e dificuldade, troque o adaptador em main.ts que consome este objeto.
 */
export function aiDuelRequest(mode: GameMode, level: BotLevel): AiDuelRequest {
  return { mode, level };
}

/** A mesa do Dragão Brasa fica fora da tela do duelo e só no dev. */
export function showDragonTable(dev: boolean): boolean {
  return dev;
}

export function pvpHint(guest: boolean): string {
  return guest ? "Faça login." : "em breve";
}
