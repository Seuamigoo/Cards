import { pathToFileURL } from "node:url";
import { PrismaClient } from "@prisma/client";
import { readEnv } from "./env";
import { hashPassword } from "./passwords";

export async function seedAdmin(prisma: PrismaClient, email: string, password: string): Promise<"created" | "unchanged"> {
  if (password.length < 8) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.");
  }
  const normalized = email.toLowerCase();
  const existing = await prisma.user.findUnique({ where: { email: normalized } });
  if (existing === null) {
    await prisma.user.create({
      data: {
        email: normalized,
        username: "admin",
        passwordHash: await hashPassword(password),
        role: "ADMIN",
      },
    });
    return "created";
  }
  if (existing.role !== "ADMIN") {
    await prisma.user.update({ where: { id: existing.id }, data: { role: "ADMIN" } });
  }
  return "unchanged";
}

async function main(): Promise<void> {
  const email = process.env.ADMIN_EMAIL;
  const password = process.env.ADMIN_PASSWORD;
  if (email === undefined || password === undefined || password.length < 8) {
    throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.");
  }
  const env = readEnv();
  const prisma = new PrismaClient({ datasources: { db: { url: env.databaseUrl } } });
  const result = await seedAdmin(prisma, email, password);
  console.log(result === "created" ? `Admin criado para ${email}.` : "Admin já existe.");
  await prisma.$disconnect();
}

if (process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href) {
  await main();
}
