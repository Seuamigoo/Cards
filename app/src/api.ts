const configured = import.meta.env.VITE_API_URL ?? "";

export function apiUrl(path: string): string {
  const base = configured.replace(/\/$/, "");
  return `${base}${path}`;
}

export interface Session {
  accessToken: string;
  role: "USER" | "ADMIN";
  username: string;
}

export async function registerAccount(email: string, username: string, password: string): Promise<string | null> {
  const response = await fetch(apiUrl("/auth/register"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, username, password }),
  });
  if (!response.ok) {
    return "Não foi possível cadastrar.";
  }
  return null;
}

export async function loginAccount(email: string, password: string): Promise<Session | string> {
  const response = await fetch(apiUrl("/auth/login"), {
    method: "POST",
    headers: { "content-type": "application/json" },
    credentials: "include",
    body: JSON.stringify({ email, password }),
  });
  if (!response.ok) {
    return "Credenciais inválidas.";
  }
  return (await response.json()) as Session;
}

export async function adminCards(token: string): Promise<AdminCard[]> {
  const response = await fetch(apiUrl("/admin/cards"), {
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return [];
  }
  return (await response.json()) as AdminCard[];
}

export async function saveCard(token: string, card: CardDraft, id?: string): Promise<string | null> {
  const response = await fetch(apiUrl(id === undefined ? "/admin/cards" : `/admin/cards/${id}`), {
    method: id === undefined ? "POST" : "PATCH",
    headers: { "content-type": "application/json", authorization: `Bearer ${token}` },
    body: JSON.stringify(card),
  });
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as { id: string };
  return body.id;
}

export async function uploadCardImage(token: string, id: string, file: File): Promise<boolean> {
  const body = new FormData();
  body.set("image", file);
  const response = await fetch(apiUrl(`/admin/cards/${id}/image`), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
    body,
  });
  return response.ok;
}

export async function publishCatalog(token: string): Promise<string> {
  const response = await fetch(apiUrl("/admin/catalog/publish"), {
    method: "POST",
    headers: { authorization: `Bearer ${token}` },
  });
  if (!response.ok) {
    return "Publicação rejeitada.";
  }
  const body = (await response.json()) as { version: number };
  return `Catálogo ${body.version} publicado.`;
}

export interface AdminCard {
  readonly id: string;
  readonly name: string;
  readonly rarity: string;
  readonly kind: string;
  readonly atk: number | null;
  readonly def: number | null;
  readonly level: number | null;
  readonly status: string;
  readonly imagePath: string | null;
  readonly cardClass: string | null;
  readonly effects: string | null;
}

export interface CardDraft {
  readonly name: string;
  readonly rarity: string;
  readonly kind: string;
  readonly level?: number;
  readonly atk?: number;
  readonly def?: number;
  readonly tags?: readonly string[];
  readonly keywords?: readonly string[];
  readonly status: "draft" | "published";
}
