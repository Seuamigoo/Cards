import { cpSync, createReadStream, existsSync, statSync } from "node:fs";
import { dirname, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import type { Plugin, ViteDevServer } from "vite";

const appDir = dirname(fileURLToPath(import.meta.url));
const assetsDir = resolve(appDir, "../assets");

export default defineConfig({
  base: "./",
  plugins: [serveCardAssets()],
  server: {
    port: 1420,
    strictPort: true,
    fs: {
      allow: [resolve(appDir, "..")],
    },
  },
});

function serveCardAssets(): Plugin {
  return {
    name: "card-assets",
    configureServer(server: ViteDevServer) {
      server.middlewares.use("/assets", (request, response, next) => {
        const raw = request.url ?? "/";
        const relative = decodeURIComponent(raw.split("?")[0] ?? "/").replace(/^\/+/, "");
        const filePath = join(assetsDir, relative);
        const root = assetsDir.endsWith(sep) ? assetsDir : `${assetsDir}${sep}`;
        if (!filePath.startsWith(root) || !existsSync(filePath) || !statSync(filePath).isFile()) {
          next();
          return;
        }
        response.setHeader("Content-Type", contentType(filePath));
        createReadStream(filePath).pipe(response);
      });
    },
    closeBundle() {
      cpSync(assetsDir, resolve(appDir, "dist/assets"), { recursive: true });
    },
  };
}

function contentType(filePath: string): string {
  if (filePath.endsWith(".webp")) {
    return "image/webp";
  }
  if (filePath.endsWith(".png")) {
    return "image/png";
  }
  if (filePath.endsWith(".jpg") || filePath.endsWith(".jpeg")) {
    return "image/jpeg";
  }
  return "application/octet-stream";
}
