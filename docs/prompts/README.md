# Guias das próximas etapas

Estes arquivos estão prontos para colar no Cursor. Cada um descreve uma etapa do TCG Convergência de forma autossuficiente: contexto do repositório, escopo, regras, testes e critério de pronto.

A ordem é fixa. Não pule uma etapa: a seguinte depende do código da anterior.

| Ordem | Arquivo | Entrega |
| --- | --- | --- |
| 1 | [combate.md](combate.md) | Combate no motor (`src/domain`), sem UI e sem dependência de runtime |
| 2 | [servidor-auth-admin.md](servidor-auth-admin.md) | Servidor Fastify, login, admin e publicação do catálogo |
| 3 | [online.md](online.md) | Partida online autoritativa por sala |
| 4 | [bot.md](bot.md) | Bot offline no motor e no app |

Antes de colar um guia, o `main` precisa conter as etapas anteriores já mergeadas. Se o PR anterior ainda não entrou em `main`, baseie a branch nova na branch desse PR e diga isso na descrição.

Regras que valem para todas:

- IP própria. Não use nomes, artes ou regras copiadas de Yu-Gi-Oh.
- Não quebre `npm test` nem `npm run typecheck`.
- O motor em `src/domain`, `src/catalog`, `src/persistence` e `src/ai` continua sem dependência de runtime.
- O CI do GitHub pode falhar só porque a conta está bloqueada por cobrança. Nesse caso, ignore o check e valide localmente.
- Imports no topo do arquivo. Em `switch` de união ou enum, o `default` usa `never`.
- Não rotule o trabalho como "Prompt N". Descreva pela funcionalidade: núcleo do motor, cartas e ações, catálogo e app, combate, servidor, online, bot.
