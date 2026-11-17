import { execSync } from "node:child_process";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const directory = mkdtempSync(join(tmpdir(), "convergencia-db-"));
process.env.DATABASE_URL = `file:${join(directory, "test.db")}`;
process.env.JWT_ACCESS_SECRET = "test-access-secret-value";
process.env.JWT_REFRESH_SECRET = "test-refresh-secret-value";
process.env.ADMIN_EMAIL = "admin@convergencia.local";
process.env.ADMIN_PASSWORD = "senha-admin-teste";
process.env.PORT = "3001";

execSync("npx prisma db push --skip-generate --accept-data-loss", {
  cwd: join(dirname(fileURLToPath(import.meta.url)), ".."),
  env: process.env,
  stdio: "pipe",
});
