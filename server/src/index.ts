import { buildApp } from "./app";
import { readEnv } from "./env";

const env = readEnv();
const app = await buildApp({
  env,
  ...(env.uploadsDir === null ? {} : { uploadsDir: env.uploadsDir }),
});
await app.listen({ port: env.port, host: env.host });
console.log(`Servidor Convergência em http://${env.host}:${env.port}`);
