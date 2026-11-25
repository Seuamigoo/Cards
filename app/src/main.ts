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
import type { Card } from "../../src/domain/index";
import { MemoryStorageAdapter } from "../../src/persistence/index";
import { catalogEffectText } from "./board/catalogText";
import { applyDuelInput, initialDuelView } from "./board/duel";
import type { DuelInput, DuelViewState } from "./board/duel";
import { resolveCardArt } from "./board/face";
import { brasaShowcase } from "./board/showcase";
import { renderDuel } from "./board/view";
import "./style.css";

type Screen = "menu" | "collection" | "login" | "register" | "admin" | "online" | "bot";

let loaded: CardRegistryResult = CardRegistry.fromJSON(JSON.stringify(catalogFile));
let session: Session | null = null;

const root = document.querySelector("#app");
if (root === null) {
  throw new Error("Elemento #app ausente.");
}
const app = root;

let screen: Screen = "menu";
void refreshCatalog().catch(() => undefined).finally(draw);

function draw(): void {
  app.replaceChildren();
  switch (screen) {
    case "menu":
      app.append(renderMenu());
      return;
    case "collection":
      app.append(renderCollection(loaded));
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

function renderMenu(): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Convergência";
  const intro = document.createElement("p");
  intro.textContent = "Escolha um modo.";
  const nav = document.createElement("nav");
  nav.append(
    actionButton("Jogar contra bot", () => {
      screen = "bot";
      draw();
    }),
    session === null
      ? disabledButton("Online")
      : actionButton("Online", () => {
          screen = "online";
          draw();
        }),
    actionButton("Coleção", () => {
      screen = "collection";
      draw();
    }),
    actionButton("Entrar", () => {
      screen = "login";
      draw();
    }),
    actionButton("Cadastrar", () => {
      screen = "register";
      draw();
    }),
  );
  if (session?.role === "ADMIN") {
    nav.append(
      actionButton("Admin", () => {
        screen = "admin";
        draw();
      }),
    );
  }
  main.append(title, intro, nav);
  return main;
}

function renderCollection(result: CardRegistryResult): HTMLElement {
  const main = document.createElement("main");
  main.className = "collection";
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
    image.src = resolveCardArt(card.image.src);
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
      return `Nv ${card.level} · ATK ${card.atk} / DEF ${card.def}`;
    case "tower":
      return `DEF ${card.def}`;
    case "spell":
    case "trap":
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
      screen = "menu";
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
    message.textContent = (await registerAccount(email, username, password)) ?? "Conta criada. Entre para continuar.";
    return;
  }
  const result = await loginAccount(email, password);
  if (typeof result === "string") {
    message.textContent = result;
    return;
  }
  session = result;
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
const botRng = createSeededRng(9);
const effectText = catalogEffectText(catalogFile);

function renderBot(): HTMLElement {
  const main = document.createElement("main");
  main.className = botMatch === null ? "" : "duel-screen";
  const title = document.createElement("h1");
  title.textContent = "Jogar contra bot";
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.append(
    actionButton("Clássico fácil", () => startBot("classic", "easy")),
    actionButton("Clássico normal", () => startBot("classic", "normal")),
    actionButton("Blitz fácil", () => startBot("blitz", "easy")),
    actionButton("Blitz normal", () => startBot("blitz", "normal")),
    actionButton("Mesa com Dragão Brasa", () => startBrasa()),
    actionButton("Voltar", () => {
      screen = "menu";
      draw();
    }),
  );
  if (botMatch === null) {
    main.append(title, toolbar);
    if (duelError !== null) {
      const alert = document.createElement("p");
      alert.setAttribute("role", "alert");
      alert.textContent = duelError;
      main.append(alert);
    }
    return main;
  }
  main.append(renderDuel({
    state: botMatch.getState(),
    viewer: 0,
    view: duelView,
    texts: effectText,
    error: duelError,
    onInput: onDuelInput,
  }));
  main.append(toolbar);
  return main;
}

function onDuelInput(input: DuelInput): void {
  if (botMatch === null) {
    return;
  }
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

function startBot(mode: GameMode, level: BotLevel): void {
  if (!loaded.ok) {
    return;
  }
  const human = buildDeck(loaded.registry, [...starterCardIds("vanguarda-do-reino", mode)]);
  const bot = buildDeck(loaded.registry, [...starterCardIds("marcha-da-necropole", mode)]);
  if (!human.ok || !bot.ok) {
    return;
  }
  botLevel = level;
  duelView = initialDuelView();
  duelError = null;
  botMatch = new GameMatch(mode, ["voce", "bot"], undefined, {
    decks: [human.cards, bot.cards],
    seed: 1,
  });
  runBot();
  draw();
}

function startBrasa(): void {
  if (!loaded.ok) {
    return;
  }
  const showcase = brasaShowcase(loaded.registry);
  if (!showcase.ok) {
    duelError = showcase.error;
    botMatch = null;
    draw();
    return;
  }
  botLevel = "easy";
  duelView = initialDuelView();
  duelError = null;
  botMatch = showcase.match;
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
