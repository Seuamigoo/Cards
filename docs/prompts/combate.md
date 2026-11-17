# Combate

Cole este texto inteiro no Cursor, na raiz do repositório Seuamigoo/Cards, com o `main` atualizado (núcleo do motor, cartas e ações, catálogo e app já mergeados).

```
Implemente o combate do TCG Convergência no motor de domínio. IP própria: não use nomes nem regras de Yu-Gi-Oh. Sem UI. Sem dependência de runtime nova. Não quebre os testes existentes.

Branch: cursor/combate-0328, a partir de origin/main. PR para main.
Commit: feat: combate no motor (ataque, Torre e HP).

Contexto que já existe e deve ser preservado:
- src/domain/actions.ts: Action = advancePhase | summonMonster | setSpellTrap | summonTower | playBiome. applyAction(state, playerIndex, action) devolve {ok:true, state} ou {ok:false, error}. getLegalActions só lista o que aplica com ok. Invocação só em main1/main2, só o jogador ativo. Uma invocação normal por turno. Uma Torre por turno.
- src/domain/state.ts: BoardState com players, turn (começa 1), activePlayerIndex (começa 0), phase (draw|main1|battle|main2|end), winner 0|1|null. MonsterCard tem atk e def. TowerInstance tem card, hp, maxHp. PlayerState.hp. destroyTower(state, playerIndex) manda a Torre ao limbo, zera towerZone e libera outra invocação no turno (PROVISÓRIO).
- src/domain/phases.ts: draw → main1 → battle → main2 → end → draw. No fim do turno (end → draw) zera flags, descarta até handLimit e o jogador novo compra 1, exceto turno 1 do jogador 0. Deck vazio na compra: winner do oponente e game:over reason deck_out.
- src/domain/gameMatch.ts: dispatch(action) grava o estado ANTES de emitir. advancePhase sem decks continua só o ciclo de fases (cardRules false). Com decks, usa applyAction. EventBus em src/domain/eventBus.ts. Ao adicionar evento, inclua a chave no mapa, no Set inicial e no switch de handlersFor.
- Vitest em tests/. npm test = vitest run. npm run typecheck = tsc --noEmit && tsc -p app. TypeScript strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess. Switch de união com default never. Imports só no topo.

Escopo:
1. Estenda Action com:
   { readonly type: "attack"; readonly attackerZoneIndex: number; readonly target: AttackTarget }
   AttackTarget =
     | { readonly kind: "monster"; readonly zoneIndex: number }
     | { readonly kind: "tower" }
     | { readonly kind: "player" }
2. src/domain/combatRules.ts com as regras PROVISÓRIAS comentadas // PROVISÓRIO, num único módulo para trocar depois:
   - Se o oponente tem pelo menos um monstro na monsterZone, o atacante só pode mirar esses monstros.
   - Se o oponente não tem monstro, o atacante pode mirar a Torre (se towerZone !== null) ou o jogador.
3. getLegalTargets(state, playerIndex, attackerZoneIndex): readonly AttackTarget[].
   Vazio se a partida acabou, se não é o jogador ativo, se a fase não é battle, se o índice não tem monstro, se esse monstro já atacou neste turno, ou se é o turno 1 do jogador 0.
4. PlayerState ganha attackedThisTurn: readonly boolean[] com o mesmo tamanho de monsterZone, tudo false no estado inicial e ao criar zonas. No fim do turno, zere esse array junto com as outras flags. Não existe posição de defesa nesta etapa: todo monstro está em ataque. Deixe um comentário // PROVISÓRIO dizendo isso.
5. applyAction do ataque:
   - Só fase battle, só jogador ativo, partida sem winner.
   - O monstro do attackerZoneIndex existe e ainda não atacou.
   - O alvo está em getLegalTargets. Senão, {ok:false, error} claro, sem mutar o estado anterior.
   - Marque attackedThisTurn daquele índice.
   - ATK x ATK contra monstro: o menor ATK é destruído (carta vai para o graveyard do dono, slot null). A diferença de ATK é subtraída do HP do jogador dono do monstro destruído. Empate destrói os dois e não tira HP. Não use DEF.
   - Ataque à Torre: subtrai o ATK do hp da TowerInstance do oponente. Se hp <= 0, use a mesma consequência de destroyTower (carta no limbo, zona null, towerSummonedThisTurn false).
   - Ataque direto ao jogador: subtrai o ATK do hp do oponente.
   - Depois de qualquer dano, se algum PlayerState.hp <= 0, winner é o outro jogador. Se os dois ficarem <= 0 no mesmo ataque (não deve ocorrer com as regras atuais), o atacante vence.
   - winCondition continua "player_hp". Não invente outra condição.
6. getLegalActions na fase battle, para o jogador ativo e sem winner: advancePhase mais um attack para cada par (atacante que ainda não atacou, alvo de getLegalTargets). Fora de battle, nenhum attack.
7. Eventos novos no EventBus, emitidos pelo GameMatch.dispatch depois de salvar o estado, nesta ordem:
   - attack:declared { playerIndex, attackerZoneIndex, target }
   - monster:destroyed { playerIndex, zoneIndex, card } para cada monstro destruído (primeiro o defensor, se houver; depois o atacante, se também morreu)
   - damage:dealt { playerIndex, amount, source: "battle" } para cada jogador que perdeu HP (amount > 0). playerIndex é quem tomou o dano.
   - game:over { winner, reason: "player_hp" } se este ataque encerrou a partida. Alargue GameOverReason para "deck_out" | "player_hp".
   Um handler que chama getState() vê o estado já resolvido.
8. Imutabilidade: o BoardState passado a applyAction permanece igual. Produza objetos novos. Não mute MODE_CONFIGS.

Testes em tests/domain/combat.test.ts:
- Fora de battle, attack é rejeitado e getLegalTargets é vazio.
- Turno 1 do jogador 0 em battle: sem alvos e sem attack em getLegalActions.
- Oponente com monstro: só alvos monster; torre e player são ilegais.
- Oponente sem monstro e com Torre: alvos tower e player.
- Oponente sem monstro e sem Torre: só player.
- ATK maior destrói o menor, manda ao graveyard e aplica a diferença no HP do dono.
- Empate destrói os dois e não muda HP.
- Cada monstro ataca uma vez; o segundo ataque no mesmo turno falha.
- Ataque à Torre reduz hp; em 0 a carta vai ao limbo e a zona fica null.
- Ataque direto reduz o HP do jogador.
- HP <= 0 define winner e getLegalActions fica vazio. Payload game:over usa reason player_hp.
- Toda ação de getLegalActions em battle aplica com ok.
- Estado anterior ao applyAction não muda.
- Partida sem deck (GameMatch classic sem MatchSetup) continua passando no teste antigo de fases: advancePhase não exige combate.

Critério: npm test e npm run typecheck passando. Se o GitHub Actions falhar só com "account is locked due to a billing issue", ignore. Não crie UI.
```
