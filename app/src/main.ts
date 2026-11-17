import catalogFile from "../../catalog/cards.json";
import { adminCards, apiUrl, loginAccount, publishCatalog, registerAccount, saveCard, uploadCardImage } from "./api";
import type { Session } from "./api";
import { CardRegistry, CatalogCache } from "../../src/catalog/index";
import type { CardRegistryResult } from "../../src/catalog/index";
import type { Card } from "../../src/domain/index";
import { MemoryStorageAdapter } from "../../src/persistence/index";
import "./style.css";

type Screen = "menu" | "collection" | "login" | "register" | "admin";

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
      app.append(renderAdmin());
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
    actionButton("Entrar", () => {
      screen = "login";
      draw();
    }),
    actionButton("Cadastrar", () => {
      screen = "register";
      draw();
    }),
  );
  if (session?.role === "admin") {
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
    atk.label,
    def.label,
    file,
    actionButton("Salvar carta", () => {
      preview.textContent = `Prévia: ${name.input.value} · ${rarity.input.value} · ATK ${atk.input.value || "—"} / DEF ${def.input.value || "—"}`;
      void saveAdminCard(name.input.value, rarity.input.value, kind.input.value, atk.input.value, def.input.value, file.files?.[0], status, list);
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
    ...(atk.length > 0 ? { atk: Number(atk) } : {}),
    ...(def.length > 0 ? { def: Number(def) } : {}),
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
