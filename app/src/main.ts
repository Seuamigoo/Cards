import catalogFile from "../../catalog/cards.json";
import { CardRegistry } from "../../src/catalog/index";
import type { CardRegistryResult } from "../../src/catalog/index";
import type { Card } from "../../src/domain/index";
import "./style.css";

type Screen = "menu" | "collection";

const loaded = CardRegistry.fromJSON(JSON.stringify(catalogFile));

const root = document.querySelector("#app");
if (root === null) {
  throw new Error("Elemento #app ausente.");
}
const app = root;

let screen: Screen = "menu";
draw();

function draw(): void {
  app.replaceChildren();
  switch (screen) {
    case "menu":
      app.append(renderMenu());
      return;
    case "collection":
      app.append(renderCollection(loaded));
      return;
    default: {
      const unexpected: never = screen;
      throw new Error(`Tela inválida: ${String(unexpected)}.`);
    }
  }
}

function renderMenu(): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Convergência";
  const intro = document.createElement("p");
  intro.textContent = "Escolha um modo.";
  const nav = document.createElement("nav");
  nav.append(
    disabledButton("Jogar contra bot"),
    disabledButton("Online"),
    actionButton("Coleção", () => {
      screen = "collection";
      draw();
    }),
  );
  main.append(title, intro, nav);
  return main;
}

function renderCollection(result: CardRegistryResult): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Coleção";
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.append(
    actionButton("Voltar", () => {
      screen = "menu";
      draw();
    }),
  );
  main.append(title, toolbar);
  if (!result.ok) {
    const message = document.createElement("p");
    message.textContent = result.errors.map((error) => error.message).join(" ");
    main.append(message);
    return main;
  }
  const list = document.createElement("ul");
  for (const card of result.registry.all()) {
    list.append(renderCard(card));
  }
  main.append(list);
  return main;
}

function renderCard(card: Card): HTMLLIElement {
  const item = document.createElement("li");
  if (card.image !== undefined) {
    const image = document.createElement("img");
    image.src = card.image.src;
    image.alt = card.image.alt ?? card.name;
    item.append(image);
  }
  const details = document.createElement("div");
  const name = document.createElement("strong");
  name.textContent = card.name;
  const rarity = document.createElement("span");
  rarity.textContent = card.rarity;
  const stats = document.createElement("span");
  stats.textContent = statLine(card);
  details.append(name, rarity, stats);
  item.append(details);
  return item;
}

function statLine(card: Card): string {
  switch (card.kind) {
    case "monster":
      return `ATK ${card.atk} / DEF ${card.def}`;
    case "spell":
    case "trap":
    case "tower":
    case "biome":
      return "ATK — / DEF —";
    default: {
      const unexpected: never = card;
      return String(unexpected);
    }
  }
}

function disabledButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.disabled = true;
  button.textContent = `${label} (em breve)`;
  return button;
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
