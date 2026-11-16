# Convergência

Núcleo de domínio do motor do TCG Convergência, em TypeScript puro e sem dependências de runtime.

O escopo desta etapa é só `src/domain/` e `tests/domain/`: configuração da partida (`classic` e `blitz`), estado inicial do tabuleiro, ciclo de fases, barramento de eventos e avanço de fase em `GameMatch`. Não há interface, combate, invocação, tags, compra de cartas, Limbo nem efeitos.

## Como rodar

```bash
npm install
npm test
npm run typecheck
```

`npm test` executa os testes com Vitest. `npm run typecheck` roda `tsc --noEmit` em modo strict.
