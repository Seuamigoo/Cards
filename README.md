# Convergência

Núcleo de domínio do motor do TCG Convergência, em TypeScript puro e sem dependências de runtime.

O pacote cobre o domínio do motor e a persistência em memória, sem interface e sem dependência de runtime. Há configuração (`classic` e `blitz`), estado da partida, compra, invocação de monstro, magia/armadilha, Torre, Bioma, Limbo, ciclo de fases e perfis de jogador. Combate e efeitos ficam de fora. `LocalStorageAdapter` só usa `localStorage` quando ele existe no ambiente.

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

