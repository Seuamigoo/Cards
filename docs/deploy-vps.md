# Servidor na VPS

O app instalado joga contra a IA sem login e sem este servidor. Login, cadastro, admin e duelo online só funcionam depois que esta URL estiver no ar e o instalador for gerado de novo com ela.

A URL do app é a variável de build `VITE_API_URL`. Sem ela, o padrão continua vazio: no `npm run dev` o Vite encaminha para `http://127.0.0.1:3001`; no instalador as chamadas não têm servidor.

## DNS

No provedor do domínio, crie um registro **A**:

- nome: `api` (ou o host que você escolheu), por exemplo `api.seudominio.com`
- valor: o IPv4 público da VPS

Espere o nome responder antes de subir o Caddy. As portas **80** e **443** da VPS precisam estar abertas. O certificado HTTPS sai sozinho pelo Caddy.

## Arquivo de ambiente

Na VPS, na pasta do repositório:

```bash
cp server/.env.example server/.env
```

Edite `server/.env`. Troque de verdade, e não deixe os exemplos:

- `JWT_ACCESS_SECRET` e `JWT_REFRESH_SECRET`: dois segredos longos e diferentes
- `ADMIN_EMAIL` e `ADMIN_PASSWORD`: a conta ADMIN, criada no primeiro boot
- `DOMAIN`: o mesmo nome do DNS, sem `https://` (exemplo `api.seudominio.com`)
- `ACME_EMAIL`: um email seu, usado só pelo Let's Encrypt
- `CORS_ORIGIN`: origem da janela do app, não o domínio da API

```bash
CORS_ORIGIN="http://tauri.localhost,https://tauri.localhost"
```

`HOST`, `DATABASE_URL` e `UPLOADS_DIR` do exemplo local são substituídos pelo Compose. O SQLite e as imagens ficam no volume `convergencia-data`, em `/data`.

Nada disso entra no código nem na imagem.

## Subir

Na pasta `server/`:

```bash
docker compose up -d --build
docker compose logs -f server
```

O log deve mostrar o admin criado e o catálogo publicado. Confira:

```bash
curl https://api.seudominio.com/health
```

A resposta esperada é `{"ok":true}`.

Para atualizar o código depois:

```bash
git pull
docker compose up -d --build
```

## Instalador com a URL

No computador que gera o `.exe`, com o domínio já respondendo:

```bash
VITE_API_URL=https://api.seudominio.com npm exec tauri -- build --runner cargo-xwin --target x86_64-pc-windows-msvc --bundles nsis
```

O instalador feito sem `VITE_API_URL` continua válido para jogar contra a IA. Login e online passam a funcionar só no instalador gerado com a URL.
