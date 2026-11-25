import { describe, expect, it } from "vitest";
import {
  normalizeServerInput,
  probeServer,
  rememberServer,
  serverBase,
  serverFieldValue,
  SERVER_STORAGE_KEY,
} from "../../app/src/serverUrl";
import type { ServerStore } from "../../app/src/serverUrl";

function memoryStore(initial: string | null = null): ServerStore {
  const values = new Map<string, string>();
  if (initial !== null) {
    values.set(SERVER_STORAGE_KEY, initial);
  }
  return {
    getItem(key) {
      return values.get(key) ?? null;
    },
    setItem(key, value) {
      values.set(key, value);
    },
  };
}

describe("endereço do servidor", () => {
  it("usa o endereço do build quando nada foi salvo", () => {
    expect(serverFieldValue("https://api.exemplo.com", null)).toBe("https://api.exemplo.com");
    expect(serverBase("https://api.exemplo.com/", null)).toBe("https://api.exemplo.com");
    expect(serverBase("", null)).toBe("");
  });

  it("guarda um IP da rede local e completa o http", () => {
    const store = memoryStore();
    expect(rememberServer(store, " 192.168.0.10:3001 ")).toBe("http://192.168.0.10:3001");
    expect(store.getItem(SERVER_STORAGE_KEY)).toBe("http://192.168.0.10:3001");
    expect(serverBase("https://api.exemplo.com", store.getItem(SERVER_STORAGE_KEY))).toBe("http://192.168.0.10:3001");
    expect(normalizeServerInput("http://192.168.0.10:3000/")).toBe("http://192.168.0.10:3000");
  });

  it("mostra o valor salvo no campo", () => {
    expect(serverFieldValue("https://api.exemplo.com", "http://10.0.0.8:3001")).toBe("http://10.0.0.8:3001");
  });

  it("explica quando o /health não responde", async () => {
    const down = await probeServer("http://192.168.0.10:3001", () => Promise.reject(new Error("offline")));
    expect(down).toMatch(/não foi possível falar com o servidor/i);
    const html = await probeServer("http://192.168.0.10:3001", () =>
      Promise.resolve(new Response("<html></html>", { status: 200, headers: { "content-type": "text/html" } })),
    );
    expect(html).toMatch(/não foi possível falar com o servidor/i);
    const ok = await probeServer("http://192.168.0.10:3001", () =>
      Promise.resolve(new Response(JSON.stringify({ ok: true }), { status: 200 })),
    );
    expect(ok).toBeNull();
  });
});
