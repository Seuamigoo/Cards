import type { CardRegistry } from "../../../src/catalog/index";
import type { Card, GameMode } from "../../../src/domain/index";
import { MODE_CONFIGS } from "../../../src/domain/index";
import { bandFromCard } from "../board/bands";
import { faceCopy } from "../board/catalogText";
import { renderCardFace } from "../board/face";
import { installCardGrid, renderCardPick, renderCardTile, tabStop } from "./cardPick";
import {
  CLASSES,
  RACES,
  asClassFilter,
  asKindFilter,
  asLevelFilter,
  asRaceFilter,
  asRarityFilter,
  filterCards,
  tagsIn,
} from "./cardFilters";
import type { CardFilter } from "./cardFilters";
import { ADD_DISABLED_NO_COPIES, copiesInDeck, deckEditOffer, deckSizeStatus } from "./deckRules";
import { RARITY_ORDER, chancesByRarity, marketSplit } from "./economy";
import { formatNumber, formatPercent, kindLabel, rarityLabel, tagLabel } from "./labels";
import type { Movimento, PlayerRecord } from "./playerData";
import { EXAMPLE_NOTICE, exampleShowcase } from "./shopSource";
import type { ShopBox } from "./shopSource";

export function renderDeckPlace(options: {
  readonly record: PlayerRecord;
  readonly cards: CardRegistry;
  readonly texts: ReadonlyMap<string, string>;
  readonly mode: GameMode;
  readonly selectedId: string | null;
  readonly filter: CardFilter;
  readonly onMode: (mode: GameMode) => void;
  readonly onSelect: (cardId: string) => void;
  readonly onFilter: (filter: CardFilter) => void;
  readonly onAdd: () => void;
  readonly onRemove: () => void;
}): HTMLElement {
  const page = document.createElement("div");
  page.className = "deck-layout";
  const deck = options.record.decks.find((item) => item.mode === options.mode);
  const ids = deck?.cardIds ?? [];
  page.append(deckPanel(options, ids), stagePanel(options, ids), lineageNote(options.mode), collectionStrip(options));
  return page;
}

function deckPanel(options: Parameters<typeof renderDeckPlace>[0], ids: readonly string[]): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "deck-panel";
  const title = document.createElement("h2");
  title.textContent = options.mode === "classic" ? "Deck Clássico" : "Deck Blitz";
  const toggle = document.createElement("div");
  toggle.className = "segment";
  toggle.append(
    modeButton("Clássico", options.mode === "classic", () => options.onMode("classic")),
    modeButton("Blitz", options.mode === "blitz", () => options.onMode("blitz")),
  );
  const status = deckSizeStatus(options.mode, ids.length);
  const count = document.createElement("p");
  count.textContent = `${ids.length} cartas. ${status.valid ? "Deck válido." : status.reason ?? ""}`;
  const grid = document.createElement("div");
  grid.className = "deck-scroll";
  ids.forEach((cardId, index) => {
    const card = options.cards.get(cardId);
    if (card === undefined) {
      return;
    }
    grid.append(renderCardPick({
      card,
      texts: options.texts,
      instanceKey: `deck:${options.mode}:${index}:${card.id}`,
      focusKey: `deck-${index}`,
      pressed: card.id === options.selectedId,
      tabIndex: tabStop(index, ids.findIndex((id) => id === options.selectedId)),
      onSelect: () => options.onSelect(card.id),
    }));
  });
  installCardGrid(grid);
  panel.append(title, toggle, count, grid);
  return panel;
}

function stagePanel(options: Parameters<typeof renderDeckPlace>[0], ids: readonly string[]): HTMLElement {
  const panel = document.createElement("section");
  panel.className = "stage-panel";
  const title = document.createElement("h2");
  title.textContent = "Carta selecionada";
  panel.append(title);
  const card = options.selectedId === null ? undefined : options.cards.get(options.selectedId);
  if (card === undefined) {
    const empty = document.createElement("p");
    empty.textContent = "Selecione uma carta.";
    panel.append(empty);
    return panel;
  }
  const owned = options.record.collection.find((item) => item.carta === card.id)?.quantidade ?? 0;
  const inDeck = copiesInDeck(ids, card.id);
  const listed = options.record.marketLocked.includes(card.id);
  const offer = deckEditOffer({ owned, inDeck, rarity: card.rarity, listed });
  panel.append(renderCardFace(card, bandFromCard(card), faceCopy(card, options.texts), `stage:${card.id}`));
  const meta = document.createElement("p");
  meta.textContent = `${card.name}. ${rarityLabel(card.rarity)}. Na coleção: ${owned}. No deck: ${inDeck}.`;
  const row = document.createElement("div");
  row.className = "stage-actions";
  if (offer.add.state === "enabled") {
    row.append(action("Adicionar ao deck", false, options.onAdd));
  } else if (offer.add.state === "disabled") {
    row.append(action("Adicionar ao deck", true, options.onAdd));
    row.append(reason(offer.add.reason));
  } else {
    row.append(reason(ADD_DISABLED_NO_COPIES));
  }
  if (offer.remove) {
    row.append(action("Remover do deck", listed, options.onRemove));
  }
  panel.append(meta, row);
  return panel;
}

function lineageNote(mode: GameMode): HTMLElement {
  const section = document.createElement("section");
  section.className = "lineage-soon";
  const title = document.createElement("h2");
  title.textContent = "Deck de Linhagem";
  const text = document.createElement("p");
  const max = MODE_CONFIGS[mode].lineageDeckMax;
  text.textContent = `Até ${max} cartas no ${mode === "classic" ? "Clássico" : "Blitz"}. em breve`;
  const button = action("Abrir Linhagem", true, () => undefined);
  button.setAttribute("aria-describedby", "lineage-soon");
  text.id = "lineage-soon";
  section.append(title, text, button);
  return section;
}

function collectionStrip(options: Parameters<typeof renderDeckPlace>[0]): HTMLElement {
  const section = document.createElement("section");
  section.className = "collection-panel";
  const title = document.createElement("h2");
  title.textContent = "Coleção";
  section.append(title, renderCollectionGrid({
    record: options.record,
    cards: options.cards,
    texts: options.texts,
    filter: options.filter,
    selectedId: options.selectedId,
    onFilter: options.onFilter,
    onSelect: options.onSelect,
  }));
  return section;
}

export function renderCollectionGrid(options: {
  readonly record: PlayerRecord;
  readonly cards: CardRegistry;
  readonly texts: ReadonlyMap<string, string>;
  readonly filter: CardFilter;
  readonly selectedId: string | null;
  readonly onFilter: (filter: CardFilter) => void;
  readonly onSelect: (cardId: string) => void;
}): HTMLElement {
  const owned = options.record.collection
    .map((entry) => ({ card: options.cards.get(entry.carta), count: entry.quantidade }))
    .filter((entry): entry is { card: Card; count: number } => entry.card !== undefined);
  const visible = filterCards(owned.map((entry) => entry.card), options.filter);
  const root = document.createElement("div");
  root.append(filterBar(owned.map((entry) => entry.card), options.filter, options.onFilter));
  const grid = document.createElement("div");
  grid.className = "collection-grid";
  if (visible.length === 0) {
    const empty = document.createElement("p");
    empty.textContent = "Nenhuma carta com esses filtros.";
    grid.append(empty);
  }
  visible.forEach((card, index) => {
    const count = owned.find((entry) => entry.card.id === card.id)?.count ?? 0;
    grid.append(renderCardTile({
      card,
      texts: options.texts,
      instanceKey: `collection:${card.id}`,
      focusKey: `collection-${card.id}`,
      pressed: card.id === options.selectedId,
      tabIndex: tabStop(index, visible.findIndex((item) => item.id === options.selectedId)),
      copies: count,
      onSelect: () => options.onSelect(card.id),
    }));
  });
  installCardGrid(grid);
  root.append(grid);
  return root;
}

function filterBar(cards: readonly Card[], filter: CardFilter, onFilter: (filter: CardFilter) => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "filter-bar";
  const search = document.createElement("input");
  search.type = "search";
  search.value = filter.query;
  search.setAttribute("aria-label", "Buscar por nome");
  search.addEventListener("input", () => onFilter({ ...filter, query: search.value }));
  bar.append(labeled("Buscar por nome", search));
  bar.append(selectBox("Tipo", filter.kind, [["all", "Todos"], ...(["monster", "spell", "trap", "tower", "biome"] as const).map((kind) => [kind, kindLabel(kind)] as const)], (value) => onFilter({ ...filter, kind: asKindFilter(value) })));
  bar.append(selectBox("Raridade", filter.rarity, [["all", "Todas"], ...RARITY_ORDER.map((rarity) => [rarity, rarityLabel(rarity)] as const)], (value) => onFilter({ ...filter, rarity: asRarityFilter(value) })));
  bar.append(selectBox("Tag", filter.tag, [["all", "Todas"], ...tagsIn(cards).map((tag) => [tag, tagLabel(tag)] as const)], (value) => onFilter({ ...filter, tag: value })));
  bar.append(selectBox("Raça", filter.race, [["all", "Todas"], ...RACES.map((race) => [race, tagLabel(race)] as const)], (value) => onFilter({ ...filter, race: asRaceFilter(value) })));
  bar.append(selectBox("Classe", filter.cardClass, [["all", "Todas"], ...CLASSES.map((cardClass) => [cardClass, tagLabel(cardClass)] as const)], (value) => onFilter({ ...filter, cardClass: asClassFilter(value) })));
  bar.append(selectBox("Nível", String(filter.level), [["all", "Todos"], ...[1, 2, 3, 4, 5, 6, 7, 8].map((level) => [String(level), `Nv ${level}`] as const)], (value) => onFilter({ ...filter, level: asLevelFilter(value) })));
  return bar;
}

export function renderShopPlace(options: {
  readonly cards: CardRegistry;
  readonly texts: ReadonlyMap<string, string>;
  readonly tab: "caixas" | "decks" | "vendedor" | "mercado";
  readonly onTab: (tab: "caixas" | "decks" | "vendedor" | "mercado") => void;
  readonly openBoxId: string | null;
  readonly onOpenBox: (id: string) => void;
  readonly reveal: readonly string[];
  readonly onReveal: (ids: readonly string[]) => void;
}): HTMLElement {
  const page = document.createElement("div");
  page.className = "shop-page";
  const banner = document.createElement("p");
  banner.className = "example-banner";
  banner.textContent = EXAMPLE_NOTICE;
  const tabs = document.createElement("div");
  tabs.className = "segment";
  tabs.setAttribute("role", "tablist");
  for (const tab of [["caixas", "Caixas"], ["decks", "Decks prontos"], ["vendedor", "Vendedor especial"], ["mercado", "Mercado"]] as const) {
    const button = modeButton(tab[1], options.tab === tab[0], () => options.onTab(tab[0]));
    button.setAttribute("role", "tab");
    tabs.append(button);
  }
  page.append(banner, tabs);
  const shop = exampleShowcase();
  switch (options.tab) {
    case "caixas":
      for (const box of shop.boxes) {
        page.append(boxArticle(box, options));
      }
      break;
    case "decks":
      for (const deck of shop.readyDecks) {
        const article = document.createElement("article");
        const title = document.createElement("h2");
        title.textContent = `${deck.name} · ${formatNumber(deck.crystalPrice)} Cristais`;
        const list = document.createElement("ul");
        for (const entry of deck.cards) {
          const item = document.createElement("li");
          item.textContent = `${options.cards.get(entry.cardId)?.name ?? entry.cardId} ×${entry.count}`;
          list.append(item);
        }
        article.append(title, list, action("Comprar (exemplo)", true, () => undefined));
        page.append(article);
      }
      break;
    case "vendedor": {
      const note = document.createElement("p");
      note.textContent = "Só Essência. Estoque da semana, de exemplo.";
      page.append(note);
      for (const offer of shop.vendor) {
        const row = document.createElement("p");
        const name = offer.cardId === null ? "Sem carta Mítica no catálogo" : options.cards.get(offer.cardId)?.name ?? offer.cardId;
        row.textContent = `${name}. ${rarityLabel(offer.rarity)}. ${formatNumber(offer.priceEssence)} Essência. Estoque ${offer.stock}.`;
        page.append(row);
      }
      break;
    }
    case "mercado": {
      const note = document.createElement("p");
      note.textContent = "Taxa de 10%. Piso e teto por raridade, em Cristais.";
      page.append(note);
      for (const listing of shop.listings) {
        const card = options.cards.get(listing.cardId);
        if (card === undefined) {
          continue;
        }
        const split = marketSplit(listing.priceCrystals);
        const row = document.createElement("p");
        row.textContent = `${listing.sellerLabel}: ${card.name}, ${formatNumber(listing.priceCrystals)} Cristais. Taxa ${formatNumber(split.fee)}.`;
        page.append(row);
      }
      break;
    }
    default: {
      const unexpected: never = options.tab;
      page.append(String(unexpected));
    }
  }
  return page;
}

function boxArticle(box: ShopBox, options: Parameters<typeof renderShopPlace>[0]): HTMLElement {
  const article = document.createElement("article");
  const title = document.createElement("h2");
  title.textContent = `${box.name} · ${formatNumber(box.crystalPrice)} Cristais`;
  const open = options.openBoxId === box.id;
  const toggle = action(open ? "Ocultar lista e chances" : "Ver lista e chances", false, () => options.onOpenBox(box.id));
  article.append(title, toggle);
  if (open) {
    const shares = chancesByRarity(box.cardIds, (cardId) => options.cards.get(cardId)?.rarity ?? "comum");
    const chances = document.createElement("ul");
    chances.setAttribute("aria-label", `Chances da ${box.name}`);
    for (const share of shares) {
      const item = document.createElement("li");
      item.textContent = `${rarityLabel(share.rarity)}: ${share.count} de ${share.total} (${formatPercent(share.count, share.total)})`;
      chances.append(item);
    }
    const names = document.createElement("ul");
    for (const cardId of box.cardIds) {
      const item = document.createElement("li");
      item.textContent = options.cards.get(cardId)?.name ?? cardId;
      names.append(item);
    }
    article.append(chances, names);
  }
  article.append(action("Abrir caixa (exemplo)", false, () => {
    options.onReveal(box.cardIds.slice(0, box.draws));
  }));
  if (options.reveal.length > 0 && open) {
    const reveal = document.createElement("div");
    reveal.className = "box-reveal";
    for (const cardId of options.reveal) {
      const card = options.cards.get(cardId);
      if (card === undefined) {
        continue;
      }
      reveal.append(renderCardFace(card, bandFromCard(card), faceCopy(card, options.texts), `reveal:${card.id}`));
    }
    article.append(reveal);
  }
  return article;
}

export function renderProfile(record: PlayerRecord): HTMLElement {
  const page = document.createElement("div");
  const title = document.createElement("h2");
  title.textContent = "Extrato";
  const note = document.createElement("p");
  note.className = "example-banner";
  note.textContent = "Histórico de exemplo. Nenhuma compra foi feita de verdade.";
  page.append(title, note, ledgerList(record.ledger));
  return page;
}

export function renderStarterPick(onPick: (starterId: string) => void): HTMLElement {
  const page = document.createElement("div");
  const title = document.createElement("h1");
  title.textContent = "Escolha seu deck";
  const intro = document.createElement("p");
  intro.textContent = "O primeiro deck é grátis. Escolha um dos dois iniciais.";
  page.append(title, intro);
  for (const starter of exampleShowcase().readyDecks) {
    page.append(action(starter.name, false, () => onPick(starter.deckId)));
  }
  return page;
}

function ledgerList(lines: readonly Movimento[]): HTMLElement {
  const list = document.createElement("ul");
  list.setAttribute("aria-label", "Histórico");
  for (const line of lines) {
    const item = document.createElement("li");
    const crystals = line.crystals === 0 ? "" : ` ${line.crystals > 0 ? "+" : ""}${formatNumber(line.crystals)} Cristais`;
    const essence = line.essence === 0 ? "" : ` ${line.essence > 0 ? "+" : ""}${formatNumber(line.essence)} Essência`;
    item.textContent = `${kindName(line.kind)}: ${line.text}.${crystals}${essence}`;
    list.append(item);
  }
  return list;
}

function kindName(kind: Movimento["kind"]): string {
  switch (kind) {
    case "compra":
      return "Compra";
    case "abertura":
      return "Abertura";
    case "venda":
      return "Venda";
    default: {
      const unexpected: never = kind;
      return String(unexpected);
    }
  }
}

function selectBox(
  label: string,
  value: string,
  choices: readonly (readonly [string, string])[],
  onChange: (value: string) => void,
): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const select = document.createElement("select");
  select.setAttribute("aria-label", label);
  for (const [choiceValue, choiceLabel] of choices) {
    const option = document.createElement("option");
    option.value = choiceValue;
    option.textContent = choiceLabel;
    option.selected = choiceValue === value;
    select.append(option);
  }
  select.addEventListener("change", () => onChange(select.value));
  wrapper.append(select);
  return wrapper;
}

function labeled(text: string, control: HTMLElement): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.textContent = text;
  wrapper.append(control);
  return wrapper;
}

function modeButton(label: string, pressed: boolean, onClick: () => void): HTMLButtonElement {
  const button = action(label, false, onClick);
  button.setAttribute("aria-pressed", pressed ? "true" : "false");
  return button;
}

function action(label: string, disabled: boolean, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.disabled = disabled;
  button.addEventListener("click", onClick);
  return button;
}

function reason(text: string): HTMLParagraphElement {
  const line = document.createElement("p");
  line.className = "soon";
  line.textContent = text;
  return line;
}
