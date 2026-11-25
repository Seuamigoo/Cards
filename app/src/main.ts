import catalogFile from "../../catalog/cards.json";
import { chooseAction } from "../../src/ai/bot";
import type { BotLevel } from "../../src/ai/bot";
import { buildDeck, starterCardIds } from "../../src/catalog/index";
import { GameMatch, createSeededRng } from "../../src/domain/index";
import type { GameMode } from "../../src/domain/index";
import { adminCards, apiUrl, loginAccount, publishCatalog, registerAccount, saveCard, uploadCardImage } from "./api";
import { probeServer, rememberServer, serverFieldValue, readStoredServer } from "./serverUrl";
import type { AdminCard, Session } from "./api";
import { CardRegistry, CatalogCache } from "../../src/catalog/index";
import type { CardRegistryResult } from "../../src/catalog/index";
import { MemoryStorageAdapter } from "../../src/persistence/index";
import { catalogEffectText } from "./board/catalogText";
import { applyDuelInput, initialDuelView } from "./board/duel";
import type { DuelInput, DuelViewState } from "./board/duel";
import { watchDuel } from "./board/fx";
import type { BoardFx } from "./board/fx";
import { brasaShowcase } from "./board/showcase";
import { renderDuel } from "./board/view";
import { INITIAL_SCREEN, aiDuelRequest, homeEntries, pvpHint, showDragonTable } from "./home";
import type { MenuAccess } from "./home";
import { EMPTY_CARD_FILTER } from "./shell/cardFilters";
import type { CardFilter } from "./shell/cardFilters";
import { addCopy, deckSizeStatus, removeCopy } from "./shell/deckRules";
import { renderCollectionGrid, renderDeckPlace, renderProfile, renderShopPlace, renderStarterPick } from "./shell/places";
import { applyStarter, createExamplePlayerData, freshAccount, guestRecord } from "./shell/playerData";
import type { PlayerDataService, PlayerRecord } from "./shell/playerData";
import { renderUpdateScreen, stubUpdateView } from "./updateScreen";
import type { UpdateView } from "./updateScreen";
import "./shell/shell.css";
import "./style.css";

type Screen = "update" | "gate" | "starter" | "menu" | "battle" | "deck" | "collection" | "shop" | "profile" | "login" | "register" | "admin" | "online" | "bot";
type ShopTab = "caixas" | "decks" | "vendedor" | "mercado";

let loaded: CardRegistryResult = CardRegistry.fromJSON(JSON.stringify(catalogFile));
let session: Session | null = null;

const root = document.querySelector("#app");
if (root === null) {
  throw new Error("Elemento #app ausente.");
}
const app = root;

const updateView: UpdateView = stubUpdateView({
  dev: import.meta.env.DEV,
  online: navigator.onLine,
  preview: new URLSearchParams(window.location.search).get("atualizacao"),
});
let screen: Screen = updateView.phase === "current" ? INITIAL_SCREEN : "update";
let guest = false;
let offlinePlay = updateView.phase === "offline";
let battleMode: GameMode = "classic";
let battleLevel: BotLevel = "easy";
let battleNote: string | null = null;
let guestStarter = "vanguarda-do-reino";
let player: PlayerRecord = guestRecord();
let playerService: PlayerDataService = createExamplePlayerData(player);
let cardFilter: CardFilter = EMPTY_CARD_FILTER;
let selectedCardId: string | null = null;
let shopTab: ShopTab = "caixas";
let openBoxId: string | null = null;
let reveal: readonly string[] = [];
void refreshCatalog().catch(() => undefined).finally(draw);

function draw(): void {
  app.replaceChildren();
  switch (screen) {
    case "update":
      app.append(renderUpdateScreen(updateView, {
        enter: () => {
          offlinePlay = false;
          screen = "gate";
          draw();
        },
        guest: () => {
          offlinePlay = true;
          guest = true;
          session = null;
          player = guestRecord();
          playerService = createExamplePlayerData(player);
          screen = "menu";
          draw();
        },
      }));
      return;
    case "gate":
      app.append(renderGate());
      return;
    case "starter":
      app.append(renderStarterPick((starterId) => {
        void playerService.chooseStarter(starterId).then((record) => {
          player = record;
          screen = "menu";
          draw();
        });
      }));
      return;
    case "deck":
      app.append(pageWithWallet(renderDeckPlace({
        record: player,
        cards: catalogRegistry(),
        texts: effectText,
        mode: battleMode,
        selectedId: selectedCardId,
        filter: cardFilter,
        onMode: (mode) => {
          battleMode = mode;
          draw();
        },
        onSelect: (cardId) => {
          selectedCardId = cardId;
          draw();
        },
        onFilter: (filter) => {
          cardFilter = filter;
          draw();
        },
        onAdd: () => changeDeck(1),
        onRemove: () => changeDeck(-1),
      })));
      return;
    case "collection":
      app.append(pageWithWallet(renderCollectionGrid({
        record: player,
        cards: catalogRegistry(),
        texts: effectText,
        filter: cardFilter,
        selectedId: selectedCardId,
        onFilter: (filter) => {
          cardFilter = filter;
          draw();
        },
        onSelect: (cardId) => {
          selectedCardId = cardId;
          draw();
        },
      })));
      return;
    case "shop":
      app.append(pageWithWallet(renderShopPlace({
        cards: catalogRegistry(),
        texts: effectText,
        tab: shopTab,
        onTab: (tab) => {
          shopTab = tab;
          reveal = [];
          draw();
        },
        openBoxId,
        onOpenBox: (id) => {
          openBoxId = openBoxId === id ? null : id;
          draw();
        },
        reveal,
        onReveal: (ids) => {
          reveal = ids;
          openBoxId = shopTab === "caixas" ? openBoxId : null;
          draw();
        },
      })));
      return;
    case "profile":
      app.append(pageWithWallet(renderProfile(player)));
      return;
    case "menu":
      app.append(renderMenu());
      return;
    case "battle":
      app.append(renderBattle());
      return;
    case "login":
      app.append(renderAuth("login"));
      return;
    case "register":
      app.append(renderAuth("register"));
      return;
    case "admin":
      if (session?.role !== "ADMIN") {
        screen = "menu";
        app.append(renderMenu());
        return;
      }
      app.append(renderAdmin());
      return;
    case "online":
      app.append(renderOnline());
      return;
    case "bot":
      app.append(renderBot());
      return;
    default: {
      const unexpected: never = screen;
      throw new Error(`Tela inválida: ${String(unexpected)}.`);
    }
  }
}

function renderGate(): HTMLElement {
  const main = document.createElement("main");
  main.className = "gate";
  const title = document.createElement("h1");
  title.textContent = "Convergência";
  const intro = document.createElement("p");
  intro.textContent = offlinePlay ? "Sem conexão. Entre como convidado para jogar J x IA." : "Escolha como entrar.";
  const nav = document.createElement("div");
  nav.className = "gate-nav";
  nav.setAttribute("aria-label", "Entrada");
  nav.append(
    offlinePlay ? disabledButton("Entrar") : actionButton("Entrar", () => {
      screen = "login";
      draw();
    }),
    offlinePlay ? disabledButton("Cadastrar") : actionButton("Cadastrar", () => {
      screen = "register";
      draw();
    }),
    actionButton("Entrar como convidado", () => {
      guest = true;
      session = null;
      player = guestRecord();
      playerService = createExamplePlayerData(player);
      screen = "menu";
      draw();
    }),
    renderServerSettings(),
  );
  main.append(title, intro, nav);
  return main;
}

function renderServerSettings(): HTMLElement {
  const details = document.createElement("details");
  details.className = "server-settings";
  const summary = document.createElement("summary");
  summary.textContent = "Configurações de servidor";
  const label = document.createElement("label");
  label.textContent = "Servidor";
  const input = document.createElement("input");
  input.type = "text";
  input.placeholder = "192.168.0.10:3001";
  input.spellcheck = false;
  input.autocomplete = "off";
  input.setAttribute("aria-label", "Servidor");
  input.value = serverFieldValue(import.meta.env.VITE_API_URL ?? "", readStoredServer(localStorage));
  input.addEventListener("change", () => {
    rememberServer(localStorage, input.value);
  });
  label.append(input);
  const hint = document.createElement("p");
  hint.className = "soon";
  hint.textContent = "IP da rede local. Vazio usa o endereço do aplicativo.";
  details.append(summary, label, hint);
  return details;
}

function renderMenu(): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Convergência";
  const intro = document.createElement("p");
  intro.textContent = guest ? "Convidado. Seus dados não são salvos." : "Escolha uma entrada.";
  const nav = document.createElement("nav");
  nav.className = "menu-nav";
  nav.setAttribute("aria-label", "Menu principal");
  for (const entry of homeEntries(menuAccess())) {
    if (entry.ready) {
      nav.append(actionButton(entry.label, () => openHome(entry.id)));
      continue;
    }
    const block = document.createElement("div");
    const button = disabledButton(entry.label);
    const hintId = `soon-${entry.id}`;
    button.setAttribute("aria-describedby", hintId);
    const hint = document.createElement("p");
    hint.id = hintId;
    hint.className = "soon";
    hint.textContent = entry.hint ?? "em breve";
    block.append(button, hint);
    nav.append(block);
  }
  nav.append(actionButton("Sair", () => {
    guest = false;
    session = null;
    botMatch = null;
    screen = "gate";
    draw();
  }));
  if (session?.role === "ADMIN") {
    nav.append(actionButton("Admin", () => {
      screen = "admin";
      draw();
    }));
  }
  if (menuAccess() === "account") {
    main.append(title, walletBar(), intro, nav);
  } else {
    main.append(title, intro, nav);
  }
  return main;
}

function openHome(id: "battle" | "deck" | "collection" | "shop" | "profile"): void {
  switch (id) {
    case "battle":
      battleNote = null;
      screen = "battle";
      draw();
      return;
    case "deck":
    case "collection":
    case "shop":
    case "profile":
      screen = id;
      draw();
      return;
    default: {
      const unexpected: never = id;
      throw new Error(`Entrada inválida: ${String(unexpected)}.`);
    }
  }
}

function renderBattle(): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Batalhar";
  const mode = document.createElement("fieldset");
  mode.className = "choice-set";
  const modeLegend = document.createElement("legend");
  modeLegend.textContent = "Modo";
  mode.append(
    modeLegend,
    choice("battle-mode", "classic", "Clássico", battleMode === "classic", () => {
      battleMode = "classic";
    }),
    choice("battle-mode", "blitz", "Blitz (3 slots)", battleMode === "blitz", () => {
      battleMode = "blitz";
    }),
  );
  const level = document.createElement("fieldset");
  level.className = "choice-set";
  const levelLegend = document.createElement("legend");
  levelLegend.textContent = "Dificuldade";
  level.append(
    levelLegend,
    choice("battle-level", "easy", "Fácil", battleLevel === "easy", () => {
      battleLevel = "easy";
    }),
    choice("battle-level", "normal", "Normal", battleLevel === "normal", () => {
      battleLevel = "normal";
    }),
  );
  const ai = document.createElement("section");
  const aiTitle = document.createElement("h2");
  aiTitle.textContent = "J x IA";
  const deckIds = activeDeckIds();
  const size = deckSizeStatus(battleMode, deckIds.length);
  const start = actionButton("Batalhar contra a IA", () => {
    startAiDuel(aiDuelRequest(battleMode, battleLevel));
  });
  start.disabled = !size.valid;
  if (!size.valid && size.reason !== null) {
    start.setAttribute("aria-describedby", "deck-size");
  }
  ai.append(aiTitle, start);
  if (!size.valid && size.reason !== null) {
    const why = document.createElement("p");
    why.id = "deck-size";
    why.className = "soon";
    why.textContent = size.reason;
    ai.append(why);
  }
  if (guest || offlinePlay) {
    const pick = document.createElement("fieldset");
    pick.className = "choice-set";
    const legend = document.createElement("legend");
    legend.textContent = "Deck inicial";
    pick.append(legend);
    for (const starter of [["vanguarda-do-reino", "Vanguarda do Reino"], ["marcha-da-necropole", "Marcha da Necrópole"]] as const) {
      pick.append(choice("guest-starter", starter[0], starter[1], guestStarter === starter[0], () => {
        guestStarter = starter[0];
        draw();
      }));
    }
    ai.append(pick);
  }
  if (showDragonTable(import.meta.env.DEV)) {
    ai.append(actionButton("Mesa com Dragão Brasa", () => {
      startBrasa();
    }));
  }
  const pvp = document.createElement("section");
  const pvpTitle = document.createElement("h2");
  pvpTitle.textContent = "J x J";
  const hint = document.createElement("p");
  hint.className = "soon";
  hint.id = "pvp-soon";
  hint.textContent = pvpHint(guest || session === null);
  const pvpButton = disabledButton("J x J");
  pvpButton.setAttribute("aria-describedby", "pvp-soon");
  pvp.append(pvpTitle, pvpButton, hint);
  if (battleNote !== null) {
    const note = document.createElement("p");
    note.setAttribute("role", "alert");
    note.textContent = battleNote;
    main.append(title, mode, level, ai, pvp, note);
  } else {
    main.append(title, mode, level, ai, pvp);
  }
  main.append(actionButton("Voltar", () => {
    screen = "menu";
    draw();
  }));
  return main;
}

function choice(name: string, value: string, label: string, checked: boolean, onPick: () => void): HTMLLabelElement {
  const wrapper = document.createElement("label");
  wrapper.className = "choice";
  const input = document.createElement("input");
  input.type = "radio";
  input.name = name;
  input.value = value;
  input.checked = checked;
  input.addEventListener("change", () => {
    if (input.checked) {
      onPick();
    }
  });
  const text = document.createElement("span");
  text.textContent = label;
  wrapper.append(input, text);
  return wrapper;
}

function disabledButton(label: string): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.disabled = true;
  button.textContent = label;
  return button;
}

async function refreshCatalog(): Promise<void> {
  const adapter = new MemoryStorageAdapter();
  await adapter.set("catalog:current", JSON.stringify(catalogFile));
  const cache = new CatalogCache(adapter, async () => {
    const latest = await fetch(apiUrl("/catalog/latest"));
    if (!latest.ok) {
      throw new Error("sem catálogo");
    }
    const meta = (await latest.json()) as { version: number };
    const document = await fetch(apiUrl(`/catalog/${meta.version}`));
    if (!document.ok) {
      throw new Error("sem versão");
    }
    return document.text();
  }, apiUrl("/catalog/latest"));
  const synced = await cache.sync();
  if (synced.ok) {
    loaded = synced;
  }
}

function renderAuth(mode: "login" | "register"): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = mode === "login" ? "Entrar" : "Cadastrar";
  const form = document.createElement("form");
  form.className = "toolbar";
  const server = field("text", "Servidor");
  server.input.placeholder = "192.168.0.10:3001";
  server.input.spellcheck = false;
  server.input.value = serverFieldValue(import.meta.env.VITE_API_URL ?? "", readStoredServer(localStorage));
  const email = field("email", "Email");
  const password = field("password", "Senha");
  const username = field("text", "Usuário");
  const message = document.createElement("p");
  form.append(server.label, email.label, password.label);
  if (mode === "register") {
    form.insertBefore(username.label, email.label);
  }
  form.append(
    actionButton(mode === "login" ? "Entrar" : "Criar conta", () => {
      void submitAuth(mode, server.input.value, email.input.value, password.input.value, username.input.value, message);
    }),
    actionButton("Voltar", () => {
      screen = "gate";
      draw();
    }),
    message,
  );
  form.addEventListener("submit", (event) => {
    event.preventDefault();
  });
  main.append(title, form);
  return main;
}

async function submitAuth(
  mode: "login" | "register",
  serverInput: string,
  email: string,
  password: string,
  username: string,
  message: HTMLElement,
): Promise<void> {
  rememberServer(localStorage, serverInput);
  const health = await probeServer(apiUrl(""), fetch);
  if (health !== null) {
    message.textContent = health;
    return;
  }
  if (mode === "register") {
    const created = await registerAccount(email, username, password);
    if (created !== null) {
      message.textContent = created;
      return;
    }
    guest = false;
    offlinePlay = false;
    player = freshAccount();
    playerService = createExamplePlayerData(player);
    screen = "starter";
    draw();
    return;
  }
  const result = await loginAccount(email, password);
  if (typeof result === "string") {
    message.textContent = result;
    return;
  }
  session = result;
  guest = false;
  offlinePlay = false;
  player = applyStarter(freshAccount(), "vanguarda-do-reino");
  playerService = createExamplePlayerData(player);
  screen = "menu";
  draw();
}

let adminCardsCache: AdminCard[] = [];
let adminSelectionId: string | null = null;
let adminNeedsLoad = true;

function renderAdmin(): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Admin";
  const selected = adminCardsCache.find((card) => card.id === adminSelectionId) ?? null;
  const status = document.createElement("p");
  const list = document.createElement("ul");
  for (const card of adminCardsCache) {
    const item = document.createElement("li");
    item.append(
      actionButton(`${card.name} (${card.status})`, () => {
        adminSelectionId = card.id;
        adminNeedsLoad = false;
        draw();
      }),
    );
    list.append(item);
  }
  main.append(title, list, status);
  if (selected !== null) {
    main.append(renderAdminEditor(selected, status));
  } else {
    const hint = document.createElement("p");
    hint.textContent = "Abra uma carta da lista para editar os campos ou trocar a imagem.";
    main.append(hint);
  }
  main.append(
    actionButton("Publicar atualização", () => {
      void publishAdmin(status);
    }),
    actionButton("Voltar", () => {
      adminNeedsLoad = true;
      screen = "menu";
      draw();
    }),
  );
  if (adminNeedsLoad) {
    adminNeedsLoad = false;
    void loadAdminCards();
  }
  return main;
}

function renderAdminEditor(card: AdminCard, status: HTMLElement): HTMLElement {
  const editor = document.createElement("section");
  const identity = document.createElement("p");
  identity.textContent = `Id ${card.id}${card.cardClass !== null ? ` · classe ${card.cardClass}` : ""}`;
  const name = field("text", "Nome");
  name.input.value = card.name;
  const rarity = field("text", "Raridade");
  rarity.input.value = card.rarity;
  const kind = field("text", "Tipo");
  kind.input.value = card.kind;
  const level = field("number", "Nível");
  level.input.value = card.level === null ? "" : String(card.level);
  const atk = field("number", "ATK");
  atk.input.value = card.atk === null ? "" : String(card.atk);
  const def = field("number", "DEF");
  def.input.value = card.def === null ? "" : String(card.def);
  const effects = document.createElement("p");
  effects.textContent = effectSummary(card.effects);
  const file = document.createElement("input");
  file.type = "file";
  file.accept = "image/png,image/jpeg,image/webp";
  editor.append(
    identity,
    effects,
    name.label,
    rarity.label,
    kind.label,
    level.label,
    atk.label,
    def.label,
    actionButton("Salvar campos", () => {
      void saveAdminFields(card, name.input.value, rarity.input.value, kind.input.value, level.input.value, atk.input.value, def.input.value, status);
    }),
    file,
    actionButton("Trocar imagem", () => {
      void replaceAdminImage(card.id, file.files?.[0], status);
    }),
  );
  return editor;
}

function effectSummary(raw: string | null): string {
  if (raw === null || raw.length === 0) {
    return "Sem texto de efeito.";
  }
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return "Sem texto de efeito.";
    }
    return parsed
      .map((effect) => {
        if (typeof effect !== "object" || effect === null || !("text" in effect)) {
          return "";
        }
        const text = (effect as { text?: unknown }).text;
        const implemented = (effect as { implemented?: unknown }).implemented === true;
        return typeof text === "string" ? `${text} (${implemented ? "no motor" : "não implementado"})` : "";
      })
      .filter((line) => line.length > 0)
      .join(" ");
  } catch {
    return raw;
  }
}

async function loadAdminCards(): Promise<void> {
  if (session === null) {
    return;
  }
  adminCardsCache = await adminCards(session.accessToken);
  if (screen === "admin") {
    draw();
  }
}

async function saveAdminFields(
  card: AdminCard,
  name: string,
  rarity: string,
  kind: string,
  level: string,
  atk: string,
  def: string,
  status: HTMLElement,
): Promise<void> {
  if (session === null) {
    return;
  }
  const id = await saveCard(session.accessToken, {
    name,
    rarity,
    kind,
    status: card.status === "published" ? "published" : "draft",
    ...(level.length > 0 ? { level: Number(level) } : {}),
    ...(atk.length > 0 ? { atk: Number(atk) } : {}),
    ...(def.length > 0 ? { def: Number(def) } : {}),
  }, card.id);
  status.textContent = id === card.id ? "Campos salvos." : "Não foi possível salvar.";
  adminNeedsLoad = true;
  draw();
}

async function replaceAdminImage(id: string, file: File | undefined, status: HTMLElement): Promise<void> {
  if (session === null || file === undefined) {
    status.textContent = "Escolha uma imagem png, jpg ou webp.";
    return;
  }
  const uploaded = await uploadCardImage(session.accessToken, id, file);
  status.textContent = uploaded ? "Imagem trocada. O id da carta permanece." : "Imagem rejeitada.";
  adminNeedsLoad = true;
  draw();
}

async function publishAdmin(status: HTMLElement): Promise<void> {
  if (session === null) {
    return;
  }
  status.textContent = await publishCatalog(session.accessToken);
}

let botMatch: GameMatch | null = null;
let botLevel: BotLevel = "easy";
let duelView: DuelViewState = initialDuelView();
let duelError: string | null = null;
let boardFx: BoardFx[] = [];
let stopWatch: (() => void) | null = null;
const botRng = createSeededRng(9);
const effectText = catalogEffectText(catalogFile);

function renderBot(): HTMLElement {
  const main = document.createElement("main");
  main.className = botMatch === null ? "" : "duel-screen";
  if (botMatch === null) {
    const title = document.createElement("h1");
    title.textContent = "Jogar contra bot";
    const note = document.createElement("p");
    note.textContent = duelError ?? "O catálogo ainda não carregou.";
    main.append(title, note);
    return main;
  }
  main.append(renderDuel({
    state: botMatch.getState(),
    viewer: 0,
    view: duelView,
    texts: effectText,
    error: duelError,
    fx: boardFx,
    onBack: () => {
      botMatch = null;
      screen = "battle";
      draw();
    },
    onInput: onDuelInput,
  }));
  return main;
}

function startAiDuel(request: { readonly mode: GameMode; readonly level: BotLevel }): void {
  const ids = activeDeckIds();
  const size = deckSizeStatus(request.mode, ids.length);
  if (!size.valid) {
    battleNote = size.reason;
    screen = "battle";
    draw();
    return;
  }
  if (!startBot(request.mode, request.level, ids)) {
    battleNote = duelError ?? "O catálogo ainda não carregou.";
    screen = "battle";
    draw();
  }
}

function activeDeckIds(): readonly string[] {
  if (guest || offlinePlay) {
    return player.decks.find((deck) => deck.mode === battleMode && deck.id.startsWith(guestStarter))?.cardIds ?? [];
  }
  return player.decks.find((deck) => deck.mode === battleMode)?.cardIds ?? [];
}

function menuAccess(): MenuAccess {
  if (offlinePlay) {
    return "offline";
  }
  if (guest || session === null) {
    return "guest";
  }
  return "account";
}

function changeDeck(direction: 1 | -1): void {
  if (!loaded.ok || selectedCardId === null) {
    return;
  }
  const card = loaded.registry.get(selectedCardId);
  if (card === undefined) {
    return;
  }
  const next = player.decks.map((deck) => {
    if (deck.mode !== battleMode) {
      return deck;
    }
    const owned = player.collection.find((entry) => entry.carta === card.id)?.quantidade ?? 0;
    if (direction > 0) {
      const added = addCopy(deck.cardIds, card.id, owned, card.rarity, player.marketLocked.includes(card.id));
      return added.ok ? { ...deck, cardIds: [...added.deck] } : deck;
    }
    const removed = removeCopy(deck.cardIds, card.id);
    return removed.ok ? { ...deck, cardIds: [...removed.deck] } : deck;
  });
  void playerService.saveDecks(next, (cardId) => loaded.ok ? loaded.registry.get(cardId)?.rarity ?? null : null).then((saved) => {
    if (saved.ok) {
      player = saved.record;
    }
    draw();
  });
}

function pageWithWallet(body: HTMLElement): HTMLElement {
  const main = document.createElement("main");
  main.className = "hub";
  if (player.economy) {
    main.append(walletBar());
  }
  main.append(body, actionButton("Voltar", () => {
    screen = "menu";
    draw();
  }));
  return main;
}

function walletBar(): HTMLElement {
  const header = document.createElement("header");
  header.className = "wallet";
  header.setAttribute("aria-label", "Saldos");
  header.append(balanceMark("Cristais", player.crystals, "crystal"), balanceMark("Essência", player.essence, "essence"));
  if (player.example) {
    const flag = document.createElement("p");
    flag.className = "example-flag";
    flag.textContent = "exemplo";
    header.append(flag);
  }
  return header;
}

function balanceMark(label: string, value: number, kind: "crystal" | "essence"): HTMLElement {
  const item = document.createElement("p");
  item.className = "wallet-balance";
  const icon = document.createElement("span");
  icon.className = kind === "crystal" ? "balance-icon crystal" : "balance-icon essence";
  icon.setAttribute("aria-hidden", "true");
  const text = document.createElement("span");
  text.textContent = `${label} ${new Intl.NumberFormat("pt-BR").format(value)}`;
  item.setAttribute("aria-label", `Saldo de ${label}: ${value}`);
  item.append(icon, text);
  return item;
}

function onDuelInput(input: DuelInput): void {
  if (botMatch === null) {
    return;
  }
  boardFx = [];
  const result = applyDuelInput(botMatch.getState(), 0, duelView, input);
  duelView = result.view;
  if (result.action !== null) {
    const applied = botMatch.dispatch(result.action);
    if (!applied.ok) {
      duelError = applied.error;
    } else {
      duelError = null;
      runBot();
    }
  }
  draw();
}

function attachWatch(match: GameMatch): void {
  stopWatch?.();
  boardFx = [];
  stopWatch = watchDuel(match, (cue) => {
    boardFx = [...boardFx, cue].slice(-8);
  });
}

function catalogRegistry(): CardRegistry {
  if (!loaded.ok) {
    throw new Error("Catálogo indisponível.");
  }
  return loaded.registry;
}

function startBot(mode: GameMode, level: BotLevel, cardIds?: readonly string[]): boolean {
  if (!loaded.ok) {
    duelError = "O catálogo ainda não carregou.";
    return false;
  }
  const humanIds = cardIds ?? [...starterCardIds("vanguarda-do-reino", mode)];
  const human = buildDeck(loaded.registry, [...humanIds]);
  const bot = buildDeck(loaded.registry, [...starterCardIds("marcha-da-necropole", mode)]);
  if (!human.ok || !bot.ok) {
    duelError = "Não foi possível montar os decks iniciais.";
    return false;
  }
  botLevel = level;
  duelView = initialDuelView();
  duelError = null;
  battleNote = null;
  botMatch = new GameMatch(mode, ["voce", "bot"], undefined, {
    decks: [human.cards, bot.cards],
    seed: 1,
  });
  attachWatch(botMatch);
  screen = "bot";
  runBot();
  draw();
  return true;
}

function startBrasa(): void {
  if (!loaded.ok) {
    return;
  }
  const showcase = brasaShowcase(loaded.registry);
  if (!showcase.ok) {
    battleNote = showcase.error;
    botMatch = null;
    screen = "battle";
    draw();
    return;
  }
  botLevel = "easy";
  duelView = initialDuelView();
  duelError = null;
  botMatch = showcase.match;
  attachWatch(botMatch);
  screen = "bot";
  draw();
}

function runBot(): void {
  if (botMatch === null) {
    return;
  }
  for (let step = 0; step < 40 && botMatch.getState().winner === null && botMatch.getState().activePlayerIndex === 1; step += 1) {
    const action = chooseAction(botMatch.getState(), 1, botRng, botLevel);
    if (action === null) {
      return;
    }
    const result = botMatch.dispatch(action);
    if (!result.ok) {
      return;
    }
  }
}

function renderOnline(): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Online";
  const log = document.createElement("p");
  log.textContent = "Crie uma sala ou entre com um código.";
  const code = field("text", "Código");
  main.append(
    title,
    log,
    actionButton("Criar sala", () => {
      void openRoom(null, log);
    }),
    code.label,
    actionButton("Entrar na sala", () => {
      void openRoom(code.input.value, log);
    }),
    actionButton("Voltar", () => {
      screen = "menu";
      draw();
    }),
  );
  return main;
}

async function openRoom(code: string | null, log: HTMLElement): Promise<void> {
  if (session === null) {
    return;
  }
  const socket = new WebSocket(`${apiUrl("/ws").replace(/^http/, "ws")}?token=${session.accessToken}`);
  socket.addEventListener("message", (event) => {
    log.textContent = String(event.data);
  });
  socket.addEventListener("open", () => {
    socket.send(JSON.stringify(code === null ? { type: "create" } : { type: "join", code }));
  });
}

function field(type: string, label: string): { readonly label: HTMLLabelElement; readonly input: HTMLInputElement } {
  const wrapper = document.createElement("label");
  wrapper.textContent = label;
  const input = document.createElement("input");
  input.type = type;
  wrapper.append(input);
  return { label: wrapper, input };
}

function actionButton(label: string, onClick: () => void): HTMLButtonElement {
  const button = document.createElement("button");
  button.type = "button";
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
