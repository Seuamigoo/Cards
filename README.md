# Convergência

Núcleo de domínio do motor do TCG Convergência, em TypeScript puro e sem dependências de runtime.

O pacote cobre o domínio do motor e a persistência em memória, sem interface e sem dependência de runtime. Há configuração (`classic` e `blitz`), estado da partida, compra, invocação de monstro, magia/armadilha, Torre, Bioma, Limbo, ciclo de fases e perfis de jogador. Combate e efeitos ficam de fora. `LocalStorageAdapter` só usa `localStorage` quando ele existe no ambiente.

## Como rodar

```bash
npm install
npm test
npm run typecheck
```

`npm test` executa os testes com Vitest. `npm run typecheck` roda `tsc --noEmit` em modo strict.
