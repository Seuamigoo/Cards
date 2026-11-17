# Prompts das próximas etapas

Estes arquivos são prompts prontos para colar no Cursor. Cada um descreve uma etapa do TCG Convergência de forma autossuficiente: contexto do repositório, escopo, regras, testes e critério de pronto.

A ordem é fixa. Não pule uma etapa: a seguinte depende do código da anterior.

| Ordem | Arquivo | Entrega |
| --- | --- | --- |
| 1 | [03-combate.md](03-combate.md) | Combate no motor (`src/domain`), sem UI e sem dependência de runtime |
| 2 | [04-servidor-auth-admin.md](04-servidor-auth-admin.md) | Servidor Fastify, login, admin e publicação do catálogo |
| 3 | [05-online.md](05-online.md) | Partida online autoritativa por sala |
| 4 | [06-bot.md](06-bot.md) | Bot offline no motor e no app |

Antes de colar um prompt, o `main` precisa conter as etapas anteriores já mergeadas. Se o PR anterior ainda não entrou em `main`, baseie a branch nova na branch desse PR e diga isso na descrição.

Regras que valem para todas:

- IP própria. Não use nomes, artes ou regras copiadas de Yu-Gi-Oh.
- Não quebre `npm test` nem `npm run typecheck`.
- O motor em `src/domain`, `src/catalog`, `src/persistence` e `src/ai` continua sem dependência de runtime.
- O CI do GitHub pode falhar só porque a conta está bloqueada por cobrança. Nesse caso, ignore o check e valide localmente.
- Imports no topo do arquivo. Em `switch` de união ou enum, o `default` usa `never`.
