import { PrismaClient } from "@prisma/client";
import { readEnv } from "./env";
import { hashPassword } from "./passwords";

const email = process.env.ADMIN_EMAIL;
const password = process.env.ADMIN_PASSWORD;
if (email === undefined || password === undefined || password.length < 8) {
  throw new Error("Defina ADMIN_EMAIL e ADMIN_PASSWORD no ambiente.");
}

const env = readEnv();
const prisma = new PrismaClient({ datasources: { db: { url: env.databaseUrl } } });
const existing = await prisma.user.findUnique({ where: { email: email.toLowerCase() } });
if (existing === null) {
  await prisma.user.create({
    data: {
      email: email.toLowerCase(),
      username: "admin",
      passwordHash: await hashPassword(password),
      role: "admin",
    },
  });
  console.log(`Admin criado para ${email}.`);
} else {
  console.log("Admin já existe.");
}
await prisma.$disconnect();
