import type { Card } from "../../../src/domain/index";
import { bandFromCard } from "../board/bands";
import { faceCopy } from "../board/catalogText";
import { renderCardFace } from "../board/face";
import { copyMark, kindLabel, rarityLabel } from "./labels";

type CardKey = "ArrowLeft" | "ArrowRight" | "ArrowUp" | "ArrowDown" | "Home" | "End";

export function renderCardPick(options: {
  readonly card: Card;
  readonly texts: ReadonlyMap<string, string>;
  readonly instanceKey: string;
  readonly focusKey: string;
  readonly pressed: boolean;
  readonly tabIndex: number;
  readonly copies?: number;
  readonly onSelect: () => void;
}): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "card-pick";
  button.dataset.cardId = options.card.id;
  button.dataset.focusKey = options.focusKey;
  button.tabIndex = options.tabIndex;
  button.setAttribute("aria-pressed", options.pressed ? "true" : "false");
  const copies = options.copies;
  const count = copies === undefined ? "" : `, ${copyMark(copies)}`;
  button.setAttribute(
    "aria-label",
    `${options.card.name}, ${rarityLabel(options.card.rarity)}, ${kindLabel(options.card.kind)}${count}. Selecionar carta.`,
  );
  button.append(renderCardFace(options.card, bandFromCard(options.card), faceCopy(options.card, options.texts), options.instanceKey));
  button.addEventListener("click", options.onSelect);
  return button;
}

export function renderCardTile(options: {
  readonly card: Card;
  readonly texts: ReadonlyMap<string, string>;
  readonly instanceKey: string;
  readonly focusKey: string;
  readonly pressed: boolean;
  readonly tabIndex: number;
  readonly copies: number;
  readonly onSelect: () => void;
}): HTMLElement {
  const tile = document.createElement("div");
  tile.className = "card-tile";
  tile.append(renderCardPick(options));
  const caption = document.createElement("p");
  caption.className = "copy-caption";
  caption.textContent = copyMark(options.copies);
  tile.append(caption);
  return tile;
}

export function tabStop(index: number, selectedIndex: number): number {
  const preferred = selectedIndex >= 0 ? selectedIndex : 0;
  return index === preferred ? 0 : -1;
}

/** Setas movem o foco dentro da grade. Enter e Espaço selecionam, porque o alvo é um botão. */
export function installCardGrid(grid: HTMLElement): void {
  grid.addEventListener("keydown", (event) => {
    if (!isCardKey(event.key)) {
      return;
    }
    const buttons = [...grid.querySelectorAll<HTMLButtonElement>("button.card-pick")];
    const index = buttons.indexOf(event.target instanceof HTMLButtonElement ? event.target : (document.activeElement as HTMLButtonElement));
    if (index < 0) {
      return;
    }
    event.preventDefault();
    const next = nextIndex(index, buttons.length, columnsIn(buttons), event.key);
    const target = buttons[next];
    if (target === undefined) {
      return;
    }
    for (const button of buttons) {
      button.tabIndex = button === target ? 0 : -1;
    }
    target.focus();
  });
}

function columnsIn(buttons: readonly HTMLButtonElement[]): number {
  const first = buttons[0];
  if (first === undefined) {
    return 1;
  }
  const top = first.offsetTop;
  let count = 0;
  for (const button of buttons) {
    if (Math.abs(button.offsetTop - top) > 2) {
      break;
    }
    count += 1;
  }
  return Math.max(1, count);
}

function nextIndex(index: number, length: number, columns: number, key: CardKey): number {
  switch (key) {
    case "ArrowLeft":
      return Math.max(0, index - 1);
    case "ArrowRight":
      return Math.min(length - 1, index + 1);
    case "ArrowUp":
      return Math.max(0, index - columns);
    case "ArrowDown":
      return Math.min(length - 1, index + columns);
    case "Home":
      return 0;
    case "End":
      return length - 1;
    default: {
      const unexpected: never = key;
      return unexpected;
    }
  }
}

function isCardKey(key: string): key is CardKey {
  switch (key) {
    case "ArrowLeft":
    case "ArrowRight":
    case "ArrowUp":
    case "ArrowDown":
    case "Home":
    case "End":
      return true;
    default:
      return false;
  }
}
