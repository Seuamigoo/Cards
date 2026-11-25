import { describe, expect, it } from "vitest";
import { listenHost, readEnv, splitCsv } from "../src/env";

const secrets = {
  DATABASE_URL: "file:./dev.db",
  JWT_ACCESS_SECRET: "segredo-access-teste",
  JWT_REFRESH_SECRET: "segredo-refresh-teste",
};

describe("ambiente do servidor", () => {
  it("ouve em todas as interfaces e libera o app Tauri e o dev", () => {
    expect(listenHost(undefined)).toBe("0.0.0.0");
    expect(listenHost("  ")).toBe("0.0.0.0");
    expect(listenHost("127.0.0.1")).toBe("127.0.0.1");
    const env = readEnv(secrets);
    expect(env.host).toBe("0.0.0.0");
    expect(env.corsOrigins).toEqual([
      "tauri://localhost",
      "http://tauri.localhost",
      "http://localhost:1420",
      "http://127.0.0.1:1420",
    ]);
    expect(env.uploadsDir).toBeNull();
  });

  it("separa as origens do app instalado", () => {
    expect(splitCsv(" http://tauri.localhost, https://tauri.localhost ")).toEqual([
      "http://tauri.localhost",
      "https://tauri.localhost",
    ]);
    const env = readEnv({
      ...secrets,
      CORS_ORIGIN: "http://tauri.localhost,https://tauri.localhost",
      UPLOADS_DIR: "/data/uploads",
      HOST: "0.0.0.0",
    });
    expect(env.host).toBe("0.0.0.0");
    expect(env.corsOrigins).toEqual([
      "tauri://localhost",
      "http://tauri.localhost",
      "http://localhost:1420",
      "http://127.0.0.1:1420",
      "https://tauri.localhost",
    ]);
    expect(env.uploadsDir).toBe("/data/uploads");
  });
});
