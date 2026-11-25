# Servidor na rede local

O duelo contra a IA não usa este servidor. Login, cadastro e online usam o endereço digitado na tela Entrar, no campo Servidor. Um exemplo é `192.168.0.10:3001`. O app guarda esse endereço neste computador. Se o instalador foi gerado com `VITE_API_URL`, esse valor aparece no campo até alguém trocar.

A porta padrão do servidor é **3001**. Não há descoberta automática do IP. mDNS ou um anúncio UDP exigiria outro programa e uma regra de firewall à parte; o campo Servidor cobre a rede de casa.

## Descobrir o IP

No Windows, no PC que vai rodar o servidor:

```bat
ipconfig
```

Use o IPv4 da rede Wi-Fi ou do cabo, algo como `192.168.0.10`. Ignore `127.0.0.1`.

No Linux:

```bash
hostname -I
```

Nos outros computadores, o campo Servidor fica `192.168.0.10:3001`.

## Node

Na pasta do repositório, com Node 22:

```bash
cp server/.env.example server/.env
```

Troque `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL` e `ADMIN_PASSWORD`. Deixe `HOST=0.0.0.0`. Esses valores ficam só no `.env`.

```bash
npm install
npm run prisma:push -w convergencia-server
npm run seed -w convergencia-server
npm run dev -w convergencia-server
```

O processo escuta em todas as interfaces. No mesmo PC, `http://127.0.0.1:3001/health` responde `{"ok":true}`.

## Docker

Na pasta `server/`, com o mesmo `.env`:

```bash
docker compose -f docker-compose.lan.yml up -d --build
```

O SQLite e as imagens ficam no volume. O Compose publica a porta 3001 na rede local. Este arquivo não usa Caddy nem domínio. O `docker-compose.yml` da VPS continua sendo o caminho com HTTPS.

## Firewall do Windows

No PC do servidor, libere só a porta TCP 3001:

```bat
netsh advfirewall firewall add rule name="Convergencia" dir=in action=allow protocol=TCP localport=3001
```

Se o `.env` usar outra `PORT`, troque o número nos dois lugares: na regra e no campo Servidor.
