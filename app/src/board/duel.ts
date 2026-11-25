import { getLegalActions, opponentOf } from "../../../src/domain/index";
import type { Action, AttackTarget, BattlePosition, BoardState, GameMode, Phase, PlayerIndex } from "../../../src/domain/index";

export interface DuelSelection {
  readonly handIndex: number | null;
  readonly tributes: readonly number[];
  readonly materials: readonly number[];
  readonly zoneIndex: number | null;
}

export type DuelDialog =
  | { readonly type: "none" }
  | { readonly type: "limbo"; readonly player: PlayerIndex }
  | { readonly type: "graveyard"; readonly player: PlayerIndex }
  | { readonly type: "materials"; readonly player: PlayerIndex; readonly zoneIndex: number };

export interface DuelViewState {
  readonly selection: DuelSelection;
  readonly dialog: DuelDialog;
}

export interface PendingAction {
  readonly id: string;
  readonly label: string;
  readonly action: Action;
}

export type SlotRole = "idle" | "summon" | "fuse" | "tribute" | "material" | "set" | "attack" | "select";

export interface SlotCue {
  readonly zoneIndex: number;
  readonly role: SlotRole;
  readonly label: string;
  readonly pressed: boolean;
}

export interface ZoneCue {
  readonly role: "idle" | "play" | "attack";
  readonly label: string;
  readonly pressed: boolean;
}

export interface DuelOffers {
  readonly hint: string;
  readonly status: string;
  readonly monsterSlots: readonly SlotCue[];
  readonly opponentMonsterSlots: readonly SlotCue[];
  readonly spellSlots: readonly SlotCue[];
  readonly tower: ZoneCue;
  readonly biome: ZoneCue;
  readonly opponentTower: ZoneCue;
  readonly opponentBiome: ZoneCue;
  readonly attackPlayer: { readonly label: string } | null;
  readonly pending: readonly PendingAction[];
}

export type DuelInput =
  | { readonly type: "hand"; readonly index: number }
  | { readonly type: "own-monster"; readonly zoneIndex: number }
  | { readonly type: "opponent-monster"; readonly zoneIndex: number }
  | { readonly type: "spell"; readonly zoneIndex: number }
  | { readonly type: "tower" }
  | { readonly type: "opponent-tower" }
  | { readonly type: "biome" }
  | { readonly type: "opponent-player" }
  | { readonly type: "pending"; readonly id: string }
  | { readonly type: "drop-monster"; readonly handIndex: number; readonly zoneIndex: number }
  | { readonly type: "drop-spell"; readonly handIndex: number; readonly zoneIndex: number }
  | { readonly type: "drop-tower"; readonly handIndex: number }
  | { readonly type: "drop-biome"; readonly handIndex: number }
  | { readonly type: "limbo"; readonly player: PlayerIndex }
  | { readonly type: "graveyard"; readonly player: PlayerIndex }
  | { readonly type: "materials"; readonly player: PlayerIndex; readonly zoneIndex: number }
  | { readonly type: "close-dialog" };

export function emptySelection(): DuelSelection {
  return { handIndex: null, tributes: [], materials: [], zoneIndex: null };
}

export function initialDuelView(): DuelViewState {
  return { selection: emptySelection(), dialog: { type: "none" } };
}

export function duelOffers(state: BoardState, viewer: PlayerIndex, selection: DuelSelection): DuelOffers {
  const actions = legal(state, viewer);
  const foe = opponentOf(viewer);
  const summons = summonsFor(actions, selection.handIndex);
  const fuses = fusesFor(actions, selection.handIndex);
  const tributeSets = uniqueSets(summons.map((action) => action.tributeZoneIndexes));
  const materialSets = uniqueSets(fuses.map((action) => action.materialZoneIndexes));
  const neededTributes = summons[0]?.tributeZoneIndexes.length ?? 0;
  const materials = chosenMaterials(materialSets, selection.materials);
  const tributesReady = summons.length > 0 && selection.tributes.length === neededTributes && subsetOfAny(selection.tributes, tributeSets.length === 0 ? [[]] : tributeSets);
  const materialsReady = fuses.length > 0 && materialSets.some((set) => sameNumbers(set, materials));
  const attacker = selection.handIndex === null ? selection.zoneIndex : null;

  return {
    hint: hintFor(state, viewer, selection, summons.length, fuses.length, neededTributes, tributesReady, materialsReady),
    status: statusLine(state, viewer),
    monsterSlots: state.players[viewer].monsterZone.map((_, zoneIndex) =>
      ownMonsterCue(state, viewer, selection, actions, zoneIndex, tributesReady, materialsReady, tributeSets, materialSets, materials),
    ),
    opponentMonsterSlots: state.players[foe].monsterZone.map((slot, zoneIndex) =>
      opponentMonsterCue(state, foe, attacker, actions, zoneIndex, slot !== null),
    ),
    spellSlots: state.players[viewer].spellTrapZone.map((_, zoneIndex) => spellCue(state, viewer, selection, actions, zoneIndex)),
    tower: towerCue(state, viewer, selection, actions, false),
    biome: biomeCue(state, viewer, selection, actions, false),
    opponentTower: towerCue(state, foe, selection, actions, true),
    opponentBiome: biomeCue(state, foe, selection, actions, true),
    attackPlayer: attackPlayerCue(attacker, actions),
    pending: pendingActions(state, viewer, selection, actions, tributesReady, materialsReady, materials),
  };
}

export function applyDuelInput(
  state: BoardState,
  viewer: PlayerIndex,
  view: DuelViewState,
  input: DuelInput,
): { readonly view: DuelViewState; readonly action: Action | null } {
  const offers = duelOffers(state, viewer, view.selection);
  const actions = legal(state, viewer);
  switch (input.type) {
    case "close-dialog":
      return { view: { selection: view.selection, dialog: { type: "none" } }, action: null };
    case "limbo":
      return { view: { selection: view.selection, dialog: { type: "limbo", player: input.player } }, action: null };
    case "graveyard":
      return { view: { selection: view.selection, dialog: { type: "graveyard", player: input.player } }, action: null };
    case "drop-monster":
      return onOwnMonster(selectHand(view, input.handIndex), duelOffers(state, viewer, selectHand(view, input.handIndex).selection), input.zoneIndex);
    case "drop-spell":
      return dispatchOrKeep(selectHand(view, input.handIndex), setOnSpell(legal(state, viewer), selectHand(view, input.handIndex).selection, input.zoneIndex));
    case "drop-tower":
      return dispatchOrKeep(selectHand(view, input.handIndex), playTower(legal(state, viewer), selectHand(view, input.handIndex).selection));
    case "drop-biome":
      return dispatchOrKeep(selectHand(view, input.handIndex), playBiome(legal(state, viewer), selectHand(view, input.handIndex).selection));
    case "materials":
      return {
        view: { selection: view.selection, dialog: { type: "materials", player: input.player, zoneIndex: input.zoneIndex } },
        action: null,
      };
    case "hand":
      return { view: { selection: toggleHand(view.selection, input.index), dialog: view.dialog }, action: null };
    case "own-monster":
      return onOwnMonster(view, offers, input.zoneIndex);
    case "opponent-monster":
      return dispatchOrKeep(view, attackOnMonster(actions, view.selection, input.zoneIndex));
    case "spell":
      return dispatchOrKeep(view, setOnSpell(actions, view.selection, input.zoneIndex));
    case "tower":
      return dispatchOrKeep(view, playTower(actions, view.selection));
    case "biome":
      return dispatchOrKeep(view, playBiome(actions, view.selection));
    case "opponent-tower":
      return dispatchOrKeep(view, attackTarget(actions, view.selection, { kind: "tower" }));
    case "opponent-player":
      return dispatchOrKeep(view, attackTarget(actions, view.selection, { kind: "player" }));
    case "pending": {
      const pending = offers.pending.find((item) => item.id === input.id);
      return dispatchOrKeep(view, pending?.action ?? null);
    }
    default: {
      const unexpected: never = input;
      return unexpected;
    }
  }
}

export function phaseLabel(phase: Phase): string {
  switch (phase) {
    case "draw":
      return "Compra";
    case "main1":
      return "Main 1";
    case "battle":
      return "Batalha";
    case "main2":
      return "Main 2";
    case "end":
      return "Fim";
    default: {
      const unexpected: never = phase;
      return String(unexpected);
    }
  }
}

export function modeLabel(mode: GameMode): string {
  switch (mode) {
    case "classic":
      return "Clássico";
    case "blitz":
      return "Blitz";
    default: {
      const unexpected: never = mode;
      return String(unexpected);
    }
  }
}

export function statusLine(state: BoardState, viewer: PlayerIndex): string {
  const turn = state.winner === null
    ? state.activePlayerIndex === viewer ? "Sua vez" : "Vez do oponente"
    : state.winner === viewer ? "Você venceu" : "Oponente venceu";
  return `${modeLabel(state.config.mode)} · Turno ${state.turn} · ${phaseLabel(state.phase)} · ${turn}`;
}

export function actionKey(action: Action): string {
  switch (action.type) {
    case "advancePhase":
      return "advance";
    case "summonMonster":
      return `summon:${action.handIndex}:${action.zoneIndex}:${action.position}:${listKey(action.tributeZoneIndexes)}:${action.effectTargetZoneIndex ?? "-"}`;
    case "fuseBrasa":
      return `fuse:${action.handIndex}:${action.zoneIndex}:${action.position}:${listKey(action.materialZoneIndexes)}`;
    case "changePosition":
      return `position:${action.zoneIndex}`;
    case "setSpellTrap":
      return `set:${action.handIndex}:${action.zoneIndex}`;
    case "summonTower":
      return `tower:${action.handIndex}`;
    case "playBiome":
      return `biome:${action.handIndex}`;
    case "activate":
      return `activate:${action.zoneIndex}`;
    case "attack":
      return `attack:${action.attackerZoneIndex}:${targetKey(action.target)}`;
    case "converge":
      return `converge:${action.lineageIndex}:${action.zoneIndex}:${action.position}:${listKey(action.materialZoneIndexes)}:${action.materialHandIndex ?? "-"}`;
    default: {
      const unexpected: never = action;
      return String(unexpected);
    }
  }
}

function legal(state: BoardState, viewer: PlayerIndex): readonly Action[] {
  if (state.winner !== null || state.activePlayerIndex !== viewer) {
    return [];
  }
  return getLegalActions(state, viewer);
}

function onOwnMonster(
  view: DuelViewState,
  offers: DuelOffers,
  zoneIndex: number,
): { readonly view: DuelViewState; readonly action: Action | null } {
  const cue = offers.monsterSlots[zoneIndex];
  if (cue === undefined) {
    return { view, action: null };
  }
  switch (cue.role) {
    case "summon":
    case "fuse":
      return {
        view: { selection: { ...view.selection, zoneIndex }, dialog: view.dialog },
        action: null,
      };
    case "tribute":
      return {
        view: { selection: toggleNumber(view.selection, "tributes", zoneIndex), dialog: view.dialog },
        action: null,
      };
    case "material":
      return {
        view: { selection: toggleNumber(view.selection, "materials", zoneIndex), dialog: view.dialog },
        action: null,
      };
    case "select":
      return {
        view: {
          selection: { handIndex: null, tributes: [], materials: [], zoneIndex },
          dialog: view.dialog,
        },
        action: null,
      };
    case "attack":
    case "set":
    case "idle":
      return { view, action: null };
    default: {
      const unexpected: never = cue.role;
      return unexpected;
    }
  }
}

function selectHand(view: DuelViewState, handIndex: number): DuelViewState {
  if (view.selection.handIndex === handIndex) {
    return view;
  }
  return {
    selection: { handIndex, tributes: [], materials: [], zoneIndex: null },
    dialog: view.dialog,
  };
}

function toggleHand(selection: DuelSelection, index: number): DuelSelection {
  if (selection.handIndex === index) {
    return emptySelection();
  }
  return { handIndex: index, tributes: [], materials: [], zoneIndex: null };
}

function toggleNumber(selection: DuelSelection, key: "tributes" | "materials", zoneIndex: number): DuelSelection {
  const current = key === "tributes" ? selection.tributes : selection.materials;
  const next = current.includes(zoneIndex) ? current.filter((index) => index !== zoneIndex) : [...current, zoneIndex];
  if (key === "tributes") {
    return { ...selection, tributes: next, zoneIndex: null };
  }
  return { ...selection, materials: next, zoneIndex: null };
}

function dispatchOrKeep(
  view: DuelViewState,
  action: Action | null,
): { readonly view: DuelViewState; readonly action: Action | null } {
  if (action === null) {
    return { view, action: null };
  }
  return { view: initialDuelView(), action };
}

function attackOnMonster(actions: readonly Action[], selection: DuelSelection, zoneIndex: number): Action | null {
  if (selection.handIndex !== null || selection.zoneIndex === null) {
    return null;
  }
  return actions.find((action) =>
    action.type === "attack"
    && action.attackerZoneIndex === selection.zoneIndex
    && action.target.kind === "monster"
    && action.target.zoneIndex === zoneIndex,
  ) ?? null;
}

function attackTarget(actions: readonly Action[], selection: DuelSelection, target: AttackTarget): Action | null {
  if (selection.handIndex !== null || selection.zoneIndex === null) {
    return null;
  }
  return actions.find((action) =>
    action.type === "attack"
    && action.attackerZoneIndex === selection.zoneIndex
    && sameTarget(action.target, target),
  ) ?? null;
}

function setOnSpell(actions: readonly Action[], selection: DuelSelection, zoneIndex: number): Action | null {
  if (selection.handIndex === null) {
    return null;
  }
  return actions.find((action) =>
    action.type === "setSpellTrap" && action.handIndex === selection.handIndex && action.zoneIndex === zoneIndex,
  ) ?? null;
}

function playTower(actions: readonly Action[], selection: DuelSelection): Action | null {
  if (selection.handIndex === null) {
    return null;
  }
  return actions.find((action) => action.type === "summonTower" && action.handIndex === selection.handIndex) ?? null;
}

function playBiome(actions: readonly Action[], selection: DuelSelection): Action | null {
  if (selection.handIndex === null) {
    return null;
  }
  return actions.find((action) => action.type === "playBiome" && action.handIndex === selection.handIndex) ?? null;
}

function ownMonsterCue(
  state: BoardState,
  viewer: PlayerIndex,
  selection: DuelSelection,
  actions: readonly Action[],
  zoneIndex: number,
  tributesReady: boolean,
  materialsReady: boolean,
  tributeSets: readonly (readonly number[])[],
  materialSets: readonly (readonly number[])[],
  materials: readonly number[],
): SlotCue {
  const slotNumber = zoneIndex + 1;
  const pressedZone = selection.zoneIndex === zoneIndex;
  if (selection.handIndex !== null) {
    const summonHere = tributesReady && summonsFor(actions, selection.handIndex).some((action) =>
      action.zoneIndex === zoneIndex && sameNumbers(action.tributeZoneIndexes, selection.tributes),
    );
    if (summonHere) {
      return { zoneIndex, role: "summon", label: `Invocar no slot ${slotNumber}`, pressed: pressedZone };
    }
    const fuseHere = materialsReady && fusesFor(actions, selection.handIndex).some((action) =>
      action.zoneIndex === zoneIndex && sameNumbers(action.materialZoneIndexes, materials),
    );
    if (fuseHere) {
      return { zoneIndex, role: "fuse", label: `Fundir no slot ${slotNumber}`, pressed: pressedZone };
    }
    if (canToggleTribute(tributeSets, selection.tributes, zoneIndex)) {
      const name = state.players[viewer].monsterZone[zoneIndex]?.card.name ?? "monstro";
      return {
        zoneIndex,
        role: "tribute",
        label: `Tributo no slot ${slotNumber}, ${name}`,
        pressed: selection.tributes.includes(zoneIndex),
      };
    }
    if (materialSets.length > 1 && canToggleTribute(materialSets, selection.materials, zoneIndex)) {
      const name = state.players[viewer].monsterZone[zoneIndex]?.card.name ?? "material";
      return {
        zoneIndex,
        role: "material",
        label: `Material no slot ${slotNumber}, ${name}`,
        pressed: selection.materials.includes(zoneIndex),
      };
    }
  } else if (canSelectMonster(actions, zoneIndex)) {
    return {
      zoneIndex,
      role: "select",
      label: describeOwnMonster(state, viewer, zoneIndex),
      pressed: pressedZone,
    };
  }
  return { zoneIndex, role: "idle", label: describeOwnMonster(state, viewer, zoneIndex), pressed: false };
}

function opponentMonsterCue(
  state: BoardState,
  foe: PlayerIndex,
  attacker: number | null,
  actions: readonly Action[],
  zoneIndex: number,
  occupied: boolean,
): SlotCue {
  const attack = attacker === null
    ? undefined
    : actions.find((action) =>
      action.type === "attack"
      && action.attackerZoneIndex === attacker
      && action.target.kind === "monster"
      && action.target.zoneIndex === zoneIndex,
    );
  if (attack !== undefined && attack.type === "attack") {
    return { zoneIndex, role: "attack", label: attackLabel(state, foe, attack), pressed: false };
  }
  const slot = state.players[foe].monsterZone[zoneIndex];
  if (!occupied || slot === null || slot === undefined) {
    return { zoneIndex, role: "idle", label: `Slot de monstro ${zoneIndex + 1} vazio`, pressed: false };
  }
  const position = slot.position === "attack" ? "ataque" : "defesa";
  return {
    zoneIndex,
    role: "idle",
    label: `Slot ${zoneIndex + 1} do oponente, ${slot.card.name}, em ${position}`,
    pressed: false,
  };
}

function spellCue(
  state: BoardState,
  viewer: PlayerIndex,
  selection: DuelSelection,
  actions: readonly Action[],
  zoneIndex: number,
): SlotCue {
  const slotNumber = zoneIndex + 1;
  const canSet = selection.handIndex !== null && actions.some((action) =>
    action.type === "setSpellTrap" && action.handIndex === selection.handIndex && action.zoneIndex === zoneIndex,
  );
  if (canSet) {
    return { zoneIndex, role: "set", label: `Posicionar no slot ${slotNumber}`, pressed: false };
  }
  const card = state.players[viewer].spellTrapZone[zoneIndex];
  if (card === null || card === undefined) {
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

function towerCue(
  state: BoardState,
  player: PlayerIndex,
  selection: DuelSelection,
  actions: readonly Action[],
  opponent: boolean,
): ZoneCue {
  if (opponent) {
    const attack = attackTarget(actions, selection, { kind: "tower" });
    if (attack !== null) {
      return { role: "attack", label: "Atacar a Torre", pressed: false };
    }
  } else if (playTower(actions, selection) !== null) {
    const occupied = state.players[player].towerZone !== null;
    return { role: "play", label: occupied ? "Substituir a Torre" : "Invocar Torre", pressed: false };
  }
  const tower = state.players[player].towerZone;
  if (tower === null) {
    return { role: "idle", label: opponent ? "Zona da Torre do oponente vazia" : "Zona da Torre vazia", pressed: false };
  }
  return { role: "idle", label: `Torre ${tower.card.name}`, pressed: false };
}

function biomeCue(
  state: BoardState,
  player: PlayerIndex,
  selection: DuelSelection,
  actions: readonly Action[],
  opponent: boolean,
): ZoneCue {
  if (!opponent && playBiome(actions, selection) !== null) {
    const occupied = state.players[player].biomeZone !== null;
    return { role: "play", label: occupied ? "Substituir o Bioma" : "Jogar Bioma", pressed: false };
  }
  const biome = state.players[player].biomeZone;
  if (biome === null) {
    return { role: "idle", label: opponent ? "Zona do Bioma do oponente vazia" : "Zona do Bioma vazia", pressed: false };
  }
  return { role: "idle", label: `Bioma ${biome.name}`, pressed: false };
}

function attackPlayerCue(attacker: number | null, actions: readonly Action[]): { readonly label: string } | null {
  if (attacker === null) {
    return null;
  }
  const attack = actions.find((action) =>
    action.type === "attack" && action.attackerZoneIndex === attacker && action.target.kind === "player",
  );
  if (attack === undefined || attack.type !== "attack") {
    return null;
  }
  return { label: "Atacar o jogador" };
}

function pendingActions(
  state: BoardState,
  viewer: PlayerIndex,
  selection: DuelSelection,
  actions: readonly Action[],
  tributesReady: boolean,
  materialsReady: boolean,
  materials: readonly number[],
): PendingAction[] {
  const pending: PendingAction[] = [];
  for (const action of actions) {
    if (action.type !== "summonMonster" || !tributesReady || selection.handIndex === null || selection.zoneIndex === null) {
      continue;
    }
    if (action.handIndex !== selection.handIndex || action.zoneIndex !== selection.zoneIndex) {
      continue;
    }
    if (!sameNumbers(action.tributeZoneIndexes, selection.tributes)) {
      continue;
    }
    pending.push({ id: actionKey(action), label: summonLabel(state, viewer, action), action });
  }
  for (const action of actions) {
    if (action.type !== "fuseBrasa" || !materialsReady || selection.handIndex === null || selection.zoneIndex === null) {
      continue;
    }
    if (action.handIndex !== selection.handIndex || action.zoneIndex !== selection.zoneIndex) {
      continue;
    }
    if (!sameNumbers(action.materialZoneIndexes, materials)) {
      continue;
    }
    pending.push({ id: actionKey(action), label: fuseLabel(action), action });
  }
  if (selection.handIndex === null && selection.zoneIndex !== null) {
    for (const action of actions) {
      if (action.type === "changePosition" && action.zoneIndex === selection.zoneIndex) {
        pending.push({ id: actionKey(action), label: positionLabel(state, viewer, action.zoneIndex), action });
      }
      if (action.type === "activate" && action.zoneIndex === selection.zoneIndex) {
        const name = state.players[viewer].monsterZone[action.zoneIndex]?.card.name ?? "monstro";
        pending.push({ id: actionKey(action), label: `Ativar efeito do slot ${action.zoneIndex + 1} (${name})`, action });
      }
    }
  }
  for (const action of actions) {
    if (action.type === "converge") {
      pending.push({ id: actionKey(action), label: convergeLabel(state, viewer, action), action });
    }
  }
  for (const action of actions) {
    if (action.type === "advancePhase") {
      pending.push({ id: actionKey(action), label: "Avançar fase", action });
    }
  }
  return pending;
}

function summonLabel(
  state: BoardState,
  viewer: PlayerIndex,
  action: Extract<Action, { type: "summonMonster" }>,
): string {
  const stance = stanceLabel(action.position);
  if (action.effectTargetZoneIndex === undefined) {
    return stance;
  }
  const foe = opponentOf(viewer);
  const target = state.players[foe].monsterZone[action.effectTargetZoneIndex];
  const name = target?.card.name ?? "monstro";
  return `${stance}, alvo slot ${action.effectTargetZoneIndex + 1} (${name})`;
}

function fuseLabel(action: Extract<Action, { type: "fuseBrasa" }>): string {
  return stanceLabel(action.position);
}

function stanceLabel(position: BattlePosition): string {
  switch (position) {
    case "attack":
      return "Ataque";
    case "defense":
      return "Defesa";
    default: {
      const unexpected: never = position;
      return String(unexpected);
    }
  }
}

function positionLabel(state: BoardState, viewer: PlayerIndex, zoneIndex: number): string {
  const slot = state.players[viewer].monsterZone[zoneIndex];
  const next = slot?.position === "defense" ? "ataque" : "defesa";
  return `Mudar posição do slot ${zoneIndex + 1} para ${next}`;
}

function convergeLabel(
  state: BoardState,
  viewer: PlayerIndex,
  action: Extract<Action, { type: "converge" }>,
): string {
  const name = state.players[viewer].lineageDeck[action.lineageIndex]?.name ?? "Mestiço";
  const mats = action.materialZoneIndexes.map((index) => index + 1).join(", ");
  const fromHand = action.materialHandIndex === undefined ? "" : `, mão ${action.materialHandIndex + 1}`;
  return `Convergência de ${name} no slot ${action.zoneIndex + 1} em ${positionWord(action.position)} (materiais ${mats}${fromHand})`;
}

function attackLabel(state: BoardState, foe: PlayerIndex, action: Extract<Action, { type: "attack" }>): string {
  switch (action.target.kind) {
    case "monster": {
      const slot = state.players[foe].monsterZone[action.target.zoneIndex];
      const name = slot?.card.name ?? "monstro";
      return `Atacar o slot ${action.target.zoneIndex + 1} (${name})`;
    }
    case "tower":
      return "Atacar a Torre";
    case "player":
      return "Atacar o jogador";
    default: {
      const unexpected: never = action.target;
      return String(unexpected);
    }
  }
}

function describeOwnMonster(state: BoardState, viewer: PlayerIndex, zoneIndex: number): string {
  const slot = state.players[viewer].monsterZone[zoneIndex];
  if (slot === null || slot === undefined) {
    return `Slot de monstro ${zoneIndex + 1} vazio`;
  }
  const position = slot.position === "attack" ? "ataque" : "defesa";
  const materials = slot.materials?.length ?? 0;
  const extra = materials > 0 ? `, ${materials} materiais` : "";
  return `Slot ${zoneIndex + 1}, ${slot.card.name}, em ${position}${extra}`;
}

function hintFor(
  state: BoardState,
  viewer: PlayerIndex,
  selection: DuelSelection,
  summonCount: number,
  fuseCount: number,
  neededTributes: number,
  tributesReady: boolean,
  materialsReady: boolean,
): string {
  if (state.winner !== null) {
    return state.winner === viewer ? "Você venceu o duelo." : "O oponente venceu o duelo.";
  }
  if (state.activePlayerIndex !== viewer) {
    return "Vez do oponente.";
  }
  if (selection.handIndex !== null) {
    if (fuseCount > 0) {
      if (!materialsReady) {
        return "Escolha 3 Filhotes de Brasa e depois o slot da fusão.";
      }
      if (selection.zoneIndex === null) {
        return "Escolha o slot da fusão.";
      }
      return "Escolha ataque ou defesa para a fusão.";
    }
    if (summonCount > 0) {
      if (!tributesReady) {
        const noun = neededTributes === 1 ? "tributo" : "tributos";
        return `Escolha ${neededTributes} ${noun} e depois o slot.`;
      }
      if (selection.zoneIndex === null) {
        return "Escolha o slot para invocar.";
      }
      return "Escolha ataque ou defesa.";
    }
    const card = state.players[viewer].hand[selection.handIndex];
    if (card?.kind === "spell" || card?.kind === "trap") {
      return "Escolha o slot de magia ou armadilha.";
    }
    if (card?.kind === "tower") {
      return "Clique na zona da Torre.";
    }
    if (card?.kind === "biome") {
      return "Clique na zona do Bioma.";
    }
    return "Essa carta não tem jogada agora.";
  }
  if (selection.zoneIndex !== null && state.phase === "battle") {
    return "Escolha o alvo do ataque.";
  }
  if (selection.zoneIndex !== null) {
    return "Use a ação deste slot ou escolha outra carta.";
  }
  return "Escolha uma carta da mão, um monstro seu ou avance a fase.";
}

function canSelectMonster(actions: readonly Action[], zoneIndex: number): boolean {
  return actions.some((action) =>
    (action.type === "attack" && action.attackerZoneIndex === zoneIndex)
    || (action.type === "changePosition" && action.zoneIndex === zoneIndex)
    || (action.type === "activate" && action.zoneIndex === zoneIndex),
  );
}

function canToggleTribute(sets: readonly (readonly number[])[], selected: readonly number[], zoneIndex: number): boolean {
  const next = selected.includes(zoneIndex) ? selected.filter((index) => index !== zoneIndex) : [...selected, zoneIndex];
  return sets.some((set) => next.every((index) => set.includes(index)) && next.length <= set.length);
}

function chosenMaterials(sets: readonly (readonly number[])[], selected: readonly number[]): readonly number[] {
  if (sets.length === 1) {
    return sets[0] ?? [];
  }
  return selected;
}

function summonsFor(actions: readonly Action[], handIndex: number | null): Extract<Action, { type: "summonMonster" }>[] {
  if (handIndex === null) {
    return [];
  }
  return actions.filter((action): action is Extract<Action, { type: "summonMonster" }> =>
    action.type === "summonMonster" && action.handIndex === handIndex,
  );
}

function fusesFor(actions: readonly Action[], handIndex: number | null): Extract<Action, { type: "fuseBrasa" }>[] {
  if (handIndex === null) {
    return [];
  }
  return actions.filter((action): action is Extract<Action, { type: "fuseBrasa" }> =>
    action.type === "fuseBrasa" && action.handIndex === handIndex,
  );
}

function sameNumbers(left: readonly number[], right: readonly number[]): boolean {
  if (left.length !== right.length) {
    return false;
  }
  const sortedLeft = [...left].sort((a, b) => a - b);
  const sortedRight = [...right].sort((a, b) => a - b);
  return sortedLeft.every((value, index) => value === sortedRight[index]);
}

function subsetOfAny(selected: readonly number[], sets: readonly (readonly number[])[]): boolean {
  return sets.some((set) => selected.every((index) => set.includes(index)));
}

function uniqueSets(sets: readonly (readonly number[])[]): number[][] {
  const seen = new Set<string>();
  const unique: number[][] = [];
  for (const set of sets) {
    const key = listKey(set);
    if (seen.has(key)) {
      continue;
    }
    seen.add(key);
    unique.push([...set]);
  }
  return unique;
}

function listKey(values: readonly number[]): string {
  return [...values].sort((a, b) => a - b).join(".");
}

function sameTarget(left: AttackTarget, right: AttackTarget): boolean {
  switch (left.kind) {
    case "monster":
      return right.kind === "monster" && right.zoneIndex === left.zoneIndex;
    case "tower":
      return right.kind === "tower";
    case "player":
      return right.kind === "player";
    default: {
      const unexpected: never = left;
      throw new Error(`Alvo inválido: ${String(unexpected)}.`);
    }
  }
}

function targetKey(target: AttackTarget): string {
  switch (target.kind) {
    case "monster":
      return `monster:${target.zoneIndex}`;
    case "tower":
      return "tower";
    case "player":
      return "player";
    default: {
      const unexpected: never = target;
      return String(unexpected);
    }
  }
}

function positionWord(position: BattlePosition): string {
  switch (position) {
    case "attack":
      return "ataque";
    case "defense":
      return "defesa";
    default: {
      const unexpected: never = position;
      return String(unexpected);
    }
  }
}
