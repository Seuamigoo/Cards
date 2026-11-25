export interface ServerEnv {
  readonly databaseUrl: string;
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly port: number;
  readonly host: string;
  readonly corsOrigin: string;
  readonly corsOrigins: readonly string[];
  readonly uploadsDir: string | null;
  readonly nodeEnv: string;
}

export const LAN_ORIGINS = [
  "tauri://localhost",
  "http://tauri.localhost",
  "http://localhost:1420",
  "http://127.0.0.1:1420",
] as const;

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const databaseUrl = required(source, "DATABASE_URL");
  const accessSecret = required(source, "JWT_ACCESS_SECRET");
  const refreshSecret = required(source, "JWT_REFRESH_SECRET");
  const port = Number(source.PORT ?? "3001");
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT inválida.");
  }
  const corsOrigin = source.CORS_ORIGIN ?? LAN_ORIGINS.join(",");
  return {
    databaseUrl,
    accessSecret,
    refreshSecret,
    port,
    host: listenHost(source.HOST),
    corsOrigin,
    corsOrigins: corsAllowList(source.CORS_ORIGIN),
    uploadsDir: optionalPath(source.UPLOADS_DIR),
    nodeEnv: source.NODE_ENV ?? "development",
  };
}

export function listenHost(value: string | undefined): string {
  if (value === undefined || value.trim().length === 0) {
    return "0.0.0.0";
  }
  return value.trim();
}

export function corsAllowList(configured: string | undefined): readonly string[] {
  const extra = configured === undefined || configured.trim().length === 0 ? [] : splitCsv(configured);
  const seen = new Set<string>();
  const origins: string[] = [];
  for (const origin of [...LAN_ORIGINS, ...extra]) {
    if (!seen.has(origin)) {
      seen.add(origin);
      origins.push(origin);
    }
  }
  return origins;
}

export function splitCsv(value: string): readonly string[] {
  const parts = value.split(",").map((part) => part.trim()).filter((part) => part.length > 0);
  return parts.length > 0 ? parts : ["http://127.0.0.1:1420"];
}

function optionalPath(value: string | undefined): string | null {
  if (value === undefined || value.trim().length === 0) {
    return null;
  }
  return value.trim();
}

function required(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key];
  if (value === undefined || value.length < 8) {
    throw new Error(`${key} é obrigatório.`);
  }
  return value;
}
