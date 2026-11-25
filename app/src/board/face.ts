import { apiUrl } from "../api";
import type { Card } from "../../../src/domain/index";
import type { NameBand } from "./bands";
import { monsterBand, towerBand } from "./bands";

const PLACEHOLDER_ART = "assets/cards/placeholder.webp";

export function resolveCardArt(src: string | undefined): string {
  if (src === undefined || src.length === 0) {
    return PLACEHOLDER_ART;
  }
  if (src.startsWith("https://") || src.startsWith("assets/")) {
    return src;
  }
  return apiUrl(`/${src.replace(/^\//, "")}`);
}

export function renderCardFace(
  card: Card,
  band: NameBand,
  copy: { readonly effect: string | null; readonly flavor: string | null },
  instanceKey: string,
): HTMLElement {
  const frame = document.createElement("div");
  frame.className = "card-frame";
  frame.dataset.instanceKey = instanceKey;
  frame.dataset.rarity = card.rarity;
  frame.dataset.kind = card.kind;
  const full = [copy.effect, copy.flavor].filter((line): line is string => line !== null && line.length > 0).join(" ");
  if (full.length > 0) {
    frame.title = full;
  }

  const gem = document.createElement("span");
  gem.className = "card-gem";
  gem.dataset.rarity = card.rarity;
  gem.setAttribute("aria-hidden", "true");

  const art = document.createElement("div");
  art.className = "card-art";
  const image = document.createElement("img");
  image.src = resolveCardArt(card.image?.src);
  image.alt = "";
  image.draggable = false;
  art.append(image);

  const name = document.createElement("div");
  name.className = "card-nameband";
  const title = document.createElement("p");
  title.className = "card-title";
  const titleText = document.createElement("span");
  titleText.textContent = card.name;
  title.append(titleText);
  if (band.kind === "monster") {
    const level = document.createElement("span");
    level.className = "card-level";
    level.textContent = `Nv ${band.level}`;
    title.append(level);
  }
  name.append(title);
  switch (band.kind) {
    case "monster": {
      const stats = document.createElement("p");
      stats.className = "card-stats";
      stats.textContent = monsterBand(band.atk, band.def);
      name.append(stats);
      break;
    }
    case "tower": {
      const stats = document.createElement("p");
      stats.className = "card-stats";
      stats.textContent = towerBand(band.current, band.printed);
      name.append(stats);
      break;
    }
    case "plain":
      break;
    default: {
      const unexpected: never = band;
      name.append(String(unexpected));
    }
  }

  const body = document.createElement("div");
  body.className = "card-body";
  if (copy.effect !== null) {
    const effect = document.createElement("p");
    effect.className = "card-effect";
    effect.textContent = copy.effect;
    body.append(effect);
  }
  if (copy.flavor !== null) {
    const flavor = document.createElement("p");
    flavor.className = "card-flavor";
    flavor.textContent = copy.flavor;
    body.append(flavor);
  }

  frame.append(gem, art, name, body);
  return frame;
}
