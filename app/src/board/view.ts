import "./board.css";
import { opponentOf } from "../../../src/domain/index";
import type { BoardState, Card, PlayerIndex, PlayerState, SpellTrapCard } from "../../../src/domain/index";
import { bandFromCard, fieldMonsterBand, fieldTowerBand, monsterBand, towerBand } from "./bands";
import type { NameBand } from "./bands";
import { cardInstanceKey } from "./cardKey";
import { faceCopy } from "./catalogText";
import { duelOffers } from "./duel";
import type { DuelInput, DuelOffers, DuelViewState, SlotCue, SlotRole, ZoneCue } from "./duel";
import { renderCardFace } from "./face";
import { fxClass } from "./fx";
import type { BoardFx } from "./fx";

export function renderDuel(options: {
  readonly state: BoardState;
  readonly viewer: PlayerIndex;
  readonly view: DuelViewState;
  readonly texts: ReadonlyMap<string, string>;
  readonly error: string | null;
  readonly fx?: readonly BoardFx[];
  readonly onMode?: (mode: string) => void;
  readonly modeId?: string;
  readonly onBack?: () => void;
  readonly onInput: (input: DuelInput) => void;
}): HTMLElement {
  const { state, viewer, view, texts, error, onInput } = options;
  const fx = options.fx ?? [];
  const offers = duelOffers(state, viewer, view.selection);
  const root = document.createElement("section");
  root.className = "duel";
  root.dataset.mode = state.config.mode;
  root.style.setProperty("--monster-slots", String(state.config.monsterSlots));
  root.style.setProperty("--spell-slots", String(state.config.spellTrapSlots));

  const heading = document.createElement("h1");
  heading.className = "sr-only";
  heading.textContent = "Duelo";
  const status = document.createElement("p");
  status.className = "sr-only";
  status.textContent = offers.status;
  const summary = document.createElement("p");
  summary.className = "sr-only";
  summary.textContent = `Campo com ${state.config.monsterSlots} slots de monstro e ${state.config.spellTrapSlots} slots de magia ou armadilha.`;
  const stage = document.createElement("div");
  stage.className = "table-stage";
  const plane = document.createElement("div");
  plane.className = planeClass(state);
  plane.append(
    renderSide({
      state,
      player: state.players[opponentOf(viewer)],
      playerIndex: opponentOf(viewer),
      viewer,
      offers,
      texts,
      view,
      fx,
      onInput,
      opponent: true,
    }),
    renderSide({
      state,
      player: state.players[viewer],
      playerIndex: viewer,
      viewer,
      offers,
      texts,
      view,
      fx,
      onInput,
      opponent: false,
    }),
  );
  stage.append(plane);
  const handDock = document.createElement("div");
  handDock.className = "hand-dock";
  const hint = document.createElement("p");
  hint.className = "duel-hint";
  hint.setAttribute("aria-live", "polite");
  hint.textContent = offers.hint;
  handDock.append(hint);
  if (error !== null && error.length > 0) {
    const alert = document.createElement("p");
    alert.className = "duel-error";
    alert.setAttribute("role", "alert");
    alert.textContent = error;
    handDock.append(alert);
  }
  handDock.append(renderPositionChoice(offers, onInput), renderYourHand(state.players[viewer], viewer, view, texts, onInput));
  root.append(renderHud(state, viewer, offers, options.onMode, options.modeId, options.onBack, onInput), heading, status, summary, stage, handDock);
  const dialog = renderDialog(state, viewer, view, texts, onInput);
  if (dialog !== null) {
    root.append(dialog);
  }
  return root;
}

function renderSide(options: {
  readonly state: BoardState;
  readonly player: PlayerState;
  readonly playerIndex: PlayerIndex;
  readonly viewer: PlayerIndex;
  readonly offers: DuelOffers;
  readonly texts: ReadonlyMap<string, string>;
  readonly view: DuelViewState;
  readonly fx: readonly BoardFx[];
  readonly onInput: (input: DuelInput) => void;
  readonly opponent: boolean;
}): HTMLElement {
  const section = document.createElement("section");
  section.className = options.opponent ? "side side-opponent" : "side side-you";
  section.setAttribute("aria-label", options.opponent ? "Campo do oponente" : "Seu campo");
  const name = document.createElement("h2");
  name.textContent = options.opponent ? "Oponente" : "Você";
  const resources = renderResources(options.player, options.playerIndex, options.fx, options.onInput);
  const board = renderField(options, !options.opponent);
  if (options.opponent) {
    section.append(name, renderHiddenHand(options.player.hand.length), resources, board);
  } else {
    section.append(board, resources, name);
  }
  return section;
}

function planeClass(state: BoardState): string {
  const ids = new Set<string>();
  for (const player of state.players) {
    if (player.biomeZone !== null) {
      ids.add(player.biomeZone.id);
    }
  }
  const classes = ["table-plane"];
  if (ids.has("planicie-dourada")) {
    classes.push("biome-planicie");
  }
  if (ids.has("pantano-das-lapides")) {
    classes.push("biome-pantano");
  }
  if (ids.size > 0 && !ids.has("planicie-dourada") && !ids.has("pantano-das-lapides")) {
    classes.push("biome-generic");
  }
  return classes.join(" ");
}

function renderHud(
  state: BoardState,
  viewer: PlayerIndex,
  offers: DuelOffers,
  onMode: ((mode: string) => void) | undefined,
  modeId: string | undefined,
  onBack: (() => void) | undefined,
  onInput: (input: DuelInput) => void,
): HTMLElement {
  const hud = document.createElement("header");
  hud.className = "hud";
  const foe = state.players[opponentOf(viewer)];
  const you = state.players[viewer];
  const left = hpReadout(foe.hp, state.config.playerHp, "Oponente", offers.attackPlayer?.label ?? null, () => onInput({ type: "opponent-player" }));
  const center = document.createElement("div");
  center.className = "hud-center";
  const phase = document.createElement("p");
  phase.className = "phase-center";
  phase.textContent = offers.status;
  center.append(phase, renderHudActions(offers, onInput));
  if (onMode !== undefined) {
    center.append(renderModeSelect(onMode, modeId));
  }
  if (onBack !== undefined) {
    const back = document.createElement("button");
    back.type = "button";
    back.className = "hud-back";
    back.textContent = "Voltar";
    back.addEventListener("click", onBack);
    center.append(back);
  }
  const right = document.createElement("p");
  right.className = "hp hp-you";
  right.textContent = `Você ${you.hp}/${state.config.playerHp}`;
  hud.append(left, center, right);
  return hud;
}

function hpReadout(
  current: number,
  max: number,
  who: string,
  attackLabel: string | null,
  onAttack: () => void,
): HTMLElement {
  const text = `${who} ${current}/${max}`;
  if (attackLabel === null) {
    const hp = document.createElement("p");
    hp.className = "hp";
    hp.textContent = text;
    return hp;
  }
  const button = document.createElement("button");
  button.type = "button";
  button.className = "hp hp-target";
  button.textContent = text;
  button.setAttribute("aria-label", `${attackLabel}. HP ${current} de ${max}`);
  button.addEventListener("click", onAttack);
  return button;
}

function renderHudActions(offers: DuelOffers, onInput: (input: DuelInput) => void): HTMLElement {
  const bar = document.createElement("div");
  bar.className = "hud-actions";
  for (const pending of offers.pending) {
    if (pending.action.type === "summonMonster" || pending.action.type === "fuseBrasa") {
      continue;
    }
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = pending.label;
    button.setAttribute("aria-label", pending.label);
    button.addEventListener("click", () => onInput({ type: "pending", id: pending.id }));
    bar.append(button);
  }
  return bar;
}

function renderModeSelect(onMode: (mode: string) => void, modeId: string | undefined): HTMLSelectElement {
  const select = document.createElement("select");
  select.setAttribute("aria-label", "Modo do duelo");
  const modes: readonly (readonly [string, string])[] = [
    ["classic-easy", "Clássico fácil"],
    ["classic-normal", "Clássico normal"],
    ["blitz-easy", "Blitz fácil"],
    ["blitz-normal", "Blitz normal"],
    ["brasa", "Mesa com Dragão Brasa"],
  ];
  for (const [value, label] of modes) {
    const option = document.createElement("option");
    option.value = value;
    option.textContent = label;
    select.append(option);
  }
  if (modeId !== undefined) {
    select.value = modeId;
  }
  select.addEventListener("change", () => onMode(select.value));
  return select;
}

function renderPositionChoice(offers: DuelOffers, onInput: (input: DuelInput) => void): HTMLElement {
  const box = document.createElement("div");
  box.className = "position-choice";
  const choices = offers.pending.filter((item) => item.action.type === "summonMonster" || item.action.type === "fuseBrasa");
  if (choices.length === 0) {
    return box;
  }
  box.setAttribute("role", "group");
  box.setAttribute("aria-label", "Escolha ataque ou defesa");
  for (const choice of choices) {
    const button = document.createElement("button");
    button.type = "button";
    button.textContent = choice.label;
    button.setAttribute("aria-label", choice.label);
    button.addEventListener("click", () => onInput({ type: "pending", id: choice.id }));
    box.append(button);
  }
  return box;
}

function renderField(options: {
  readonly player: PlayerState;
  readonly playerIndex: PlayerIndex;
  readonly offers: DuelOffers;
  readonly texts: ReadonlyMap<string, string>;
  readonly onInput: (input: DuelInput) => void;
  readonly opponent: boolean;
  readonly fx: readonly BoardFx[];
}, spellFirst: boolean): HTMLElement {
  const scroll = document.createElement("div");
  scroll.className = "board-scroll";
  const monsters = document.createElement("div");
  monsters.className = "field-line";
  const monsterRow = document.createElement("div");
  monsterRow.className = "monster-row";
  monsterRow.setAttribute("aria-label", "Slots de monstro");
  const monsterCues = options.opponent ? options.offers.opponentMonsterSlots : options.offers.monsterSlots;
  const orderedMonsters = options.opponent ? [...monsterCues].reverse() : monsterCues;
  orderedMonsters.forEach((cue) => {
    monsterRow.append(renderMonsterSlot(options.player, options.playerIndex, cue, options.texts, options.fx, options.onInput, options.opponent));
  });
  const towerCue = options.opponent ? options.offers.opponentTower : options.offers.tower;
  const biomeCue = options.opponent ? options.offers.opponentBiome : options.offers.biome;
  const towerZone = renderZone(
    towerCue,
    towerFace(options.player, options.playerIndex, options.texts),
    "Torre",
    zoneClick(towerCue, options.opponent, "tower", options.onInput),
    !options.opponent && towerCue.role === "play" ? (handIndex) => options.onInput({ type: "drop-tower", handIndex }) : null,
  );
  const biomeZone = renderZone(
    biomeCue,
    biomeFace(options.player, options.playerIndex, options.texts),
    "Bioma",
    zoneClick(biomeCue, options.opponent, "biome", options.onInput),
    !options.opponent && biomeCue.role === "play" ? (handIndex) => options.onInput({ type: "drop-biome", handIndex }) : null,
  );
  if (options.opponent) {
    monsters.append(biomeZone, monsterRow, towerZone);
  } else {
    monsters.append(towerZone, monsterRow, biomeZone);
  }

  const spells = document.createElement("div");
  spells.className = "spell-line";
  const spellRow = document.createElement("div");
  spellRow.className = "spell-row";
  spellRow.setAttribute("aria-label", "Linha de magia e armadilha");
  const spellCues = options.opponent
    ? options.player.spellTrapZone.map((card, zoneIndex) => spellIdleCue(card, zoneIndex))
    : [...options.offers.spellSlots];
  const orderedSpells = options.opponent ? [...spellCues].reverse() : spellCues;
  orderedSpells.forEach((cue) => {
    spellRow.append(renderSpellSlot(options.player, options.playerIndex, cue, options.texts, options.onInput, options.opponent));
  });
  const lead = document.createElement("div");
  lead.className = "spell-spacer";
  const tail = document.createElement("div");
  tail.className = "spell-spacer";
  spells.append(lead, spellRow, tail);
  if (spellFirst) {
    scroll.append(spells, monsters);
  } else {
    scroll.append(monsters, spells);
  }
  return scroll;
}

function spellIdleCue(card: SpellTrapCard | null, zoneIndex: number): SlotCue {
  const slotNumber = zoneIndex + 1;
  if (card === null) {
    return { zoneIndex, role: "idle", label: `Slot de magia e armadilha ${slotNumber} vazio`, pressed: false };
  }
  const kind = card.kind;
  switch (kind) {
    case "spell":
      return { zoneIndex, role: "idle", label: `Slot ${slotNumber}, Magia ${card.name}`, pressed: false };
    case "trap":
      return { zoneIndex, role: "idle", label: `Slot ${slotNumber}, Armadilha ${card.name}`, pressed: false };
    default: {
      const unexpected: never = kind;
      return { zoneIndex, role: "idle", label: String(unexpected), pressed: false };
    }
  }
}

function emptyFace(slotNumber: number): HTMLElement {
  const face = document.createElement("div");
  face.className = "empty-face";
  face.setAttribute("aria-hidden", "true");
  const index = document.createElement("span");
  index.className = "slot-index";
  index.textContent = String(slotNumber);
  face.append(index);
  return face;
}

function zoneClick(
  cue: ZoneCue,
  opponent: boolean,
  zone: "tower" | "biome",
  onInput: (input: DuelInput) => void,
): (() => void) | null {
  if (cue.role === "idle") {
    return null;
  }
  if (opponent) {
    return zone === "tower" ? () => onInput({ type: "opponent-tower" }) : null;
  }
  if (zone === "tower") {
    return () => onInput({ type: "tower" });
  }
  return () => onInput({ type: "biome" });
}

function renderMonsterSlot(
  player: PlayerState,
  playerIndex: PlayerIndex,
  cue: SlotCue,
  texts: ReadonlyMap<string, string>,
  fx: readonly BoardFx[],
  onInput: (input: DuelInput) => void,
  opponent: boolean,
): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "monster-slot";
  slot.dataset.role = cue.role;
  const monster = player.monsterZone[cue.zoneIndex];
  const occupied = monster !== null && monster !== undefined;
  if (occupied) {
    const mark = fxClass(cardInstanceKey(monster.card, { player: playerIndex, zone: "monster", index: cue.zoneIndex }), fx);
    if (mark.length > 0) {
      slot.classList.add(mark);
    }
  }
  if (!opponent && (cue.role === "summon" || cue.role === "fuse")) {
    bindDrop(slot, (handIndex) => onInput({ type: "drop-monster", handIndex, zoneIndex: cue.zoneIndex }));
  }
  if (!occupied) {
    slot.classList.add("is-empty");
    slot.append(emptyFace(cue.zoneIndex + 1));
  } else {
    slot.append(renderMonsterStack(player, playerIndex, cue.zoneIndex, texts));
    if (monster.position === "defense") {
      const badge = document.createElement("span");
      badge.className = "defense-badge";
      badge.textContent = "Defesa";
      slot.append(badge);
    }
    if ((monster.materials?.length ?? 0) > 0) {
      slot.append(materialSeal(monster.card.name, monster.materials?.length ?? 0, playerIndex, cue.zoneIndex, onInput));
    }
  }
  if (cue.role === "idle") {
    slot.setAttribute("aria-label", cue.label);
    return slot;
  }
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "slot-hit";
  hit.setAttribute("aria-label", cue.label);
  if (cue.pressed) {
    hit.setAttribute("aria-pressed", "true");
  }
  const captionText = slotCaption(cue.role);
  if (!occupied && captionText.length > 0) {
    const caption = document.createElement("span");
    caption.className = "slot-caption";
    caption.textContent = captionText;
    hit.append(caption);
  }
  hit.addEventListener("click", () => {
    onInput(opponent
      ? { type: "opponent-monster", zoneIndex: cue.zoneIndex }
      : { type: "own-monster", zoneIndex: cue.zoneIndex });
  });
  slot.append(hit);
  if (occupied && cue.role !== "select") {
    const caption = document.createElement("span");
    caption.className = "slot-caption overlay";
    caption.textContent = slotCaption(cue.role);
    slot.append(caption);
  }
  return slot;
}

function materialSeal(
  name: string,
  count: number,
  playerIndex: PlayerIndex,
  zoneIndex: number,
  onInput: (input: DuelInput) => void,
): HTMLButtonElement {
  const seal = document.createElement("button");
  seal.type = "button";
  seal.className = "material-seal";
  seal.textContent = String(count);
  seal.setAttribute("aria-label", `Ver ${count} materiais de ${name}`);
  seal.addEventListener("click", (event) => {
    event.stopPropagation();
    onInput({ type: "materials", player: playerIndex, zoneIndex });
  });
  return seal;
}

function renderMonsterStack(
  player: PlayerState,
  playerIndex: PlayerIndex,
  zoneIndex: number,
  texts: ReadonlyMap<string, string>,
): HTMLElement {
  const stack = document.createElement("div");
  const monster = player.monsterZone[zoneIndex];
  if (monster === null || monster === undefined) {
    return stack;
  }
  stack.className = monster.position === "defense" ? "monster-stack is-defense" : "monster-stack";
  const materials = monster.materials ?? [];
  materials.forEach((material, materialIndex) => {
    const back = renderCardFace(
      material,
      bandFromCard(material),
      faceCopy(material, texts),
      cardInstanceKey(material, { player: playerIndex, zone: "material", index: zoneIndex, material: materialIndex }),
    );
    back.classList.add("material-back");
    back.style.setProperty("--peek", String(materialIndex + 1));
    back.setAttribute("aria-hidden", "true");
    stack.append(back);
  });
  const band = fieldMonsterBand(player, zoneIndex) ?? bandFromCard(monster.card);
  stack.append(renderCardFace(
    monster.card,
    band,
    faceCopy(monster.card, texts),
    cardInstanceKey(monster.card, { player: playerIndex, zone: "monster", index: zoneIndex }),
  ));
  return stack;
}

function renderSpellSlot(
  player: PlayerState,
  playerIndex: PlayerIndex,
  cue: SlotCue,
  texts: ReadonlyMap<string, string>,
  onInput: (input: DuelInput) => void,
  opponent: boolean,
): HTMLElement {
  const slot = document.createElement("div");
  slot.className = "spell-slot";
  slot.dataset.role = cue.role;
  const card = player.spellTrapZone[cue.zoneIndex];
  const occupied = card !== null && card !== undefined;
  if (!occupied) {
    slot.classList.add("is-empty");
    slot.append(emptyFace(cue.zoneIndex + 1));
  } else {
    slot.append(renderCardFace(
      card,
      bandFromCard(card),
      faceCopy(card, texts),
      cardInstanceKey(card, { player: playerIndex, zone: "spell", index: cue.zoneIndex }),
    ));
  }
  if (!opponent && cue.role === "set") {
    bindDrop(slot, (handIndex) => onInput({ type: "drop-spell", handIndex, zoneIndex: cue.zoneIndex }));
  }
  if (cue.role === "idle" || opponent) {
    slot.setAttribute("aria-label", cue.label);
    return slot;
  }
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "slot-hit";
  hit.setAttribute("aria-label", cue.label);
  if (!occupied) {
    const caption = document.createElement("span");
    caption.className = "slot-caption";
    caption.textContent = "Posicionar";
    hit.append(caption);
  }
  hit.addEventListener("click", () => onInput({ type: "spell", zoneIndex: cue.zoneIndex }));
  slot.append(hit);
  return slot;
}

function renderZone(
  cue: ZoneCue,
  content: HTMLElement | null,
  emptyLabel: string,
  onClick: (() => void) | null,
  onDrop: ((handIndex: number) => void) | null,
): HTMLElement {
  const zone = document.createElement("div");
  zone.className = "zone-side";
  zone.dataset.role = cue.role;
  if (content === null) {
    zone.classList.add("is-empty");
  } else {
    zone.append(content);
  }
  if (onClick === null) {
    if (content === null) {
      const name = document.createElement("span");
      name.className = "zone-name";
      name.textContent = emptyLabel;
      zone.append(name);
    }
    zone.setAttribute("aria-label", cue.label);
    return zone;
  }
  const hit = document.createElement("button");
  hit.type = "button";
  hit.className = "slot-hit";
  hit.setAttribute("aria-label", cue.label);
  if (content === null) {
    hit.textContent = cue.label;
  }
  hit.addEventListener("click", onClick);
  zone.append(hit);
  if (onDrop !== null) {
    bindDrop(zone, onDrop);
  }
  return zone;
}

function towerFace(player: PlayerState, playerIndex: PlayerIndex, texts: ReadonlyMap<string, string>): HTMLElement | null {
  if (player.towerZone === null) {
    return null;
  }
  const band = fieldTowerBand(player) ?? bandFromCard(player.towerZone.card);
  return renderCardFace(
    player.towerZone.card,
    band,
    faceCopy(player.towerZone.card, texts),
    cardInstanceKey(player.towerZone.card, { player: playerIndex, zone: "tower" }),
  );
}

function biomeFace(player: PlayerState, playerIndex: PlayerIndex, texts: ReadonlyMap<string, string>): HTMLElement | null {
  if (player.biomeZone === null) {
    return null;
  }
  return renderCardFace(
    player.biomeZone,
    bandFromCard(player.biomeZone),
    faceCopy(player.biomeZone, texts),
    cardInstanceKey(player.biomeZone, { player: playerIndex, zone: "biome" }),
  );
}

function renderYourHand(
  player: PlayerState,
  playerIndex: PlayerIndex,
  view: DuelViewState,
  texts: ReadonlyMap<string, string>,
  onInput: (input: DuelInput) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "hand-row";
  row.setAttribute("aria-label", "Sua mão");
  if (player.hand.length === 0) {
    const empty = document.createElement("p");
    empty.className = "empty-hand";
    empty.textContent = "Mão vazia";
    row.append(empty);
    return row;
  }
  player.hand.forEach((card, index) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "hand-card";
    button.setAttribute("aria-pressed", view.selection.handIndex === index ? "true" : "false");
    button.setAttribute("aria-label", handLabel(card, texts));
    button.append(renderCardFace(
      card,
      bandFromCard(card),
      faceCopy(card, texts),
      cardInstanceKey(card, { player: playerIndex, zone: "hand", index }),
    ));
    button.draggable = true;
    button.addEventListener("dragstart", (event) => {
      event.dataTransfer?.setData("text/plain", String(index));
      if (event.dataTransfer !== null) {
        event.dataTransfer.effectAllowed = "move";
      }
    });
    button.addEventListener("click", () => onInput({ type: "hand", index }));
    row.append(button);
  });
  return row;
}

function renderHiddenHand(count: number): HTMLElement {
  const row = document.createElement("div");
  row.className = "hand-row back-row";
  const noun = count === 1 ? "carta" : "cartas";
  row.setAttribute("aria-label", `Mão do oponente, ${count} ${noun}`);
  const shown = Math.min(count, 6);
  for (let index = 0; index < shown; index += 1) {
    const back = document.createElement("span");
    back.className = "card-back";
    back.setAttribute("aria-hidden", "true");
    row.append(back);
  }
  const total = document.createElement("span");
  total.className = "back-count";
  total.textContent = String(count);
  row.append(total);
  return row;
}

function renderResources(
  player: PlayerState,
  playerIndex: PlayerIndex,
  fx: readonly BoardFx[],
  onInput: (input: DuelInput) => void,
): HTMLElement {
  const row = document.createElement("div");
  row.className = "resources";
  const deck = document.createElement("div");
  deck.className = "pile deck-pile";
  deck.setAttribute("aria-label", `Deck, ${player.deck.length} ${noun(player.deck.length)}`);
  deck.append(pileCount(player.deck.length), pileName("Deck"));
  const grave = document.createElement("button");
  grave.type = "button";
  grave.className = `pile grave-pile${pileMarked(fx, playerIndex, "graveyard") ? " fx-pile" : ""}`;
  grave.setAttribute("aria-label", `Cemitério, ${player.graveyard.length} ${noun(player.graveyard.length)}. Ver cartas.`);
  grave.append(pileCount(player.graveyard.length), pileName("Cemitério"));
  grave.addEventListener("click", () => onInput({ type: "graveyard", player: playerIndex }));
  const limbo = document.createElement("button");
  limbo.type = "button";
  limbo.className = `pile limbo-pile${pileMarked(fx, playerIndex, "limbo") ? " fx-pile" : ""}`;
  limbo.setAttribute("aria-label", `Limbo, ${player.limbo.length} ${noun(player.limbo.length)}. Ver cartas.`);
  limbo.append(pileCount(player.limbo.length), pileName("Limbo"));
  limbo.addEventListener("click", () => onInput({ type: "limbo", player: playerIndex }));
  row.append(deck, grave, limbo);
  return row;
}

function pileMarked(fx: readonly BoardFx[], player: PlayerIndex, pile: "limbo" | "graveyard"): boolean {
  return fx.some((item) => item.kind === "pile" && item.player === player && item.pile === pile);
}

function renderDialog(
  state: BoardState,
  viewer: PlayerIndex,
  view: DuelViewState,
  texts: ReadonlyMap<string, string>,
  onInput: (input: DuelInput) => void,
): HTMLDialogElement | null {
  const dialogState = view.dialog;
  if (dialogState.type === "none") {
    return null;
  }
  const dialog = document.createElement("dialog");
  dialog.className = "pile-dialog";
  const title = document.createElement("h2");
  title.id = "duel-dialog-title";
  const grid = document.createElement("div");
  grid.className = "dialog-cards";
  switch (dialogState.type) {
    case "limbo": {
      const owner = dialogState.player;
      title.textContent = owner === viewer ? "Seu Limbo" : "Limbo do oponente";
      const cards = state.players[owner].limbo;
      if (cards.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "O Limbo não tem cartas.";
        grid.append(empty);
      }
      cards.forEach((card, index) => {
        grid.append(renderCardFace(
          card,
          bandFromCard(card),
          faceCopy(card, texts),
          cardInstanceKey(card, { player: owner, zone: "limbo", index }),
        ));
      });
      break;
    }
    case "graveyard": {
      const owner = dialogState.player;
      title.textContent = owner === viewer ? "Seu cemitério" : "Cemitério do oponente";
      const cards = state.players[owner].graveyard;
      if (cards.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "O cemitério não tem cartas.";
        grid.append(empty);
      }
      cards.forEach((card, index) => {
        grid.append(renderCardFace(
          card,
          bandFromCard(card),
          faceCopy(card, texts),
          cardInstanceKey(card, { player: owner, zone: "graveyard", index }),
        ));
      });
      break;
    }
    case "materials": {
      const owner = dialogState.player;
      const slot = state.players[owner].monsterZone[dialogState.zoneIndex];
      title.textContent = slot === null || slot === undefined ? "Materiais" : `Materiais de ${slot.card.name}`;
      const materials = slot?.materials ?? [];
      if (materials.length === 0) {
        const empty = document.createElement("p");
        empty.textContent = "Este monstro não tem materiais.";
        grid.append(empty);
      }
      materials.forEach((card, index) => {
        grid.append(renderCardFace(
          card,
          bandFromCard(card),
          faceCopy(card, texts),
          cardInstanceKey(card, { player: owner, zone: "material", index: dialogState.zoneIndex, material: index }),
        ));
      });
      break;
    }
    default: {
      const unexpected: never = dialogState;
      title.textContent = String(unexpected);
    }
  }
  dialog.setAttribute("aria-labelledby", title.id);
  const close = document.createElement("button");
  close.type = "button";
  close.className = "dialog-close";
  close.textContent = "Fechar";
  close.addEventListener("click", () => onInput({ type: "close-dialog" }));
  dialog.append(title, grid, close);
  dialog.addEventListener("cancel", (event) => {
    event.preventDefault();
    onInput({ type: "close-dialog" });
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) {
      onInput({ type: "close-dialog" });
    }
  });
  queueMicrotask(() => {
    if (dialog.isConnected && !dialog.open) {
      dialog.showModal();
    }
  });
  return dialog;
}

function handLabel(card: Card, texts: ReadonlyMap<string, string>): string {
  const band = bandFromCard(card);
  const stats = statsText(band);
  const copy = faceCopy(card, texts);
  return [card.name, stats, copy.effect, copy.flavor].filter((line): line is string => line !== null && line.length > 0).join(". ");
}

function statsText(band: NameBand): string | null {
  switch (band.kind) {
    case "monster":
      return monsterBand(band.atk, band.def);
    case "tower":
      return towerBand(band.current, band.printed);
    case "plain":
      return null;
    default: {
      const unexpected: never = band;
      return String(unexpected);
    }
  }
}

function slotCaption(role: SlotRole): string {
  switch (role) {
    case "summon":
      return "";
    case "fuse":
      return "Fundir";
    case "tribute":
      return "Tributo";
    case "material":
      return "Material";
    case "set":
      return "Posicionar";
    case "attack":
      return "Atacar";
    case "select":
      return "Escolher";
    case "idle":
      return "";
    default: {
      const unexpected: never = role;
      return String(unexpected);
    }
  }
}

function pileCount(count: number): HTMLElement {
  const span = document.createElement("span");
  span.className = "pile-count";
  span.textContent = String(count);
  return span;
}

function pileName(name: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "pile-name";
  span.textContent = name;
  return span;
}

function noun(count: number): string {
  return count === 1 ? "carta" : "cartas";
}

function bindDrop(target: HTMLElement, onDrop: (handIndex: number) => void): void {
  target.addEventListener("dragover", (event) => {
    event.preventDefault();
    if (event.dataTransfer !== null) {
      event.dataTransfer.dropEffect = "move";
    }
    target.classList.add("is-drop");
  });
  target.addEventListener("dragleave", () => {
    target.classList.remove("is-drop");
  });
  target.addEventListener("drop", (event) => {
    event.preventDefault();
    target.classList.remove("is-drop");
    const raw = event.dataTransfer?.getData("text/plain") ?? "";
    const handIndex = Number(raw);
    if (!Number.isInteger(handIndex) || handIndex < 0) {
      return;
    }
    onDrop(handIndex);
  });
}
