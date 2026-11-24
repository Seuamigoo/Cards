import { describe, expect, it } from "vitest";
import { listenHost, readEnv, splitCsv } from "../src/env";

const secrets = {
  DATABASE_URL: "file:./dev.db",
  JWT_ACCESS_SECRET: "segredo-access-teste",
  JWT_REFRESH_SECRET: "segredo-refresh-teste",
};

describe("ambiente do servidor", () => {
  it("ouve só localhost e uma origem quando HOST e CORS não vêm preenchidos", () => {
    expect(listenHost(undefined)).toBe("127.0.0.1");
    expect(listenHost("  ")).toBe("127.0.0.1");
    expect(listenHost("0.0.0.0")).toBe("0.0.0.0");
    const env = readEnv(secrets);
    expect(env.host).toBe("127.0.0.1");
    expect(env.corsOrigin).toBe("http://127.0.0.1:1420");
    expect(env.corsOrigins).toEqual(["http://127.0.0.1:1420"]);
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
    expect(env.corsOrigins).toEqual(["http://tauri.localhost", "https://tauri.localhost"]);
    expect(env.uploadsDir).toBe("/data/uploads");
  });
});
