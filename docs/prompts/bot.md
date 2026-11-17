# Bot

Cole este texto inteiro no Cursor depois que o combate estiver na base. O app do servidor ajuda a encaixar o menu, mas o bot é offline e não depende da partida online. Se o servidor já estiver na branch, habilite o botão no menu que hoje diz "em breve".

```
Implemente o bot offline do TCG Convergência. IP própria. src/ai não pode ter dependência de runtime. Não quebre testes existentes. CI bloqueado por cobrança da conta GitHub não é falha de código.

Branch: cursor/bot-0328, a partir da branch que já tem o combate (e o app, se o servidor estiver nessa linha). PR indicando a base.
Commit: feat: bot offline com níveis fácil e normal.

Contexto:
- getLegalActions(state, playerIndex) e applyAction em src/domain/actions.ts. Depois do combate, a fase battle inclui ações attack. Action é união discriminada.
- GameMatch.dispatch aplica e emite eventos. createInitialState compra a mão. resolveConfig("classic" | "blitz").
- Rng em src/domain/rng.ts: { next(): number } em [0, 1). createSeededRng(seed).
- Catálogo embutido catalog/cards.json e CardRegistry / buildDeck. App Vite em app/src/main.ts: o botão "Jogar contra bot (em breve)" está disabled. Passe a habilitá-lo.
- TypeScript strict da raiz. Switch com never. Imports no topo. npm test e npm run typecheck na raiz.

src/ai/bot.ts:
- chooseAction(state, playerIndex, rng, level: "easy" | "normal"): Action | null.
- Se getLegalActions devolver vazio, retorne null.
- Sempre devolva uma ação que está nesse array. Nunca invente índice.
- easy: entre as legais, prefira as que não são advancePhase se existir invocação, set, Torre, Bioma ou ataque; senão advancePhase. O empate entre as preferidas é aleatório com rng (índice = floor(rng.next() * n), com n > 0).
- normal, heurística determinística em cima do rng só para desempate:
  - na main, invoque o monstro de maior ATK em zona vazia se a invocação normal ainda estiver disponível;
  - senão jogue Torre se a zona estiver vazia;
  - senão Bioma se a zona estiver vazia;
  - senão a primeira magia/armadilha em zona vazia;
  - na battle, escolha o ataque cujo ATK do atacante é maior que o ATK do alvo monstro, senão ataque direto ou à Torre quando o alvo existir, senão o ataque que não perde um monstro de ATK maior que o do defensor;
  - se nada disso existir, advancePhase.
  - Comentário // PROVISÓRIO: a heurística não olha DEF, custo nem tags.
- Exporte também playTurn(state, playerIndex, rng, level): aplica chooseAction em loop até a fase mudar, o jogador ativo mudar ou winner !== null, com teto de 40 ações para não travar. Cada passo usa applyAction. Se chooseAction devolver null ou uma ação que falhe, pare.

App:
- "Jogar contra bot" deixa de estar disabled.
- Tela offline: o humano é o jogador 0, o bot é o jogador 1, nível fácil ou normal (dois botões). Deck dos dois: as cartas de monstro, magia, armadilha, Torre e Bioma do catalog/cards.json repetidas até mainDeckMin do modo classic, via buildDeck. Seed fixa 1 para o embaralhamento, para a partida ser reproduzível.
- Mostre HP, fase, mão do humano e as ações legais. Clique humano chama applyAction/dispatch. Quando a vez passa ao bot, chame chooseAction até não ser mais a vez dele.
- Não chame rede.

Testes tests/ai/bot.test.ts:
- Para um estado com várias ações legais, easy e normal devolvem uma ação que getLegalActions contém. Repita com duas seeds.
- chooseAction em estado com winner null e sem ações legais (jogador inativo) devolve null.
- normal, com dois monstros invocáveis, escolhe o de maior ATK.
- normal em battle, com ataque direto disponível e sem monstros inimigos, não escolhe um ataque que não existe; a ação é legal.
- bot contra bot: dois playTurn alternados, ou um loop que usa chooseAction + applyAction para os dois lados, termina com winner !== null em no máximo 40 turnos a partir de um estado inicial classic com o deck do catálogo. Se não terminar, o teste falha com o turn final.

Critério: npm test e npm run typecheck passam. Não altere o servidor nesta etapa, salvo um import inevitável que não exista.
```
