# Convergência

Núcleo de domínio do motor do TCG Convergência, em TypeScript puro e sem dependências de runtime.

O pacote cobre o motor (incluindo combate), o catálogo, a persistência local e o app. O servidor em `server/` tem as próprias dependências. Efeitos de carta ficam de fora.

## Servidor

```bash
cp server/.env.example server/.env
npm install
npm run prisma:push -w convergencia-server
npm run seed -w convergencia-server
npm run dev -w convergencia-server
```

Em outro terminal, `npm run dev -w convergencia-app`. A URL da API é `VITE_API_URL` (vazia no dev, com proxy do Vite para `127.0.0.1:3001`). Variáveis: `DATABASE_URL`, `JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `ADMIN_EMAIL`, `ADMIN_PASSWORD`, `PORT`, `CORS_ORIGIN`.

Testes do servidor: `npm test -w convergencia-server`.

## Como rodar

```bash
npm install
npm test
npm run typecheck
```

`npm test` executa os testes com Vitest. `npm run typecheck` roda `tsc --noEmit` em modo strict, inclusive o app em `app/`. `npm run build:app` gera o frontend.

## Instalar

Os instaladores ficam na página de [Releases](https://github.com/Seuamigoo/Cards/releases):

- Windows: `.exe` (NSIS) e `.msi`
- Linux: AppImage e `.deb`
- macOS: `.dmg`

## Gerar uma versão

Com o código já no `main`:

```bash
git tag v0.1.0 && git push --tags
```

O workflow `.github/workflows/release.yml` compila o app Tauri nessa tag e publica o GitHub Release com os instaladores. O mesmo workflow pode ser disparado manualmente, informando a tag.

