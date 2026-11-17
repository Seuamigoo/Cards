import { buildApp } from "./app";
import { readEnv } from "./env";

const env = readEnv();
const app = await buildApp({ env });
await app.listen({ port: env.port, host: "127.0.0.1" });
console.log(`Servidor Convergência em http://127.0.0.1:${env.port}`);
