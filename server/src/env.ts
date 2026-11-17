export interface ServerEnv {
  readonly databaseUrl: string;
  readonly accessSecret: string;
  readonly refreshSecret: string;
  readonly port: number;
  readonly corsOrigin: string;
  readonly nodeEnv: string;
}

export function readEnv(source: NodeJS.ProcessEnv = process.env): ServerEnv {
  const databaseUrl = required(source, "DATABASE_URL");
  const accessSecret = required(source, "JWT_ACCESS_SECRET");
  const refreshSecret = required(source, "JWT_REFRESH_SECRET");
  const port = Number(source.PORT ?? "3001");
  if (!Number.isInteger(port) || port <= 0) {
    throw new Error("PORT inválida.");
  }
  return {
    databaseUrl,
    accessSecret,
    refreshSecret,
    port,
    corsOrigin: source.CORS_ORIGIN ?? "http://127.0.0.1:1420",
    nodeEnv: source.NODE_ENV ?? "development",
  };
}

function required(source: NodeJS.ProcessEnv, key: string): string {
  const value = source[key];
  if (value === undefined || value.length < 8) {
    throw new Error(`${key} é obrigatório.`);
  }
  return value;
}
