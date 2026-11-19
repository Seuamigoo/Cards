import catalogFile from "../../catalog/cards.json";
import { chooseAction } from "../../src/ai/bot";
import type { BotLevel } from "../../src/ai/bot";
import { buildDeck, starterCardIds } from "../../src/catalog/index";
import { GameMatch, createSeededRng, getLegalActions } from "../../src/domain/index";
import type { Action, BoardState } from "../../src/domain/index";
import { adminCards, apiUrl, loginAccount, publishCatalog, registerAccount, saveCard, uploadCardImage } from "./api";
import type { Session } from "./api";
import { CardRegistry, CatalogCache } from "../../src/catalog/index";
import type { CardRegistryResult } from "../../src/catalog/index";
import type { Card } from "../../src/domain/index";
import { MemoryStorageAdapter } from "../../src/persistence/index";
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
void refreshCatalog().finally(draw);

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
    image.src = resolveImage(card.image.src);
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

function resolveImage(src: string): string {
  if (src.startsWith("https://") || src.startsWith("assets/")) {
    return src;
  }
  return apiUrl(`/${src.replace(/^\//, "")}`);
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
  const email = field("email", "Email");
  const password = field("password", "Senha");
  const username = field("text", "Usuário");
  const message = document.createElement("p");
  form.append(email.label, password.label);
  if (mode === "register") {
    form.insertBefore(username.label, email.label);
  }
  form.append(
    actionButton(mode === "login" ? "Entrar" : "Criar conta", () => {
      void submitAuth(mode, email.input.value, password.input.value, username.input.value, message);
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
  email: string,
  password: string,
  username: string,
  message: HTMLElement,
): Promise<void> {
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

function renderAdmin(): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Admin";
  const preview = document.createElement("p");
  preview.textContent = "Prévia: nenhuma carta.";
  const name = field("text", "Nome");
  const rarity = field("text", "Raridade");
  rarity.input.value = "comum";
  const kind = field("text", "Tipo");
  kind.input.value = "spell";
  const level = field("number", "Nível");
  const atk = field("number", "ATK");
  const def = field("number", "DEF");
  const file = document.createElement("input");
  file.type = "file";
  const status = document.createElement("p");
  const list = document.createElement("ul");
  main.append(
    title,
    preview,
    name.label,
    rarity.label,
    kind.label,
    level.label,
    atk.label,
    def.label,
    file,
    actionButton("Salvar carta", () => {
      preview.textContent = `Prévia: ${name.input.value} · ${rarity.input.value} · ATK ${atk.input.value || "—"} / DEF ${def.input.value || "—"}`;
      void saveAdminCard(name.input.value, rarity.input.value, kind.input.value, level.input.value, atk.input.value, def.input.value, file.files?.[0], status, list);
    }),
    actionButton("Publicar atualização", () => {
      void publishAdmin(status);
    }),
    actionButton("Voltar", () => {
      screen = "menu";
      draw();
    }),
    status,
    list,
  );
  void fillAdminList(list);
  return main;
}

async function fillAdminList(list: HTMLElement): Promise<void> {
  if (session === null) {
    return;
  }
  const cards = await adminCards(session.accessToken);
  list.replaceChildren();
  for (const card of cards) {
    const item = document.createElement("li");
    item.textContent = `${card.name} (${card.status})`;
    list.append(item);
  }
}

async function saveAdminCard(
  name: string,
  rarity: string,
  kind: string,
  level: string,
  atk: string,
  def: string,
  file: File | undefined,
  status: HTMLElement,
  list: HTMLElement,
): Promise<void> {
  if (session === null) {
    return;
  }
  const id = await saveCard(session.accessToken, {
    name,
    rarity,
    kind,
    status: "draft",
    ...(level.length > 0 ? { level: Number(level) } : {}),
    ...(atk.length > 0 ? { atk: Number(atk) } : {}),
    ...(def.length > 0 ? { def: Number(def) } : {}),
    ...(kind === "monster" ? { tags: ["HUMAN", "WARRIOR"], keywords: [] } : {}),
  });
  if (id === null) {
    status.textContent = "Não foi possível salvar.";
    return;
  }
  if (file !== undefined) {
    const uploaded = await uploadCardImage(session.accessToken, id, file);
    status.textContent = uploaded ? "Carta salva com imagem." : "Carta salva, imagem rejeitada.";
  } else {
    status.textContent = "Carta salva.";
  }
  await fillAdminList(list);
}

async function publishAdmin(status: HTMLElement): Promise<void> {
  if (session === null) {
    return;
  }
  status.textContent = await publishCatalog(session.accessToken);
}

let botMatch: GameMatch | null = null;
let botLevel: BotLevel = "easy";
const botRng = createSeededRng(9);

function renderBot(): HTMLElement {
  const main = document.createElement("main");
  const title = document.createElement("h1");
  title.textContent = "Jogar contra bot";
  const toolbar = document.createElement("div");
  toolbar.className = "toolbar";
  toolbar.append(
    actionButton("Fácil", () => {
      startBot("easy");
    }),
    actionButton("Normal", () => {
      startBot("normal");
    }),
    actionButton("Voltar", () => {
      screen = "menu";
      draw();
    }),
  );
  main.append(title, toolbar);
  if (botMatch === null) {
    return main;
  }
  const state = botMatch.getState();
  const status = document.createElement("p");
  const winner = state.winner === null ? `vez do jogador ${state.activePlayerIndex}` : `vencedor ${state.winner}`;
  status.textContent = `Turno ${state.turn} · ${state.phase} · HP ${state.players[0].hp} x ${state.players[1].hp} · ${winner}`;
  const hand = document.createElement("p");
  hand.textContent = `Sua mão: ${state.players[0].hand.map((card) => card.name).join(", ") || "vazia"}`;
  main.append(status, hand);
  if (state.winner === null && state.activePlayerIndex === 0) {
    const actions = document.createElement("div");
    actions.className = "toolbar";
    for (const action of getLegalActions(state, 0)) {
      actions.append(
        actionButton(labelAction(state, action), () => {
          botMatch?.dispatch(action);
          runBot();
          draw();
        }),
      );
    }
    main.append(actions);
  }
  return main;
}

function startBot(level: BotLevel): void {
  if (!loaded.ok) {
    return;
  }
  const human = buildDeck(loaded.registry, [...starterCardIds("vanguarda-do-reino", "classic")]);
  const bot = buildDeck(loaded.registry, [...starterCardIds("marcha-da-necropole", "classic")]);
  if (!human.ok || !bot.ok) {
    return;
  }
  botLevel = level;
  botMatch = new GameMatch("classic", ["voce", "bot"], undefined, {
    decks: [human.cards, bot.cards],
    seed: 1,
  });
  runBot();
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

function labelAction(state: BoardState, action: Action): string {
  switch (action.type) {
    case "advancePhase":
      return "Avançar fase";
    case "summonMonster":
      return `Invocar ${state.players[0].hand[action.handIndex]?.name ?? "monstro"} (${action.position === "attack" ? "Ataque" : "Defesa"})`;
    case "changePosition":
      return `Mudar posição ${action.zoneIndex + 1}`;
    case "setSpellTrap":
      return `Posicionar ${state.players[0].hand[action.handIndex]?.name ?? "carta"}`;
    case "summonTower":
      return "Invocar Torre";
    case "playBiome":
      return "Jogar Bioma";
    case "converge":
      return `Convergência ${state.players[0].lineageDeck[action.lineageIndex]?.name ?? "Mestiço"}`;
    case "attack":
      return `Atacar ${action.target.kind}`;
    default: {
      const unexpected: never = action;
      return String(unexpected);
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
